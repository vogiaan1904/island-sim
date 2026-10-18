import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ClientApiReason } from '../connection/api.ts';
import { expectNoEmoji } from '../test/no-emoji.ts';
import { SignUpScreen } from './SignUpScreen.tsx';

async function fill(values: { username?: string; password?: string; code?: string; island?: string } = {}) {
  await userEvent.type(screen.getByLabelText('Username'), values.username ?? 'Lena');
  await userEvent.type(screen.getByLabelText('Password'), values.password ?? 'sea-breeze-1');
  await userEvent.type(screen.getByLabelText('Invite code'), values.code ?? 'ABCDE-FGHIJ');
  await userEvent.type(screen.getByLabelText('Island name'), values.island ?? 'Sunny Bay');
}

describe('the sign-up screen', () => {
  it('shows the username and island name rules next to the fields before anything is typed', () => {
    const { container } = render(<SignUpScreen onSignUp={vi.fn(async () => null)} onBack={vi.fn()} />);
    expect(screen.getByLabelText('Username')).toHaveAccessibleDescription(/Letters, digits, - and _ only/);
    expect(screen.getByLabelText('Username')).toHaveAccessibleDescription(/Lena and lena are the same name/);
    expect(screen.getByLabelText('Island name')).toHaveAccessibleDescription(/2 to 24 characters/);
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(/At least 8 characters/);
    expectNoEmoji(container);
  });

  it('signs up with the username, password, invite code and island name the player typed', async () => {
    const onSignUp = vi.fn(async () => null);
    render(<SignUpScreen onSignUp={onSignUp} onBack={vi.fn()} />);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Sign up' }));
    expect(onSignUp).toHaveBeenCalledWith({ username: 'Lena', password: 'sea-breeze-1', inviteCode: 'ABCDE-FGHIJ', islandName: 'Sunny Bay' });
  });

  it('points at the field that is wrong before asking the server, and sends nothing', async () => {
    const onSignUp = vi.fn(async () => null);
    const { container } = render(<SignUpScreen onSignUp={onSignUp} onBack={vi.fn()} />);
    await fill({ username: 'le na', password: 'short', code: 'ABC', island: 'A' });
    await userEvent.click(screen.getByRole('button', { name: 'Sign up' }));
    expect(onSignUp).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Username')).toHaveAccessibleDescription(/Use letters, digits, - and _ only, with no spaces/);
    expect(screen.getByLabelText('Username')).toBeInvalid();
    expect(screen.getByLabelText('Password')).toBeInvalid();
    expect(screen.getByLabelText('Invite code')).toHaveAccessibleDescription(/An invite code has 10 letters and digits/);
    expect(screen.getByLabelText('Island name')).toHaveAccessibleDescription(/An island name has 2 to 24 characters/);
    expectNoEmoji(container);
  });

  it.each<[ClientApiReason, string]>([
    ['bad-invite-code', "That invite code doesn't work. Check it with your friend."],
    ['world-full', 'This world is full'],
    ['world-resting', 'This world is resting, try again soon'],
    ['username-taken', 'Someone already uses that username. Try another one.'],
    ['bad-island-name', "That island name doesn't work"],
    ['bad-request', "Something in the form doesn't look right"],
    ['too-many-attempts', 'Too many tries for now'],
    ['unreachable', "The island can't be reached right now"],
  ])('says kindly and specifically why the server refused: %s', async (reason, line) => {
    const onSignUp = vi.fn(async () => reason);
    const { container } = render(<SignUpScreen onSignUp={onSignUp} onBack={vi.fn()} />);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Sign up' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(line);
    expect(screen.getByRole('button', { name: 'Sign up' })).toBeEnabled();
    expect(screen.getByLabelText('Username')).toHaveValue('Lena');
    expectNoEmoji(container);
  });

  it('waits for the server without sending twice', async () => {
    let finish: (value: null) => void = () => {};
    const onSignUp = vi.fn(() => new Promise<null>((resolve) => (finish = resolve)));
    render(<SignUpScreen onSignUp={onSignUp} onBack={vi.fn()} />);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Sign up' }));
    expect(screen.getByRole('button', { name: 'Signing up' })).toBeDisabled();
    expect(onSignUp).toHaveBeenCalledTimes(1);
    finish(null);
  });

  it('goes back to the log-in screen', async () => {
    const onBack = vi.fn();
    render(<SignUpScreen onSignUp={vi.fn(async () => null)} onBack={onBack} />);
    await userEvent.click(screen.getByRole('button', { name: 'I already have an account' }));
    expect(onBack).toHaveBeenCalled();
  });
});
