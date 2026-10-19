import type { BuildingDef, Content } from '@island/content';
import { CONDITION_ORDER } from './buildings.ts';
import { isValidIslandName } from './commands/claimIsland.ts';
import { WATER } from './grid.ts';
import { PERMILLE } from './int.ts';
import { findBuildingDef } from './lookup.ts';
import { footprintSize } from './placement.ts';
import type { Rotation } from './state.ts';

// The shape every world must have for this content. loadWorld refuses snapshots that break it, and checkInvariants
// runs it after every command and tick in tests, so damaged data is refused with a reason instead of failing later.

const UINT32_MAX = 0xffffffff;
const MAX_OWNER_LENGTH = 64;
const MAX_PRIORITY = 2;
const STAFF_NAME = /^[A-Za-z]{1,24}$/;
const LOOKS = 12;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isWhole = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && !Object.is(value, -0);

const isCount = (value: unknown, max = Number.MAX_SAFE_INTEGER): value is number =>
  isWhole(value) && value >= 0 && value <= max;

const isRotation = (value: unknown): value is Rotation => value === 0 || value === 1 || value === 2 || value === 3;

/** Every problem found in data that claims to be a world for this content; empty when the world is valid. */
export function validateWorld(data: unknown, content: Content): string[] {
  if (!isRecord(data)) return ['world is not an object'];
  const problems: string[] = [];
  for (const key of ['simVersion', 'tick', 'nextId']) {
    if (!isCount(data[key])) problems.push(`${key} must be a whole number >= 0`);
  }
  for (const key of ['seed', 'rng']) {
    if (!isCount(data[key], UINT32_MAX)) problems.push(`${key} must be a whole number from 0 to 2^32 - 1`);
  }
  const islands = data.islands;
  if (!Array.isArray(islands)) problems.push('islands must be a list');
  else if (islands.length !== content.rules.slotCount) problems.push(`islands must hold ${content.rules.slotCount} slots`);
  validateMarket(data.market, content, problems);
  if (problems.length > 0 || !Array.isArray(islands)) return problems;

  const ctx: Ctx = {
    content,
    tick: data.tick as number,
    nextId: data.nextId as number,
    owners: new Set<string>(),
    ids: new Set<number>(),
    problems,
  };
  islands.forEach((island: unknown, slot: number) => validateIsland(island, slot, ctx));
  return problems;
}

interface Ctx {
  content: Content;
  tick: number;
  nextId: number;
  owners: Set<string>;
  /** Entity ids seen so far, across islands: buildings, shipments and key staff. */
  ids: Set<number>;
  problems: string[];
}

function validateMarket(raw: unknown, content: Content, problems: string[]): void {
  if (!isRecord(raw)) {
    problems.push('market must be an object');
    return;
  }
  const goodIds = content.goods.map((g) => g.id);
  for (const key of ['prices', 'sold', 'bought']) {
    const record = raw[key];
    if (!isRecord(record) || Object.keys(record).sort().join() !== [...goodIds].sort().join()) {
      problems.push(`market ${key} must list every good`);
      continue;
    }
    for (const good of content.goods) {
      const value = record[good.id];
      const ok =
        key === 'prices'
          ? isWhole(value) && value >= good.minPriceCents && value <= good.maxPriceCents
          : isCount(value);
      if (!ok) problems.push(`market ${key} for ${good.id} is out of range`);
    }
  }
}

function validateIsland(raw: unknown, slot: number, ctx: Ctx): void {
  const { content, problems } = ctx;
  const at = `island ${slot}`;
  if (!isRecord(raw)) {
    problems.push(`${at}: not an object`);
    return;
  }
  const size = content.rules.islandSize;
  const tiles = size * size;
  if (raw.slot !== slot) problems.push(`${at}: slot must be ${slot}`);
  const position = raw.position;
  if (!isRecord(position) || !isWhole(position.x) || !isWhole(position.y)) problems.push(`${at}: position must be whole x and y`);

  const terrain = raw.terrain;
  const roads = raw.roads;
  const terrainOk = typeof terrain === 'string' && terrain.length === tiles && /^[012]*$/.test(terrain);
  const roadsOk = typeof roads === 'string' && roads.length === tiles && /^[01]*$/.test(roads);
  if (!terrainOk) problems.push(`${at}: terrain must be ${tiles} characters of 0, 1 or 2`);
  if (!roadsOk) problems.push(`${at}: roads must be ${tiles} characters of 0 or 1`);
  if (terrainOk && roadsOk) {
    for (let i = 0; i < tiles; i += 1) {
      if (roads[i] === '1' && terrain[i] === WATER) {
        problems.push(`${at}: road on water at tile ${i}`);
        break;
      }
    }
  }

  if (!content.stages.some((stage) => stage.id === raw.stage)) problems.push(`${at}: unknown stage`);
  const coins = raw.coinsCents;
  if (!isCount(coins)) problems.push(`${at}: coinsCents must be a whole number >= 0`);
  const lastCheckIn = raw.lastCheckInTick;
  if (lastCheckIn !== null && !isCount(lastCheckIn, ctx.tick)) {
    problems.push(`${at}: lastCheckInTick must be null or a tick up to the current one`);
  }

  const buildings = raw.buildings;
  const placed = new Map<number, Placed>();
  if (!Array.isArray(buildings)) problems.push(`${at}: buildings must be a list`);
  else validateBuildings(buildings, at, placed, ctx);

  validateCommuters(raw.commuters, at, ctx);
  validateFerry(raw.ferry, at, ctx);
  validateCargo(raw.cargo, at, placed, ctx);
  validateTransit(raw.transit, at, placed, ctx);
  validateSiteTotals(raw, at, placed, ctx);
  validateAutoSell(raw.autoSell, at, ctx);
  validateStaff(raw.staff, at, ctx);
  validateProgress(raw, at, ctx);

  const owner = raw.owner;
  if (owner === null) {
    const empty =
      raw.name === null &&
      coins === 0 &&
      lastCheckIn === null &&
      isEmptyList(buildings) &&
      raw.ferry === null &&
      isEmptyList(raw.cargo) &&
      isEmptyList(raw.transit) &&
      isEmptyList(raw.staff) &&
      isEmptyList(raw.unlockedLandmarks) &&
      isEmptyList(raw.completedGoals) &&
      isEmptyList(raw.rewards) &&
      isRecord(raw.autoSell) &&
      Object.keys(raw.autoSell).length === 0 &&
      isRecord(raw.commuters) &&
      raw.commuters.hired === 0 &&
      raw.commuters.present === 0;
    if (!empty) problems.push(`${at}: an unclaimed island has no name, coins, check-ins, buildings, people or goods`);
  } else if (typeof owner !== 'string' || owner.length === 0 || owner.length > MAX_OWNER_LENGTH) {
    problems.push(`${at}: owner must be null or an account id`);
  } else {
    if (ctx.owners.has(owner)) problems.push(`${at}: owner ${owner} already owns another island`);
    ctx.owners.add(owner);
    if (!isValidIslandName(raw.name, content.rules)) problems.push(`${at}: invalid island name`);
  }
}

function isEmptyList(value: unknown): boolean {
  return Array.isArray(value) && value.length === 0;
}

/** Records a new entity id; false (with a problem) when it breaks the order or was used before. */
function takeId(id: unknown, lastId: number, where: string, ctx: Ctx): id is number {
  if (!isWhole(id) || id <= lastId || id >= ctx.nextId) {
    ctx.problems.push(`${where}: id must increase and stay below nextId`);
    return false;
  }
  if (ctx.ids.has(id)) ctx.problems.push(`${where}: id ${id} is used twice`);
  ctx.ids.add(id);
  return true;
}

/** A building of one island whose type is known, as the goods checks need it. */
interface Placed {
  def: BuildingDef;
  built: boolean;
  stock: unknown;
}

function validateBuildings(buildings: unknown[], at: string, placed: Map<number, Placed>, ctx: Ctx): void {
  const { content, problems } = ctx;
  const size = content.rules.islandSize;
  let lastId = 0;
  buildings.forEach((building: unknown, index: number) => {
    const where = `${at} building ${index}`;
    if (!isRecord(building)) {
      problems.push(`${where}: not an object`);
      return;
    }
    const id = building.id;
    if (takeId(id, lastId, where, ctx)) lastId = id;
    const def = findBuildingDef(content, building.type);
    if (!def) {
      problems.push(`${where}: unknown building type`);
      return;
    }
    if (isWhole(id)) placed.set(id, { def, built: building.constructionLeft === 0, stock: building.stock });
    if (!isRotation(building.rotation)) {
      problems.push(`${where}: rotation must be 0 to 3`);
      return;
    }
    if (!isCount(building.constructionLeft, def.buildTicks)) {
      problems.push(`${where}: constructionLeft must be from 0 to ${def.buildTicks}`);
    }
    const { w, h } = footprintSize(def, building.rotation);
    const { x, y } = building;
    if (!isWhole(x) || !isWhole(y) || x < 0 || y < 0 || x > size - w || y > size - h) {
      problems.push(`${where}: footprint is outside the map`);
    }
    if (!isCount(building.priority, MAX_PRIORITY)) problems.push(`${where}: priority must be 0 to ${MAX_PRIORITY}`);
    if (typeof building.upkeepDue !== 'boolean') problems.push(`${where}: upkeepDue must be true or false`);
    validateStock(building.stock, def, where, ctx);
    validateConditions(building.conditions, where, problems);
    validateWork(building.work, def, where, problems);
    validateHome(building.home, def, where, ctx);
  });
}

function validateStock(raw: unknown, def: BuildingDef, where: string, ctx: Ctx): void {
  const stock = goodsRecord(raw, `${where} stock`, ctx, false);
  if (!stock) return;
  const total = Object.values(stock).reduce((sum, n) => sum + n, 0);
  if (def.landmark) {
    for (const [good, amount] of Object.entries(stock)) {
      const wanted = def.landmark.materials.find((m) => m.good === good)?.amount ?? 0;
      if (amount > wanted) ctx.problems.push(`${where}: holds more ${good} than the landmark needs`);
    }
  } else if (total > def.storage) {
    ctx.problems.push(`${where}: holds ${total} goods, more than its storage of ${def.storage}`);
  }
}

/** A record of known goods to whole amounts (> 0 unless zeros are allowed), or null after reporting a problem. */
function goodsRecord(raw: unknown, where: string, ctx: Ctx, allowZero: boolean): Record<string, number> | null {
  if (!isRecord(raw)) {
    ctx.problems.push(`${where} must be an object`);
    return null;
  }
  const goods = new Set<string>(ctx.content.goods.map((g) => g.id));
  for (const [good, amount] of Object.entries(raw)) {
    if (!goods.has(good)) ctx.problems.push(`${where}: unknown good ${good}`);
    if (!isCount(amount) || (!allowZero && amount === 0)) ctx.problems.push(`${where}: ${good} must be a whole amount`);
  }
  return raw as Record<string, number>;
}

function validateConditions(raw: unknown, where: string, problems: string[]): void {
  if (!Array.isArray(raw)) {
    problems.push(`${where}: conditions must be a list`);
    return;
  }
  const positions = raw.map((c: unknown) => CONDITION_ORDER.indexOf(c as never));
  const ordered = positions.every((p, i) => p >= 0 && (i === 0 || p > (positions[i - 1] as number)));
  if (!ordered) problems.push(`${where}: conditions must be known, unique and in the shown order`);
}

function validateWork(raw: unknown, def: BuildingDef, where: string, problems: string[]): void {
  if (def.jobs === 0) {
    if (raw !== null) problems.push(`${where}: only workplaces have work`);
    return;
  }
  if (!isRecord(raw)) {
    problems.push(`${where}: a workplace needs work`);
    return;
  }
  const people = isCount(raw.residents) && isCount(raw.commuters) && raw.residents + raw.commuters <= def.jobs;
  if (!people) problems.push(`${where}: workers must be whole and fit the ${def.jobs} jobs`);
  if (!isCount(raw.ratePermille, PERMILLE)) problems.push(`${where}: ratePermille must be 0 to ${PERMILLE}`);
  const cycle = def.recipe ? def.recipe.cycleTicks * PERMILLE : 0;
  if (!isCount(raw.progress, cycle)) problems.push(`${where}: progress must be 0 to ${cycle}`);
}

function validateHome(raw: unknown, def: BuildingDef, where: string, ctx: Ctx): void {
  if (def.homeCapacity === 0) {
    if (raw !== null) ctx.problems.push(`${where}: only homes have residents`);
    return;
  }
  if (!isRecord(raw)) {
    ctx.problems.push(`${where}: a home needs a home record`);
    return;
  }
  if (!isCount(raw.residents, def.homeCapacity)) ctx.problems.push(`${where}: residents must be 0 to ${def.homeCapacity}`);
  if (!isCount(raw.happiness, PERMILLE)) ctx.problems.push(`${where}: happiness must be 0 to ${PERMILLE}`);
  const order = ctx.content.needs.map((n) => n.id);
  const unmet = raw.unmetNeeds;
  const positions = Array.isArray(unmet) ? unmet.map((n: unknown) => order.indexOf(n as never)) : [-1];
  if (!positions.every((p, i) => p >= 0 && (i === 0 || p > (positions[i - 1] as number)))) {
    ctx.problems.push(`${where}: unmetNeeds must be known, unique needs in content order`);
  }
}

function validateCommuters(raw: unknown, at: string, ctx: Ctx): void {
  const seats = ctx.content.rules.ferrySeats;
  if (!isRecord(raw) || !isCount(raw.hired, seats) || !isCount(raw.present, seats)) {
    ctx.problems.push(`${at}: commuters must be hired and present counts from 0 to ${seats}`);
  }
}

/** The ferry manifest: null, or one trip's tick (not in the future) and its people off and on, within the seats. */
function validateFerry(raw: unknown, at: string, ctx: Ctx): void {
  if (raw === null) return;
  const seats = ctx.content.rules.ferrySeats;
  const passengers = (side: unknown): boolean => {
    if (!isRecord(side) || !isCount(side.commuters, seats) || !Array.isArray(side.homes)) return false;
    let total = side.commuters;
    let lastHome = 0;
    for (const entry of side.homes as unknown[]) {
      if (!isRecord(entry) || !isWhole(entry.home) || entry.home <= lastHome || !isCount(entry.people, seats) || entry.people === 0) {
        return false;
      }
      lastHome = entry.home;
      total += entry.people;
    }
    return total <= seats;
  };
  const ok = isRecord(raw) && isCount(raw.tick, ctx.tick) && passengers(raw.off) && passengers(raw.on);
  if (!ok) {
    ctx.problems.push(`${at}: ferry must be null or a past trip's tick with commuters and people per home (ascending ids), off and on, within ${seats} seats`);
  }
}

/** Where goods of a kind may be carried: a built store, a built service that sells them, or a site that needs them. */
function takesGood(placed: Placed | undefined, good: unknown, content: Content): boolean {
  if (!placed || typeof good !== 'string') return false;
  const { def, built } = placed;
  if (def.landmark) return !built && def.landmark.materials.some((m) => m.good === good);
  if (!built) return false;
  if (def.isStore) return true;
  const need = def.serves ? content.needs.find((n) => n.id === def.serves?.need) : undefined;
  return need !== undefined && need.goods.some((g) => g === good);
}

/** Cargo is bought for landmark sites only (spec 12.1). */
function validateCargo(raw: unknown, at: string, placed: Map<number, Placed>, ctx: Ctx): void {
  if (!Array.isArray(raw)) {
    ctx.problems.push(`${at}: cargo must be a list`);
    return;
  }
  const goods = new Set<string>(ctx.content.goods.map((g) => g.id));
  raw.forEach((item: unknown, index: number) => {
    const site = isRecord(item) ? placed.get(item.to as number) : undefined;
    const ok =
      isRecord(item) &&
      goods.has(item.good as string) &&
      isWhole(item.amount) &&
      item.amount > 0 &&
      Boolean(site?.def.landmark) &&
      takesGood(site, item.good, ctx.content);
    if (!ok) ctx.problems.push(`${at} cargo ${index}: needs a known good, an amount and a landmark site that needs it`);
  });
}

function validateTransit(raw: unknown, at: string, placed: Map<number, Placed>, ctx: Ctx): void {
  if (!Array.isArray(raw)) {
    ctx.problems.push(`${at}: transit must be a list`);
    return;
  }
  const goods = new Set<string>(ctx.content.goods.map((g) => g.id));
  let lastId = 0;
  raw.forEach((item: unknown, index: number) => {
    const where = `${at} shipment ${index}`;
    if (!isRecord(item)) {
      ctx.problems.push(`${where}: not an object`);
      return;
    }
    if (takeId(item.id, lastId, where, ctx)) lastId = item.id;
    const ok =
      goods.has(item.good as string) &&
      isWhole(item.amount) &&
      item.amount > 0 &&
      placed.has(item.from as number) &&
      takesGood(placed.get(item.to as number), item.good, ctx.content) &&
      isWhole(item.arriveTick) &&
      item.arriveTick > ctx.tick;
    if (!ok) {
      ctx.problems.push(`${where}: needs a known good, an amount, a building that takes it and a future arrival tick`);
    }
  });
}

/** A landmark site never has more of a material on site, on the roads and in the ferry's hold than it needs. */
function validateSiteTotals(raw: Record<string, unknown>, at: string, placed: Map<number, Placed>, ctx: Ctx): void {
  const onTheWay = new Map<string, number>();
  for (const list of [raw.cargo, raw.transit]) {
    if (!Array.isArray(list)) continue;
    for (const item of list as unknown[]) {
      if (!isRecord(item) || !isCount(item.amount) || !isWhole(item.to)) continue;
      const key = `${item.to}/${String(item.good)}`;
      onTheWay.set(key, (onTheWay.get(key) ?? 0) + item.amount);
    }
  }
  for (const [id, { def, built, stock }] of placed) {
    if (!def.landmark || built) continue;
    for (const { good, amount } of def.landmark.materials) {
      const held = isRecord(stock) && isCount(stock[good]) ? stock[good] : 0;
      if (held + (onTheWay.get(`${id}/${good}`) ?? 0) > amount) {
        ctx.problems.push(`${at}: more ${good} is held for building ${id} than the landmark needs`);
      }
    }
  }
}

function validateAutoSell(raw: unknown, at: string, ctx: Ctx): void {
  goodsRecord(raw, `${at} autoSell`, ctx, true);
}

function validateStaff(raw: unknown, at: string, ctx: Ctx): void {
  if (!Array.isArray(raw)) {
    ctx.problems.push(`${at}: staff must be a list`);
    return;
  }
  let lastId = 0;
  raw.forEach((member: unknown, index: number) => {
    const where = `${at} staff ${index}`;
    if (!isRecord(member)) {
      ctx.problems.push(`${where}: not an object`);
      return;
    }
    if (takeId(member.id, lastId, where, ctx)) lastId = member.id;
    const ok =
      member.role === 'port-master' &&
      typeof member.name === 'string' &&
      STAFF_NAME.test(member.name) &&
      isCount(member.look, LOOKS - 1);
    if (!ok) ctx.problems.push(`${where}: needs a known role, a plain name and a look from 0 to ${LOOKS - 1}`);
  });
}

function validateProgress(raw: Record<string, unknown>, at: string, ctx: Ctx): void {
  const landmarks = ctx.content.buildings.filter((b) => b.landmark).map((b) => b.id as string);
  const goals = ctx.content.goals.map((g) => g.id as string);
  const unlocked = raw.unlockedLandmarks;
  if (!isIdList(unlocked, landmarks)) ctx.problems.push(`${at}: unlockedLandmarks must be unique landmark ids`);
  const completed = raw.completedGoals;
  if (!isIdList(completed, goals)) ctx.problems.push(`${at}: completedGoals must be unique goal ids`);
  const rewards = raw.rewards;
  const rewardsOk = isIdList(rewards, goals) && Array.isArray(completed) && rewards.every((id) => completed.includes(id));
  if (!rewardsOk) ctx.problems.push(`${at}: rewards must be unique ids of completed goals`);
}

function isIdList(value: unknown, known: readonly string[]): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((id) => typeof id === 'string' && known.includes(id)) &&
    new Set(value).size === value.length
  );
}
