import { useEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry, Color, MeshStandardMaterial } from 'three';
import { LOOK, TILE_SIZE } from '../render/look.ts';
import { SEA_FLOOR_HEIGHT, terrainChunks } from '../render/terrain.ts';

const material = new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
const seabed = new MeshStandardMaterial({ color: new Color().setRGB(...LOOK.seabed), roughness: 1, metalness: 0 });

/** The island ground as a few flat-shaded chunk meshes with vertex colors, rebuilt only when the terrain changes. */
export function Terrain({ terrain, size }: { terrain: string; size: number }) {
  const geometries = useMemo(
    () =>
      terrainChunks(terrain, size).map((chunk) => {
        const geometry = new BufferGeometry();
        geometry.setAttribute('position', new BufferAttribute(chunk.positions, 3));
        geometry.setAttribute('color', new BufferAttribute(chunk.colors, 3));
        geometry.computeVertexNormals(); // Non-indexed triangles: one normal per face, the flat low-poly look.
        geometry.computeBoundingSphere();
        return geometry;
      }),
    [terrain, size],
  );
  useEffect(() => () => geometries.forEach((geometry) => geometry.dispose()), [geometries]);

  const middle = (size * TILE_SIZE) / 2;
  return (
    <group>
      {geometries.map((geometry, i) => (
        <mesh key={i} geometry={geometry} material={material} receiveShadow />
      ))}
      {/* The sea floor beyond the island's grid, so open water never shows the sky through it. */}
      <mesh material={seabed} position={[middle, SEA_FLOOR_HEIGHT - 0.01, middle]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2000, 2000]} />
      </mesh>
    </group>
  );
}
