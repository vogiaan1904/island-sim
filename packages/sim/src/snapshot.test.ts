import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { SMALL, smallWorld } from '../test/fixtures.ts';
import { newBuilding } from './buildings.ts';
import { applyCommand } from './commands/apply.ts';
import { stateHash } from './hash.ts';
import { buildingDefOf } from './lookup.ts';
import { SnapshotError, loadWorld, serializeWorld, type SnapshotErrorCode } from './snapshot.ts';
import { SIM_VERSION } from './version.ts';
import { createWorld, emptyIsland, newMarket } from './world.ts';

function codeOf(load: () => unknown): SnapshotErrorCode | 'no-error' {
  try {
    load();
    return 'no-error';
  } catch (error) {
    if (error instanceof SnapshotError) return error.code;
    throw error;
  }
}

function claimedWorld() {
  const world = createWorld(5, content);
  applyCommand(world, content, { type: 'claim-island', owner: 'alice', name: 'Palm Cove' }, { sequence: 1 });
  return world;
}

describe('snapshots', () => {
  it('round-trip a world exactly', () => {
    const world = claimedWorld();
    const loaded = loadWorld(serializeWorld(world), content);
    expect(loaded).toEqual(world);
    expect(stateHash(loaded)).toBe(stateHash(world));
  });

  it('refuse a snapshot from a newer sim version', () => {
    const json = serializeWorld({ ...claimedWorld(), simVersion: SIM_VERSION + 1 });
    expect(codeOf(() => loadWorld(json, content))).toBe('newer-sim-version');
  });

  it('refuse things that are not snapshots', () => {
    expect(codeOf(() => loadWorld('not json', content))).toBe('not-a-snapshot');
    expect(codeOf(() => loadWorld('[]', content))).toBe('not-a-snapshot');
    expect(codeOf(() => loadWorld('{}', content))).toBe('not-a-snapshot');
  });

  it('refuse fractions and other data the sim never stores', () => {
    const json = serializeWorld(claimedWorld()).replace('"coinsCents":500000', '"coinsCents":1.5');
    expect(codeOf(() => loadWorld(json, content))).toBe('invalid-data');
  });

  it('refuse snapshots whose shape is broken', () => {
    expect(codeOf(() => loadWorld(`{"simVersion":${SIM_VERSION}}`, content))).toBe('invalid-data');
    const json = serializeWorld(claimedWorld());
    expect(codeOf(() => loadWorld(json.replace('"type":"dock"', '"type":"castle"'), content))).toBe('invalid-data');
    expect(codeOf(() => loadWorld(json.replace('"roads":"0', '"roads":"'), content))).toBe('invalid-data');
  });

  it('report a migration that throws as migration-failed', () => {
    const json = serializeWorld(claimedWorld());
    const failing = () => {
      throw new Error('boom');
    };
    expect(codeOf(() => loadWorld(json, content, { [SIM_VERSION]: failing }, SIM_VERSION + 1))).toBe('migration-failed');
  });

  it('migrate older snapshots one version at a time', () => {
    const json = serializeWorld(claimedWorld());
    const migrations = { [SIM_VERSION]: (data: Record<string, unknown>) => ({ ...data, harbor: 7 }) };
    const migrated = loadWorld(json, content, migrations, SIM_VERSION + 1) as unknown as Record<string, unknown>;
    expect(migrated.simVersion).toBe(SIM_VERSION + 1);
    expect(migrated.harbor).toBe(7);
  });

  it('stop when a migration is missing', () => {
    const json = serializeWorld(claimedWorld());
    expect(codeOf(() => loadWorld(json, content, {}, SIM_VERSION + 1))).toBe('missing-migration');
  });
});

describe('migration from sim version 1', () => {
  it('adds the market, people, goods, staff and goals with their starting values', () => {
    const painted = smallWorld();
    const [alice, empty] = painted.islands;
    if (!alice || !empty) throw new Error('two slots expected');
    const v1 = {
      simVersion: 1,
      seed: 1,
      tick: 30,
      rng: 12345,
      nextId: 3,
      islands: [
        {
          slot: 0,
          position: alice.position,
          terrain: alice.terrain,
          roads: alice.roads,
          owner: 'alice',
          name: 'Test Isle',
          stage: 'outpost',
          coinsCents: 480_000,
          buildings: [
            { id: 1, type: 'dock', x: 1, y: 5, rotation: 0, constructionLeft: 0 },
            { id: 2, type: 'cottage', x: 2, y: 2, rotation: 0, constructionLeft: 90 },
          ],
          lastCheckInTick: 0,
        },
        {
          slot: 1,
          position: empty.position,
          terrain: empty.terrain,
          roads: empty.roads,
          owner: null,
          name: null,
          stage: 'outpost',
          coinsCents: 0,
          buildings: [],
          lastCheckInTick: null,
        },
      ],
    };
    const world = loadWorld(JSON.stringify(v1), SMALL);
    const cottage = { ...newBuilding(buildingDefOf(SMALL, 'cottage'), 2, 2, 2, 0), constructionLeft: 90 };
    expect(world).toEqual({
      simVersion: SIM_VERSION,
      seed: 1,
      tick: 30,
      rng: 12345,
      nextId: 4,
      market: newMarket(SMALL),
      islands: [
        {
          ...emptyIsland(0, alice.position, alice.terrain, 8),
          roads: alice.roads,
          owner: 'alice',
          name: 'Test Isle',
          coinsCents: 480_000,
          lastCheckInTick: 0,
          buildings: [newBuilding(buildingDefOf(SMALL, 'dock'), 1, 1, 5, 0), cottage],
          staff: [{ id: 3, role: 'port-master', name: 'Lena', look: 3 }],
        },
        emptyIsland(1, empty.position, empty.terrain, 8),
      ],
    });
  });

  it('reports version 1 data it cannot read as migration-failed', () => {
    expect(codeOf(() => loadWorld('{"simVersion":1}', content))).toBe('migration-failed');
  });
});

describe('migration from sim version 2', () => {
  it('changes nothing but the version: Mainland help adds a rule, not state', () => {
    const v3 = JSON.parse(serializeWorld(claimedWorld())) as Record<string, unknown>;
    const v2 = { ...v3, simVersion: 2 };
    const world = loadWorld(JSON.stringify(v2), content);
    expect(world).toEqual({ ...v3, simVersion: SIM_VERSION });
  });
});

describe('migration from sim version 3', () => {
  it('changes nothing but the version: waiting for money slows a building down, a rule and no state', () => {
    const v4 = JSON.parse(serializeWorld(claimedWorld())) as Record<string, unknown>;
    const v3 = { ...v4, simVersion: 3 };
    const world = loadWorld(JSON.stringify(v3), content);
    expect(world).toEqual({ ...v4, simVersion: SIM_VERSION });
  });
});

describe('migration from sim version 4', () => {
  it('gives every island an empty ferry manifest', () => {
    const v5 = JSON.parse(serializeWorld(claimedWorld())) as { islands: Array<Record<string, unknown>> };
    const islands = v5.islands.map(({ ferry: _ferry, ...rest }) => rest);
    const v4 = { ...v5, simVersion: 4, islands };
    const world = loadWorld(JSON.stringify(v4), content);
    expect(world).toEqual({ ...v5, simVersion: SIM_VERSION });
    expect(world.islands.every((island) => island.ferry === null)).toBe(true);
  });
});

describe('migration from sim version 5', () => {
  it('gives every island an empty sale manifest', () => {
    const v6 = JSON.parse(serializeWorld(claimedWorld())) as { islands: Array<Record<string, unknown>> };
    const islands = v6.islands.map(({ sales: _sales, ...rest }) => rest);
    const v5 = { ...v6, simVersion: 5, islands };
    const world = loadWorld(JSON.stringify(v5), content);
    expect(world).toEqual({ ...v6, simVersion: SIM_VERSION });
    expect(world.islands.every((island) => island.sales.length === 0)).toBe(true);
    expect(SIM_VERSION).toBe(6);
  });
});
