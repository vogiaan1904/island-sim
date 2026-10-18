// @vitest-environment node
import { readFileSync } from 'node:fs';
import { Box3 } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { describe, expect, it } from 'vitest';
import { bakedGeometry } from './modelGeometry.ts';

function load(file: string): Promise<GLTF> {
  const bytes = readFileSync(new URL(`../../public/models/${file}`, import.meta.url));
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return new Promise((resolve, reject) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parse(buffer, '', resolve, reject));
}

describe('baked model geometry', () => {
  it('folds the quantized mesh node into the geometry: the 2 x 2 dock stands on the ground, centered, in metres', async () => {
    const geometry = bakedGeometry((await load('building_dock_a.glb')).scene);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox ?? new Box3();
    expect(box.min.y).toBeCloseTo(0, 1);
    // Origin at the footprint's bottom center: a 2 x 2 footprint is 8 x 8 units, allowing the overhang of the contract.
    expect(Math.abs(box.min.x + box.max.x) / 2).toBeLessThan(1);
    expect(box.max.x - box.min.x).toBeGreaterThan(6);
    expect(box.max.x - box.min.x).toBeLessThan(10.5);
    expect(geometry.getAttribute('position').array).toBeInstanceOf(Float32Array);
    expect(geometry.getAttribute('uv')).toBeDefined();
  });
});
