import { roofTop, type Roofs } from '../render/roofs.ts';

// The camera controller (spec 6.1, 12.5): pure. A camera state plus one normalized gesture gives the next camera state,
// with the limits (around the island, never below the ground, tilt range), auto-tilt and momentum. It knows nothing of
// events, React or three.js: the binding in `input.ts` and `useCameraInput.ts` only turns browser events into the
// `Gesture`s below, and the rig only smooths the real camera toward `cameraPose`.
//
// World: x east, z south, y up, a tile is 4 units. North is -z (the sun's azimuth in `look.ts` is turned from +z).
// Azimuth 0 puts the camera south of the target looking north, so north is up the screen; it grows as the camera
// moves around toward the east. Tilt ("polar") is the angle from straight down: 0 looks down, near pi/2 looks across.

/** Vertical field of view of the game camera, in degrees. */
export const CAMERA_FOV = 40;

export interface Viewport {
  width: number;
  height: number;
}

export interface Limits {
  /** The target stays inside this box on the ground: the island and a margin. */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Street level and the whole island in view, as distances from the target to the eye. */
  minDistance: number;
  maxDistance: number;
  /** Tilt range in radians from straight down. */
  minPolar: number;
  maxPolar: number;
  /** The eye stays at least this high above the ground. */
  clearance: number;
  /** What stands on the island, and how far above its top the eye stays (null: open ground everywhere). */
  roofs: Roofs | null;
  roofClearance: number;
  /** Radians added to the player's tilt when fully zoomed in; fades to nothing when zoomed out. */
  autoTilt: number;
  center: { x: number; z: number };
  startDistance: number;
  startTilt: number;
}

/** Limits for a square island of `tiles` tiles of `tileSize` units. */
export function limitsForIsland(tiles: number, tileSize: number): Limits {
  const world = tiles * tileSize;
  const margin = world / 8;
  return {
    bounds: { minX: -margin, maxX: world + margin, minZ: -margin, maxZ: world + margin },
    minDistance: 10,
    maxDistance: world * 2.4,
    minPolar: 0,
    maxPolar: 1.4,
    clearance: 3,
    roofs: null,
    roofClearance: 2,
    autoTilt: 0.26,
    center: { x: world / 2, z: world / 2 },
    startDistance: 150,
    startTilt: 0.9,
  };
}

// The tuned numbers (spec 12.5 leaves them open; ticket 08 tunes them on a real phone).
export const TUNING = {
  /** Two fingers: the movement that must happen before the gesture decides between tilt and move-zoom-turn. */
  decideMovePx: 12,
  /** Accumulated distance change (as a natural log of the finger distance ratio, about 6 percent) that means pinch. */
  decidePinch: 0.06,
  /** Accumulated twist, about 4 degrees, that means twist. */
  decideTwist: 0.07,
  /** Tilt needs mostly vertical movement: sideways at most this share of the vertical. */
  tiltSideways: 0.5,
  tiltPerPx: 0.004,
  orbitAzimuthPerPx: 0.005,
  wheelZoomPerPx: 0.0015,
  doubleTapFactor: 0.5,
  /** Keys: share of the distance covered per second, and turn speed in radians per second. */
  keyMovePerSecond: 0.9,
  keyTurnPerSecond: 1.4,
  /** Momentum: seconds for the speed to fall by a factor e, the longest pause before lifting that still flings. */
  momentumTau: 0.35,
  flingMaxIdleMs: 100,
  /** Speeds that start a fling: distances per second for moving, radians for turning, ln-distance for zooming. */
  flingMove: 0.25,
  flingTurn: 0.25,
  flingZoom: 0.2,
  /** Speeds below which a fling has come to rest. */
  restMove: 0.04,
  restTurn: 0.03,
  restZoom: 0.03,
  /** Caps on release speed, so one jittery frame cannot throw the camera. */
  maxMove: 3,
  maxTurn: 6,
  maxZoom: 3,
  /** How much each new sample counts when the release speed is tracked. */
  velocitySmoothing: 0.5,
  minDt: 1 / 120,
} as const;

export type Key = 'forward' | 'back' | 'left' | 'right' | 'turn-left' | 'turn-right';

/** Everything a person can do to the camera, normalized from touch, mouse, trackpad and keyboard. */
export type Gesture =
  /** One finger or the left mouse button, moved to (x, y) by (dx, dy) pixels in dt seconds. */
  | { kind: 'drag'; x: number; y: number; dx: number; dy: number; dt: number; viewport: Viewport }
  /** A trackpad two-finger swipe: wheel deltas at the cursor, content following the fingers. */
  | { kind: 'swipe'; dx: number; dy: number; x: number; y: number; viewport: Viewport }
  /** Right mouse drag: turn and tilt. */
  | { kind: 'orbit'; dx: number; dy: number }
  /** Two fingers since the last event: midpoint moved (dx, dy) to (x, y), finger distance times `scale`, twisted clockwise by `rotation` radians. */
  | { kind: 'two-finger'; dx: number; dy: number; scale: number; rotation: number; x: number; y: number; dt: number; viewport: Viewport }
  /** A zoom by `scale` (above 1 zooms in) toward (x, y): a trackpad pinch. */
  | { kind: 'zoom'; scale: number; x: number; y: number; viewport: Viewport }
  /** A mouse wheel: positive deltaY zooms out, toward the cursor. */
  | { kind: 'wheel'; deltaY: number; x: number; y: number; viewport: Viewport }
  /** A turn by `angle` radians, clockwise positive. */
  | { kind: 'twist'; angle: number }
  | { kind: 'keys'; held: readonly Key[]; dt: number }
  | { kind: 'double-tap'; x: number; y: number; viewport: Viewport }
  | { kind: 'face-north' }
  /** Look at a ground point; what is not given stays as it is. `instant` jumps with no glide. */
  | { kind: 'fly-to'; x: number; z: number; distance?: number; azimuth?: number; tilt?: number; instant?: boolean }
  /** Fingers lifted or the button released; `idleMs` is how long they rested before lifting. */
  | { kind: 'release'; idleMs: number }
  /** Stop all momentum (any new touch). */
  | { kind: 'stop' };

interface Velocity {
  x: number;
  z: number;
  azimuth: number;
  /** Change of ln(distance) per second. */
  zoom: number;
}

interface TwoFingerLock {
  phase: 'idle' | 'undecided' | 'tilt' | 'free';
  dx: number;
  dy: number;
  ln: number;
  rot: number;
}

export interface CameraState {
  /** The ground point looked at. */
  x: number;
  z: number;
  distance: number;
  azimuth: number;
  /** The tilt the player chose; the real tilt adds the auto-tilt (see `cameraPose`). */
  tilt: number;
  velocity: Velocity;
  coasting: boolean;
  /** Where on screen the last zoom happened, so a coasting zoom keeps zooming toward it. */
  zoomAt: { x: number; y: number; viewport: Viewport } | null;
  lock: TwoFingerLock;
  /** Counts jumps with no glide, so the renderer can tell a new one. */
  jumps: number;
}

/** Where the real camera should be: looking at (x, 0, z) from `distance`, turned `azimuth`, `polar` from straight down. */
export interface Pose {
  x: number;
  z: number;
  distance: number;
  azimuth: number;
  polar: number;
}

const noLock = (): TwoFingerLock => ({ phase: 'idle', dx: 0, dy: 0, ln: 0, rot: 0 });
const noVelocity = (): Velocity => ({ x: 0, z: 0, azimuth: 0, zoom: 0 });
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

function autoTiltOffset(distance: number, limits: Limits): number {
  const t = clamp(Math.log(distance / limits.minDistance) / Math.log(limits.maxDistance / limits.minDistance), 0, 1);
  return limits.autoTilt * (1 - t) * (1 - t);
}

/** The tilt range at a distance: low to high, the high end keeping the eye above the clearance. */
function polarRange(distance: number, limits: Limits): { low: number; high: number } {
  return { low: limits.minPolar, high: Math.min(limits.maxPolar, Math.acos(Math.min(1, limits.clearance / distance))) };
}

/** Brings a state inside every limit. */
function normalize(state: CameraState, limits: Limits): CameraState {
  const distance = clamp(state.distance, limits.minDistance, limits.maxDistance);
  const { low, high } = polarRange(distance, limits);
  const inside = {
    ...state,
    x: clamp(state.x, limits.bounds.minX, limits.bounds.maxX),
    z: clamp(state.z, limits.bounds.minZ, limits.bounds.maxZ),
    distance,
    tilt: clamp(state.tilt, low, Math.max(low, high - autoTiltOffset(distance, limits))),
  };
  return limits.roofs === null ? inside : aboveRoofs(inside, limits, limits.roofs);
}

/**
 * Backs the eye away along its line of sight until it is above the roofs under it. Backing away moves the eye over
 * other ground, so it looks again a few times; zooming out also lessens the auto-tilt, which only raises the eye.
 */
function aboveRoofs(state: CameraState, limits: Limits, roofs: Roofs): CameraState {
  let next = state;
  for (let i = 0; i < 4; i += 1) {
    const pose = cameraPose(next, limits);
    const out = pose.distance * Math.sin(pose.polar);
    const top = roofTop(roofs, pose.x + out * Math.sin(pose.azimuth), pose.z + out * Math.cos(pose.azimuth));
    const wanted = (top + limits.roofClearance) / Math.cos(pose.polar);
    if (top === 0 || pose.distance >= wanted - 1e-9) return next;
    next = { ...next, distance: Math.min(limits.maxDistance, wanted) };
  }
  return next;
}

export function createCamera(limits: Limits): CameraState {
  return normalize(
    {
      x: limits.center.x,
      z: limits.center.z,
      distance: limits.startDistance,
      azimuth: 0,
      tilt: limits.startTilt,
      velocity: noVelocity(),
      coasting: false,
      zoomAt: null,
      lock: noLock(),
      jumps: 0,
    },
    limits,
  );
}

export function cameraPose(state: CameraState, limits: Limits): Pose {
  const { low, high } = polarRange(state.distance, limits);
  return {
    x: state.x,
    z: state.z,
    distance: state.distance,
    azimuth: state.azimuth,
    polar: clamp(state.tilt + autoTiltOffset(state.distance, limits), low, high),
  };
}

const TAN_HALF_FOV = Math.tan((CAMERA_FOV * Math.PI) / 360);

/** The ground point (y = 0) under a screen pixel, or null when the pixel looks at the sky. Exact for a camera of this fov. */
export function groundPoint(pose: Pose, viewport: Viewport, sx: number, sy: number): { x: number; z: number } | null {
  const sinP = Math.sin(pose.polar);
  const cosP = Math.cos(pose.polar);
  const sinA = Math.sin(pose.azimuth);
  const cosA = Math.cos(pose.azimuth);
  const eye = { x: pose.x + pose.distance * sinP * sinA, y: pose.distance * cosP, z: pose.z + pose.distance * sinP * cosA };
  // Looking direction f, screen-right r and screen-up u (u = r x f).
  const f = { x: -sinP * sinA, y: -cosP, z: -sinP * cosA };
  const r = { x: cosA, y: 0, z: -sinA };
  const u = { x: r.y * f.z - r.z * f.y, y: r.z * f.x - r.x * f.z, z: r.x * f.y - r.y * f.x };
  const nx = ((sx / viewport.width) * 2 - 1) * (viewport.width / viewport.height) * TAN_HALF_FOV;
  const ny = (1 - (sy / viewport.height) * 2) * TAN_HALF_FOV;
  const dir = { x: f.x + nx * r.x + ny * u.x, y: f.y + nx * r.y + ny * u.y, z: f.z + nx * r.z + ny * u.z };
  if (dir.y >= -1e-6) return null;
  const t = -eye.y / dir.y;
  return { x: eye.x + t * dir.x, z: eye.z + t * dir.z };
}

function stopped(state: CameraState): CameraState {
  return state.coasting || state.velocity.x !== 0 || state.velocity.z !== 0 || state.velocity.azimuth !== 0 || state.velocity.zoom !== 0
    ? { ...state, coasting: false, velocity: noVelocity() }
    : state;
}

/** Moves the target so the ground point that was under `from` is under `to`. */
function panBetween(state: CameraState, limits: Limits, viewport: Viewport, from: [number, number], to: [number, number]): CameraState {
  const pose = cameraPose(state, limits);
  const before = groundPoint(pose, viewport, from[0], from[1]);
  const after = groundPoint(pose, viewport, to[0], to[1]);
  if (before === null || after === null) return state;
  return normalize({ ...state, x: state.x + before.x - after.x, z: state.z + before.z - after.z }, limits);
}

/** Changes the distance by `factor` (below 1 zooms in) keeping the ground point under (sx, sy) under it. */
function zoomAround(state: CameraState, limits: Limits, viewport: Viewport, sx: number, sy: number, factor: number): CameraState {
  const grabbed = groundPoint(cameraPose(state, limits), viewport, sx, sy);
  const zoomed = normalize({ ...state, distance: state.distance * factor }, limits);
  if (grabbed === null) return zoomed;
  const now = groundPoint(cameraPose(zoomed, limits), viewport, sx, sy);
  if (now === null) return zoomed;
  return normalize({ ...zoomed, x: zoomed.x + grabbed.x - now.x, z: zoomed.z + grabbed.z - now.z }, limits);
}

/** Folds the change from `before` to `after` into the release speed estimate. */
function tracked(before: CameraState, after: CameraState, dt: number): CameraState {
  const seconds = Math.max(dt, TUNING.minDt);
  const mix = (old: number, measured: number, max: number) => clamp(old + (measured - old) * TUNING.velocitySmoothing, -max, max);
  const distance = Math.max(before.distance, 1e-6);
  const velocity = after.velocity;
  return {
    ...after,
    velocity: {
      x: mix(velocity.x, (after.x - before.x) / seconds, TUNING.maxMove * distance),
      z: mix(velocity.z, (after.z - before.z) / seconds, TUNING.maxMove * distance),
      azimuth: mix(velocity.azimuth, (after.azimuth - before.azimuth) / seconds, TUNING.maxTurn),
      zoom: mix(velocity.zoom, Math.log(after.distance / before.distance) / seconds, TUNING.maxZoom),
    },
  };
}

interface FreeMove {
  dx: number;
  dy: number;
  ln: number;
  rot: number;
  x: number;
  y: number;
  dt: number;
  viewport: Viewport;
}

/** Two fingers moving, zooming and turning together. */
function freeMove(state: CameraState, limits: Limits, move: FreeMove): CameraState {
  let next = panBetween(state, limits, move.viewport, [move.x - move.dx, move.y - move.dy], [move.x, move.y]);
  next = zoomAround(next, limits, move.viewport, move.x, move.y, Math.exp(-move.ln));
  next = { ...next, azimuth: next.azimuth + move.rot, zoomAt: { x: move.x, y: move.y, viewport: move.viewport } };
  return tracked(state, next, move.dt);
}

const tiltBy = (state: CameraState, limits: Limits, dy: number): CameraState => normalize({ ...state, tilt: state.tilt - dy * TUNING.tiltPerPx }, limits);

function twoFinger(state: CameraState, limits: Limits, g: Extract<Gesture, { kind: 'two-finger' }>): CameraState {
  const ln = Math.log(g.scale);
  const lock = state.lock.phase === 'idle' ? { ...noLock(), phase: 'undecided' as const } : state.lock;
  if (lock.phase === 'tilt') return tiltBy({ ...state, lock }, limits, g.dy);
  if (lock.phase === 'free') return freeMove({ ...state, lock }, limits, { ...g, ln, rot: g.rotation });

  // Undecided: add this event up and decide once the fingers moved, pinched or twisted enough to tell.
  const sum = { phase: 'undecided' as const, dx: lock.dx + g.dx, dy: lock.dy + g.dy, ln: lock.ln + ln, rot: lock.rot + g.rotation };
  const pinched = Math.abs(sum.ln) > TUNING.decidePinch;
  const twisted = Math.abs(sum.rot) > TUNING.decideTwist;
  const moved = Math.max(Math.abs(sum.dx), Math.abs(sum.dy)) >= TUNING.decideMovePx;
  if (!pinched && !twisted && !moved) return { ...state, lock: sum };
  const sideBySide = !pinched && !twisted && Math.abs(sum.dy) >= TUNING.decideMovePx && Math.abs(sum.dx) <= TUNING.tiltSideways * Math.abs(sum.dy);
  if (sideBySide) return tiltBy({ ...state, lock: { ...sum, phase: 'tilt' } }, limits, sum.dy);
  return freeMove({ ...state, lock: { ...sum, phase: 'free' } }, limits, { ...g, dx: sum.dx, dy: sum.dy, ln: sum.ln, rot: sum.rot });
}

function release(state: CameraState, idleMs: number): CameraState {
  const { velocity } = state;
  const distance = Math.max(state.distance, 1e-6);
  const fast =
    Math.hypot(velocity.x, velocity.z) / distance > TUNING.flingMove ||
    Math.abs(velocity.azimuth) > TUNING.flingTurn ||
    Math.abs(velocity.zoom) > TUNING.flingZoom;
  const flings = idleMs <= TUNING.flingMaxIdleMs && fast;
  return { ...state, lock: noLock(), coasting: flings, velocity: flings ? velocity : noVelocity() };
}

function nearestTurn(current: number, wanted: number): number {
  const full = Math.PI * 2;
  const difference = ((((wanted - current) % full) + 3 * Math.PI) % full) - Math.PI;
  return current + difference;
}

/** The camera state after one gesture. Momentum from before stops, unless the gesture is the release that starts it. */
export function applyGesture(before: CameraState, gesture: Gesture, limits: Limits): CameraState {
  if (gesture.kind === 'release') return release(before, gesture.idleMs);
  if (gesture.kind === 'stop') return stopped({ ...before, lock: noLock() });

  const state = before.coasting ? stopped(before) : before;
  switch (gesture.kind) {
    case 'drag':
      return tracked(state, panBetween(state, limits, gesture.viewport, [gesture.x - gesture.dx, gesture.y - gesture.dy], [gesture.x, gesture.y]), gesture.dt);
    case 'swipe':
      return panBetween(state, limits, gesture.viewport, [gesture.x, gesture.y], [gesture.x - gesture.dx, gesture.y - gesture.dy]);
    case 'orbit':
      return normalize({ ...state, azimuth: state.azimuth - gesture.dx * TUNING.orbitAzimuthPerPx, tilt: state.tilt - gesture.dy * TUNING.tiltPerPx }, limits);
    case 'two-finger':
      return twoFinger(state, limits, gesture);
    case 'zoom':
      return zoomAround(state, limits, gesture.viewport, gesture.x, gesture.y, 1 / gesture.scale);
    case 'wheel':
      return zoomAround(state, limits, gesture.viewport, gesture.x, gesture.y, Math.exp(gesture.deltaY * TUNING.wheelZoomPerPx));
    case 'twist':
      return { ...state, azimuth: state.azimuth + gesture.angle };
    case 'keys': {
      const held = new Set(gesture.held);
      let right = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
      let forward = (held.has('forward') ? 1 : 0) - (held.has('back') ? 1 : 0);
      const turn = (held.has('turn-left') ? 1 : 0) - (held.has('turn-right') ? 1 : 0);
      if (right === 0 && forward === 0 && turn === 0) return state;
      const length = Math.hypot(right, forward) || 1;
      right /= length;
      forward /= length;
      const reach = state.distance * TUNING.keyMovePerSecond * gesture.dt;
      const sin = Math.sin(state.azimuth);
      const cos = Math.cos(state.azimuth);
      return normalize(
        {
          ...state,
          x: state.x + reach * (right * cos - forward * sin),
          z: state.z + reach * (-right * sin - forward * cos),
          azimuth: state.azimuth + turn * TUNING.keyTurnPerSecond * gesture.dt,
        },
        limits,
      );
    }
    case 'double-tap':
      return zoomAround(state, limits, gesture.viewport, gesture.x, gesture.y, TUNING.doubleTapFactor);
    case 'face-north':
      return { ...state, azimuth: Math.round(state.azimuth / (Math.PI * 2)) * Math.PI * 2 };
    case 'fly-to':
      return normalize(
        {
          ...state,
          x: gesture.x,
          z: gesture.z,
          distance: gesture.distance ?? state.distance,
          azimuth: gesture.azimuth === undefined ? state.azimuth : nearestTurn(state.azimuth, gesture.azimuth),
          tilt: gesture.tilt ?? state.tilt,
          jumps: state.jumps + (gesture.instant === true ? 1 : 0),
          lock: noLock(),
        },
        limits,
      );
  }
}

/** Momentum: moves the camera on by `dt` seconds while it coasts, slowing down until it rests. */
export function step(state: CameraState, dt: number, limits: Limits): CameraState {
  if (!state.coasting) return state;
  const { velocity } = state;
  let next: CameraState = { ...state, x: state.x + velocity.x * dt, z: state.z + velocity.z * dt, azimuth: state.azimuth + velocity.azimuth * dt };
  next = normalize(next, limits);
  if (velocity.zoom !== 0 && state.zoomAt !== null) {
    const { x, y, viewport } = state.zoomAt;
    next = zoomAround(next, limits, viewport, x, y, Math.exp(velocity.zoom * dt));
  }
  const decay = Math.exp(-dt / TUNING.momentumTau);
  const slowed: Velocity = { x: velocity.x * decay, z: velocity.z * decay, azimuth: velocity.azimuth * decay, zoom: velocity.zoom * decay };
  const resting =
    Math.hypot(slowed.x, slowed.z) / next.distance < TUNING.restMove && Math.abs(slowed.azimuth) < TUNING.restTurn && Math.abs(slowed.zoom) < TUNING.restZoom;
  return resting ? { ...next, coasting: false, velocity: noVelocity() } : { ...next, velocity: slowed };
}
