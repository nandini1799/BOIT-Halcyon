import { ensureRunning } from './src/db/embedded.js';

/**
 * Integration tests need a real PostgreSQL, because the things worth testing —
 * the read-only role, the statement timeout, the privilege separation on the
 * audit log — are properties of the server, not of SQL. This brings the cluster
 * up if nothing else has, and attaches to it if `pnpm dev` already owns it.
 *
 * Unit tests pay nothing for this: attaching to a running server is a socket
 * probe, and starting a cluster that already exists takes about a fifth of a
 * second.
 */
export default async function setup(): Promise<() => Promise<void>> {
  const cluster = await ensureRunning();

  return async () => {
    // Only stop what we started. Killing a cluster the dev server is using
    // would be a very confusing way to fail a test run.
    if (cluster.startedByUs) await cluster.stop();
  };
}
