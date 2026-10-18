// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApi } from '../connection/api.ts';
import { createGameClock } from '../glide/clock.ts';
import { createGameStore } from '../store/store.ts';
import type { IslandServer } from '../../../server/src/server.ts';
import { ManualClock, TICK_MS } from '../../../server/test/support.ts';
import { addAccount, startTestServer, tempDatabase } from '../../../server/test/server.ts';
import { browserFetch, browserSockets, closeServers, wsUrl } from '../test/server.ts';
import { createSession, type Session } from './session.ts';

// The connection states against a real in-process server that is stopped and started again on the same data, the way
// a phone sees a deploy or a dropped network. Backoff is a few milliseconds here.

let sessions: Session[] = [];
let servers: IslandServer[] = [];
afterEach(async () => {
  for (const session of sessions) session.stop();
  sessions = [];
  await Promise.all(servers.map((server) => server.close()));
  servers = [];
  await closeServers();
});

/** One world with Alice's island on a database file, and a page signed in as Alice with a hand-driven visibility signal. */
async function livePage(options: { backoffMs?: (attempt: number) => number } = {}) {
  const databasePath = tempDatabase();
  const clock = new ManualClock();
  const first = await startTestServer({ databasePath }, clock);
  servers.push(first.server);
  const aliceId = await addAccount(first.server, 'alice');
  const created = first.server.worlds.create(aliceId, 'Palm Cove', 42);
  if (!created.ok) throw new Error(created.reason);
  const port = Number(new URL(first.server.url).port);
  const worldId = created.runtime.id;

  const { fetch, jar } = browserFetch(first.server);
  await jar.login('alice');
  const store = createGameStore();
  const now = 50_000;
  let wall = 1_000_000;
  const listeners = new Set<(visible: boolean) => void>();
  const session = createSession(store, createGameClock(), {
    api: createApi(fetch),
    openSocket: browserSockets(jar),
    socketUrl: wsUrl(first.server),
    now: () => now,
    wallNow: () => wall,
    backoffMs: options.backoffMs ?? (() => 10),
    onVisibilityChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
  sessions.push(session);

  let current = first.server;
  return {
    store,
    session,
    worldId,
    setWall: (ms: number) => (wall = ms),
    show: (visible: boolean) => listeners.forEach((listener) => listener(visible)),
    jar,
    server: () => current,
    tick: () => {
      clock.advance(TICK_MS);
      void current.worlds.runDue();
    },
    stopServer: async () => {
      await current.close();
    },
    restartServer: async () => {
      const restarted = await startTestServer({ databasePath, port }, clock);
      servers.push(restarted.server);
      current = restarted.server;
      return restarted.server;
    },
  };
}

async function playing(page: Awaited<ReturnType<typeof livePage>>) {
  await page.session.start();
  await vi.waitFor(() => expect(page.store.getState().session.phase).toBe('playing'));
}

describe('reconnecting', () => {
  it('reconnects by itself after the server comes back, opens the island again and keeps the view state', async () => {
    const page = await livePage();
    await playing(page);
    page.store.getState().setView({ quality: 'high' });
    const before = page.store.getState().island;

    await page.stopServer();
    await vi.waitFor(() => expect(page.store.getState().session.reconnecting).toBe(true));
    // The island stays on screen, calm, until the new full state arrives.
    expect(page.store.getState().session.phase).toBe('playing');
    expect(page.store.getState().island).toBe(before);

    const restarted = await page.restartServer();
    await vi.waitFor(() => expect(page.store.getState().session.reconnecting).toBe(false));
    const after = page.store.getState().island;
    expect(after).not.toBe(before);
    expect(after?.state).toEqual(restarted.worlds.get(page.worldId)?.world.islands[0]);
    expect(page.store.getState().view.quality).toBe('high');
    expect(page.store.getState().session.phase).toBe('playing');
  });

  it('keeps trying with backoff while the server is away', async () => {
    const delays: number[] = [];
    const page = await livePage({
      backoffMs: (attempt) => {
        delays.push(attempt);
        return 10;
      },
    });
    await playing(page);
    await page.stopServer();
    await vi.waitFor(() => expect(delays.length).toBeGreaterThanOrEqual(3));
    expect(delays.slice(0, 3)).toEqual([0, 1, 2]);
    await page.restartServer();
    await vi.waitFor(() => expect(page.store.getState().session.reconnecting).toBe(false));
  });

  it('sends no command while reconnecting, and forgets commands that never got a result', async () => {
    const page = await livePage();
    await playing(page);
    const requestId = page.session.command({ type: 'place-road', tiles: [[14, 26]] });
    expect(requestId).not.toBeNull();
    await page.stopServer();
    await vi.waitFor(() => expect(page.store.getState().session.reconnecting).toBe(true));
    expect(page.session.command({ type: 'hire-commuters', count: 1 })).toBeNull();
    const lost = page.store.getState().commands[requestId!];
    expect(lost === undefined || lost.status !== 'pending').toBe(true);
  });

  it('reconnects at once when the page becomes visible again, without waiting out the backoff', async () => {
    const page = await livePage({ backoffMs: () => 60_000 });
    await playing(page);
    await page.stopServer();
    await vi.waitFor(() => expect(page.store.getState().session.reconnecting).toBe(true));
    await page.restartServer();
    page.show(true);
    await vi.waitFor(() => expect(page.store.getState().session.reconnecting).toBe(false));
  });

  it('asks for a fresh full state when the page comes back after a long time in the background', async () => {
    const page = await livePage();
    await playing(page);
    const before = page.store.getState().island;
    page.show(false);
    page.setWall(1_000_000 + 60_000);
    page.show(true);
    await vi.waitFor(() => expect(page.store.getState().island).not.toBe(before));
    expect(page.store.getState().session.reconnecting).toBe(false);
    expect(page.store.getState().session.phase).toBe('playing');
  });

  it('leaves a live connection alone when the page was only away for a moment', async () => {
    const page = await livePage();
    await playing(page);
    const before = page.store.getState().island;
    page.show(false);
    page.setWall(1_000_000 + 2_000);
    page.show(true);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(page.store.getState().island).toBe(before);
    expect(page.store.getState().session.reconnecting).toBe(false);
  });

  it('goes back to the log-in when the session ended while it was away', async () => {
    const page = await livePage({ backoffMs: () => 60_000 });
    await playing(page);
    await page.stopServer();
    await vi.waitFor(() => expect(page.store.getState().session.reconnecting).toBe(true));
    await page.restartServer();
    // Logged out on another device meanwhile.
    expect((await page.jar.post('/api/logout')).status).toBe(200);
    page.show(true);
    await vi.waitFor(() => expect(page.store.getState().session.phase).toBe('signed-out'));
  });
});

describe('a resting world', () => {
  it('shows the status of a paused world and sends no commands meanwhile', async () => {
    const page = await livePage();
    await playing(page);
    const runtime = page.server().worlds.get(page.worldId)!;
    runtime.world.islands[0]?.transit.push({ id: runtime.world.nextId, good: 'wood', amount: 1, from: 1, to: 999, arriveTick: 1 });
    runtime.world.nextId += 1;
    // The next tick throws and pauses the world.
    page.tick();
    await vi.waitFor(() => expect(page.store.getState().island?.status).toBe('paused'));
    expect(page.session.command({ type: 'hire-commuters', count: 1 })).toBeNull();
  });

  it('rests with the line while a world that failed to load is opened, and opens it once it is back', async () => {
    const page = await livePage();
    const worlds = page.server().worlds as unknown as { runtimes: Map<string, unknown>; failed: Map<string, string> };
    const runtime = worlds.runtimes.get(page.worldId);
    worlds.runtimes.delete(page.worldId);
    worlds.failed.set(page.worldId, 'could not load');
    await page.session.start();
    await vi.waitFor(() => expect(page.store.getState().session.phase).toBe('resting'));
    expect(page.store.getState().island).toBeNull();

    worlds.failed.delete(page.worldId);
    worlds.runtimes.set(page.worldId, runtime);
    await vi.waitFor(() => expect(page.store.getState().session.phase).toBe('playing'));
  });
});
