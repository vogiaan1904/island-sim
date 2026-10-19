import { content } from '@island/content';
import { findBuildingDef } from '@island/sim';
import { useEffect, useMemo } from 'react';
import { clearRoad, lostDraft, penTo, rotateDraft, sendingDraft, settleDraft, type PlacementDraft } from '../../placement/draft.ts';
import { roadVerdict } from '../../placement/roadVerdict.ts';
import { buildingVerdict, type PlacementVerdict } from '../../placement/verdict.ts';
import { useGame, useGameState } from '../../session/game.tsx';
import { Icon } from '../icons.tsx';
import { BUILDING_NAMES } from '../names.ts';
import { reasonWords } from '../reasonWords.ts';
import { BUILDING_BLURBS } from './blurbs.ts';
import './Build.css';
import { coinsText, needMoreText } from '../coins.ts';

/** How long the landing (bounce and dust) shows before the placement ends, in milliseconds. */
export const LANDING_MS = 900;

/**
 * The placement panel (island-ui, screens.md "Placing a building"): replaces the bottom bar while the player places a
 * building. It shows the building, its price, a sentence and its size, the sim's labels for the aimed spot, and Rotate,
 * Cancel and Place. Place sends the command and shows "Placing" until the server answers: ok starts the landing (the
 * 3D bounce and dust), a refusal returns to the ghost with the reason in words. All the game logic is the placement
 * module's; this only shows it.
 */
export function PlacementPanel() {
  const { store, session } = useGame();
  const draft = useGameState((state) => state.view.placement);
  const island = useGameState((state) => state.island);
  const answer = useGameState((state) => (state.view.placement?.requestId == null ? undefined : state.commands[state.view.placement.requestId]));
  const phase = draft?.phase ?? null;
  const set = (placement: PlacementDraft | null) => store.getState().setView({ placement });

  const verdict = useMemo(() => {
    if (draft === null || island === null) return null;
    return draft.kind === 'road' ? roadVerdict(island.state, content, draft.tiles) : buildingVerdict(island.state, content, draft);
  }, [island?.state, draft]);

  // The server's answer (or its loss) settles a command that is out.
  useEffect(() => {
    const current = store.getState().view.placement;
    if (current === null || current.phase !== 'placing') return;
    const next = answer === undefined ? lostDraft(current) : settleDraft(current, answer);
    if (next !== current) set(next);
  }, [answer, phase]);

  // After the landing has played, the placement is over.
  useEffect(() => {
    if (phase !== 'landing') return;
    const timer = setTimeout(() => set(null), LANDING_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  // Escape drops the ghost; leaving the island screen drops it too.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Escape' && store.getState().view.placement?.phase === 'aiming') set(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => () => store.getState().setView({ placement: null }), [store]);

  if (draft === null || verdict === null || island === null || !island.own || draft.phase === 'landing') return null;
  const name = draft.kind === 'road' ? 'Road' : BUILDING_NAMES[draft.building];
  const def = draft.kind === 'road' ? undefined : findBuildingDef(content, draft.building) ?? undefined;
  const placing = draft.phase === 'placing';

  const place = () => {
    if (verdict.command === null) return;
    const requestId = session.command(verdict.command);
    if (requestId === null) set({ ...draft, refusal: { reason: 'world-catching-up', shortfallCents: 0 } });
    else set(sendingDraft(draft, requestId));
  };

  return (
    <div className="placing" data-placement={draft.phase}>
      <p className="placing-hint">{draft.kind === 'road' ? (draft.pen === 'draw' ? 'Drag to draw a road' : 'Drag to move the view') : 'Drag to move'}</p>
      <section className="placing-card" role="region" aria-label={`Placing ${name}`}>
        <PlacementLabels verdict={verdict} />
        <div className="placing-body">
          <span className="build-picture">
            {draft.kind === 'road' ? (
              <Icon name="route" size={32} />
            ) : (
              <img src={`/icons/building_${draft.building}_a.png`} alt="" width={56} height={56} draggable={false} />
            )}
          </span>
          <div className="placing-text">
            <h2 className="placing-name">{name}</h2>
            <p className="placing-blurb">
              {draft.kind === 'road'
                ? roadWords(draft.tiles.length)
                : `${BUILDING_BLURBS[draft.building]}${def === undefined ? '' : ` Takes ${def.footprint.w} x ${def.footprint.h} tiles.`}`}
            </p>
          </div>
          <span className="build-cost">
            <Icon name="coin" size={18} />
            {coinsText(verdict.costCents)}
          </span>
        </div>
        {draft.refusal !== null && (
          <p className="placing-refusal" role="alert">
            {reasonWords(draft.refusal.reason, draft.refusal.shortfallCents)}
          </p>
        )}
        <div className="placing-controls">
          {draft.kind === 'road' ? (
            <>
              <button
                className="placing-round placing-pen"
                type="button"
                aria-label="Look around"
                aria-pressed={draft.pen === 'look'}
                disabled={placing}
                onClick={() => set(penTo(draft, draft.pen === 'look' ? 'draw' : 'look'))}
              >
                <Icon name="eye" size={24} />
              </button>
              <button className="placing-round" type="button" aria-label="Start over" disabled={placing || draft.tiles.length === 0} onClick={() => set(clearRoad(draft))}>
                <Icon name="undo" size={24} />
              </button>
            </>
          ) : (
            <button className="placing-round" type="button" aria-label="Rotate" disabled={placing} onClick={() => set(rotateDraft(draft, content))}>
              <Icon name="rotate" size={24} />
            </button>
          )}
          <button className="placing-round placing-cancel" type="button" aria-label="Cancel" disabled={placing} onClick={() => set(null)}>
            <Icon name="x" size={24} strokeWidth={3} />
          </button>
          <PlaceButton verdict={verdict} placing={placing} onPlace={place} />
        </div>
      </section>
    </div>
  );
}

/** What the road card says about the tiles dragged so far and the price of each. */
function roadWords(tiles: number): string {
  const price = coinsText(content.rules.roadPricePerTileCents);
  const each = `Each new tile costs ${price} coins.`;
  return tiles === 0 ? each : `${tiles} ${tiles === 1 ? 'tile' : 'tiles'}. ${each}`;
}

function PlacementLabels({ verdict }: { verdict: PlacementVerdict }) {
  if (verdict.labels.length === 0) return null;
  return (
    <ul className="placing-labels" aria-label="Checks">
      {verdict.labels.map((label) => (
        <li key={label.id} className="placing-label" data-ok={label.ok}>
          <Icon name={label.ok ? 'check' : 'x'} size={14} strokeWidth={3} />
          {label.text}
        </li>
      ))}
    </ul>
  );
}

function PlaceButton({ verdict, placing, onPlace }: { verdict: PlacementVerdict; placing: boolean; onPlace: () => void }) {
  const short = verdict.shortfallCents > 0;
  const text = placing ? 'Placing' : short ? needMoreText(verdict.shortfallCents) : 'Place';
  return (
    <button className="placing-place" type="button" disabled={placing || !verdict.ok} aria-busy={placing} onClick={onPlace}>
      {!placing && !short && <Icon name="check" size={22} strokeWidth={3} />}
      {text}
    </button>
  );
}
