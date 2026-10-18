import { describe, expect, it } from 'vitest';
import { aliceWorld, islandMessage, islandOf } from '../test/islands.ts';
import { createGameStore } from './store.ts';

describe('the game store', () => {
  it('starts with no island, nothing sent and the default view, checking whether the player is signed in', () => {
    const store = createGameStore();
    expect(store.getState()).toMatchObject({
      island: null,
      commands: {},
      view: { cameraMode: 'free', quality: null },
      session: { phase: 'checking', account: null, worlds: [] },
    });
  });

  it('mirrors the island from the server messages it receives and keeps view changes across a new full state', () => {
    const store = createGameStore();
    const world = aliceWorld();
    store.getState().setView({ quality: 'high' });
    store.getState().receive(islandMessage(world));
    expect(store.getState().island?.state).toEqual(islandOf(world));
    store.getState().receive(islandMessage(world));
    expect(store.getState().view).toEqual({ cameraMode: 'free', quality: 'high' });
  });

  it('tracks a command from sent to settled', () => {
    const store = createGameStore();
    store.getState().commandSent(7, { type: 'hire-commuters', count: 2 });
    expect(store.getState().commands[7]?.status).toBe('pending');
    store.getState().receive({ type: 'result', requestId: 7, ok: true, data: { hired: 2 } });
    expect(store.getState().commands[7]).toMatchObject({ status: 'ok', data: { hired: 2 } });
  });

  it('keeps the session phase and account apart from the island', () => {
    const store = createGameStore();
    store.getState().setSession({ phase: 'signed-out' });
    expect(store.getState().session).toEqual({ phase: 'signed-out', account: null, worlds: [], reconnecting: false });
  });

  it('forgets pending commands when the connection drops but keeps the settled ones', () => {
    const store = createGameStore();
    store.getState().commandSent(1, { type: 'hire-commuters', count: 1 });
    store.getState().commandSent(2, { type: 'hire-commuters', count: 2 });
    store.getState().receive({ type: 'result', requestId: 1, ok: true, data: {} });
    store.getState().commandsLost();
    expect(store.getState().commands[2]).toBeUndefined();
    expect(store.getState().commands[1]?.status).toBe('ok');
  });
});
