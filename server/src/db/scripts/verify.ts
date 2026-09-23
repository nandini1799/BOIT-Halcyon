import pg from 'pg';
import { config, connectionUrls } from '../../lib/config.js';
import { DATA_TABLES } from '../schema.js';
import { ensureRunning } from '../embedded.js';
import { log, ownerClient } from './lib.js';

const { Client } = pg;

/**
 * Proves the database-level controls, against the real server.
 *
 * The Guard is unit-tested separately and needs no database. This checks the
 * layer underneath it: that the role executing generated SQL genuinely cannot
 * write, cannot read the audit log, and cannot outrun the statement timeout.
 * If any of this stops being true, the product's central claim is false.
 */

interface Result {
  readonly label: string;
  readonly expected: 'allow' | 'deny';
  readonly actual: 'allow' | 'deny';
  readonly detail: string;
}

async function attempt(
  client: pg.Client,
  label: string,
  sql: string,
  expected: 'allow' | 'deny',
): Promise<Result> {
  try {
    await client.query(sql);
    return { label, expected, actual: 'allow', detail: 'succeeded' };
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message.split('\n')[0] ?? '' : String(error);
    return { label, expected, actual: 'deny', detail };
  }
}

async function main(): Promise<void> {
  const cluster = await ensureRunning(log);
  const results: Result[] = [];

  try {
    // -- halcyon_ro, the role that executes every generated query -----------
    const ro = new Client({ connectionString: connectionUrls.readonly });
    await ro.connect();

    const who = await ro.query<{ current_user: string; session_user: string }>(
      'SELECT current_user, session_user',
    );
    log(`connected as ${who.rows[0]?.current_user} (session ${who.rows[0]?.session_user})`);

    for (const table of DATA_TABLES) {
      results.push(await attempt(ro, `ro: SELECT from ${table}`, `SELECT count(*) FROM ${table}`, 'allow'));
    }

    results.push(await attempt(ro, 'ro: SELECT from query_log', 'SELECT count(*) FROM query_log', 'deny'));
    results.push(
      await attempt(ro, 'ro: INSERT into customers', `INSERT INTO customers (id, name, segment, branch_id, risk_band, onboarded_on, status) VALUES (-1, 'x', 'retail', 1, 'low', now(), 'active')`, 'deny'),
    );
    results.push(await attempt(ro, 'ro: DELETE from customers', 'DELETE FROM customers WHERE id = -1', 'deny'));
    results.push(await attempt(ro, 'ro: DROP TABLE transactions', 'DROP TABLE transactions', 'deny'));
    results.push(
      await attempt(ro, 'ro: read pg_catalog user list', 'SELECT count(*) FROM pg_catalog.pg_user', 'allow'),
    );
    results.push(
      await attempt(ro, 'ro: CREATE TABLE', 'CREATE TABLE smuggled (x int)', 'deny'),
    );

    log('');
    log(`statement_timeout is ${config.STATEMENT_TIMEOUT_MS}ms — running a query designed to exceed it`);
    const started = Date.now();
    const timeout = await attempt(
      ro,
      'ro: runaway query is cancelled',
      // The same shape as the customer-similarity template: a genuine question
      // whose cost the planner cannot avoid. No artificial sleep.
      `WITH profile AS (
         SELECT customer_id, category, sum(amount_minor) AS total
         FROM transactions GROUP BY 1, 2
       )
       SELECT count(*) FROM profile a JOIN profile b
         ON a.category = b.category AND a.customer_id < b.customer_id`,
      'deny',
    );
    results.push(timeout);
    log(`  returned after ${Date.now() - started}ms: ${timeout.detail}`);
    await ro.end();

    // -- halcyon_app, the role that writes the audit log --------------------
    const app = new Client({ connectionString: connectionUrls.app });
    await app.connect();
    results.push(await attempt(app, 'app: SELECT from customers', 'SELECT count(*) FROM customers', 'deny'));
    results.push(
      await attempt(
        app,
        'app: INSERT into query_log',
        `INSERT INTO query_log (question, outcome, elapsed_ms, trace_id) VALUES ('verify', 'answered', 1, 'verify')`,
        'allow',
      ),
    );
    results.push(await attempt(app, 'app: DELETE from query_log', 'DELETE FROM query_log', 'deny'));
    await app.end();

    // The probe row above is real and the audit role cannot remove it — that is
    // the grant working. Clear it as the owner so verifying does not leave a
    // fake question sitting in the history drawer.
    const owner = await ownerClient();
    try {
      await owner.query(`DELETE FROM query_log WHERE trace_id = 'verify'`);
    } finally {
      await owner.end();
    }
  } finally {
    await cluster.stop();
  }

  log('');
  let failures = 0;
  for (const r of results) {
    const ok = r.actual === r.expected;
    if (!ok) failures++;
    const verdict = ok ? (r.expected === 'deny' ? 'blocked' : 'allowed') : 'WRONG';
    log(`  ${verdict.padEnd(9)} ${r.label}${ok ? '' : ` — expected ${r.expected}, got ${r.actual}`}`);
  }

  log('');
  if (failures > 0) {
    log(`${failures} control(s) did not behave as specified`);
    process.exitCode = 1;
  } else {
    log(`all ${results.length} database controls behaved as specified`);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`\nverify failed: ${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
