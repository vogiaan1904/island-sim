import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { FIRST_BUILDINGS, OUTPOST_TO_SETTLEMENT } from '../test/scenarios.ts';
import { SMALL, buildingOf, village } from '../test/fixtures.ts';
import { applyChanges, captureEntities, diffEntities, islandFromEntities, worldEntities } from './changes.ts';
import { applyCommand } from './commands/apply.ts';
import { tickWorld } from './tick.ts';
import { createWorld } from './world.ts';

/** Entities sorted by key, so a mirror built in another order still compares equal. */
const sorted = (entities: Map<string, unknown>) => new Map([...entities].sort(([a], [b]) => (a < b ? -1 : 1)));

describe('change sets', () => {
  it('keep a mirror equal to the world through commands and ticks', () => {
    const world = createWorld(42, content);
    const mirror = worldEntities(structuredClone(world));
    let capture = captureEntities(world);
    let sequence = 1;
    for (let tick = 0; tick <= 300; tick += 1) {
      for (const step of FIRST_BUILDINGS) {
        if (step.afterTick !== tick) continue;
        const result = applyCommand(world, content, step.command, { sequence });
        if (result.ok) sequence += 1;
        const diff = diffEntities(capture, world);
        applyChanges(mirror, diff.changes);
        capture = diff.capture;
      }
      tickWorld(world, content);
      const diff = diffEntities(capture, world);
      applyChanges(mirror, diff.changes);
      capture = diff.capture;
      expect(sorted(mirror)).toEqual(sorted(worldEntities(world)));
    }
  });

  it('send only what changed: a construction tick changes one building', () => {
    const world = village(1101);
    buildingOf(world, 2).constructionLeft = 50;
    const capture = captureEntities(world);
    tickWorld(world, SMALL);
    expect(diffEntities(capture, world).changes).toEqual({
      changed: [{ key: 'building/0/2', value: buildingOf(world, 2) }],
      removed: [],
    });
  });

  it('send the sale manifest with the island after a sale', () => {
    const world = village(600);
    buildingOf(world, 4).stock = { fish: 10 };
    const mirror = worldEntities(structuredClone(world));
    const capture = captureEntities(world);
    applyCommand(world, SMALL, { type: 'sell', slot: 0, good: 'fish', amount: 2 }, { sequence: 1 });
    applyChanges(mirror, diffEntities(capture, world).changes);
    expect(islandFromEntities(mirror, 0).sales).toEqual([{ tick: world.tick, good: 'fish', amount: 2 }]);
  });

  it('send removed entities by key', () => {
    const world = village(1100);
    buildingOf(world, 2).stock = { vegetables: 5 };
    let capture = captureEntities(world);
    tickWorld(world, SMALL);
    const first = diffEntities(capture, world);
    const sent = first.changes.changed.find((c) => c.key === 'transit/0/5');
    expect(sent?.value).toMatchObject({ good: 'vegetables', amount: 5 });
    capture = first.capture;
    tickWorld(world, SMALL);
    tickWorld(world, SMALL);
    expect(diffEntities(capture, world).changes.removed).toEqual(['transit/0/5']);
    expect(sent?.value).toMatchObject({ amount: 5 });
  });

  it('hold copies: changing the world after a diff leaves the sent value alone', () => {
    const world = village(1101);
    buildingOf(world, 2).constructionLeft = 50;
    const capture = captureEntities(world);
    tickWorld(world, SMALL);
    const sent = diffEntities(capture, world).changes.changed.find((c) => c.key === 'building/0/2');
    const before = structuredClone(sent?.value);
    expect(before).toMatchObject({ constructionLeft: expect.any(Number), priority: 1, stock: {} });
    const farm = buildingOf(world, 2);
    farm.priority = 3;
    farm.stock = { vegetables: 9 };
    farm.constructionLeft = 10;
    expect(sent?.value).toEqual(before);
  });

  it('compare the terrain and road strings as they are, without serializing them again', () => {
    const world = createWorld(42, content);
    const island = world.islands[0];
    expect(captureEntities(world).get('terrain/0')).toBe(island?.terrain);
    expect(captureEntities(world).get('roads/0')).toBe(island?.roads);
  });

  it('send nothing for a world with no claimed island between hours', () => {
    const world = createWorld(3, content);
    world.tick = 1;
    const capture = captureEntities(world);
    tickWorld(world, content);
    expect(diffEntities(capture, world).changes).toEqual({ changed: [], removed: [] });
  });
});

describe('the island from its entities', () => {
  it('equals the world island, from the entities and after a run of updates, at several points of the scenario', () => {
    const world = createWorld(42, content);
    const mirror = worldEntities(structuredClone(world));
    let capture = captureEntities(world);
    let sequence = 1;
    const checkpoints = new Set([0, 1, 400, 1500, 3000, 5000]);
    const publish = () => {
      const diff = diffEntities(capture, world);
      applyChanges(mirror, diff.changes);
      capture = diff.capture;
    };
    for (let tick = 0; tick <= 5000; tick += 1) {
      for (const step of OUTPOST_TO_SETTLEMENT) {
        if (step.afterTick !== tick) continue;
        if (applyCommand(world, content, step.command, { sequence }).ok) sequence += 1;
        publish();
      }
      if (checkpoints.has(tick)) {
        for (const island of world.islands) {
          expect(islandFromEntities(worldEntities(world), island.slot)).toEqual(island);
          expect(islandFromEntities(mirror, island.slot)).toEqual(island);
        }
      }
      tickWorld(world, content);
      publish();
    }
    expect(world.islands[0]?.buildings.length).toBeGreaterThan(5);
  }, 60_000);

  it('keeps buildings and shipments in id order whatever order the entities arrive in', () => {
    const world = village(1100);
    buildingOf(world, 2).stock = { vegetables: 5 };
    tickWorld(world, SMALL);
    const island = world.islands[0]!;
    expect(island.transit.length).toBeGreaterThan(0);
    const reversed = new Map([...worldEntities(world)].reverse());
    expect(islandFromEntities(reversed, island.slot)).toEqual(island);
  });

  it('does not alias the entities: changing the island leaves the mirror alone', () => {
    const world = createWorld(42, content);
    const mirror = worldEntities(world);
    const island = islandFromEntities(mirror, 0);
    island.roads = '0'.repeat(island.roads.length);
    island.name = 'changed';
    expect(mirror.get('roads/0')).toBe(world.islands[0]?.roads);
    expect(mirror.get('island/0')).toMatchObject({ name: world.islands[0]?.name });
  });

  it('refuses a missing or malformed entity with a clear error', () => {
    const world = village(1100);
    const base = worldEntities(world);
    const without = (key: string) => new Map([...base].filter(([k]) => k !== key));
    const patched = (key: string, value: unknown) => new Map(base).set(key, value);
    expect(() => islandFromEntities(without('island/0'), 0)).toThrow(/island\/0/);
    expect(() => islandFromEntities(without('terrain/0'), 0)).toThrow(/terrain\/0/);
    expect(() => islandFromEntities(without('roads/0'), 0)).toThrow(/roads\/0/);
    expect(() => islandFromEntities(base, 7)).toThrow(/island\/7/);
    expect(() => islandFromEntities(patched('terrain/0', 42), 0)).toThrow(/terrain\/0/);
    expect(() => islandFromEntities(patched('roads/0', '01'), 0)).toThrow(/roads\/0/);
    expect(() => islandFromEntities(patched('island/0', null), 0)).toThrow(/island\/0/);
    expect(() => islandFromEntities(patched('island/0', { slot: 1 }), 0)).toThrow(/island\/0/);
    expect(() => islandFromEntities(patched('building/0/2', 'x'), 0)).toThrow(/building\/0\/2/);
    expect(() => islandFromEntities(patched('building/0/2', { id: 9 }), 0)).toThrow(/building\/0\/2/);
    expect(() => islandFromEntities(patched('transit/0/1', []), 0)).toThrow(/transit\/0\/1/);
    expect(() => islandFromEntities(patched('building/0/x', {}), 0)).toThrow(/building\/0\/x/);
  });
});
