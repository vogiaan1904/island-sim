import { describe, expect, it } from 'vitest';
import { SMALL, building, islandOf, smallWorld } from '../test/fixtures.ts';
import { applyCommand } from './commands/apply.ts';
import type { Command } from './commands/types.ts';
import { checkInvariants } from './invariants.ts';
import { tickWorld } from './tick.ts';

const cottage: Command = { type: 'place-building', slot: 0, building: 'cottage', x: 2, y: 2, rotation: 0 };

describe('checkInvariants', () => {
  it('finds nothing wrong after a normal command and tick', () => {
    const world = smallWorld();
    const beforeCommand = structuredClone(world);
    const result = applyCommand(world, SMALL, cottage, { sequence: 1 });
    expect(result.ok && checkInvariants(beforeCommand, world, result.ledger, SMALL)).toEqual([]);
    const beforeTick = structuredClone(world);
    const { ledger } = tickWorld(world, SMALL);
    expect(checkInvariants(beforeTick, world, ledger, SMALL)).toEqual([]);
  });

  it('catches money that changed outside the ledger or went below zero', () => {
    const world = smallWorld();
    const before = structuredClone(world);
    islandOf(world, 0).coinsCents = -5;
    expect(checkInvariants(before, world, [], SMALL).map((v) => v.message)).toEqual(
      expect.arrayContaining(['money below zero', 'money changed outside the ledger']),
    );
  });

  it('catches goods that appear or vanish outside the ledger, wherever they are held', () => {
    const world = smallWorld();
    const island = islandOf(world, 0);
    island.buildings.push(building('warehouse', 1, 2, 4), building('island-hall', 2, 4, 4, { constructionLeft: 1_440 }));
    world.nextId = 3;
    const before = structuredClone(world);
    island.buildings[0]!.stock = { wood: 5 };
    expect(checkInvariants(before, world, [], SMALL).map((v) => v.message)).toEqual(['wood changed outside the ledger']);
    const ledger = [{ kind: 'goods' as const, slot: 0, good: 'wood' as const, delta: 5, reason: 'produced' as const }];
    expect(checkInvariants(before, world, ledger, SMALL)).toEqual([]);
    island.cargo.push({ good: 'wood', amount: 2, to: 2 });
    expect(checkInvariants(before, world, ledger, SMALL).map((v) => v.message)).toEqual(['wood changed outside the ledger']);
  });

  it('catches buildings that overlap, sit on a road or stand in the water', () => {
    const world = smallWorld();
    islandOf(world, 0).buildings.push(
      building('cottage', 1, 2, 2),
      building('cottage', 2, 2, 2),
      building('cottage', 3, 3, 3),
      building('cottage', 4, 0, 0),
    );
    world.nextId = 5;
    expect(checkInvariants(structuredClone(world), world, [], SMALL).map((v) => v.message)).toEqual([
      'buildings 1 and 2 overlap',
      'building 3 sits on a road',
      'building 4 is off the land at 0,0',
    ]);
  });

  it('reports state the sim must never hold, through validateWorld', () => {
    const world = smallWorld();
    const before = structuredClone(world);
    islandOf(world, 0).roads = `1${islandOf(world, 0).roads.slice(1)}`;
    islandOf(world, 0).buildings.push({ ...building('cottage', 1, 2, 2), type: 'castle' as 'cottage' });
    world.nextId = 2;
    const messages = checkInvariants(before, world, [], SMALL).map((v) => v.message).join('\n');
    expect(messages).toMatch(/road on water/);
    expect(messages).toMatch(/unknown building type/);
  });

  it('catches a tick that jumps by more than one', () => {
    const world = smallWorld();
    const before = structuredClone(world);
    world.tick += 5;
    expect(checkInvariants(before, world, [], SMALL).map((v) => v.message)).toContain('tick moved by 5');
  });
});
