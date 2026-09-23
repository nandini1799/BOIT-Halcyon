import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import { createConnection } from 'node:net';
import { resolve } from 'node:path';
import { config } from '../lib/config.js';

/**
 * A real PostgreSQL 18 server, run from a directory inside the repository.
 *
 * See ADR-0002. The binaries arrive through npm, so there is nothing to install
 * and nothing to run as a daemon. The cluster is tied to the Node process that
 * started it: scripts stop it when they finish, and the API server stops it on
 * shutdown.
 */

export const clusterDir = resolve(process.cwd(), '..', config.PGDATA_DIR);

export function clusterExists(): boolean {
  return existsSync(resolve(clusterDir, 'PG_VERSION'));
}

/** True if something is already listening on the Postgres port. */
export function isPortOpen(port = config.POSTGRES_PORT, host = config.POSTGRES_HOST): Promise<boolean> {
  return new Promise((done) => {
    const socket = createConnection({ port, host })
      .setTimeout(700)
      .once('connect', () => {
        socket.destroy();
        done(true);
      })
      .once('timeout', () => {
        socket.destroy();
        done(false);
      })
      .once('error', () => done(false));
  });
}

export function createServer(): EmbeddedPostgres {
  return new EmbeddedPostgres({
    databaseDir: clusterDir,
    user: config.POSTGRES_USER,
    password: config.POSTGRES_PASSWORD,
    port: config.POSTGRES_PORT,
    persistent: true,
  });
}

export interface RunningCluster {
  /** Null when we attached to an already-running server rather than starting one. */
  readonly server: EmbeddedPostgres | null;
  readonly startedByUs: boolean;
  stop(): Promise<void>;
}

/**
 * Brings a cluster up, initialising it on first run. Attaches to an existing
 * server if one is already listening, so two scripts can't fight over the port.
 */
export async function ensureRunning(log: (m: string) => void = () => {}): Promise<RunningCluster> {
  if (config.DATABASE_MODE === 'external') {
    log('using external Postgres from DATABASE_URL_OWNER');
    return { server: null, startedByUs: false, stop: async () => {} };
  }

  if (await isPortOpen()) {
    log(`attached to Postgres already listening on ${config.POSTGRES_PORT}`);
    return { server: null, startedByUs: false, stop: async () => {} };
  }

  const server = createServer();

  if (!clusterExists()) {
    log('initialising a new cluster (one-off, takes a few seconds)...');
    await server.initialise();
  }

  await server.start();
  log(`Postgres listening on ${config.POSTGRES_HOST}:${config.POSTGRES_PORT}`);

  return {
    server,
    startedByUs: true,
    stop: async () => {
      await server.stop();
    },
  };
}
