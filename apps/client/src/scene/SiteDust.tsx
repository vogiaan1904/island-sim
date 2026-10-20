import { content } from '@island/content';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { DoubleSide, Matrix4, MeshBasicMaterial, Object3D, type InstancedMesh } from 'three';
import { DUST_OPACITY, dustPuff, finishPuffTime, finishedSites } from '../render/ghost.ts';
import { TILE_SIZE } from '../render/look.ts';
import { useGame, useGameState } from '../session/game.tsx';

const PIECES = 8;
/** Room for this many sites finishing at once; more are left out. */
const PUFFS = 4;
/** The dust's opacity; a piece fades by shrinking, since one material serves every puff. */
const OPACITY = 0.6;
const dummy = new Object3D();
const matrix = new Matrix4();

/**
 * The puff of dust where a site has just finished (its scaffold went on the same tick): the placement landing's puff,
 * one per `construction-finished` event of the last moment, from the island's events and the gliding game time.
 */
export function SiteDust() {
  const { clock } = useGame();
  const island = useGameState((state) => state.island);
  const sites = useMemo(() => (island === null ? [] : finishedSites(island.events, island.state, content)), [island]);
  const dust = useMemo(() => new MeshBasicMaterial({ color: '#f1e4c8', transparent: true, opacity: OPACITY, depthWrite: false, side: DoubleSide }), []);
  const mesh = useRef<InstancedMesh>(null);

  useFrame(() => {
    const target = mesh.current;
    if (target === null) return;
    const ticks = clock.ticksAt(performance.now());
    let count = 0;
    for (const site of sites) {
      const t = finishPuffTime(site.tick, ticks);
      if (t === null || count >= PIECES * PUFFS) continue;
      for (let i = 0; i < PIECES; i += 1) {
        const piece = dustPuff(t, i, PIECES, site.reach);
        dummy.position.set(site.x + piece.x, piece.y, site.z + piece.z);
        dummy.scale.setScalar((piece.scale * piece.opacity) / DUST_OPACITY);
        dummy.updateMatrix();
        target.setMatrixAt(count, matrix.copy(dummy.matrix));
        count += 1;
      }
    }
    target.count = count;
    target.instanceMatrix.needsUpdate = true;
    target.visible = count > 0;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, dust, PIECES * PUFFS]} visible={false} frustumCulled={false}>
      <sphereGeometry args={[TILE_SIZE * 0.25, 8, 6]} />
    </instancedMesh>
  );
}
