import { CLOSE_CODES, PROTOCOL_VERSION, type PlayerCommand } from '@island/protocol';
import { stateHash } from '@island/sim';
import { afterEach, describe, expect, it } from 'vitest';
import type { ServerConfig } from '../src/config.ts';
import type { IslandServer } from '../src/server.ts';
import { islandEntities } from '../src/sync/views.ts';
import { Player } from './player.ts';
import { Browser, addAccount, startTestServer } from './server.ts';
import { TICK_MS } from './support.ts';

let running: IslandServer[] = [];
let players: Player[] = [];

afterEach(async () => {
  for (const player of players) player.socket.terminate();
  await Promise.all(running.map((server) => server.close()));
  running = [];
  players = [];
});

/** Alice's world on seed 42 (her dock at 12,26), with bob's island in it too and carol signed in elsewhere. */
async function friends(overrides: Partial<ServerConfig> = {}) {
  const setup = await startTestServer(overrides);
  const { server } = setup;
  running.push(server);
  const ids = { alice: await addAccount(server, 'alice'), bob: await addAccount(server, 'bob'), carol: await addAccount(server, 'carol') };
  const created = server.worlds.create(ids.alice, 'Palm Cove', 42);
  if (!created.ok) throw new Error(created.reason);
  const runtime = created.runtime;
  server.worlds.claim(runtime, ids.bob, 'Coral Bay');
  const browsers = { alice: new Browser(server.url), bob: new Browser(server.url), carol: new Browser(server.url) };
  for (const [name, browser] of Object.entries(browsers)) await browser.login(name);
  const connect = async (browser: Browser, options = {}) => {
    const player = await Player.connect(server, browser, options);
    players.push(player);
    return player;
  };
  const tick = (count = 1) => {
    for (let i = 0; i < count; i += 1) {
      setup.clock.advance(TICK_MS);
      void server.worlds.runDue();
    }
  };
  return { ...setup, ids, runtime, browsers, connect, tick };
}

const ROAD: Array<[number, number]> = [];
for (let y = 27; y >= 14; y -= 1) ROAD.push([14, y]);
for (const y of [23, 19, 15]) for (let x = 8; x <= 20; x += 1) if (x !== 14) ROAD.push([x, y]);

/** The pacing bot's first commands on seed 42 (packages/sim/test/scenarios.ts), without the slot. */
const OUTPOST_START: PlayerCommand[] = [
  { type: 'place-road', tiles: ROAD },
  { type: 'set-auto-sell', good: 'wood', keep: 150 },
  { type: 'place-building', building: 'fishing-hut', x: 15, y: 26, rotation: 1 },
  { type: 'hire-commuters', count: 6 },
  { type: 'place-building', building: 'farm', x: 11, y: 24, rotation: 0 },
  { type: 'place-building', building: 'market', x: 12, y: 21, rotation: 0 },
  { type: 'place-building', building: 'well', x: 10, y: 24, rotation: 0 },
  { type: 'place-building', building: 'cottage', x: 15, y: 25, rotation: 0 },
  { type: 'place-building', building: 'lumber-camp', x: 16, y: 24, rotation: 0 },
];

const hash = (entities: Iterable<[string, unknown]>) => stateHash(Object.fromEntries(entities));

describe('connecting', () => {
  it('is refused without a session or from another origin', async () => {
    const { server, browsers } = await friends();
    await expect(Player.connect(server, new Browser(server.url))).rejects.toThrow('upgrade refused with 401');
    await expect(Player.connect(server, browsers.alice, { origin: 'https://evil.example' })).rejects.toThrow('upgrade refused with 403');
  });

  it('checks the protocol version first', async () => {
    const { browsers, connect } = await friends();
    const old = await connect(browsers.alice);
    old.send({ type: 'hello', protocolVersion: PROTOCOL_VERSION + 1 });
    expect(await old.next('update-required')).toEqual({ type: 'update-required', protocolVersion: PROTOCOL_VERSION });
    expect(await old.closed).toEqual({ code: CLOSE_CODES.updateRequired });
    const rude = await connect(browsers.alice);
    rude.send({ type: 'close-island' });
    expect(await rude.closed).toEqual({ code: CLOSE_CODES.badHello });
    const current = await connect(browsers.alice);
    expect((await current.hello()).account.username).toBe('alice');
  });

  it('closes a connection that does not say hello in time, or stops answering pings', async () => {
    const { browsers, connect } = await friends({ helloTimeoutMs: 50, heartbeatMs: 50 });
    const silent = await connect(browsers.alice);
    expect(await silent.closed).toEqual({ code: CLOSE_CODES.badHello });
    const gone = await connect(browsers.alice, { autoPong: false });
    await gone.hello();
    expect((await gone.closed).code).toBe(1006);
  });
});

describe('an open island', () => {
  it('arrives in full on open, checks its owner in at most once a game hour, then changes with every command and tick', async () => {
    const { browsers, connect, runtime, server, tick } = await friends();
    tick(60);
    const alice = await connect(browsers.alice);
    await alice.hello();
    const island = await alice.open(runtime.id, 0);
    await alice.open(runtime.id, 0);
    expect(island).toMatchObject({ world: runtime.id, slot: 0, own: true, tick: 60, status: 'running' });
    expect(island.entities.map((e) => e.key)).toEqual(['island/0', 'terrain/0', 'roads/0', 'building/0/1', 'market']);
    expect(island.summary.islands.map((i) => i.owner)).toEqual(['alice', 'bob']);
    expect(server.store.commandsAfter(runtime.id, 2).map((c) => JSON.parse(c.command))).toEqual([{ type: 'check-in', slot: 0 }]);

    const result = await alice.command({ type: 'place-road', tiles: [[14, 26], [14, 25]] });
    expect(result).toEqual({ type: 'result', requestId: 1, ok: true, data: { tilesBuilt: 2 } });
    const update = await alice.next('update');
    expect(update).toMatchObject({ world: runtime.id, tick: 60, source: 4, removed: [], events: [] });
    expect(update.changed.map((c) => c.key)).toEqual(['island/0', 'roads/0']);
    tick(3);
    expect((await alice.next('update', (m) => m.tick === 63)).source).toBe(0);
  });

  it("keeps the owner's and a visitor's mirrors equal to the server's state through commands and ticks (spec 9)", async () => {
    const { browsers, connect, runtime, tick } = await friends();
    const alice = await connect(browsers.alice);
    const bob = await connect(browsers.bob);
    for (const player of [alice, bob]) {
      await player.hello();
      await player.open(runtime.id, 0);
    }
    for (const command of OUTPOST_START) expect((await alice.command(command)).ok).toBe(true);
    tick(700);
    const server = hash(islandEntities(runtime.world, 0).map(({ key, value }) => [key, value]));
    for (const player of [alice, bob]) {
      await player.next('update', (m) => m.tick === 700);
      expect(hash(player.mirror)).toBe(server);
    }
    expect(runtime.world.islands[0]?.buildings.some((b) => (b.home?.residents ?? 0) > 0)).toBe(true);
    expect(alice.received.some((m) => m.type === 'update' && m.removed.length > 0)).toBe(true);
  });

  it('sends nothing once closed, and the full state again after a reconnect', async () => {
    const { browsers, connect, runtime, tick } = await friends();
    const alice = await connect(browsers.alice);
    await alice.hello();
    await alice.open(runtime.id, 0);
    await alice.command({ type: 'place-road', tiles: ROAD });
    alice.send({ type: 'close-island' });
    await alice.command({ type: 'hire-commuters', count: 2 });
    const closedAt = alice.received.length;
    tick(20);
    await alice.open(runtime.id, 0);
    expect(alice.received.slice(closedAt).map((m) => m.type)).toEqual(['island']);

    alice.socket.terminate();
    tick(30);
    const again = await connect(browsers.alice);
    await again.hello();
    expect((await again.open(runtime.id, 0)).tick).toBe(50);
    expect(hash(again.mirror)).toBe(hash(islandEntities(runtime.world, 0).map(({ key, value }) => [key, value])));
  });

  it("lets a member visit a friend's island read-only, and nobody else", async () => {
    const { browsers, connect, runtime } = await friends();
    const alice = await connect(browsers.alice);
    const bob = await connect(browsers.bob);
    const carol = await connect(browsers.carol);
    for (const player of [alice, bob, carol]) await player.hello();
    await alice.open(runtime.id, 0);
    const visit = await bob.open(runtime.id, 0);
    expect([visit.own, visit.news]).toEqual([false, []]);
    expect(await bob.command({ type: 'hire-commuters', count: 1 })).toMatchObject({ ok: false, reason: 'not-your-island' });
    await alice.command({ type: 'place-road', tiles: [[14, 26]] });
    expect((await bob.next('update')).changed.map((c) => c.key)).toEqual(['island/0', 'roads/0']);
    carol.send({ type: 'open-island', world: runtime.id, slot: 0 });
    expect(await carol.next('error')).toEqual({ type: 'error', reason: 'not-a-member' });
    bob.send({ type: 'open-island', world: runtime.id, slot: 5 });
    expect(await bob.next('error')).toEqual({ type: 'error', reason: 'island-not-claimed' });
  });

  it('answers malformed messages and commands with reason codes, and closes on garbage', async () => {
    const { browsers, connect, runtime } = await friends();
    const alice = await connect(browsers.alice);
    await alice.hello();
    expect(await alice.command({ type: 'hire-commuters', count: 1 })).toMatchObject({ ok: false, reason: 'no-island-open' });
    await alice.open(runtime.id, 0);
    alice.send({ type: 'subscribe-everything' });
    expect(await alice.next('error')).toEqual({ type: 'error', reason: 'bad-message' });
    expect(await alice.command({ type: 'hire-commuters', count: 1, slot: 1 })).toMatchObject({ ok: false, reason: 'bad-command' });
    expect(await alice.command({ type: 'sell', good: 'fish', amount: 5 })).toMatchObject({ ok: false, reason: 'not-enough-goods' });
    alice.send('{"type": "hello"');
    expect(await alice.closed).toEqual({ code: CLOSE_CODES.badData });
  });

  it('limits commands per connection', async () => {
    const { browsers, connect, runtime } = await friends();
    const alice = await connect(browsers.alice);
    await alice.hello();
    await alice.open(runtime.id, 0);
    for (let i = 0; i < 30; i += 1) alice.send({ type: 'command', requestId: 100 + i, command: { type: 'hire-commuters', count: 1 } });
    expect(await alice.command({ type: 'hire-commuters', count: 2 })).toMatchObject({ ok: false, reason: 'rate-limited' });
  });

  it('hears when its world pauses, and its commands are refused', async () => {
    const { browsers, connect, runtime, tick } = await friends();
    const alice = await connect(browsers.alice);
    await alice.hello();
    await alice.open(runtime.id, 0);
    runtime.world.islands[0]?.transit.push({ id: runtime.world.nextId, good: 'wood', amount: 1, from: 1, to: 999, arriveTick: 1 });
    runtime.world.nextId += 1;
    tick();
    expect(await alice.next('status')).toEqual({ type: 'status', world: runtime.id, status: 'paused' });
    expect(await alice.command({ type: 'hire-commuters', count: 1 })).toMatchObject({ ok: false, reason: 'world-paused' });
  });

  it('is sent again in full once its world has caught up', async () => {
    const { browsers, connect, runtime, clock, server } = await friends();
    const alice = await connect(browsers.alice);
    await alice.hello();
    await alice.open(runtime.id, 0);
    clock.advance(TICK_MS * 1_000);
    const catchingUp = server.worlds.runDue();
    expect(await alice.next('status')).toMatchObject({ status: 'catching-up' });
    await catchingUp;
    expect(await alice.next('island')).toMatchObject({ tick: 1_000, status: 'running' });
  });
});

describe('the news', () => {
  it('shows the owner the events since the last-seen marker, which moves only forward', async () => {
    const { browsers, connect, runtime } = await friends();
    const alice = await connect(browsers.alice);
    await alice.hello();
    const first = await alice.open(runtime.id, 0);
    expect(first.news.map((e) => [e.type, e.slot])).toEqual([['island-claimed', 0]]);
    const [claimed] = first.news;
    alice.send({ type: 'mark-seen', key: { tick: claimed?.tick, source: claimed?.source, index: claimed?.index } });
    await alice.command({ type: 'place-road', tiles: [[14, 24], [14, 25], [14, 26]] });
    expect((await alice.command({ type: 'place-building', building: 'cottage', x: 13, y: 24, rotation: 0 })).ok).toBe(true);
    expect((await alice.open(runtime.id, 0)).news.map((e) => e.type)).toEqual(['construction-started']);
    alice.send({ type: 'mark-seen', key: { tick: 0, source: 0, index: 0 } });
    expect((await alice.open(runtime.id, 0)).news.map((e) => e.type)).toEqual(['construction-started']);
  });
});

describe('ending a session', () => {
  it('closes the connections opened with it', async () => {
    const { browsers, connect } = await friends();
    const alice = await connect(browsers.alice);
    await alice.hello();
    await browsers.alice.post('/api/logout');
    expect(await alice.closed).toEqual({ code: CLOSE_CODES.sessionEnded });
  });
});
