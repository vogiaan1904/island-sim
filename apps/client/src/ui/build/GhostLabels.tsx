import { content } from '@island/content';
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { cameraPose } from '../../camera/controller.ts';
import { ISLAND_LIMITS } from '../../camera/limits.ts';
import { getLivePose } from '../../camera/livePose.ts';
import { ghostAnchor, projectPoint } from '../../render/anchors.ts';
import { useGame, useGameState } from '../../session/game.tsx';
import { Icon } from '../icons.tsx';
import { usePlacementVerdict } from './usePlacementVerdict.ts';
import './Build.css';

/**
 * The verdict's words on the ghost itself (spec story 33), just above it and following it as the camera moves: the
 * same labels the placement panel lists, so the player sees why a spot fails where they are looking. Positioned every
 * frame straight on the element, like the bubbles, so a moving camera never re-renders React. Not shown on a friend's
 * island, nor once the building is on its way down. The panel keeps its own list, which is what a screen reader reads.
 */
export function GhostLabels() {
  const { store } = useGame();
  const draft = useGameState((state) => state.view.placement);
  const island = useGameState((state) => state.island);
  const verdict = usePlacementVerdict(draft, island);
  const layer = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLUListElement>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const place = useCallback(() => {
    const element = label.current;
    const box = layer.current;
    const current = draftRef.current;
    if (element === null || box === null || current === null) return;
    const anchor = ghostAnchor(current, content);
    if (anchor === null) {
      element.style.visibility = 'hidden';
      return;
    }
    const pose = getLivePose() ?? cameraPose(store.getState().view.camera, ISLAND_LIMITS);
    const rect = box.getBoundingClientRect();
    const point = projectPoint(pose, { width: rect.width || window.innerWidth, height: rect.height || window.innerHeight }, anchor);
    element.style.transform = `translate(${point.x.toFixed(1)}px, ${point.y.toFixed(1)}px)`;
    element.style.visibility = point.visible ? 'visible' : 'hidden';
  }, [store]);

  useLayoutEffect(place, [place, draft, verdict]);
  useEffect(() => {
    let frame = requestAnimationFrame(function run() {
      place();
      frame = requestAnimationFrame(run);
    });
    return () => cancelAnimationFrame(frame);
  }, [place]);

  if (draft === null || verdict === null || island === null || !island.own || draft.phase === 'landing') return null;
  if (verdict.labels.length === 0 || ghostAnchor(draft, content) === null) return null;
  return (
    <div className="ghost-layer" ref={layer} aria-hidden="true">
      <ul className="ghost-labels" data-testid="ghost-labels" ref={label}>
        {verdict.labels.map((entry) => (
          <li key={entry.id} className="ghost-label" data-ok={entry.ok}>
            <Icon name={entry.ok ? 'check' : 'x'} size={12} strokeWidth={3} />
            {entry.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
