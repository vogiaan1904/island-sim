import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.tsx';
import { gameOn, ok, refused, signInOn, stubApi, world } from './test/api.ts';
import { aliceWorld, islandMessage } from './test/islands.ts';
import { expectNoEmoji } from './test/no-emoji.ts';
import type { Game } from './session/game.tsx';

// The sign-up and world flows end to end through the screens, the real session and store, over a stubbed API typed
// with the protocol's responses. The socket never answers: opening an island is shown by the "opening" phase.

// The 3D canvas needs WebGL, which jsdom does not have; these flows are about the screens around it.
vi.mock('./scene/IslandCanvas.tsx', () => ({ default: ({ onReady }: { onReady: () => void }) => { onReady(); return null; } }));

let running: Game | null = null;
afterEach(() => {
  running?.session.stop();
  running = null;
});

function start(api = stubApi()) {
  const made = gameOn(api);
  running = made.game;
  render(<App game={made.game} />);
  return { api, ...made };
}

describe('signing up', () => {
  it('goes from the log-in screen to sign-up and back', async () => {
    const { game } = start();
    await act(() => game.session.start());
    await userEvent.click(screen.getByRole('button', { name: 'I have an invite code' }));
    expect(screen.getByRole('heading', { name: "Join a friend's world" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'I already have an account' }));
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
  });

  it('signs up with an invite code and opens the island, sending what was typed', async () => {
    const { api, game, sockets } = start();
    await act(() => game.session.start());
    await userEvent.click(screen.getByRole('button', { name: 'I have an invite code' }));
    await userEvent.type(screen.getByLabelText('Username'), 'Cara');
    await userEvent.type(screen.getByLabelText('Password'), 'sea-breeze-1');
    await userEvent.type(screen.getByLabelText('Invite code'), 'abcde-fghij');
    await userEvent.type(screen.getByLabelText('Island name'), 'Sunny Bay');
    await userEvent.click(screen.getByRole('button', { name: 'Sign up' }));
    await waitFor(() => expect(game.store.getState().session.phase).toBe('opening'));
    expect(api.register).toHaveBeenCalledWith({ username: 'Cara', password: 'sea-breeze-1', inviteCode: 'abcde-fghij', islandName: 'Sunny Bay' });
    expect(game.store.getState().session.account?.username).toBe('Cara');
    expect(sockets).toHaveLength(1);
  });

  it.each([
    ['bad-invite-code', "That invite code doesn't work. Check it with your friend."],
    ['world-full', 'This world is full'],
    ['world-resting', 'This world is resting, try again soon'],
    ['username-taken', 'Someone already uses that username'],
    ['bad-island-name', "That island name doesn't work"],
  ] as const)('keeps the form and says why when the server answers %s', async (reason, line) => {
    const api = stubApi();
    api.register.mockResolvedValueOnce(refused(reason));
    const { game } = start(api);
    await act(() => game.session.start());
    await userEvent.click(screen.getByRole('button', { name: 'I have an invite code' }));
    await userEvent.type(screen.getByLabelText('Username'), 'Cara');
    await userEvent.type(screen.getByLabelText('Password'), 'sea-breeze-1');
    await userEvent.type(screen.getByLabelText('Invite code'), 'ABCDEFGHJK');
    await userEvent.type(screen.getByLabelText('Island name'), 'Sunny Bay');
    await userEvent.click(screen.getByRole('button', { name: 'Sign up' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(line);
    expect(game.store.getState().session.phase).toBe('signed-out');
    expect(screen.getByLabelText('Username')).toHaveValue('Cara');
  });
});

describe('worlds', () => {
  it('opens a single world straight away after logging in, and lists several to pick from', async () => {
    const api = stubApi();
    await signInOn(api, [world({ id: 'w1', islandName: 'Palm Cove' }), world({ id: 'w2', islandName: 'Coral Bay', creator: 'Omar', inviteCode: null })]);
    const { game, sockets } = start(api);
    await act(() => game.session.start());
    expect(screen.getByRole('heading', { name: 'Your worlds' })).toBeInTheDocument();
    expect(sockets).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'Open Coral Bay' }));
    expect(game.store.getState().session.phase).toBe('opening');
    expect(sockets).toHaveLength(1);
  });

  it('opens the only world without asking', async () => {
    const api = stubApi();
    await signInOn(api, [world()]);
    const { game, sockets } = start(api);
    await act(() => game.session.start());
    expect(game.store.getState().session.phase).toBe('opening');
    expect(sockets).toHaveLength(1);
  });

  it('creates a world and shows its invite code to its creator', async () => {
    const api = stubApi();
    await signInOn(api, []);
    const { game } = start(api);
    await act(() => game.session.start());
    expect(screen.getByRole('heading', { name: 'No island yet' })).toBeInTheDocument();
    api.createWorld.mockResolvedValueOnce(ok({ account: { id: 'id-lena', username: 'Lena' }, world: world({ id: 'w9', islandName: 'Sunny Bay' }) }));
    api.me.mockResolvedValue(ok({ account: { id: 'id-lena', username: 'Lena' }, worlds: [world({ id: 'w9', islandName: 'Sunny Bay' })] }));
    await userEvent.type(screen.getAllByLabelText('Island name')[0]!, 'Sunny Bay');
    await userEvent.click(screen.getByRole('button', { name: 'Create world' }));
    const card = await screen.findByRole('listitem');
    expect(api.createWorld).toHaveBeenCalledWith('Sunny Bay');
    expect(card).toHaveTextContent('Sunny Bay');
    expect(within(card).getByText('ABCDE FGHJK')).toBeInTheDocument();
    expect(game.store.getState().session.phase).toBe('worlds');
  });

  it('joins a world with a code and opens the new island; says why when it cannot', async () => {
    const api = stubApi();
    await signInOn(api, []);
    const { game, sockets } = start(api);
    await act(() => game.session.start());
    api.joinWorld.mockResolvedValueOnce(refused('world-full'));
    await userEvent.type(screen.getAllByLabelText('Invite code')[0]!, 'ABCDEFGHJK');
    await userEvent.type(screen.getAllByLabelText('Island name')[1]!, 'Sandy Cay');
    await userEvent.click(screen.getByRole('button', { name: 'Join world' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This world is full');
    expect(sockets).toHaveLength(0);

    api.me.mockResolvedValue(ok({ account: { id: 'id-lena', username: 'Lena' }, worlds: [world({ id: 'w5', islandName: 'Sandy Cay', creator: 'Omar', inviteCode: null })] }));
    await userEvent.click(screen.getByRole('button', { name: 'Join world' }));
    await waitFor(() => expect(game.store.getState().session.phase).toBe('opening'));
    expect(api.joinWorld).toHaveBeenLastCalledWith('ABCDEFGHJK', 'Sandy Cay');
    expect(sockets).toHaveLength(1);
  });

  it('regenerates the invite code and shows the new one', async () => {
    const api = stubApi();
    await signInOn(api, [world({ id: 'w1' }), world({ id: 'w2', islandName: 'Coral Bay', creator: 'Omar', inviteCode: null })]);
    const { game } = start(api);
    await act(() => game.session.start());
    await userEvent.click(screen.getByRole('button', { name: 'New invite code' }));
    expect(await screen.findByText('NEWCO DE123')).toBeInTheDocument();
    expect(api.regenerateInvite).toHaveBeenCalledWith('w1');
    expect(screen.getByRole('status')).toHaveTextContent('The old code no longer works');
  });

  it('logs out and returns to the log-in screen', async () => {
    const api = stubApi();
    await signInOn(api, []);
    const { game } = start(api);
    await act(() => game.session.start());
    api.me.mockResolvedValue(refused('not-signed-in', 401));
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(await screen.findByRole('button', { name: 'Log in' })).toBeInTheDocument();
    expect(api.logout).toHaveBeenCalledTimes(1);
    expect(game.store.getState().session).toMatchObject({ phase: 'signed-out', account: null, worlds: [] });
  });

  it('has no emoji on any of these screens', async () => {
    const api = stubApi();
    await signInOn(api, [world(), world({ id: 'w2', islandName: 'Coral Bay', creator: 'Omar', inviteCode: null, status: 'paused' })]);
    const { game } = start(api);
    await act(() => game.session.start());
    expectNoEmoji(document.body);
  });
});

describe('from the island back to the world screen', () => {
  it("lets a creator with one world open Settings, go to My worlds, see the invite code and make a new one", async () => {
    const api = stubApi();
    await signInOn(api, [world({ id: 'w1', islandName: 'Palm Cove' })]);
    const { game } = start(api);
    await act(() => game.session.start());
    // The socket never answers here, so the island message and the phase it brings are put in by hand.
    act(() => {
      game.store.getState().receive(islandMessage(aliceWorld(), 0, 'w1'));
      game.store.getState().setSession({ phase: 'playing' });
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Settings' }));
    await userEvent.click(screen.getByRole('button', { name: 'My worlds' }));
    expect(await screen.findByRole('heading', { name: 'Your worlds' })).toBeInTheDocument();
    const card = screen.getByRole('listitem');
    expect(within(card).getByText('ABCDE FGHJK')).toBeInTheDocument();
    expect(game.store.getState().island).toBeNull();
    expect(game.store.getState().view.openPanel).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'New invite code' }));
    expect(await screen.findByText('NEWCO DE123')).toBeInTheDocument();
  });
});
