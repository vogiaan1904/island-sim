import { content } from '@island/content';
import type { BuildingId, GoalId } from '@island/content';
import { newBuilding, type BuildingState, type ConditionId, type WorldState } from '@island/sim';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ISLAND_LIMITS } from '../../camera/limits.ts';
import { GameProvider, type Game } from '../../session/game.tsx';
import { stubGame } from '../../test/game.ts';
import { aliceWorld, islandMessage, islandOf } from '../../test/islands.ts';
import { expectNoEmoji } from '../../test/no-emoji.ts';
import { BubbleLayer } from './BubbleLayer.tsx';

let nextId = 100;

function add(world: WorldState, type: BuildingId, patch: (b: BuildingState) => void = () => {}): BuildingState {
  const def = content.buildings.find((d) => d.id === type)!;
  const building = { ...newBuilding(def, nextId++, 30, 52, 0), constructionLeft: 0, conditions: [] as ConditionId[] };
  patch(building);
  islandOf(world).buildings.push(building);
  return building;
}

/** The camera looks at the dock's corner of the island from the opening distance, so every bubble is on screen. */
function lookAtMiddle(game: Game, distance = ISLAND_LIMITS.startDistance) {
  game.store.getState().cameraGesture({ kind: 'fly-to', x: 128, z: 214, distance, instant: true });
}

function show(world: WorldState, own = true) {
  const game = stubGame('playing');
  game.store.getState().receive({ ...islandMessage(world), own });
  lookAtMiddle(game);
  const view = render(
    <GameProvider game={game}>
      <div data-counter="coins" />
      <BubbleLayer />
    </GameProvider>,
  );
  return { game, ...view };
}

/** A session whose collect goes into the store as a pending command with this request id, like the real one. */
function collectsAs(game: Game, requestId: number) {
  vi.mocked(game.session.command).mockImplementation((command) => {
    game.store.getState().commandSent(requestId, command);
    return requestId;
  });
}

const settle = (game: Game, requestId: number, result: { ok: true } | { ok: false; reason: 'no-reward' | 'world-paused' }) =>
  act(() =>
    game.store.getState().receive(
      result.ok
        ? { type: 'result', requestId, ok: true, data: { rewardCents: 20000 } }
        : { type: 'result', requestId, ok: false, reason: result.reason, shortfallCents: 0 },
    ),
  );

const flights = (container: HTMLElement) => container.querySelectorAll('[data-coin-flight]');

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('problem bubbles', () => {
  function farmWithoutWorkers() {
    const world = aliceWorld();
    const farm = add(world, 'farm', (b) => {
      b.conditions = ['no-workers'];
    });
    return { world, farm };
  }

  it('shows a bubble over a building with a problem, named for the building and its status', () => {
    const { world } = farmWithoutWorkers();
    show(world);
    expect(screen.getByRole('button', { name: 'Farm: No workers' })).toBeInTheDocument();
  });

  it('opens that building\'s card when tapped', async () => {
    const { world, farm } = farmWithoutWorkers();
    const { game } = show(world);
    await userEvent.click(screen.getByRole('button', { name: 'Farm: No workers' }));
    expect(game.store.getState().view.tappedBuilding).toBe(farm.id);
    expect(game.session.command).not.toHaveBeenCalled();
  });

  it('shows no bubble on a quiet island', () => {
    const { container } = show(aliceWorld());
    expect(within(container).queryAllByRole('button')).toEqual([]);
  });

  it('takes the bubble away when the problem goes', () => {
    const { world, game } = (() => {
      const made = farmWithoutWorkers();
      return { world: made.world, game: show(made.world).game };
    })();
    expect(screen.getByRole('button', { name: 'Farm: No workers' })).toBeInTheDocument();
    const fixed = structuredClone(world);
    islandOf(fixed).buildings.forEach((b) => {
      b.conditions = [];
    });
    act(() => game.store.getState().receive(islandMessage(fixed)));
    expect(screen.queryByRole('button', { name: /Farm/ })).not.toBeInTheDocument();
  });

  it('is shown to a visitor too, and a tap opens the card read-only', async () => {
    const { world, farm } = farmWithoutWorkers();
    const { game } = show(world, false);
    await userEvent.click(screen.getByRole('button', { name: 'Farm: No workers' }));
    expect(game.store.getState().view.tappedBuilding).toBe(farm.id);
  });
});

describe('wish bubbles', () => {
  it('shows a wish for a home with an unmet need and opens the home\'s card when tapped', async () => {
    const world = aliceWorld();
    const home = add(world, 'cottage', (b) => {
      b.home!.residents = 2;
      b.home!.unmetNeeds = ['water'];
    });
    const { game } = show(world);
    const wish = screen.getByRole('button', { name: 'Cottage: wants water' });
    expect(wish).toHaveAttribute('data-kind', 'wish');
    await userEvent.click(wish);
    expect(game.store.getState().view.tappedBuilding).toBe(home.id);
  });
});

describe('reward bubbles and the coins', () => {
  function rewardWorld() {
    const world = aliceWorld();
    islandOf(world).rewards = ['first-residents'] as GoalId[];
    islandOf(world).completedGoals = ['first-residents'] as GoalId[];
    return world;
  }

  it('shows a reward bubble for a finished goal', () => {
    show(rewardWorld());
    expect(screen.getByRole('button', { name: 'Collect 200 coins' })).toHaveAttribute('data-kind', 'reward');
  });

  it('sends collect for the goal when tapped, and flies no coins before the server says ok', async () => {
    const { game, container } = show(rewardWorld());
    collectsAs(game, 5);
    await userEvent.click(screen.getByRole('button', { name: 'Collect 200 coins' }));
    expect(game.session.command).toHaveBeenCalledWith({ type: 'collect', goal: 'first-residents' });
    expect(flights(container)).toHaveLength(0);
  });

  it('flies coins from the reward on the server\'s ok, even though the reward is gone from the island by then', async () => {
    const { game, container } = show(rewardWorld());
    collectsAs(game, 5);
    await userEvent.click(screen.getByRole('button', { name: 'Collect 200 coins' }));
    // The update (the reward gone) arrives before the result, as the server sends them.
    const collected = rewardWorld();
    islandOf(collected).rewards = [];
    act(() => game.store.getState().receive(islandMessage(collected)));
    expect(screen.queryByRole('button', { name: /Collect/ })).not.toBeInTheDocument();
    expect(flights(container)).toHaveLength(0);
    settle(game, 5, { ok: true });
    expect(flights(container).length).toBeGreaterThan(0);
  });

  it('flies the coins toward the coin counter', async () => {
    const { game, container } = show(rewardWorld());
    const counter = document.querySelector('[data-counter="coins"]')!;
    counter.getBoundingClientRect = () => ({ left: 700, top: 30, width: 100, height: 40, right: 800, bottom: 70, x: 700, y: 30, toJSON: () => ({}) });
    collectsAs(game, 5);
    await userEvent.click(screen.getByRole('button', { name: 'Collect 200 coins' }));
    settle(game, 5, { ok: true });
    const first = flights(container)[0] as HTMLElement;
    // Its end point is the middle of the counter, relative to where it starts.
    const from = { x: parseFloat(first.style.left), y: parseFloat(first.style.top) };
    expect(from.x + parseFloat(first.style.getPropertyValue('--dx'))).toBeCloseTo(750);
    expect(from.y + parseFloat(first.style.getPropertyValue('--dy'))).toBeCloseTo(50);
  });

  it('flies no coins when the server refuses, says why, and keeps the reward to try again', async () => {
    const { game, container } = show(rewardWorld());
    collectsAs(game, 5);
    await userEvent.click(screen.getByRole('button', { name: 'Collect 200 coins' }));
    settle(game, 5, { ok: false, reason: 'world-paused' });
    expect(flights(container)).toHaveLength(0);
    expect(screen.getByRole('status')).toHaveTextContent('This island is resting, back soon');
    expect(screen.getByRole('button', { name: 'Collect 200 coins' })).not.toHaveAttribute('aria-busy', 'true');
  });

  it('says so when nothing could carry the command, and flies no coins', async () => {
    const { game, container } = show(rewardWorld());
    vi.mocked(game.session.command).mockReturnValue(null);
    await userEvent.click(screen.getByRole('button', { name: 'Collect 200 coins' }));
    expect(screen.getByRole('status')).toHaveTextContent("That can't be done just now");
    expect(flights(container)).toHaveLength(0);
  });

  it('sends one collect for a double tap while the first is on its way', async () => {
    const { game } = show(rewardWorld());
    collectsAs(game, 5);
    const bubble = screen.getByRole('button', { name: 'Collect 200 coins' });
    await userEvent.click(bubble);
    await userEvent.click(bubble);
    expect(game.session.command).toHaveBeenCalledTimes(1);
  });

  it('drops the coin flight after a moment', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { game, container } = show(rewardWorld());
    collectsAs(game, 5);
    await userEvent.click(screen.getByRole('button', { name: 'Collect 200 coins' }));
    settle(game, 5, { ok: true });
    expect(flights(container).length).toBeGreaterThan(0);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(flights(container)).toHaveLength(0);
  });

  it('shows no reward on a visit: only the owner collects', () => {
    show(rewardWorld(), false);
    expect(screen.queryByRole('button', { name: /Collect/ })).not.toBeInTheDocument();
  });
});

describe('following the camera and zoom', () => {
  function farmAndReward() {
    const world = aliceWorld();
    add(world, 'farm', (b) => {
      b.conditions = ['no-workers'];
    });
    add(world, 'cottage', (b) => {
      b.x = 20;
      b.home!.unmetNeeds = ['water'];
    });
    islandOf(world).rewards = ['first-residents'] as GoalId[];
    return world;
  }

  it('moves a bubble on the screen as the camera moves', async () => {
    const { game } = show(farmAndReward());
    const bubble = screen.getByRole('button', { name: 'Farm: No workers' });
    const before = bubble.style.transform;
    expect(before).toMatch(/translate/);
    act(() => game.store.getState().cameraGesture({ kind: 'fly-to', x: 154, z: 214, instant: true }));
    await waitFor(() => expect(bubble.style.transform).not.toBe(before));
  });

  it('hides a bubble whose building is off screen', async () => {
    const { game } = show(farmAndReward());
    const bubble = screen.getByRole('button', { name: 'Farm: No workers' });
    expect(bubble.style.visibility).not.toBe('hidden');
    act(() => game.store.getState().cameraGesture({ kind: 'fly-to', x: 120, z: 120, distance: 12, instant: true }));
    await waitFor(() => expect(screen.getByLabelText('Farm: No workers').style.visibility).toBe('hidden'));
  });

  it('shows every kind up close', () => {
    show(farmAndReward());
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('data-kind')).sort()).toEqual(['problem', 'reward', 'wish']);
  });

  it('shrinks to dots with only problems when zoomed out to the whole island, and comes back when zoomed in', async () => {
    const { game } = show(farmAndReward());
    act(() => game.store.getState().cameraGesture({ kind: 'fly-to', x: 128, z: 214, distance: ISLAND_LIMITS.maxDistance, instant: true }));
    await waitFor(() => expect(screen.getAllByRole('button')).toHaveLength(1));
    const dot = screen.getByRole('button', { name: 'Farm: No workers' });
    expect(dot).toHaveAttribute('data-detail', 'dots');
    act(() => game.store.getState().cameraGesture({ kind: 'fly-to', x: 128, z: 220, distance: 110, instant: true }));
    await waitFor(() => expect(screen.getAllByRole('button')).toHaveLength(3));
    expect(screen.getByRole('button', { name: 'Farm: No workers' })).toHaveAttribute('data-detail', 'full');
  });
});

describe('what the player sees', () => {
  it('has no emoji or emoji-like symbol in any bubble', () => {
    const world = aliceWorld();
    add(world, 'farm', (b) => {
      b.conditions = ['no-workers'];
    });
    add(world, 'cottage', (b) => {
      b.x = 20;
      b.home!.unmetNeeds = ['food'];
    });
    islandOf(world).rewards = ['first-residents'] as GoalId[];
    const { container } = show(world);
    expectNoEmoji(container);
  });

});
