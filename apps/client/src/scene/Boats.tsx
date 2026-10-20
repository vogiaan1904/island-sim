import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Euler, Matrix4, Quaternion, Vector3, type BufferGeometry, type InstancedMesh } from 'three';
import type { GoodId } from '@island/content';
import { CARGO_BOAT_MODEL, CARGO_DECK, CARGO_LOAD_ACROSS, CARGO_WATERLINE, FISHING_BOAT_MODEL, FISHING_WATERLINE, boatsAt, newBoatPoses, type BoatPlan } from '../render/boats.ts';
import { GOOD_PROPS } from '../render/crowd.ts';
import { CARRIED_MODELS, modelUrl } from '../render/models.ts';
import { useGame } from '../session/game.tsx';
import { useHeldPose } from './characterMaterial.ts';
import { bakedGeometry, useModelGeometry } from './modelGeometry.ts';
import { usePaletteMaterial } from './palette.ts';

/** At most this many boats of a kind on screen (a fishing boat per hut, a cargo boat per sale of the last hour). */
const BOATS_CAP = 64;
const GOODS = Object.keys(GOOD_PROPS) as GoodId[];

const matrix = new Matrix4();
const deck = new Matrix4();
const place = new Vector3();
const turn = new Quaternion();
const euler = new Euler();
const one = new Vector3(1, 1, 1);

/** A goods prop posed as held, with the middle of its bottom at its origin, to stand on a deck. */
function loadGeometry(geometry: BufferGeometry, held: Matrix4): BufferGeometry {
  const posed = geometry.clone().applyMatrix4(held);
  posed.computeBoundingBox();
  const box = posed.boundingBox;
  if (box !== null) posed.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  return posed;
}

function finish(mesh: InstancedMesh | null, count: number): void {
  if (mesh === null) return;
  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
}

/**
 * The fishing and cargo boats (`render/boats.ts`): one instanced mesh per boat model and per good a cargo boat carries,
 * on the palette, placed every frame from the gliding game time and bobbing with the waves at their waterline.
 */
export function Boats({ plan }: { plan: BoatPlan }) {
  const { clock } = useGame();
  const material = usePaletteMaterial();
  const held = useHeldPose();
  const fishingGeometry = useModelGeometry(FISHING_BOAT_MODEL);
  const cargoGeometry = useModelGeometry(CARGO_BOAT_MODEL);
  const props = useGLTF(GOODS.map((good) => modelUrl(CARRIED_MODELS[GOOD_PROPS[good]])), false, true);
  const loads = useMemo(() => props.map((g) => loadGeometry(bakedGeometry(g.scene), held)), [props, held]);
  const poses = useMemo(() => newBoatPoses(plan), [plan]);
  const fishing = useRef<InstancedMesh | null>(null);
  const cargo = useRef<InstancedMesh | null>(null);
  const loadMeshes = useRef<Array<InstancedMesh | null>>([]);
  const loadCounts = useMemo(() => new Array<number>(GOODS.length).fill(0), []);

  useFrame(() => {
    const count = boatsAt(plan, clock.ticksAt(performance.now()), poses);
    let fishingCount = 0;
    let cargoCount = 0;
    loadCounts.fill(0);
    for (let k = 0; k < count; k += 1) {
      const boat = poses[k];
      const mesh = boat?.model === 'fishing' ? fishing.current : cargo.current;
      if (boat === undefined || mesh === null) continue;
      place.set(boat.x, boat.y - (boat.model === 'fishing' ? FISHING_WATERLINE : CARGO_WATERLINE), boat.z);
      matrix.compose(place, turn.setFromEuler(euler.set(0, boat.heading, 0)), one);
      if (boat.model === 'fishing') {
        if (fishingCount < BOATS_CAP) mesh.setMatrixAt(fishingCount++, matrix);
        continue;
      }
      if (cargoCount < BOATS_CAP) mesh.setMatrixAt(cargoCount++, matrix);
      const good = boat.load === null ? -1 : GOODS.indexOf(boat.load);
      const loaded = loadMeshes.current[good];
      if (!loaded) continue;
      for (const across of CARGO_LOAD_ACROSS) {
        const slot = loadCounts[good] ?? 0;
        if (slot >= BOATS_CAP * CARGO_LOAD_ACROSS.length) break;
        loaded.setMatrixAt(slot, deck.makeTranslation(across, CARGO_DECK.y, CARGO_DECK.z).premultiply(matrix));
        loadCounts[good] = slot + 1;
      }
    }
    finish(fishing.current, fishingCount);
    finish(cargo.current, cargoCount);
    loadMeshes.current.forEach((mesh, i) => finish(mesh, loadCounts[i] ?? 0));
  });

  return (
    <>
      <instancedMesh ref={fishing} args={[fishingGeometry, material, BOATS_CAP]} castShadow receiveShadow frustumCulled={false} />
      <instancedMesh ref={cargo} args={[cargoGeometry, material, BOATS_CAP]} castShadow receiveShadow frustumCulled={false} />
      {loads.map((geometry, i) => (
        <instancedMesh
          key={i}
          ref={(mesh) => {
            loadMeshes.current[i] = mesh;
          }}
          args={[geometry, material, BOATS_CAP * CARGO_LOAD_ACROSS.length]}
          castShadow
          frustumCulled={false}
        />
      ))}
    </>
  );
}
