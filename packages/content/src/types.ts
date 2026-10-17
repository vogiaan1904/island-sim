// Typed game data (spec 3, 12.1). Numbers are first guesses until the pacing harness sets them.
// Every duration is in ticks (game minutes) and every price in cents.

export type StageId = 'outpost' | 'settlement';

export type BuildingId =
  | 'dock'
  | 'lumber-camp'
  | 'farm'
  | 'fishing-hut'
  | 'warehouse'
  | 'cottage'
  | 'well'
  | 'market';

export type EventTypeId = 'island-claimed' | 'construction-started' | 'construction-finished';

/** 'land': every footprint tile is beach or grass. 'shore': the same, and at least one tile touches water. */
export type Placement = 'land' | 'shore';

export interface StageDef {
  id: StageId;
  order: number;
}

export interface BuildingDef {
  id: BuildingId;
  /** Size in tiles at rotation 0; rotations 1 and 3 swap w and h. */
  footprint: { w: number; h: number };
  placement: Placement;
  /** Needs a road tile next to its footprint. */
  needsRoad: boolean;
  priceCents: number;
  buildTicks: number;
  availableFrom: StageId;
  /** False for buildings the game places itself (the dock). */
  playerBuildable: boolean;
}

export interface EventTypeDef {
  id: EventTypeId;
  /** 0 to 100; "while you were away" picks the five most important (spec 12.4). */
  importance: number;
}

export interface WorldRules {
  /** Tiles per island side. */
  islandSize: number;
  /** Island slots per world (spec 12.3: up to 10). */
  slotCount: number;
  startingCoinsCents: number;
  roadPricePerTileCents: number;
  maxRoadTilesPerCommand: number;
  islandName: { minLength: number; maxLength: number };
  /** 1 game day = 1,440 ticks = 1 real hour (spec 4.1). */
  ticksPerDay: number;
  /** An island is active if its last check-in was within this many ticks: 7 real days (spec 12.1). */
  activeIslandTicks: number;
}

export interface Content {
  stages: readonly StageDef[];
  buildings: readonly BuildingDef[];
  eventTypes: readonly EventTypeDef[];
  rules: WorldRules;
}
