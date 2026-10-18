import { content } from '@island/content';
import type { IslandState, SimEvent } from '@island/sim';
import { useMemo, useState } from 'react';
import { useGame, useGameState } from '../session/game.tsx';
import { Icon } from '../ui/icons.tsx';
import { EventPictureView } from './EventPicture.tsx';
import { newestKey, pickNews } from './pick.ts';
import { portMasterOf } from './portMaster.ts';
import { showMe } from './showMe.ts';
import { eventWords } from './words.ts';
import './news.css';

/**
 * "While you were away" (island-ui, screens.md section 4): the port master above the bottom bar tells the most important
 * kinds of event since the last visit, grouped, at most five, one at a time. Show me flies to the place; Next goes on;
 * Done (or Close) tells the server the news was seen and the card goes away. It waits behind an open panel, and a new
 * full state (a reconnect) starts it over with the news that is still unseen.
 */
export function NewsCard() {
  const island = useGameState((state) => state.island);
  const panelOpen = useGameState((state) => state.view.openPanel !== null);
  if (island === null || !island.own || island.news.length === 0) return null;
  return <Card news={island.news} island={island.state} hidden={panelOpen} />;
}

interface Progress {
  /** The news this progress belongs to: a new full state brings new news and starts over. */
  news: readonly SimEvent[];
  index: number;
  done: boolean;
}

function Card({ news, island, hidden }: { news: readonly SimEvent[]; island: IslandState; hidden: boolean }) {
  const { store, session } = useGame();
  const items = useMemo(() => pickNews(news, content), [news]);
  const [stored, setProgress] = useState<Progress>({ news, index: 0, done: false });
  const progress = stored.news === news ? stored : { news, index: 0, done: false };
  const { index } = progress;
  const item = items[Math.min(index, items.length - 1)];
  const latest = item?.events[item.events.length - 1];
  if (progress.done || hidden || item === undefined || latest === undefined) return null;
  const last = index >= items.length - 1;
  const speaker = portMasterOf(island);

  const finish = () => {
    const key = newestKey(news);
    if (key !== null) session.markSeen(key);
    setProgress({ ...progress, done: true });
  };

  return (
    <section className="news" role="region" aria-label="While you were away">
      <div className="news-who">
        {speaker.portrait === null ? (
          <span className="news-portrait news-portrait-none">
            <EventPictureView event={{ ...latest, type: 'island-claimed' }} size={44} />
          </span>
        ) : (
          <img className="news-portrait" src={speaker.portrait} alt={speaker.name} width={56} height={56} draggable={false} />
        )}
        <span className="news-name">{`${speaker.name} · ${speaker.role}`}</span>
        <button className="news-close" type="button" aria-label="Close" onClick={finish}>
          <Icon name="x" size={18} strokeWidth={3} />
        </button>
      </div>
      <div className="news-say" key={item.type}>
        <span className="news-picture" aria-hidden="true">
          <EventPictureView event={latest} />
        </span>
        <p className="news-text">{eventWords(item.events)}</p>
      </div>
      <div className="news-actions">
        <button className="news-button news-show" type="button" onClick={() => showMe(store, latest)}>
          <Icon name="eye" size={20} />
          Show me
        </button>
        <span className="news-count" aria-label={`Item ${index + 1} of ${items.length}`}>{`${index + 1} / ${items.length}`}</span>
        {last ? (
          <button className="news-button" type="button" onClick={finish}>
            <Icon name="check" size={20} strokeWidth={3} />
            Done
          </button>
        ) : (
          <button className="news-button" type="button" onClick={() => setProgress({ ...progress, index: index + 1 })}>
            Next
            <Icon name="arrow" size={20} />
          </button>
        )}
      </div>
    </section>
  );
}
