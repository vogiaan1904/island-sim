import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { PALETTE_URL, buildingModel, modelUrl } from './models.ts';

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
