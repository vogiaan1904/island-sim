import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GameProvider } from '../../session/game.tsx';
import { stubGame } from '../../test/game.ts';
import { aliceWorld, islandMessage } from '../../test/islands.ts';
import { PanelHost } from '../PanelHost.tsx';
import { PANEL_BODIES } from '../panels.ts';

describe('the Staff and Trade buttons', () => {
  it('open the panels this ticket fills, through the panel host', () => {
    const game = stubGame('playing');
    game.store.getState().receive(islandMessage(aliceWorld()));
    render(
      <GameProvider game={game}>
        <PanelHost bodies={PANEL_BODIES} />
      </GameProvider>,
    );
    act(() => game.store.getState().togglePanel('staff'));
    expect(screen.getByRole('region', { name: 'Staff' })).toBeInTheDocument();
    expect(screen.getByText('Mainland commuters')).toBeInTheDocument();
    act(() => game.store.getState().togglePanel('trade'));
    expect(screen.getByRole('region', { name: 'Trade' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Fish' })).toBeInTheDocument();
  });
});
