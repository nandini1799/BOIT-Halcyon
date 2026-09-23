import { ensureRunning } from '../embedded.js';
import { seed, seedSummary } from '../seed.js';
import { log, ownerClient } from './lib.js';

async function main(): Promise<void> {
  const cluster = await ensureRunning(log);
  try {
    await seed(log);

    const owner = await ownerClient();
    try {
      const counts = await seedSummary(owner);
      for (const [table, count] of Object.entries(counts)) {
        log(`  ${table.padEnd(24)} ${count.toLocaleString()} rows`);
      }
    } finally {
      await owner.end();
    }
  } finally {
    await cluster.stop();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`\nseed failed: ${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
