import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { connect, createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../src/config.ts';
import { startServer, type IslandServer } from '../src/server.ts';
import { Gateway } from '../src/sync/gateway.ts';
import { Player } from './player.ts';
import { Browser, ORIGIN, addAccount, startTestServer } from './server.ts';
import { ManualClock, TICK_MS, memoryLog } from './support.ts';

let running: IslandServer[] = [];

afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  await Promise.all(running.map((server) => server.close()));
  running = [];
});

async function twoWorlds(overrides = {}) {
  const setup = await startTestServer(overrides);
  const { server, clock } = setup;
  running.push(server);
  const aliceId = await addAccount(server, 'alice');
  const first = server.worlds.create(aliceId, 'Palm Cove', 42);
  const second = server.worlds.create(aliceId, 'Second Isle', 7);
  if (!first.ok || !second.ok) throw new Error('create failed');
  for (let i = 0; i < 5; i += 1) {
    clock.advance(TICK_MS);
    await server.worlds.runDue();
  }
  return { ...setup, aliceId, first: first.runtime, second: second.runtime };
}

describe('close()', () => {
  it('snapshots the other worlds, frees the ports and closes the database when one snapshot fails', async () => {
    const { server, log, first } = await twoWorlds();
    vi.spyOn(first, 'snapshot').mockImplementation(() => {
      throw new Error('disk full');
    });
    const closing = server.close();
    expect(server.close()).toBe(closing);
    await expect(closing).resolves.toBeUndefined();

    expect(log.entries.find((entry) => entry.message === 'snapshot failed')?.fields).toMatchObject({ world: first.id });
    expect(log.entries.map((entry) => entry.message)).toContain('server stopped');
    await expect(fetch(server.url)).rejects.toThrow();
    await expect(fetch(server.adminUrl)).rejects.toThrow();
    expect(() => server.store.world(first.id)).toThrow();
  });

  it('wrote the other world a snapshot at its tick', async () => {
    const { server, first, second } = await twoWorlds();
    vi.spyOn(first, 'snapshot').mockImplementation(() => {
      throw new Error('disk full');
    });
    const write = vi.spyOn(server.store, 'insertSnapshot');
    await server.close();
    expect(write.mock.calls.map(([worldId, snapshot]) => [worldId, snapshot.tick])).toEqual([[second.id, 5]]);
  });

  it('snapshots a paused world that rebuilt, and skips one whose rebuild failed', async () => {
    const { server, first, second } = await twoWorlds();
    first.suspect = false;
    second.suspect = true;
    first.status = 'paused';
    second.status = 'paused';
    const write = vi.spyOn(server.store, 'insertSnapshot');
    await server.close();
    expect(write.mock.calls.map(([worldId]) => worldId)).toEqual([first.id]);
  });

  it('answers 503 shutting-down meanwhile, refuses upgrades, and does not wait for a client that never answers', async () => {
    const { server, log } = await twoWorlds();
    const browser = new Browser(server.url);
    await addAccount(server, 'bob');
    await browser.login('bob');
    // A phone that vanished: it opens a connection, then ignores everything, the closing handshake included.
    const port = Number(new URL(server.url).port);
    const socket = connect(port, '127.0.0.1');
    await new Promise((resolve) => socket.once('connect', resolve));
    socket.write(
      [
        'GET /ws HTTP/1.1',
        `Host: 127.0.0.1:${port}`,
        'Upgrade: websocket',
        'Connection: Upgrade',
        'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==',
        'Sec-WebSocket-Version: 13',
        `Origin: ${ORIGIN}`,
        `Cookie: island_session=${browser.token}`,
        '',
        '',
      ].join('\r\n'),
    );
    await new Promise((resolve) => socket.once('data', resolve));
    socket.on('data', () => {});

    const started = Date.now();
    const closing = server.close();
    await new Promise((resolve) => setImmediate(resolve));
    expect(await browser.get('/api/me')).toMatchObject({ status: 503, body: { error: 'shutting-down' } });
    await expect(Player.connect(server, browser)).rejects.toThrow(/upgrade refused with 503/);
    await closing;
    expect(Date.now() - started).toBeLessThan(8_000);
    socket.destroy();
    expect(log.entries.map((entry) => entry.message)).toContain('server stopped');
  }, 15_000);
});

describe('a start that fails', () => {
  async function freePort(): Promise<number> {
    const probe = createServer();
    await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve));
    const port = (probe.address() as { port: number }).port;
    await new Promise((resolve) => probe.close(resolve));
    return port;
  }

  it('closes what it opened when the admin port is taken', async () => {
    const close = vi.spyOn(Gateway.prototype, 'close');
    const taken = createServer();
    await new Promise<void>((resolve) => taken.listen(0, '127.0.0.1', resolve));
    const adminPort = (taken.address() as { port: number }).port;
    const port = await freePort();
    try {
      await expect(
        startServer(
          { ...DEFAULT_CONFIG, port, adminPort, databasePath: ':memory:', backupDir: null, origin: ORIGIN },
          { log: memoryLog(), autoTick: false },
        ),
      ).rejects.toThrow(/EADDRINUSE/);
      expect(close).toHaveBeenCalledTimes(1);
      // The game port is free again.
      const again = createServer();
      await new Promise<void>((resolve) => again.listen(port, '127.0.0.1', resolve));
      await new Promise((resolve) => again.close(resolve));
    } finally {
      await new Promise((resolve) => taken.close(resolve));
    }
  });

  it('closes what it opened when the game port is taken', async () => {
    const close = vi.spyOn(Gateway.prototype, 'close');
    const taken = createServer();
    await new Promise<void>((resolve) => taken.listen(0, '127.0.0.1', resolve));
    const port = (taken.address() as { port: number }).port;
    try {
      await expect(
        startServer(
          { ...DEFAULT_CONFIG, port, adminPort: 0, databasePath: ':memory:', backupDir: null, origin: ORIGIN },
          { log: memoryLog(), autoTick: false },
        ),
      ).rejects.toThrow(/EADDRINUSE/);
      expect(close).toHaveBeenCalledTimes(1);
    } finally {
      await new Promise((resolve) => taken.close(resolve));
    }
  });
});

describe('the startup backup', () => {
  const FAKE = ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] as const;
  const day = 24 * 60 * 60_000;

  function backupDir(...names: string[]): string {
    const dir = mkdtempSync(join(tmpdir(), 'island-schedule-'));
    for (const name of names) writeFileSync(join(dir, name), 'a copy');
    return dir;
  }

  const copies = (dir: string) => readdirSync(dir).filter((name) => /^island-.+\.sqlite$/.test(name));

  it('is written about a minute after the start when the folder is empty, then daily', async () => {
    const dir = backupDir();
    const clock = new ManualClock();
    vi.useFakeTimers({ toFake: [...FAKE] });
    const { server, log } = await startTestServer({ backupDir: dir, backupMs: day }, clock);
    running.push(server);
    expect(log.entries.find((entry) => entry.message === 'backup due')?.fields).toMatchObject({ inMs: 60_000 });
    await vi.advanceTimersByTimeAsync(59_000);
    expect(copies(dir)).toEqual([]);
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.waitFor(() => expect(copies(dir)).toHaveLength(1), { timeout: 3_000 });
    clock.advance(day);
    await vi.advanceTimersByTimeAsync(day);
    await vi.waitFor(() => expect(copies(dir)).toHaveLength(2), { timeout: 3_000 });
    vi.useRealTimers();
  });

  it('waits for a day after the newest copy that is already there', async () => {
    const clock = new ManualClock();
    const hourAgo = new Date(clock.now() - 60 * 60_000).toISOString().replace(/[:.]/g, '-');
    const dir = backupDir(`island-${hourAgo}.sqlite`);
    vi.useFakeTimers({ toFake: [...FAKE] });
    const { server, log } = await startTestServer({ backupDir: dir, backupMs: day }, clock);
    running.push(server);
    expect(log.entries.find((entry) => entry.message === 'backup due')?.fields).toMatchObject({ inMs: day - 60 * 60_000 });
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    await new Promise((resolve) => setImmediate(resolve));
    expect(copies(dir)).toHaveLength(1);
    clock.advance(day);
    await vi.advanceTimersByTimeAsync(day - 60 * 60_000);
    await vi.waitFor(() => expect(copies(dir)).toHaveLength(2), { timeout: 3_000 });
    vi.useRealTimers();
  });
});
