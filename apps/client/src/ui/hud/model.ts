import type { BuildingDef, Content, GoalDef, GoalId, NeedId, StageId } from '@island/content';
import { isBuilt, residentsOf, type IslandState } from '@island/sim';
import type { IconName } from '../icons.tsx';
import { BUILDING_NAMES, NEED_WORDS } from '../names.ts';

// What the HUD shows, worked out from the island and the content data alone (no React, no store): every number the
// HUD draws comes from here, so it can be tested against real islands. The rules (what unlocks a landmark, what a
// goal asks for) stay in the sim and content; this only reads them.

/** The badge ring: residents toward the landmark's unlock, then the landmark itself, then nothing left to do. */
export interface StageRing {
  phase: 'residents' | 'landmark' | 'complete';
  /** 0 to 1. */
  fraction: number;
}

/** A goal icon: the picture is a rendered building (`/icons/...`) or a line icon. */
export type GoalPicture = { kind: 'building'; building: BuildingDef['id'] } | { kind: 'icon'; name: IconName };

export interface GoalTile {
  kind: 'goal' | 'need';
  /** A goal id or a need id. */
  id: GoalId | NeedId;
  picture: GoalPicture;
  /** One plain sentence: the tile's accessible name and its hover hint. */
  label: string;
  /** 0 to 1, drawn as the thin bar under the icon. */
  fraction: number;
}

export interface HudModel {
  stage: StageId;
  /** Whole coins (cents divided by 100, rounded down). */
  coins: number;
  /** Everyone who lives on the island, children included. */
  residents: number;
  /** Commuters on the island today, only while the island is in Outpost; null otherwise. */
  commuters: number | null;
  ring: StageRing;
  goals: GoalTile[];
}

/** At most this many goal icons at once: the next targets and what the homes lack (island-ui: keep them few). */
const MAX_TILES = 3;

export function hudModel(island: IslandState, content: Content): HudModel {
  const residents = residentsOf(island);
  const stageOrder = orderOf(content, island.stage);
  return {
    stage: island.stage,
    coins: Math.floor(island.coinsCents / 100),
    residents,
    commuters: stageOrder === 1 ? island.commuters.present : null,
    ring: stageRing(island, content, residents),
    goals: goalTiles(island, content, residents),
  };
}

function orderOf(content: Content, stage: StageId): number {
  return content.stages.find((s) => s.id === stage)?.order ?? 0;
}

/** The landmark of the next stage up: the one whose finishing starts a later stage than the island's. */
function nextLandmark(island: IslandState, content: Content): BuildingDef | null {
  const here = orderOf(content, island.stage);
  let best: BuildingDef | null = null;
  let bestOrder = Infinity;
  for (const def of content.buildings) {
    if (def.landmark === null) continue;
    const order = orderOf(content, def.landmark.startsStage);
    if (order > here && order < bestOrder) {
      best = def;
      bestOrder = order;
    }
  }
  return best;
}

function stageRing(island: IslandState, content: Content, residents: number): StageRing {
  const def = nextLandmark(island, content);
  const landmark = def?.landmark;
  if (def === null || landmark === null || landmark === undefined) return { phase: 'complete', fraction: 1 };
  // Once unlocked, a landmark stays unlocked (spec 12.1): the ring stays in the landmark phase if residents leave.
  if (!island.unlockedLandmarks.includes(def.id)) {
    return { phase: 'residents', fraction: Math.min(1, residents / landmark.unlockResidents) };
  }
  const site = island.buildings.find((b) => b.type === def.id);
  if (site === undefined) return { phase: 'landmark', fraction: 0 };
  // Construction waits for all the materials, so they fill the first half and the building work the second.
  const needed = landmark.materials.reduce((sum, m) => sum + m.amount, 0);
  const onSite = landmark.materials.reduce((sum, m) => sum + Math.min(m.amount, site.stock[m.good] ?? 0), 0);
  const materials = needed === 0 ? 1 : onSite / needed;
  if (materials < 1) return { phase: 'landmark', fraction: materials / 2 };
  const building = def.buildTicks === 0 ? 1 : 1 - site.constructionLeft / def.buildTicks;
  return { phase: 'landmark', fraction: 0.5 + building / 2 };
}

function goalTiles(island: IslandState, content: Content, residents: number): GoalTile[] {
  const open = content.goals.filter((g) => orderOf(content, g.stage) <= orderOf(content, island.stage) && !island.completedGoals.includes(g.id));
  const goals = open.map((goal) => goalTile(goal, island, content, residents));
  const needs = needTiles(island, content);
  // The next target first, then what is lacking, then a second target if there is room (never more than two targets).
  const tiles = [...goals.slice(0, 1), ...needs.slice(0, 2)];
  return tiles.length < MAX_TILES ? [...tiles, ...goals.slice(1, 2)] : tiles;
}

function goalTile(goal: GoalDef, island: IslandState, content: Content, residents: number): GoalTile {
  const target = goal.target;
  if (target.kind === 'residents') {
    return {
      kind: 'goal',
      id: goal.id,
      picture: { kind: 'icon', name: 'users' },
      label: `Have ${target.count} ${target.count === 1 ? 'resident' : 'residents'}`,
      fraction: Math.min(1, residents / target.count),
    };
  }
  const built = island.buildings.filter((b) => b.type === target.building && isBuilt(b)).length;
  const def = content.buildings.find((b) => b.id === target.building);
  const name = BUILDING_NAMES[target.building];
  const phrase = def?.landmark ? `the ${name}` : `a ${name.toLowerCase()}`;
  return {
    kind: 'goal',
    id: goal.id,
    picture: { kind: 'building', building: target.building },
    label: `Build ${phrase}`,
    fraction: Math.min(1, built / target.count),
  };
}

const NEED_ICONS: Record<NeedId, IconName> = { food: 'bread', water: 'droplet' };

/** One tile per need that some home lacks, filled by the share of lived-in homes where it is met. */
function needTiles(island: IslandState, content: Content): GoalTile[] {
  const lived = island.buildings.filter((b) => b.home !== null && b.home.residents > 0);
  const tiles: GoalTile[] = [];
  for (const need of content.needs) {
    const lacking = lived.filter((b) => b.home?.unmetNeeds.includes(need.id)).length;
    if (lacking === 0) continue;
    tiles.push({
      kind: 'need',
      id: need.id,
      picture: { kind: 'icon', name: NEED_ICONS[need.id] },
      label: `Homes need ${NEED_WORDS[need.id]}`,
      fraction: (lived.length - lacking) / lived.length,
    });
  }
  return tiles;
}
