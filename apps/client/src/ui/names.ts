import type { BuildingId, GoodId, NeedId, StageId } from '@island/content';

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
