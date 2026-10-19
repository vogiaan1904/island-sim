import { content } from '@island/content';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { startDraft, type PlacementDraft } from '../../placement/draft.ts';
import { GameProvider, type Game } from '../../session/game.tsx';
import { stubGame } from '../../test/game.ts';
import { islandMessage } from '../../test/islands.ts';
import { expectNoEmoji } from '../../test/no-emoji.ts';
import { worldWithRoad } from '../../test/placement.ts';
import { GhostLabels } from './GhostLabels.tsx';

// The verdict's words float on the ghost itself (spec story 33), as well as in the placement panel.

function show(own = true) {
  const game = stubGame('playing');
  game.store.getState().receive({ ...islandMessage(worldWithRoad()), own });
  game.store.getState().cameraGesture({ kind: 'fly-to', x: 64, z: 64, distance: 90, instant: true });
  const view = render(
    <GameProvider game={game}>
      <GhostLabels />
    </GameProvider>,
  );
  return { game, ...view };
}

const cottageAt = (x: number, y: number) => ({ ...startDraft('cottage', { x: 0, y: 0 }, content), x, y });

const aim = (game: Game, draft: PlacementDraft | null) => act(() => game.store.getState().setView({ placement: draft }));

describe('the labels on the ghost', () => {
  it('shows nothing while nothing is being placed', () => {
    const { container } = show();
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the verdict words over a building that can go where it is aimed', () => {
    const { game, container } = show();
    aim(game, cottageAt(15, 25));
    expect(screen.getByTestId('ghost-labels')).toHaveTextContent('Road access');
    expectNoEmoji(container);
  });

  it('shows what is wrong where it is aimed wrong, in the words of the panel', () => {
    const { game } = show();
    aim(game, cottageAt(0, 0));
    expect(screen.getByTestId('ghost-labels')).toHaveTextContent('Needs dry land');
  });

  it('shows the road verdict over the last tile of a drag', () => {
    const { game } = show();
    aim(game, { kind: 'road', tiles: [{ x: 0, y: 0 }], cursor: null, pen: 'draw', phase: 'aiming', requestId: null, refusal: null });
    expect(screen.getByTestId('ghost-labels')).toHaveTextContent('Needs dry land');
  });

  it('is not there on a friend\'s island, nor while the building lands', () => {
    const visit = show(false);
    aim(visit.game, cottageAt(15, 25));
    expect(screen.queryByTestId('ghost-labels')).not.toBeInTheDocument();
    visit.unmount();
    const { game } = show();
    aim(game, { ...cottageAt(15, 25), phase: 'landing' as const });
    expect(screen.queryByTestId('ghost-labels')).not.toBeInTheDocument();
  });
});
