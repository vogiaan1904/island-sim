// @vitest-environment node
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

/** Alice signed in and playing her own island (slot 0) in the world where Bob has slot 1. */
async function alicePlaying() {
  const setup = await aliceServer();
  const { fetch, jar } = browserFetch(setup.server);
  const store = createGameStore();
  const session = createSession(store, createGameClock(), {
    api: createApi(fetch),
    openSocket: browserSockets(jar),
    socketUrl: wsUrl(setup.server),
    now: () => 50_000,
  });
  sessions.push(session);
  await session.start();
  await session.logIn('alice', 'password-1');
  await vi.waitFor(() => expect(store.getState().session.phase).toBe('playing'));
  return { ...setup, store, session };
}

describe('the session: visiting a friend', () => {
  it('remembers the islands of each world it opened, so the world screen can list them', async () => {
    const { store, runtime } = await alicePlaying();
    expect(store.getState().session.summaries[runtime.id]?.map((island) => island.name)).toEqual(['Palm Cove', 'Coral Bay']);
  });

  it("visits a friend's island read-only from inside the world, with the panels and the draft closed", async () => {
    const { store, session, runtime } = await alicePlaying();
    store.getState().setView({ openPanel: 'build', tappedBuilding: 3 });
    session.visit(runtime.id, 1);
    expect(store.getState().session.arriving).toBe('visit');
    await vi.waitFor(() => expect(store.getState().island).toMatchObject({ slot: 1, own: false }));
    expect(store.getState().island?.state).toEqual(runtime.world.islands[1]);
    expect(store.getState().view).toMatchObject({ openPanel: null, tappedBuilding: null, placement: null });
    expect(session.command({ type: 'hire-commuters', count: 1 })).toBeNull();
  });

  it('visits from the world screen, where no island is open', async () => {
    const { store, session, runtime } = await alicePlaying();
    await session.showWorlds();
    expect(store.getState().island).toBeNull();
    session.visit(runtime.id, 1);
    await vi.waitFor(() => expect(store.getState().island).toMatchObject({ slot: 1, own: false }));
    expect(store.getState().session.phase).toBe('playing');
  });

  it("does not visit an island missing from the world's list, nor the player's own", async () => {
    const { store, session, runtime } = await alicePlaying();
    session.visit(runtime.id, 5);
    session.visit(runtime.id, 0);
    expect(store.getState().session.arriving).toBeNull();
    expect(store.getState().island).toMatchObject({ slot: 0, own: true });
  });

  it('goes home to the own island and can send commands again', async () => {
    const { store, session, runtime } = await alicePlaying();
    session.visit(runtime.id, 1);
    await vi.waitFor(() => expect(store.getState().island?.own).toBe(false));
    session.home();
    expect(store.getState().session.arriving).toBe('home');
    await vi.waitFor(() => expect(store.getState().island).toMatchObject({ slot: 0, own: true }));
    expect(session.command({ type: 'hire-commuters', count: 1 })).not.toBeNull();
  });

  it('does nothing when asked to go home from the own island', async () => {
    const { store, session } = await alicePlaying();
    session.home();
    expect(store.getState().session.arriving).toBeNull();
  });
});
