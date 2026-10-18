import { mkdirSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { dirname } from 'node:path';
import { Accounts } from './accounts/accounts.ts';
import { AccountStore } from './accounts/store.ts';
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
  if (options.autoTick !== false) worlds.start();
  const url = `http://${config.host}:${(http.address() as AddressInfo).port}`;
  log.info('server started', { url, worlds: worlds.all().length, notLoaded: worlds.failed.size });

  let closing: Promise<void> | null = null;
  const close = async (snapshot: boolean) => {
    gateway.close();
    worlds.stop();
    // A paused world is not snapshotted: its log and last good tick already rebuild it.
    for (const runtime of worlds.all()) {
      if (snapshot && runtime.status !== 'paused') runtime.snapshot();
    }
    http.closeAllConnections();
    await new Promise<void>((resolve) => http.close(() => resolve()));
    db.close();
    log.info('server stopped', {});
  };
  return {
    url,
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
