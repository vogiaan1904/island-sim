import { content, type BuildingId } from '@island/content';
import { applyCommand, stateHash, type Rotation, type WorldState } from '@island/sim';
import { describe, expect, it } from 'vitest';
import { aliceWorld, islandOf } from '../test/islands.ts';
import { worldWithRoad as withRoad } from '../test/placement.ts';
import { buildingOptions, buildingVerdict } from './verdict.ts';

// The sim's own commands build the islands here (seed 42, Alice's dock at 12,26), and the sim's own place-building
// decides what the verdict must agree with.

/** What the sim's command answers on this world. It runs on a copy, since a taken command changes the world. */
function simSays(world: WorldState, building: BuildingId, x: number, y: number, rotation: Rotation, copy = structuredClone(world)) {
  return applyCommand(copy, content, { type: 'place-building', slot: 0, building, x, y, rotation }, { sequence: 9 });
}

describe('the placement verdict', () => {
  it('passes a spot beside the road and gives the command the server takes', () => {
    const world = withRoad();
    const verdict = buildingVerdict(islandOf(world), content, { building: 'cottage', x: 34, y: 55, rotation: 0 });
    expect(verdict.ok).toBe(true);
    expect(verdict.command).toEqual({ type: 'place-building', building: 'cottage', x: 34, y: 55, rotation: 0 });
    expect(verdict.costCents).toBe(20_000);
    expect(verdict.shortfallCents).toBe(0);
    expect(verdict.reason).toBeNull();
    expect(verdict.labels.every((label) => label.ok)).toBe(true);
    expect(simSays(world, 'cottage', 34, 55, 0).ok).toBe(true);
  });

  it('lays a road to the dock where none is beside it, and prices it with the building', () => {
    const world = aliceWorld();
    const verdict = buildingVerdict(islandOf(world), content, { building: 'cottage', x: 34, y: 55, rotation: 0 });
    expect(verdict.ok).toBe(true);
    expect(verdict.labels.find((label) => label.id === 'road-access')).toEqual({ id: 'road-access', ok: true, text: 'Road to the dock: 2 tiles' });
    expect(verdict.connector).toHaveLength(2);
    expect(verdict.costCents).toBe(20_000 + 2 * content.rules.roadPricePerTileCents);
    const copy = structuredClone(world);
    const sim = simSays(world, 'cottage', 34, 55, 0, copy);
    expect(sim.ok && sim.ledger.reduce((sum, entry) => sum - (entry.kind === 'money' ? entry.deltaCents : 0), 0)).toBe(verdict.costCents);
    expect(verdict.connector.every((tile) => islandOf(copy).roads[tile] === '1')).toBe(true);
  });

  it('says "Road access" beside a road joined to the dock, and what is wrong when no road can reach it', () => {
    const joined = buildingVerdict(islandOf(withRoad()), content, { building: 'cottage', x: 34, y: 55, rotation: 0 });
    expect(joined.labels.find((label) => label.id === 'road-access')).toEqual({ id: 'road-access', ok: true, text: 'Road access' });
    expect(joined.connector).toEqual([]);
    const world = aliceWorld();
    islandOf(world).buildings = islandOf(world).buildings.filter((building) => building.type !== 'dock');
    const cut = buildingVerdict(islandOf(world), content, { building: 'cottage', x: 34, y: 55, rotation: 0 });
    expect(cut.ok).toBe(false);
    expect(cut.reason).toBe('no-road-access');
    expect(cut.labels.find((label) => label.id === 'road-access')).toEqual({ id: 'road-access', ok: false, text: 'No road can reach the dock' });
    expect(simSays(world, 'cottage', 34, 55, 0)).toMatchObject({ ok: false, reason: 'no-road-access' });
  });

  it('says "Need N more coins" from the shortfall, in whole coins', () => {
    const world = withRoad();
    islandOf(world).coinsCents = 15_050;
    const verdict = buildingVerdict(islandOf(world), content, { building: 'cottage', x: 34, y: 55, rotation: 0 });
    expect(verdict.ok).toBe(false);
    expect(verdict.shortfallCents).toBe(4_950);
    expect(verdict.reason).toBe('not-enough-coins');
    expect(verdict.labels.find((label) => label.id === 'affordable')?.text).toBe('Need 50 more coins');
  });

  it('rounds a part coin up when it says how many are missing', () => {
    const world = withRoad();
    islandOf(world).coinsCents = 19_999;
    const verdict = buildingVerdict(islandOf(world), content, { building: 'cottage', x: 34, y: 55, rotation: 0 });
    expect(verdict.labels.find((label) => label.id === 'affordable')?.text).toBe('Need 1 more coin');
  });

  it('names a tile that is off the island, in the water, or taken', () => {
    const world = withRoad();
    const island = islandOf(world);
    expect(buildingVerdict(island, content, { building: 'cottage', x: 70, y: 3, rotation: 0 }).reason).toBe('out-of-bounds');
    expect(buildingVerdict(island, content, { building: 'cottage', x: 0, y: 0, rotation: 0 }).reason).toBe('bad-terrain');
    const onRoad = buildingVerdict(island, content, { building: 'cottage', x: 33, y: 50, rotation: 0 });
    expect(onRoad.reason).toBe('tile-occupied');
    expect(onRoad.labels.find((label) => label.id === 'free')?.ok).toBe(false);
  });

  // Every tile around the dock and the road, and every fourth tile elsewhere, for every rotation and building.
  it('agrees with the sim command on the tiles and rotations around the road, for every building the player can place', () => {
    const world = withRoad();
    const island = islandOf(world);
    island.stage = 'settlement';
    island.unlockedLandmarks.push('island-hall');
    const before = stateHash(world);
    const disagreements: string[] = [];
    for (const def of content.buildings.filter((d) => d.playerBuildable)) {
      for (const rotation of [0, 1, 2, 3] as Rotation[]) {
        for (let y = 0; y < content.rules.islandSize; y += 1) {
          for (let x = 0; x < content.rules.islandSize; x += 1) {
            const nearRoad = x >= 26 && x <= 40 && y >= 40 && y <= 60;
            if (!nearRoad && (x % 4 !== 0 || y % 4 !== 0)) continue;
            const verdict = buildingVerdict(island, content, { building: def.id, x, y, rotation });
            // A refused command leaves the world as it was (checked below), so only a taken one needs its own copy.
            const sim = verdict.ok ? simSays(world, def.id, x, y, rotation) : simSays(world, def.id, x, y, rotation, world);
            if (verdict.ok !== sim.ok || (!sim.ok && verdict.reason !== sim.reason)) {
              disagreements.push(`${def.id} ${x},${y} r${rotation}: verdict ${verdict.reason ?? 'ok'}, sim ${sim.ok ? 'ok' : sim.reason}`);
            }
          }
        }
      }
    }
    expect(disagreements).toEqual([]);
    expect(stateHash(world)).toBe(before);
  }, 30_000);

  it('agrees with the sim when the player cannot afford it', () => {
    const world = withRoad();
    islandOf(world).coinsCents = 100;
    const verdict = buildingVerdict(islandOf(world), content, { building: 'cottage', x: 34, y: 55, rotation: 0 });
    const sim = simSays(world, 'cottage', 34, 55, 0);
    expect(sim.ok).toBe(false);
    expect(verdict.reason).toBe(sim.ok ? null : sim.reason);
    expect(verdict.shortfallCents).toBe(sim.ok ? 0 : sim.shortfallCents);
  });

  it('blocks a landmark that is still locked, as the sim does', () => {
    const world = withRoad();
    const island = islandOf(world);
    island.coinsCents = 1_000_000;
    island.stage = 'settlement';
    const locked = buildingVerdict(island, content, { building: 'island-hall', x: 34, y: 50, rotation: 0 });
    const sim = simSays(world, 'island-hall', 34, 50, 0);
    expect(sim.ok).toBe(false);
    expect(locked.ok).toBe(false);
    expect(locked.reason).toBe(sim.ok ? null : sim.reason);
    expect(locked.reason).toBe('landmark-locked');
    expect(locked.labels).toEqual([{ id: 'locked', ok: false, text: 'Unlocks with 10 residents' }]);
  });

  it('refuses the dock, which the game places itself', () => {
    const verdict = buildingVerdict(islandOf(withRoad()), content, { building: 'dock', x: 5, y: 5, rotation: 0 });
    expect(verdict.ok).toBe(false);
    expect(verdict.command).toBeNull();
    expect(verdict.reason).toBe('not-player-buildable');
  });
});

describe('the Build picker options', () => {
  it('lists the buildings the player can place with their cost, in content order, without the dock', () => {
    const options = buildingOptions(islandOf(withRoad()), content);
    expect(options.map((option) => option.id)).toEqual(content.buildings.filter((d) => d.playerBuildable).map((d) => d.id));
    expect(options.find((option) => option.id === 'farm')).toMatchObject({ name: 'Farm', coins: 400, state: { kind: 'ready' } });
  });

  it('says how many coins an unaffordable building is short', () => {
    const world = withRoad();
    islandOf(world).coinsCents = 39_000;
    const farm = buildingOptions(islandOf(world), content).find((option) => option.id === 'farm');
    expect(farm?.state).toEqual({ kind: 'short', coins: 10, text: 'Need 10 more coins' });
  });

  it('says what unlocks a locked landmark, and lets it through once unlocked', () => {
    const world = withRoad();
    const island = islandOf(world);
    expect(buildingOptions(island, content).find((option) => option.id === 'island-hall')?.state).toEqual({ kind: 'locked', text: 'Unlocks with 10 residents' });
    island.unlockedLandmarks.push('island-hall');
    expect(buildingOptions(island, content).find((option) => option.id === 'island-hall')?.state.kind).toBe('ready');
  });
});
