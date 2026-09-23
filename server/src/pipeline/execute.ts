import type { CellValue, Column, ColumnType, Row } from '@halcyon/shared';
import { STATEMENT_TIMEOUT_CODE, readOnly } from '../db/pools.js';

export type ExecuteOutcome =
  | {
      readonly ok: true;
      readonly columns: readonly Column[];
      readonly rows: readonly Row[];
      readonly rowCount: number;
      readonly elapsedMs: number;
      readonly planCost: number | null;
    }
  | {
      readonly ok: false;
      readonly code: 'statement_timeout' | 'execution_error';
      readonly message: string;
      readonly elapsedMs: number;
    };

/** Postgres type OIDs we care about for presentation. */
const NUMERIC_OIDS = new Set([20, 21, 23, 700, 701, 1700]);
const DATE_OIDS = new Set([1082, 1114, 1184]);

function columnType(name: string, dataTypeId: number): ColumnType {
  if (DATE_OIDS.has(dataTypeId)) return 'date';
  if (/_gbp$|value|amount|total/i.test(name)) return NUMERIC_OIDS.has(dataTypeId) ? 'currency' : 'text';
  if (/rate|pct|percent/i.test(name)) return 'percent';
  if (NUMERIC_OIDS.has(dataTypeId)) return 'number';
  // A month bucket arrives as text from to_char but reads as a date.
  if (/^month$|^day$|^week$|^year$/i.test(name)) return 'date';
  return 'text';
}

const humanise = (key: string): string => {
  const words = key.replace(/_gbp$/i, ' (GBP)').replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/**
 * Runs a guarded statement as `halcyon_ro`, inside an explicitly read-only
 * transaction.
 *
 * The role is already read-only and already carries a statement timeout, so the
 * transaction wrapper is redundant — deliberately. It costs nothing, and it
 * means a misconfigured role does not silently become the only thing standing
 * between a generated query and the bank's data.
 */
export async function executeReadOnly(
  sql: string,
  parameters: readonly CellValue[],
): Promise<ExecuteOutcome> {
  const started = Date.now();
  const client = await readOnly().connect();

  try {
    await client.query('BEGIN TRANSACTION READ ONLY');

    let planCost: number | null = null;
    try {
      const explained = await client.query<{ 'QUERY PLAN': { Plan: { 'Total Cost': number } }[] }>(
        `EXPLAIN (FORMAT JSON) ${sql}`,
        [...parameters],
      );
      planCost = explained.rows[0]?.['QUERY PLAN']?.[0]?.Plan?.['Total Cost'] ?? null;
    } catch {
      // A plan is useful context, not a precondition. Losing it is not a failure.
      planCost = null;
    }

    const result = await client.query({ text: sql, values: [...parameters] });
    await client.query('COMMIT');

    const columns: Column[] = result.fields.map((field) => ({
      key: field.name,
      label: humanise(field.name),
      type: columnType(field.name, field.dataTypeID),
    }));

    return {
      ok: true,
      columns,
      rows: result.rows as Row[],
      rowCount: result.rowCount ?? result.rows.length,
      elapsedMs: Date.now() - started,
      planCost,
    };
  } catch (error: unknown) {
    await client.query('ROLLBACK').catch(() => {});

    const code = (error as { code?: string } | null)?.code;
    const timedOut = code === STATEMENT_TIMEOUT_CODE;

    return {
      ok: false,
      code: timedOut ? 'statement_timeout' : 'execution_error',
      // Never the driver's message: it can carry schema detail. See the README.
      message: timedOut
        ? 'The query was still running when the time limit was reached, so it was cancelled.'
        : 'The query could not be completed.',
      elapsedMs: Date.now() - started,
    };
  } finally {
    client.release();
  }
}
