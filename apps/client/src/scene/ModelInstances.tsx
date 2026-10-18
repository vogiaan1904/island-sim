import { useLayoutEffect, useRef } from 'react';
import { Euler, Matrix4, Quaternion, Vector3, type InstancedMesh } from 'three';
import type { ModelInstance } from '../render/instances.ts';
import { useModelGeometry } from './modelGeometry.ts';
import { usePaletteMaterial } from './palette.ts';

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
 * changes (at most once per tick); the matrices are written imperatively, never one component per instance.
 */
export function ModelInstances({ file, instances }: { file: string; instances: readonly ModelInstance[] }) {
  const geometry = useModelGeometry(file);
  const material = usePaletteMaterial();
  const mesh = useRef<InstancedMesh>(null);
  const capacity = capacityFor(instances.length);

  useLayoutEffect(() => {
    const target = mesh.current;
    if (target === null) return;
    instances.forEach((instance, i) => {
      place.set(instance.x, instance.y ?? 0, instance.z);
      turn.setFromEuler(euler.set(0, instance.rotationY, 0));
      // A site rises in steps: its height is scaled to the share of the building that shows.
      scale.set(1, instance.rise ?? 1, 1);
      target.setMatrixAt(i, matrix.compose(place, turn, scale));
    });
    target.count = instances.length;
    target.instanceMatrix.needsUpdate = true;
    target.computeBoundingSphere();
  }, [instances]);

  return <instancedMesh key={capacity} ref={mesh} args={[geometry, material, capacity]} />;
}
