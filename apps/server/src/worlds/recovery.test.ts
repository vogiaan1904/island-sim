import { SIM_VERSION, stateHash, type Command } from '@island/sim';
import { describe, expect, it } from 'vitest';
import { aliceWorld, runTicks } from '../../test/support.ts';
import { CONTENT_HASH, recoverWorld } from './recovery.ts';

const road: Command = { type: 'place-road', slot: 0, tiles: Array.from({ length: 12 }, (_, i) => [14, 26 - i] as const) };
const cottage: Command = { type: 'place-building', slot: 0, building: 'cottage', x: 13, y: 24, rotation: 0 };
const secondCottage: Command = { ...cottage, x: 15, y: 24 };

describe('recoverWorld', () => {
  it('rebuilds the exact live state from the newest snapshot and the commands logged after it', () => {
    const { runtime, clock, deps } = aliceWorld();
    runTicks(runtime, clock, 5);
    runtime.apply(road, 'id-alice');
    runTicks(runtime, clock, 30);
    runtime.snapshot();
    runTicks(runtime, clock, 10);
    runtime.apply(cottage, 'id-alice');
    runTicks(runtime, clock, 20);

    const atLastCommand = recoverWorld(deps.store, runtime.id, null);
    expect(atLastCommand.ok && [atLastCommand.world.tick, atLastCommand.lastSequence]).toEqual([45, 3]);
    const atLiveTick = recoverWorld(deps.store, runtime.id, runtime.world.tick);
    expect(atLiveTick.ok && stateHash(atLiveTick.world)).toBe(stateHash(runtime.world));
  });

  it('replays the commands of a tick that a snapshot split in two', () => {
    const { runtime, clock, deps } = aliceWorld();
    runTicks(runtime, clock, 5);
    expect(runtime.apply(road, 'id-alice').ok).toBe(true);
    runtime.snapshot();
    expect(runtime.apply(cottage, 'id-alice').ok).toBe(true);
    expect(runtime.apply(secondCottage, 'id-alice').ok).toBe(true);
    const recovered = recoverWorld(deps.store, runtime.id, null);
    expect(recovered.ok && [stateHash(recovered.world), recovered.lastSequence]).toEqual([stateHash(runtime.world), 4]);
  });

  it('writes no event twice', () => {
    const { runtime, clock, deps, db } = aliceWorld();
    runtime.apply(road, 'id-alice');
    runtime.apply(cottage, 'id-alice');
    runTicks(runtime, clock, 200);
    const count = () => db.prepare('SELECT COUNT(*) AS n FROM events').get();
    const before = count();
    expect(before).not.toEqual({ n: 1 });
    recoverWorld(deps.store, runtime.id, runtime.world.tick);
    expect(count()).toEqual(before);
  });

  it('refuses to replay commands logged under another sim version or other content', () => {
    const { runtime, deps } = aliceWorld();
    const logged = { tick: 0, accountId: null, command: JSON.stringify(road) };
    deps.store.insertCommand(runtime.id, { ...logged, sequence: 2, simVersion: SIM_VERSION - 1, contentHash: CONTENT_HASH }, 0);
    expect(recoverWorld(deps.store, runtime.id, null)).toEqual({
      ok: false,
      reason: expect.stringMatching(/^replay refused: command 2 and later were applied by sim version 1 /),
    });

    const other = aliceWorld();
    other.deps.store.insertCommand(other.runtime.id, { ...logged, sequence: 2, simVersion: SIM_VERSION, contentHash: 'retuned' }, 0);
    expect(recoverWorld(other.deps.store, other.runtime.id, null)).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/with content retuned; run that version once/),
    });
  });

  it('refuses a snapshot the sim cannot load', () => {
    const { runtime, deps } = aliceWorld();
    const broken = { tick: 0, lastSequence: 1, simVersion: SIM_VERSION, contentHash: CONTENT_HASH, state: '{"simVersion":2}' };
    deps.store.insertSnapshot(runtime.id, broken, 0);
    expect(recoverWorld(deps.store, runtime.id, null)).toMatchObject({ ok: false, reason: expect.stringMatching(/^snapshot refused: /) });
  });

  it('refuses a log whose commands the sim no longer accepts', () => {
    const { runtime, deps } = aliceWorld();
    const collect: Command = { type: 'collect', slot: 0, goal: 'first-farm' };
    deps.store.insertCommand(
      runtime.id,
      { sequence: 2, tick: 0, accountId: 'id-alice', simVersion: SIM_VERSION, contentHash: CONTENT_HASH, command: JSON.stringify(collect) },
      0,
    );
    expect(recoverWorld(deps.store, runtime.id, null)).toEqual({
      ok: false,
      reason: 'replay failed: command 2 was refused on replay (no-reward)',
    });
  });
});
