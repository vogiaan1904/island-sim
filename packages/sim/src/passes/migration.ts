import { isBuilt, withDefs } from '../buildings.ts';
import { emit } from '../events.ts';
import { PERMILLE } from '../int.ts';
import { workersOf } from '../people.ts';
import type { IslandState } from '../state.ts';
import type { TickContext } from './context.ts';
import { unmetNeedsAt } from './needs.ts';

// Migration by ferry (spec 2.2, 12.1). Residents are counts per home, so newcomers fill homes as households and
// leavers are a count; the ferry passes say how many seats are free.

/**
 * Newcomers arrive while there are open jobs, into built homes with room whose needs are all met now, in id order,
 * at most newcomersPerFerry and the free seats. Returns how many came.
 */
export function moveInNewcomers(ctx: TickContext, island: IslandState, seats: number): number {
  const { content } = ctx;
  let left = Math.min(seats, content.rules.newcomersPerFerry);
  let openJobs = 0;
  for (const { building, def } of withDefs(island, content)) {
    if (def.jobs > 0 && isBuilt(building)) openJobs += def.jobs;
    if (building.home) openJobs -= workersOf(building.home, content.rules);
  }
  let arrived = 0;
  for (const { building, def } of withDefs(island, content)) {
    const home = building.home;
    if (left === 0 || openJobs <= 0) break;
    if (!home || !isBuilt(building) || home.residents >= def.homeCapacity) continue;
    if (unmetNeedsAt(island, content, building).length > 0) continue;
    const come = Math.min(def.homeCapacity - home.residents, left);
    const workersBefore = workersOf(home, content.rules);
    if (home.residents === 0) home.happiness = PERMILLE;
    home.residents += come;
    openJobs -= workersOf(home, content.rules) - workersBefore;
    left -= come;
    arrived += come;
  }
  if (arrived > 0) emit(ctx.sink, 'newcomers-arrived', island.slot, { count: arrived });
  return arrived;
}

/** Residents of the unhappiest homes leave quietly, at most leaversPerFerry and the free seats. Returns how many. */
export function moveOutUnhappy(ctx: TickContext, island: IslandState, seats: number): number {
  const rules = ctx.content.rules;
  let left = Math.min(seats, rules.leaversPerFerry);
  const unhappy = island.buildings
    .filter((b) => b.home !== null && b.home.residents > 0 && b.home.happiness < rules.leaveBelowHappiness)
    .sort((a, b) => (a.home?.happiness ?? 0) - (b.home?.happiness ?? 0) || a.id - b.id);
  let gone = 0;
  for (const building of unhappy) {
    const home = building.home;
    if (!home || left === 0) break;
    const go = Math.min(home.residents, left);
    home.residents -= go;
    if (home.residents === 0) home.happiness = PERMILLE;
    left -= go;
    gone += go;
  }
  if (gone > 0) emit(ctx.sink, 'residents-left', island.slot, { count: gone });
  return gone;
}
