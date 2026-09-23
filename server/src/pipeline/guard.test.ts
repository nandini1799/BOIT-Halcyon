import { describe, expect, it } from 'vitest';
import { guard } from './guard.js';

/**
 * The Guard is the product's central claim: no unsafe statement reaches the
 * database. These tests are the evidence for that claim, so they are written
 * as attacks rather than as descriptions of the implementation.
 */
describe('the Guard', () => {
  describe('check 1 — exactly one statement', () => {
    it('refuses a statement smuggled in after a semicolon', () => {
      const result = guard('SELECT name FROM customers LIMIT 10; DROP TABLE customers');

      expect(result.ok).toBe(false);
      expect(result.checks.find((c) => c.id === 'single-statement')?.verdict).toBe('fail');
    });
  });

  describe('check 2 — read-only', () => {
    it.each([
      ['a delete', 'DELETE FROM customers'],
      ['an update', "UPDATE customers SET name = 'x' WHERE id = 1"],
      ['an insert', "INSERT INTO customers (id, name) VALUES (1, 'x')"],
      ['a drop', 'DROP TABLE transactions'],
      ['a truncate', 'TRUNCATE customers'],
    ])('refuses %s', (_label, sql) => {
      const result = guard(sql);

      expect(result.ok).toBe(false);
      expect(result.checks.find((c) => c.id === 'read-only')?.verdict).toBe('fail');
    });
  });

  describe('check 3 — known tables only', () => {
    const allowList = (sql: string) =>
      guard(sql).checks.find((c) => c.id === 'tables-allow-listed')?.verdict;

    it('refuses the system catalogue, which the read-only role can otherwise read', () => {
      expect(allowList('SELECT usename FROM pg_catalog.pg_user')).toBe('fail');
    });

    it('refuses the audit log, so a question cannot read what other people asked', () => {
      expect(allowList('SELECT question FROM query_log')).toBe('fail');
    });

    it('refuses an unknown table hidden in a subquery', () => {
      expect(
        allowList('SELECT id FROM customers WHERE id IN (SELECT id FROM salaries)'),
      ).toBe('fail');
    });

    it('allows a join across the four data tables', () => {
      expect(
        allowList(`SELECT b.name, count(*) FROM onboarding_applications a
                     JOIN branches b ON b.id = a.branch_id GROUP BY 1`),
      ).toBe('pass');
    });

    it('allows a common table expression, whose alias is not a table', () => {
      expect(
        allowList(`WITH profile AS (SELECT customer_id, sum(amount_minor) AS total
                                      FROM transactions GROUP BY 1)
                   SELECT customer_id FROM profile ORDER BY total DESC`),
      ).toBe('pass');
    });
  });

  describe('check 4 — row limit', () => {
    it('applies a cap to a statement that has none, and says so', () => {
      const result = guard('SELECT name FROM customers');

      expect(result.ok).toBe(true);
      expect(result.sql).toMatch(/limit 1000/i);
      expect(result.checks.find((c) => c.id === 'row-limit')?.detail).toMatch(/1,000/);
    });

    it('leaves a statement already within the cap alone', () => {
      const result = guard('SELECT name FROM customers LIMIT 10');

      expect(result.ok).toBe(true);
      expect(result.sql).toMatch(/limit 10\b/i);
      expect(result.sql).not.toMatch(/limit 1000/i);
    });

    it('refuses a statement that demands more than the cap, rather than quietly truncating it', () => {
      const result = guard('SELECT id FROM transactions LIMIT 500000');

      expect(result.ok).toBe(false);
      expect(result.checks.find((c) => c.id === 'row-limit')?.verdict).toBe('fail');
    });
  });

  describe('check 5 — values are bound, never concatenated', () => {
    const bound = (sql: string, params: readonly unknown[] = []) =>
      guard(sql, params).checks.find((c) => c.id === 'parameters-bound')?.verdict;

    it('refuses a value written into the statement as a literal', () => {
      expect(bound("SELECT name FROM customers WHERE segment = 'retail' LIMIT 10")).toBe('fail');
    });

    it('refuses the classic tautology, which is only reachable by concatenation', () => {
      expect(bound("SELECT name FROM customers WHERE name = 'x' OR 'a' = 'a' LIMIT 10")).toBe('fail');
    });

    it('accepts a placeholder with a matching parameter', () => {
      expect(bound('SELECT name FROM customers WHERE segment = $1 LIMIT 10', ['retail'])).toBe('pass');
    });

    it('refuses a placeholder with no parameter supplied for it', () => {
      expect(bound('SELECT name FROM customers WHERE segment = $1 LIMIT 10', [])).toBe('fail');
    });

    it('allows numeric literals, which carry no user input', () => {
      expect(bound('SELECT count(*) FROM transactions GROUP BY 1 LIMIT 10')).toBe('pass');
    });
  });

  describe('failing closed', () => {
    it('refuses a statement it cannot parse, rather than throwing', () => {
      expect(() => guard('SELECT FROM WHERE ORDER BY;;')).not.toThrow();
      expect(guard('SELECT FROM WHERE ORDER BY;;').ok).toBe(false);
    });

    it('refuses an empty statement', () => {
      expect(guard('   ').ok).toBe(false);
    });

    it('shows a refused statement exactly as it was submitted, not as rewritten', () => {
      const submitted = 'SELECT usename FROM pg_catalog.pg_user';
      const result = guard(submitted);

      expect(result.ok).toBe(false);
      // Displaying our own rewrite would misrepresent what was actually refused.
      expect(result.sql).toBe(submitted);
    });

    it.each([
      ['a safe statement', 'SELECT name FROM customers LIMIT 10'],
      ['a write', 'DELETE FROM customers'],
      ['a stacked statement', 'SELECT 1; DROP TABLE customers'],
      ['an unparseable statement', 'SELECT FROM WHERE ORDER BY;;'],
      ['a forbidden table', 'SELECT * FROM pg_catalog.pg_user'],
    ])('reports all five verdicts for %s, so the notes drawer is never partial', (_label, sql) => {
      const result = guard(sql);

      expect(result.checks.map((c) => c.id).sort()).toEqual([
        'parameters-bound',
        'read-only',
        'row-limit',
        'single-statement',
        'tables-allow-listed',
      ]);
      expect(result.checks.every((c) => c.detail.length > 0)).toBe(true);
    });
  });

  describe('the statement it hands on', () => {
    const written = `SELECT b.name AS branch,
       count(*)::int AS applications
  FROM onboarding_applications a
  JOIN branches b ON b.id = a.branch_id
 GROUP BY 1`;

    it('adds the bound without reformatting the statement around it', () => {
      const result = guard(written);

      // The audit block prints this under "query as executed". If the Guard
      // reconstructed it from the tree, the reader would be shown a paraphrase.
      expect(result.ok).toBe(true);
      expect(result.sql.startsWith(written)).toBe(true);
      expect(result.sql).toContain('LIMIT 1000');
    });

    it('leaves an already-bounded statement exactly as written', () => {
      const bounded = `${written}\n LIMIT 5`;

      expect(guard(bounded).sql).toBe(bounded);
    });

    it('bounds a statement whose trailing semicolon would otherwise swallow the limit', () => {
      const result = guard(`${written};`);

      expect(result.ok).toBe(true);
      expect(result.sql).toContain('LIMIT 1000');
      expect(result.sql).not.toContain(';');
    });
  });
});
