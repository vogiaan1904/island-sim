import type { Content } from '@island/content';
import type { PlayerCommand } from '@island/protocol';
import { checkRoad, type IslandState } from '@island/sim';
import { type PlacementLabel, type PlacementVerdict } from './verdict.ts';
import type { Tile } from './draft.ts';
import { needMoreText } from '../ui/coins.ts';

// The road drag's answer (spec: Placement), in the same shape as a building's so the panel needs no second path. The
// sim's own `checkRoad` (the check `place-road` acts on) decides; only the words and the length limit label live here.
// A test holds this to the real command on every tile.

const NOTHING: PlacementVerdict = { ok: false, labels: [], costCents: 0, shortfallCents: 0, reason: 'nothing-to-build', command: null };

export function roadVerdict(island: IslandState, content: Content, tiles: readonly Tile[]): PlacementVerdict {
  if (tiles.length === 0) return NOTHING;
  const limit = content.rules.maxRoadTilesPerCommand;
  if (tiles.length > limit) {
    return {
      ok: false,
      labels: [{ id: 'length', ok: false, text: `Up to ${limit} tiles at a time` }],
      costCents: 0,
      shortfallCents: 0,
      reason: 'too-many-tiles',
      command: null,
    };
  }
  const report = checkRoad(island, content, tiles.map(({ x, y }) => [x, y]));
  const { reason, costCents, shortfallCents } = report;
  const labels: PlacementLabel[] = [];
  if (report.problems.includes('out-of-bounds')) labels.push({ id: 'in-bounds', ok: false, text: 'Off the island' });
  if (report.problems.includes('bad-terrain')) labels.push({ id: 'terrain', ok: false, text: 'Needs dry land' });
  if (report.problems.includes('tile-occupied')) labels.push({ id: 'free', ok: false, text: 'Something is in the way' });
  if (reason === 'nothing-to-build') return NOTHING;
  if (reason === 'not-enough-coins') labels.push({ id: 'affordable', ok: false, text: needMoreText(shortfallCents) });
  if (reason === null && tiles.length === limit) labels.push({ id: 'length', ok: true, text: `That is the most for one go (${limit} tiles)` });
  const command: PlayerCommand | null = reason === null ? { type: 'place-road', tiles: tiles.map(({ x, y }) => [x, y] as [number, number]) } : null;
  return { ok: reason === null, labels, costCents, shortfallCents, reason, command };
}
