import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../App.tsx';
import { GameProvider } from '../session/game.tsx';
import { stubGame } from '../test/game.ts';
import { aliceWorld, islandMessage } from '../test/islands.ts';
import { expectNoEmoji } from '../test/no-emoji.ts';
import { CalmStatus } from './CalmStates.tsx';
import { supportsWebGL2 } from './webgl.ts';

function playingGame() {
  const game = stubGame('playing');
  game.store.getState().receive(islandMessage(aliceWorld()));
  return game;
}

function showStatus(game = playingGame()) {
  return { game, ...render(<GameProvider game={game}><CalmStatus /></GameProvider>) };
}

describe('the calm status over the island', () => {
  it('shows nothing while all is well', () => {
    const { container } = showStatus();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a small reconnecting line, never an error, and nothing again once it works', () => {
    const { game, container } = showStatus();
    act(() => game.store.getState().setSession({ reconnecting: true }));
    expect(screen.getByRole('status')).toHaveTextContent('Reconnecting...');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expectNoEmoji(container);
    act(() => game.store.getState().setSession({ reconnecting: false }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('says the island is resting, with exactly that line, while its world is paused', () => {
    const { game, container } = showStatus();
    act(() => game.store.getState().receive({ type: 'status', world: 'w-test', status: 'paused' }));
    expect(screen.getByRole('status')).toHaveTextContent(/^This island is resting, back soon$/);
    expectNoEmoji(container);
    act(() => game.store.getState().receive({ type: 'status', world: 'w-test', status: 'running' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('says the island is catching up, not resting, while its world catches up, and nothing once it runs', () => {
    const { game, container } = showStatus();
    act(() => game.store.getState().receive({ type: 'status', world: 'w-test', status: 'catching-up' }));
    expect(screen.getByRole('status')).toHaveTextContent(/^The island is catching up, one moment$/);
    expect(screen.queryByText(/resting/)).not.toBeInTheDocument();
    expectNoEmoji(container);
    act(() => game.store.getState().receive({ type: 'status', world: 'w-test', status: 'running' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows the resting line before reconnecting when both apply, as one line', () => {
    const { game } = showStatus();
    act(() => {
      game.store.getState().receive({ type: 'status', world: 'w-test', status: 'paused' });
      game.store.getState().setSession({ reconnecting: true });
    });
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('This island is resting, back soon');
  });
});

describe('the screens of the calm states', () => {
  it('shows the resting line on a screen of its own for a world that could not be loaded', () => {
    const { container } = render(<App game={stubGame('resting')} />);
    expect(screen.getByRole('heading', { name: 'This island is resting, back soon' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expectNoEmoji(container);
  });

  it('asks the player to reload when an update is required, in one calm line with a button', () => {
    render(<App game={stubGame('update-required')} />);
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(screen.getByText('A newer version of the game is ready.')).toBeInTheDocument();
  });

  it('gives a device without WebGL2 one friendly sentence and no technical words', () => {
    const game = stubGame('checking');
    const { container } = render(<App game={game} webgl2={false} />);
    const line = screen.getByText(/can't show/i);
    expect(line.textContent).toBe("This device can't show the island yet. A newer phone or browser will.");
    expect(container.textContent).not.toMatch(/webgl|gpu|3d|graphics|error/i);
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    expectNoEmoji(container);
  });
});

describe('detecting WebGL2', () => {
  it('is true when a canvas gives a webgl2 context, false when it gives none or throws', () => {
    const canvasWith = (getContext: (type: string) => unknown) => () => ({ getContext }) as unknown as HTMLCanvasElement;
    expect(supportsWebGL2(canvasWith((type) => (type === 'webgl2' ? {} : null)))).toBe(true);
    expect(supportsWebGL2(canvasWith(() => null))).toBe(false);
    expect(
      supportsWebGL2(
        canvasWith(() => {
          throw new Error('blocked');
        }),
      ),
    ).toBe(false);
  });
});
