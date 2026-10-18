import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { startDraft } from '../placement/draft.ts';
import { dustPuff, ghostInstance, landingBounce, LANDING_SECONDS } from './ghost.ts';
import { TILE_SIZE } from './look.ts';

describe('the ghost instance', () => {
  it('stands at the footprint center with the model of the building', () => {
    // A farm is 3 by 2 tiles; started at tile (10,10) its top-left tile is (9,9).
    const ghost = ghostInstance(startDraft('farm', { x: 10, y: 10 }, content), content);
    expect(ghost.file).toBe('building_farm_a.glb');
    expect(ghost).toMatchObject({ x: (9 + 1.5) * TILE_SIZE, z: (9 + 1) * TILE_SIZE, rotationY: 0, width: 3 * TILE_SIZE, depth: 2 * TILE_SIZE });
  });

  it('turns the model and swaps the footprint at an odd rotation, around the same center', () => {
    const draft = { ...startDraft('farm', { x: 10, y: 10 }, content), rotation: 1 as const, x: 9, y: 9 };
    const ghost = ghostInstance(draft, content);
    expect(ghost.rotationY).toBeCloseTo(Math.PI / 2);
    expect(ghost).toMatchObject({ width: 2 * TILE_SIZE, depth: 3 * TILE_SIZE, x: (9 + 1) * TILE_SIZE, z: (9 + 1.5) * TILE_SIZE });
  });
});

describe('the landing bounce', () => {
  it('drops in from above, squashes on landing and settles at the true size', () => {
    expect(landingBounce(0).lift).toBeGreaterThan(2);
    expect(landingBounce(0).squash).toBe(1);
    const lifts = [0, 0.03, 0.06, 0.09, 0.12].map((t) => landingBounce(t).lift);
    expect(lifts).toEqual([...lifts].sort((a, b) => b - a));
    expect(landingBounce(0.12).lift).toBe(0);
    const dip = Math.min(...[0.14, 0.18, 0.22, 0.26].map((t) => landingBounce(t).squash));
    expect(dip).toBeLessThan(0.95);
    expect(landingBounce(0.4)).toEqual({ lift: 0, squash: 1 });
    expect(landingBounce(LANDING_SECONDS)).toEqual({ lift: 0, squash: 1 });
  });
});

describe('the puff of dust', () => {
  it('spreads out from the footprint and fades, the same every time', () => {
    const early = dustPuff(0.2, 3, 8, 8);
    const late = dustPuff(0.5, 3, 8, 8);
    expect(Math.hypot(late.x, late.z)).toBeGreaterThan(Math.hypot(early.x, early.z));
    expect(late.opacity).toBeLessThan(early.opacity);
    expect(dustPuff(LANDING_SECONDS, 3, 8, 8).opacity).toBe(0);
    expect(dustPuff(0.5, 3, 8, 8)).toEqual(late);
  });

  it('sends the pieces in different directions', () => {
    const a = dustPuff(0.4, 0, 8, 8);
    const b = dustPuff(0.4, 4, 8, 8);
    expect(a.x).toBeCloseTo(-b.x);
    expect(a.z).toBeCloseTo(-b.z);
  });
});
