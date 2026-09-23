import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { resolve } from 'node:path';
import { config, connectionUrls } from '../../lib/config.js';

const { Client } = pg;

export const log = (message: string): void => {
  process.stdout.write(`halcyon  ${message}\n`);
};

export async function ownerClient(database = config.POSTGRES_DB): Promise<pg.Client> {
  const client = new Client({
    host: config.POSTGRES_HOST,
    port: config.POSTGRES_PORT,
    user: config.POSTGRES_USER,
    password: config.POSTGRES_PASSWORD,
    database,
    ...(config.DATABASE_URL_OWNER ? { connectionString: config.DATABASE_URL_OWNER } : {}),
  });
  await client.connect();
  return client;
}

/** Creates the application database if it is not already there. */
export async function ensureDatabase(): Promise<void> {
  const maintenance = await ownerClient('postgres');
  try {
    const { rowCount } = await maintenance.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      config.POSTGRES_DB,
    ]);
    if (rowCount === 0) {
      await maintenance.query(`CREATE DATABASE "${config.POSTGRES_DB.replace(/"/g, '""')}"`);
      log(`created database ${config.POSTGRES_DB}`);
    } else {
      log(`database ${config.POSTGRES_DB} already exists`);
    }
  } finally {
    await maintenance.end();
  }
}

export async function runMigrations(): Promise<void> {
  const client = new Client({ connectionString: connectionUrls.owner });
  await client.connect();
  try {
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: resolve(process.cwd(), 'drizzle') });
    log('migrations applied');
  } finally {
    await client.end();
  }
}
