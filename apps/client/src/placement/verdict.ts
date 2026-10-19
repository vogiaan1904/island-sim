import type { BuildingDef, BuildingId, Content } from '@island/content';
import type { PlayerCommand } from '@island/protocol';
import { checkPlacement, type IslandState, type PlacementCheckId, type ReasonCode, type Rotation } from '@island/sim';
import { BUILDING_NAMES } from '../ui/names.ts';
import { coinsHeld, coinsShort, needMoreText } from '../ui/coins.ts';

// The placement module's answer (spec: Placement). Given the mirrored island and what the player is aiming at, it says
// what the sim would say: whether the spot passes, which check blocks it, the labels in words, the price and the
// command to send. It calls the sim's own `checkPlacement` on the mirrored state and re-implements no rule; the only
// thing written here is the order the sim's place-building command looks at things (what the player may place at all,
// then the five checks), and a test holds that order to the real command on every tile.
//
// The shape is shared by everything the player can place. A road drag (ticket 13) adds its own function returning the
// same `PlacementVerdict`, so the panel, the labels and the Place button need no change.

/** What a building draft aims at: the building, the top-left tile of its turned footprint, and the rotation. */
export interface BuildingAim {
  building: BuildingId;
  x: number;
  y: number;
  rotation: Rotation;
}

export interface PlacementLabel {
  /** The sim's check, or 'locked' for a building the island cannot place yet. */
  id: PlacementCheckId | 'locked' | 'length';
  ok: boolean;
  text: string;
}

export interface PlacementVerdict {
  /** True when the sim's place-building command would take it (the price is part of that). */
  ok: boolean;
  /** Short words for what is right or wrong here, in the order the sim checks. Only what helps the player. */
  labels: PlacementLabel[];
  /** What it costs, in cents (a building's price; a road's cents per new tile times the tiles). */
  costCents: number;
  /** Cents the island is short of that price; 0 when it can pay. */
  shortfallCents: number;
  /** The reason code the sim would refuse with, or null when it would take it. */
  reason: ReasonCode | null;
  /** The command to send. Null while the spot is blocked, so a blocked spot can never be sent by mistake. */
  command: PlayerCommand | null;
}

function defOf(content: Content, id: BuildingId): BuildingDef | undefined {
  return content.buildings.find((def) => def.id === id);
}

function stageOrder(content: Content, island: IslandState): number {
  return content.stages.find((stage) => stage.id === island.stage)?.order ?? 0;
}

/** Why the island cannot place this building at all right now (before any tile matters), or null. */
function unavailable(island: IslandState, content: Content, def: BuildingDef): { reason: ReasonCode; text: string } | null {
  if (!def.playerBuildable) return { reason: 'not-player-buildable', text: 'The game places this one itself' };
  const from = content.stages.find((stage) => stage.id === def.availableFrom)?.order ?? 0;
  if (from > stageOrder(content, island)) return { reason: 'not-available-yet', text: 'Not available yet' };
  if (def.landmark !== null) {
    if (!island.unlockedLandmarks.includes(def.id)) return { reason: 'landmark-locked', text: `Unlocks with ${def.landmark.unlockResidents} residents` };
    if (island.buildings.some((building) => building.type === def.id)) return { reason: 'already-built', text: 'Already built' };
  }
  return null;
}

const REASON_FOR_CHECK: Record<PlacementCheckId, ReasonCode> = {
  'in-bounds': 'out-of-bounds',
  terrain: 'bad-terrain',
  free: 'tile-occupied',
  'road-access': 'no-road-access',
  affordable: 'not-enough-coins',
};

export function buildingVerdict(island: IslandState, content: Content, aim: BuildingAim): PlacementVerdict {
  const def = defOf(content, aim.building);
  if (def === undefined) return { ok: false, labels: [], costCents: 0, shortfallCents: 0, reason: 'unknown-building', command: null };
  const blocked = unavailable(island, content, def);
  if (blocked !== null) {
    return {
      ok: false,
      labels: [{ id: 'locked', ok: false, text: blocked.text }],
      costCents: def.priceCents,
      shortfallCents: 0,
      reason: blocked.reason,
      command: null,
    };
  }
  const report = checkPlacement(island, content, def, aim.x, aim.y, aim.rotation);
  const passed = new Map(report.checks.map((check) => [check.id, check.ok]));
  const labels: PlacementLabel[] = [];
  const inBounds = passed.get('in-bounds') === true;
  if (!inBounds) labels.push({ id: 'in-bounds', ok: false, text: 'Off the island' });
  else {
    const shore = def.placement === 'shore';
    const terrain = passed.get('terrain') === true;
    if (!terrain) labels.push({ id: 'terrain', ok: false, text: shore ? 'Needs the shore' : 'Needs dry land' });
    else if (shore) labels.push({ id: 'terrain', ok: true, text: 'On the shore' });
    if (passed.get('free') !== true) labels.push({ id: 'free', ok: false, text: 'Something is in the way' });
    if (def.needsRoad) {
      const ok = passed.get('road-access') === true;
      labels.push({ id: 'road-access', ok, text: ok ? 'Road access' : 'Needs a road beside it' });
    }
  }
  if (passed.get('affordable') !== true) labels.push({ id: 'affordable', ok: false, text: needMoreText(report.shortfallCents) });
  const failed = report.checks.find((check) => !check.ok);
  return {
    ok: report.ok,
    labels,
    costCents: def.priceCents,
    shortfallCents: report.shortfallCents,
    reason: failed === undefined ? null : REASON_FOR_CHECK[failed.id],
    command: report.ok ? { type: 'place-building', building: def.id, x: aim.x, y: aim.y, rotation: aim.rotation } : null,
  };
}

/** How a building shows in the Build picker. */
export type OptionState =
  | { kind: 'ready' }
  | { kind: 'short'; coins: number; text: string }
  | { kind: 'locked'; text: string };

export interface BuildingOption {
  id: BuildingId;
  name: string;
  /** Whole coins, as the HUD shows money. */
  coins: number;
  state: OptionState;
}

/**
 * The buildings the player can place, in content order: the price, and whether the island can pay now, is short of
 * coins (still pickable: the ghost shows and Place waits), or cannot place it yet (what unlocks it).
 */
export function buildingOptions(island: IslandState, content: Content): BuildingOption[] {
  return content.buildings
    .filter((def) => def.playerBuildable)
    .map((def): BuildingOption => {
      const base = { id: def.id, name: BUILDING_NAMES[def.id], coins: coinsHeld(def.priceCents) };
      const blocked = unavailable(island, content, def);
      if (blocked !== null) return { ...base, state: { kind: 'locked', text: blocked.text } };
      const shortCents = Math.max(0, def.priceCents - island.coinsCents);
      if (shortCents > 0) return { ...base, state: { kind: 'short', coins: coinsShort(shortCents), text: needMoreText(shortCents) } };
      return { ...base, state: { kind: 'ready' } };
    });
}
