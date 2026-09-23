import type { Client } from 'pg';
import { config } from '../lib/config.js';
import { DATA_TABLES } from './schema.js';

/**
 * Creates the two least-privilege login roles and their grants.
 *
 * Idempotent, and run by `pnpm db:setup` against whichever Postgres is in use —
 * embedded or your own. It is deliberately a script rather than a container
 * init hook, so the same code path runs everywhere and is actually executed.
 *
 * The separation is load-bearing (ADR-0005): the role that executes generated
 * SQL physically cannot write the audit log, and the role that writes the audit
 * log cannot read the bank's data.
 */
export async function applyRoles(owner: Client, log: (m: string) => void = () => {}): Promise<void> {
  const {
    POSTGRES_DB,
    HALCYON_RO_USER,
    HALCYON_RO_PASSWORD,
    HALCYON_APP_USER,
    HALCYON_APP_PASSWORD,
    STATEMENT_TIMEOUT_MS,
  } = config;

  const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;
  const ro = ident(HALCYON_RO_USER);
  const app = ident(HALCYON_APP_USER);
  const db = ident(POSTGRES_DB);

  // Nothing is granted by default. Every privilege below is deliberate.
  await owner.query(`REVOKE ALL ON SCHEMA public FROM PUBLIC`);
  await owner.query(`REVOKE ALL ON DATABASE ${db} FROM PUBLIC`);

  // A DO block cannot take bind parameters, so existence is checked here and the
  // role name and password are quoted as an identifier and a literal.
  const literal = (value: string) => `'${value.replace(/'/g, "''")}'`;

  for (const [role, password] of [
    [HALCYON_RO_USER, HALCYON_RO_PASSWORD],
    [HALCYON_APP_USER, HALCYON_APP_PASSWORD],
  ] as const) {
    const { rowCount } = await owner.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [role]);
    const verb = rowCount === 0 ? 'CREATE' : 'ALTER';
    await owner.query(`${verb} ROLE ${ident(role)} LOGIN PASSWORD ${literal(password)}`);
  }

  // -- halcyon_ro: executes every generated query ---------------------------
  await owner.query(`GRANT CONNECT ON DATABASE ${db} TO ${ro}`);
  await owner.query(`GRANT USAGE ON SCHEMA public TO ${ro}`);
  // Revoke first, so removing a table from DATA_TABLES actually removes access.
  await owner.query(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${ro}`);
  for (const table of DATA_TABLES) {
    await owner.query(`GRANT SELECT ON ${ident(table)} TO ${ro}`);
  }

  // Beneath the Guard: this role cannot write even if the Guard were defeated,
  // and cannot spend more than STATEMENT_TIMEOUT_MS on any single query.
  await owner.query(`ALTER ROLE ${ro} SET default_transaction_read_only = on`);
  await owner.query(`ALTER ROLE ${ro} SET statement_timeout = '${STATEMENT_TIMEOUT_MS}ms'`);
  await owner.query(`ALTER ROLE ${ro} SET idle_in_transaction_session_timeout = '10s'`);
  await owner.query(`ALTER ROLE ${ro} SET search_path = public`);

  // -- halcyon_app: writes the audit log, and only the audit log ------------
  await owner.query(`GRANT CONNECT ON DATABASE ${db} TO ${app}`);
  await owner.query(`GRANT USAGE ON SCHEMA public TO ${app}`);
  await owner.query(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${app}`);
  await owner.query(`GRANT SELECT, INSERT ON query_log TO ${app}`);
  await owner.query(`ALTER ROLE ${app} SET statement_timeout = '5s'`);
  await owner.query(`ALTER ROLE ${app} SET search_path = public`);

  log(`granted ${HALCYON_RO_USER}: SELECT on ${DATA_TABLES.join(', ')}`);
  log(`granted ${HALCYON_APP_USER}: SELECT, INSERT on query_log`);
}
