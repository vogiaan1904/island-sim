import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Mesh } from 'three';
import { FERRY_MODEL, ferryPose, newFerryPose, type FerrySchedule } from '../render/ferry.ts';
import { useGame } from '../session/game.tsx';
import { useModelGeometry } from './modelGeometry.ts';
import { usePaletteMaterial } from './palette.ts';

const pose = newFerryPose();

/** The commuter ferry: one mesh on the palette, placed every frame from the gliding game time (`render/ferry.ts`). */
export function Ferry({ schedule }: { schedule: FerrySchedule }) {
  const { clock } = useGame();
  const geometry = useModelGeometry(FERRY_MODEL);
  const material = usePaletteMaterial();
  const mesh = useRef<Mesh>(null);
  useFrame(() => {
    const boat = mesh.current;
    if (boat === null) return;
    ferryPose(schedule, clock.ticksAt(performance.now()), pose);
    boat.visible = pose.visible;
    if (!pose.visible) return;
    boat.position.set(pose.x, pose.y, pose.z);
    boat.rotation.set(0, pose.heading, 0);
  });
  return <mesh ref={mesh} args={[geometry, material]} castShadow receiveShadow visible={false} />;
}
