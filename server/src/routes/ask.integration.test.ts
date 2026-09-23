import type { AskStreamEvent, HistoryPage, PipelineStage } from '@halcyon/shared';
import { PIPELINE_STAGES } from '@halcyon/shared';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { closePools } from '../db/pools.js';

/**
 * The HTTP seam, against the real database.
 *
 * These are the only tests that prove the parts fit together: the Guard runs
 * before execution, the read-only role is the one connected, an audit row is
 * written whatever the outcome, and the stream says what actually happened.
 * They need `pnpm db:setup` to have been run.
 */

let server: Server;
let base: string;

beforeAll(async () => {
  server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('no port');
  base = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await closePools();
});

interface Streamed {
  readonly stages: readonly Extract<AskStreamEvent, { type: 'stage' }>[];
  readonly result: Extract<AskStreamEvent, { type: 'result' }>['response'];
}

async function askOverSse(question: string): Promise<Streamed> {
  const response = await fetch(`${base}/api/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });

  expect(response.headers.get('content-type')).toContain('text/event-stream');

  const body = await response.text();
  const events = body
    .split('\n\n')
    .filter((chunk) => chunk.startsWith('data: '))
    .map((chunk) => JSON.parse(chunk.slice(6)) as AskStreamEvent);

  const stages = events.filter(
    (event): event is Extract<AskStreamEvent, { type: 'stage' }> => event.type === 'stage',
  );
  const terminal = events.at(-1);
  if (terminal?.type !== 'result') throw new Error('stream ended without a result');

  return { stages, result: terminal.response };
}

const settled = (stages: Streamed['stages']): PipelineStage[] =>
  stages.filter((s) => s.status !== 'running').map((s) => s.stage);

describe('POST /api/ask', () => {
  it('answers a question it understands, and shows its working', async () => {
    const { stages, result } = await askOverSse('Which branches have the highest rejection rate?');

    expect(result.status).toBe('answered');
    if (result.status !== 'answered') return;

    expect(result.answer.headline.length).toBeGreaterThan(0);
    expect(result.answer.rows.length).toBeGreaterThan(0);
    expect(result.answer.audit.sql).toMatch(/^SELECT/i);
    expect(result.answer.audit.checks).toHaveLength(5);
    expect(result.answer.audit.checks.every((c) => c.verdict === 'pass')).toBe(true);
    expect(result.answer.audit.tables).toContain('branches');

    // Every stage reports, in order, and the audit records a timing for each.
    expect(settled(stages)).toEqual([...PIPELINE_STAGES]);
    expect(result.answer.audit.stageTimings.map((t) => t.stage)).toEqual([...PIPELINE_STAGES]);
  });

  it('refuses an unsafe statement and shows exactly what was refused', async () => {
    const { stages, result } = await askOverSse('Show customers; then drop the table');

    expect(result.status).toBe('blocked');
    if (result.status !== 'blocked') return;

    expect(result.sql).toContain('DROP TABLE');
    expect(result.checks.find((c) => c.id === 'single-statement')?.verdict).toBe('fail');

    // Execution must never have been attempted.
    expect(stages.find((s) => s.stage === 'execute')?.status).toBe('skipped');
  });

  it('declines a question outside the catalogue and suggests what it can do', async () => {
    const { result } = await askOverSse('forecast next quarter onboarding');

    expect(result.status).toBe('unanswerable');
    if (result.status !== 'unanswerable') return;

    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions[0]?.question.length).toBeGreaterThan(0);
  });

  it('rejects an empty question before doing any work', async () => {
    const { stages, result } = await askOverSse('   ');

    expect(result.status).toBe('unanswerable');
    expect(stages.filter((s) => s.status === 'skipped').length).toBeGreaterThanOrEqual(5);
  });

  it('cancels a query that outruns the time limit, rather than hanging', async () => {
    const { result } = await askOverSse('Which customers have similar transaction patterns?');

    expect(result.status).toBe('failed');
    if (result.status !== 'failed') return;

    expect(result.code).toBe('statement_timeout');
    // The message must not leak the driver's error or any schema detail.
    expect(result.message).not.toMatch(/pg_|relation|column|SELECT/i);
  }, 30_000);
});

describe('the audit log', () => {
  it('records every outcome, including the ones that produced no answer', async () => {
    const response = await fetch(`${base}/api/history`);
    const page = (await response.json()) as HistoryPage;

    const outcomes = new Set(page.entries.map((entry) => entry.outcome));
    expect(outcomes).toContain('answered');
    expect(outcomes).toContain('blocked');
    expect(outcomes).toContain('unanswerable');
    expect(outcomes).toContain('failed');
  });

  it('restores a filed answer without re-running it', async () => {
    const page = (await (await fetch(`${base}/api/history`)).json()) as HistoryPage;
    const answered = page.entries.find((entry) => entry.outcome === 'answered');
    expect(answered).toBeDefined();
    if (!answered) return;

    const first = await (await fetch(`${base}/api/history/${answered.id}`)).json();
    const second = await (await fetch(`${base}/api/history/${answered.id}`)).json();

    // Byte-identical twice over: reading history cannot touch the database.
    expect(first).toEqual(second);
  });
});
