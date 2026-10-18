import { content } from '@island/content';
import type { IslandState } from '@island/sim';
import { useMemo } from 'react';
import { buildingInstances } from '../render/instances.ts';
import { ModelInstances } from './ModelInstances.tsx';

/** Every finished building, one instanced mesh per model type. */
export function Buildings({ island }: { island: IslandState }) {
  const instances = useMemo(() => [...buildingInstances(island, content)], [island]);
  return (
    <>
      {instances.map(([file, list]) => (
        <ModelInstances key={file} file={file} instances={list} />
      ))}
    </>
  );
}
