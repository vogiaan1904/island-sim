import { content } from '@island/content';
import { CameraControls, CameraControlsImpl } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Vector3 } from 'three';
import { cameraPose, groundPoint, type Key, type Pose } from '../camera/controller.ts';
import { ISLAND_LIMITS } from '../camera/limits.ts';
import { setLivePose } from '../camera/livePose.ts';
import { tapTarget } from '../camera/tap.ts';
import { useCameraInput } from '../camera/useCameraInput.ts';
import { aimAt, aimPoint, groundTile } from '../placement/draft.ts';
import { useGame } from '../session/game.tsx';

const NONE = CameraControlsImpl.ACTION.NONE;
const scratch = new Vector3();

/** How soon the real camera catches up with the asked-for one, in seconds. Ticket 08 tunes it on a real phone. */
const SMOOTH_TIME = 0.2;

/**
 * Owns the camera. Input goes through the pure controller (`camera/controller.ts`) into the store's `view.camera`;
 * camera-controls has none of its own input and only smooths the real camera toward that target. Taps are cast onto the
 * ground from where the camera really is, and tell the app about a building at once.
 */
export function CameraRig() {
  const { store } = useGame();
  const gl = useThree((three) => three.gl);
  const controls = useRef<CameraControlsImpl>(null);
  const applied = useRef<{ camera: unknown; jumps: number }>({ camera: null, jumps: -1 });

  const keys = useCameraInput({
    element: gl.domElement,
    store,
    // Placing a building: the ghost snaps to the tile under the pointer (above a finger), and the camera stays put.
    onAim: (x, y, pointer) => {
      const impl = controls.current;
      const placement = store.getState().view.placement;
      if (impl === null || placement === null) return;
      impl.getTarget(scratch);
      const pose: Pose = { x: scratch.x, z: scratch.z, distance: impl.distance, azimuth: impl.azimuthAngle, polar: impl.polarAngle };
      const rect = gl.domElement.getBoundingClientRect();
      const at = aimPoint({ x, y }, pointer);
      const ground = groundPoint(pose, { width: rect.width, height: rect.height }, at.x, at.y);
      if (ground === null) return;
      const next = aimAt(placement, groundTile(ground), content);
      if (next !== placement) store.getState().setView({ placement: next });
    },
    onTap: (x, y) => {
      const impl = controls.current;
      const island = store.getState().island?.state;
      if (impl === null || island === undefined) return true;
      impl.getTarget(scratch);
      const pose: Pose = { x: scratch.x, z: scratch.z, distance: impl.distance, azimuth: impl.azimuthAngle, polar: impl.polarAngle };
      const rect = gl.domElement.getBoundingClientRect();
      const hit = tapTarget(island, content, pose, { width: rect.width, height: rect.height }, x, y);
      store.getState().setView({ tappedBuilding: hit?.buildingId ?? null });
      return hit !== null && hit.buildingId === null;
    },
  });

  // The overlay's bubbles stick to the real camera, which glides behind the asked-for one.
  useEffect(() => () => setLivePose(null), []);

  useFrame((_, delta) => {
    const impl = controls.current;
    if (impl === null) return;
    impl.getTarget(scratch);
    setLivePose({ x: scratch.x, z: scratch.z, distance: impl.distance, azimuth: impl.azimuthAngle, polar: impl.polarAngle });
    const dt = Math.min(delta, 0.1);
    if (keys.size > 0) store.getState().cameraGesture({ kind: 'keys', held: [...keys] as Key[], dt });
    store.getState().cameraStep(dt);
    const camera = store.getState().view.camera;
    if (applied.current.camera === camera) return;
    const smooth = applied.current.jumps === camera.jumps;
    applied.current = { camera, jumps: camera.jumps };
    const pose = cameraPose(camera, ISLAND_LIMITS);
    void impl.moveTo(pose.x, 0, pose.z, smooth);
    void impl.dollyTo(pose.distance, smooth);
    void impl.rotateTo(pose.azimuth, pose.polar, smooth);
  });

  return (
    <CameraControls
      ref={controls}
      mouseButtons={{ left: NONE, middle: NONE, right: NONE, wheel: NONE }}
      touches={{ one: NONE, two: NONE, three: NONE }}
      smoothTime={SMOOTH_TIME}
      draggingSmoothTime={SMOOTH_TIME}
      minDistance={ISLAND_LIMITS.minDistance}
      maxDistance={ISLAND_LIMITS.maxDistance}
      minPolarAngle={ISLAND_LIMITS.minPolar}
      maxPolarAngle={ISLAND_LIMITS.maxPolar}
    />
  );
}
