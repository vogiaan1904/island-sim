import { describe, expect, it } from 'vitest';
import { aliceWorld, islandMessage, islandOf } from '../test/islands.ts';
import { createGameStore } from './store.ts';

describe('the game store', () => {
  it('starts with no island, nothing sent and the default view, checking whether the player is signed in', () => {
    const store = createGameStore();
    expect(store.getState()).toMatchObject({
      island: null,
      commands: {},
      view: { cameraMode: 'free', quality: null, controlsChoice: 'auto', controlsDetected: 'mouse', tappedBuilding: null },
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
    expect(store.getState().view).toMatchObject({ cameraMode: 'free', quality: 'high' });
  });

  it('keeps the camera across a new full state', () => {
    const store = createGameStore();
    const world = aliceWorld();
    store.getState().receive(islandMessage(world));
    store.getState().cameraGesture({ kind: 'fly-to', x: 30, z: 40, distance: 50 });
    const camera = store.getState().view.camera;
    store.getState().receive(islandMessage(world));
    expect(store.getState().view.camera).toBe(camera);
  });

  it('holds the camera state, which gestures and flights from anywhere in the app change', () => {
    const store = createGameStore();
    store.getState().cameraGesture({ kind: 'twist', angle: 1 });
    expect(store.getState().view.camera.azimuth).toBeCloseTo(1);
    store.getState().cameraGesture({ kind: 'face-north' });
    expect(store.getState().view.camera.azimuth).toBeCloseTo(0);
    store.getState().cameraGesture({ kind: 'fly-to', x: 20, z: 30, distance: 40 });
    expect(store.getState().view.camera).toMatchObject({ x: 20, z: 30, distance: 40 });
  });

  it('coasts on each step after a fling, and comes to rest', () => {
    const store = createGameStore();
    const viewport = { width: 800, height: 600 };
    const drag = (x: number) => ({ kind: 'drag' as const, x, y: 300, dx: -8, dy: 0, dt: 0.016, viewport });
    store.getState().cameraGesture(drag(392));
    store.getState().cameraGesture(drag(384));
    store.getState().cameraGesture({ kind: 'release', idleMs: 5 });
    expect(store.getState().view.camera.coasting).toBe(true);
    const x = store.getState().view.camera.x;
    store.getState().cameraStep(0.1);
    expect(store.getState().view.camera.x).toBeGreaterThan(x);
    for (let i = 0; i < 400; i += 1) store.getState().cameraStep(0.016);
    expect(store.getState().view.camera.coasting).toBe(false);
  });

  it('keeps the trackpad or mouse choice and the detected device apart', () => {
    const store = createGameStore();
    store.getState().setView({ controlsDetected: 'trackpad' });
    store.getState().setView({ controlsChoice: 'mouse' });
    expect(store.getState().view).toMatchObject({ controlsChoice: 'mouse', controlsDetected: 'trackpad' });
  });

  it('tracks a command from sent to settled', () => {
    const store = createGameStore();
    store.getState().commandSent(7, { type: 'hire-commuters', count: 2 });
    expect(store.getState().commands[7]?.status).toBe('pending');
    store.getState().receive({ type: 'result', requestId: 7, ok: true, data: { hired: 2 } });
    expect(store.getState().commands[7]).toMatchObject({ status: 'ok', data: { hired: 2 } });
  });

  it('drops the island and its commands when the player leaves it, keeping the view and the session', () => {
    const store = createGameStore();
    store.getState().setView({ quality: 'high' });
    store.getState().setSession({ phase: 'playing' });
    store.getState().receive(islandMessage(aliceWorld()));
    store.getState().commandSent(1, { type: 'hire-commuters', count: 2 });
    store.getState().clearIsland();
    expect(store.getState()).toMatchObject({ island: null, commands: {}, view: { quality: 'high' }, session: { phase: 'playing' } });
  });

  it('keeps the session phase and account apart from the island', () => {
    const store = createGameStore();
    store.getState().setSession({ phase: 'signed-out' });
    expect(store.getState().session).toEqual({ phase: 'signed-out', account: null, worlds: [], reconnecting: false, summaries: {}, arriving: null });
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
