import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { GameProvider } from '../session/game.tsx';
import { stubGame } from '../test/game.ts';
import { ev, islandWithNews, SAMPLE_DATA } from '../test/news.ts';
import { Hud } from '../ui/hud/Hud.tsx';

function play(news: Parameters<typeof islandWithNews>[0]) {
  const game = stubGame('playing');
  game.store.getState().receive(islandWithNews(news));
  render(
    <GameProvider game={game}>
      <Hud />
    </GameProvider>,
  );
  return game;
}

describe('the news in the HUD', () => {
  it('tells the news on return, and the Log keeps it after Done', async () => {
    const user = userEvent.setup();
    const game = play([ev('mainland-help', SAMPLE_DATA['mainland-help'], 4)]);
    expect(screen.getByRole('region', { name: 'While you were away' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(game.session.markSeen).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('region', { name: 'While you were away' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Log' }));
    expect(screen.getByRole('region', { name: 'Log' })).toHaveTextContent('The Mainland sent 100 coins to get us moving again.');
  });

  it('celebrates reaching Settlement over the island', () => {
    const game = play([]);
    act(() =>
      game.store.getState().receive({
        type: 'update',
        world: 'w-test',
        tick: 70,
        source: 0,
        changed: [],
        removed: [],
        events: [ev('stage-reached', SAMPLE_DATA['stage-reached'], 70)],
      }),
    );
    expect(screen.getByRole('status')).toHaveTextContent('Settlement');
  });
});
