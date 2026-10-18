import { useGame, useGameState } from '../session/game.tsx';
import { Icon } from './icons.tsx';
import { PANEL_BODIES, PANEL_TITLES, type PanelBodies } from './panels.ts';
import './PanelHost.css';

/**
 * The open panel (`view.openPanel`): a card that comes up from the bottom on a narrow screen and sits on the right on a
 * wide one. It holds the panel's title, a Close button and the body registered for it in `panels.ts` (empty until the
 * ticket that fills it lands). One panel at a time: opening another replaces it.
 */
export function PanelHost({ bodies = PANEL_BODIES }: { bodies?: PanelBodies }) {
  const { store } = useGame();
  const open = useGameState((state) => state.view.openPanel);
  if (open === null) return null;
  const Body = bodies[open];
  const title = PANEL_TITLES[open];
  return (
    <section className="panel" role="region" aria-label={title} data-panel={open}>
      <header className="panel-head">
        <h2 className="panel-title">{title}</h2>
        <button className="panel-close" type="button" aria-label="Close" onClick={() => store.getState().setView({ openPanel: null })}>
          <Icon name="x" size={18} strokeWidth={3} />
        </button>
      </header>
      <div className="panel-body">{Body !== undefined && <Body />}</div>
    </section>
  );
}
