import { content } from '@island/content';
import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect } from 'react';
import { Color } from 'three';
import { LOOK, TILE_SIZE } from '../render/look.ts';
import { useGameState } from '../session/game.tsx';
import { Buildings } from './Buildings.tsx';
import { Sun } from './Sun.tsx';
import { Terrain } from './Terrain.tsx';
import { Water } from './Water.tsx';
import './IslandCanvas.css';

const SIZE = content.rules.islandSize;
const MIDDLE = (SIZE * TILE_SIZE) / 2;

/** Calls back once every model inside the same Suspense boundary has loaded. */
function Ready({ onReady }: { onReady: () => void }) {
  useEffect(onReady, [onReady]);
  return null;
}

/**
 * The 3D island: terrain, water, the buildings and the sun, seen from a fixed camera for now (the free camera is
 * ticket 07). The default export, so the app loads three.js in its own chunk.
 */
export default function IslandCanvas({ onReady }: { onReady: () => void }) {
  const island = useGameState((state) => state.island?.state ?? null);
  return (
    <div className="island-canvas">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [MIDDLE, 95, MIDDLE + 125], fov: 40, near: 1, far: 2000 }}
        onCreated={({ camera }) => camera.lookAt(MIDDLE, 0, MIDDLE)}
      >
        <color attach="background" args={[new Color().setRGB(...LOOK.sky)]} />
        <Sun middle={MIDDLE} />
        <Water size={SIZE} />
        {island !== null && <Terrain terrain={island.terrain} size={SIZE} />}
        <Suspense fallback={null}>
          {island !== null && <Buildings island={island} />}
          <Ready onReady={onReady} />
        </Suspense>
      </Canvas>
    </div>
  );
}
