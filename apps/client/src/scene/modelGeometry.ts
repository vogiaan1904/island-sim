import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import { BufferAttribute, BufferGeometry, Matrix3, Vector3, type Mesh, type Object3D } from 'three';
import { modelUrl } from '../render/models.ts';

const position = new Vector3();
const normal = new Vector3();
const normalMatrix = new Matrix3();

/**
 * A model's one mesh as plain geometry in metres, ready to instance. meshopt quantization stores POSITION and NORMAL
 * as normalized int16 in [-1, 1], with the real translation and scale on the mesh node: those are folded in here once,
 * into float attributes (the dequantize rule of the model contract). UVs stay as they are.
 */
export function bakedGeometry(scene: Object3D): BufferGeometry {
  scene.updateMatrixWorld(true);
  const meshes: Mesh[] = [];
  scene.traverse((object) => {
    if ((object as Mesh).isMesh) meshes.push(object as Mesh);
  });
  const mesh = meshes[0];
  if (mesh === undefined) throw new Error(`model ${scene.name} has no mesh`);
  if (meshes.length > 1 && import.meta.env.DEV) console.warn(`model ${scene.name} has ${meshes.length} meshes; only the first is drawn`);

  const source = mesh.geometry;
  const geometry = new BufferGeometry();
  const positions = source.getAttribute('position');
  const baked = new Float32Array(positions.count * 3);
  for (let i = 0; i < positions.count; i += 1) {
    position.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
    baked.set([position.x, position.y, position.z], i * 3);
  }
  geometry.setAttribute('position', new BufferAttribute(baked, 3));
  const normals = source.getAttribute('normal');
  if (normals !== undefined) {
    normalMatrix.getNormalMatrix(mesh.matrixWorld);
    const bakedNormals = new Float32Array(normals.count * 3);
    for (let i = 0; i < normals.count; i += 1) {
      normal.fromBufferAttribute(normals, i).applyMatrix3(normalMatrix).normalize();
      bakedNormals.set([normal.x, normal.y, normal.z], i * 3);
    }
    geometry.setAttribute('normal', new BufferAttribute(bakedNormals, 3));
  }
  const uv = source.getAttribute('uv');
  if (uv !== undefined) geometry.setAttribute('uv', uv);
  if (source.index !== null) geometry.setIndex(source.index);
  geometry.computeBoundingSphere();
  return geometry;
}

/** Loads a catalog model (meshopt, no Draco) and returns its baked geometry; suspends while it loads. */
export function useModelGeometry(file: string): BufferGeometry {
  const gltf = useGLTF(modelUrl(file), false, true);
  return useMemo(() => bakedGeometry(gltf.scene), [gltf]);
}
