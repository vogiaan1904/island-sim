import type { Content, NeedId } from '@island/content';
import { isBuilt, withDefs } from '../buildings.ts';
import { PERMILLE, mulDivFloor } from '../int.ts';
import { credit, loseGoods } from '../ledger.ts';
import { roadsFrom } from '../roads.ts';
import type { BuildingState, IslandState } from '../state.ts';
import { stockOf } from '../stock.ts';
import type { TickContext } from './context.ts';

// Needs, happiness and rent (spec 2.2, 4.3, 12.1). A home's need is met when a built service of that need is within
// its reach along roads and, for needs with goods (food), has some on its shelves. Residents eat once a day; between
// meals, happiness follows the share of needs met, a step every game hour, so one bad hour changes little.

/** The built services of a need that reach a home, nearest first, ties by id. */
function servicesInReach(island: IslandState, content: Content, home: BuildingState, need: NeedId): BuildingState[] {
  const roads = roadsFrom(island, content, home);
  return withDefs(island, content)
    .filter(({ building, def }) => def.serves?.need === need && isBuilt(building))
    .map(({ building, def }) => ({ building, reach: def.serves?.reach ?? 0, distance: roads.to(building) }))
    .filter((s): s is { building: BuildingState; reach: number; distance: number } => s.distance !== null && s.distance <= s.reach)
    .sort((a, b) => a.distance - b.distance || a.building.id - b.building.id)
    .map((s) => s.building);
}

/** The needs a home lacks right now, in content order. */
export function unmetNeedsAt(island: IslandState, content: Content, home: BuildingState): NeedId[] {
  return content.needs
    .filter((need) => {
      const services = servicesInReach(island, content, home, need.id);
      if (need.goods.length === 0) return services.length === 0;
      return !services.some((s) => need.goods.some((good) => stockOf(s.stock, good) > 0));
    })
    .map((need) => need.id);
}

/** Every game hour: each built home's unmet needs are refreshed and its happiness steps toward the share met. */
export function updateNeeds(ctx: TickContext, island: IslandState): void {
  const { content } = ctx;
  for (const building of island.buildings) {
    const home = building.home;
    if (!home || !isBuilt(building)) continue;
    home.unmetNeeds = unmetNeedsAt(island, content, building);
    if (home.residents === 0) {
      home.happiness = PERMILLE;
      continue;
    }
    const met = content.needs.length - home.unmetNeeds.length;
    const target = mulDivFloor(met, PERMILLE, content.needs.length);
    const step = content.rules.happinessStepPerHour;
    home.happiness =
      home.happiness < target ? Math.min(target, home.happiness + step) : Math.max(target, home.happiness - step);
  }
}

/** At the meal minute, each home eats its day's share from the services in reach: nearest first, goods in order. */
export function serveMeals(ctx: TickContext, island: IslandState): void {
  const { content } = ctx;
  for (const need of content.needs) {
    if (need.goods.length === 0) continue;
    for (const building of island.buildings) {
      const home = building.home;
      if (!home || home.residents === 0 || !isBuilt(building)) continue;
      let hunger = home.residents * need.perResidentPerDay;
      for (const service of servicesInReach(island, content, building, need.id)) {
        for (const good of need.goods) {
          const eat = Math.min(hunger, stockOf(service.stock, good));
          if (eat === 0) continue;
          loseGoods(island, service.stock, good, eat, 'eaten', ctx.ledger);
          hunger -= eat;
        }
        if (hunger === 0) break;
      }
    }
  }
}

/** Every game hour, the homes pay rent, scaled by their happiness (spec 4.3), as one payment per island. */
export function collectRent(ctx: TickContext, island: IslandState): void {
  let total = 0;
  for (const building of island.buildings) {
    const home = building.home;
    if (!home || home.residents === 0) continue;
    total += mulDivFloor(home.residents * ctx.content.rules.rentPerResidentHourCents, home.happiness, PERMILLE);
  }
  if (total > 0) credit(island, total, 'rent', ctx.ledger);
}
