import { createApp } from './app.js';
import { ensureRunning, type RunningCluster } from './db/embedded.js';
import { closePools } from './db/pools.js';
import { config } from './lib/config.js';

const log = (message: string): void => {
  process.stdout.write(`halcyon  ${message}\n`);
};

async function main(): Promise<void> {
  // The API owns the database's lifetime in development, so `pnpm dev` is the
  // only command a reviewer needs after setup. See ADR-0002.
  const cluster: RunningCluster = await ensureRunning(log);

  const server = createApp().listen(config.PORT, () => {
    log(`API listening on http://localhost:${config.PORT}`);
  });

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    log(`${signal} received, shutting down`);

    server.close();
    await closePools();
    await cluster.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  process.stderr.write(`\nserver failed to start: ${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
