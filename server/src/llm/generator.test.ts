import { describe, expect, it } from 'vitest';
import { ADVERSARIAL_PROBES } from '../catalogue/adversarial.js';
import { route } from '../catalogue/router.js';
import { buildSql } from '../catalogue/sql.js';
import { TEMPLATES } from '../catalogue/templates.js';
import { guard } from '../pipeline/guard.js';
import { generateSql } from './generator.js';
import { mockProvider, type CompletionResponse, type LlmProvider } from './provider.js';

const stub = (content: string): LlmProvider => ({
  name: 'stub',
  complete: (request): Promise<CompletionResponse> =>
    Promise.resolve({
      model: request.model,
      content,
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      finishReason: 'stop',
    }),
});

describe('the mock provider', () => {
  it('returns the catalogue statement for every question the catalogue answers', async () => {
    for (const template of TEMPLATES) {
      const routing = route(template.canonical);
      if (!routing.matched) continue;

      const result = await generateSql(template.canonical);

      expect(result.ok, template.canonical).toBe(true);
      if (result.ok) expect(result.plan.text).toBe(buildSql(routing.template).text);
    }
  });

  it('is deterministic — the same question twice gives the same statement', async () => {
    const question = 'How has transaction value moved over the year?';
    const [first, second] = await Promise.all([generateSql(question), generateSql(question)]);

    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) expect(first.plan.text).toBe(second.plan.text);
  });

  it('declines a question the schema cannot answer, rather than inventing a table', async () => {
    const result = await generateSql('What is the weather in Leeds?');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/does not hold/);
  });

  it('reports what the call cost, including the context it was given', async () => {
    const result = await generateSql('How has transaction value moved over the year?');

    expect(result.trace.provider).toBe('mock');
    expect(result.trace.promptTokens).toBeGreaterThan(result.trace.contextTokens - 1);
    expect(result.trace.completionTokens).toBeGreaterThan(0);
  });
});

/**
 * The point of generating through a provider at all: the statement arrives from
 * something that could have produced anything, and is refused on its contents
 * rather than on where it came from.
 */
describe('unsafe statements produced by the generator', () => {
  it.each(ADVERSARIAL_PROBES.map((probe) => [probe.question, probe.fails] as const))(
    'is refused by the Guard — %s',
    async (question, fails) => {
      const result = await generateSql(question);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const verdict = guard(result.plan.text, result.plan.parameters);

      expect(verdict.ok).toBe(false);
      expect(verdict.checks.find((c) => c.id === fails)?.verdict).toBe('fail');
    },
  );
});

/**
 * A reply is a string until it has been parsed. These are the cases a hosted
 * model produces on a bad day, and none of them may reach the Guard as a
 * half-formed object.
 */
describe('a reply that cannot be trusted', () => {
  it('rejects a reply that is not JSON at all', async () => {
    const result = await generateSql('anything', stub('Certainly! Here is your SQL:'));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/not JSON/);
  });

  it('rejects JSON of the wrong shape', async () => {
    const result = await generateSql('anything', stub('{"statement":"SELECT 1"}'));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/unexpected shape/);
  });

  it('rejects an answerable reply carrying no statement', async () => {
    const result = await generateSql('anything', stub('{"answerable":true,"sql":"","parameters":[]}'));

    expect(result.ok).toBe(false);
  });

  it('passes on the reason when the generator declines', async () => {
    const result = await generateSql(
      'anything',
      stub('{"answerable":false,"reason":"No table holds interest rates."}'),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('No table holds interest rates.');
  });

  it('still reports the cost of a call that produced nothing usable', async () => {
    const result = await generateSql('anything', stub('not json'));

    expect(result.trace.model).toBeTruthy();
    expect(result.trace.contextTokens).toBeGreaterThan(0);
  });
});

describe('the provider contract', () => {
  it('is given the schema as a system message and the question as a user message', async () => {
    const seen: { role: string; content: string }[] = [];
    const recorder: LlmProvider = {
      name: 'recorder',
      complete: (request) => {
        seen.push(...request.messages.map((m) => ({ role: m.role, content: m.content })));
        return mockProvider.complete(request);
      },
    };

    const question = 'How has transaction value moved over the year?';
    await generateSql(question, recorder);

    expect(seen.map((m) => m.role)).toEqual(['system', 'user']);
    expect(seen[0]?.content).toMatch(/^You are Halcyon/);
    expect(seen[0]?.content).toContain('table transactions');
    expect(seen[1]?.content).toBe(question);
  });
});
