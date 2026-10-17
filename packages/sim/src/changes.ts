import { canonicalJson } from './hash.ts';
import type { WorldState } from './state.ts';

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
