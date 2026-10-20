import { useLayoutEffect, useRef } from 'react';
import { Euler, InstancedBufferAttribute, Matrix4, Quaternion, Vector3, type InstancedMesh, type Material } from 'three';
import type { ModelInstance } from '../render/instances.ts';
import { useModelGeometry } from './modelGeometry.ts';
import { CUT_ATTRIBUTE, paletteDepthMaterial, usePaletteMaterial } from './palette.ts';

const matrix = new Matrix4();
const place = new Vector3();
const turn = new Quaternion();
const euler = new Euler();
const scale = new Vector3(1, 1, 1);

/** Room to grow before the instance buffer has to be made again. */
function capacityFor(count: number): number {
  return Math.max(8, 2 ** Math.ceil(Math.log2(count + 1)));
}

/**
 * One model type as one instanced draw call on the shared palette material. React renders it when its instance list
 * changes (at most once per tick); the matrices are written imperatively, never one component per instance. A site
 * under construction is cut at its `rise` share of the model's height (the palette material's per-instance cut), in
 * the shadow pass too.
 */
export function ModelInstances({ file, instances, material: own }: { file: string; instances: readonly ModelInstance[]; material?: Material }) {
  const geometry = useModelGeometry(file);
  const palette = usePaletteMaterial();
  // A preview (the road drag) brings its own see-through material and casts no shadow.
  const material = own ?? palette;
  const mesh = useRef<InstancedMesh>(null);
  const capacity = capacityFor(instances.length);

  useLayoutEffect(() => {
    const target = mesh.current;
    if (target === null) return;
    // The geometry is this component's own bake (useModelGeometry), so the cut attribute is not shared with a ghost.
    let cuts = geometry.getAttribute(CUT_ATTRIBUTE) as InstancedBufferAttribute | undefined;
    if (cuts === undefined || cuts.count < capacity) {
      cuts = new InstancedBufferAttribute(new Float32Array(capacity), 1);
      geometry.setAttribute(CUT_ATTRIBUTE, cuts);
    }
    if (geometry.boundingBox === null) geometry.computeBoundingBox();
    const top = geometry.boundingBox?.max.y ?? 0;
    instances.forEach((instance, i) => {
      place.set(instance.x, instance.y ?? 0, instance.z);
      turn.setFromEuler(euler.set(0, instance.rotationY, 0));
      target.setMatrixAt(i, matrix.compose(place, turn, scale));
      // 0 draws the model whole; a rising site is cut at its share of the height (rise > 0 whenever it is drawn).
      cuts.setX(i, instance.rise === undefined ? 0 : instance.rise * top);
    });
    target.count = instances.length;
    target.instanceMatrix.needsUpdate = true;
    cuts.needsUpdate = true;
    target.computeBoundingSphere();
  }, [instances, geometry, capacity]);

  const casts = own === undefined;
  return (
    <instancedMesh
      key={capacity}
      ref={mesh}
      args={[geometry, material, capacity]}
      customDepthMaterial={casts ? paletteDepthMaterial() : undefined}
      castShadow={casts}
      receiveShadow={casts}
    />
  );
}
