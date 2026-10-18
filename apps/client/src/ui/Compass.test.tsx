import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { GameProvider } from '../session/game.tsx';
import { stubGame } from '../test/game.ts';
import { expectNoEmoji } from '../test/no-emoji.ts';
import { Compass } from './Compass.tsx';

describe('the compass', () => {
  it('is a button named for what it does, with an icon and no emoji', () => {
    const game = stubGame();
    const { container } = render(
      <GameProvider game={game}>
        <Compass />
      </GameProvider>,
    );
    expect(screen.getByRole('button', { name: 'Face north' })).toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeNull();
    expectNoEmoji(container);
  });

  it('turns the view to face north when tapped, keeping zoom and tilt', async () => {
    const game = stubGame();
    game.store.getState().cameraGesture({ kind: 'twist', angle: 2 });
    const { distance, tilt } = game.store.getState().view.camera;
    render(
      <GameProvider game={game}>
        <Compass />
      </GameProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Face north' }));
    const camera = game.store.getState().view.camera;
    expect(camera.azimuth).toBeCloseTo(0);
    expect(camera.distance).toBe(distance);
    expect(camera.tilt).toBe(tilt);
  });

  it('shows where north is: the needle follows the turn of the view, without a re-render per camera move', () => {
    const game = stubGame();
    render(
      <GameProvider game={game}>
        <Compass />
      </GameProvider>,
    );
    const needle = screen.getByTestId('compass-needle');
    expect(needle.style.transform).toBe('rotate(0deg)');
    act(() => game.store.getState().cameraGesture({ kind: 'twist', angle: Math.PI / 2 }));
    // The camera went a quarter of the way round to the east, so north now lies to the right of the screen.
    expect(needle.style.transform).toBe('rotate(90deg)');
  });
});
