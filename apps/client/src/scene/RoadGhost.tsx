import { content } from '@island/content';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Color, Matrix4, type InstancedMesh, type MeshStandardMaterial } from 'three';
import type { RoadDraft, Tile } from '../placement/draft.ts';
import { roadDraftVerdict } from '../placement/roadVerdict.ts';
import { TILE_SIZE } from '../render/look.ts';
import { roadPreview } from '../render/roadPreview.ts';
import { useGameState } from '../session/game.tsx';
import { ModelInstances } from './ModelInstances.tsx';
import { usePaletteMaterial } from './palette.ts';

// The same green and red as the labels and buttons (styles/tokens.css --green and --red), so 2D and 3D agree.
const GOOD = new Color('#3cc46b');
const BAD = new Color('#ff5a5f');
// Road about to be removed: the amber of styles/tokens.css --waiting-border.
const CLEARING = new Color('#f59e0b');
const MAX_TILES = content.rules.maxRoadTilesPerCommand;
const matrix = new Matrix4();

/**
 * The road drag's preview (island-3d-client, scene-and-rendering.md section 12): the road pieces the dragged tiles will
 * make, see-through and tinted green where the sim's own rule passes and red where it does not, with a flat highlight
 * under each new tile. While removing, only the highlights show, amber over the road that will go. It goes when the
 * server says ok (the real road arrives with the next update).
 */
export function RoadGhost({ draft }: { draft: RoadDraft }) {
  const island = useGameState((state) => state.island?.state ?? null);
  const ok = useMemo(() => island === null || roadDraftVerdict(island, content, draft).ok || draft.tiles.length === 0, [island, draft]);
  if (draft.phase === 'landing') return null;
  return <RoadTilesGhost tiles={draft.tiles} ok={ok} placing={draft.phase === 'placing'} removing={draft.removing} />;
}

/**
 * Road tiles shown before they are built: the pieces they will make, shaped by the roads beside them, and a highlight
 * under each. Used by the road drag and by a building's connector (spec 12.1).
 */
export function RoadTilesGhost({ tiles, ok, placing, removing = false }: { tiles: readonly Tile[]; ok: boolean; placing: boolean; removing?: boolean }) {
  const roads = useGameState((state) => state.island?.state.roads ?? null);
  const preview = useMemo(() => (roads === null ? null : roadPreview(roads, tiles, content.rules.islandSize)), [roads, tiles]);
  const palette = usePaletteMaterial();
  const tint = !ok ? BAD : removing ? CLEARING : GOOD;
  const material = useMemo(() => {
    const clone = palette.clone() as MeshStandardMaterial;
    clone.transparent = true;
    clone.depthWrite = false;
    return clone;
  }, [palette]);
  material.color.copy(tint);
  material.opacity = placing ? 0.45 : 0.65;

  const marks = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = marks.current;
    if (mesh === null || preview === null) return;
    preview.highlights.forEach((spot, i) => mesh.setMatrixAt(i, matrix.makeTranslation(spot.x, 0.08, spot.z)));
    mesh.count = preview.highlights.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [preview]);

  if (preview === null) return null;
  return (
    <group>
      {!removing && [...preview.pieces].map(([file, list]) => (
        <ModelInstances key={file} file={file} instances={list} material={material} />
      ))}
      <instancedMesh ref={marks} args={[undefined, undefined, MAX_TILES]} frustumCulled={false} renderOrder={1}>
        <planeGeometry args={[TILE_SIZE, TILE_SIZE]} onUpdate={(geometry) => geometry.rotateX(-Math.PI / 2)} />
        <meshBasicMaterial color={tint} transparent opacity={0.35} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}
