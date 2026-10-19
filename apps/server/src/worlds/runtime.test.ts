import { SIM_VERSION, type Command } from '@island/sim';
import { describe, expect, it } from 'vitest';
import { aliceWorld, runTicks, worldDeps } from '../../test/support.ts';
import { CONTENT_HASH } from './recovery.ts';
import { Worlds } from './registry.ts';
import type { RuntimeEvent } from './runtime.ts';

/** North from beside alice's dock on seed 42. */
const road: Command = { type: 'place-road', slot: 0, tiles: Array.from({ length: 12 }, (_, i) => [33, 56 - i] as const) };
const cottage: Command = { type: 'place-building', slot: 0, building: 'cottage', x: 32, y: 54, rotation: 0 };

describe('Worlds.create', () => {
  it("claims the creator's island with the world's first logged command, after a snapshot of the empty world", () => {
    const { runtime, deps, worlds } = aliceWorld();
    expect(runtime.slotOf('id-alice')).toBe(0);
    expect(deps.store.commandsAfter(runtime.id, 0)).toEqual([
      {
        sequence: 1,
        tick: 0,
        accountId: 'id-alice',
        simVersion: SIM_VERSION,
        contentHash: CONTENT_HASH,
        command: JSON.stringify({ type: 'claim-island', owner: 'id-alice', name: 'Palm Cove' }),
      },
    ]);
    expect(deps.store.latestSnapshot(runtime.id)).toMatchObject({ tick: 0, lastSequence: 0 });
    expect(deps.store.members(runtime.id)).toEqual([{ slot: 0, accountId: 'id-alice' }]);
    expect(deps.store.eventsAfter(runtime.id, 0, null, 10).map((event) => event.type)).toEqual(['island-claimed']);
    expect(runtime.record.inviteCode).toMatch(/^[A-HJKMNP-Z2-9]{10}$/);
    expect(worlds.byInviteCode(runtime.record.inviteCode)).toBe(runtime);
  });

  it('creates nothing when the sim refuses the claim', () => {
    const { deps } = worldDeps();
    const worlds = new Worlds(deps);
    expect(worlds.create('id-alice', 'Palm  Cove')).toEqual({ ok: false, reason: 'bad-island-name' });
    expect(deps.store.worlds()).toEqual([]);
    expect(worlds.all()).toEqual([]);
  });

  it('gives a world a new invite code and forgets the old one', () => {
    const { runtime, worlds } = aliceWorld();
    const old = runtime.record.inviteCode;
    const code = worlds.regenerateInviteCode(runtime);
    expect(code).not.toBe(old);
    expect(worlds.byInviteCode(old)).toBeUndefined();
    expect(worlds.byInviteCode(code)).toBe(runtime);
  });
});

describe('WorldRuntime', () => {
  it('logs accepted commands with the tick they followed and the next sequence, and never a refused one', () => {
    const { runtime, clock, deps } = aliceWorld();
    runTicks(runtime, clock, 5);
    expect(runtime.apply(road, 'id-alice').ok).toBe(true);
    expect(runtime.apply({ ...cottage, x: 33, y: 50 }, 'id-alice')).toMatchObject({ ok: false, reason: 'tile-occupied' });
    expect(runtime.apply(cottage, 'id-alice').ok).toBe(true);
    expect(deps.store.commandsAfter(runtime.id, 1).map((c) => [c.sequence, c.tick, c.accountId])).toEqual([
      [2, 5, 'id-alice'],
      [3, 5, 'id-alice'],
    ]);
  });

  it('runs the ticks that are due by the clock, counted from the anchor', () => {
    const { runtime, clock } = aliceWorld();
    clock.advance(2_500 * 3);
    runtime.runDue();
    expect(runtime.world.tick).toBe(3);
    clock.advance(1_000);
    runtime.runDue();
    expect(runtime.world.tick).toBe(3);
    clock.advance(1_500);
    runtime.runDue();
    expect(runtime.world.tick).toBe(4);
    expect(runtime.nextDueMs()).toBe(runtime.record.anchorMs + 5 * 2_500);
  });

  it('tells listeners what each command and tick changed, and which command or tick changed it', () => {
    const { runtime, clock } = aliceWorld();
    const heard: RuntimeEvent[] = [];
    runtime.subscribe((event) => heard.push(event));
    runtime.apply(road, 'id-alice');
    runTicks(runtime, clock, 1);
    expect(heard.map((event) => event.kind === 'update' && [event.source, event.tick])).toEqual([[2, 0], [0, 1]]);
    const [command] = heard;
    expect(command?.kind === 'update' && command.changes.changed.map((change) => change.key)).toEqual(['island/0', 'roads/0']);
  });

  it('sends the world summary with an update only when it changed', () => {
    const { runtime, clock, worlds } = aliceWorld();
    const heard: RuntimeEvent[] = [];
    runtime.subscribe((event) => heard.push(event));
    runTicks(runtime, clock, 1);
    expect(worlds.claim(runtime, 'id-bob', 'Coral Bay')).toMatchObject({ ok: true, slot: 1 });
    expect(heard.map((event) => event.kind === 'update' && event.summary)).toEqual([
      null,
      {
        islands: [
          { slot: 0, name: 'Palm Cove', owner: 'alice', stage: 'outpost', residents: 0 },
          { slot: 1, name: 'Coral Bay', owner: 'bob', stage: 'outpost', residents: 0 },
        ],
      },
    ]);
  });

  it('keeps running when a listener throws, and stops telling a listener that left', () => {
    const { runtime, clock, log } = aliceWorld();
    const leave = runtime.subscribe(() => {
      throw new Error('socket gone');
    });
    runTicks(runtime, clock, 2);
    expect(runtime.world.tick).toBe(2);
    expect(log.entries.filter((entry) => entry.message === 'listener failed')).toHaveLength(2);
    leave();
    runTicks(runtime, clock, 2);
    expect(log.entries.filter((entry) => entry.message === 'listener failed')).toHaveLength(2);
  });

  it('writes a snapshot every snapshot interval of real time', () => {
    const setup = worldDeps();
    setup.config.snapshotMs = 10_000;
    const { runtime, clock, deps } = aliceWorld(setup);
    runTicks(runtime, clock, 3);
    expect(deps.store.latestSnapshot(runtime.id)?.tick).toBe(0);
    runTicks(runtime, clock, 1);
    expect(deps.store.latestSnapshot(runtime.id)).toMatchObject({ tick: 4, lastSequence: 1 });
  });

  it('mirrors the island owners into the membership table, and rebuilds the mirror on load', () => {
    const { runtime, worlds, deps } = aliceWorld();
    worlds.claim(runtime, 'id-bob', 'Coral Bay');
    const owners = [{ slot: 0, accountId: 'id-alice' }, { slot: 1, accountId: 'id-bob' }];
    expect(deps.store.members(runtime.id)).toEqual(owners);
    deps.store.setMembers(runtime.id, []);
    new Worlds(deps).loadAll();
    expect(deps.store.members(runtime.id)).toEqual(owners);
  });
});
