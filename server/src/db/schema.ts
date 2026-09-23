import {
  bigint,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * The schema is the single source of truth for the Guard's table allow-list and
 * the router's catalogue — see ADR-0003. Adding a table here is therefore a
 * deliberate security decision, not an oversight: it must be listed in
 * DATA_TABLES below to become readable by generated SQL.
 */

export const segment = pgEnum('segment', ['retail', 'sme', 'corporate', 'private_banking']);
export const riskBand = pgEnum('risk_band', ['low', 'medium', 'high']);
export const decision = pgEnum('decision', ['approved', 'rejected', 'pending']);
export const txDirection = pgEnum('tx_direction', ['credit', 'debit']);
export const outcome = pgEnum('outcome', ['answered', 'unanswerable', 'blocked', 'failed']);

export const branches = pgTable('branches', {
  id: integer('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  city: text('city').notNull(),
  region: text('region').notNull(),
  openedOn: timestamp('opened_on', { withTimezone: true }).notNull(),
});

export const customers = pgTable(
  'customers',
  {
    id: integer('id').primaryKey(),
    name: text('name').notNull(),
    segment: segment('segment').notNull(),
    branchId: integer('branch_id')
      .notNull()
      .references(() => branches.id),
    riskBand: riskBand('risk_band').notNull(),
    onboardedOn: timestamp('onboarded_on', { withTimezone: true }).notNull(),
    status: text('status').notNull(),
  },
  (t) => [index('customers_segment_idx').on(t.segment), index('customers_branch_idx').on(t.branchId)],
);

export const onboardingApplications = pgTable(
  'onboarding_applications',
  {
    id: integer('id').primaryKey(),
    // Null until approved — an application can be declined before a customer exists.
    customerId: integer('customer_id').references(() => customers.id),
    branchId: integer('branch_id')
      .notNull()
      .references(() => branches.id),
    segment: segment('segment').notNull(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decision: decision('decision').notNull(),
    rejectionReason: text('rejection_reason'),
    channel: text('channel').notNull(),
  },
  (t) => [
    index('applications_submitted_idx').on(t.submittedAt),
    index('applications_branch_idx').on(t.branchId),
    index('applications_segment_idx').on(t.segment),
    index('applications_decision_idx').on(t.decision),
  ],
);

export const transactions = pgTable(
  'transactions',
  {
    id: integer('id').primaryKey(),
    customerId: integer('customer_id')
      .notNull()
      .references(() => customers.id),
    branchId: integer('branch_id')
      .notNull()
      .references(() => branches.id),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    // Minor units. Money is never a float.
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    currency: text('currency').notNull(),
    direction: txDirection('direction').notNull(),
    category: text('category').notNull(),
  },
  (t) => [
    index('transactions_occurred_idx').on(t.occurredAt),
    index('transactions_customer_idx').on(t.customerId),
    index('transactions_branch_idx').on(t.branchId),
  ],
);

/**
 * The audit log, which is also the chat history — see ADR-0005.
 *
 * Deliberately absent from DATA_TABLES, so generated SQL can never read or
 * write it even if the Guard were defeated. Written by halcyon_app, which holds
 * INSERT here and nothing else; halcyon_ro has no grant on it at all.
 */
export const queryLog = pgTable(
  'query_log',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    askedAt: timestamp('asked_at', { withTimezone: true }).notNull().defaultNow(),
    question: text('question').notNull(),
    outcome: outcome('outcome').notNull(),
    templateId: text('template_id'),
    sqlText: text('sql_text'),
    checks: jsonb('checks'),
    tablesTouched: text('tables_touched').array(),
    rowCount: integer('row_count'),
    elapsedMs: integer('elapsed_ms').notNull(),
    traceId: text('trace_id').notNull(),
    /** Why a question was not answered. Null when it was. */
    reason: text('reason'),
    /** The failure code, so a restored failure reads as the failure it was. */
    failureCode: text('failure_code'),
    // The full filed Answer. Restoring history renders this, never a re-run.
    answer: jsonb('answer'),
  },
  (t) => [index('query_log_asked_idx').on(t.askedAt)],
);

/**
 * The four tables generated SQL may read. This constant is the allow-list.
 * `query_log` is deliberately not here.
 */
export const DATA_TABLES = [
  'branches',
  'customers',
  'onboarding_applications',
  'transactions',
] as const;

export type DataTable = (typeof DATA_TABLES)[number];

export const TABLE_DESCRIPTIONS: Readonly<Record<DataTable, string>> = {
  branches: 'Where. One row per physical branch of the bank.',
  customers: 'Who. Segment, branch and risk band for every customer.',
  onboarding_applications: 'Applications to become a customer, with their decisions.',
  transactions: 'Money movement against customer accounts.',
};
