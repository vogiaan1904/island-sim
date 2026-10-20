import { catalog } from '@island/assets/src/catalog.ts';
import type { BuildingId, Content, StageId } from '@island/content';
import type { Carried } from './crowd.ts';

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

export type RoadPieceName = 'single' | 'end' | 'straight' | 'corner' | 't' | 'cross';

/** The model file of a road piece: `road_<piece>_a.glb`. */
export function roadModel(piece: RoadPieceName): string {
  return `road_${piece}_a.glb`;
}

/** The scaffold of a footprint of w by h tiles at rotation 0; a turned building turns the same model. */
export function scaffoldModel(w: number, h: number): string {
  return `prop_scaffold_${w}x${h}.glb`;
}

/** One tile of walkway on the water beside the dock. */
export const PIER_MODEL = 'prop_pier_a.glb';
/** The log pile beside a site, where its builders fetch logs. */
export const LOG_PILE_MODEL = 'prop_log-pile_a.glb';
/** The block beside a lumber camp with no tree in reach, where its workers chop. */
export const CHOPPING_BLOCK_MODEL = 'prop_chopping-block_a.glb';

/** What people hold in both arms (and what hand carts and cargo boats carry), each a model posed for the right arm. */
export const CARRIED_MODELS: Readonly<Record<Carried, string>> = {
  bag: 'accessory_bag_a.glb',
  logs: 'accessory_logs_a.glb',
  'vegetable-crate': 'accessory_vegetable-crate_a.glb',
  'fish-basket': 'accessory_fish-basket_a.glb',
};

const ROAD_PIECES: readonly RoadPieceName[] = ['single', 'end', 'straight', 'corner', 't', 'cross'];

/**
 * The model files an island in this stage can show, in load order: what the stage's buildings, their scaffolds, the
 * log pile and the chopping block, the roads and the pier need, plus everything earlier stages need. The game loads the Outpost list
 * first and the rest of the stages in the background (a building is only placed in a stage it is available from).
 */
export function stageModels(content: Content, stage: StageId): string[] {
  const reached = content.stages.find((s) => s.id === stage)?.order ?? 0;
  const orderOf = (id: StageId) => content.stages.find((s) => s.id === id)?.order ?? Number.POSITIVE_INFINITY;
  const files: string[] = [PIER_MODEL, LOG_PILE_MODEL, CHOPPING_BLOCK_MODEL, ...ROAD_PIECES.map(roadModel)];
  for (const def of content.buildings) {
    if (orderOf(def.availableFrom) > reached) continue;
    files.push(buildingModel(def.id), scaffoldModel(def.footprint.w, def.footprint.h));
  }
  return [...new Set(files)];
}

/** The one palette texture every model's `palette` material samples. */
export const PALETTE_URL = modelUrl('palette.png');
