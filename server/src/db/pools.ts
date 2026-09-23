import pg from 'pg';
import { config, connectionUrls } from '../lib/config.js';

const { Pool } = pg;

/**
 * Two pools, never crossed.
 *
 * `readOnly` executes every generated query and holds SELECT on the four data
 * tables and nothing else. `audit` writes the query log and can read nothing at
 * all. The separation is enforced by the database, not by discipline here — see
 * ADR-0005 — but keeping them in one file makes any future crossing obvious in
 * review.
 */

let readOnlyPool: pg.Pool | null = null;
let auditPool: pg.Pool | null = null;

export function readOnly(): pg.Pool {
  readOnlyPool ??= new Pool({
    connectionString: connectionUrls.readonly,
    max: 8,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: 'halcyon-read',
  });
  return readOnlyPool;
}

export function audit(): pg.Pool {
  auditPool ??= new Pool({
    connectionString: connectionUrls.app,
    max: 4,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: 'halcyon-audit',
  });
  return auditPool;
}

export async function closePools(): Promise<void> {
  await Promise.all([readOnlyPool?.end(), auditPool?.end()]);
  readOnlyPool = null;
  auditPool = null;
}

/** Postgres raises this when `statement_timeout` cancels a query. */
export const STATEMENT_TIMEOUT_CODE = '57014';

export const rowLimit = (): number => config.ROW_LIMIT;
