import { useGameState } from '../session/game.tsx';
import './CalmStates.css';

export const RESTING_LINE = 'This island is resting, back soon';

/**
 * A small calm line over the island while it cannot be played: the world is paused or catching up, or the connection
 * dropped and is coming back by itself. The island stays on screen under it. Never an error wall, never a button.
 */
export function CalmStatus() {
  const resting = useGameState((state) => state.island !== null && state.island.status !== 'running');
  const reconnecting = useGameState((state) => state.session.reconnecting);
  if (!resting && !reconnecting) return null;
  return (
    <div className="calm-status" role="status">
      <span className="calm-dot" aria-hidden="true" />
      {resting ? RESTING_LINE : 'Reconnecting...'}
    </div>
  );
}
