import { content } from '@island/content';
import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect, useState } from 'react';
import { CAMERA_FOV } from '../camera/controller.ts';
import { TILE_SIZE } from '../render/look.ts';
import { guessQuality, pixelRatioFor } from '../render/quality.ts';
import { useGame, useGameState } from '../session/game.tsx';
import { Buildings } from './Buildings.tsx';
import { CameraRig } from './CameraRig.tsx';
import { useFrameLoop } from './frameLoop.ts';
import { QualityProbe } from './QualityProbe.tsx';
import { DayNight, Sun } from './Sun.tsx';
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
 * The 3D island: terrain, water, the buildings and the sun, seen from the free camera (`CameraRig`). The default export, so the app loads three.js in its own chunk.
 */
export default function IslandCanvas({ onReady }: { onReady: () => void }) {
  const { store } = useGame();
  const island = useGameState((state) => state.island?.state ?? null);
  const chosen = useGameState((state) => state.view.quality);
  // The device's first guess, made once. The tier in use is the player's choice if there is one, else this guess.
  const [guessed] = useState(() =>
    guessQuality({
      touch: window.matchMedia('(pointer: coarse)').matches,
      devicePixelRatio: window.devicePixelRatio,
      deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
      hardwareConcurrency: navigator.hardwareConcurrency,
    }),
  );
  useEffect(() => {
    if (store.getState().view.quality === null) store.getState().setView({ quality: guessed });
  }, [store, guessed]);
  const quality = chosen ?? guessed;
  const frameloop = useFrameLoop();
  return (
    <div className="island-canvas">
      <Canvas
        frameloop={frameloop}
        shadows="percentage"
        dpr={pixelRatioFor(quality, window.devicePixelRatio)}
        camera={{ position: [MIDDLE, 95, MIDDLE + 125], fov: CAMERA_FOV, near: 1, far: 2000 }}
      >
        <CameraRig />
        <DayNight />
        <Sun quality={quality} />
        <Water size={SIZE} />
        {island !== null && <Terrain terrain={island.terrain} size={SIZE} />}
        <Suspense fallback={null}>
          {island !== null && <Buildings island={island} />}
          <Ready onReady={onReady} />
          <QualityProbe guessed={guessed} />
        </Suspense>
      </Canvas>
    </div>
  );
}
