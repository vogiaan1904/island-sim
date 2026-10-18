import { content } from '@island/content';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { GameProvider } from '../session/game.tsx';
import { stubGame } from '../test/game.ts';
import { ev, islandWithNews, portMasterName, SAMPLE_DATA } from '../test/news.ts';
import { expectNoEmoji } from '../test/no-emoji.ts';
import { eventPlace } from './words.ts';
import { NewsCard } from './NewsCard.tsx';

function show(news: Parameters<typeof islandWithNews>[0], own = true) {
  const game = stubGame('playing');
  game.store.getState().receive(islandWithNews(news, own));
  const view = render(
    <GameProvider game={game}>
      <NewsCard />
    </GameProvider>,
  );
  return { game, ...view };
}

/** One event of every kind, the least important first in time, so "newest first" cannot fake the ranking. */
const EVERYTHING = content.eventTypes.map((t, i) => ev(t.id, SAMPLE_DATA[t.id], i + 1));
/** The five the news should keep, most important first. */
const TOP_FIVE = [...content.eventTypes].sort((a, b) => b.importance - a.importance).slice(0, 5);

describe('the news card', () => {
  it('shows nothing when nothing happened while away, and nothing on a visit', () => {
    const empty = show([]);
    expect(empty.container).toBeEmptyDOMElement();
    empty.unmount();
    const visit = show([ev('stage-reached', SAMPLE_DATA['stage-reached'])], false);
    expect(visit.container).toBeEmptyDOMElement();
  });

  it('is the port master speaking: portrait, name and role, one sentence', () => {
    show([ev('mainland-help', SAMPLE_DATA['mainland-help'])]);
    const name = portMasterName();
    expect(screen.getByText(`${name} · Port master`)).toBeInTheDocument();
    expect(screen.getByRole('img', { name })).toHaveAttribute('src', `/icons/portrait_${name.toLowerCase()}_a.png`);
    expect(screen.getByText('The Mainland sent 100 coins to get us moving again.')).toBeInTheDocument();
  });

  it('tells the top five by importance, one at a time, and no more', async () => {
    const user = userEvent.setup();
    show(EVERYTHING);
    expect(content.eventTypes.length).toBeGreaterThan(5);
    expect(screen.getByText('1 / 5')).toBeInTheDocument();
    expect(screen.getByText('We reached the Settlement stage.')).toBeInTheDocument();
    expect(TOP_FIVE[0]?.id).toBe('stage-reached');
    for (let step = 2; step <= 5; step += 1) {
      await user.click(screen.getByRole('button', { name: 'Next' }));
      expect(screen.getByText(`${step} / 5`)).toBeInTheDocument();
    }
    // The fifth is the last: no Next, and the sixth kind was never told.
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    expect(screen.queryByText('We started building the farm.')).not.toBeInTheDocument();
  });

  it('flies the camera to the place of the item with Show me', async () => {
    const user = userEvent.setup();
    const { game } = show([ev('newcomers-arrived', SAMPLE_DATA['newcomers-arrived'])]);
    const island = game.store.getState().island?.state;
    if (island === undefined) throw new Error('no island');
    const expected = eventPlace(island, content, ev('newcomers-arrived', SAMPLE_DATA['newcomers-arrived']));
    await user.click(screen.getByRole('button', { name: 'Show me' }));
    const camera = game.store.getState().view.camera;
    expect(camera.x).toBeCloseTo(expected.x, 5);
    expect(camera.z).toBeCloseTo(expected.z, 5);
  });

  it('on Done marks the newest event of the news as seen and goes away', async () => {
    const user = userEvent.setup();
    const news = [ev('cargo-arrived', { units: 3 }, 5, 0), ev('stage-reached', SAMPLE_DATA['stage-reached'], 9, 2), ev('newcomers-arrived', { count: 2 }, 7, 1)];
    const { game, container } = show(news);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(game.session.markSeen).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(game.session.markSeen).toHaveBeenCalledExactlyOnceWith({ tick: 9, source: 0, index: 2 });
    expect(container).toBeEmptyDOMElement();
  });

  it('can be closed at once, which also marks the news as seen', async () => {
    const user = userEvent.setup();
    const { game, container } = show([ev('cargo-arrived', { units: 3 }, 5)]);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(game.session.markSeen).toHaveBeenCalledWith({ tick: 5, source: 0, index: 0 });
    expect(container).toBeEmptyDOMElement();
  });

  it('waits behind an open panel and comes back as it was', async () => {
    const user = userEvent.setup();
    const { game } = show(EVERYTHING);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    act(() => game.store.getState().setView({ openPanel: 'build' }));
    expect(screen.queryByText('2 / 5')).not.toBeInTheDocument();
    act(() => game.store.getState().setView({ openPanel: null }));
    expect(screen.getByText('2 / 5')).toBeInTheDocument();
  });

  it('starts over with the news of a new full state', () => {
    const { game } = show([ev('cargo-arrived', { units: 3 }, 5)]);
    act(() => game.store.getState().receive(islandWithNews([ev('mainland-help', SAMPLE_DATA['mainland-help'], 8)])));
    expect(screen.getByText('The Mainland sent 100 coins to get us moving again.')).toBeInTheDocument();
  });

  it('has no emoji in anything it shows', () => {
    const { container } = show(EVERYTHING);
    expectNoEmoji(container);
  });
});
