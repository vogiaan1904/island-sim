import { readFileSync } from 'node:fs';

/** The asset conventions, shared with the Blender scripts through tools/assets/conventions.json. */
export interface Rules {
  /** World units per grid tile; null until the art-direction task decides it. */
  tileSize: number | null;
  /** Scale factor per pack, from pack units to world units. */
  packScale: Record<string, number>;
  categories: readonly string[];
  /** How far, in world units, the lowest point may sit from height 0 and a footprint from the origin. */
  originTolerance: number;
  /** How far past its footprint a building may reach (roof edges, awnings), as a share of a tile. */
  overhang: number;
  /** The least share of its footprint a building must cover along each axis. */
  minCover: number;
  /** Triangles per model by category; buildings are per footprint tile. */
  triangleBudgets: Record<string, number>;
  /** Width and height of building and goods icons and portraits, in pixels. */
  iconSize: number;
  character: {
    joints: readonly string[];
    layers: { legs: readonly string[]; arms: readonly string[] };
    clips: ReadonlyArray<{ name: string; layer: 'legs' | 'arms' | 'full' }>;
  };
}

export function loadRules(): Rules {
  return JSON.parse(readFileSync(new URL('../conventions.json', import.meta.url), 'utf8')) as Rules;
}

/** category_name-part_variant.glb or .png: lowercase ASCII, words inside a part joined by hyphens. */
export function parseName(file: string, rules: Rules): { category: string; name: string; variant: string } | null {
  const match = /^([a-z0-9]+)_([a-z0-9]+(?:-[a-z0-9]+)*)_([a-z0-9]+(?:-[a-z0-9]+)*)\.(?:glb|png)$/.exec(file);
  if (!match || !rules.categories.includes(match[1]!)) return null;
  return { category: match[1]!, name: match[2]!, variant: match[3]! };
}
