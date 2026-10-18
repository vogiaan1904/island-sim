import { getBounds } from '@gltf-transform/functions';
import { describe, expect, it } from 'vitest';
import { boxGlb } from './fixtures.ts';
import { createIO } from './glb.ts';
import { pack, validate } from './pack.ts';

describe('pack', () => {
  it('compresses with meshopt and keeps the model where it was', async () => {
    const staging = await boxGlb({ size: [1.8, 2.5, 1.8] });
    expect(await validate(staging)).toEqual([]);
    const io = await createIO();
    const document = await io.readBinary(await pack(staging));
    expect(document.getRoot().listExtensionsUsed().map((e) => e.extensionName)).toContain('EXT_meshopt_compression');
    const { min, max } = getBounds(document.getRoot().listScenes()[0]!);
    expect(min.map((v) => +v.toFixed(2))).toEqual([-0.9, 0, -0.9]);
    expect(max.map((v) => +v.toFixed(2))).toEqual([0.9, 2.5, 0.9]);
  });

  it('refuses a file the glTF validator finds errors in', async () => {
    const broken = await boxGlb({ size: [1, 1, 1] });
    broken[12] = 0xff; // corrupts the JSON chunk length
    await expect(pack(broken)).rejects.toThrow('the glTF validator found errors');
  });
});
