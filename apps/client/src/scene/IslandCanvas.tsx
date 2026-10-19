import { content } from '@island/content';
import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { CAMERA_FOV } from '../camera/controller.ts';
import { crowdPlanFor } from '../render/crowd.ts';
import { TILE_SIZE } from '../render/look.ts';
import { guessQuality, pixelRatioFor } from '../render/quality.ts';
import { useGame, useGameState } from '../session/game.tsx';
import { Buildings } from './Buildings.tsx';
import { CameraRig } from './CameraRig.tsx';
import { Ferry } from './Ferry.tsx';
import { Nature } from './Nature.tsx';
import { FrameDriver } from './frameLoop.ts';
import { People } from './People.tsx';
import { PlacementGhost } from './PlacementGhost.tsx';
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
 * The 3D island: terrain, water, the buildings, nature, the people, the ferry and the sun, seen from the free camera (`CameraRig`). The default export, so the app loads three.js in its own chunk.
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
  const watching = useGameState((state) => state.view.cameraMode === 'watch');
  // Who walks where and the ferry's timetable, planned once per island update (render/crowd.ts).
  const plan = useMemo(() => (island === null ? null : crowdPlanFor(island, content)), [island]);
  return (
    <div className="island-canvas">
      <Canvas
        frameloop="never"
        shadows="percentage"
        dpr={pixelRatioFor(quality, window.devicePixelRatio)}
        camera={{ position: [MIDDLE, 95, MIDDLE + 125], fov: CAMERA_FOV, near: 1, far: 2000 }}
      >
        <FrameDriver watching={watching} />
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
        {/* Their own boundaries, so a model that is still loading never hides the island. */}
        <Suspense fallback={null}>
          <PlacementGhost />
        </Suspense>
        <Suspense fallback={null}>{island !== null && <Nature island={island} />}</Suspense>
        <Suspense fallback={null}>{plan !== null && <People plan={plan} />}</Suspense>
        <Suspense fallback={null}>{plan?.ferry != null && <Ferry schedule={plan.ferry} />}</Suspense>
      </Canvas>
    </div>
  );
}
