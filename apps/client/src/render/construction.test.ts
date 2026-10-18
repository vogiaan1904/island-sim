import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { CONSTRUCTION_STEPS, constructionRise, constructionStep } from './construction.ts';

const farm = content.buildings.find((d) => d.id === 'farm')!;

describe('construction steps', () => {
  it('starts at step 0 the moment the site is placed, with no building above the ground yet', () => {
    expect(constructionStep(farm.buildTicks, farm.buildTicks)).toBe(0);
    expect(constructionRise(0)).toBe(0);
  });

  it('advances one step per equal share of the build time', () => {
    const share = farm.buildTicks / CONSTRUCTION_STEPS;
    for (let step = 0; step < CONSTRUCTION_STEPS; step += 1) {
      const left = farm.buildTicks - Math.ceil(step * share);
      expect(constructionStep(left, farm.buildTicks), `step ${step}`).toBe(step);
    }
  });

  it('never goes backwards as ticks pass, and stays below the last step until the site is built', () => {
    let previous = 0;
    for (let left = farm.buildTicks; left >= 1; left -= 1) {
      const step = constructionStep(left, farm.buildTicks);
      expect(step).toBeGreaterThanOrEqual(previous);
      expect(step).toBeLessThan(CONSTRUCTION_STEPS);
      previous = step;
    }
    expect(previous).toBe(CONSTRUCTION_STEPS - 1);
  });

  it('is the last step once nothing is left', () => {
    expect(constructionStep(0, farm.buildTicks)).toBe(CONSTRUCTION_STEPS);
    expect(constructionRise(CONSTRUCTION_STEPS)).toBe(1);
  });

  it('raises the building by a quarter of its height per step', () => {
    expect([0, 1, 2, 3, 4].map(constructionRise)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });

  it('survives a site whose time left is odd, over, or a build time of zero', () => {
    expect(constructionStep(farm.buildTicks + 5, farm.buildTicks)).toBe(0);
    expect(constructionStep(3, 0)).toBe(CONSTRUCTION_STEPS);
  });
});
