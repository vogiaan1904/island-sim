import { useMemo } from 'react';
import { useGame, useGameState } from '../session/game.tsx';
import { Icon } from '../ui/icons.tsx';
import { EventPictureView } from './EventPicture.tsx';
import { showMe } from './showMe.ts';
import { eventWords } from './words.ts';
import './news.css';

/** The Log keeps this many of the newest items. */
export const LOG_LIMIT = 100;

/**
 * The Log (island-ui, screens.md section 9): everything the island told the player, newest first, each item a picture,
 * one sentence and Show me. It holds what the full state brought as news (which stays here after the port master is
 * done) and the events that came live since. Friendly items, never a table.
 */
export function LogPanel() {
  const { store } = useGame();
  const news = useGameState((state) => state.island?.news);
  const live = useGameState((state) => state.island?.events);
  const items = useMemo(() => {
    // Oldest first as they arrived; the list shows the newest on top.
    return [...(news ?? []), ...(live ?? [])].slice(-LOG_LIMIT).reverse();
  }, [news, live]);
  if (items.length === 0) return <p className="log-empty">Nothing has happened yet.</p>;
  return (
    <ul className="log" aria-label="What has happened">
      {items.map((event) => (
        <li className="log-item" key={`${event.tick}/${event.source}/${event.index}/${event.type}`}>
          <span className="news-picture" aria-hidden="true">
            <EventPictureView event={event} />
          </span>
          <p className="log-text">{eventWords([event])}</p>
          <button className="news-button news-show" type="button" onClick={() => showMe(store, event)}>
            <Icon name="eye" size={20} />
            Show me
          </button>
        </li>
      ))}
    </ul>
  );
}
