import { ensureRunning } from '../embedded.js';
import { applyRoles } from '../roles.js';
import { ensureDatabase, log, ownerClient, runMigrations } from './lib.js';

async function main(): Promise<void> {
  const cluster = await ensureRunning(log);
  try {
    await ensureDatabase();
    await runMigrations();

    // Grants are re-applied after every migration: a new table must be an
    // explicit decision to expose, never an inherited one.
    const owner = await ownerClient();
    try {
      await applyRoles(owner, log);
    } finally {
      await owner.end();
    }
  } finally {
    await cluster.stop();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`\nmigrate failed: ${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
