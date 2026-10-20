import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { constructionRise } from './construction.ts';

const farm = content.buildings.find((d) => d.id === 'farm')!;

describe('a site rising from the ground', () => {
  it('shows nothing above the ground the moment it is placed', () => {
    expect(constructionRise(farm.buildTicks, farm.buildTicks)).toBe(0);
  });

  it('rises with every tick of work, by the share of the build time done', () => {
    expect(constructionRise(farm.buildTicks - 1, farm.buildTicks)).toBeCloseTo(1 / farm.buildTicks);
    expect(constructionRise(farm.buildTicks / 4, farm.buildTicks)).toBeCloseTo(0.75);
    let previous = 0;
    for (let left = farm.buildTicks; left >= 1; left -= 1) {
      const rise = constructionRise(left, farm.buildTicks);
      expect(rise).toBeGreaterThan(previous - 1e-12);
      expect(rise).toBeLessThan(1);
      previous = rise;
    }
  });

  it('holds while the sim holds: a landmark short of materials keeps its ticks left, so its height', () => {
    expect(constructionRise(500, 1_000)).toBe(constructionRise(500, 1_000));
  });

  it('is whole once nothing is left', () => {
    expect(constructionRise(0, farm.buildTicks)).toBe(1);
  });

  it('survives a site whose time left is over, or a build time of zero', () => {
    expect(constructionRise(farm.buildTicks + 5, farm.buildTicks)).toBe(0);
    expect(constructionRise(3, 0)).toBe(1);
  });
});
