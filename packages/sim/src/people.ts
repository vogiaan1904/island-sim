import type { WorldRules } from '@island/content';
import { mulDivFloor } from './int.ts';
import type { HomeState, IslandState } from './state.ts';

// Residents are counts per home, children included (spec 12.1). A fixed share of each home are children, who do
// not work; the rest are workers. Rounding down keeps children + workers equal to the residents.

export function childrenOf(residents: number, rules: WorldRules): number {
  return mulDivFloor(residents, rules.childrenPermille, 1000);
}

export function workersOf(home: HomeState, rules: WorldRules): number {
  return home.residents - childrenOf(home.residents, rules);
}

/** Everyone living on the island, children included: what stage targets count (spec 12.1). */
export function residentsOf(island: IslandState): number {
  let total = 0;
  for (const building of island.buildings) total += building.home?.residents ?? 0;
  return total;
}
