import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameProvider, type Game } from '../session/game.tsx';
import { stubGame } from '../test/game.ts';
import { ev, islandWithNews, portMasterName, SAMPLE_DATA } from '../test/news.ts';
import { expectNoEmoji } from '../test/no-emoji.ts';
import { CELEBRATION_MS, StageCelebration } from './StageCelebration.tsx';

afterEach(() => {
  vi.useRealTimers();
});

function show(news: Parameters<typeof islandWithNews>[0] = []) {
  const game = stubGame('playing');
  game.store.getState().receive(islandWithNews(news));
  const view = render(
    <GameProvider game={game}>
      <StageCelebration />
    </GameProvider>,
  );
  return { game, ...view };
}

function happen(game: Game, ...events: ReturnType<typeof ev>[]) {
  act(() =>
    game.store.getState().receive({ type: 'update', world: 'w-test', tick: 60, source: 0, changed: [], removed: [], events }),
  );
}

describe('the stage celebration', () => {
  it('is quiet until a stage is reached', () => {
    const { container, game } = show();
    expect(container).toBeEmptyDOMElement();
    happen(game, ev('construction-finished', SAMPLE_DATA['construction-finished'], 60));
    expect(container).toBeEmptyDOMElement();
  });

  it('pops the new stage name with a line from the port master when Settlement is reached', () => {
    const { game } = show();
    happen(game, ev('stage-reached', SAMPLE_DATA['stage-reached'], 60));
    const celebration = screen.getByRole('status');
    expect(celebration).toHaveTextContent('Settlement');
    expect(celebration).toHaveTextContent(`${portMasterName()}: Welcome to the Settlement stage. Look how far we have come.`);
    expectNoEmoji(celebration);
  });

  it('does not block play: it takes no touches and no buttons, and goes by itself', () => {
    vi.useFakeTimers();
    const { game } = show();
    happen(game, ev('stage-reached', SAMPLE_DATA['stage-reached'], 60));
    expect(screen.getByRole('status').querySelector('button, a, input')).toBeNull();
    act(() => vi.advanceTimersByTime(CELEBRATION_MS - 100));
    expect(screen.getByRole('status')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('does not celebrate the same moment twice, nor one that was already in the news on arrival', () => {
    vi.useFakeTimers();
    const { game, container } = show([ev('stage-reached', SAMPLE_DATA['stage-reached'], 3)]);
    expect(container).toBeEmptyDOMElement();
    const reached = ev('stage-reached', SAMPLE_DATA['stage-reached'], 60);
    happen(game, reached);
    act(() => vi.advanceTimersByTime(CELEBRATION_MS + 100));
    expect(container).toBeEmptyDOMElement();
    // The same events again (a later update still lists them) do not start it over.
    happen(game, reached);
    expect(container).toBeEmptyDOMElement();
  });
});
