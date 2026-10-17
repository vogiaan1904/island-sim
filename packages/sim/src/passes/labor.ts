import { isBuilt, withDefs } from '../buildings.ts';
import { isDayShift } from '../clock.ts';
import { PERMILLE } from '../int.ts';
import { workersOf } from '../people.ts';
import { roadsFrom } from '../roads.ts';
import type { BuildingState, IslandState } from '../state.ts';
import type { TickContext } from './context.ts';

// The labor pass (spec 4.3, 12.1), every slow pass. During the day shift, workplaces are staffed in order of
// priority (high first), then id. Each takes resident workers from the nearest homes along roads first, then
// commuters, whose walk starts at the dock. Residents work at their home's happiness, commuters at a neutral 100%.
// Buildings still being built or waiting for money get nobody. Outside the shift everyone is home.

export function runLabor(ctx: TickContext, island: IslandState): void {
  const { content } = ctx;
  const workplaces = withDefs(island, content).filter(({ building }) => building.work !== null);
  for (const { building } of workplaces) {
    const work = building.work;
    if (!work) continue;
    work.residents = 0;
    work.commuters = 0;
    work.ratePermille = 0;
  }
  if (!isDayShift(ctx.minute, content.rules)) return;

  const homes = island.buildings.filter((b) => b.home !== null && isBuilt(b));
  const workersLeft = new Map<number, number>();
  for (const home of homes) if (home.home) workersLeft.set(home.id, workersOf(home.home, content.rules));
  let commutersLeft = island.commuters.present;
  const dock = island.buildings.find((b) => b.type === 'dock') ?? null;

  const order = [...workplaces].sort((a, b) => b.building.priority - a.building.priority || a.building.id - b.building.id);
  for (const { building, def } of order) {
    const work = building.work;
    if (!work || !isBuilt(building) || building.upkeepDue) continue;
    const from = roadsFrom(island, content, building);
    let open = def.jobs;
    let productivity = 0;
    for (const home of nearest(homes, from.to)) {
      if (open === 0) break;
      const take = Math.min(open, workersLeft.get(home.id) ?? 0);
      if (take === 0) continue;
      workersLeft.set(home.id, (workersLeft.get(home.id) ?? 0) - take);
      work.residents += take;
      productivity += take * (home.home?.happiness ?? 0);
      open -= take;
    }
    if (open > 0 && commutersLeft > 0 && dock && from.to(dock) !== null) {
      const take = Math.min(open, commutersLeft);
      commutersLeft -= take;
      work.commuters = take;
      productivity += take * PERMILLE;
    }
    work.ratePermille = Math.floor(productivity / def.jobs);
  }
}

/** The buildings a road reaches, nearest first, ties by id. */
function nearest(buildings: BuildingState[], distance: (b: BuildingState) => number | null): BuildingState[] {
  return buildings
    .map((building) => ({ building, d: distance(building) }))
    .filter((entry): entry is { building: BuildingState; d: number } => entry.d !== null)
    .sort((a, b) => a.d - b.d || a.building.id - b.building.id)
    .map((entry) => entry.building);
}
