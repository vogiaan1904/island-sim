import { mkdirSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { dirname } from 'node:path';
import { Accounts } from './accounts/accounts.ts';
import { createAdminApi } from './admin/api.ts';
import { AccountStore } from './accounts/store.ts';
import { backupDatabase, newestBackupMs } from './backup.ts';
import { systemClock, type Clock } from './clock.ts';
import type { ServerConfig } from './config.ts';
import { openDatabase } from './db.ts';
import { createApi } from './http/api.ts';
import { consoleLog, type Log } from './log.ts';
import { Gateway } from './sync/gateway.ts';
import { Worlds } from './worlds/registry.ts';
import { WorldStore } from './worlds/store.ts';

export interface StartOptions {
  clock?: Clock;
  log?: Log;
  /** False leaves the worlds' tick timers off, so a test runs ticks itself with worlds.runDue(). */
  autoTick?: boolean;
}

export interface IslandServer {
  /** The game's address, e.g. http://127.0.0.1:8787. */
  readonly url: string;
  /** The admin interface, on 127.0.0.1 only. */
  readonly adminUrl: string;
  readonly config: ServerConfig;
  readonly accounts: Accounts;
  readonly worlds: Worlds;
  /** The worlds' records, logs and snapshots. */
  readonly store: WorldStore;
  /**
   * Graceful shutdown: the worlds stop, each is snapshotted (spec 5.2), the listeners close, then the database. With
   * snapshot false it stops the way a crash would, leaving recovery to the snapshots and logs already written.
   */
  close(options?: { snapshot?: boolean }): Promise<void>;
}

/** The first backup waits at least this long after the start, so a server restarted in a loop does not copy the database each time. */
const MIN_FIRST_BACKUP_MS = 60_000;
/** setTimeout fires at once for a longer delay. */
const MAX_TIMER_MS = 2_147_483_647;

/**
 * Starts the game server: one process for every world (spec 5.1). Each world is loaded from its newest snapshot and
 * log, then catches up the time it missed on its own timer.
 */
export async function startServer(config: ServerConfig, options: StartOptions = {}): Promise<IslandServer> {
  const clock = options.clock ?? systemClock;
  const log = options.log ?? consoleLog;
  if (config.databasePath !== ':memory:') mkdirSync(dirname(config.databasePath), { recursive: true });
  const db = openDatabase(config.databasePath);
  const accounts = new Accounts(new AccountStore(db), clock);
  const store = new WorldStore(db);
  const worlds = new Worlds({ store, clock, config, log, username: (id) => accounts.username(id) });

  // What a start or a shutdown must undo, in the order release() undoes it.
  let closing = false;
  let gateway: Gateway | null = null;
  let gatewayClosed: Promise<void> | null = null;
  let backupTimer: ReturnType<typeof setTimeout> | null = null;
  const backupsRunning = new Set<Promise<unknown>>();
  const listeners: Server[] = [];

  const closeGateway = () => (gatewayClosed ??= gateway?.close() ?? Promise.resolve());
  /** Closes everything this function opened, then the database. Each step is guarded: one failure never skips the rest. */
  const release = async () => {
    if (backupTimer !== null) clearTimeout(backupTimer);
    backupTimer = null;
    worlds.stop();
    await closeGateway();
    for (const listener of listeners) {
      listener.closeAllConnections();
      await new Promise<void>((resolve) => listener.close(() => resolve()));
    }
    // Only now: until the admin listener closed, a request could still start a backup.
    await Promise.allSettled(backupsRunning);
    try {
      db.close();
    } catch (error) {
      log.error('database close failed', { error: errorMessage(error) });
    }
  };

  try {
    worlds.loadAll();
    const backup = () => {
      if (config.backupDir === null) return Promise.resolve(null);
      const running = backupDatabase(db, config.backupDir, clock.now());
      backupsRunning.add(running);
      const done = () => backupsRunning.delete(running);
      running.then(done, done);
      return running;
    };
    const scheduleBackup = (inMs: number) => {
      backupTimer = setTimeout(() => {
        backupTimer = null;
        if (closing) return;
        scheduleBackup(config.backupMs);
        backup().then(
          (path) => log.info('backup written', { path }),
          (error: unknown) => log.error('backup failed', { error: errorMessage(error) }),
        );
      }, Math.min(inMs, MAX_TIMER_MS));
    };
    if (config.backupDir !== null) {
      // The first backup comes a day after the newest copy, not a day after the start: a server restarted more than
      // once a day would never reach a daily timer (spec 12.3).
      const newest = newestBackupMs(config.backupDir);
      const inMs = Math.max(MIN_FIRST_BACKUP_MS, newest === null ? 0 : newest + config.backupMs - clock.now());
      log.info('backup due', { inMs, at: new Date(clock.now() + inMs).toISOString() });
      scheduleBackup(inMs);
    }

    const api = createApi({ config, clock, log, accounts, worlds, closing: () => closing });
    const http = createServer(guarded(api, 'request', log));
    listeners.push(http);
    gateway = new Gateway({ config, clock, log, worlds, store, accounts });
    http.on('upgrade', (req, socket, head) => gateway?.upgrade(req, socket, head));
    await listen(http, config.port, config.host);

    const adminApi = createAdminApi({ accounts, worlds, log, backup });
    const admin = createServer(guarded(adminApi, 'admin request', log));
    listeners.push(admin);
    await listen(admin, config.adminPort, '127.0.0.1');

    if (options.autoTick !== false) worlds.start();
    const url = `http://${config.host}:${(http.address() as AddressInfo).port}`;
    const adminUrl = `http://127.0.0.1:${(admin.address() as AddressInfo).port}`;
    log.info('server started', { url, adminUrl, worlds: worlds.all().length, notLoaded: worlds.failed.size });

    let closed: Promise<void> | null = null;
    const close = async (snapshot: boolean) => {
      closing = true;
      try {
        // Nothing new gets in: the API answers 503, upgrades are refused and the worlds take no more commands. The
        // listeners stay open until the end, so a late request gets that answer, not a reset.
        closeGateway();
        worlds.stop();
        for (const runtime of snapshot ? worlds.all() : []) {
          // A paused world whose rebuild worked holds its last good state: snapshot it, so the next version can load
          // it. Only a paused world whose rebuild failed holds suspect state, which never goes into a snapshot.
          if (runtime.suspect) continue;
          try {
            runtime.snapshot();
          } catch (error) {
            log.error('snapshot failed', { world: runtime.id, error: errorMessage(error) });
          }
        }
      } catch (error) {
        log.error('shutdown failed', { error: errorMessage(error) });
      } finally {
        await release();
        log.info('server stopped', {});
      }
    };
    return {
      url,
      adminUrl,
      config,
      accounts,
      worlds,
      store,
      close: (closeOptions) => (closed ??= close(closeOptions?.snapshot ?? true)),
    };
  } catch (error) {
    await release();
    throw error;
  }
}

/** A request handler that cannot leave a request unanswered or crash the process, whatever the handler does. */
function guarded(
  handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>,
  what: string,
  log: Log,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    handler(req, res).catch((error: unknown) => {
      log.error(`${what} failed`, { path: req.url, error: errorMessage(error) });
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function listen(server: Server, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });
}
