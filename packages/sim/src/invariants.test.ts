import { describe, expect, it } from 'vitest';
import { SMALL, islandOf, smallWorld } from '../test/fixtures.ts';
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
    expect(checkInvariants(before, world, [], SMALL).map((v) => v.message)).toEqual([
      'money below zero',
      'money changed outside the ledger',
    ]);
  });

  it('catches buildings that overlap, sit on a road or stand in the water', () => {
    const world = smallWorld();
    islandOf(world, 0).buildings.push(
      { id: 1, type: 'cottage', x: 2, y: 2, rotation: 0, constructionLeft: 0 },
      { id: 2, type: 'cottage', x: 2, y: 2, rotation: 0, constructionLeft: 0 },
      { id: 3, type: 'cottage', x: 3, y: 3, rotation: 0, constructionLeft: 0 },
      { id: 4, type: 'cottage', x: 0, y: 0, rotation: 0, constructionLeft: 0 },
    );
    world.nextId = 5;
    expect(checkInvariants(structuredClone(world), world, [], SMALL).map((v) => v.message)).toEqual([
      'buildings 1 and 2 overlap',
      'building 3 sits on a road',
      'building 4 is off the land at 0,0',
    ]);
  });
});
