import { content } from '@island/content';
import { buildingDefOf, footprintSize, type IslandState } from '@island/sim';
import { useMemo } from 'react';
import { natureInstances, type ClearedArea } from '../render/nature.ts';
import { useGameState } from '../session/game.tsx';
import { ModelInstances } from './ModelInstances.tsx';

/** Trees, bushes, rocks and palms (`render/nature.ts`), one instanced mesh per prop model, cleared under the ghost. */
export function Nature({ island }: { island: IslandState }) {
  const draft = useGameState((state) => state.view.placement);
  const ghost = draft?.kind === 'building' ? draft : null;
  const cleared = useMemo((): ClearedArea | null => {
    if (ghost === null) return null;
    const { w, h } = footprintSize(buildingDefOf(content, ghost.building), ghost.rotation);
    return { x: ghost.x, y: ghost.y, w, h };
  }, [ghost?.building, ghost?.x, ghost?.y, ghost?.rotation]);
  const props = useMemo(() => [...natureInstances(island, content, cleared)], [island, cleared]);
  return (
    <>
      {props.map(([file, list]) => (
        <ModelInstances key={file} file={file} instances={list} />
      ))}
    </>
  );
}
