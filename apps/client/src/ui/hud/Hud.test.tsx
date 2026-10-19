import { content } from '@island/content';
import { newBuilding, type WorldState } from '@island/sim';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TICK_MS } from '../../glide/clock.ts';
import { GameProvider, type Game } from '../../session/game.tsx';
import { stubGame } from '../../test/game.ts';
import { aliceWorld, islandMessage, islandOf } from '../../test/islands.ts';
import { expectNoEmoji } from '../../test/no-emoji.ts';
import { PanelHost } from '../PanelHost.tsx';
import { Hud } from './Hud.tsx';

function worldWith(change: (world: WorldState) => void): WorldState {
  const world = aliceWorld();
  change(world);
  return world;
}

function show(world: WorldState = aliceWorld()) {
  const game = stubGame('playing');
  game.store.getState().receive(islandMessage(world));
  const view = render(
    <GameProvider game={game}>
      <Hud />
    </GameProvider>,
  );
  return { game, ...view };
}

/** The message a later tick would bring: the same island with these changes. */
function arrive(game: Game, world: WorldState) {
  act(() => game.store.getState().receive(islandMessage(world)));
}

const counter = (name: RegExp) => screen.getByRole('group', { name });

function addHome(world: WorldState, residents: number, unmet: Array<'food' | 'water'> = []) {
  const island = islandOf(world);
  const def = content.buildings.find((b) => b.id === 'cottage');
  if (def === undefined) throw new Error('cottage');
  const home = { ...newBuilding(def, 100 + island.buildings.length, 0, 0, 0), constructionLeft: 0 };
  if (home.home !== null) {
    home.home.residents = residents;
    home.home.unmetNeeds = unmet;
  }
  island.buildings.push(home);
}

afterEach(() => {
  vi.useRealTimers();
});

describe('the HUD', () => {
  it('draws nothing before an island is open', () => {
    const game = stubGame('opening');
    const { container } = render(
      <GameProvider game={game}>
        <Hud />
      </GameProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the stage name, whole coins and residents from the store state', () => {
    show(
      worldWith((world) => {
        islandOf(world).coinsCents = 1_248_099;
        addHome(world, 4);
        addHome(world, 3);
      }),
    );
    expect(screen.getByText('Outpost')).toBeInTheDocument();
    expect(counter(/^Coins/)).toHaveTextContent('12,480');
    expect(counter(/^Residents/)).toHaveTextContent('7');
  });

  it('shows the commuters counter during Outpost only', () => {
    const world = worldWith((w) => {
      islandOf(w).commuters = { hired: 5, present: 4 };
    });
    const { game } = show(world);
    expect(counter(/^Commuters/)).toHaveTextContent('4');
    islandOf(world).stage = 'settlement';
    arrive(game, world);
    expect(screen.queryByRole('group', { name: /^Commuters/ })).not.toBeInTheDocument();
    expect(screen.getByText('Settlement')).toBeInTheDocument();
  });

  it('glides the counters to a new value over one tick, with fake timers', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date', 'setTimeout', 'clearTimeout'] });
    const world = worldWith((w) => {
      islandOf(w).coinsCents = 100_000;
    });
    const { game } = show(world);
    expect(counter(/^Coins/)).toHaveTextContent('1,000');
    islandOf(world).coinsCents = 200_000;
    arrive(game, world);
    // It starts from what was shown, then moves, and lands exactly on the new value.
    expect(counter(/^Coins/)).toHaveTextContent('1,000');
    act(() => vi.advanceTimersByTime(TICK_MS / 2));
    const middle = Number((counter(/^Coins/).textContent ?? '').replace(/,/g, ''));
    expect(middle).toBeGreaterThan(1_300);
    expect(middle).toBeLessThan(1_700);
    act(() => vi.advanceTimersByTime(TICK_MS));
    expect(counter(/^Coins/)).toHaveTextContent('2,000');
  });

  it('names the true value for assistive tech while the shown number glides', () => {
    const world = worldWith((w) => {
      islandOf(w).coinsCents = 250_000;
    });
    show(world);
    expect(screen.getByRole('group', { name: 'Coins: 2,500' })).toBeInTheDocument();
  });

  it('draws the stage ring with the residents progress toward the Island Hall', () => {
    show(worldWith((w) => addHome(w, 4)));
    const ring = screen.getByRole('progressbar', { name: 'Progress to the next stage' });
    expect(ring).toHaveAttribute('aria-valuenow', '40');
    expect(ring).toHaveAttribute('data-phase', 'residents');
  });

  it('shows goal icons for the next targets and what homes lack', () => {
    show(worldWith((w) => addHome(w, 2, ['food'])));
    const goals = screen.getByRole('list', { name: 'Goals' });
    const items = within(goals).getAllByRole('listitem');
    expect(items.map((item) => item.getAttribute('aria-label'))).toEqual(['Build a farm', 'Homes need food', 'Have 1 resident']);
  });

  it('has the round bottom buttons Staff, Trade, Build and Log, and the Settings gear and compass', () => {
    show();
    const bar = screen.getByRole('toolbar', { name: 'Main actions' });
    expect(within(bar).getAllByRole('button').map((button) => button.textContent)).toEqual(['Staff', 'Trade', 'Build', 'Log']);
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Face north' })).toBeInTheDocument();
  });

  it('has a Watch button but no Views button (slice 3), no player title and no emoji', () => {
    const { container } = show();
    expect(screen.queryByRole('button', { name: /views/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Watch' })).toBeInTheDocument();
    expect(screen.queryByText(/mayor|governor|lord|your highness/i)).not.toBeInTheDocument();
    expectNoEmoji(container);
  });

  it('gives every button an accessible name and an icon drawn as svg', () => {
    show();
    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveAccessibleName();
      expect(button.querySelector('svg')).not.toBeNull();
    }
  });

  it('hides the owner controls and goals on a visit to a friend', () => {
    const world = aliceWorld();
    const game = stubGame('playing');
    game.store.getState().receive({ ...islandMessage(world), own: false });
    render(
      <GameProvider game={game}>
        <Hud />
      </GameProvider>,
    );
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Goals' })).not.toBeInTheDocument();
  });
});

describe('the HUD hooks for the panels', () => {
  it('opens a panel from each bottom button and the gear, one at a time, in view.openPanel', async () => {
    const { game } = show();
    const opened = () => game.store.getState().view.openPanel;
    expect(opened()).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Build' }));
    expect(opened()).toBe('build');
    await userEvent.click(screen.getByRole('button', { name: 'Staff' }));
    expect(opened()).toBe('staff');
    await userEvent.click(screen.getByRole('button', { name: 'Trade' }));
    expect(opened()).toBe('trade');
    await userEvent.click(screen.getByRole('button', { name: 'Log' }));
    expect(opened()).toBe('log');
    await userEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(opened()).toBe('settings');
  });

  it('closes the panel when its own button is tapped again, and marks the open one as selected', async () => {
    const { game } = show();
    const build = screen.getByRole('button', { name: 'Build' });
    expect(build).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(build);
    expect(build).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Staff' })).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(build);
    expect(game.store.getState().view.openPanel).toBeNull();
    expect(build).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows the open panel, empty for now, with a Close button', async () => {
    const { game } = show();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Trade' }));
    const panel = screen.getByRole('region', { name: 'Trade' });
    expect(panel).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole('button', { name: 'Close' }));
    expect(game.store.getState().view.openPanel).toBeNull();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('renders the body registered for the open panel (PANEL_BODIES), under its title', () => {
    const game = stubGame('playing');
    game.store.getState().setView({ openPanel: 'log' });
    render(
      <GameProvider game={game}>
        <PanelHost bodies={{ log: () => <p>History goes here</p> }} />
      </GameProvider>,
    );
    expect(within(screen.getByRole('region', { name: 'Log' })).getByText('History goes here')).toBeInTheDocument();
  });

  it('is closed by another code path through setView, with no button involved', () => {
    const { game } = show();
    act(() => game.store.getState().setView({ openPanel: 'staff' }));
    expect(screen.getByRole('region', { name: 'Staff' })).toBeInTheDocument();
    act(() => game.store.getState().setView({ openPanel: null }));
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });
});
