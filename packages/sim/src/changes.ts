import { canonicalJson } from './hash.ts';
import type { BuildingState, IslandState, ShipmentState, WorldState } from './state.ts';

// Changes for the server to send (spec 5.3, 12.2). The world is a set of entities with stable keys:
//   island/<slot>             the island without its terrain, roads, buildings and goods on the roads
//   terrain/<slot>, roads/<slot>
//   building/<slot>/<id>, transit/<slot>/<id>
//   market
// The full state of an island is its entities plus the market; after a tick or a command, only the entities whose
// canonical JSON changed are sent whole, and removed ones by key. The seed, the random stream and the id counter
// stay on the server.

export interface EntityChange {
  key: string;
  value: unknown;
}

export interface WorldChanges {
  changed: EntityChange[];
  removed: string[];
}

/** Each entity's fingerprint, by key: what a later diff compares against. */
export type EntityCapture = ReadonlyMap<string, string>;

/** The terrain and road strings as they are, so the largest entities are never re-serialized; the rest as canonical JSON. */
function fingerprint(value: unknown): string {
  return typeof value === 'string' ? value : canonicalJson(value);
}

/** Every entity of the world in a fixed order: islands by slot, each island's buildings and shipments by id. */
export function worldEntities(world: WorldState): Map<string, unknown> {
  const entities = new Map<string, unknown>();
  for (const island of world.islands) {
    const { terrain, roads, buildings, transit, ...header } = island;
    entities.set(`island/${island.slot}`, header);
    entities.set(`terrain/${island.slot}`, terrain);
    entities.set(`roads/${island.slot}`, roads);
    for (const building of buildings) entities.set(`building/${island.slot}/${building.id}`, building);
    for (const shipment of transit) entities.set(`transit/${island.slot}/${shipment.id}`, shipment);
  }
  entities.set('market', world.market);
  return entities;
}

/** The fields of an `island/<slot>` entity: an island without its terrain, roads, buildings and shipments. */
const HEADER_FIELDS = [
  'slot',
  'position',
  'owner',
  'name',
  'stage',
  'coinsCents',
  'lastCheckInTick',
  'commuters',
  'ferry',
  'sales',
  'cargo',
  'autoSell',
  'staff',
  'unlockedLandmarks',
  'completedGoals',
  'rewards',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The entities of one island whose key is `<prefix>/<slot>/<id>`, in id order. */
function idEntities(entities: ReadonlyMap<string, unknown>, prefix: string, slot: number) {
  const start = `${prefix}/${slot}/`;
  const found: { id: number; key: string; value: unknown }[] = [];
  for (const [key, value] of entities) {
    if (!key.startsWith(start)) continue;
    const text = key.slice(start.length);
    if (!/^\d+$/.test(text)) throw new Error(`Bad entity key "${key}": the id must be a whole number`);
    found.push({ id: Number(text), key, value });
  }
  return found.sort((a, b) => a.id - b.id);
}

/**
 * The inverse of `worldEntities` for one island: assembles its state from the `island`, `terrain`, `roads`,
 * `building` and `transit` entities, buildings and shipments in id order as the sim keeps them. The result is a deep
 * copy, so a mirror's entities are never aliased. A missing or malformed entity throws an Error that names its key;
 * no half-built island is returned.
 */
export function islandFromEntities(entities: ReadonlyMap<string, unknown>, slot: number): IslandState {
  const headerKey = `island/${slot}`;
  const header = entities.get(headerKey);
  if (!isRecord(header)) throw new Error(`Missing or malformed entity "${headerKey}": expected an object`);
  if (header.slot !== slot) throw new Error(`Malformed entity "${headerKey}": its slot is ${String(header.slot)}`);
  for (const field of HEADER_FIELDS) {
    if (!(field in header)) throw new Error(`Malformed entity "${headerKey}": the field "${field}" is missing`);
  }
  const terrain = entities.get(`terrain/${slot}`);
  if (typeof terrain !== 'string' || terrain.length === 0) {
    throw new Error(`Missing or malformed entity "terrain/${slot}": expected a non-empty string`);
  }
  const roads = entities.get(`roads/${slot}`);
  if (typeof roads !== 'string' || roads.length !== terrain.length) {
    throw new Error(`Missing or malformed entity "roads/${slot}": expected a string as long as the terrain`);
  }
  const parts = <T>(prefix: string): T[] =>
    idEntities(entities, prefix, slot).map(({ id, key, value }) => {
      if (!isRecord(value) || value.id !== id) throw new Error(`Malformed entity "${key}": expected an object with id ${id}`);
      return value as unknown as T;
    });
  const buildings = parts<BuildingState>('building');
  const transit = parts<ShipmentState>('transit');
  const rest = header as unknown as Omit<IslandState, 'terrain' | 'roads' | 'buildings' | 'transit'>;
  return structuredClone({ ...rest, terrain, roads, buildings, transit });
}

export function captureEntities(world: WorldState): EntityCapture {
  const capture = new Map<string, string>();
  for (const [key, value] of worldEntities(world)) capture.set(key, fingerprint(value));
  return capture;
}

/**
 * What changed since a capture, as copies safe to send, plus the capture of now for the next diff. Keep the capture
 * between ticks so each entity is serialized once per tick.
 */
export function diffEntities(before: EntityCapture, world: WorldState): { changes: WorldChanges; capture: EntityCapture } {
  const capture = new Map<string, string>();
  const changed: EntityChange[] = [];
  for (const [key, value] of worldEntities(world)) {
    const print = fingerprint(value);
    capture.set(key, print);
    if (before.get(key) !== print) changed.push({ key, value: structuredClone(value) });
  }
  const removed = [...before.keys()].filter((key) => !capture.has(key));
  return { changes: { changed, removed }, capture };
}

/** Applies changes to a mirror of the entities, as a client does; the mirror then equals the world's entities. */
export function applyChanges(mirror: Map<string, unknown>, changes: WorldChanges): void {
  for (const key of changes.removed) mirror.delete(key);
  for (const { key, value } of changes.changed) mirror.set(key, structuredClone(value));
}
