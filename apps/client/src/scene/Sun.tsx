import { content } from '@island/content';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Color, Object3D, Vector3, type AmbientLight, type DirectionalLight } from 'three';
import { daylightAt, newDaylight } from '../render/daylight.ts';
import { sunDirection } from '../render/look.ts';
import { shadowMapSize, shadowsOn, type Quality } from '../render/quality.ts';
import { groundPoint, shadowTexel, snapToTexels } from '../render/shadow.ts';
import { useGame } from '../session/game.tsx';
import { windowGlow } from './palette.ts';

/** The light of the moment, written once a frame by `DayNight` (priority -1, before everything that reads it). */
export const daylight = newDaylight();
/** The unit vector from the island toward the sun (or the moon), matching `daylight`. */
export const toSun = new Vector3(0, 1, 0);

/** Half the width of the square the shadow map covers around what the camera looks at, in world units. */
const SHADOW_HALF_EXTENT = 60;
const SHADOW_DISTANCE = 250;

const scratch = { direction: new Vector3() };

/**
 * Day and night from the gliding game clock: fills `daylight`, `toSun` and the window glow, and moves the sky color.
 * It renders nothing. Everything else that follows the light reads those values in its own frame callback.
 */
export function DayNight() {
  const { clock } = useGame();
  const scene = useThree((state) => state.scene);
  const sky = useMemo(() => new Color(), []);
  useEffect(() => {
    scene.background = sky;
    return () => {
      scene.background = null;
    };
  }, [scene, sky]);
  useFrame(() => {
    daylightAt(clock.ticksAt(performance.now()), content.rules, daylight);
    const [x, y, z] = sunDirection(daylight.sun);
    toSun.set(x, y, z);
    windowGlow.value = daylight.night;
    sky.setRGB(...daylight.sky);
  }, -1);
  return null;
}

/**
 * The one sun, aimed at what the camera looks at, and a sky fill. No other lights (rule 8). At night the same light is
 * dim moonlight. The shadow map (off on Low) covers the area near the camera and moves in whole texels.
 */
export function Sun({ quality }: { quality: Quality }) {
  const light = useRef<DirectionalLight>(null);
  const fill = useRef<AmbientLight>(null);
  const target = useMemo(() => new Object3D(), []);
  const shadows = shadowsOn(quality);
  const mapSize = shadowMapSize(quality);
  const texel = mapSize > 0 ? shadowTexel(SHADOW_HALF_EXTENT, mapSize) : 0;

  useFrame(({ camera }) => {
    const sun = light.current;
    const ambient = fill.current;
    if (sun === null || ambient === null) return;
    sun.color.setRGB(...daylight.sun.color);
    sun.intensity = daylight.sun.energy;
    ambient.color.setRGB(...daylight.fill);

    camera.getWorldDirection(scratch.direction);
    const [fx, fy, fz] = groundPoint(
      [camera.position.x, camera.position.y, camera.position.z],
      [scratch.direction.x, scratch.direction.y, scratch.direction.z],
    );
    const [tx, ty, tz] = shadows ? snapToTexels([fx, fy, fz], [toSun.x, toSun.y, toSun.z], texel) : [fx, fy, fz];
    target.position.set(tx, ty, tz);
    target.updateMatrixWorld();
    sun.position.set(tx + toSun.x * SHADOW_DISTANCE, ty + toSun.y * SHADOW_DISTANCE, tz + toSun.z * SHADOW_DISTANCE);
  });

  return (
    <>
      <primitive object={target} />
      {/* A new map size needs a new light: three.js cannot resize a shadow map in place. */}
      <directionalLight
        key={mapSize}
        ref={light}
        target={target}
        castShadow={shadows}
        shadow-mapSize={[mapSize || 1, mapSize || 1]}
        shadow-camera-left={-SHADOW_HALF_EXTENT}
        shadow-camera-right={SHADOW_HALF_EXTENT}
        shadow-camera-top={SHADOW_HALF_EXTENT}
        shadow-camera-bottom={-SHADOW_HALF_EXTENT}
        shadow-camera-near={1}
        shadow-camera-far={SHADOW_DISTANCE * 2}
        shadow-bias={-0.0004}
        shadow-normalBias={0.05}
      />
      <ambientLight ref={fill} intensity={1} />
    </>
  );
}
