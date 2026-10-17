import type { Content } from '@island/content';
import { isValidIslandName } from './commands/claimIsland.ts';
import { WATER } from './grid.ts';
import { findBuildingDef } from './lookup.ts';
import { footprintSize } from './placement.ts';
import type { Rotation } from './state.ts';

// The shape every world must have for this content. loadWorld refuses snapshots that break it, and checkInvariants
// runs it after every command and tick in tests, so damaged data is refused with a reason instead of failing later.

const UINT32_MAX = 0xffffffff;
const MAX_OWNER_LENGTH = 64;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isWhole = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && !Object.is(value, -0);

const isRotation = (value: unknown): value is Rotation => value === 0 || value === 1 || value === 2 || value === 3;

/** Every problem found in data that claims to be a world for this content; empty when the world is valid. */
export function validateWorld(data: unknown, content: Content): string[] {
  if (!isRecord(data)) return ['world is not an object'];
  const problems: string[] = [];
  for (const key of ['simVersion', 'tick', 'nextId']) {
    const value = data[key];
    if (!isWhole(value) || value < 0) problems.push(`${key} must be a whole number >= 0`);
  }
  for (const key of ['seed', 'rng']) {
    const value = data[key];
    if (!isWhole(value) || value < 0 || value > UINT32_MAX) problems.push(`${key} must be a whole number from 0 to 2^32 - 1`);
  }
  const islands = data.islands;
  if (!Array.isArray(islands)) problems.push('islands must be a list');
  else if (islands.length !== content.rules.slotCount) problems.push(`islands must hold ${content.rules.slotCount} slots`);
  if (problems.length > 0 || !Array.isArray(islands)) return problems;

  const tick = data.tick as number;
  const nextId = data.nextId as number;
  const owners = new Set<string>();
  const ids = new Set<number>();
  islands.forEach((island: unknown, slot: number) => {
    validateIsland(island, slot, { content, tick, nextId, owners, ids, problems });
  });
  return problems;
}

interface Ctx {
  content: Content;
  tick: number;
  nextId: number;
  owners: Set<string>;
  ids: Set<number>;
  problems: string[];
}

function validateIsland(raw: unknown, slot: number, ctx: Ctx): void {
  const { content, problems } = ctx;
  const at = `island ${slot}`;
  if (!isRecord(raw)) {
    problems.push(`${at}: not an object`);
    return;
  }
  const size = content.rules.islandSize;
  const tiles = size * size;
  if (raw.slot !== slot) problems.push(`${at}: slot must be ${slot}`);
  const position = raw.position;
  if (!isRecord(position) || !isWhole(position.x) || !isWhole(position.y)) problems.push(`${at}: position must be whole x and y`);

  const terrain = raw.terrain;
  const roads = raw.roads;
  const terrainOk = typeof terrain === 'string' && terrain.length === tiles && /^[012]*$/.test(terrain);
  const roadsOk = typeof roads === 'string' && roads.length === tiles && /^[01]*$/.test(roads);
  if (!terrainOk) problems.push(`${at}: terrain must be ${tiles} characters of 0, 1 or 2`);
  if (!roadsOk) problems.push(`${at}: roads must be ${tiles} characters of 0 or 1`);
  if (terrainOk && roadsOk) {
    for (let i = 0; i < tiles; i += 1) {
      if (roads[i] === '1' && terrain[i] === WATER) {
        problems.push(`${at}: road on water at tile ${i}`);
        break;
      }
    }
  }

  if (!content.stages.some((stage) => stage.id === raw.stage)) problems.push(`${at}: unknown stage`);
  const coins = raw.coinsCents;
  if (!isWhole(coins) || coins < 0) problems.push(`${at}: coinsCents must be a whole number >= 0`);
  const lastCheckIn = raw.lastCheckInTick;
  if (lastCheckIn !== null && (!isWhole(lastCheckIn) || lastCheckIn < 0 || lastCheckIn > ctx.tick)) {
    problems.push(`${at}: lastCheckInTick must be null or a tick up to the current one`);
  }
  const buildings = raw.buildings;
  const owner = raw.owner;
  if (owner === null) {
    const empty = raw.name === null && coins === 0 && lastCheckIn === null && Array.isArray(buildings) && buildings.length === 0;
    if (!empty) problems.push(`${at}: an unclaimed island has no name, coins, check-ins or buildings`);
  } else if (typeof owner !== 'string' || owner.length === 0 || owner.length > MAX_OWNER_LENGTH) {
    problems.push(`${at}: owner must be null or an account id`);
  } else {
    if (ctx.owners.has(owner)) problems.push(`${at}: owner ${owner} already owns another island`);
    ctx.owners.add(owner);
    if (!isValidIslandName(raw.name, content.rules)) problems.push(`${at}: invalid island name`);
  }

  if (!Array.isArray(buildings)) {
    problems.push(`${at}: buildings must be a list`);
    return;
  }
  let lastId = 0;
  buildings.forEach((building: unknown, index: number) => {
    const where = `${at} building ${index}`;
    if (!isRecord(building)) {
      problems.push(`${where}: not an object`);
      return;
    }
    const id = building.id;
    if (!isWhole(id) || id <= lastId || id >= ctx.nextId) {
      problems.push(`${where}: id must increase and stay below nextId`);
    } else {
      if (ctx.ids.has(id)) problems.push(`${where}: id ${id} is used twice`);
      ctx.ids.add(id);
      lastId = id;
    }
    const def = findBuildingDef(content, building.type);
    if (!def) {
      problems.push(`${where}: unknown building type`);
      return;
    }
    if (!isRotation(building.rotation)) {
      problems.push(`${where}: rotation must be 0 to 3`);
      return;
    }
    const left = building.constructionLeft;
    if (!isWhole(left) || left < 0 || left > def.buildTicks) {
      problems.push(`${where}: constructionLeft must be from 0 to ${def.buildTicks}`);
    }
    const { w, h } = footprintSize(def, building.rotation);
    const { x, y } = building;
    if (!isWhole(x) || !isWhole(y) || x < 0 || y < 0 || x > size - w || y > size - h) {
      problems.push(`${where}: footprint is outside the map`);
    }
  });
}
