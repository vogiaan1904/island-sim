// @vitest-environment node
import { PROTOCOL_VERSION } from '@island/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApi } from '../connection/api.ts';
import { createGameClock } from '../glide/clock.ts';
import { createGameStore } from '../store/store.ts';
import { addAccount } from '../../../server/test/server.ts';
import { aliceServer, browserFetch, browserSockets, closeServers, wsUrl } from '../test/server.ts';
import { createSession, reconnectDelayMs, type Session } from './session.ts';

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

describe('the session: sign-up, worlds and invite codes', () => {
  it('signs up with a friend\'s invite code and opens the new island', async () => {
    const { store, session, runtime } = await page();
    await session.start();
    const reason = await session.register({ username: 'Cara', password: 'password-3', inviteCode: runtime.record.inviteCode, islandName: 'Sunny Bay' });
    expect(reason).toBeNull();
    await vi.waitFor(() => expect(store.getState().session.phase).toBe('playing'));
    expect(store.getState().session.account?.username).toBe('Cara');
    expect(store.getState().island).toMatchObject({ world: runtime.id, own: true });
    expect(store.getState().island?.state.name).toBe('Sunny Bay');
  });

  it('says why a sign-up was refused and stays on the sign-in screen', async () => {
    const { store, session, runtime } = await page();
    await session.start();
    const request = { username: 'Cara', password: 'password-3', inviteCode: runtime.record.inviteCode, islandName: 'Sunny Bay' };
    expect(await session.register({ ...request, inviteCode: 'ZZZZZZZZZZ' })).toBe('bad-invite-code');
    expect(await session.register({ ...request, username: 'ALICE' })).toBe('username-taken');
    expect(store.getState().session.phase).toBe('signed-out');
  });

  it('shows a world list to a player with several worlds, creates a world, and opens the one they pick', async () => {
    const { store, session, jar, server } = await page();
    await jar.login('bob');
    await session.start();
    await vi.waitFor(() => expect(store.getState().session.phase).toBe('playing'));

    await session.showWorlds();
    expect(store.getState().session.phase).toBe('worlds');
    expect(store.getState().island).toBeNull();
    expect(store.getState().session.worlds).toHaveLength(1);

    expect(await session.createWorld('Bob Bay')).toBeNull();
    const worlds = store.getState().session.worlds;
    expect(worlds.map((world) => world.islandName).sort()).toEqual(['Bob Bay', 'Coral Bay']);
    expect(store.getState().session.phase).toBe('worlds');
    const mine = worlds.find((world) => world.islandName === 'Bob Bay')!;
    expect(mine.inviteCode).toMatch(/^[A-Z0-9]{10}$/);
    expect(server.worlds.get(mine.id)?.record.inviteCode).toBe(mine.inviteCode);

    session.openWorld(mine.id);
    await vi.waitFor(() => expect(store.getState().session.phase).toBe('playing'));
    expect(store.getState().island?.world).toBe(mine.id);
  });

  it('joins another world with its code and opens the new island', async () => {
    const { store, session, jar, server } = await page();
    const carol = await addAccount(server, 'carol');
    const created = server.worlds.create(carol, 'Carol Cay', 7);
    if (!created.ok) throw new Error(created.reason);
    await jar.login('alice');
    await session.start();
    await vi.waitFor(() => expect(store.getState().session.phase).toBe('playing'));
    await session.showWorlds();

    expect(await session.joinWorld(created.runtime.record.inviteCode, 'Alice Isle')).toBeNull();
    await vi.waitFor(() => expect(store.getState().session.phase).toBe('playing'));
    expect(store.getState().island).toMatchObject({ world: created.runtime.id, own: true });
    expect(store.getState().session.worlds).toHaveLength(2);
  });

  it('says why creating or joining was refused', async () => {
    const { store, session, jar, runtime } = await page();
    await jar.login('alice');
    await session.start();
    await vi.waitFor(() => expect(store.getState().session.phase).toBe('playing'));
    await session.showWorlds();
    expect(await session.joinWorld('ZZZZZZZZZZ', 'Alice Isle')).toBe('bad-invite-code');
    expect(await session.joinWorld(runtime.record.inviteCode, 'Alice Isle')).toBe('already-has-island');
    expect(store.getState().session.phase).toBe('worlds');
  });

  it('regenerates the invite code of a world the player created, and no other', async () => {
    const { store, session, jar, runtime } = await page();
    await jar.login('alice');
    await session.start();
    await vi.waitFor(() => expect(store.getState().session.phase).toBe('playing'));
    await session.showWorlds();
    const before = store.getState().session.worlds[0]!.inviteCode;
    expect(before).toBe(runtime.record.inviteCode);

    expect(await session.regenerateInvite(runtime.id)).toBeNull();
    const after = store.getState().session.worlds[0]!.inviteCode;
    expect(after).not.toBe(before);
    expect(after).toBe(runtime.record.inviteCode);

    expect(await session.regenerateInvite('no-such-world')).toBe('no-such-world');
  });

  it('changes the password of the signed-in player and stays signed in; a wrong current password changes nothing', async () => {
    const { store, session, jar } = await page();
    await jar.login('alice');
    await session.start();
    await vi.waitFor(() => expect(store.getState().session.phase).toBe('playing'));

    expect(await session.changePassword('not-my-password', 'brand-new-pass')).toBe('bad-credentials');
    expect(await session.changePassword('password-1', 'brand-new-pass')).toBeNull();
    expect(store.getState().session.phase).toBe('playing');
    expect(await session.logOut()).toBeNull();
    expect(await session.logIn('alice', 'password-1')).toBe('bad-credentials');
    expect(await session.logIn('alice', 'brand-new-pass')).toBeNull();
  });

  it('logs out this device: back to the log-in screen with nothing of the island left', async () => {
    const { store, session, jar } = await page();
    await jar.login('alice');
    await session.start();
    await vi.waitFor(() => expect(store.getState().session.phase).toBe('playing'));

    expect(await session.logOut()).toBeNull();
    expect(store.getState().session.phase).toBe('signed-out');
    expect(store.getState().session.account).toBeNull();
    expect(store.getState().session.worlds).toEqual([]);
    expect(store.getState().island).toBeNull();
    await session.start();
    expect(store.getState().session.phase).toBe('signed-out');
  });
});

describe('the reconnect delay', () => {
  it('doubles from half a second up to fifteen seconds, with a quarter of random spread either way', () => {
    const middle = () => 0.5;
    expect([0, 1, 2, 3, 4, 5, 6, 9].map((attempt) => reconnectDelayMs(attempt, middle))).toEqual([500, 1000, 2000, 4000, 8000, 15000, 15000, 15000]);
    expect(reconnectDelayMs(2, () => 0)).toBe(1500);
    expect(reconnectDelayMs(2, () => 1)).toBe(2500);
  });
});
