import type { MeResponse } from '@island/protocol';
import { SIM_VERSION, stateHash, type Command } from '@island/sim';
import { afterEach, describe, expect, it } from 'vitest';
import type { ServerConfig } from '../src/config.ts';
import type { IslandServer } from '../src/server.ts';
import { CONTENT_HASH } from '../src/worlds/recovery.ts';
import { Browser, addAccount, startTestServer, tempDatabase } from './server.ts';
import { ManualClock, TICK_MS } from './support.ts';

let running: IslandServer[] = [];

afterEach(async () => {
  await Promise.all(running.map((server) => server.close()));
  running = [];
});

const road: Command = { type: 'place-road', slot: 0, tiles: Array.from({ length: 12 }, (_, i) => [14, 26 - i] as const) };
const cottage: Command = { type: 'place-building', slot: 0, building: 'cottage', x: 13, y: 24, rotation: 0 };
const hire: Command = { type: 'hire-commuters', slot: 0, count: 3 };

/** Starts a server on a database file that outlives it, sharing one clock across restarts. */
async function serverOn(databasePath: string, clock: ManualClock, overrides: Partial<ServerConfig> = {}) {
  const { server, log } = await startTestServer({ databasePath, ...overrides }, clock);
  running.push(server);
  return { server, log };
}

async function tick(server: IslandServer, clock: ManualClock, count: number): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    clock.advance(TICK_MS);
    await server.worlds.runDue();
  }
}

/** A server with alice's world on seed 42 and some play in it. */
async function playedWorld(databasePath: string, clock: ManualClock) {
  const { server } = await serverOn(databasePath, clock);
  const aliceId = await addAccount(server, 'alice');
  const created = server.worlds.create(aliceId, 'Palm Cove', 42);
  if (!created.ok) throw new Error(created.reason);
  const { runtime } = created;
  await tick(server, clock, 20);
  expect(runtime.apply(road, aliceId).ok).toBe(true);
  await tick(server, clock, 30);
  expect(runtime.apply(cottage, aliceId).ok).toBe(true);
  expect(runtime.apply(hire, aliceId).ok).toBe(true);
  await tick(server, clock, 15);
  return { server, aliceId, runtime };
}

describe('after a crash', () => {
  it('rebuilds every world exactly from its snapshot and log, so no action is lost (spec 5.2)', async () => {
    const databasePath = tempDatabase();
    const clock = new ManualClock();
    const { server, runtime } = await playedWorld(databasePath, clock);
    const before = { tick: runtime.world.tick, hash: stateHash(runtime.world) };
    await server.close({ snapshot: false });

    const restarted = (await serverOn(databasePath, clock)).server;
    const recovered = restarted.worlds.get(runtime.id);
    expect(recovered?.world.tick).toBe(50);
    await restarted.worlds.runDue();
    expect({ tick: recovered?.world.tick, hash: recovered && stateHash(recovered.world) }).toEqual(before);
  });
});

describe('after downtime', () => {
  it('catches up the missed ticks from the shutdown snapshot, capped', async () => {
    const databasePath = tempDatabase();
    const clock = new ManualClock();
    const { server, runtime } = await playedWorld(databasePath, clock);
    await server.close();
    clock.advance(TICK_MS * 2_000);

    const restarted = (await serverOn(databasePath, clock)).server;
    expect(restarted.worlds.get(runtime.id)?.world.tick).toBe(65);
    await restarted.worlds.runDue();
    expect(restarted.worlds.get(runtime.id)?.world.tick).toBe(2_065);
    await restarted.close();

    clock.advance(TICK_MS * 5_000);
    const capped = (await serverOn(databasePath, clock, { catchUpCapTicks: 1_000 })).server;
    await capped.worlds.runDue();
    expect(capped.worlds.get(runtime.id)?.world.tick).toBe(3_065);
  });
});

describe('after a deploy', () => {
  it('refuses to replay commands another sim version logged, and keeps the other worlds running', async () => {
    const databasePath = tempDatabase();
    const clock = new ManualClock();
    const { server, runtime, aliceId } = await playedWorld(databasePath, clock);
    const other = server.worlds.create(aliceId, 'Second Isle', 7);
    if (!other.ok) throw new Error(other.reason);
    server.store.insertCommand(
      runtime.id,
      { sequence: 99, tick: 65, accountId: aliceId, simVersion: SIM_VERSION - 1, contentHash: CONTENT_HASH, command: JSON.stringify(hire) },
      clock.now(),
    );
    await server.close({ snapshot: false });

    const { server: restarted, log } = await serverOn(databasePath, clock);
    expect(restarted.worlds.get(runtime.id)).toBeUndefined();
    expect(restarted.worlds.failed.get(runtime.id)).toMatch(/^replay refused: command 99 and later were applied by sim version 1 /);
    expect(log.entries.find((entry) => entry.message === 'world not loaded')?.fields).toMatchObject({ world: runtime.id });
    expect(restarted.worlds.get(other.runtime.id)?.status).toBe('running');
    const alice = new Browser(restarted.url);
    await alice.login('alice');
    const me = await alice.get<MeResponse>('/api/me');
    expect(me.body.worlds.map((world) => [world.id, world.status])).toEqual([
      [runtime.id, 'paused'],
      [other.runtime.id, 'running'],
    ]);
  });
});
