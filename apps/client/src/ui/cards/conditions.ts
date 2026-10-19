import type { BuildingDef, BuildingId, Content, GoodId } from '@island/content';
import type { PlayerCommand } from '@island/protocol';
import {
  footprintSize,
  HIGH_PRIORITY,
  isBuilt,
  materialLines,
  materialsCostCents,
  type MaterialLine,
  shownStatus,
  type BuildingState,
  type ConditionId,
  type IslandState,
  type MarketState,
} from '@island/sim';
import { footprintCenter } from '../../render/instances.ts';
import type { IconName } from '../icons.tsx';
import { BUILDING_NAMES, GOOD_NAMES } from '../names.ts';

// What a building's conditions mean to the player: the most important one in words, the cause of a problem with the
// one thing that fixes it (the Fix button), and the materials of a landmark site. Pure (no React, no store), so the
// card and the bubbles over the buildings (ticket 15) read the same words. Which condition is shown first is the sim's
// (`shownStatus`, spec 12.1 order); the sim also decides every outcome, this only says what happened and which command
// is worth sending. Wording follows island-ui's text-tone.md.

/** What the card and the bubbles read: the island, the content data, and the Mainland market for prices (null before it is known). */
export interface CardContext {
  island: IslandState;
  content: Content;
  market: MarketState | null;
}

/** A ground point in world units, where the camera is sent. */
export interface Spot {
  x: number;
  z: number;
}

export type Picture = { kind: 'building'; id: BuildingId } | { kind: 'good'; id: GoodId } | { kind: 'icon'; name: IconName };

export interface Status {
  condition: ConditionId | 'running';
  /** One short phrase, for example "Waiting for money". */
  words: string;
  /** True for the conditions the player can do something about (not "Being built" or "Working"). */
  problem: boolean;
  icon: IconName;
}

/**
 * Fix: one command when one action fixes the problem, otherwise the camera goes to the cause and the player is told why.
 * A command can still be refused by the server; `fallback` is where the camera then goes.
 */
export type Fix =
  | { kind: 'command'; command: PlayerCommand; /** What Fix will do, before it is tapped. */ says: string; fallback: Spot }
  | { kind: 'show'; at: Spot; why: string };

export interface Problem {
  condition: ConditionId;
  /** One sentence naming the cause, for example "The farm has no workers." */
  cause: string;
  picture: Picture;
  fix: Fix;
}

function defOf(content: Content, building: BuildingState): BuildingDef {
  const def = content.buildings.find((d) => d.id === building.type);
  if (def === undefined) throw new Error(`no building definition for ${building.type}`);
  return def;
}

/** Where the scene draws the building: the center of its footprint. "Show me" and Fix fly here. */
export function buildingSpot(building: BuildingState, content: Content): Spot {
  const { w, h } = footprintSize(defOf(content, building), building.rotation);
  return footprintCenter(building.x, building.y, w, h);
}

/** "the farm", "the Island Hall": the name as a sentence uses it. */
function theName(def: BuildingDef): string {
  const name = BUILDING_NAMES[def.id];
  return `the ${def.landmark === null ? name.toLowerCase() : name}`;
}

function sentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Whole coins with a thousands separator, rounded up so that paying the amount is enough. */
export function coinsWords(cents: number): string {
  return Math.ceil(cents / 100).toLocaleString('en-US');
}

function staffed(building: BuildingState): number {
  return building.work === null ? 0 : building.work.residents + building.work.commuters;
}

function workersMissing(building: BuildingState, def: BuildingDef): number {
  return Math.max(0, def.jobs - staffed(building));
}

function workers(count: number): string {
  return `${count} more ${count === 1 ? 'worker' : 'workers'}`;
}

/** The goods a landmark site still lacks in its stock (the sim's `missing-input` for a site), in material order. */
function goodsLacking(building: BuildingState, def: BuildingDef): GoodId[] {
  return (def.landmark?.materials ?? []).filter((m) => (building.stock[m.good] ?? 0) < m.amount).map((m) => m.good);
}

function goodsList(goods: readonly GoodId[]): string {
  const names = goods.map((g) => GOOD_NAMES[g].toLowerCase());
  return names.length <= 1 ? (names[0] ?? 'goods') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** The most important condition of the building in words, from the sim's `shownStatus`. */
export function statusOf(building: BuildingState, ctx: CardContext): Status {
  const def = defOf(ctx.content, building);
  const condition = shownStatus(building);
  switch (condition) {
    case 'under-construction':
      return { condition, words: 'Being built', problem: false, icon: 'hammer' };
    case 'damaged':
      return { condition, words: 'Damaged, needs repair', problem: true, icon: 'alert' };
    case 'waiting-for-money':
      return { condition, words: 'Waiting for money', problem: true, icon: 'coin' };
    case 'no-workers':
      return { condition, words: 'No workers', problem: true, icon: 'userx' };
    case 'understaffed':
      return { condition, words: `Needs ${workers(workersMissing(building, def))}`, problem: true, icon: 'users' };
    case 'missing-input': {
      const lacking = goodsLacking(building, def);
      return { condition, words: `Waiting for ${goodsList(lacking)}`, problem: true, icon: 'alert' };
    }
    case 'no-power':
      return { condition, words: 'No power', problem: true, icon: 'alert' };
    case 'output-full':
      return { condition, words: 'Storage is full', problem: true, icon: 'layers' };
    case 'running':
      if (building.home !== null) return { condition, words: building.home.residents > 0 ? 'Lived in' : 'Empty', problem: false, icon: 'smile' };
      return { condition, words: 'Working', problem: false, icon: 'check' };
  }
}

function dockOf(island: IslandState): BuildingState | null {
  return island.buildings.find((b) => b.type === 'dock') ?? null;
}

/** The closest finished store (dock or warehouse) other than the building itself, by tiles; the dock when none is closer. */
function nearestStore(building: BuildingState, ctx: CardContext): BuildingState | null {
  let best: BuildingState | null = null;
  let bestDistance = Infinity;
  for (const other of ctx.island.buildings) {
    if (other.id === building.id || !isBuilt(other) || !defOf(ctx.content, other).isStore) continue;
    const distance = Math.abs(other.x - building.x) + Math.abs(other.y - building.y);
    if (distance < bestDistance) {
      best = other;
      bestDistance = distance;
    }
  }
  return best;
}

/** The dock's spot (where ferries and commuters land), or the building's own when the island has no dock. */
export function dockSpot(building: BuildingState, ctx: CardContext): Spot {
  return buildingSpot(dockOf(ctx.island) ?? building, ctx.content);
}

function show(at: BuildingState | null, building: BuildingState, ctx: CardContext, why: string): Fix {
  return { kind: 'show', at: buildingSpot(at ?? building, ctx.content), why };
}

function staffingFix(building: BuildingState, def: BuildingDef, ctx: CardContext): Fix {
  const { island, content } = ctx;
  const missing = workersMissing(building, def);
  const dock = dockOf(island);
  const here = buildingSpot(building, content);
  // Free workers exist but go to buildings first in line: put this one ahead of them.
  const taken = island.buildings.some(
    (o) => o.id !== building.id && staffed(o) > 0 && (o.priority < HIGH_PRIORITY || (o.priority === HIGH_PRIORITY && o.id > building.id)),
  );
  if (building.priority < HIGH_PRIORITY && taken) {
    return {
      kind: 'command',
      command: { type: 'set-priority', buildingId: building.id, priority: HIGH_PRIORITY },
      says: `Fix puts ${theName(def)} first in line for workers.`,
      fallback: here,
    };
  }
  const { hired, present } = island.commuters;
  const coming = Math.max(0, hired - present);
  if (coming > 0 && coming >= missing) {
    return show(dock, building, ctx, `${coming} ${coming === 1 ? 'commuter comes' : 'commuters come'} with the morning ferry. They will work here when they land.`);
  }
  const seats = content.rules.ferrySeats;
  if (hired >= seats) {
    return show(dock, building, ctx, 'The ferry is full. More workers come when homes are built, or when a seat frees up.');
  }
  const count = Math.min(seats, Math.max(hired, present + missing));
  return {
    kind: 'command',
    command: { type: 'hire-commuters', count },
    says: `Fix hires ${count - present} ${count - present === 1 ? 'commuter' : 'commuters'}. They arrive with the morning ferry.`,
    fallback: buildingSpot(dock ?? building, content),
  };
}

function materialsFix(building: BuildingState, def: BuildingDef, ctx: CardContext): Fix {
  const dock = dockOf(ctx.island);
  const materials = landmarkMaterials(building, ctx);
  if (materials === null) return show(null, building, ctx, 'Materials are on their way.');
  const missing = materials.lines.reduce((sum, line) => sum + line.missing, 0);
  const onTheFerry = materials.lines.some((line) => line.onTheFerry > 0);
  if (missing === 0) {
    return show(dock, building, ctx, onTheFerry ? 'The materials are bought and come on the next ferry.' : 'The materials are on their way to the site.');
  }
  if (materials.shortfallCents > 0) {
    return show(dock, building, ctx, `Need ${coinsWords(materials.shortfallCents)} more coins to buy the missing ${goodsList(goodsLacking(building, def))}. Selling goods in Trade earns them.`);
  }
  return {
    kind: 'command',
    command: { type: 'buy-materials', buildingId: building.id },
    says: `Fix buys the missing ${goodsList(goodsLacking(building, def))} from the Mainland. It comes on the next ferry.`,
    fallback: buildingSpot(dock ?? building, ctx.content),
  };
}

/**
 * The cause of the building's most important problem, with its Fix, or null when it has none (it is running, or only
 * being built). A landmark site that waits for materials is a problem though "Being built" is its shown status.
 */
export function problemOf(building: BuildingState, ctx: CardContext): Problem | null {
  const def = defOf(ctx.content, building);
  const condition = building.conditions.find((c) => c !== 'under-construction');
  if (condition === undefined) return null;
  const name = theName(def);
  const self: Picture = { kind: 'building', id: def.id };
  switch (condition) {
    case 'waiting-for-money':
      return {
        condition,
        cause: sentence(`${name} has no coins for its running costs.`),
        picture: { kind: 'icon', name: 'coin' },
        fix: show(dockOf(ctx.island), building, ctx, 'The coins ran short for its running costs. It works slower until they are paid; selling goods in Trade earns coins.'),
      };
    case 'no-workers':
      return { condition, cause: sentence(`${name} has no workers.`), picture: self, fix: staffingFix(building, def, ctx) };
    case 'understaffed':
      return { condition, cause: sentence(`${name} needs ${workers(workersMissing(building, def))}.`), picture: self, fix: staffingFix(building, def, ctx) };
    case 'missing-input': {
      const lacking = goodsLacking(building, def);
      return {
        condition,
        cause: sentence(`${name} is waiting for ${goodsList(lacking)}.`),
        picture: lacking[0] === undefined ? self : { kind: 'good', id: lacking[0] },
        fix: materialsFix(building, def, ctx),
      };
    }
    case 'output-full': {
      const store = nearestStore(building, ctx) ?? dockOf(ctx.island);
      return {
        condition,
        cause: sentence(`${name} is full of goods.`),
        picture: self,
        fix: show(store, building, ctx, 'Its goods wait to be carried to a store. Sell some in Trade, or build a warehouse.'),
      };
    }
    case 'damaged':
      return { condition, cause: sentence(`${name} is damaged.`), picture: self, fix: show(null, building, ctx, 'It needs a repair.') };
    case 'no-power':
      return { condition, cause: sentence(`${name} has no power.`), picture: self, fix: show(null, building, ctx, 'It needs power to work.') };
  }
}

export interface LandmarkMaterials {
  lines: MaterialLine[];
  /** What buying every missing unit costs now, in cents (0 while the market is unknown). */
  costCents: number;
  /** How many cents short the island is of buying them, 0 when it can pay. */
  shortfallCents: number;
}

/** The materials of a landmark site (a landmark still under construction), or null for any other building. */
export function landmarkMaterials(building: BuildingState, ctx: CardContext): LandmarkMaterials | null {
  const def = defOf(ctx.content, building);
  const landmark = def.landmark;
  if (landmark === null || isBuilt(building)) return null;
  const { island, content, market } = ctx;
  const lines = materialLines(island, building, content);
  const costCents = market === null ? 0 : materialsCostCents(market, content, lines);
  return { lines, costCents, shortfallCents: Math.max(0, costCents - island.coinsCents) };
}
