import type { BuildingId, Content } from '@island/content';
import { newBuilding } from './buildings.ts';
import { findBuildingDef } from './lookup.ts';
import type { Rotation } from './state.ts';
import { newMarket } from './world.ts';

// Snapshot migrations, one per sim version (spec 12.2). Each takes the data of its version and returns the data of
// the next; loadWorld validates the result. They never change what was already there, they only add.

type Data = Record<string, unknown>;

/**
 * Version 1 to 2 (slice 1, plan 2): the Mainland market, commuters, cargo, goods in transit, auto-sell, key staff,
 * landmarks, goals, and per building its priority, stock, conditions, upkeep, work and home. A claimed island gets
 * its port master from the candidate list by slot (a version 1 world has no random draw to spare for it).
 */
export function migrateV1(data: Data, content: Content): Data {
  let nextId = data.nextId as number;
  const islands = (data.islands as Data[]).map((island) => {
    const buildings = (island.buildings as Data[]).map((b) => {
      const def = findBuildingDef(content, b.type);
      if (!def) throw new Error(`unknown building type ${String(b.type)}`);
      const fresh = newBuilding(def, b.id as number, b.x as number, b.y as number, b.rotation as Rotation);
      const left = b.constructionLeft as number;
      return { ...fresh, constructionLeft: left, conditions: left > 0 ? ['under-construction'] : [] };
    });
    const staff: Data[] = [];
    if (island.owner !== null) {
      const candidate = content.portMasterCandidates[(island.slot as number) % content.portMasterCandidates.length];
      if (!candidate) throw new Error('content has no port master candidates');
      staff.push({ id: nextId, role: 'port-master', name: candidate.name, look: candidate.look });
      nextId += 1;
    }
    return {
      ...island,
      buildings,
      commuters: { hired: 0, present: 0 },
      cargo: [],
      transit: [],
      autoSell: {},
      staff,
      unlockedLandmarks: [] as BuildingId[],
      completedGoals: [],
      rewards: [],
    };
  });
  return { ...data, nextId, islands, market: newMarket(content) };
}
