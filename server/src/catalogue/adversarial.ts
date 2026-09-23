import { asTemplateId, type CellValue, type SafetyCheckId, type TemplateId } from '@halcyon/shared';

/**
 * Questions whose SQL is unsafe on purpose.
 *
 * Without these the Guard's refusal would be unreachable from the interface:
 * the catalogue only ever emits safe SQL, so the blocked state would be dead
 * code that no reviewer could trigger and no test could honestly exercise. The
 * probes are offered in the UI as "test the guard", clearly labelled.
 *
 * They are never executed. The Guard fails closed, and `halcyon_ro` holds no
 * privilege that would let them run even if it did not.
 */
export interface AdversarialProbe {
  readonly id: TemplateId;
  readonly question: string;
  readonly sql: string;
  readonly parameters: readonly CellValue[];
  /** The check this probe is designed to trip. */
  readonly fails: SafetyCheckId;
  /** Shown beside the refusal, so the demonstration teaches something. */
  readonly explanation: string;
}

export const ADVERSARIAL_PROBES: readonly AdversarialProbe[] = [
  {
    id: asTemplateId('adv-stacked-statement'),
    question: 'Show customers; then drop the table',
    sql: 'SELECT name FROM customers LIMIT 10; DROP TABLE customers',
    parameters: [],
    fails: 'single-statement',
    explanation:
      'Two statements arrived where one was expected. The second would destroy the customers table, and hiding it behind a semicolon is the oldest trick there is.',
  },
  {
    id: asTemplateId('adv-delete-customers'),
    question: 'Delete all customer records',
    sql: 'DELETE FROM customers',
    parameters: [],
    fails: 'read-only',
    explanation:
      'The statement writes. Halcyon answers questions; it has no mechanism for changing the bank’s records, and the role it connects as holds no write privilege either.',
  },
  {
    id: asTemplateId('adv-drop-transactions'),
    question: 'Drop the transactions table',
    sql: 'DROP TABLE transactions',
    parameters: [],
    fails: 'read-only',
    explanation:
      'Data definition, not a question. Nothing in the product may alter the shape of the database.',
  },
  {
    id: asTemplateId('adv-read-pg-catalog'),
    question: 'List the database users',
    sql: 'SELECT usename FROM pg_catalog.pg_user',
    parameters: [],
    fails: 'tables-allow-listed',
    explanation:
      'The system catalogue is not one of the four data tables. This is the check that matters most in practice: PostgreSQL grants every role read access to pg_catalog, so the allow-list — not the role — is what prevents disclosure here.',
  },
  {
    id: asTemplateId('adv-unbounded-scan'),
    question: 'Show me every transaction ever',
    sql: 'SELECT id, customer_id, amount_minor FROM transactions LIMIT 5000000',
    parameters: [],
    fails: 'row-limit',
    explanation:
      'The statement demands five million rows. A missing limit would simply have been filled in, but an explicit demand beyond the cap is refused rather than quietly reduced, because silently returning different data than was asked for is worse than saying no.',
  },
  {
    id: asTemplateId('adv-injected-predicate'),
    question: "Show customers named x' OR 1=1 --",
    sql: "SELECT name FROM customers WHERE name = 'x' OR 'a' = 'a' LIMIT 10",
    parameters: [],
    fails: 'parameters-bound',
    explanation:
      'A value has been written into the statement instead of bound to it, and the tautology it creates would return every customer. Generated SQL carries no string literals at all, so concatenation cannot be expressed in the first place.',
  },
];
