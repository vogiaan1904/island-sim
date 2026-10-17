import type { BuildingId, Content } from '@island/content';
import {
  buyPriceCents,
  checkPlacement,
  footprintSize,
  isBuilt,
  storedForSale,
  workersOf,
  type BuildingState,
  type Command,
  type IslandState,
  type Rotation,
  type WorldState,
} from '@island/sim';

// A sensible player, not an optimal one (island-testing, pacing harness). It only sends commands a player could
// send and reads only what a player sees. It is stateless: every decision comes from the world as it is, so the
// same seed always gives the same game. Change the version whenever its strategy changes.

export const BOT_VERSION = 'outpost-v1';
export const BOT_OWNER = 'pacing-bot';
export const BOT_ISLAND_NAME = 'Pacing Isle';

/** What the bot builds, in order, and how many of each. */
const PLAN: ReadonlyArray<readonly [BuildingId, number]> = [
  ['fishing-hut', 1],
  ['farm', 1],
  ['market', 1],
  ['well', 1],
  ['cottage', 3],
  ['lumber-camp', 1],
  ['warehouse', 1],
];

/** Coins the bot keeps for a day of wages before it builds anything else. */
const WAGE_RESERVE_DAYS = 1;
const SPINE_LENGTH = 14;
const CROSS_EVERY = 4;
const CROSS_LENGTH = 6;

/** One decision: at most a few commands, from the world as the player sees it. */
export function decide(world: WorldState, content: Content): Command[] {
  const island = world.islands.find((i) => i.owner === BOT_OWNER);
  if (!island) return [{ type: 'claim-island', owner: BOT_OWNER, name: BOT_ISLAND_NAME }];
  const slot = island.slot;
  const commands: Command[] = [];

  if (island.roads.indexOf('1') === -1) {
    for (const tiles of roadPlan(island, content)) commands.push({ type: 'place-road', slot, tiles });
    for (const good of content.goods) {
      commands.push({ type: 'set-auto-sell', slot, good: good.id, keep: good.id === 'wood' ? hallWood(content) : 0 });
    }
    return commands;
  }

  for (const goal of island.rewards) commands.push({ type: 'collect', slot, goal });

  const hired = commutersWanted(island, content);
  if (hired !== island.commuters.hired) commands.push({ type: 'hire-commuters', slot, count: hired });

  const reserve = WAGE_RESERVE_DAYS * hired * content.rules.commuterWagePerDayCents;
  const next = nextBuilding(island, content);
  if (next) {
    const def = content.buildings.find((b) => b.id === next);
    const spot = def && island.coinsCents - def.priceCents >= reserve ? findSpot(island, content, next) : null;
    if (spot) commands.push({ type: 'place-building', slot, building: next, ...spot });
  }

  const site = island.buildings.find((b) => b.type === 'island-hall' && !isBuilt(b));
  if (site) {
    const buy = materialsToBuy(world, content, island, site);
    if (buy !== null && island.coinsCents - buy >= reserve) commands.push({ type: 'buy-materials', slot, buildingId: site.id });
  }
  return commands;
}

/** The next building of the plan to place, or the Island Hall once it is unlocked. */
function nextBuilding(island: IslandState, content: Content): BuildingId | null {
  for (const [type, count] of PLAN) {
    if (island.buildings.filter((b) => b.type === type).length < count) return type;
  }
  const hall = content.buildings.find((b) => b.landmark !== null);
  if (hall && island.unlockedLandmarks.includes(hall.id) && !island.buildings.some((b) => b.type === hall.id)) {
    return hall.id;
  }
  return null;
}

/** Enough commuters to fill the jobs residents leave open, as far as the ferry's seats go. */
function commutersWanted(island: IslandState, content: Content): number {
  let open = 0;
  for (const building of island.buildings) {
    const def = content.buildings.find((b) => b.id === building.type);
    if (def) open += def.jobs;
    if (building.home) open -= workersOf(building.home, content.rules);
  }
  return Math.max(0, Math.min(content.rules.ferrySeats, open));
}

function hallWood(content: Content): number {
  const hall = content.buildings.find((b) => b.landmark !== null);
  return hall?.landmark?.materials.find((m) => m.good === 'wood')?.amount ?? 0;
}

/**
 * The price of buying the site's missing materials when the stores cannot cover them, or null when there is
 * nothing to buy. Waits for what is already on its way.
 */
function materialsToBuy(world: WorldState, content: Content, island: IslandState, site: BuildingState): number | null {
  const landmark = content.buildings.find((b) => b.id === site.type)?.landmark;
  if (!landmark) return null;
  let cost = 0;
  for (const { good, amount } of landmark.materials) {
    const onTheWay = island.transit.filter((s) => s.to === site.id && s.good === good).reduce((n, s) => n + s.amount, 0);
    const bought = island.cargo.filter((c) => c.to === site.id && c.good === good).reduce((n, c) => n + c.amount, 0);
    const missing = amount - (site.stock[good] ?? 0) - onTheWay - bought;
    if (missing > storedForSale(island, content, good)) cost += missing * buyPriceCents(world, content, good);
  }
  return cost > 0 ? cost : null;
}

/**
 * A road north from the dock, with cross streets every few tiles, in commands of at most the allowed length. It
 * starts beside the dock or just north of it, wherever the longest straight road inland fits.
 */
function roadPlan(island: IslandState, content: Content): Array<Array<readonly [number, number]>> {
  const size = content.rules.islandSize;
  const dock = island.buildings.find((b) => b.type === 'dock');
  if (!dock) return [];
  const land = (x: number, y: number) => x >= 0 && y >= 0 && x < size && y < size && island.terrain[y * size + x] !== '0';
  const starts: ReadonlyArray<readonly [number, number]> = [
    [dock.x + 2, dock.y + 1],
    [dock.x - 1, dock.y + 1],
    [dock.x, dock.y - 1],
    [dock.x + 1, dock.y - 1],
  ];
  let best: Array<readonly [number, number]> = [];
  for (const [startX, startY] of starts) {
    const tiles: Array<readonly [number, number]> = [];
    for (let y = startY, n = 0; n < SPINE_LENGTH && land(startX, y); y -= 1, n += 1) {
      tiles.push([startX, y]);
      if (n === 0 || n % CROSS_EVERY !== 0) continue;
      for (const dir of [-1, 1]) {
        for (let i = 1; i <= CROSS_LENGTH && land(startX + dir * i, y); i += 1) tiles.push([startX + dir * i, y]);
      }
    }
    if (tiles.length > best.length) best = tiles;
  }
  const chunks: Array<Array<readonly [number, number]>> = [];
  for (let i = 0; i < best.length; i += content.rules.maxRoadTilesPerCommand) {
    chunks.push(best.slice(i, i + content.rules.maxRoadTilesPerCommand));
  }
  return chunks;
}

/** The free spot nearest the dock where the building passes every placement check. */
function findSpot(island: IslandState, content: Content, type: BuildingId): { x: number; y: number; rotation: Rotation } | null {
  const def = content.buildings.find((b) => b.id === type);
  const dock = island.buildings.find((b) => b.type === 'dock');
  if (!def || !dock) return null;
  const size = content.rules.islandSize;
  let best: { x: number; y: number; rotation: Rotation; score: number } | null = null;
  for (const rotation of [0, 1] as const) {
    const { w, h } = footprintSize(def, rotation);
    for (let y = 0; y <= size - h; y += 1) {
      for (let x = 0; x <= size - w; x += 1) {
        const score = Math.abs(x - dock.x) + Math.abs(y - dock.y);
        if (best && score >= best.score) continue;
        if (checkPlacement(island, content, def, x, y, rotation).ok) best = { x, y, rotation, score };
      }
    }
  }
  return best && { x: best.x, y: best.y, rotation: best.rotation };
}
