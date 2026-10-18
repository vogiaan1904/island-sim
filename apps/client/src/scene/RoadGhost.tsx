import { content } from '@island/content';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Color, Matrix4, type InstancedMesh, type MeshStandardMaterial } from 'three';
import type { RoadDraft } from '../placement/draft.ts';
import { roadVerdict } from '../placement/roadVerdict.ts';
import { TILE_SIZE } from '../render/look.ts';
import { roadPreview } from '../render/roadPreview.ts';
import { useGameState } from '../session/game.tsx';
import { ModelInstances } from './ModelInstances.tsx';
import { usePaletteMaterial } from './palette.ts';

// The same green and red as the labels and buttons (styles/tokens.css --green and --red), so 2D and 3D agree.
const GOOD = new Color('#3cc46b');
const BAD = new Color('#ff5a5f');
const MAX_TILES = content.rules.maxRoadTilesPerCommand;
const matrix = new Matrix4();

/**
 * The road drag's preview (island-3d-client, scene-and-rendering.md section 12): the road pieces the dragged tiles will
 * make, see-through and tinted green where the sim's own rule passes and red where it does not, with a flat highlight
 * under each new tile. It goes when the server says ok (the real road arrives with the next update).
 */
export function RoadGhost({ draft }: { draft: RoadDraft }) {
  const island = useGameState((state) => state.island?.state ?? null);
  const preview = useMemo(() => (island === null ? null : roadPreview(island.roads, draft.tiles, content.rules.islandSize)), [island?.roads, draft.tiles]);
  const ok = useMemo(() => island === null || roadVerdict(island, content, draft.tiles).ok || draft.tiles.length === 0, [island, draft.tiles]);
  const palette = usePaletteMaterial();
  const tint = ok ? GOOD : BAD;
  const material = useMemo(() => {
    const clone = palette.clone() as MeshStandardMaterial;
    clone.transparent = true;
    clone.depthWrite = false;
    return clone;
  }, [palette]);
  material.color.copy(tint);
  material.opacity = draft.phase === 'placing' ? 0.45 : 0.65;

  const marks = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = marks.current;
    if (mesh === null || preview === null) return;
    preview.highlights.forEach((spot, i) => mesh.setMatrixAt(i, matrix.makeTranslation(spot.x, 0.08, spot.z)));
    mesh.count = preview.highlights.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [preview]);

  if (preview === null || draft.phase === 'landing') return null;
  return (
    <group>
      {[...preview.pieces].map(([file, list]) => (
        <ModelInstances key={file} file={file} instances={list} material={material} />
      ))}
      <instancedMesh ref={marks} args={[undefined, undefined, MAX_TILES]} frustumCulled={false} renderOrder={1}>
        <planeGeometry args={[TILE_SIZE, TILE_SIZE]} onUpdate={(geometry) => geometry.rotateX(-Math.PI / 2)} />
        <meshBasicMaterial color={tint} transparent opacity={0.35} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}
