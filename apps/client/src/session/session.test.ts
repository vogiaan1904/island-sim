// @vitest-environment node
import { PROTOCOL_VERSION } from '@island/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApi } from '../connection/api.ts';
import { createGameClock } from '../glide/clock.ts';
import { createGameStore } from '../store/store.ts';
import { aliceServer, browserFetch, browserSockets, closeServers, wsUrl } from '../test/server.ts';
import { createSession, type Session } from './session.ts';

let sessions: Session[] = [];
afterEach(async () => {
  for (const session of sessions) session.stop();
  sessions = [];
  await closeServers();
});

async function page(options: { protocolVersion?: number } = {}) {
  const setup = await aliceServer();
  const { fetch, jar } = browserFetch(setup.server);
  const store = createGameStore();
  let now = 50_000;
  const clock = createGameClock();
  const session = createSession(store, clock, {
    api: createApi(fetch),
    openSocket: browserSockets(jar),
    socketUrl: wsUrl(setup.server),
    now: () => now,
    ...options,
  });
  sessions.push(session);
  return { ...setup, store, clock, session, jar, setNow: (ms: number) => (now = ms) };
}

describe('the session', () => {
  it('asks for a log-in when nobody is signed in on this device', async () => {
    const { store, session } = await page();
    await session.start();
    expect(store.getState().session.phase).toBe('signed-out');
  });

  it('logs in, opens the own island over the socket and keeps it live with the server', async () => {
    const { store, session, runtime, tick, clock } = await page();
    await session.start();
    expect(await session.logIn('Alice', 'password-1')).toBeNull();
    await vi.waitFor(() => expect(store.getState().session.phase).toBe('playing'));
    expect(store.getState().session.account?.username).toBe('alice');
    expect(store.getState().island?.state).toEqual(runtime.world.islands[0]);
    expect(clock.ticksAt(50_000)).toBe(runtime.world.tick);

    const requestId = session.command({ type: 'place-road', tiles: [[14, 26], [14, 25]] });
    expect(store.getState().commands[requestId!]?.status).toBe('pending');
    await vi.waitFor(() => expect(store.getState().commands[requestId!]?.status).toBe('ok'));
    const target = runtime.world.tick + 3;
    tick(3);
    await vi.waitFor(() => expect(store.getState().island?.tick).toBe(target));
    expect(store.getState().island?.state).toEqual(runtime.world.islands[0]);
  });

  it('skips the log-in for a player who is already signed in', async () => {
    const { store, session, jar } = await page();
    await jar.login('alice');
    await session.start();
    await vi.waitFor(() => expect(store.getState().session.phase).toBe('playing'));
  });

  it('keeps the log-in screen with the reason when the password is wrong', async () => {
    const { store, session } = await page();
    await session.start();
    expect(await session.logIn('alice', 'not-it')).toBe('bad-credentials');
    expect(store.getState().session.phase).toBe('signed-out');
  });

  it('shows that an update is needed when the server speaks another protocol version', async () => {
    const { store, session, jar } = await page({ protocolVersion: PROTOCOL_VERSION + 1 });
    await jar.login('alice');
    await session.start();
    await vi.waitFor(() => expect(store.getState().session.phase).toBe('update-required'));
  });

  it('sends no command before the island is open', async () => {
    const { session } = await page();
    expect(session.command({ type: 'hire-commuters', count: 1 })).toBeNull();
  });
});
