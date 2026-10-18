import { content } from '@island/content';
import type { BuildingId } from '@island/content';
import type { ServerMessage } from '@island/protocol';
import { newBuilding, type BuildingState, type ConditionId, type WorldState } from '@island/sim';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameProvider, type Game } from '../../session/game.tsx';
import { stubGame } from '../../test/game.ts';
import { aliceWorld, islandMessage, islandOf } from '../../test/islands.ts';
import { expectNoEmoji } from '../../test/no-emoji.ts';
import { CardHost } from './CardHost.tsx';

let nextId = 100;

/** Adds a finished building to the world's island with these changes; returns its id. */
function add(world: WorldState, type: BuildingId, patch: (b: BuildingState) => void = () => {}): number {
  const def = content.buildings.find((d) => d.id === type);
  if (def === undefined) throw new Error(type);
  const building = { ...newBuilding(def, nextId++, 4, 4, 0), constructionLeft: 0, conditions: [] as ConditionId[] };
  patch(building);
  islandOf(world).buildings.push(building);
  return building.id;
}

function show(world: WorldState, tapped: number | null, own = true) {
  const game = stubGame('playing');
  game.store.getState().receive({ ...islandMessage(world), own });
  game.store.getState().setView({ tappedBuilding: tapped });
  const view = render(
    <GameProvider game={game}>
      <CardHost />
    </GameProvider>,
  );
  return { game, ...view };
}

const camera = (game: Game) => game.store.getState().view.camera;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the building card', () => {
  it('draws nothing until a building is tapped', () => {
    const { container } = show(aliceWorld(), null);
    expect(container).toBeEmptyDOMElement();
  });

  it('opens at once on the tapped building with its picture, name and status in words', () => {
    const world = aliceWorld();
    const farm = add(world, 'farm', (b) => {
      b.conditions = ['waiting-for-money'];
    });
    show(world, farm);
    const card = screen.getByRole('region', { name: 'Farm' });
    expect(within(card).getByRole('img', { name: 'Farm' })).toHaveAttribute('src', '/icons/building_farm_a.png');
    expect(within(card).getByText('Waiting for money')).toBeInTheDocument();
  });

  it('shows only the most important condition of several', () => {
    const world = aliceWorld();
    const farm = add(world, 'farm', (b) => {
      b.conditions = ['no-workers', 'output-full'];
    });
    show(world, farm);
    expect(screen.getByText('No workers')).toBeInTheDocument();
    expect(screen.queryByText('Storage is full')).not.toBeInTheDocument();
  });

  it('shows what it makes as pictures and its workers as heads, filled and open', () => {
    const world = aliceWorld();
    const farm = add(world, 'farm', (b) => {
      b.stock = { vegetables: 7 };
      if (b.work !== null) b.work.commuters = 3;
    });
    show(world, farm);
    const makes = screen.getByRole('list', { name: 'Makes' });
    expect(within(makes).getByRole('img', { name: 'Vegetables' })).toHaveAttribute('src', '/icons/good_vegetables_a.png');
    expect(within(makes).getByText('7')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '3 of 4 workers' })).toBeInTheDocument();
  });

  it('closes with its Close button', async () => {
    const world = aliceWorld();
    const farm = add(world, 'farm');
    const { game } = show(world, farm);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(game.store.getState().view.tappedBuilding).toBeNull();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('replaces an open panel, and is replaced by one', () => {
    const world = aliceWorld();
    const farm = add(world, 'farm');
    const { game } = show(world, null);
    act(() => game.store.getState().setView({ openPanel: 'trade' }));
    act(() => game.store.getState().setView({ tappedBuilding: farm }));
    expect(game.store.getState().view.openPanel).toBeNull();
    act(() => game.store.getState().setView({ openPanel: 'staff' }));
    expect(game.store.getState().view.tappedBuilding).toBeNull();
  });

  it('closes on Android back, with one history step per open card', () => {
    const push = vi.spyOn(window.history, 'pushState');
    const world = aliceWorld();
    const farm = add(world, 'farm');
    const cottage = add(world, 'cottage');
    const { game } = show(world, farm);
    expect(push).toHaveBeenCalledTimes(1);
    act(() => game.store.getState().setView({ tappedBuilding: cottage }));
    expect(push).toHaveBeenCalledTimes(1);
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(game.store.getState().view.tappedBuilding).toBeNull();
  });

  it('steps the history back when the card is closed some other way, so back does not do nothing later', async () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const world = aliceWorld();
    const farm = add(world, 'farm');
    show(world, farm);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('has no emoji', () => {
    const world = aliceWorld();
    const farm = add(world, 'farm', (b) => {
      b.conditions = ['no-workers'];
    });
    const { container } = show(world, farm);
    expectNoEmoji(container);
  });
});

describe('Fix', () => {
  it('sends the one action when there is one: raise the priority', async () => {
    const world = aliceWorld();
    add(world, 'lumber-camp', (b) => {
      if (b.work !== null) b.work.commuters = 4;
    });
    const farm = add(world, 'farm', (b) => {
      b.conditions = ['no-workers'];
    });
    const { game } = show(world, farm);
    (game.session.command as ReturnType<typeof vi.fn>).mockReturnValue(1);
    expect(screen.getByText('The farm has no workers.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Fix' }));
    expect(game.session.command).toHaveBeenCalledWith({ type: 'set-priority', buildingId: farm, priority: 2 });
  });

  it('sends hire-commuters when nobody is free', async () => {
    const world = aliceWorld();
    islandOf(world).commuters = { hired: 2, present: 2 };
    const farm = add(world, 'farm', (b) => {
      b.conditions = ['no-workers'];
    });
    const { game } = show(world, farm);
    (game.session.command as ReturnType<typeof vi.fn>).mockReturnValue(1);
    await userEvent.click(screen.getByRole('button', { name: 'Fix' }));
    expect(game.session.command).toHaveBeenCalledWith({ type: 'hire-commuters', count: 6 });
  });

  it('flies the camera to the cause and says why when no action fixes it', async () => {
    const world = aliceWorld();
    const farm = add(world, 'farm', (b) => {
      b.conditions = ['waiting-for-money'];
    });
    const { game } = show(world, farm);
    const before = camera(game);
    await userEvent.click(screen.getByRole('button', { name: 'Fix' }));
    expect(game.session.command).not.toHaveBeenCalled();
    expect(camera(game)).not.toBe(before);
    expect(screen.getByRole('status')).toHaveTextContent(/coins ran short/i);
  });

  it('flies to the dock and says why when the ferry is full', async () => {
    const world = aliceWorld();
    islandOf(world).commuters = { hired: content.rules.ferrySeats, present: content.rules.ferrySeats };
    const farm = add(world, 'farm', (b) => {
      b.conditions = ['no-workers'];
    });
    const { game } = show(world, farm);
    await userEvent.click(screen.getByRole('button', { name: 'Fix' }));
    expect(game.session.command).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent(/ferry is full/i);
  });

  it('flies to the cause and says why when the server refuses the action', async () => {
    const world = aliceWorld();
    islandOf(world).commuters = { hired: 2, present: 2 };
    const farm = add(world, 'farm', (b) => {
      b.conditions = ['no-workers'];
    });
    const { game } = show(world, farm);
    (game.session.command as ReturnType<typeof vi.fn>).mockReturnValue(7);
    await userEvent.click(screen.getByRole('button', { name: 'Fix' }));
    const before = camera(game);
    act(() => {
      game.store.getState().commandSent(7, { type: 'hire-commuters', count: 6 });
      game.store.getState().receive({ type: 'result', requestId: 7, ok: false, reason: 'not-enough-seats', shortfallCents: 0 } as ServerMessage);
    });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/ferry is full/i));
    expect(camera(game)).not.toBe(before);
  });

  it('is hidden on a visit', () => {
    const world = aliceWorld();
    const farm = add(world, 'farm', (b) => {
      b.conditions = ['no-workers'];
    });
    show(world, farm, false);
    expect(screen.getByText('The farm has no workers.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fix' })).not.toBeInTheDocument();
  });
});

describe('the landmark card', () => {
  function site(world: WorldState, patch: (b: BuildingState) => void = () => {}): number {
    return add(world, 'island-hall', (b) => {
      b.constructionLeft = 500;
      b.conditions = ['under-construction', 'missing-input'];
      patch(b);
    });
  }

  it('lists the materials with what is stored, on the way and missing', () => {
    const world = aliceWorld();
    islandOf(world).coinsCents = 5_000_000;
    const hall = site(world, (b) => {
      b.stock = { wood: 50 };
    });
    islandOf(world).cargo.push({ good: 'wood', amount: 30, to: hall });
    show(world, hall);
    const wood = screen.getByRole('listitem', { name: /^Wood: 50 of 150 stored/ });
    expect(wood).toHaveAccessibleName(/30 on the way/);
    expect(wood).toHaveAccessibleName(/70 to buy/);
    expect(screen.getByText('Coming on the next ferry')).toBeInTheDocument();
  });

  it('buys the missing materials with Buy and shows the price', async () => {
    const world = aliceWorld();
    islandOf(world).coinsCents = 5_000_000;
    const hall = site(world);
    const { game } = show(world, hall);
    (game.session.command as ReturnType<typeof vi.fn>).mockReturnValue(3);
    const buy = screen.getByRole('button', { name: /^Buy/ });
    expect(buy).toBeEnabled();
    await userEvent.click(buy);
    expect(game.session.command).toHaveBeenCalledWith({ type: 'buy-materials', buildingId: hall });
  });

  it('says Need N more coins and disables Buy when the coins are short', () => {
    const world = aliceWorld();
    islandOf(world).coinsCents = 1_000;
    const hall = site(world);
    show(world, hall);
    const buy = screen.getByRole('button', { name: /Need [\d,]+ more coins/ });
    expect(buy).toBeDisabled();
  });

  it('shows bought materials as on their way, with no Buy left, until the next ferry', () => {
    const world = aliceWorld();
    const hall = site(world);
    islandOf(world).cargo.push({ good: 'wood', amount: 150, to: hall });
    show(world, hall);
    expect(screen.queryByRole('button', { name: /Buy|Need/ })).not.toBeInTheDocument();
    expect(screen.getByText('Coming on the next ferry')).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: /150 on the way/ })).toBeInTheDocument();
  });

  it('hides Buy on a visit', () => {
    const world = aliceWorld();
    islandOf(world).coinsCents = 5_000_000;
    const hall = site(world);
    show(world, hall, false);
    expect(screen.queryByRole('button', { name: /Buy/ })).not.toBeInTheDocument();
  });

  it('has no emoji', () => {
    const world = aliceWorld();
    islandOf(world).coinsCents = 5_000_000;
    const hall = site(world);
    const { container } = show(world, hall);
    expectNoEmoji(container);
  });
});
