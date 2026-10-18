import { catalog } from '@island/assets/src/catalog.ts';
import type { BuildingId } from '@island/content';

// The client loads only the processed files the asset catalog lists (tools/assets/src/catalog.ts), never anything
// from assets/raw or assets/packs. Every model URL goes through here.

const MODELS: ReadonlySet<string> = new Set(catalog.models);

/** The URL of a shipped model file; throws for a file the catalog does not list. */
export function modelUrl(file: string): string {
  if (!MODELS.has(file)) throw new Error(`not in the asset catalog: ${file}`);
  return `/models/${file}`;
}

/** The model file of a building type: `building_<content id>_a.glb`. */
export function buildingModel(type: BuildingId): string {
  return `building_${type}_a.glb`;
}

/** The one palette texture every model's `palette` material samples. */
export const PALETTE_URL = modelUrl('palette.png');
