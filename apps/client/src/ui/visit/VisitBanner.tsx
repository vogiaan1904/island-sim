import { useGame, useGameState } from '../../session/game.tsx';
import { Icon } from '../icons.tsx';
import './Visit.css';

/**
 * Shown only while visiting a friend (island-ui, screens.md section 10): whose island this is and its name, and the way
 * home. It sits at the bottom, where the owner's buttons would be, so the top of the island stays clear for the HUD.
 */
export function VisitBanner() {
  const { session } = useGame();
  const island = useGameState((state) => state.island);
  if (island === null || island.own) return null;
  const entry = island.summary.islands.find((summary) => summary.slot === island.slot);
  const name = entry?.name ?? island.state.name ?? "a friend's island";
  return (
    <div className="visit-banner" role="status">
      <div className="visit-text">
        <span className="visit-label">Visiting</span>
        <strong className="visit-name">{name}</strong>
        {entry !== undefined && <span className="visit-owner">{`${entry.owner}'s island`}</span>}
      </div>
      <button className="visit-home" type="button" onClick={() => session.home()}>
        <Icon name="home" size={22} />
        Home
      </button>
    </div>
  );
}
