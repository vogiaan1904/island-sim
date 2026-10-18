// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LOOK, TILE_SIZE, sunDirection } from './look.ts';

const conventions = JSON.parse(readFileSync(new URL('../../../../tools/assets/conventions.json', import.meta.url), 'utf8')) as {
  tileSize: number;
  look: { sun: { color: number[]; energy: number; elevation: number; azimuth: number }; sky: number[]; water: number[] };
};

describe('the look', () => {
  it('uses the golden look and tile size the assets were made with', () => {
    expect(TILE_SIZE).toBe(conventions.tileSize);
    expect(LOOK.sun).toEqual(conventions.look.sun);
    expect(LOOK.sky).toEqual(conventions.look.sky);
    expect(LOOK.water).toEqual(conventions.look.water);
  });

  it('puts the sun 30 degrees up, toward the light, as a unit vector', () => {
    const [x, y, z] = sunDirection(LOOK.sun);
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 10);
    expect(y).toBeCloseTo(Math.sin((30 * Math.PI) / 180), 10);
  });
});
