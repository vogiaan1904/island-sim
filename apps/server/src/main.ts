import { configFromEnv } from './config.ts';
import { startServer } from './server.ts';

// pnpm server: runs every world until SIGINT or SIGTERM, then shuts down gracefully with a snapshot of every world.
// An exception that escapes every handler ends the process without a snapshot, as Node does by default: the snapshots
// and logs already written are the truth, and the process supervisor starts the server again (world-runtime.md).

const server = await startServer(configFromEnv(process.env));
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void server.close().then(() => process.exit(0));
  });
}
