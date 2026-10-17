import { worldEntities, type EntityChange, type SimEvent, type WorldChanges, type WorldState } from '@island/sim';

// What one open island sees of its world: its own entities and the market (spec 5.3: one island at a time per
// connection). Entity keys are the sim's: island/<slot>, terrain/<slot>, roads/<slot>, building/<slot>/<id>,
// transit/<slot>/<id> and market.

export function isOnIsland(key: string, slot: number): boolean {
  return key === 'market' || key.split('/')[1] === String(slot);
}

/** The island's full state: every entity of the island, and the market. */
export function islandEntities(world: WorldState, slot: number): EntityChange[] {
  const entities: EntityChange[] = [];
  for (const [key, value] of worldEntities(world)) if (isOnIsland(key, slot)) entities.push({ key, value });
  return entities;
}

export function islandChanges(changes: WorldChanges, slot: number): WorldChanges {
  return {
    changed: changes.changed.filter((change) => isOnIsland(change.key, slot)),
    removed: changes.removed.filter((key) => isOnIsland(key, slot)),
  };
}

export function islandEvents(events: readonly SimEvent[], slot: number): SimEvent[] {
  return events.filter((event) => event.slot === slot);
}
