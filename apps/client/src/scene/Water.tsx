import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { Color, ShaderMaterial, Vector3 } from 'three';
import { useGame } from '../session/game.tsx';
import { LOOK, TILE_SIZE, sunDirection } from '../render/look.ts';
import { WATER_LEVEL } from '../render/terrain.ts';
import { daylight, toSun } from './Sun.tsx';

// One water surface around the island with a cheap wave in its vertex shader. Its time is the gliding game clock
// (in ticks), the single animation time source, so a pinned clock gives the same water.

const vertexShader = /* glsl */ `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vWorld;

  // Two slow crossing swells; height in world units, phase in radians. One tick is 2.5 s of real time.
  float wave(vec2 p) {
    return 0.12 * sin(p.x * 0.21 + uTime * 1.3) + 0.08 * sin(p.y * 0.27 - uTime * 1.1 + p.x * 0.05);
  }

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    float h = wave(world.xz);
    float dx = wave(world.xz + vec2(0.5, 0.0)) - h;
    float dz = wave(world.xz + vec2(0.0, 0.5)) - h;
    world.y += h;
    vNormal = normalize(vec3(-dx, 0.5, -dz));
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uSky;
  uniform vec3 uSunColor;
  uniform vec3 uSunDirection;
  varying vec3 vNormal;
  varying vec3 vWorld;

  void main() {
    vec3 n = normalize(vNormal);
    float diffuse = max(dot(n, uSunDirection), 0.0);
    vec3 toEye = normalize(cameraPosition - vWorld);
    float glint = pow(max(dot(reflect(-uSunDirection, n), toEye), 0.0), 60.0);
    vec3 color = uColor * (uSky * 0.7 + uSunColor * diffuse * 0.6) + uSunColor * glint * 0.35;
    gl_FragColor = vec4(color, 0.86);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function Water({ size }: { size: number }) {
  const { clock } = useGame();
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new Color().setRGB(...LOOK.water) },
          uSky: { value: new Color().setRGB(...LOOK.sky) },
          uSunColor: { value: new Color().setRGB(...LOOK.sun.color) },
          uSunDirection: { value: new Vector3(...sunDirection(LOOK.sun)) },
        },
      }),
    [],
  );
  useFrame(() => {
    const { uTime, uSky, uSunColor, uSunDirection } = material.uniforms;
    if (uTime !== undefined) uTime.value = clock.ticksAt(performance.now());
    // The water takes the light of the moment (the day-night state is written before this frame callback runs).
    (uSky?.value as Color | undefined)?.setRGB(...daylight.fill);
    (uSunColor?.value as Color | undefined)?.setRGB(...daylight.sun.color).multiplyScalar(daylight.sun.energy / LOOK.sun.energy);
    (uSunDirection?.value as Vector3 | undefined)?.copy(toSun);
  });

  const middle = (size * TILE_SIZE) / 2;
  return (
    <mesh material={material} position={[middle, WATER_LEVEL, middle]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[size * TILE_SIZE * 4, size * TILE_SIZE * 4, 96, 96]} />
    </mesh>
  );
}
