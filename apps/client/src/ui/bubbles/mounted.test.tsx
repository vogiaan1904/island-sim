import type { GoalId } from '@island/content';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ISLAND_LIMITS } from '../../camera/limits.ts';
import { GameProvider } from '../../session/game.tsx';
import { stubGame } from '../../test/game.ts';
import { aliceWorld, islandMessage, islandOf } from '../../test/islands.ts';
import { Hud } from '../hud/Hud.tsx';

describe('the bubbles in the HUD', () => {
  it('floats a reward over the island, and the coins land on the HUD\'s own coin counter', async () => {
    const world = aliceWorld();
    islandOf(world).rewards = ['first-residents'] as GoalId[];
    const game = stubGame('playing');
    game.store.getState().receive(islandMessage(world));
    game.store.getState().cameraGesture({ kind: 'fly-to', x: 128, z: 214, distance: ISLAND_LIMITS.startDistance, instant: true });
    vi.mocked(game.session.command).mockImplementation((command) => {
      game.store.getState().commandSent(3, command);
      return 3;
    });
    const { container } = render(
      <GameProvider game={game}>
        <Hud />
      </GameProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Collect 200 coins' }));
    act(() => game.store.getState().receive({ type: 'result', requestId: 3, ok: true, data: { rewardCents: 20000 } }));
    expect(container.ownerDocument.querySelectorAll('[data-coin-flight]').length).toBeGreaterThan(0);
    expect(screen.getByRole('group', { name: /^Coins/ })).toHaveAttribute('data-counter', 'coins');
  });

  it('shows no bubbles while the HUD has no island', () => {
    const game = stubGame('opening');
    const { container } = render(
      <GameProvider game={game}>
        <Hud />
      </GameProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
