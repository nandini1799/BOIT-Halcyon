import { rm } from 'node:fs/promises';
import { clusterDir, isPortOpen } from '../embedded.js';
import { config } from '../../lib/config.js';
import { log } from './lib.js';

/**
 * Deletes the cluster entirely. The next `pnpm db:setup` rebuilds it from
 * scratch, which is the fastest way back to a known state.
 */
async function main(): Promise<void> {
  if (config.DATABASE_MODE === 'external') {
    throw new Error('db:reset refuses to run against an external database. Drop it yourself.');
  }

  if (await isPortOpen()) {
    throw new Error(
      `Something is still listening on port ${config.POSTGRES_PORT}. Stop it before resetting.`,
    );
  }

  await rm(clusterDir, { recursive: true, force: true });
  log(`removed ${clusterDir}`);
  log('run `pnpm db:setup` to rebuild');
}

main().catch((error: unknown) => {
  process.stderr.write(`\nreset failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
