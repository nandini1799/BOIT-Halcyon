import { ensureRunning } from '../embedded.js';
import { applyRoles } from '../roles.js';
import { seed } from '../seed.js';
import { ensureDatabase, log, ownerClient, runMigrations } from './lib.js';

/**
 * One command, from nothing to a running, seeded, least-privilege database.
 *
 * Starts the embedded cluster (initialising it on first run), creates the
 * database, applies migrations, creates both roles with their grants, and
 * seeds. Safe to run repeatedly.
 */
async function main(): Promise<void> {
  const cluster = await ensureRunning(log);

  try {
    await ensureDatabase();
    await runMigrations();

    const owner = await ownerClient();
    try {
      await applyRoles(owner, log);
    } finally {
      await owner.end();
    }

    await seed(log);
    log('setup complete — run `pnpm dev`');
  } finally {
    await cluster.stop();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`\nsetup failed: ${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
