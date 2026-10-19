import { useGameState } from '../session/game.tsx';
import './CalmStates.css';

export const RESTING_LINE = 'This island is resting, back soon';
export const CATCHING_UP_LINE = 'The island is catching up, one moment';

/**
 * A small calm line over the island while it cannot be played: the world is resting (paused), catching up, or the
 * connection dropped and is coming back by itself. The island stays on screen under it. Never an error wall, never a button.
 */
export function CalmStatus() {
  const status = useGameState((state) => state.island?.status ?? 'running');
  const resting = status === 'paused';
  const catchingUp = status === 'catching-up';
  const reconnecting = useGameState((state) => state.session.reconnecting);
  if (!resting && !catchingUp && !reconnecting) return null;
  return (
    <div className="calm-status" role="status">
      <span className="calm-dot" aria-hidden="true" />
      {resting ? RESTING_LINE : catchingUp ? CATCHING_UP_LINE : 'Reconnecting...'}
    </div>
  );
}
