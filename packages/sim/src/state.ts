import type { BuildingId, GoalId, GoodId, KeyStaffRole, NeedId, StageId } from '@island/content';

// World state: plain data only (whole numbers, strings, booleans, null, arrays, plain objects), so canonical JSON,
// snapshots and replay keep it exact. Never store undefined.

export type Rotation = 0 | 1 | 2 | 3;

/** Goods held in one place. Only goods with a positive amount are listed. */
export type Stock = Partial<Record<GoodId, number>>;

/**
 * Why a building is not simply running (spec 12.1), in the order the card and bubbles show them: the first one in a
 * building's list is its shown status, and an empty list means running. 'damaged' and 'no-power' arrive in later
 * slices.
 */
export type ConditionId =
  | 'under-construction'
  | 'damaged'
  | 'waiting-for-money'
  | 'no-workers'
  | 'understaffed'
  | 'missing-input'
  | 'no-power'
  | 'output-full';

export interface WorkState {
  /** Residents and commuters at work now, set by the labor pass. */
  residents: number;
  commuters: number;
  /** Permille of full output: each worker's productivity (residents by happiness, commuters 1000) over the jobs. */
  ratePermille: number;
  /** Production progress in permille-ticks; a cycle completes at recipe.cycleTicks * 1000. */
  progress: number;
}

export interface HomeState {
  /** Everyone living here, children included (spec 12.1). */
  residents: number;
  /** Permille; moves toward the share of needs met by a step every game hour. */
  happiness: number;
  /** Needs not met at this home at the last hourly check, in content order; shown as wishes (spec 12.1). */
  unmetNeeds: NeedId[];
}

export interface BuildingState {
  id: number;
  type: BuildingId;
  /** Top-left tile of the footprint. */
  x: number;
  y: number;
  rotation: Rotation;
  /** Ticks of construction left; 0 means built. */
  constructionLeft: number;
  /** 0 low, 1 normal, 2 high: the labor pass staffs and the upkeep pass pays higher priorities first. */
  priority: number;
  /** Output waiting to be carried, a store's stock, a market's shelves or a landmark's delivered materials. */
  stock: Stock;
  /** Shown status first; empty means running. Refreshed at the end of every tick. */
  conditions: ConditionId[];
  /** True while the last hourly upkeep could not be paid; the building waits (spec 12.1). */
  upkeepDue: boolean;
  /** Workplaces only (jobs > 0), else null. */
  work: WorkState | null;
  /** Homes only (homeCapacity > 0), else null. */
  home: HomeState | null;
}

/** Goods on the roads between two buildings of one island. */
export interface ShipmentState {
  id: number;
  good: GoodId;
  amount: number;
  from: number;
  to: number;
  /** The tick on which the goods enter the destination's stock. */
  arriveTick: number;
}

/** Goods bought from the Mainland, waiting for the next ferry's cargo hold, then carried from the dock. */
export interface CargoState {
  good: GoodId;
  amount: number;
  /** The building the goods are for. */
  to: number;
}

/** People who stepped off or boarded one ferry trip: commuters, and newcomers or leavers counted by their home. */
export interface FerryPassengers {
  commuters: number;
  /** In home id order. */
  homes: Array<{ home: number; people: number }>;
}

/**
 * The island's last ferry trip (glossary: ferry manifest; ADR 0001). The sim's ferry happens in one tick and leaves no
 * trace of who moved where, so the client reads this to show the right people walking off and on.
 */
export interface FerryManifest {
  tick: number;
  off: FerryPassengers;
  on: FerryPassengers;
}

export interface KeyStaffState {
  id: number;
  role: KeyStaffRole;
  name: string;
  /** Which of the 12 Mini Characters the portrait shows. */
  look: number;
}

export interface IslandState {
  slot: number;
  /** Where the island sits in the archipelago, in tiles. */
  position: { x: number; y: number };
  /** Row-major, islandSize * islandSize characters: '0' water, '1' beach, '2' grass. */
  terrain: string;
  /** Row-major, same size: '0' no road, '1' road. */
  roads: string;
  /** Opaque account id from the server, or null for an empty slot. */
  owner: string | null;
  name: string | null;
  stage: StageId;
  coinsCents: number;
  /** Sorted by id. */
  buildings: BuildingState[];
  /** Tick of the owner's last check-in (spec 12.1), or null. */
  lastCheckInTick: number | null;
  /** Mainland laborers: how many are hired, and how many came on today's morning ferry and are on the island. */
  commuters: { hired: number; present: number };
  /** The last ferry trip, replaced by every trip; null before the first one. */
  ferry: FerryManifest | null;
  /** Bought goods waiting for the next ferry, oldest first. */
  cargo: CargoState[];
  /** Goods on the roads, sorted by id. */
  transit: ShipmentState[];
  /** The port master's auto-sell rule: per good, how many to keep in storage. Goods not listed are not sold. */
  autoSell: Partial<Record<GoodId, number>>;
  /** Key staff, sorted by id. Slice 1 has only the port master, who arrives with the claim. */
  staff: KeyStaffState[];
  /** Landmarks that can be placed; once unlocked, always unlocked (spec 12.1). In unlock order. */
  unlockedLandmarks: BuildingId[];
  /** Goals reached, in the order they were reached. */
  completedGoals: GoalId[];
  /** Reached goals whose reward waits for the collect command, in the order they were reached. */
  rewards: GoalId[];
}

/** The Mainland market, shared by every island of the world (spec 4.5). Every good has an entry in each record. */
export interface MarketState {
  /** What the Mainland pays per unit now, in cents. */
  prices: Record<GoodId, number>;
  /** Units sold to and bought from the Mainland since the last hourly price update. */
  sold: Record<GoodId, number>;
  bought: Record<GoodId, number>;
}

export interface WorldState {
  /** Version of the sim that wrote this state (spec 12.2). */
  simVersion: number;
  seed: number;
  /** Completed ticks since the world was created; 1 tick = 1 game minute. */
  tick: number;
  /** mulberry32 state of the world's single random stream. */
  rng: number;
  /** Next entity id; ids come from this counter, never from randomness. */
  nextId: number;
  /** Index === slot. */
  islands: IslandState[];
  market: MarketState;
}
