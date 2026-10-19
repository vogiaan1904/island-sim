import { useEffect, useRef, useState } from 'react';
import { useGameState } from '../session/game.tsx';
import { Icon } from '../ui/icons.tsx';
import { STAGE_NAMES } from '../ui/names.ts';
import { portMasterOf } from './portMaster.ts';
import './news.css';

/** How long the celebration stays: the badge pops, a few sparks fly, and the line fades out (matches `celebrate-in` in news.css). */
export const CELEBRATION_MS = 5600;

const keyOf = (e: { tick: number; source: number; index: number }) => `${e.tick}/${e.source}/${e.index}`;

/**
 * Reaching a new stage (island-ui, screens.md section 10): the badge pops with the stage name, a short sparkle, a line from
 * the port master. It is only a picture over the island: no buttons, no touches, gone in a few seconds. It tells a stage
 * reached live, not one that was already in the news on arrival (the port master tells that one).
 */
export function StageCelebration() {
  const island = useGameState((state) => state.island);
  const [shown, setShown] = useState<{ stage: string } | null>(null);
  const celebrated = useRef<Set<string> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (celebrated.current === null) {
    const already = [...(island?.news ?? []), ...(island?.events ?? [])].filter((e) => e.type === 'stage-reached');
    celebrated.current = new Set(already.map(keyOf));
  }

  const events = island?.events;
  useEffect(() => {
    const seen = celebrated.current;
    if (seen === null || events === undefined) return;
    for (const event of events) {
      if (event.type !== 'stage-reached' || seen.has(keyOf(event))) continue;
      seen.add(keyOf(event));
      const stage = String(event.data['stage']);
      setShown({ stage: Object.hasOwn(STAGE_NAMES, stage) ? STAGE_NAMES[stage as keyof typeof STAGE_NAMES] : 'next' });
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(() => setShown(null), CELEBRATION_MS);
    }
  }, [events]);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  // A friend's stage is theirs to celebrate: a visitor sees no port master and no badge pop.
  if (island === null || !island.own || shown === null) return null;
  const speaker = portMasterOf(island.state);
  return (
    <div className="celebrate" role="status">
      <div className="celebrate-badge" aria-hidden="true">
        <Icon name="palm" size={40} />
        <span className="celebrate-sparks">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
            <i key={n} style={{ '--n': n } as React.CSSProperties} />
          ))}
        </span>
      </div>
      <span className="celebrate-stage">{shown.stage}</span>
      <p className="celebrate-line">{`${speaker.name}: Welcome to the ${shown.stage} stage. Look how far we have come.`}</p>
    </div>
  );
}
