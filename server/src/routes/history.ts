import {
  asAnswerId,
  assertNever,
  type Answer,
  type FailureCode,
  type HistoryDetail,
  type HistoryEntry,
  type HistoryPage,
  type Outcome,
  type SafetyCheck,
} from '@halcyon/shared';
import { Router, type Request, type Response } from 'express';
import { audit } from '../db/pools.js';

export const historyRouter: Router = Router();

interface LogRow {
  readonly id: string;
  readonly question: string;
  readonly asked_at: Date;
  readonly outcome: Outcome;
  readonly tables_touched: string[] | null;
  readonly row_count: number | null;
  readonly elapsed_ms: number;
  readonly sql_text: string | null;
  readonly checks: SafetyCheck[] | null;
  readonly answer: Answer | null;
  readonly reason: string | null;
  readonly failure_code: FailureCode | null;
}

const HISTORY_LIMIT = 50;

/**
 * `GET /api/history` — the audit log, read back as chat history. See ADR-0005.
 *
 * Served by the audit role, which can read this table and nothing else, so a
 * bug here cannot reach the bank's data.
 */
historyRouter.get('/history', async (_request: Request, response: Response): Promise<void> => {
  const result = await audit().query<LogRow>(
    `SELECT id, question, asked_at, outcome, tables_touched, row_count, elapsed_ms
       FROM query_log
      ORDER BY asked_at DESC
      LIMIT ${HISTORY_LIMIT}`,
  );

  const entries: HistoryEntry[] = result.rows.map((row) => ({
    id: asAnswerId(row.id),
    question: row.question,
    askedAt: row.asked_at.toISOString(),
    outcome: row.outcome,
    tables: row.tables_touched ?? [],
    rowCount: row.row_count,
    elapsedMs: row.elapsed_ms,
  }));

  const payload: HistoryPage = { entries };
  response.json(payload);
});

/**
 * `GET /api/history/:id` — one filed answer, restored exactly as it was.
 *
 * Re-opening never re-runs the query. An answer is a record of what was true
 * when it was asked, and quietly refreshing it would make the audit trail a
 * description of the present rather than of the past.
 */
historyRouter.get('/history/:id', async (request: Request, response: Response): Promise<void> => {
  const { id } = request.params;

  const result = await audit().query<LogRow>(
    `SELECT id, question, asked_at, outcome, sql_text, checks, answer, reason, failure_code
       FROM query_log WHERE id = $1`,
    [id],
  );

  const row = result.rows[0];
  if (!row) {
    response.status(404).json({ message: 'No such entry.' });
    return;
  }

  const detail = restore(row);
  if (!detail) {
    response.status(410).json({ message: 'That entry can no longer be displayed.' });
    return;
  }

  response.json(detail);
});

function restore(row: LogRow): HistoryDetail | null {
  switch (row.outcome) {
    case 'answered':
      return row.answer ? { status: 'answered', answer: row.answer } : null;
    case 'unanswerable':
      return {
        status: 'unanswerable',
        question: row.question,
        reason: row.reason ?? 'That question could not be answered.',
      };
    case 'blocked':
      return {
        status: 'blocked',
        question: row.question,
        reason: row.reason ?? 'The statement did not pass the safety checks.',
        sql: row.sql_text ?? '',
        checks: row.checks ?? [],
      };
    case 'failed':
      return {
        status: 'failed',
        question: row.question,
        code: row.failure_code ?? 'execution_error',
        message: row.reason ?? 'The query did not complete.',
      };
    default:
      return assertNever(row.outcome, 'history outcome');
  }
}
