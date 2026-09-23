import { getTableColumns } from 'drizzle-orm';
import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core';
import {
  branches,
  customers,
  onboardingApplications,
  transactions,
  DATA_TABLES,
  TABLE_DESCRIPTIONS,
  type DataTable,
} from '../db/schema.js';

/**
 * The schema as a model would be told about it.
 *
 * Built once from the Drizzle definitions and held for the lifetime of the
 * process. Two reasons, and the second is the one that matters: a description
 * assembled per question is a description that can drift from the database and
 * a cost paid on every request, and a description typed out by hand is one that
 * silently goes stale the day a column is added.
 *
 * Only the four readable tables appear. `query_log` is absent here for the same
 * reason it is absent from DATA_TABLES — a model cannot ask for a table it has
 * never been told exists, and the Guard refuses it even if it guesses.
 */

export interface SchemaContext {
  /** The text handed to the model as its system message. */
  readonly text: string;
  /** Rough size, for the cost accounting a real provider would bill on. */
  readonly tokensApprox: number;
  readonly tables: readonly DataTable[];
  readonly builtAt: string;
}

/**
 * Notes a column name cannot carry on its own. Qualified by table: the same
 * column name means different things in different places, and `customer_id` is
 * nullable on applications but mandatory on transactions.
 */
const COLUMN_NOTES: Readonly<Record<string, string>> = {
  'transactions.amount_minor': 'pence, never pounds; divide by 100 to report',
  'onboarding_applications.decided_at': 'null while an application is pending',
  'onboarding_applications.customer_id': 'null when declined before a customer existed',
  'onboarding_applications.rejection_reason': 'null unless the decision was rejected',
};

const TABLES: Readonly<Record<DataTable, PgTable>> = {
  branches,
  customers,
  onboarding_applications: onboardingApplications,
  transactions,
};

/** PostgreSQL names, not Drizzle's. The model is writing SQL, not TypeScript. */
function sqlType(columnType: string, enumValues: readonly string[] | undefined): string {
  if (enumValues && enumValues.length > 0) return `enum(${enumValues.join('|')})`;

  switch (columnType) {
    case 'PgInteger':
      return 'integer';
    case 'PgBigInt53':
      return 'bigint';
    case 'PgText':
      return 'text';
    case 'PgTimestamp':
      return 'timestamptz';
    case 'PgUUID':
      return 'uuid';
    case 'PgJsonb':
      return 'jsonb';
    default:
      return columnType.replace(/^Pg/, '').toLowerCase();
  }
}

function describeTable(name: DataTable): string {
  const table = TABLES[name];
  const lines = [`table ${name}  -- ${TABLE_DESCRIPTIONS[name]}`];

  for (const column of Object.values(getTableColumns(table))) {
    const type = sqlType(column.columnType, (column as { enumValues?: string[] }).enumValues);
    const note = COLUMN_NOTES[`${name}.${column.name}`];
    const nullable = column.notNull ? '' : ' null';
    lines.push(`  ${column.name} ${type}${nullable}${note === undefined ? '' : `  -- ${note}`}`);
  }

  return lines.join('\n');
}

function describeRelationships(): readonly string[] {
  const edges: string[] = [];

  for (const name of DATA_TABLES) {
    for (const key of getTableConfig(TABLES[name]).foreignKeys) {
      const reference = key.reference();
      const from = reference.columns.map((c) => c.name).join(', ');
      const to = reference.foreignColumns.map((c) => c.name).join(', ');
      edges.push(`${name}.${from} -> ${getTableConfig(reference.foreignTable).name}.${to}`);
    }
  }

  return edges;
}

/**
 * The rules the generated statement is held to.
 *
 * These are the Guard's five checks restated as instructions. Saying them up
 * front does not make the Guard optional — a model that ignores them is exactly
 * the case the Guard exists for — but a generator told the rules fails far less
 * often, and every avoided refusal is a question the user got answered.
 */
const RULES = [
  'Return exactly one SELECT statement. Never INSERT, UPDATE, DELETE, DROP, ALTER or TRUNCATE.',
  'Read only from the four tables above. The system catalogue and information_schema are out of bounds.',
  'Bind every value as a numbered parameter. String literals are refused outright, so write CAST($1 AS text) rather than quoting a value inline.',
  'Leave the row limit alone. A bound is applied after generation; do not ask for more rows than the cap.',
  'Money is stored in minor units. Report pounds by dividing by 100.',
].map((rule, index) => `${index + 1}. ${rule}`);

/** Characters per token, averaged over English prose and SQL. An estimate, and labelled as one. */
const CHARS_PER_TOKEN = 4;

function build(): SchemaContext {
  const text = [
    'You are Halcyon, a read-only analyst for a UK retail and commercial bank.',
    'Answer questions by writing one PostgreSQL SELECT statement against this schema.',
    '',
    DATA_TABLES.map(describeTable).join('\n\n'),
    '',
    '# Relationships',
    ...describeRelationships(),
    '',
    '# Rules',
    ...RULES,
    '',
    'Reply as JSON: {"answerable": true, "sql": "...", "parameters": [...]}',
    'If the schema cannot answer the question, reply {"answerable": false, "reason": "..."}.',
  ].join('\n');

  return {
    text,
    tokensApprox: Math.ceil(text.length / CHARS_PER_TOKEN),
    tables: DATA_TABLES,
    builtAt: new Date().toISOString(),
  };
}

let cached: SchemaContext | null = null;

/** The context, built on first use and reused thereafter. */
export function schemaContext(): SchemaContext {
  cached ??= build();
  return cached;
}

/** Whether the next call would be served from the cache. Reported in the audit. */
export const isSchemaContextCached = (): boolean => cached !== null;

/** Test seam. Nothing in the running server discards the context. */
export function resetSchemaContext(): void {
  cached = null;
}
