import { createContext, useContext, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { createApi } from '../connection/api.ts';
import { createGameClock, type GameClock } from '../glide/clock.ts';
import { createGameStore, type GameState, type GameStore } from '../store/store.ts';
import { createSession, pageServices, type Session } from './session.ts';

/** Everything a running game holds: the one store, the session that feeds it, and the gliding clock. */
export interface Game {
  store: GameStore;
  session: Session;
  clock: GameClock;
}

/** The game of a real page, talking to the server it was served from. */
export function createPageGame(): Game {
  const store = createGameStore();
  const clock = createGameClock();
  const session = createSession(store, clock, pageServices(createApi()));
  return { store, session, clock };
}

const GameContext = createContext<Game | null>(null);

export function GameProvider({ game, children }: { game: Game; children: ReactNode }) {
  return <GameContext.Provider value={game}>{children}</GameContext.Provider>;
}

export function useGame(): Game {
  const game = useContext(GameContext);
  if (game === null) throw new Error('useGame needs a GameProvider');
  return game;
}

/**
 * Reads the store and re-renders when the selected value changes. Select plain values or references the store keeps
 * (the island state), never a new array or object per call. The frame loop reads `useGame().store.getState()` instead.
 */
export function useGameState<T>(select: (state: GameState) => T): T {
  return useStore(useGame().store, select);
}
