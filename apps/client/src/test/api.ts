import type { AccountInfo, InviteResponse, JoinedResponse, MeResponse, WorldInfo } from '@island/protocol';
import { vi } from 'vitest';
import type { Api, ApiResult, ClientApiReason } from '../connection/api.ts';
import { createGameClock } from '../glide/clock.ts';
import { createSession } from '../session/session.ts';
import type { Game } from '../session/game.tsx';
import { createGameStore } from '../store/store.ts';

// A stubbed HTTP API for component tests, typed with the protocol's response types, plus a game made from it: the
// real store and session over the stub, and a socket that never answers (the island itself is not under test).

export const LENA: AccountInfo = { id: 'id-lena', username: 'Lena' };

export function world(overrides: Partial<WorldInfo> = {}): WorldInfo {
  return { id: 'w1', slot: 0, islandName: 'Palm Cove', creator: 'Lena', inviteCode: 'ABCDEFGHJK', status: 'running', islands: [], ...overrides };
}

export const ok = <T>(value: T): ApiResult<T> => ({ ok: true, value });
export const refused = (reason: ClientApiReason, status = 400): ApiResult<never> => ({ ok: false, reason, status });

export interface StubApi extends Api {
  me: ReturnType<typeof vi.fn<Api['me']>>;
  login: ReturnType<typeof vi.fn<Api['login']>>;
  register: ReturnType<typeof vi.fn<Api['register']>>;
  logout: ReturnType<typeof vi.fn<Api['logout']>>;
  createWorld: ReturnType<typeof vi.fn<Api['createWorld']>>;
  joinWorld: ReturnType<typeof vi.fn<Api['joinWorld']>>;
  regenerateInvite: ReturnType<typeof vi.fn<Api['regenerateInvite']>>;
}

/** An API where nobody is signed in until `login` or `register` works; each method is a spy to override per test. */
export function stubApi(): StubApi {
  let signedIn: MeResponse | null = null;
  const joined = (account: AccountInfo, added: WorldInfo): ApiResult<JoinedResponse> => {
    signedIn = { account, worlds: [...(signedIn?.worlds ?? []), added] };
    return ok({ account, world: added });
  };
  return {
    me: vi.fn<Api['me']>(async () => (signedIn === null ? refused('not-signed-in', 401) : ok(signedIn))),
    login: vi.fn<Api['login']>(async () => {
      signedIn = { account: LENA, worlds: signedIn?.worlds ?? [] };
      return ok({ account: LENA });
    }),
    register: vi.fn<Api['register']>(async (request) => joined({ id: 'id-new', username: request.username }, world({ id: 'w-new', islandName: request.islandName, creator: 'Omar', inviteCode: null }))),
    logout: vi.fn<Api['logout']>(async () => {
      signedIn = null;
      return ok({ ok: true as const });
    }),
    createWorld: vi.fn<Api['createWorld']>(async (islandName) => joined(signedIn?.account ?? LENA, world({ id: `w-${islandName}`, islandName }))),
    joinWorld: vi.fn<Api['joinWorld']>(async (_code, islandName) => joined(signedIn?.account ?? LENA, world({ id: `w-${islandName}`, islandName, creator: 'Omar', inviteCode: null }))),
    regenerateInvite: vi.fn<Api['regenerateInvite']>(async () => ok<InviteResponse>({ inviteCode: 'NEWCODE123' })),
    request: vi.fn(async () => refused('not-found', 404)),
  } as StubApi;
}

/** Puts a signed-in account with these worlds behind the stub, as if the player had logged in on this device. */
export async function signInOn(api: StubApi, worlds: WorldInfo[]): Promise<void> {
  api.me.mockImplementation(async () => ok({ account: LENA, worlds }));
}

/** The real store and session over a stub API; sockets are created and never answer. */
export function gameOn(api: StubApi) {
  const store = createGameStore();
  const clock = createGameClock();
  const sockets: object[] = [];
  const session = createSession(store, clock, {
    api,
    openSocket: () => {
      const socket = { close: vi.fn(), send: vi.fn(), readyState: 0 };
      sockets.push(socket);
      return socket as unknown as WebSocket;
    },
    socketUrl: 'ws://game.test/ws',
    now: () => 0,
  });
  const game: Game = { store, session, clock };
  return { game, sockets };
}
