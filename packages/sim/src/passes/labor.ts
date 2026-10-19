import type { Content } from '@island/content';
import { isBuilt, withDefs } from '../buildings.ts';
import { isDayShift } from '../clock.ts';
import { PERMILLE } from '../int.ts';
import { buildingDefOf } from '../lookup.ts';
import { workersOf } from '../people.ts';
import { roadsFrom } from '../roads.ts';
import type { BuildingState, IslandState } from '../state.ts';
import type { TickContext } from './context.ts';

// The labor pass (spec 4.3, 12.1), every slow pass. During the day shift, workplaces are staffed in order of
// priority (high first), then id. Each takes resident workers from the nearest homes along roads first, then
// commuters, whose walk starts at the dock. Residents work at their home's happiness, commuters at a neutral 100%.
// Buildings still being built get nobody; one waiting for money is staffed like any other (it only produces slower). Outside the shift everyone is home.

export function runLabor(ctx: TickContext, island: IslandState): void {
  const { content } = ctx;
  for (const building of island.buildings) {
    const work = building.work;
    if (!work) continue;
    work.residents = 0;
    work.commuters = 0;
    work.ratePermille = 0;
  }
  if (!isDayShift(ctx.minute, content.rules)) return;

  const happiness = new Map(island.buildings.map((b) => [b.id, b.home?.happiness ?? 0]));
  for (const { workplace, homes, commuters } of assignWorkers(island, content, island.commuters.present)) {
    const building = island.buildings.find((b) => b.id === workplace);
    const work = building?.work;
    if (!building || !work) continue;
    let productivity = commuters * PERMILLE;
    for (const { home, workers } of homes) {
      work.residents += workers;
      productivity += workers * (happiness.get(home) ?? 0);
    }
    work.commuters = commuters;
    work.ratePermille = Math.floor(productivity / buildingDefOf(content, building.type).jobs);
  }
}

/** Who works at one workplace: residents from each home (in the order taken) and commuters from the dock. */
export interface WorkerAssignment {
  workplace: number;
  homes: Array<{ home: number; workers: number }>;
  commuters: number;
}

/**
 * The day shift's staffing (spec 4.3, 12.1), the one answer the labor pass stores and the client draws commutes from.
 * Built workplaces are staffed in order of priority (high first), then id: resident workers from the nearest homes
 * along roads first, then up to `commuters` from the dock where a road reaches it. It answers as if the shift were on,
 * whatever the time. Listed by workplace id.
 */
export function assignWorkers(island: IslandState, content: Content, commuters: number): WorkerAssignment[] {
  const workplaces = withDefs(island, content).filter(({ building }) => building.work !== null && isBuilt(building));
  const homes = island.buildings.filter((b) => b.home !== null && isBuilt(b));
  const workersLeft = new Map<number, number>();
  for (const home of homes) if (home.home) workersLeft.set(home.id, workersOf(home.home, content.rules));
  let commutersLeft = commuters;
  const dock = island.buildings.find((b) => b.type === 'dock') ?? null;

  const order = [...workplaces].sort((a, b) => b.building.priority - a.building.priority || a.building.id - b.building.id);
  const assigned: WorkerAssignment[] = [];
  for (const { building, def } of order) {
    const from = roadsFrom(island, content, building);
    const entry: WorkerAssignment = { workplace: building.id, homes: [], commuters: 0 };
    let open = def.jobs;
    for (const home of nearest(homes, from.to)) {
      if (open === 0) break;
      const take = Math.min(open, workersLeft.get(home.id) ?? 0);
      if (take === 0) continue;
      workersLeft.set(home.id, (workersLeft.get(home.id) ?? 0) - take);
      entry.homes.push({ home: home.id, workers: take });
      open -= take;
    }
    if (open > 0 && commutersLeft > 0 && dock && from.to(dock) !== null) {
      entry.commuters = Math.min(open, commutersLeft);
      commutersLeft -= entry.commuters;
    }
    assigned.push(entry);
  }
  return assigned.sort((a, b) => a.workplace - b.workplace);
}

/** The buildings a road reaches, nearest first, ties by id. */
function nearest(buildings: BuildingState[], distance: (b: BuildingState) => number | null): BuildingState[] {
  return buildings
    .map((building) => ({ building, d: distance(building) }))
    .filter((entry): entry is { building: BuildingState; d: number } => entry.d !== null)
    .sort((a, b) => a.d - b.d || a.building.id - b.building.id)
    .map((entry) => entry.building);
}
