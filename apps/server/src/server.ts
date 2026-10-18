import { mkdirSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { dirname } from 'node:path';
import { Accounts } from './accounts/accounts.ts';
import { createAdminApi } from './admin/api.ts';
import { AccountStore } from './accounts/store.ts';
import { backupDatabase } from './backup.ts';
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
  worlds.loadAll();

  const api = createApi({ config, clock, log, accounts, worlds });
  const http = createServer((req, res) => {
    void api(req, res);
  });
  const gateway = new Gateway({ config, clock, log, worlds, store, accounts });
  http.on('upgrade', (req, socket, head) => gateway.upgrade(req, socket, head));
  await listen(http, config.port, config.host);

  const backup = () => (config.backupDir === null ? Promise.resolve(null) : backupDatabase(db, config.backupDir, clock.now()));
  const daily =
    config.backupDir === null
      ? null
      : setInterval(() => {
          backup().then(
            (path) => log.info('backup written', { path }),
            (error: unknown) => log.error('backup failed', { error: error instanceof Error ? error.message : String(error) }),
          );
        }, config.backupMs);
  const adminApi = createAdminApi({ accounts, worlds, log, backup });
  const admin = createServer((req, res) => {
    void adminApi(req, res);
  });
  await listen(admin, config.adminPort, '127.0.0.1');

  if (options.autoTick !== false) worlds.start();
  const url = `http://${config.host}:${(http.address() as AddressInfo).port}`;
  const adminUrl = `http://127.0.0.1:${(admin.address() as AddressInfo).port}`;
  log.info('server started', { url, adminUrl, worlds: worlds.all().length, notLoaded: worlds.failed.size });

  let closing: Promise<void> | null = null;
  const close = async (snapshot: boolean) => {
    gateway.close();
    worlds.stop();
    // A paused world is not snapshotted: its log and last good tick already rebuild it.
    for (const runtime of worlds.all()) {
      if (snapshot && runtime.status !== 'paused') runtime.snapshot();
    }
    if (daily !== null) clearInterval(daily);
    for (const listener of [http, admin]) {
      listener.closeAllConnections();
      await new Promise<void>((resolve) => listener.close(() => resolve()));
    }
    db.close();
    log.info('server stopped', {});
  };
  return {
    url,
    adminUrl,
    config,
    accounts,
    worlds,
    store,
    close: (options) => (closing ??= close(options?.snapshot ?? true)),
  };
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
