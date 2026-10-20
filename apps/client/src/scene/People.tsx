import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  Euler,
  InstancedBufferAttribute,
  Matrix3,
  Matrix4,
  Quaternion,
  Vector3,
  type InstancedMesh,
  type Object3D,
  type SkinnedMesh,
} from 'three';
import { cameraPose } from '../camera/controller.ts';
import { ISLAND_LIMITS } from '../camera/limits.ts';
import { getLivePose } from '../camera/livePose.ts';
import { CHARACTERS, JOINTS, characterModel, clip, variantRow, type ClipName } from '../render/clips.ts';
import { GOOD_PROPS, PEOPLE_CAP, moversAt, newMovers, peopleShown, type Carried, type CrowdPlan, type Mover } from '../render/crowd.ts';
import { CARRIED_MODELS, modelUrl } from '../render/models.ts';
import { useGame } from '../session/game.tsx';
import { useCharacterMaterials, useHeldPose } from './characterMaterial.ts';
import { bakedGeometry } from './modelGeometry.ts';

const WHEELCHAIR_MODEL = 'accessory_wheelchair_a.glb';
const CART_MODEL = 'prop_hand-cart_a.glb';
/** How far in front of a person their hands are when holding with both arms: where they grip the cart's handles. */
const HANDS_AHEAD = 0.35;
const CARRIED = Object.keys(CARRIED_MODELS) as Carried[];
/** What a hand cart can be loaded with: the goods props. */
const LOADS: readonly Carried[] = [...new Set(Object.values(GOOD_PROPS))];
const ROOT = JOINTS.indexOf('root');
const ARM_RIGHT = JOINTS.indexOf('arm-right');

const position = new Vector3();
const normal = new Vector3();
const normalMatrix = new Matrix3();
const rest = new Matrix4();

/**
 * A character's one skinned mesh as plain geometry in its rest position (the joint node's world matrix times its inverse
 * bind matrix, folded into float positions and normals once), plus `aJoint`, each vertex's joint in the manifest's order.
 */
function characterGeometry(scene: Object3D): BufferGeometry {
  scene.updateMatrixWorld(true);
  let mesh: SkinnedMesh | null = null;
  scene.traverse((object) => {
    if (mesh === null && (object as SkinnedMesh).isSkinnedMesh) mesh = object as SkinnedMesh;
  });
  const skinned = mesh as SkinnedMesh | null;
  if (skinned === null) throw new Error(`character ${scene.name} has no skinned mesh`);
  const { bones, boneInverses } = skinned.skeleton;
  const jointOfBone = bones.map((bone) => JOINTS.indexOf(bone.name));
  const source = skinned.geometry;
  const positions = source.getAttribute('position');
  const normals = source.getAttribute('normal');
  const skinIndex = source.getAttribute('skinIndex');
  const bakedPositions = new Float32Array(positions.count * 3);
  const bakedNormals = new Float32Array(positions.count * 3);
  const joints = new Float32Array(positions.count);
  for (let i = 0; i < positions.count; i += 1) {
    const bone = skinIndex.getX(i);
    const boneObject = bones[bone];
    const inverse = boneInverses[bone];
    if (boneObject === undefined || inverse === undefined) throw new Error(`character ${scene.name}: vertex ${i} has no joint`);
    rest.multiplyMatrices(boneObject.matrixWorld, inverse);
    position.fromBufferAttribute(positions, i).applyMatrix4(rest);
    bakedPositions.set([position.x, position.y, position.z], i * 3);
    normalMatrix.getNormalMatrix(rest);
    normal.fromBufferAttribute(normals, i).applyMatrix3(normalMatrix).normalize();
    bakedNormals.set([normal.x, normal.y, normal.z], i * 3);
    joints[i] = jointOfBone[bone] ?? ROOT;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(bakedPositions, 3));
  geometry.setAttribute('normal', new BufferAttribute(bakedNormals, 3));
  const uv = source.getAttribute('uv');
  if (uv !== undefined) geometry.setAttribute('uv', uv);
  if (source.index !== null) geometry.setIndex(source.index);
  geometry.setAttribute('aJoint', new BufferAttribute(joints, 1));
  return withInstanceClips(geometry);
}

/** An accessory: static geometry in the shared rest space that follows one joint, like a vertex of that joint. */
function accessoryGeometry(scene: Object3D, joint: number): BufferGeometry {
  const geometry = bakedGeometry(scene);
  geometry.setAttribute('aJoint', new BufferAttribute(new Float32Array(geometry.getAttribute('position').count).fill(joint), 1));
  return withInstanceClips(geometry);
}

/** Where a cart model's marker is, in metres from its origin. */
function marker(scene: Object3D, name: string): Vector3 {
  scene.updateMatrixWorld(true);
  const node = scene.getObjectByName(name);
  if (node === undefined) throw new Error(`model ${scene.name} has no ${name}`);
  return node.getWorldPosition(new Vector3());
}

/** A hand cart that goes ahead of the person pushing it, its handles at their hands, following their root. */
function cartGeometry(scene: Object3D): BufferGeometry {
  const geometry = accessoryGeometry(scene, ROOT);
  geometry.translate(0, 0, HANDS_AHEAD - marker(scene, 'marker_handle').z);
  return geometry;
}

/** A goods prop posed as held (`held`) and set down on the cart's bed, at its `marker_load`, going ahead with the cart. */
function loadGeometry(prop: Object3D, cart: Object3D, held: Matrix4): BufferGeometry {
  const geometry = accessoryGeometry(prop, ROOT);
  geometry.applyMatrix4(held);
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const load = marker(cart, 'marker_load');
  const handle = marker(cart, 'marker_handle');
  if (box === null) return geometry;
  geometry.translate(-(box.min.x + box.max.x) / 2, load.y - box.min.y, HANDS_AHEAD - handle.z + load.z - (box.min.z + box.max.z) / 2);
  return geometry;
}

function withInstanceClips(geometry: BufferGeometry): BufferGeometry {
  geometry.setAttribute('aLegs', new InstancedBufferAttribute(new Float32Array(PEOPLE_CAP * 4), 4));
  geometry.setAttribute('aArms', new InstancedBufferAttribute(new Float32Array(PEOPLE_CAP * 4), 4));
  return geometry;
}

const VARIANT_ROWS = CHARACTERS.map((_, i) => variantRow(i));
const matrix = new Matrix4();
const place = new Vector3();
const turn = new Quaternion();
const euler = new Euler();
const size = new Vector3();

/** Writes one person into slot `i` of an instanced mesh: where they stand and which frames their two layers play. */
function writePerson(mesh: InstancedMesh, i: number, m: Mover): void {
  place.set(m.x, m.y, m.z);
  turn.setFromEuler(euler.set(0, m.heading, 0));
  size.setScalar(m.scale);
  mesh.setMatrixAt(i, matrix.compose(place, turn, size));
  const row = VARIANT_ROWS[m.character] ?? 0;
  const legs = clip(m.legs);
  (mesh.geometry.getAttribute('aLegs') as InstancedBufferAttribute).setXYZW(i, row + legs.firstRow, legs.frames, legs.loop ? 1 : 0, m.legsPhase);
  const arms = m.arms === null ? null : clip(m.arms as ClipName);
  (mesh.geometry.getAttribute('aArms') as InstancedBufferAttribute).setXYZW(
    i,
    arms === null ? 0 : row + arms.firstRow,
    arms === null ? 1 : arms.frames,
    arms === null ? 0 : 1,
    m.armsPhase,
  );
}

function finish(mesh: InstancedMesh | null, count: number): void {
  if (mesh === null) return;
  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
  (mesh.geometry.getAttribute('aLegs') as InstancedBufferAttribute).needsUpdate = true;
  (mesh.geometry.getAttribute('aArms') as InstancedBufferAttribute).needsUpdate = true;
}

/**
 * The island's people (spec 6.2): one instanced mesh per character and per accessory (the wheelchair, and what people
 * hold in both arms: travellers' and carriers' bags, builders' and woodcutters' logs, crates of vegetables, baskets of fish; hand carts and their loads, ahead of whoever pushes them), posed on the GPU from the joint-animation texture. Who walks where is planned when the island changes; every frame only fills the instance
 * buffers from the gliding game time, nearest to the camera first, and nobody shows when zoomed out to the whole island.
 */
export function People({ plan }: { plan: CrowdPlan }) {
  const { clock, store } = useGame();
  const { material, depth } = useCharacterMaterials();
  const held = useHeldPose();
  const gltfs = useGLTF(CHARACTERS.map((_, i) => modelUrl(characterModel(i))), false, true);
  const wheelchair = useGLTF(modelUrl(WHEELCHAIR_MODEL), false, true);
  const carriedGltfs = useGLTF(CARRIED.map((c) => modelUrl(CARRIED_MODELS[c])), false, true);
  const cart = useGLTF(modelUrl(CART_MODEL), false, true);
  const geometries = useMemo(() => gltfs.map((g) => characterGeometry(g.scene)), [gltfs]);
  const wheelchairGeometry = useMemo(() => accessoryGeometry(wheelchair.scene, ROOT), [wheelchair]);
  const carriedGeometries = useMemo(() => carriedGltfs.map((g) => accessoryGeometry(g.scene, ARM_RIGHT)), [carriedGltfs]);
  const cartShape = useMemo(() => cartGeometry(cart.scene), [cart]);
  const loadGeometries = useMemo(
    () => LOADS.map((load) => loadGeometry((carriedGltfs[CARRIED.indexOf(load)] as { scene: Object3D }).scene, cart.scene, held)),
    [carriedGltfs, cart, held],
  );
  const pool = useMemo(() => newMovers(plan), [plan]);
  const meshes = useRef<Array<InstancedMesh | null>>([]);
  const wheelchairs = useRef<InstancedMesh | null>(null);
  const carriedMeshes = useRef<Array<InstancedMesh | null>>([]);
  const carriedCounts = useMemo(() => new Array<number>(CARRIED.length).fill(0), []);
  const carts = useRef<InstancedMesh | null>(null);
  const loadMeshes = useRef<Array<InstancedMesh | null>>([]);
  const loadCounts = useMemo(() => new Array<number>(LOADS.length).fill(0), []);
  const counts = useMemo(() => new Array<number>(CHARACTERS.length).fill(0), []);
  const shown = useRef(true);

  useFrame(() => {
    const pose = getLivePose() ?? cameraPose(store.getState().view.camera, ISLAND_LIMITS);
    shown.current = peopleShown(pose.distance, ISLAND_LIMITS.maxDistance, shown.current);
    const count = shown.current ? moversAt(plan, clock.ticksAt(performance.now()), pose, pool) : 0;
    counts.fill(0);
    let chairs = 0;
    let pushed = 0;
    carriedCounts.fill(0);
    loadCounts.fill(0);
    for (let k = 0; k < count; k += 1) {
      const m = pool[k] as Mover;
      const mesh = meshes.current[m.character];
      if (!mesh) continue;
      writePerson(mesh, counts[m.character] ?? 0, m);
      counts[m.character] = (counts[m.character] ?? 0) + 1;
      if (m.accessory === 'wheelchair' && wheelchairs.current) {
        writePerson(wheelchairs.current, chairs, m);
        chairs += 1;
      }
      const prop = m.accessory === null || m.accessory === 'wheelchair' ? -1 : CARRIED.indexOf(m.accessory);
      const holding = carriedMeshes.current[prop];
      if (holding) {
        writePerson(holding, carriedCounts[prop] ?? 0, m);
        carriedCounts[prop] = (carriedCounts[prop] ?? 0) + 1;
      }
      if (m.cart !== null && carts.current) {
        writePerson(carts.current, pushed, m);
        pushed += 1;
        const load = LOADS.indexOf(m.cart);
        const loaded = loadMeshes.current[load];
        if (loaded) {
          writePerson(loaded, loadCounts[load] ?? 0, m);
          loadCounts[load] = (loadCounts[load] ?? 0) + 1;
        }
      }
    }
    meshes.current.forEach((mesh, i) => finish(mesh, counts[i] ?? 0));
    finish(wheelchairs.current, chairs);
    carriedMeshes.current.forEach((mesh, i) => finish(mesh, carriedCounts[i] ?? 0));
    finish(carts.current, pushed);
    loadMeshes.current.forEach((mesh, i) => finish(mesh, loadCounts[i] ?? 0));
  });

  return (
    <>
      {geometries.map((geometry, i) => (
        <instancedMesh
          key={i}
          ref={(mesh) => {
            meshes.current[i] = mesh;
          }}
          args={[geometry, material, PEOPLE_CAP]}
          customDepthMaterial={depth}
          castShadow
          receiveShadow
          frustumCulled={false}
        />
      ))}
      <instancedMesh ref={wheelchairs} args={[wheelchairGeometry, material, PEOPLE_CAP]} customDepthMaterial={depth} castShadow frustumCulled={false} />
      {carriedGeometries.map((geometry, i) => (
        <instancedMesh
          key={i}
          ref={(mesh) => {
            carriedMeshes.current[i] = mesh;
          }}
          args={[geometry, material, PEOPLE_CAP]}
          customDepthMaterial={depth}
          castShadow
          frustumCulled={false}
        />
      ))}
      <instancedMesh ref={carts} args={[cartShape, material, PEOPLE_CAP]} customDepthMaterial={depth} castShadow frustumCulled={false} />
      {loadGeometries.map((geometry, i) => (
        <instancedMesh
          key={i}
          ref={(mesh) => {
            loadMeshes.current[i] = mesh;
          }}
          args={[geometry, material, PEOPLE_CAP]}
          customDepthMaterial={depth}
          castShadow
          frustumCulled={false}
        />
      ))}
    </>
  );
}
