import { beforeEach, describe, expect, it } from 'vitest';
import { DATA_TABLES } from '../db/schema.js';
import { isSchemaContextCached, resetSchemaContext, schemaContext } from './schema-context.js';

/**
 * The context is the only description of the bank a generator ever sees, so
 * what it leaves out matters as much as what it contains.
 */
describe('the schema context', () => {
  beforeEach(resetSchemaContext);

  it('describes every table generated SQL is allowed to read', () => {
    const { text } = schemaContext();

    for (const table of DATA_TABLES) {
      expect(text).toContain(`table ${table}`);
    }
  });

  it('never mentions the audit log, which generated SQL may not read', () => {
    const { text } = schemaContext();

    expect(text).not.toContain('query_log');
    expect(text).not.toContain('trace_id');
  });

  it('spells out enum values, so a generator need not guess at them', () => {
    const { text } = schemaContext();

    expect(text).toContain('enum(retail|sme|corporate|private_banking)');
    expect(text).toContain('enum(approved|rejected|pending)');
  });

  it('states the relationships, so joins do not have to be inferred from names', () => {
    const { text } = schemaContext();

    expect(text).toContain('transactions.customer_id -> customers.id');
    expect(text).toContain('onboarding_applications.branch_id -> branches.id');
  });

  it('says money is held in pence, which no column name conveys', () => {
    expect(schemaContext().text).toMatch(/amount_minor bigint.*pence/);
  });

  it('qualifies notes by table, so a nullable column elsewhere is not described as nullable here', () => {
    const transactions = schemaContext()
      .text.split('table ')
      .find((block) => block.startsWith('transactions'));

    expect(transactions).toBeDefined();
    expect(transactions).toContain('customer_id integer');
    expect(transactions).not.toContain('customer_id integer null');
    expect(transactions).not.toContain('declined before a customer existed');
  });

  it('is built once and reused, rather than reassembled for every question', () => {
    expect(isSchemaContextCached()).toBe(false);

    const first = schemaContext();
    expect(isSchemaContextCached()).toBe(true);
    expect(schemaContext()).toBe(first);
  });

  it('reports a size, because context costs money on a metered provider', () => {
    const { tokensApprox, text } = schemaContext();

    expect(tokensApprox).toBeGreaterThan(0);
    expect(tokensApprox).toBeLessThan(text.length);
  });
});
