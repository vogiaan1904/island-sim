import { content } from '@island/content';
import type { IslandSummary } from '@island/protocol';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ISLAND_LIMITS } from '../../camera/limits.ts';
import { createCamera } from '../../camera/controller.ts';
import { GameProvider, type Game } from '../../session/game.tsx';
import { startDraft } from '../../placement/draft.ts';
import { stubGame } from '../../test/game.ts';
import { aliceWorld, islandMessage } from '../../test/islands.ts';
import { expectNoEmoji } from '../../test/no-emoji.ts';
import { Hud } from '../hud/Hud.tsx';
import { PlacementPanel } from '../build/PlacementPanel.tsx';
import { Arrival, ARRIVAL_FADE_MS, FLIGHT_DELAY_MS } from './Arrival.tsx';
import { VisitBanner } from './VisitBanner.tsx';

const islands: IslandSummary[] = [
  { slot: 0, name: 'Palm Cove', owner: 'alice', stage: 'outpost', residents: 0 },
  { slot: 1, name: 'Coral Bay', owner: 'bob', stage: 'outpost', residents: 0 },
];

/** A game showing slot 0 of Alice's world, as a visit (Bob's island, read-only) or at home. */
function gameAt(visiting: boolean): Game {
  const game = stubGame('playing');
  game.store.getState().receive({ ...islandMessage(aliceWorld()), own: !visiting, summary: { islands } });
  return game;
}

function renderWith(game: Game, ...children: React.ReactNode[]) {
  return render(<GameProvider game={game}>{children}</GameProvider>);
}

afterEach(() => {
  vi.useRealTimers();
});

describe('the visit banner', () => {
  it('says whose island it is and the island name, and has a Home button', async () => {
    const game = gameAt(true);
    renderWith(game, <VisitBanner />);
    expect(screen.getByRole('status')).toHaveTextContent('Visiting');
    expect(screen.getByRole('status')).toHaveTextContent('Palm Cove');
    expect(screen.getByRole('status')).toHaveTextContent("alice's island");
    await userEvent.click(screen.getByRole('button', { name: 'Home' }));
    expect(game.session.home).toHaveBeenCalledOnce();
  });

  it('is not there at home', () => {
    const { container } = renderWith(gameAt(false), <VisitBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('draws the Home button as an icon with a name and shows no emoji', () => {
    const { container } = renderWith(gameAt(true), <VisitBanner />);
    expect(screen.getByRole('button', { name: 'Home' }).querySelector('svg')).not.toBeNull();
    expectNoEmoji(container);
  });
});

describe('the owner controls on a visit', () => {
  const OWNER_BUTTONS = ['Build', 'Staff', 'Trade', 'Log'];

  function show(visiting: boolean) {
    const game = gameAt(visiting);
    const view = renderWith(game, <Hud />, <PlacementPanel />, <VisitBanner />);
    return { game, ...view };
  }

  it('hides Build, Staff, Trade and Log and the goals, and keeps Settings and the compass', () => {
    show(true);
    for (const name of OWNER_BUTTONS) expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Goals' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
  });

  it('shows all of them at home, and no Home button', () => {
    show(false);
    for (const name of OWNER_BUTTONS) expect(screen.getByRole('button', { name })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Home' })).not.toBeInTheDocument();
  });

  it('shows no owner panel even when one was left open, nor the placement panel with a leftover draft', () => {
    const game = gameAt(true);
    game.store.getState().setView({
      openPanel: 'build',
      placement: startDraft('farm', { x: 14, y: 14 }, content),
    });
    renderWith(game, <Hud />, <PlacementPanel />);
    expect(screen.queryByRole('region', { name: 'Build' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Place' })).not.toBeInTheDocument();
  });

  it('still opens the Settings panel, which is the visitor\'s own account', async () => {
    const { game } = show(true);
    await userEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(game.store.getState().view.openPanel).toBe('settings');
    expect(screen.getByRole('region', { name: 'Settings' })).toBeInTheDocument();
  });

  it('shows no stage celebration for the friend\'s stage', () => {
    const game = gameAt(true);
    renderWith(game, <Hud />);
    act(() =>
      game.store.getState().receive({
        type: 'update',
        world: 'w-test',
        tick: 99,
        source: 0,
        changed: [],
        removed: [],
        events: [{ tick: 99, source: 0, index: 0, type: 'stage-reached', slot: 0, data: { stage: 'settlement' } }],
      }),
    );
    expect(screen.queryByText(/settlement/i, { selector: '.celebrate *' })).not.toBeInTheDocument();
    expect(document.querySelector('.celebrate')).toBeNull();
  });
});

describe('arriving on an island', () => {
  it('fades in and flies the camera in from far away when a visit begins, then stops marking it', () => {
    vi.useFakeTimers();
    const game = gameAt(true);
    game.store.getState().setSession({ arriving: 'visit' });
    renderWith(game, <Arrival />);
    const camera = () => game.store.getState().view.camera;
    expect(document.querySelector('.arrival-fade')).not.toBeNull();
    expect(camera().distance).toBe(ISLAND_LIMITS.maxDistance);
    expect(camera().x).toBe(ISLAND_LIMITS.center.x);
    const jumps = camera().jumps;

    act(() => vi.advanceTimersByTime(FLIGHT_DELAY_MS));
    expect(camera().distance).toBe(ISLAND_LIMITS.startDistance);
    expect(camera().jumps).toBe(jumps);

    act(() => vi.advanceTimersByTime(ARRIVAL_FADE_MS));
    expect(document.querySelector('.arrival-fade')).toBeNull();
    expect(game.store.getState().session.arriving).toBeNull();
  });

  it('does nothing on a plain open of the own island', () => {
    const game = gameAt(false);
    const before = game.store.getState().view.camera;
    renderWith(game, <Arrival />);
    expect(document.querySelector('.arrival-fade')).toBeNull();
    expect(game.store.getState().view.camera).toBe(before);
    expect(before).toEqual(createCamera(ISLAND_LIMITS));
  });

  it('waits for the island of the trip: a visit marker does not fire on the old own island', () => {
    vi.useFakeTimers();
    const game = gameAt(false);
    game.store.getState().setSession({ arriving: 'visit' });
    renderWith(game, <Arrival />);
    expect(document.querySelector('.arrival-fade')).toBeNull();
    expect(game.store.getState().session.arriving).toBe('visit');
    act(() => game.store.getState().receive({ ...islandMessage(aliceWorld(), 0, 'w-test'), own: false, summary: { islands } }));
    expect(document.querySelector('.arrival-fade')).not.toBeNull();
  });

  it('is only a picture: it takes no touches and has no text', () => {
    const game = gameAt(true);
    game.store.getState().setSession({ arriving: 'visit' });
    renderWith(game, <Arrival />);
    const fade = document.querySelector('.arrival-fade');
    expect(fade?.getAttribute('aria-hidden')).toBe('true');
    expect(fade).toBeEmptyDOMElement();
  });
});
