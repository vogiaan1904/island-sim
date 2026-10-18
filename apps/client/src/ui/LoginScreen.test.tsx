import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoEmoji } from '../test/no-emoji.ts';
import { LoginScreen } from './LoginScreen.tsx';

describe('the log-in screen', () => {
  it('logs in with the username and password the player types', async () => {
    const onLogIn = vi.fn(async () => null);
    render(<LoginScreen onLogIn={onLogIn} onSignUp={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Username'), 'Lena');
    await userEvent.type(screen.getByLabelText('Password'), 'sea-breeze-1');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(onLogIn).toHaveBeenCalledWith('Lena', 'sea-breeze-1');
  });

  it('says kindly and specifically why a log-in was refused, and lets the player try again', async () => {
    const onLogIn = vi.fn(async () => 'bad-credentials' as const);
    const { container } = render(<LoginScreen onLogIn={onLogIn} onSignUp={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Username'), 'lena');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-one');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("That username and password don't match. Check them and try again.");
    expect(screen.getByRole('button', { name: 'Log in' })).toBeEnabled();
    expectNoEmoji(container);
  });

  it('tells the player when the island cannot be reached or there were too many tries', async () => {
    const onLogIn = vi.fn<(u: string, p: string) => Promise<'unreachable' | 'too-many-attempts'>>();
    onLogIn.mockResolvedValueOnce('unreachable').mockResolvedValueOnce('too-many-attempts');
    render(<LoginScreen onLogIn={onLogIn} onSignUp={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Username'), 'lena');
    await userEvent.type(screen.getByLabelText('Password'), 'password-1');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("The island can't be reached right now. Check your connection and try again.");
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Too many tries for now. Wait a few minutes, then try again.')).toBeInTheDocument();
  });

  it('offers sign-up to a player with a friend\'s invite code', async () => {
    const onSignUp = vi.fn();
    render(<LoginScreen onLogIn={vi.fn(async () => null)} onSignUp={onSignUp} />);
    await userEvent.click(screen.getByRole('button', { name: 'I have an invite code' }));
    expect(onSignUp).toHaveBeenCalled();
  });

  it('waits for the server while logging in, without a second tap sending twice', async () => {
    let finish: (value: null) => void = () => {};
    const onLogIn = vi.fn(() => new Promise<null>((resolve) => (finish = resolve)));
    render(<LoginScreen onLogIn={onLogIn} onSignUp={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Username'), 'lena');
    await userEvent.type(screen.getByLabelText('Password'), 'password-1');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(screen.getByRole('button', { name: 'Logging in' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Logging in' }));
    expect(onLogIn).toHaveBeenCalledTimes(1);
    finish(null);
  });
});
