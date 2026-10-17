import { describe, expect, it } from 'vitest';
import { SMALL, buildingOf, islandOf, village } from '../../test/fixtures.ts';
import type { LedgerEntry } from '../ledger.ts';
import type { WorldState } from '../state.ts';
import { tickWorld } from '../tick.ts';

/** The village with nobody at home, so no rent comes in. */
function quiet(minute: number, coinsCents?: number): WorldState {
  const world = village(minute, coinsCents);
  buildingOf(world, 1).home = { residents: 0, happiness: 1000, unmetNeeds: [] };
  return world;
}

const upkeep = (ledger: LedgerEntry[]) => ledger.filter((e) => e.kind === 'money' && e.reason === 'upkeep');

describe('upkeep', () => {
  it('is paid every game hour by each built building', () => {
    const world = quiet(480);
    const { ledger } = tickWorld(world, SMALL);
    expect(upkeep(ledger)).toEqual([
      { kind: 'money', slot: 0, deltaCents: -20, reason: 'upkeep' },
      { kind: 'money', slot: 0, deltaCents: -20, reason: 'upkeep' },
    ]);
    expect(upkeep(tickWorld(world, SMALL).ledger)).toEqual([]);
  });

  it('makes buildings wait when money is short, higher priority paid first, and never below zero', () => {
    const world = quiet(480, 30);
    buildingOf(world, 3).priority = 2;
    tickWorld(world, SMALL);
    expect(islandOf(world, 0).coinsCents).toBe(10);
    expect(buildingOf(world, 3).upkeepDue).toBe(false);
    expect(buildingOf(world, 2).upkeepDue).toBe(true);
    expect(buildingOf(world, 2).conditions).toEqual(['waiting-for-money']);
  });

  it("lets the buildings spend the island's last coin", () => {
    const world = village(480, 40);
    const { ledger } = tickWorld(world, SMALL);
    const paid = ledger.filter((e) => e.kind === 'money' && e.reason === 'upkeep').map((e) => e.kind === 'money' && e.deltaCents);
    expect(paid).toEqual([-20, -20]);
    expect([buildingOf(world, 2).upkeepDue, buildingOf(world, 3).upkeepDue]).toEqual([false, false]);
  });

  it('recovers by itself once the money is there again', () => {
    const world = quiet(480, 0);
    tickWorld(world, SMALL);
    expect(buildingOf(world, 2).upkeepDue).toBe(true);
    islandOf(world, 0).coinsCents = 1_000;
    for (let i = 0; i < 60; i += 1) tickWorld(world, SMALL);
    expect(buildingOf(world, 2).upkeepDue).toBe(false);
  });

  it('is not charged while a building is under construction', () => {
    const world = quiet(480);
    buildingOf(world, 2).constructionLeft = 100;
    buildingOf(world, 3).constructionLeft = 100;
    expect(upkeep(tickWorld(world, SMALL).ledger)).toEqual([]);
  });
});
