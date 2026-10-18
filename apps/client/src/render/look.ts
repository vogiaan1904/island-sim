// The "golden" look (spec 11, 12.6) as the client draws it. Sun, sky and water copy `look` in
// tools/assets/conventions.json, which the assets were rendered with (a test keeps them equal). Colors are linear RGB.
// The terrain colors are the client's own (the asset pipeline has no terrain): first picks, for the look review
// (ticket 21).

export type Rgb = readonly [number, number, number];

export interface Sun {
  color: Rgb;
  energy: number;
  /** Degrees above the horizon. */
  elevation: number;
  /** Degrees, turned from the island's south (+Z) toward the east (+X), as the Blender recipes turn the sun. */
  azimuth: number;
}

export interface Look {
  sun: Sun;
  sky: Rgb;
  water: Rgb;
  grass: Rgb;
  sand: Rgb;
  /** Under the water near the shore. */
  seabed: Rgb;
}

export const LOOK: Look = {
  sun: { color: [1.0, 0.85, 0.68], energy: 3.2, elevation: 30, azimuth: 40 },
  sky: [0.62, 0.62, 0.7],
  water: [0.1, 0.32, 0.45],
  grass: [0.3, 0.52, 0.14],
  sand: [0.86, 0.7, 0.42],
  seabed: [0.42, 0.4, 0.28],
};

/** World units per tile: the models are made for 4-unit tiles (1 unit is about 1 m). */
export const TILE_SIZE = 4;

/** The unit vector from the island toward the sun, in three.js axes (y up, models face +Z). */
export function sunDirection(sun: Sun): [number, number, number] {
  const elevation = (sun.elevation * Math.PI) / 180;
  const azimuth = (sun.azimuth * Math.PI) / 180;
  return [Math.cos(elevation) * Math.sin(azimuth), Math.sin(elevation), Math.cos(elevation) * Math.cos(azimuth)];
}
