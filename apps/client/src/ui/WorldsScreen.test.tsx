import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { WorldInfo } from '@island/protocol';
import { describe, expect, it, vi } from 'vitest';
import type { ClientApiReason } from '../connection/api.ts';
import { expectNoEmoji } from '../test/no-emoji.ts';
import { WorldsScreen, type WorldsScreenProps } from './WorldsScreen.tsx';

const own: WorldInfo = { id: 'w1', slot: 0, islandName: 'Palm Cove', creator: 'Lena', inviteCode: 'ABCDEFGHJK', status: 'running' };
const friends: WorldInfo = { id: 'w2', slot: 2, islandName: 'Coral Bay', creator: 'Omar', inviteCode: null, status: 'running' };

function setup(props: Partial<WorldsScreenProps> = {}) {
  const all: WorldsScreenProps = {
    username: 'Lena',
    worlds: [own, friends],
    onOpen: vi.fn(),
    onCreate: vi.fn(async () => null),
    onJoin: vi.fn(async () => null),
    onRegenerate: vi.fn(async () => null),
    onLogOut: vi.fn(async () => null),
    ...props,
  };
  const view = render(<WorldsScreen {...all} />);
  return { ...all, ...view };
}

describe('the world screen', () => {
  it('lists each world with the player\'s island name and who made the world, and opens the one picked', async () => {
    const { onOpen, container } = setup();
    const worlds = screen.getAllByRole('listitem');
    expect(worlds).toHaveLength(2);
    expect(worlds[0]).toHaveTextContent('Palm Cove');
    expect(worlds[0]).toHaveTextContent("Lena's world");
    expect(worlds[1]).toHaveTextContent('Coral Bay');
    expect(worlds[1]).toHaveTextContent("Omar's world");
    await userEvent.click(within(worlds[1]!).getByRole('button', { name: 'Open Coral Bay' }));
    expect(onOpen).toHaveBeenCalledWith('w2');
    expectNoEmoji(container);
  });

  it('says plainly when the player has no island yet, and still offers to create or join a world', () => {
    setup({ worlds: [] });
    expect(screen.getByRole('heading', { name: 'No island yet' })).toBeInTheDocument();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Create world' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Join world' })).toBeInTheDocument();
  });

  it('notes that a resting world is resting', () => {
    setup({ worlds: [{ ...own, status: 'paused' }] });
    expect(screen.getByRole('listitem')).toHaveTextContent('This world is resting');
  });

  it('shows the invite code only to the creator of the world', () => {
    setup();
    const [mine, theirs] = screen.getAllByRole('listitem');
    expect(within(mine!).getByText('ABCDE FGHJK')).toBeInTheDocument();
    expect(within(mine!).getByRole('button', { name: 'Copy invite code' })).toBeInTheDocument();
    expect(within(mine!).getByRole('button', { name: 'New invite code' })).toBeInTheDocument();
    expect(within(theirs!).queryByRole('button', { name: 'Copy invite code' })).not.toBeInTheDocument();
    expect(within(theirs!).queryByText(/invite code/i)).not.toBeInTheDocument();
  });

  it('copies the invite code and says so', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'Copy invite code' }));
    expect(await navigator.clipboard.readText()).toBe('ABCDEFGHJK');
    expect(screen.getByRole('status')).toHaveTextContent('Copied');
  });

  it('asks the player to copy the code by hand when the browser refuses to copy', async () => {
    setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('denied'));
    await userEvent.click(screen.getByRole('button', { name: 'Copy invite code' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Select the code and copy it');
  });

  it('asks the server for a new invite code and tells the old one no longer works', async () => {
    const onRegenerate = vi.fn(async () => null);
    setup({ onRegenerate });
    await userEvent.click(screen.getByRole('button', { name: 'New invite code' }));
    expect(onRegenerate).toHaveBeenCalledWith('w1');
    expect(await screen.findByRole('status')).toHaveTextContent('The old code no longer works');
  });

  it('says why a new invite code could not be made', async () => {
    setup({ onRegenerate: vi.fn(async () => 'unreachable' as const) });
    await userEvent.click(screen.getByRole('button', { name: 'New invite code' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("The island can't be reached right now");
  });

  it('creates a world with a named island', async () => {
    const onCreate = vi.fn(async () => null);
    setup({ onCreate });
    await userEvent.type(screen.getByLabelText('Island name', { selector: '#create-island-name' }), 'Sunny Bay');
    await userEvent.click(screen.getByRole('button', { name: 'Create world' }));
    expect(onCreate).toHaveBeenCalledWith('Sunny Bay');
  });

  it('checks the island name before creating', async () => {
    const onCreate = vi.fn(async () => null);
    setup({ onCreate });
    await userEvent.type(screen.getByLabelText('Island name', { selector: '#create-island-name' }), 'A');
    await userEvent.click(screen.getByRole('button', { name: 'Create world' }));
    expect(onCreate).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent('An island name has 2 to 24 characters.');
  });

  it('joins a world with its code and an island name', async () => {
    const onJoin = vi.fn(async () => null);
    setup({ onJoin });
    await userEvent.type(screen.getByLabelText('Invite code'), 'abcde-fghij');
    await userEvent.type(screen.getByLabelText('Island name', { selector: '#join-island-name' }), 'Sandy Cay');
    await userEvent.click(screen.getByRole('button', { name: 'Join world' }));
    expect(onJoin).toHaveBeenCalledWith('abcde-fghij', 'Sandy Cay');
  });

  it.each<[ClientApiReason, string]>([
    ['bad-invite-code', "That invite code doesn't work. Check it with your friend."],
    ['world-full', 'This world is full'],
    ['world-resting', 'This world is resting, try again soon'],
    ['already-has-island', 'You already have an island in that world'],
  ])('says kindly why joining was refused: %s', async (reason, line) => {
    const { container } = setup({ onJoin: vi.fn(async () => reason) });
    await userEvent.type(screen.getByLabelText('Invite code'), 'ABCDEFGHJK');
    await userEvent.type(screen.getByLabelText('Island name', { selector: '#join-island-name' }), 'Sandy Cay');
    await userEvent.click(screen.getByRole('button', { name: 'Join world' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(line);
    expectNoEmoji(container);
  });

  it('says why creating a world was refused', async () => {
    setup({ onCreate: vi.fn(async () => 'too-many-attempts' as const) });
    await userEvent.type(screen.getByLabelText('Island name', { selector: '#create-island-name' }), 'Sunny Bay');
    await userEvent.click(screen.getByRole('button', { name: 'Create world' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many tries for now');
  });

  it('logs out, and says why when that did not work', async () => {
    const onLogOut = vi.fn<() => Promise<ClientApiReason | null>>();
    onLogOut.mockResolvedValueOnce('unreachable');
    setup({ onLogOut });
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(onLogOut).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('alert')).toHaveTextContent("The island can't be reached right now");
  });
});
