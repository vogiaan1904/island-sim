import { content } from '@island/content';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { GameProvider, type Game } from '../session/game.tsx';
import { stubGame } from '../test/game.ts';
import { aliceWorld, islandMessage } from '../test/islands.ts';
import { ev, islandWithNews, SAMPLE_DATA } from '../test/news.ts';
import { expectNoEmoji } from '../test/no-emoji.ts';
import { PanelHost } from '../ui/PanelHost.tsx';
import { PANEL_BODIES } from '../ui/panels.ts';
import { LogPanel } from './LogPanel.tsx';
import { eventPlace } from './words.ts';

function show(news: Parameters<typeof islandWithNews>[0] = []) {
  const game = stubGame('playing');
  game.store.getState().receive(islandWithNews(news));
  const view = render(
    <GameProvider game={game}>
      <LogPanel />
    </GameProvider>,
  );
  return { game, ...view };
}

/** The live updates after the full state: what the island does while the player watches. */
function happen(game: Game, ...events: ReturnType<typeof ev>[]) {
  act(() =>
    game.store.getState().receive({ type: 'update', world: 'w-test', tick: 50, source: 0, changed: [], removed: [], events }),
  );
}

describe('the Log', () => {
  it('says so kindly when nothing has happened yet', () => {
    show();
    expect(screen.getByText('Nothing has happened yet.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('keeps every item of the news and every live event, newest first, one sentence each', () => {
    const { game } = show([ev('cargo-arrived', { units: 4 }, 3), ev('newcomers-arrived', { count: 6 }, 5)]);
    happen(game, ev('mainland-help', SAMPLE_DATA['mainland-help'], 20), ev('construction-finished', SAMPLE_DATA['construction-finished'], 22));
    const items = screen.getAllByRole('listitem');
    expect(items.map((item) => item.querySelector('.log-text')?.textContent)).toEqual([
      'The farm is finished.',
      'The Mainland sent 100 coins to get us moving again.',
      '6 newcomers arrived on the ferry.',
      'The ferry unloaded 4 goods.',
    ]);
  });

  it('keeps the news in the Log after the port master is done', () => {
    // The mirror keeps the full state's news; marking it seen only changes what the next visit brings.
    const { game } = show([ev('stage-reached', SAMPLE_DATA['stage-reached'], 3)]);
    expect(game.store.getState().island?.news).toHaveLength(1);
    expect(screen.getByText('We reached the Settlement stage.')).toBeInTheDocument();
  });

  it('has a picture and a Show me on every item', () => {
    show([ev('construction-finished', SAMPLE_DATA['construction-finished'], 3), ev('newcomers-arrived', { count: 2 }, 4)]);
    const [newcomers, farm] = screen.getAllByRole('listitem');
    expect(newcomers && within(newcomers).getByRole('button', { name: 'Show me' })).toBeInTheDocument();
    expect(farm && within(farm).getByRole('button', { name: 'Show me' })).toBeInTheDocument();
    expect(farm?.querySelector('img')).toHaveAttribute('src', '/icons/building_farm_a.png');
    expect(newcomers?.querySelector('svg')).not.toBeNull();
  });

  it('flies to the place of the item with its Show me', async () => {
    const user = userEvent.setup();
    const { game } = show([ev('newcomers-arrived', { count: 2 }, 4)]);
    const island = game.store.getState().island?.state;
    if (island === undefined) throw new Error('no island');
    const expected = eventPlace(island, content, ev('newcomers-arrived', { count: 2 }, 4));
    await user.click(screen.getByRole('button', { name: 'Show me' }));
    expect(game.store.getState().view.camera.x).toBeCloseTo(expected.x, 5);
    expect(game.store.getState().view.camera.z).toBeCloseTo(expected.z, 5);
  });

  it('is no table, chart or tabs, and has no emoji', () => {
    const { container } = show(content.eventTypes.map((t, i) => ev(t.id, SAMPLE_DATA[t.id], i + 1)));
    expect(container.querySelector('table, [role="tab"], [role="table"], canvas')).toBeNull();
    expectNoEmoji(container);
  });

  it('is the body of the Log panel', async () => {
    const user = userEvent.setup();
    const game = stubGame('playing');
    game.store.getState().receive(islandMessage(aliceWorld()));
    game.store.getState().togglePanel('log');
    render(
      <GameProvider game={game}>
        <PanelHost bodies={PANEL_BODIES} />
      </GameProvider>,
    );
    expect(screen.getByRole('region', { name: 'Log' })).toHaveTextContent('Nothing has happened yet.');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(game.store.getState().view.openPanel).toBeNull();
  });
});
