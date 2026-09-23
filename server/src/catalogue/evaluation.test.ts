import { describe, expect, it } from 'vitest';
import { route } from './router.js';
import { TEMPLATES } from './templates.js';

/**
 * The evaluation harness.
 *
 * This is the question space, written down. Every phrasing the product claims
 * to understand is listed on its template and exercised here, so widening the
 * catalogue cannot silently narrow it: if a new template starts answering an
 * old template's question, this fails.
 */
describe('the evaluation harness', () => {
  it('offers the twelve answerable questions the design promises', () => {
    expect(TEMPLATES).toHaveLength(12);
  });

  it('gives every template a distinct id', () => {
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
  });

  const cases = TEMPLATES.flatMap((template) =>
    [template.canonical, ...template.examples].map(
      (phrasing) => [String(template.id), phrasing] as const,
    ),
  );

  it.each(cases)('%s answers "%s"', (id, phrasing) => {
    const result = route(phrasing);

    expect(result.matched).toBe(true);
    expect(result.matched && String(result.template.id)).toBe(id);
  });

  it.each([
    'forecast next quarter onboarding',
    'show me employee salaries',
    "what's the weather",
    'who is the chief executive',
  ])('declines to answer "%s"', (question) => {
    expect(route(question).matched).toBe(false);
  });
});
