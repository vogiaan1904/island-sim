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

  it('makes nothing at night', () => {
    const night = village(1030);
    islandOf(night, 0).commuters.present = 4;
    expect(run(night, 120)).toEqual([]);
  });

  describe('while waiting for money', () => {
    /** Nobody at home (no rent), no coins, four commuters: the farm is fully staffed and cannot pay its upkeep. */
    function broke(minute: number): WorldState {
      const world = village(minute, 0);
      buildingOf(world, 1).home = { residents: 0, happiness: 1000, unmetNeeds: [] };
      islandOf(world, 0).commuters.present = 4;
      buildingOf(world, 2).upkeepDue = true;
      return world;
    }
    const farm = (world: WorldState) => buildingOf(world, 2);

    it('keeps its workers and produces at waitingOutputPermille of the full rate: a 30 tick cycle takes 60', () => {
      expect(SMALL.rules.waitingOutputPermille).toBe(500);
      const world = broke(430);
      expect(run(world, 59)).toEqual([]);
      expect(farm(world).upkeepDue).toBe(true);
      expect(farm(world).work).toMatchObject({ commuters: 4, residents: 0 });
      expect(run(world, 1)).toEqual([{ kind: 'goods', slot: 0, good: 'vegetables', delta: 1, reason: 'produced' }]);
    });

    it('returns to the full rate after the first successful payment', () => {
      const world = broke(470);
      run(world, 20);
      expect(farm(world).upkeepDue).toBe(true); // 480 came and could not pay
      islandOf(world, 0).coinsCents = 100_000;
      run(world, 59);
      expect(farm(world).upkeepDue).toBe(false);
      run(world, 10);
      Object.assign(farm(world).work ?? {}, { progress: 0 });
      run(world, 1);
      expect(farm(world).work?.progress).toBe(1000);
    });

    it('still makes nothing in a building under construction', () => {
      const world = broke(430);
      farm(world).constructionLeft = 500;
      expect(run(world, 120).filter((e) => e.kind === 'goods' && e.good === 'vegetables')).toEqual([]);
    });
  });
});
