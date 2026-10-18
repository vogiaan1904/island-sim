import type { Pose } from './controller.ts';

// Where the real camera is this frame. The store's `view.camera` is where the camera is asked to be; the real one glides
// toward it, so anything drawn over the island that must stick to it (the bubbles over buildings) projects through this
// pose, not through the asked-for one. The camera rig writes it every frame and clears it when it goes away; before
// that (and in tests, which have no canvas) readers fall back to the pose of `view.camera`.

let live: Pose | null = null;

export function setLivePose(pose: Pose | null): void {
  live = pose;
}

export function getLivePose(): Pose | null {
  return live;
}
