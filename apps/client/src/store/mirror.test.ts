// @vitest-environment node
import type { ServerMessage } from '@island/protocol';
import { islandFromEntities } from '@island/sim';
import { afterEach, describe, expect, it } from 'vitest';
import { Player } from '../../../server/test/player.ts';
import { Browser, addAccount, startTestServer } from '../../../server/test/server.ts';
import { TICK_MS } from '../../../server/test/support.ts';
import type { IslandServer } from '../../../server/src/server.ts';
import { applyMessage, commandSent, initialClientState, type ClientState } from './mirror.ts';

let running: IslandServer[] = [];
let players: Player[] = [];

afterEach(async () => {
  for (const player of players) player.socket.terminate();
  await Promise.all(running.map((server) => server.close()));
  running = [];
  players = [];
});

/** Alice's world on seed 42 (her dock at 12,26 on slot 0) with Bob's island in it, Alice connected as the test player. */
async function aliceOnline() {
  const setup = await startTestServer();
  running.push(setup.server);
  const alice = await addAccount(setup.server, 'alice');
  const bob = await addAccount(setup.server, 'bob');
  const created = setup.server.worlds.create(alice, 'Palm Cove', 42);
  if (!created.ok) throw new Error(created.reason);
  setup.server.worlds.claim(created.runtime, bob, 'Coral Bay');
  const browser = new Browser(setup.server.url);
  await browser.login('alice');
  const player = await Player.connect(setup.server, browser);
  players.push(player);
  await player.hello();
  const tick = (count: number) => {
    for (let i = 0; i < count; i += 1) {
      setup.clock.advance(TICK_MS);
      void setup.server.worlds.runDue();
    }
  };
  return { runtime: created.runtime, player, tick };
}

/** Feeds every message the player has received since `from` through the store's pure transition. */
function feed(state: ClientState, messages: readonly ServerMessage[]): ClientState {
  return messages.reduce(applyMessage, state);
}

describe('the mirror store', () => {
  it('holds the same island as the server after the full state, ticks and a command', async () => {
    const { runtime, player, tick } = await aliceOnline();
    await player.open(runtime.id, 0);
    let state = feed(initialClientState(), player.received);
    expect(state.island).toMatchObject({ world: runtime.id, slot: 0, own: true, status: 'running' });
    expect(islandFromEntities(state.island!.entities, 0)).toEqual(runtime.world.islands[0]);
    expect(state.island!.state).toEqual(runtime.world.islands[0]);

    const seen = player.received.length;
    state = commandSent(state, 1, { type: 'place-road', tiles: [[33, 56], [33, 55]] });
    expect(state.commands[1]).toMatchObject({ status: 'pending' });
    await player.command({ type: 'place-road', tiles: [[33, 56], [33, 55]] });
    const target = runtime.world.tick + 12;
    tick(12);
    await player.next('update', (m) => m.source === 0 && m.tick === target);
    state = feed(state, player.received.slice(seen));

    expect(state.commands[1]).toEqual({
      requestId: 1,
      command: { type: 'place-road', tiles: [[33, 56], [33, 55]] },
      status: 'ok',
      data: { tilesBuilt: 2 },
    });
    expect(state.island!.tick).toBe(runtime.world.tick);
    expect(islandFromEntities(state.island!.entities, 0)).toEqual(runtime.world.islands[0]);
    expect(state.island!.state).toEqual(runtime.world.islands[0]);
    expect(state.island!.state.roads[56 * 64 + 33]).toBe('1');
  });

  it('receives the ferry manifest in an update after a trip, and in the full state', async () => {
    const { runtime, player, tick } = await aliceOnline();
    await player.open(runtime.id, 0);
    let state = feed(initialClientState(), player.received);
    expect(state.island!.state.ferry).toBeNull();

    const seen = player.received.length;
    const morningFerry = 60; // the world starts at 06:00; the morning ferry docks at 07:00
    const target = morningFerry + 1;
    tick(target - runtime.world.tick);
    await player.next('update', (m) => m.source === 0 && m.tick === target);
    state = feed(state, player.received.slice(seen));
    expect(state.island!.state.ferry).toEqual({ tick: morningFerry, off: { commuters: 0, homes: [] }, on: { commuters: 0, homes: [] } });
    expect(state.island!.state).toEqual(runtime.world.islands[0]);

    const reopened = player.received.length;
    await player.open(runtime.id, 0);
    state = feed(state, player.received.slice(reopened));
    expect(state.island!.state.ferry).toEqual(runtime.world.islands[0]?.ferry);
  });

  it('settles a refused command with its reason and shortfall', async () => {
    const { runtime, player } = await aliceOnline();
    await player.open(runtime.id, 0);
    let state = feed(initialClientState(), player.received);
    const seen = player.received.length;
    const command = { type: 'place-building', building: 'island-hall', x: 10, y: 10, rotation: 0 } as const;
    state = commandSent(state, 1, command);
    await player.command(command);
    state = feed(state, player.received.slice(seen));
    expect(state.commands[1]).toEqual({ requestId: 1, command, status: 'refused', reason: 'landmark-locked', shortfallCents: 0 });
  });

  it('replaces everything on a new full state, leaving no stale entity, and keeps the view state', async () => {
    const { runtime, player } = await aliceOnline();
    await player.open(runtime.id, 0);
    let state = feed(initialClientState(), player.received);
    state = { ...state, view: { ...state.view, cameraMode: 'watch', quality: 'low' } };
    const view = state.view;

    const seen = player.received.length;
    await player.open(runtime.id, 1);
    state = feed(state, player.received.slice(seen));

    expect(state.island).toMatchObject({ slot: 1, own: false });
    const keys = [...state.island!.entities.keys()];
    expect(keys.slice(0, 3)).toEqual(['island/1', 'terrain/1', 'roads/1']);
    expect(keys.filter((key) => key.includes('/0'))).toEqual([]);
    expect(keys).toEqual(expect.arrayContaining(['market', expect.stringMatching(/^building\/1\/\d+$/)]));
    expect(state.island!.state).toEqual(runtime.world.islands[1]);
    expect(state.view).toBe(view);
  });

  it('appends the events of each update and takes the newest world summary', async () => {
    const { runtime, player, tick } = await aliceOnline();
    await player.open(runtime.id, 0);
    let state = feed(initialClientState(), player.received);
    expect(state.island!.summary.islands.map((i) => i.name)).toEqual(['Palm Cove', 'Coral Bay']);
    const seen = player.received.length;
    await player.command({ type: 'place-road', tiles: [[33, 56], [33, 55]] });
    await player.command({ type: 'place-building', building: 'cottage', x: 34, y: 55, rotation: 0 });
    tick(1);
    await player.next('update', (m) => m.source === 0);
    state = feed(state, player.received.slice(seen));
    expect(state.island!.events.map((e) => e.type)).toContain('construction-started');
  });

  it('takes the world status from a status message for the open world only', async () => {
    const { runtime, player } = await aliceOnline();
    await player.open(runtime.id, 0);
    let state = feed(initialClientState(), player.received);
    expect(state.island?.status).toBe('running');
    const seen = player.received.length;
    runtime.pauseAfterRollback(new Error('a test pause'));
    await player.next('status');
    state = feed(state, player.received.slice(seen));
    expect(state.island?.status).toBe('paused');
    expect(applyMessage(state, { type: 'status', world: 'another-world', status: 'running' }).island?.status).toBe('paused');
  });
});
