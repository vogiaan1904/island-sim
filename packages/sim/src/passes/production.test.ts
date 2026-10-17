import { describe, expect, it } from 'vitest';
import { SMALL, buildingOf, islandOf, village } from '../../test/fixtures.ts';
import type { LedgerEntry } from '../ledger.ts';
import { tickWorld } from '../tick.ts';
import type { WorldState } from '../state.ts';

function run(world: WorldState, ticks: number): LedgerEntry[] {
  const ledger: LedgerEntry[] = [];
  for (let i = 0; i < ticks; i += 1) ledger.push(...tickWorld(world, SMALL).ledger);
  return ledger.filter((entry) => entry.kind === 'goods');
}

describe('production', () => {
  it('makes one cycle of output per cycle time at full rate', () => {
    const world = village(430);
    islandOf(world, 0).commuters.present = 1;
    expect(run(world, 29)).toEqual([]);
    expect(run(world, 1)).toEqual([{ kind: 'goods', slot: 0, good: 'vegetables', delta: 1, reason: 'produced' }]);
  });

  it('runs slower when understaffed: two of four jobs take twice as long', () => {
    const world = village(430);
    buildingOf(world, 1).home = { residents: 0, happiness: 1000, unmetNeeds: [] };
    islandOf(world, 0).commuters.present = 2;
    expect(run(world, 59).filter((e) => e.kind === 'goods' && e.good === 'vegetables')).toEqual([]);
    expect(run(world, 1)).toMatchObject([{ good: 'vegetables', delta: 1 }]);
  });

  it('stops at a full cycle when the output would not fit, and throws nothing away', () => {
    const world = village(430);
    islandOf(world, 0).commuters.present = 1;
    buildingOf(world, 4).stock = { wood: 30 };
    const farm = buildingOf(world, 2);
    farm.stock = { vegetables: 10 };
    run(world, 40);
    expect(farm.stock).toEqual({ vegetables: 10 });
    expect(farm.work?.progress).toBe(30_000);
    expect(farm.conditions).toEqual(['output-full']);
  });

  it('makes nothing at night or while waiting for money', () => {
    const night = village(1030);
    islandOf(night, 0).commuters.present = 4;
    expect(run(night, 120)).toEqual([]);
    const broke = village(480, 0);
    buildingOf(broke, 1).home = { residents: 0, happiness: 1000, unmetNeeds: [] };
    islandOf(broke, 0).commuters.present = 4;
    expect(run(broke, 120)).toEqual([]);
  });
});
