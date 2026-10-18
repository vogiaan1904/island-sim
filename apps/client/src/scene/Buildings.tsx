import { content } from '@island/content';
import type { IslandState } from '@island/sim';
import { useGLTF } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import { islandInstances } from '../render/island.ts';
import { modelUrl, stageModels } from '../render/models.ts';
import { ModelInstances } from './ModelInstances.tsx';

/** Starts loading a stage's models; later stages come in the background so the Outpost island appears first. */
function preloadStage(stage: (typeof content.stages)[number]['id']): void {
  for (const file of stageModels(content, stage)) useGLTF.preload(modelUrl(file), false, true);
}

preloadStage('outpost');

/**
 * Everything drawn from models: finished buildings and sites rising in their scaffolds, road pieces and the pier, one
 * instanced mesh per model type.
 */
export function Buildings({ island }: { island: IslandState }) {
  const instances = useMemo(() => [...islandInstances(island, content)], [island]);
  useEffect(() => {
    // The rest of the stages load once the first island is up.
    const later = content.stages.filter((s) => s.id !== 'outpost').sort((a, b) => a.order - b.order);
    const timer = setTimeout(() => later.forEach((s) => preloadStage(s.id)), 2000);
    return () => clearTimeout(timer);
  }, []);
  return (
    <>
      {instances.map(([file, list]) => (
        <ModelInstances key={file} file={file} instances={list} />
      ))}
    </>
  );
}
