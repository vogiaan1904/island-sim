import type { Content } from '@island/content';
import type { PlayerCommand } from '@island/protocol';
import { footprintSize, footprintTiles, type IslandState, type ReasonCode } from '@island/sim';
import { needMoreCoins, type PlacementLabel, type PlacementVerdict } from './verdict.ts';
import type { Tile } from './draft.ts';

// The road drag's answer (spec: Placement), in the same shape as a building's so the panel needs no second path. The sim
// exports no road check, so the rule is written out here exactly as `place-road` reads it: one command, at most
// `maxRoadTilesPerCommand` tiles; each tile in order must be on the grid, land and free of buildings (the first bad one
// refuses the whole command); tiles that are road already are skipped and not charged; no new tile at all is
// 'nothing-to-build'; then the price per new tile against the coins. A test holds this to the real command on every tile.

/** The tiles under buildings, as a set of tile indexes. */
function builtOn(island: IslandState, content: Content): Set<number> {
  const size = content.rules.islandSize;
  const taken = new Set<number>();
  for (const building of island.buildings) {
    const def = content.buildings.find((d) => d.id === building.type);
    if (def === undefined) continue;
    const { w, h } = footprintSize(def, building.rotation);
    for (const [x, y] of footprintTiles(building.x, building.y, w, h)) taken.add(y * size + x);
  }
  return taken;
}

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
  const size = content.rules.islandSize;
  const taken = builtOn(island, content);
  const seen = new Set<number>();
  let fresh = 0;
  let reason: ReasonCode | null = null;
  const labels: PlacementLabel[] = [];
  const flag = (code: ReasonCode, label: PlacementLabel) => {
    reason ??= code;
    if (!labels.some((l) => l.id === label.id)) labels.push(label);
  };
  for (const { x, y } of tiles) {
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || x < 0 || y < 0 || x >= size || y >= size) {
      flag('out-of-bounds', { id: 'in-bounds', ok: false, text: 'Off the island' });
      continue;
    }
    const index = y * size + x;
    if (island.terrain[index] === '0') flag('bad-terrain', { id: 'terrain', ok: false, text: 'Needs dry land' });
    else if (taken.has(index)) flag('tile-occupied', { id: 'free', ok: false, text: 'Something is in the way' });
    else if (island.roads[index] !== '1' && !seen.has(index)) fresh += 1;
    seen.add(index);
  }
  const costCents = fresh * content.rules.roadPricePerTileCents;
  if (reason === null && fresh === 0) return { ok: false, labels: [], costCents: 0, shortfallCents: 0, reason: 'nothing-to-build', command: null };
  const shortfallCents = reason === null ? Math.max(0, costCents - island.coinsCents) : 0;
  if (reason === null && shortfallCents > 0) {
    reason = 'not-enough-coins';
    labels.push({ id: 'affordable', ok: false, text: needMoreCoins(shortfallCents) });
  }
  if (reason === null && tiles.length === limit) labels.push({ id: 'length', ok: true, text: `That is the most for one go (${limit} tiles)` });
  const command: PlayerCommand | null = reason === null ? { type: 'place-road', tiles: tiles.map(({ x, y }) => [x, y] as [number, number]) } : null;
  return { ok: reason === null, labels, costCents, shortfallCents, reason, command };
}
