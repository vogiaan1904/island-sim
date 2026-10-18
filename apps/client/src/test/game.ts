import { vi } from 'vitest';
import { createGameClock } from '../glide/clock.ts';
import type { Game } from '../session/game.tsx';
import type { SessionPhase } from '../store/store.ts';
import { createGameStore } from '../store/store.ts';

/** A game for component tests: a real store in the given phase, a session whose actions are spies, a real clock. */
export function stubGame(phase: SessionPhase = 'checking'): Game {
  const store = createGameStore();
  store.getState().setSession({ phase });
  const session = {
    start: vi.fn(async () => {}),
    logIn: vi.fn(async () => null),
    register: vi.fn(async () => null),
    createWorld: vi.fn(async () => null),
    joinWorld: vi.fn(async () => null),
    openWorld: vi.fn(),
    showWorlds: vi.fn(async () => {}),
    regenerateInvite: vi.fn(async () => null),
    logOut: vi.fn(async () => null),
    command: vi.fn(() => null),
    stop: vi.fn(),
  };
  return { store, session, clock: createGameClock() };
}
