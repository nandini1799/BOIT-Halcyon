import { describe, expect, it } from 'vitest';
import { guard } from '../pipeline/guard.js';
import { buildSql } from './sql.js';
import { TEMPLATES } from './templates.js';

const cases = TEMPLATES.map((template) => [String(template.id), template] as const);

/**
 * The catalogue and the Guard have to agree, and this is where that is proven.
 *
 * Nothing in the Guard knows about templates and nothing in the catalogue knows
 * about the Guard, so a template whose SQL the Guard would refuse is a bug that
 * would otherwise only appear when a user asked that question.
 */
describe('the SQL builder', () => {
  it.each(cases)('%s produces SQL that satisfies every safety check', (_id, template) => {
    const plan = buildSql(template);
    const result = guard(plan.text, plan.parameters);

    expect(result.checks.filter((c) => c.verdict === 'fail').map((c) => `${c.id}: ${c.detail}`)).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it.each(cases)('%s reads exactly the tables it declares', (_id, template) => {
    const plan = buildSql(template);
    const result = guard(plan.text, plan.parameters);

    expect([...result.tables].sort()).toEqual([...template.tables].sort());
  });

  it.each(cases)('%s binds every value it needs', (_id, template) => {
    const plan = buildSql(template);
    const placeholders = new Set(plan.text.match(/\$\d+/g) ?? []);

    expect(placeholders.size).toBe(plan.parameters.length);
  });
});
