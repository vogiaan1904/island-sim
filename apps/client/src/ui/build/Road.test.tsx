import { content } from '@island/content';
import type { PlayerCommand } from '@island/protocol';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { drawRoad } from '../../placement/draft.ts';
import { GameProvider, type Game } from '../../session/game.tsx';
import { stubGame } from '../../test/game.ts';
import { islandMessage, islandOf } from '../../test/islands.ts';
import { expectNoEmoji } from '../../test/no-emoji.ts';
import { worldWithRoad } from '../../test/placement.ts';
import { Hud } from '../hud/Hud.tsx';
import { PlacementPanel } from './PlacementPanel.tsx';

// Drawing a road through the panel the player sees. The drag itself (pointer to tiles) is tested with the input binding
// and the draft; here the tiles arrive the way the camera rig delivers them, through the draft in the store.

function show(coinsCents?: number) {
  const world = worldWithRoad();
  if (coinsCents !== undefined) islandOf(world).coinsCents = coinsCents;
  const game = stubGame('playing');
  game.store.getState().receive(islandMessage(world));
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

async function pickRoad(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Build' }));
  await user.click(screen.getByRole('button', { name: /^Road/ }));
}

/** One drag from tile a to tile b, as the rig reports it. */
function dragRoad(game: Game, from: [number, number], to: [number, number], begin = true) {
  act(() => {
    const roads = game.store.getState().island!.state.roads;
    const start = drawRoad(placement(game)!, { x: from[0], y: from[1] }, begin, { content, roads });
    game.store.getState().setView({ placement: drawRoad(start, { x: to[0], y: to[1] }, false, { content, roads }) });
  });
}

function result(game: Game, requestId: number, body: { ok: true; data: Record<string, number> } | { ok: false; reason: 'not-enough-coins'; shortfallCents: number }) {
  act(() => game.store.getState().receive({ type: 'result', requestId, ...body }));
}

afterEach(() => {
  vi.useRealTimers();
});

describe('the Road row in the Build picker', () => {
  it('is its own row above the buildings, with the price per tile', async () => {
    const { user } = show();
    await user.click(screen.getByRole('button', { name: 'Build' }));
    const roads = screen.getByRole('list', { name: 'Roads' });
    const row = within(roads).getByRole('button', { name: /^Road/ });
    expect(row).toHaveTextContent('10');
    expect(row).toHaveTextContent('Per tile');
    // The buildings list still holds buildings only.
    expect(within(screen.getByRole('list', { name: 'Buildings' })).queryByRole('button', { name: /^Road/ })).toBeNull();
  });

  it('starts a road draft with the pen down and closes the picker', async () => {
    const { game, user } = show();
    await pickRoad(user);
    expect(placement(game)).toMatchObject({ kind: 'road', tiles: [], pen: 'draw', phase: 'aiming' });
    expect(game.store.getState().view.openPanel).toBeNull();
    expect(screen.getByRole('region', { name: 'Placing Road' })).toBeInTheDocument();
  });
});

describe('the road panel', () => {
  it('asks for a drag and keeps Place off until there is something to build', async () => {
    const { user } = show();
    await pickRoad(user);
    const panel = screen.getByRole('region', { name: 'Placing Road' });
    expect(screen.getByText('Drag to draw a road')).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Place' })).toBeDisabled();
    expect(within(panel).getByRole('button', { name: 'Start over' })).toBeDisabled();
    expect(within(panel).getByRole('button', { name: 'Cancel' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Rotate' })).toBeNull();
  });

  it('shows the tiles and the cost as the road grows', async () => {
    const { game, user } = show();
    await pickRoad(user);
    dragRoad(game, [35, 50], [35, 52]);
    const panel = screen.getByRole('region', { name: 'Placing Road' });
    expect(panel).toHaveTextContent('3 tiles');
    expect(panel).toHaveTextContent('30');
    expect(within(panel).getByRole('button', { name: 'Place' })).toBeEnabled();
    dragRoad(game, [35, 52], [35, 54], false);
    expect(panel).toHaveTextContent('5 tiles');
    expect(panel).toHaveTextContent('50');
  });

  it('says one tile in the singular', async () => {
    const { game, user } = show();
    await pickRoad(user);
    dragRoad(game, [35, 50], [35, 50]);
    expect(screen.getByRole('region', { name: 'Placing Road' })).toHaveTextContent('1 tile');
    expect(screen.getByRole('region', { name: 'Placing Road' })).not.toHaveTextContent('1 tiles');
  });

  it('sends the place-road command with the dragged tiles, and shows "placing" until the server answers', async () => {
    const { game, user } = show();
    await pickRoad(user);
    dragRoad(game, [35, 50], [35, 52]);
    await user.click(screen.getByRole('button', { name: 'Place' }));
    expect(game.session.command).toHaveBeenCalledWith({ type: 'place-road', tiles: [[35, 50], [35, 51], [35, 52]] });
    expect(placement(game)).toMatchObject({ kind: 'road', phase: 'placing', requestId: 7 });
    expect(screen.getByRole('button', { name: 'Placing' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Start over' })).toBeDisabled();
  });

  it('ends the placement once the server says ok', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { game, user } = show();
    await pickRoad(user);
    dragRoad(game, [35, 50], [35, 52]);
    await user.click(screen.getByRole('button', { name: 'Place' }));
    result(game, 7, { ok: true, data: { tilesBuilt: 3 } });
    expect(placement(game)).toMatchObject({ kind: 'road', phase: 'landing' });
    expect(screen.queryByRole('region', { name: 'Placing Road' })).toBeNull();
    act(() => void vi.advanceTimersByTime(2000));
    expect(placement(game)).toBeNull();
  });

  it('disables Place with "Need N more coins" when the road costs more than the island has', async () => {
    const { game, user } = show(2_500);
    await pickRoad(user);
    dragRoad(game, [35, 50], [35, 52]);
    const place = screen.getByRole('button', { name: 'Need 5 more coins' });
    expect(place).toBeDisabled();
    await user.click(place);
    expect(game.session.command).not.toHaveBeenCalled();
  });

  it('labels a drag over water, and blocks Place', async () => {
    const { game, user } = show();
    await pickRoad(user);
    dragRoad(game, [0, 0], [1, 0]);
    expect(screen.getByRole('list', { name: 'Checks' })).toHaveTextContent('Needs dry land');
    expect(screen.getByRole('button', { name: 'Place' })).toBeDisabled();
  });

  it('keeps the road and says why when the server refuses', async () => {
    const { game, user } = show();
    await pickRoad(user);
    dragRoad(game, [35, 50], [35, 52]);
    await user.click(screen.getByRole('button', { name: 'Place' }));
    result(game, 7, { ok: false, reason: 'not-enough-coins', shortfallCents: 1_000 });
    expect(placement(game)).toMatchObject({ phase: 'aiming', refusal: { reason: 'not-enough-coins' } });
    expect(placement(game)).toMatchObject({ tiles: [{ x: 35, y: 50 }, { x: 35, y: 51 }, { x: 35, y: 52 }] });
    expect(screen.getByRole('alert')).toHaveTextContent('Need 10 more coins');
    expect(screen.getByRole('button', { name: 'Place' })).toBeEnabled();
  });

  it('starts over with the tiles gone and Cancel drops the whole road', async () => {
    const { game, user } = show();
    await pickRoad(user);
    dragRoad(game, [35, 50], [35, 52]);
    await user.click(screen.getByRole('button', { name: 'Start over' }));
    expect(placement(game)).toMatchObject({ kind: 'road', tiles: [] });
    expect(screen.getByRole('button', { name: 'Place' })).toBeDisabled();
    dragRoad(game, [35, 50], [35, 51]);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(placement(game)).toBeNull();
  });
});

describe('switching between drawing and looking around', () => {
  it('says which mode the drag is in, and the button that swaps them says what it does', async () => {
    const { game, user } = show();
    await pickRoad(user);
    const look = screen.getByRole('button', { name: 'Look around' });
    expect(look).toHaveAttribute('aria-pressed', 'false');
    await user.click(look);
    expect(placement(game)).toMatchObject({ kind: 'road', pen: 'look' });
    expect(screen.getByText('Drag to move the view')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Look around' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Look around' }));
    expect(placement(game)).toMatchObject({ pen: 'draw' });
    expect(screen.getByText('Drag to draw a road')).toBeInTheDocument();
  });

  it('keeps the dragged tiles while looking around', async () => {
    const { game, user } = show();
    await pickRoad(user);
    dragRoad(game, [35, 50], [35, 52]);
    await user.click(screen.getByRole('button', { name: 'Look around' }));
    expect(screen.getByRole('region', { name: 'Placing Road' })).toHaveTextContent('3 tiles');
    expect(screen.getByRole('button', { name: 'Place' })).toBeEnabled();
  });
});

describe('removing road', () => {
  it('swaps to removing, takes only road tiles, and sends remove-road for free', async () => {
    const { game, user } = show();
    await pickRoad(user);
    const remove = screen.getByRole('button', { name: 'Remove road' });
    expect(remove).toHaveAttribute('aria-pressed', 'false');
    await user.click(remove);
    expect(placement(game)).toMatchObject({ kind: 'road', removing: true });
    expect(screen.getByText('Drag over road to remove it')).toBeInTheDocument();
    dragRoad(game, [32, 49], [34, 49]);
    const panel = screen.getByRole('region', { name: 'Placing Remove road' });
    expect(panel).toHaveTextContent('1 tile');
    expect(panel).toHaveTextContent('Removing road is free');
    await user.click(within(panel).getByRole('button', { name: 'Remove' }));
    expect(game.session.command).toHaveBeenCalledWith({ type: 'remove-road', tiles: [[33, 49]] });
  });
});

describe('roads and emoji', () => {
  it('shows no emoji', async () => {
    const { game, user, container } = show(2_500);
    await pickRoad(user);
    dragRoad(game, [35, 50], [35, 52]);
    expectNoEmoji(container);
  });
});
