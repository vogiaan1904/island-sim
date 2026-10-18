import { configFromEnv } from './config.ts';
import { consoleLog } from './log.ts';
import { startServer } from './server.ts';

// pnpm server: runs every world until SIGINT or SIGTERM, then shuts down gracefully with a snapshot of every world.
// An exception that escapes every handler ends the process without a snapshot, as Node does by default: the snapshots
// and logs already written are the truth, and the process supervisor starts the server again (world-runtime.md).

/** A shutdown that has not finished by now is cut off: a supervisor kills the process soon after its stop signal anyway. */
const FORCE_EXIT_MS = 20_000;

const server = await startServer(configFromEnv(process.env));
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  // Once: a second Ctrl-C kills the process the default way.
  process.once(signal, () => {
    setTimeout(() => process.exit(1), FORCE_EXIT_MS).unref();
    server.close().then(
      () => process.exit(0),
      (error: unknown) => {
        consoleLog.error('shutdown failed', { error: error instanceof Error ? error.message : String(error) });
        process.exit(1);
      },
    );
  });
}
