import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import type { CommandState } from '../store/mirror.ts';
import { aimAt, aimPoint, groundTile, lostDraft, rotateDraft, sendingDraft, settleDraft, startDraft, tileAtWorld, TOUCH_LIFT_PX } from './draft.ts';

const farm = (x: number, y: number) => startDraft('farm', { x, y }, content);

describe('starting and aiming a draft', () => {
  it('centers the footprint on the tile it starts at', () => {
    // A farm is 3 wide and 2 tall: the tile under the aim is its middle column, lower row.
    const draft = farm(10, 10);
    expect(draft).toMatchObject({ kind: 'building', building: 'farm', rotation: 0, phase: 'aiming', x: 9, y: 9, requestId: null, refusal: null });
  });

  it('moves with the tile under the aim and forgets an old refusal', () => {
    const refused = { ...farm(10, 10), refusal: { reason: 'tile-occupied' as const, shortfallCents: 0 } };
    const moved = aimAt(refused, { x: 20, y: 5 }, content);
    expect(moved).toMatchObject({ x: 19, y: 4, refusal: null });
  });

  it('does not move while the command is out, or once it landed', () => {
    const placing = sendingDraft(farm(10, 10), 7);
    expect(aimAt(placing, { x: 1, y: 1 }, content)).toBe(placing);
  });

  it('returns the same draft when the aim has not moved to another tile, so a pointer move costs nothing', () => {
    const draft = farm(10, 10);
    expect(aimAt(draft, { x: 10, y: 10 }, content)).toBe(draft);
  });

  it('allows tiles off the grid, so the ghost can show it is off the island', () => {
    expect(aimAt(farm(10, 10), { x: -3, y: 40 }, content)).toMatchObject({ x: -4, y: 39 });
  });
});

describe('rotating', () => {
  it('turns a quarter and keeps the same middle tile', () => {
    const turned = rotateDraft(farm(10, 10), content);
    // 3x2 becomes 2x3, around the middle tile (10,10): columns 9..10, rows 9..11.
    expect(turned).toMatchObject({ rotation: 1, x: 9, y: 9 });
    expect(rotateDraft(turned, content)).toMatchObject({ rotation: 2, x: 9, y: 9 });
    expect(rotateDraft(rotateDraft(rotateDraft(turned, content), content), content)).toMatchObject({ rotation: 0, x: 9, y: 9 });
  });

  it('does nothing while the command is out', () => {
    const placing = sendingDraft(farm(10, 10), 7);
    expect(rotateDraft(placing, content)).toBe(placing);
  });
});

describe('the aim point', () => {
  it('sits above a finger so the finger never covers the ghost, and right on the cursor of a mouse', () => {
    expect(aimPoint({ x: 100, y: 300 }, 'touch')).toEqual({ x: 100, y: 300 - TOUCH_LIFT_PX });
    expect(aimPoint({ x: 100, y: 300 }, 'mouse')).toEqual({ x: 100, y: 300 });
  });

  it('never goes above the top of the screen', () => {
    expect(aimPoint({ x: 5, y: 10 }, 'touch').y).toBe(0);
  });
});

describe('the answer to Place', () => {
  const sent = sendingDraft(farm(10, 10), 4);
  const state = (partial: Partial<CommandState> & { status: CommandState['status'] }) =>
    ({ requestId: 4, command: { type: 'place-building', building: 'farm', x: 9, y: 9, rotation: 0 }, ...partial }) as CommandState;

  it('shows the placing state with the request it waits for', () => {
    expect(sent).toMatchObject({ phase: 'placing', requestId: 4 });
  });

  it('keeps waiting while the result has not come', () => {
    expect(settleDraft(sent, state({ status: 'pending' }))).toBe(sent);
    expect(settleDraft(sent, undefined)).toBe(sent);
  });

  it('lands only on the server\'s ok, with the building the server made', () => {
    const landed = settleDraft(sent, state({ status: 'ok', data: { buildingId: 12 } }));
    expect(landed).toMatchObject({ phase: 'landing', landedBuildingId: 12, refusal: null });
  });

  it('goes back to aiming with the reason on a refusal', () => {
    const back = settleDraft(sent, state({ status: 'refused', reason: 'tile-occupied', shortfallCents: 0 }));
    expect(back).toMatchObject({ phase: 'aiming', requestId: null, refusal: { reason: 'tile-occupied', shortfallCents: 0 } });
    expect(back).not.toHaveProperty('landedBuildingId');
  });

  it('ignores the result of another request', () => {
    const other = { requestId: 5, command: sent.kind === 'building' ? { type: 'place-building', building: 'farm', x: 1, y: 1, rotation: 0 } : null, status: 'ok', data: { buildingId: 1 } } as CommandState;
    expect(settleDraft(sent, other)).toBe(sent);
  });
});

describe('a command that never gets its answer', () => {
  it('goes back to aiming with a calm reason, so the player is never stuck on "placing"', () => {
    const back = lostDraft(sendingDraft(farm(10, 10), 4));
    expect(back).toMatchObject({ phase: 'aiming', requestId: null, refusal: { reason: 'world-catching-up' } });
  });
});

describe('the tile under a world point', () => {
  it('is the tile the point falls in, kept on the grid', () => {
    expect(tileAtWorld(0.5, 7.9, content)).toEqual({ x: 0, y: 1 });
    expect(tileAtWorld(63.9, 64, content)).toEqual({ x: 15, y: 16 });
    expect(tileAtWorld(-20, 999, content)).toEqual({ x: 0, y: 63 });
  });
});

describe('the tile under a ground point', () => {
  it('floors to the tile and is not kept on the grid, so the ghost can leave the island', () => {
    expect(groundTile({ x: 9.9, z: 4 })).toEqual({ x: 2, y: 1 });
    expect(groundTile({ x: -0.1, z: 200 })).toEqual({ x: -1, y: 50 });
  });
});
