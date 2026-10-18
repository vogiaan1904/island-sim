import type { BuildingId, GoodId, KeyStaffRole, NeedId, StageId } from '@island/content';

// What the player reads for content ids. The content data has ids only, so the names live here, one record per kind,
// typed so a new id in content fails the build until it has a name (island-ui, text-tone.md). Later tickets (cards,
// the Build picker, Trade) add their words beside these.

export const STAGE_NAMES: Record<StageId, string> = {
  outpost: 'Outpost',
  settlement: 'Settlement',
};

export const BUILDING_NAMES: Record<BuildingId, string> = {
  dock: 'Dock',
  'lumber-camp': 'Lumber camp',
  farm: 'Farm',
  'fishing-hut': 'Fishing hut',
  warehouse: 'Warehouse',
  cottage: 'Cottage',
  well: 'Well',
  market: 'Market',
  'island-hall': 'Island Hall',
};

export const GOOD_NAMES: Record<GoodId, string> = {
  wood: 'Wood',
  fish: 'Fish',
  vegetables: 'Vegetables',
};

/** The need as one lower-case word, for sentences like "Homes need food". */
export const NEED_WORDS: Record<NeedId, string> = {
  food: 'food',
  water: 'water',
};

/** The picture of a good, rendered from its 3D model (`/icons/good_<id>_a.png`). */
export function goodPicture(good: GoodId): string {
  return `/icons/good_${good}_a.png`;
}

/** The key staff roles as the name tag shows them. */
export const ROLE_NAMES: Record<KeyStaffRole, string> = {
  'port-master': 'Port master',
};

/** The portrait of a key staff member, rendered from the Mini Characters (`/icons/portrait_<name>_a.png`). */
export function portraitPicture(name: string): string {
  return `/icons/portrait_${name.toLowerCase()}_a.png`;
}

/**
 * A line about each port master candidate, by name. Content has no traits yet (the trait system is slice 2), so these
 * are manner only: none promises an effect on prices or anything else.
 */
export const PORT_MASTER_TRAITS: Record<string, string> = {
  Lena: 'Keeps a tidy ledger',
  Tomas: 'Knows every captain on the Mainland',
  Mira: 'Never misses a ferry',
  Jonas: 'Counts every crate twice',
  Ada: 'Haggles with a smile',
  Kofi: 'Always has good news for the dock',
};
