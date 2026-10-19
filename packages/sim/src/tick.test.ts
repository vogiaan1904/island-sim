import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { DEFAULT_MAP, SMALL, building, dockedWorld, islandOf, paint, smallWorld } from '../test/fixtures.ts';
import { applyCommand } from './commands/apply.ts';
import type { Command } from './commands/types.ts';
import type { WorldState } from './state.ts';
import { tickWorld } from './tick.ts';
import { createWorld } from './world.ts';

function placeCottage(world: WorldState, slot: number, sequence: number) {
  const command: Command = { type: 'place-building', slot, building: 'cottage', x: 2, y: 2, rotation: 0 };
  expect(applyCommand(world, SMALL, command, { sequence }).ok).toBe(true);
}

describe('tickWorld', () => {
  it('advances the tick by one game minute', () => {
    const world = createWorld(3, content);
    expect(tickWorld(world, content)).toEqual({ ledger: [], events: [] });
    expect(world.tick).toBe(1);
  });

  it('finishes construction after its build ticks, with an event from the tick', () => {
    const world = dockedWorld();
    placeCottage(world, 0, 1);
    for (let i = 0; i < 119; i += 1) expect(tickWorld(world, SMALL).events).toEqual([]);
    expect(islandOf(world, 0).buildings[1]?.constructionLeft).toBe(1);
    expect(tickWorld(world, SMALL).events).toEqual([
      { tick: 120, source: 0, index: 0, type: 'construction-finished', slot: 0, data: { buildingId: 2, building: 'cottage' } },
    ]);
    expect(islandOf(world, 0).buildings[1]?.constructionLeft).toBe(0);
    expect(world.tick).toBe(120);
  });

  it('numbers one tick\'s events across islands in slot order', () => {
    const world = dockedWorld();
    const bob = islandOf(world, 1);
    paint(bob, DEFAULT_MAP);
    bob.owner = 'bob';
    bob.name = 'Coral Bay';
    bob.coinsCents = 500_000;
    bob.buildings.push(building('dock', 2, 5, 1));
    world.nextId = 3;
    placeCottage(world, 1, 1);
    placeCottage(world, 0, 2);
    let events = tickWorld(world, SMALL).events;
    while (events.length === 0) events = tickWorld(world, SMALL).events;
    expect(events.map((e) => [e.slot, e.index, e.data.buildingId])).toEqual([
      [0, 0, 4],
      [1, 1, 3],
    ]);
  });

  it('does not simulate empty slots', () => {
    const world = smallWorld();
    const empty = islandOf(world, 1);
    empty.buildings.push(building('cottage', 9, 2, 2, { constructionLeft: 5 }));
    tickWorld(world, SMALL);
    expect(empty.buildings[0]?.constructionLeft).toBe(5);
  });
});
