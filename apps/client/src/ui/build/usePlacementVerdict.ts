import { content } from '@island/content';
import { useMemo } from 'react';
import type { PlacementDraft } from '../../placement/draft.ts';
import { roadVerdict } from '../../placement/roadVerdict.ts';
import { buildingVerdict, type PlacementVerdict } from '../../placement/verdict.ts';
import type { IslandMirror } from '../../store/mirror.ts';

/** The sim's verdict for the draft on the mirrored island: one answer for the panel and for the labels on the ghost. */
export function usePlacementVerdict(draft: PlacementDraft | null, island: IslandMirror | null): PlacementVerdict | null {
  return useMemo(() => {
    if (draft === null || island === null) return null;
    return draft.kind === 'road' ? roadVerdict(island.state, content, draft.tiles) : buildingVerdict(island.state, content, draft);
  }, [island?.state, draft]);
}
