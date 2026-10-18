// Typed game data (spec 3, 12.1). Numbers are first guesses until the pacing harness sets them.
// Every duration is in ticks (game minutes), every price in cents, every distance in road tiles, every share in
// permille (1000 = 100%).

export type StageId = 'outpost' | 'settlement';

export type BuildingId =
  | 'dock'
  | 'lumber-camp'
  | 'farm'
  | 'fishing-hut'
  | 'warehouse'
  | 'cottage'
  | 'well'
  | 'market'
  | 'island-hall';

export type GoodId = 'wood' | 'fish' | 'vegetables';

export type NeedId = 'food' | 'water';

export type GoalId = 'first-farm' | 'first-residents' | 'ten-residents' | 'island-hall';

export type KeyStaffRole = 'port-master';

export type EventTypeId =
  | 'island-claimed'
  | 'construction-started'
  | 'construction-finished'
  | 'landmark-started'
  | 'landmark-unlocked'
  | 'stage-reached'
  | 'newcomers-arrived'
  | 'residents-left'
  | 'commuters-stayed-home'
  | 'mainland-help'
  | 'cargo-arrived'
  | 'goal-completed';

/** 'land': every footprint tile is beach or grass. 'shore': the same, and at least one tile touches water. */
export type Placement = 'land' | 'shore';

export interface StageDef {
  id: StageId;
  order: number;
}

export interface GoodAmount {
  good: GoodId;
  amount: number;
}

export interface GoodDef {
  id: GoodId;
  /** The Mainland price drifts around this, in cents per unit. */
  basePriceCents: number;
  /** No sale to the Mainland, manual or automatic, below this price (spec 12.1). */
  floorPriceCents: number;
  /** The Mainland price always stays within these bounds. */
  minPriceCents: number;
  maxPriceCents: number;
  /** '#rrggbb', for the Goods flow view (spec 12.4). */
  color: string;
}

export interface NeedDef {
  id: NeedId;
  /** Goods that meet the need, eaten from the serving building; empty when being in reach is enough (a well). */
  goods: readonly GoodId[];
  /** Units each resident eats per day at the meal minute; 0 for needs without goods. */
  perResidentPerDay: number;
}

export interface Recipe {
  good: GoodId;
  /** Units made per cycle. */
  amount: number;
  /** Ticks per cycle at full staff and full productivity. */
  cycleTicks: number;
}

export interface LandmarkDef {
  /** Residents (children included) that unlock it; it stays unlocked after that (spec 12.1). */
  unlockResidents: number;
  /** Carried to the site from storage or bought from the Mainland; construction waits until all are there. */
  materials: readonly GoodAmount[];
  /** The stage that starts when it is finished. */
  startsStage: StageId;
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
  /** Job slots, filled by the labor pass; 0 for buildings without workers. */
  jobs: number;
  /** What a workplace makes; null for buildings that make nothing. */
  recipe: Recipe | null;
  /** Goods it can hold in total: a producer's output, a store's stock or a market's shelves; 0 for none. */
  storage: number;
  /** A store (dock, warehouse) takes any good from producers and supplies markets, sites and sales. */
  isStore: boolean;
  /** A service meets one need for homes within reach, measured along roads in tiles. */
  serves: { need: NeedId; reach: number } | null;
  /** Residents a home holds; 0 for buildings that are not homes. */
  homeCapacity: number;
  /** Charged every game hour once built; unpaid, the building waits (spec 12.1). */
  upkeepCentsPerHour: number;
  landmark: LandmarkDef | null;
}

export type GoalTarget =
  | { kind: 'build'; building: BuildingId; count: number }
  | { kind: 'residents'; count: number };

export interface GoalDef {
  id: GoalId;
  stage: StageId;
  target: GoalTarget;
  /** Paid when the player collects the reward (spec 12.1). */
  rewardCents: number;
}

export interface KeyStaffCandidate {
  name: string;
  /** Which of the 12 Mini Characters the portrait shows (0 to 11). */
  look: number;
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

  /** Minute of the day at tick 0 of every world. */
  startMinute: number;
  /** For the client's day and night lighting. */
  sunriseMinute: number;
  sunsetMinute: number;
  /** The day shift: the morning ferry lands at its start, the evening ferry leaves at its end (spec 12.1). */
  shiftStartMinute: number;
  shiftEndMinute: number;
  /** Residents eat once a day at this minute. */
  mealMinute: number;
  /** The slow passes (labor, transport, goals) run when the minute of the day is a multiple of this. */
  slowPassMinutes: number;

  /** People per ferry trip, each way; newcomers board first (spec 12.1). */
  ferrySeats: number;
  /** Goods per ferry trip in the cargo hold; goods never take seats (spec 4.4). */
  ferryCargoHold: number;
  /** Paid for each commuter who boards the morning ferry. */
  commuterWagePerDayCents: number;
  /**
   * The Mainland's grant on a morning ferry to a stuck island: no residents, coins below one commuter's day wage, no
   * goods anywhere, nothing in transit or cargo, no reward waiting (spec 12.1).
   */
  mainlandHelpCents: number;
  /**
   * Share of its normal output a building runs at while its upkeep could not be paid ("waiting for money"): it keeps
   * its workers and slows down instead of stopping (spec 12.1).
   */
  waitingOutputPermille: number;
  newcomersPerFerry: number;
  leaversPerFerry: number;
  /** Share of each home's residents who are children and do not work. */
  childrenPermille: number;
  /** Happiness moves toward its target by this much every game hour. */
  happinessStepPerHour: number;
  /** Residents of homes below this happiness leave by the evening ferry. */
  leaveBelowHappiness: number;
  /** Rent per resident per game hour at full happiness; scaled by happiness. */
  rentPerResidentHourCents: number;
  /** Auto-sell always keeps this many days of food for the residents (a safety rule, spec 2.3). */
  foodSafetyDays: number;

  /** Units one building sends out per transport pass, in total (the slice 1 road capacity). */
  shipmentPerPass: number;
  /** Ticks goods take per road tile. */
  roadTicksPerTile: number;

  /** Buying from the Mainland costs the market price times this. */
  buyMarkupPermille: number;
  /** Every game hour the price closes this share of its gap to the base price. */
  priceRevertPermille: number;
  /** Every game hour the price moves at random by up to this share of the base price. */
  priceDriftPermille: number;
  /** Each unit sold (bought) in the last hour lowers (raises) the price by this share of the base price. */
  priceReactionPermille: number;
}

export interface Content {
  stages: readonly StageDef[];
  goods: readonly GoodDef[];
  needs: readonly NeedDef[];
  buildings: readonly BuildingDef[];
  goals: readonly GoalDef[];
  portMasterCandidates: readonly KeyStaffCandidate[];
  eventTypes: readonly EventTypeDef[];
  rules: WorldRules;
}
