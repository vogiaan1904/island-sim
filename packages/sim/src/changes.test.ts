import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { FIRST_BUILDINGS } from '../test/scenarios.ts';
import { SMALL, buildingOf, village } from '../test/fixtures.ts';
import { applyChanges, captureEntities, diffEntities, worldEntities } from './changes.ts';
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

  it('send removed entities by key, and copies that later ticks cannot change', () => {
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

  it('send nothing for a world with no claimed island between hours', () => {
    const world = createWorld(3, content);
    world.tick = 1;
    const capture = captureEntities(world);
    tickWorld(world, content);
    expect(diffEntities(capture, world).changes).toEqual({ changed: [], removed: [] });
  });
});
