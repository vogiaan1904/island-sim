// Where the one shadow map looks (island-3d-client, "Day and night, shadows"). The shadow camera follows what the
// player is looking at and covers only the area near it; its center is snapped to whole texels so shadow edges do not
// shimmer while the camera pans. Pure math on plain triples, so it is unit-tested.

export type Vec3 = readonly [number, number, number];

/**
 * The point on the ground (y = 0) the camera looks at: its ray from `position` along `direction`. A camera that looks
 * level or upward has none, so the point below it is used; a very far hit is held within `maxDistance` of the camera
 * (horizontally), so the shadow map never goes off toward the horizon.
 */
export function groundPoint(position: Vec3, direction: Vec3, maxDistance = 400): [number, number, number] {
  const [px, py, pz] = position;
  const [dx, dy, dz] = direction;
  if (dy >= -1e-6 || py <= 0) return [px, 0, pz];
  const t = py / -dy;
  let x = px + dx * t;
  let z = pz + dz * t;
  const reach = Math.hypot(x - px, z - pz);
  if (reach > maxDistance) {
    x = px + ((x - px) * maxDistance) / reach;
    z = pz + ((z - pz) * maxDistance) / reach;
  }
  return [x, 0, z];
}

/** World size of one texel of a square shadow map of this many pixels covering `halfExtent` each way from its center. */
export function shadowTexel(halfExtent: number, mapSize: number): number {
  return (2 * halfExtent) / mapSize;
}

/**
 * Snaps a focus point to whole texels in the light's own sideways and upward axes, leaving its position along the light
 * unchanged. `toLight` is the direction from the island toward the sun (it need not be exactly unit length).
 */
export function snapToTexels(focus: Vec3, toLight: Vec3, texel: number): [number, number, number] {
  const length = Math.hypot(toLight[0], toLight[1], toLight[2]);
  const lx = toLight[0] / length;
  const ly = toLight[1] / length;
  const lz = toLight[2] / length;
  // Sideways = up x light, normalized; a light straight overhead has no sideways, so use east.
  let sx = lz;
  let sz = -lx;
  const sideLength = Math.hypot(sx, sz);
  if (sideLength < 1e-6) {
    sx = 1;
    sz = 0;
  } else {
    sx /= sideLength;
    sz /= sideLength;
  }
  // Upward in the light camera = light x sideways.
  const ux = ly * sz;
  const uy = lz * sx - lx * sz;
  const uz = -ly * sx;
  const [fx, fy, fz] = focus;
  const along = fx * lx + fy * ly + fz * lz;
  const across = Math.round((fx * sx + fz * sz) / texel) * texel;
  const high = Math.round((fx * ux + fy * uy + fz * uz) / texel) * texel;
  return [lx * along + sx * across + ux * high, ly * along + uy * high, lz * along + sz * across + uz * high];
}
