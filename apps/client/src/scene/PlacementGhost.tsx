import { content } from '@island/content';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Color, DoubleSide, Matrix4, MeshBasicMaterial, Object3D, type Group, type InstancedMesh, type Mesh, type MeshStandardMaterial } from 'three';
import type { PlacementDraft } from '../placement/draft.ts';
import { buildingVerdict } from '../placement/verdict.ts';
import { dustPuff, ghostInstance, landingBounce, LANDING_SECONDS } from '../render/ghost.ts';
import { TILE_SIZE } from '../render/look.ts';
import { useGame, useGameState } from '../session/game.tsx';
import { useModelGeometry } from './modelGeometry.ts';
import { usePaletteMaterial } from './palette.ts';

// The same green and red as the labels and buttons (styles/tokens.css --green and --red), so 2D and 3D agree.
const GOOD = new Color('#3cc46b');
const BAD = new Color('#ff5a5f');
const PIECES = 8;
const dummy = new Object3D();
const matrix = new Matrix4();

/**
 * The placement ghost (island-3d-client, scene-and-rendering.md section 12): a see-through copy of the building's model
 * on the tile the player aims at, tinted green where the sim's own check passes and red where it does not, with a flat
 * tile highlight under it. While the command is out it pulses; when the server says ok it turns solid, drops in with
 * a bounce and sends up a puff of dust. Everything it shows comes from `view.placement` and the island state.
 */
export function PlacementGhost() {
  const draft = useGameState((state) => state.view.placement);
  if (draft === null) return null;
  return <Ghost draft={draft} />;
}

function Ghost({ draft }: { draft: PlacementDraft }) {
  const { store } = useGame();
  const island = useGameState((state) => state.island?.state ?? null);
  const ghost = useMemo(() => ghostInstance(draft, content), [draft]);
  const verdict = useMemo(() => (island === null ? null : buildingVerdict(island, content, draft)), [island, draft]);
  const geometry = useModelGeometry(ghost.file);
  const palette = usePaletteMaterial();
  const material = useMemo(() => {
    const clone = palette.clone() as MeshStandardMaterial;
    clone.transparent = true;
    clone.depthWrite = false;
    return clone;
  }, [palette]);
  const dust = useMemo(() => new MeshBasicMaterial({ color: '#f1e4c8', transparent: true, depthWrite: false, side: DoubleSide }), []);
  const group = useRef<Group>(null);
  const model = useRef<Mesh>(null);
  const puffs = useRef<InstancedMesh>(null);
  const landedAt = useRef<number | null>(null);

  useFrame((state) => {
    const current = store.getState().view.placement;
    const root = group.current;
    const body = model.current;
    if (current === null || root === null || body === null) return;
    const tint = verdict?.ok === false ? BAD : GOOD;
    const seconds = state.clock.elapsedTime;
    if (current.phase === 'landing') {
      landedAt.current ??= seconds;
      const t = Math.min(LANDING_SECONDS, seconds - landedAt.current);
      const { lift, squash } = landingBounce(t);
      body.position.y = lift;
      body.scale.set(1, squash, 1);
      material.opacity = 1;
      material.color.set('#ffffff');
      const reach = Math.max(ghost.width, ghost.depth) * 0.5;
      const puff = puffs.current;
      if (puff !== null) {
        for (let i = 0; i < PIECES; i += 1) {
          const piece = dustPuff(t, i, PIECES, reach);
          dummy.position.set(piece.x, piece.y, piece.z);
          dummy.scale.setScalar(piece.scale);
          dummy.updateMatrix();
          puff.setMatrixAt(i, matrix.copy(dummy.matrix));
          dust.opacity = piece.opacity;
        }
        puff.instanceMatrix.needsUpdate = true;
        puff.visible = true;
      }
      return;
    }
    landedAt.current = null;
    if (puffs.current !== null) puffs.current.visible = false;
    body.position.y = 0;
    body.scale.set(1, 1, 1);
    material.color.copy(tint);
    // Pulsing says "the server is thinking"; otherwise steady.
    material.opacity = current.phase === 'placing' ? 0.45 + 0.15 * Math.sin(seconds * 8) : 0.6;
  });

  return (
    <group ref={group} position={[ghost.x, 0, ghost.z]}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.08} renderOrder={1}>
        <planeGeometry args={[ghost.width, ghost.depth]} />
        <meshBasicMaterial color={verdict?.ok === false ? BAD : GOOD} transparent opacity={0.35} depthWrite={false} />
      </mesh>
      <mesh ref={model} geometry={geometry} material={material} rotation-y={ghost.rotationY} renderOrder={2} />
      <instancedMesh ref={puffs} args={[undefined, dust, PIECES]} visible={false} frustumCulled={false}>
        <sphereGeometry args={[TILE_SIZE * 0.25, 8, 6]} />
      </instancedMesh>
    </group>
  );
}
