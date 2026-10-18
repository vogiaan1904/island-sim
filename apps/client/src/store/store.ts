import type { AccountInfo, PlayerCommand, ServerMessage, WorldInfo } from '@island/protocol';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { applyMessage, commandSent, initialClientState, type ClientState } from './mirror.ts';
import type { ViewState } from './view.ts';

/**
 * Where the player is on the way to their island. 'checking' asks /api/me; 'opening' has a socket and waits for the
 * island's full state; 'playing' shows it; 'worlds' is the world screen (pick, create or join a world, share the invite
 * code), shown when the player has no island or several worlds, and when they ask for it. Later tickets add phases here.
 */
export type SessionPhase = 'checking' | 'signed-out' | 'worlds' | 'opening' | 'playing' | 'update-required';

export interface SessionState {
  phase: SessionPhase;
  account: AccountInfo | null;
  worlds: readonly WorldInfo[];
}

/** The store's actions. Island data changes only through `receive`; nothing else writes the mirror. */
export interface GameActions {
  /** One server message, through the pure `applyMessage`. */
  receive(message: ServerMessage): void;
  /** A command just sent with this request id; pending until its result. */
  commandSent(requestId: number, command: PlayerCommand): void;
  /** The player left the island (to the world screen or out of the game): no mirror, no pending commands. */
  clearIsland(): void;
  setView(patch: Partial<ViewState>): void;
  setSession(patch: Partial<SessionState>): void;
}

export type GameState = ClientState & { session: SessionState } & GameActions;
export type GameStore = StoreApi<GameState>;

/** The one client store: the island mirror, the view state beside it, and the session. */
export function createGameStore(): GameStore {
  return createStore<GameState>()((set) => ({
    ...initialClientState(),
    session: { phase: 'checking', account: null, worlds: [] },
    receive: (message) => set((state) => applyMessage(state, message)),
    commandSent: (requestId, command) => set((state) => commandSent(state, requestId, command)),
    clearIsland: () => set({ island: null, commands: {} }),
    setView: (patch) => set((state) => ({ view: { ...state.view, ...patch } })),
    setSession: (patch) => set((state) => ({ session: { ...state.session, ...patch } })),
  }));
}
