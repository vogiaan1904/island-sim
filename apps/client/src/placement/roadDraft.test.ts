import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import type { CommandState } from '../store/mirror.ts';
import { aimAt, clearRoad, drawRoad, lostDraft, penTo, removingTo, rotateDraft, sendingDraft, settleDraft, startRoadDraft, type PlacementDraft, type RoadDraft } from './draft.ts';

const size = content.rules.islandSize;
const NO_ROADS = '0'.repeat(size * size);

/** A roads string with road on these tiles. */
function roadsAt(...tiles: Array<[number, number]>): string {
  const chars = NO_ROADS.split('');
  for (const [x, y] of tiles) chars[y * size + x] = '1';
  return chars.join('');
}

const asRoad = (draft: PlacementDraft): RoadDraft => {
  if (draft.kind !== 'road') throw new Error('not a road draft');
  return draft;
};
const keys = (draft: PlacementDraft) => asRoad(draft).tiles.map((t) => `${t.x},${t.y}`);

/** One pointer move: the tile under the finger, as the camera rig reports it. */
const draw = (draft: PlacementDraft, x: number, y: number, begin = false, roads = NO_ROADS) => drawRoad(draft, { x, y }, begin, { content, roads });

describe('starting a road', () => {
  it('begins in drawing mode with no tiles, aiming', () => {
    expect(startRoadDraft()).toEqual({ kind: 'road', tiles: [], cursor: null, pen: 'draw', removing: false, phase: 'aiming', requestId: null, refusal: null });
  });
});

describe('removing road', () => {
  it('takes only tiles that are road while removing, and starts over when the mode changes', () => {
    const roads = roadsAt([5, 6], [6, 6]);
    const removing = removingTo(draw(startRoadDraft(), 2, 2, true), true);
    expect(asRoad(removing)).toMatchObject({ removing: true, tiles: [], cursor: null });
    const dragged = draw(draw(removing, 4, 6, true, roads), 8, 6, false, roads);
    expect(keys(dragged)).toEqual(['5,6', '6,6']);
    expect(asRoad(removingTo(dragged, false))).toMatchObject({ removing: false, tiles: [] });
    expect(removingTo(dragged, true)).toBe(dragged);
  });
});

describe('dragging a road along the grid', () => {
  it('takes the tile where the drag begins', () => {
    expect(keys(draw(startRoadDraft(), 5, 6, true))).toEqual(['5,6']);
  });

  it('adds every tile between two pointer samples, one step at a time and never on a diagonal', () => {
    let draft = draw(startRoadDraft(), 5, 6, true);
    draft = draw(draft, 8, 6);
    expect(keys(draft)).toEqual(['5,6', '6,6', '7,6', '8,6']);
    draft = draw(draft, 9, 8);
    const added = keys(draft).slice(4);
    expect(added).toHaveLength(3);
    // Each tile touches the one before by a side.
    const tiles = asRoad(draft).tiles;
    for (let i = 1; i < tiles.length; i += 1) {
      expect(Math.abs(tiles[i]!.x - tiles[i - 1]!.x) + Math.abs(tiles[i]!.y - tiles[i - 1]!.y)).toBe(1);
    }
    expect(asRoad(draft).cursor).toEqual({ x: 9, y: 8 });
  });

  it('does not repeat a tile when the drag comes back over it', () => {
    let draft = draw(startRoadDraft(), 5, 6, true);
    draft = draw(draft, 7, 6);
    draft = draw(draft, 5, 6);
    expect(keys(draft)).toEqual(['5,6', '6,6', '7,6']);
  });

  it('starts a second drag where it begins, not joined to the end of the first', () => {
    let draft = draw(startRoadDraft(), 5, 6, true);
    draft = draw(draft, 6, 6);
    draft = draw(draft, 12, 12, true);
    draft = draw(draft, 12, 13);
    expect(keys(draft)).toEqual(['5,6', '6,6', '12,12', '12,13']);
  });

  it('keeps tiles that are road already out of the draft but follows the drag across them', () => {
    const roads = roadsAt([6, 6], [7, 6]);
    let draft = draw(startRoadDraft(), 5, 6, true, roads);
    draft = draw(draft, 9, 6, false, roads);
    expect(keys(draft)).toEqual(['5,6', '8,6', '9,6']);
  });

  it('stops at the most the sim takes in one command', () => {
    const limit = content.rules.maxRoadTilesPerCommand;
    let draft = draw(startRoadDraft(), 0, 0, true);
    draft = draw(draft, 31, 0);
    draft = draw(draft, 31, 31);
    draft = draw(draft, 0, 31);
    expect(asRoad(draft).tiles).toHaveLength(limit);
  });

  it('keeps a tile off the grid on the nearest tile of it', () => {
    expect(keys(draw(startRoadDraft(), -4, 99, true))).toEqual(['0,31']);
  });

  it('forgets an old refusal as soon as the player draws', () => {
    const refused: RoadDraft = { ...startRoadDraft(), refusal: { reason: 'not-enough-coins', shortfallCents: 100 } };
    expect(asRoad(draw(refused, 1, 1, true)).refusal).toBeNull();
  });
});

describe('the pen: drawing or looking around', () => {
  it('draws nothing in looking mode, so a drag is left to the camera', () => {
    const looking = penTo(draw(startRoadDraft(), 3, 3, true), 'look');
    expect(asRoad(looking).pen).toBe('look');
    expect(draw(looking, 9, 3)).toBe(looking);
    expect(keys(looking)).toEqual(['3,3']);
  });

  it('goes back to drawing and starts the next drag fresh', () => {
    const looking = penTo(draw(startRoadDraft(), 3, 3, true), 'look');
    const drawing = penTo(looking, 'draw');
    expect(asRoad(drawing)).toMatchObject({ pen: 'draw', cursor: null, tiles: [{ x: 3, y: 3 }] });
  });

  it('leaves a building draft alone', () => {
    const building: PlacementDraft = { kind: 'building', building: 'farm', x: 1, y: 1, rotation: 0, phase: 'aiming', requestId: null, refusal: null };
    expect(penTo(building, 'look')).toBe(building);
  });
});

describe('starting over', () => {
  it('drops the tiles and stays in the same pen', () => {
    const cleared = clearRoad(penTo(draw(draw(startRoadDraft(), 3, 3, true), 5, 3), 'look'));
    expect(asRoad(cleared)).toMatchObject({ tiles: [], cursor: null, pen: 'look' });
  });

  it('does nothing while the command is out', () => {
    const placing = sendingDraft(draw(startRoadDraft(), 3, 3, true), 7);
    expect(clearRoad(placing)).toBe(placing);
  });
});

describe('a road draft is not aimed or turned like a building', () => {
  it('ignores a footprint aim and a quarter turn', () => {
    const road = draw(startRoadDraft(), 3, 3, true);
    expect(aimAt(road, { x: 9, y: 9 }, content)).toBe(road);
    expect(rotateDraft(road, content)).toBe(road);
  });
});

describe('the answer to Place for a road', () => {
  const placing = () => sendingDraft(draw(startRoadDraft(), 3, 3, true), 7);
  const ok = (requestId: number): CommandState => ({ requestId, command: { type: 'place-road', tiles: [[3, 3]] }, status: 'ok', data: { tilesBuilt: 1 } });

  it('lands on the server\'s ok, with no building to remember', () => {
    const landed = settleDraft(placing(), ok(7));
    expect(landed).toMatchObject({ kind: 'road', phase: 'landing' });
    expect(landed).not.toHaveProperty('landedBuildingId');
  });

  it('goes back to drawing with the reason on a refusal, keeping the tiles', () => {
    const refused: CommandState = { requestId: 7, command: { type: 'place-road', tiles: [[3, 3]] }, status: 'refused', reason: 'not-enough-coins', shortfallCents: 2_000 };
    expect(settleDraft(placing(), refused)).toMatchObject({ phase: 'aiming', requestId: null, refusal: { reason: 'not-enough-coins', shortfallCents: 2_000 }, tiles: [{ x: 3, y: 3 }] });
  });

  it('is calmly back to drawing when the connection dropped', () => {
    expect(lostDraft(placing())).toMatchObject({ phase: 'aiming', refusal: { reason: 'world-catching-up' } });
  });
});
