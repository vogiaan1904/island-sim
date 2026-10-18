import { useMemo } from 'react';
import { Color, Object3D } from 'three';
import { LOOK, sunDirection } from '../render/look.ts';

/** The one sun from the look's values, aimed at the island's middle, and a sky fill. No other lights (rule 8). */
export function Sun({ middle }: { middle: number }) {
  const target = useMemo(() => {
    const object = new Object3D();
    object.position.set(middle, 0, middle);
    return object;
  }, [middle]);
  const [x, y, z] = sunDirection(LOOK.sun);
  return (
    <>
      <primitive object={target} />
      <directionalLight
        color={new Color().setRGB(...LOOK.sun.color)}
        intensity={LOOK.sun.energy}
        position={[middle + x * 200, y * 200, middle + z * 200]}
        target={target}
      />
      <ambientLight color={new Color().setRGB(...LOOK.sky)} intensity={1} />
    </>
  );
}
