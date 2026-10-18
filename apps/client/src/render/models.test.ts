import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { PALETTE_URL, PIER_MODEL, buildingModel, modelUrl, roadModel, scaffoldModel, stageModels } from './models.ts';

describe('model files', () => {
  it('has a shipped model for every building in the content data', () => {
    for (const def of content.buildings) expect(modelUrl(buildingModel(def.id))).toBe(`/models/building_${def.id}_a.glb`);
  });

  it('loads the shared palette from the models folder', () => {
    expect(PALETTE_URL).toBe('/models/palette.png');
  });

  it('refuses a file the asset catalog does not list', () => {
    expect(() => modelUrl('building_castle_a.glb')).toThrow('building_castle_a.glb');
    expect(() => modelUrl('../raw/kenney_pirate-kit/ship.glb')).toThrow();
  });
});

describe('model files for roads, scaffolds and the pier', () => {
  it('names a shipped road model for every piece', () => {
    for (const piece of ['single', 'end', 'straight', 'corner', 't', 'cross'] as const) {
      expect(modelUrl(roadModel(piece))).toBe(`/models/road_${piece}_a.glb`);
    }
  });

  it('has a shipped scaffold for the footprint of every building in the content data', () => {
    for (const def of content.buildings) {
      expect(modelUrl(scaffoldModel(def.footprint.w, def.footprint.h))).toBe(`/models/prop_scaffold_${def.footprint.w}x${def.footprint.h}.glb`);
    }
    expect(modelUrl(PIER_MODEL)).toBe('/models/prop_pier_a.glb');
  });
});

describe('models per stage', () => {
  it('lists the Outpost models: its buildings, their scaffolds, the roads and the pier', () => {
    const outpost = stageModels(content, 'outpost');
    for (const def of content.buildings.filter((d) => d.availableFrom === 'outpost')) {
      expect(outpost).toContain(buildingModel(def.id));
      expect(outpost).toContain(scaffoldModel(def.footprint.w, def.footprint.h));
    }
    expect(outpost).toContain('road_cross_a.glb');
    expect(outpost).toContain(PIER_MODEL);
  });

  it('lists a model once and only what the catalog ships', () => {
    for (const stage of ['outpost', 'settlement'] as const) {
      const models = stageModels(content, stage);
      expect(new Set(models).size).toBe(models.length);
      for (const file of models) expect(() => modelUrl(file)).not.toThrow();
    }
  });

  it('never drops an earlier stage model from a later stage', () => {
    const settlement = stageModels(content, 'settlement');
    for (const file of stageModels(content, 'outpost')) expect(settlement).toContain(file);
  });
});
