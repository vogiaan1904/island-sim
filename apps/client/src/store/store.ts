import type { AccountInfo, PlayerCommand, ServerMessage, WorldInfo } from '@island/protocol';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { applyGesture, step, type Gesture } from '../camera/controller.ts';
import { ISLAND_LIMITS } from '../camera/limits.ts';
import { applyMessage, commandSent, commandsLost, initialClientState, type ClientState } from './mirror.ts';
import type { ViewState } from './view.ts';

/**
 * Where the player is on the way to their island. 'checking' asks /api/me; 'opening' has a socket and waits for the
 * island's full state; 'playing' shows it; 'worlds' is the world screen (pick, create or join a world, share the invite
 * code), shown when the player has no island or several worlds, and when they ask for it; 'resting' is a world that
 * could not be loaded (it is opened again by itself until it is back). Later tickets add phases here.
 */
export type SessionPhase = 'checking' | 'signed-out' | 'worlds' | 'opening' | 'playing' | 'update-required' | 'resting';

export interface SessionState {
  phase: SessionPhase;
  account: AccountInfo | null;
  worlds: readonly WorldInfo[];
  /**
   * True from a dropped connection until the new full state arrives. The island stays in the mirror and on screen
   * meanwhile; the UI only adds a small calm line and sends no commands.
   */
  reconnecting: boolean;
}

/** The store's actions. Island data changes only through `receive`; nothing else writes the mirror. */
export interface GameActions {
  /** One server message, through the pure `applyMessage`. */
  receive(message: ServerMessage): void;
  /** A command just sent with this request id; pending until its result. */
  commandSent(requestId: number, command: PlayerCommand): void;
  /** The player left the island (to the world screen or out of the game): no mirror, no pending commands. */
  clearIsland(): void;
  /** The connection dropped: commands still waiting for a result will never get one, so they are forgotten. */
  commandsLost(): void;
  setView(patch: Partial<ViewState>): void;
  /** One camera gesture through the pure controller: input, the compass, "Show me" flights (`{ kind: 'fly-to', ... }`). */
  cameraGesture(gesture: Gesture): void;
  /** Momentum for `dt` seconds; the camera rig calls it every frame, and it does nothing at rest. */
  cameraStep(dt: number): void;
  setSession(patch: Partial<SessionState>): void;
}

export type GameState = ClientState & { session: SessionState } & GameActions;
export type GameStore = StoreApi<GameState>;

/** The one client store: the island mirror, the view state beside it, and the session. */
export function createGameStore(): GameStore {
  return createStore<GameState>()((set) => ({
    ...initialClientState(),
    session: { phase: 'checking', account: null, worlds: [], reconnecting: false },
    receive: (message) => set((state) => applyMessage(state, message)),
    commandSent: (requestId, command) => set((state) => commandSent(state, requestId, command)),
    clearIsland: () => set({ island: null, commands: {} }),
    commandsLost: () => set((state) => commandsLost(state)),
    setView: (patch) => set((state) => ({ view: { ...state.view, ...patch } })),
    cameraGesture: (gesture) =>
      set((state) => ({ view: { ...state.view, camera: applyGesture(state.view.camera, gesture, ISLAND_LIMITS) } })),
    cameraStep: (dt) =>
      set((state) => {
        const camera = step(state.view.camera, dt, ISLAND_LIMITS);
        return camera === state.view.camera ? state : { view: { ...state.view, camera } };
      }),
    setSession: (patch) => set((state) => ({ session: { ...state.session, ...patch } })),
  }));
}
