import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { catalog } from './catalog.ts';
import { CHARACTERS } from './shipped.ts';

const ROADS = ['straight', 'end', 'corner', 't', 'cross', 'single'].map((kind) => `road_${kind}_a.glb`);
const buildingModels = content.buildings.map((b) => `building_${b.id}_a.glb`);
const scaffolds = content.buildings.map((b) => `prop_scaffold_${b.footprint.w}x${b.footprint.h}.glb`);
const characters = [
  ...CHARACTERS.map((c) => `character_${c.replace('-', '_')}.glb`),
  'characters-animation.bin',
  'characters-animation.json',
  'palette.png',
];

describe('the shipped files against content data', () => {
  it('every building has a model, an icon and a scaffold for its footprint', () => {
    for (const building of content.buildings) {
      expect(catalog.models).toContain(`building_${building.id}_a.glb`);
      expect(catalog.icons).toContain(`building_${building.id}_a.png`);
      expect(catalog.models).toContain(`prop_scaffold_${building.footprint.w}x${building.footprint.h}.glb`);
    }
  });

  it('every good has an icon', () => {
    for (const good of content.goods) expect(catalog.icons).toContain(`good_${good.id}_a.png`);
  });

  it('every port master candidate has a portrait', () => {
    for (const candidate of content.portMasterCandidates) {
      expect(catalog.icons).toContain(`portrait_${candidate.name.toLowerCase()}_a.png`);
    }
  });

  it('the characters, the animation and the palette ship', () => {
    for (const file of characters) expect(catalog.models).toContain(file);
  });

  it('every catalog entry is used', () => {
    const known = new Set([
      ...buildingModels,
      ...scaffolds,
      ...characters,
      ...ROADS,
      'ship_ferry_a.glb',
      'prop_pier_a.glb',
      // Work loops, carts and boats (slice1-alive-2).
      'prop_chopping-block_a.glb',
      'prop_log-pile_a.glb',
      'prop_hand-cart_a.glb',
      'ship_fishing-boat_a.glb',
      'ship_cargo-boat_a.glb',
    ]);
    const unused = catalog.models.filter((f) => !known.has(f) && !/^(nature|accessory)_/.test(f));
    expect(unused).toEqual([]);
  });
});
