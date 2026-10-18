import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App.tsx';
import { expectNoEmoji } from './test/no-emoji.ts';
import { stubGame } from './test/game.ts';

describe('the app', () => {
  it('shows the calm loading screen while it checks who is signed in and while the island opens', () => {
    const game = stubGame('checking');
    render(<App game={game} />);
    expect(screen.getByRole('status')).toHaveTextContent('Getting your island ready');
    act(() => game.store.getState().setSession({ phase: 'opening' }));
    expect(screen.getByRole('status')).toHaveTextContent('Getting your island ready');
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
  });

  it('asks a signed-out player to log in, through the session', async () => {
    const game = stubGame('signed-out');
    render(<App game={game} />);
    await userEvent.type(screen.getByLabelText('Username'), 'alice');
    await userEvent.type(screen.getByLabelText('Password'), 'password-1');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(game.session.logIn).toHaveBeenCalledWith('alice', 'password-1');
  });

  it('skips the log-in for a signed-in player: the session goes straight to opening the island', () => {
    const game = stubGame('checking');
    render(<App game={game} />);
    act(() => game.store.getState().setSession({ phase: 'opening', account: { id: 'id-alice', username: 'alice' } }));
    expect(screen.queryByRole('button', { name: 'Log in' })).not.toBeInTheDocument();
  });

  it('tells a player with no island yet, in plain words', () => {
    const { container } = render(<App game={stubGame('worlds')} />);
    expect(screen.getByRole('heading', { name: 'No island yet' })).toBeInTheDocument();
    expectNoEmoji(container);
  });

  it('asks the player to reload when the server needs a newer game', () => {
    const { container } = render(<App game={stubGame('update-required')} />);
    expect(screen.getByText('A newer version of the game is ready.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expectNoEmoji(container);
  });
});
