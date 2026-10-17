import { describe, expect, it } from 'vitest';
import { stateHash } from '../src/index.ts';
import { replay, runScript } from './harness.ts';
import { FIRST_BUILDINGS } from './scenarios.ts';

describe('determinism', () => {
  it('gives the same state hash after every tick for the same seed and commands', () => {
    const a = runScript(42, FIRST_BUILDINGS, 600);
    const b = runScript(42, FIRST_BUILDINGS, 600);
    expect(a.tickHashes).toHaveLength(600);
    expect(a.tickHashes).toEqual(b.tickHashes);
  });

  it('keeps every invariant after every command and tick', () => {
    expect(() => runScript(42, FIRST_BUILDINGS, 600, { checkInvariants: true })).not.toThrow();
  });
});

describe('replay', () => {
  for (const snapshotAtTick of [0, 25, 65, 200]) {
    it(`rebuilds the live world from a snapshot at tick ${snapshotAtTick} plus the command log`, () => {
      const live = runScript(42, FIRST_BUILDINGS, 600, { snapshotAtTick });
      if (!live.snapshot) throw new Error('no snapshot taken');
      const rebuilt = replay(live.snapshot, live.log, 600);
      expect(stateHash(rebuilt)).toBe(stateHash(live.world));
    });
  }
});
