import { content } from '@island/content';
import type { PlayerCommand } from '@island/protocol';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startDraft } from '../../placement/draft.ts';
import { GameProvider, type Game } from '../../session/game.tsx';
import { stubGame } from '../../test/game.ts';
import { islandMessage, islandOf } from '../../test/islands.ts';
import { expectNoEmoji } from '../../test/no-emoji.ts';
import { worldWithRoad } from '../../test/placement.ts';
import { Hud } from '../hud/Hud.tsx';
import { PlacementPanel } from './PlacementPanel.tsx';

function show(coinsCents?: number) {
  const world = worldWithRoad();
  if (coinsCents !== undefined) islandOf(world).coinsCents = coinsCents;
  const game = stubGame('playing');
  game.store.getState().receive(islandMessage(world));
  // A command goes out as the real session sends it: recorded as pending under a fresh request id.
  let next = 7;
  vi.mocked(game.session.command).mockImplementation((command: PlayerCommand) => {
    const requestId = next;
    next += 1;
    game.store.getState().commandSent(requestId, command);
    return requestId;
  });
  const user = userEvent.setup();
  const view = render(
    <GameProvider game={game}>
      <Hud />
      <PlacementPanel />
    </GameProvider>,
  );
  return { game, user, world, ...view };
}

const placement = (game: Game) => game.store.getState().view.placement;

/** The building draft in progress; fails the test when the player is placing something else. */
function buildingDraft(game: Game) {
  const draft = placement(game);
  if (draft?.kind !== 'building') throw new Error('not placing a building');
  return draft;
}

/** Picks a building the way a player does: Build, then its row. */
async function pick(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('button', { name: 'Build' }));
  await user.click(screen.getByRole('button', { name: new RegExp(`^${name}`) }));
}

/** Aims the draft at a footprint's top-left tile, as a drag or a tap on the island would. */
function aim(game: Game, x: number, y: number) {
  act(() => game.store.getState().setView({ placement: { ...buildingDraft(game), x, y, refusal: null } }));
}

function result(game: Game, requestId: number, body: { ok: true; data: Record<string, number> } | { ok: false; reason: 'tile-occupied'; shortfallCents: number }) {
  act(() => game.store.getState().receive({ type: 'result', requestId, ...body }));
}

afterEach(() => {
  vi.useRealTimers();
});

describe('the Build picker', () => {
  it('lists each building with its icon, name and cost, without the dock', async () => {
    const { user } = show();
    await user.click(screen.getByRole('button', { name: 'Build' }));
    const picker = screen.getByRole('list', { name: 'Buildings' });
    const rows = within(picker).getAllByRole('listitem');
    expect(rows).toHaveLength(content.buildings.filter((b) => b.playerBuildable).length);
    expect(within(picker).queryByRole('button', { name: /^Dock/ })).toBeNull();
    const farm = within(picker).getByRole('button', { name: /^Farm/ });
    expect(farm).toHaveTextContent('400');
    expect(farm.querySelector('img')).toHaveAttribute('src', '/icons/building_farm_a.png');
  });

  it('says "Need N more coins" on a building the island cannot pay yet, and what unlocks a landmark', async () => {
    const { user } = show(39_000);
    await user.click(screen.getByRole('button', { name: 'Build' }));
    expect(screen.getByRole('button', { name: /^Farm/ })).toHaveTextContent('Need 10 more coins');
    expect(screen.getByRole('button', { name: /^Cottage/ })).not.toHaveTextContent('Need');
    const hall = screen.getByRole('button', { name: /^Island Hall/ });
    expect(hall).toBeDisabled();
    expect(hall).toHaveTextContent('Unlocks with 10 residents');
  });

  it('starts a placement near the middle of the view and closes the picker', async () => {
    const { game, user } = show();
    await pick(user, 'Cottage');
    expect(screen.queryByRole('region', { name: 'Build' })).toBeNull();
    expect(placement(game)).toMatchObject({ kind: 'building', building: 'cottage', phase: 'aiming', rotation: 0 });
    expect(game.store.getState().view.openPanel).toBeNull();
  });

  it('can start on a building it cannot afford; Place then waits', async () => {
    const { game, user } = show(39_000);
    await pick(user, 'Farm');
    expect(buildingDraft(game).building).toBe('farm');
  });

  it('is not offered while visiting a friend', () => {
    const world = worldWithRoad();
    const game = stubGame('playing');
    game.store.getState().receive({ ...islandMessage(world), own: false });
    render(
      <GameProvider game={game}>
        <Hud />
      </GameProvider>,
    );
    expect(screen.queryByRole('button', { name: 'Build' })).toBeNull();
  });

  it('shows no emoji', async () => {
    const { user, container } = show(39_000);
    await user.click(screen.getByRole('button', { name: 'Build' }));
    expectNoEmoji(container);
  });
});

describe('the placement panel', () => {
  it('shows the building, its price, a sentence about it, its size and the three controls', async () => {
    const { game, user } = show();
    await pick(user, 'Farm');
    aim(game, 34, 52);
    const panel = screen.getByRole('region', { name: 'Placing Farm' });
    expect(within(panel).getByRole('heading', { name: 'Farm' })).toBeInTheDocument();
    expect(panel).toHaveTextContent('400');
    expect(panel).toHaveTextContent('Takes 3 x 2 tiles.');
    expect(within(panel).getByRole('button', { name: 'Rotate' })).toBeEnabled();
    expect(within(panel).getByRole('button', { name: 'Cancel' })).toBeEnabled();
    expect(within(panel).getByRole('button', { name: 'Place' })).toBeEnabled();
    expect(screen.getByText('Drag to move')).toBeInTheDocument();
  });

  it('replaces the bottom bar while placing', async () => {
    const { user } = show();
    await pick(user, 'Cottage');
    expect(screen.queryByRole('toolbar', { name: 'Main actions' })).toBeNull();
  });

  it('labels the spot from the sim\'s own check, and blocks Place where it fails', async () => {
    const { game, user } = show();
    await pick(user, 'Cottage');
    aim(game, 34, 55);
    expect(screen.getByRole('list', { name: 'Checks' })).toHaveTextContent('Road access');
    expect(screen.getByRole('button', { name: 'Place' })).toBeEnabled();
    aim(game, 0, 0);
    expect(screen.getByRole('list', { name: 'Checks' })).toHaveTextContent('Needs dry land');
    expect(screen.getByRole('button', { name: 'Place' })).toBeDisabled();
  });

  it('disables Place with "Need N more coins" when the island is short', async () => {
    const { game, user } = show(15_050);
    await pick(user, 'Cottage');
    aim(game, 34, 55);
    const place = screen.getByRole('button', { name: 'Need 50 more coins' });
    expect(place).toBeDisabled();
    await user.click(place);
    expect(game.session.command).not.toHaveBeenCalled();
  });

  it('turns the ghost with Rotate and drops it with Cancel', async () => {
    const { game, user } = show();
    await pick(user, 'Farm');
    await user.click(screen.getByRole('button', { name: 'Rotate' }));
    expect(buildingDraft(game).rotation).toBe(1);
    expect(screen.getByRole('region', { name: 'Placing Farm' })).toHaveTextContent('Takes 3 x 2 tiles.');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(placement(game)).toBeNull();
    expect(screen.queryByRole('region', { name: 'Placing Farm' })).toBeNull();
  });

  it('sends the place-building command, and shows "placing" until the server answers', async () => {
    const { game, user } = show();
    await pick(user, 'Cottage');
    aim(game, 34, 55);
    await user.click(screen.getByRole('button', { name: 'Place' }));
    expect(game.session.command).toHaveBeenCalledWith({ type: 'place-building', building: 'cottage', x: 34, y: 55, rotation: 0 });
    expect(placement(game)).toMatchObject({ phase: 'placing', requestId: 7 });
    const place = screen.getByRole('button', { name: 'Placing' });
    expect(place).toBeDisabled();
    expect(place).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Rotate' })).toBeDisabled();
  });

  it('lands (bounce and dust) only when the server says ok, then ends the placement', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { game, user } = show();
    await pick(user, 'Cottage');
    aim(game, 34, 55);
    await user.click(screen.getByRole('button', { name: 'Place' }));
    expect(placement(game)?.phase).toBe('placing');
    result(game, 7, { ok: true, data: { buildingId: 12 } });
    expect(placement(game)).toMatchObject({ phase: 'landing', landedBuildingId: 12 });
    expect(screen.queryByRole('region', { name: 'Placing Cottage' })).toBeNull();
    act(() => void vi.advanceTimersByTime(2000));
    expect(placement(game)).toBeNull();
  });

  it('keeps the ghost and says why when the server refuses, with no landing', async () => {
    const { game, user } = show();
    await pick(user, 'Cottage');
    aim(game, 34, 55);
    await user.click(screen.getByRole('button', { name: 'Place' }));
    result(game, 7, { ok: false, reason: 'tile-occupied', shortfallCents: 0 });
    expect(placement(game)).toMatchObject({ phase: 'aiming', x: 34, y: 55, refusal: { reason: 'tile-occupied' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Something is already there');
    expect(screen.getByRole('button', { name: 'Place' })).toBeEnabled();
    // Moving the ghost clears the line.
    aim(game, 34, 54);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('goes back to aiming when the connection dropped before the answer', async () => {
    const { game, user } = show();
    await pick(user, 'Cottage');
    aim(game, 34, 55);
    await user.click(screen.getByRole('button', { name: 'Place' }));
    act(() => game.store.getState().commandsLost());
    expect(placement(game)).toMatchObject({ phase: 'aiming', refusal: { reason: 'world-catching-up' } });
    expect(screen.getByRole('alert')).toHaveTextContent('catching up');
  });

  it('says so when the command could not be sent at all', async () => {
    const { game, user } = show();
    vi.mocked(game.session.command).mockReturnValue(null);
    await pick(user, 'Cottage');
    aim(game, 34, 55);
    await user.click(screen.getByRole('button', { name: 'Place' }));
    expect(placement(game)?.phase).toBe('aiming');
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('draws nothing when there is no placement', () => {
    const { container } = show();
    expect(container.querySelector('[data-placement]')).toBeNull();
  });

  it('drops the placement when the island screen goes away', () => {
    const { game, unmount } = show();
    act(() => game.store.getState().setView({ placement: startDraft('cottage', { x: 34, y: 55 }, content) }));
    unmount();
    expect(placement(game)).toBeNull();
  });

  it('shows no emoji', async () => {
    const { game, user, container } = show(15_050);
    await pick(user, 'Cottage');
    aim(game, 44, 35);
    expectNoEmoji(container);
  });
});
