import type { Content } from '@island/content';
import { inBounds, isLand, isRoad, tileIndex } from './grid.ts';
import type { LedgerEntry } from './ledger.ts';
import { findBuildingDef } from './lookup.ts';
import { footprintSize, footprintTiles } from './placement.ts';
import type { WorldState } from './state.ts';
import { validateWorld } from './validate.ts';

export interface InvariantViolation {
  /** -1 for world-level problems. */
  slot: number;
  message: string;
}

/**
 * What must hold after any tick or command (spec 12.2): a valid world shape (validateWorld), the tick moving by 0
 * (command) or 1 (tick), money never below zero and changed only through the ledger, buildings sorted by unique ids
 * below nextId, every footprint inside the map, on land, off roads and not overlapping.
 */
export function checkInvariants(
  before: WorldState,
  after: WorldState,
  ledger: readonly LedgerEntry[],
  content: Content,
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const size = content.rules.islandSize;
  for (const problem of validateWorld(after, content)) violations.push({ slot: -1, message: `invalid state: ${problem}` });
  const tickDelta = after.tick - before.tick;
  if (tickDelta !== 0 && tickDelta !== 1) violations.push({ slot: -1, message: `tick moved by ${tickDelta}` });
  if (after.nextId < before.nextId) violations.push({ slot: -1, message: 'nextId went backwards' });

  for (const island of after.islands) {
    const slot = island.slot;
    const previous = before.islands[slot];
    if (island.coinsCents < 0) violations.push({ slot, message: 'money below zero' });
    if (previous) {
      const ledgerDelta = ledger
        .filter((entry) => entry.kind === 'money' && entry.slot === slot)
        .reduce((sum, entry) => sum + entry.deltaCents, 0);
      if (island.coinsCents - previous.coinsCents !== ledgerDelta) {
        violations.push({ slot, message: 'money changed outside the ledger' });
      }
    }

    let lastId = 0;
    const occupied = new Map<number, number>();
    for (const building of island.buildings) {
      if (building.id <= lastId) violations.push({ slot, message: `building ${building.id} out of id order` });
      if (building.id >= after.nextId) violations.push({ slot, message: `building ${building.id} >= nextId` });
      lastId = building.id;
      const def = findBuildingDef(content, building.type);
      if (!def) continue; // reported by validateWorld
      const { w, h } = footprintSize(def, building.rotation);
      for (const [x, y] of footprintTiles(building.x, building.y, w, h)) {
        if (!inBounds(size, x, y) || !isLand(island, size, x, y)) {
          violations.push({ slot, message: `building ${building.id} is off the land at ${x},${y}` });
          continue;
        }
        if (isRoad(island, size, x, y)) violations.push({ slot, message: `building ${building.id} sits on a road` });
        const index = tileIndex(size, x, y);
        const other = occupied.get(index);
        if (other !== undefined) violations.push({ slot, message: `buildings ${other} and ${building.id} overlap` });
        occupied.set(index, building.id);
      }
    }
  }
  return violations;
}
