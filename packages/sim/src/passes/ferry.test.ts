import { describe, expect, it } from 'vitest';
import { SMALL, islandOf, nextTickAt, smallWorld } from '../../test/fixtures.ts';
import { applyCommand } from '../commands/apply.ts';
import type { WorldState } from '../state.ts';
import { tickWorld } from '../tick.ts';

function worldBefore(minute: number, coinsCents = 500_000): WorldState {
  return nextTickAt(smallWorld(undefined, coinsCents), minute);
}

describe('the commuter ferry', () => {
  it('brings the hired commuters in the morning and they are paid as they board', () => {
    const world = worldBefore(420);
    islandOf(world, 0).commuters.hired = 5;
    const { ledger, events } = tickWorld(world, SMALL);
    expect(islandOf(world, 0).commuters).toEqual({ hired: 5, present: 5 });
    expect(ledger).toEqual([{ kind: 'money', slot: 0, deltaCents: -7_500, reason: 'wages' }]);
    expect(events).toEqual([]);
    expect(islandOf(world, 0).coinsCents).toBe(492_500);
  });

  it('brings fewer when the island cannot pay them all, and never goes below zero', () => {
    const world = worldBefore(420, 4_000);
    islandOf(world, 0).commuters.hired = 5;
    const { events } = tickWorld(world, SMALL);
    expect(islandOf(world, 0).commuters.present).toBe(2);
    expect(islandOf(world, 0).coinsCents).toBe(1_000);
    expect(events).toMatchObject([{ type: 'commuters-stayed-home', data: { count: 3, short: 'money' } }]);
  });

  it('brings nobody without money, and nobody comes at other times of day', () => {
    const broke = worldBefore(420, 0);
    islandOf(broke, 0).commuters.hired = 3;
    tickWorld(broke, SMALL);
    expect(islandOf(broke, 0).commuters.present).toBe(0);
    const noon = worldBefore(720);
    islandOf(noon, 0).commuters.hired = 3;
    tickWorld(noon, SMALL);
    expect(islandOf(noon, 0).commuters.present).toBe(0);
  });

  it('lets the island spend its last coin on wages', () => {
    const world = worldBefore(420, 3_000);
    islandOf(world, 0).commuters.hired = 2;
    tickWorld(world, SMALL);
    expect(islandOf(world, 0).commuters.present).toBe(2);
    expect(islandOf(world, 0).coinsCents).toBe(0);
  });

  it('keeps dismissed commuters until the evening ferry, and none come the next morning', () => {
    const world = worldBefore(420);
    islandOf(world, 0).commuters.hired = 3;
    tickWorld(world, SMALL);
    expect(applyCommand(world, SMALL, { type: 'hire-commuters', slot: 0, count: 0 }, { sequence: 1 }).ok).toBe(true);
    for (let i = 0; i < 300; i += 1) tickWorld(world, SMALL);
    expect(islandOf(world, 0).commuters).toEqual({ hired: 0, present: 3 });
    const coins = islandOf(world, 0).coinsCents;
    for (let i = 0; i < 1_140; i += 1) tickWorld(world, SMALL);
    expect(islandOf(world, 0).commuters.present).toBe(0);
    expect(islandOf(world, 0).coinsCents).toBe(coins);
  });

  it('takes everyone home in the evening', () => {
    const world = worldBefore(1020);
    islandOf(world, 0).commuters = { hired: 4, present: 4 };
    tickWorld(world, SMALL);
    expect(islandOf(world, 0).commuters).toEqual({ hired: 4, present: 0 });
  });
});
