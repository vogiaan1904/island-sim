import type { AccountInfo, ApiReason, InviteResponse, JoinedResponse, MeResponse, RegisterRequest } from '@island/protocol';

// The client side of the server's /api routes. The page is served from the same origin, so the browser sends the
// Origin header and the session cookie by itself. Responses are typed with the protocol's types and checked only as
// far as ok or a failure body; like the socket's messages, they come from our own server.

/** 'unreachable': no answer at all (offline, server down); every other reason is the server's own. */
export type ClientApiReason = ApiReason | 'unreachable';

export type ApiResult<T> = { ok: true; value: T } | { ok: false; reason: ClientApiReason; status: number };

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface Api {
  /** Who is signed in on this device, and the worlds they have an island in. */
  me(): Promise<ApiResult<MeResponse>>;
  /** The username in any letter case; on success the server sets the session cookie. */
  login(username: string, password: string): Promise<ApiResult<{ account: AccountInfo }>>;
  /** A new account with an island in the world the invite code belongs to; on success the session cookie is set. */
  register(request: RegisterRequest): Promise<ApiResult<JoinedResponse>>;
  /** Ends this device's session only. */
  logout(): Promise<ApiResult<{ ok: true }>>;
  /** A new world; the island name is the creator's own island in it. */
  createWorld(islandName: string): Promise<ApiResult<JoinedResponse>>;
  /** An island in the world the invite code belongs to. */
  joinWorld(inviteCode: string, islandName: string): Promise<ApiResult<JoinedResponse>>;
  /** A new invite code for a world the account created; the old one stops working. */
  regenerateInvite(world: string): Promise<ApiResult<InviteResponse>>;
  /** Any other route, for the screens that come later (password). */
  request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<ApiResult<T>>;
}

function isApiReason(value: unknown): value is ApiReason {
  return typeof value === 'string' && value !== '';
}

export function createApi(fetchFn: FetchLike = (input, init) => fetch(input, init)): Api {
  const request = async <T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<ApiResult<T>> => {
    const init: RequestInit = { method, credentials: 'same-origin', headers: { 'content-type': 'application/json' } };
    if (body !== undefined) init.body = JSON.stringify(body);
    let res: Response;
    let parsed: unknown;
    try {
      res = await fetchFn(path, init);
      const text = await res.text();
      parsed = text === '' ? null : JSON.parse(text);
    } catch {
      return { ok: false, reason: 'unreachable', status: 0 };
    }
    if (res.ok) return { ok: true, value: parsed as T };
    const error = (parsed as { error?: unknown } | null)?.error;
    return { ok: false, reason: isApiReason(error) ? error : 'server-error', status: res.status };
  };
  return {
    me: () => request<MeResponse>('GET', '/api/me'),
    login: (username, password) => request<{ account: AccountInfo }>('POST', '/api/login', { username, password }),
    register: (body) => request<JoinedResponse>('POST', '/api/register', body),
    logout: () => request<{ ok: true }>('POST', '/api/logout', {}),
    createWorld: (islandName) => request<JoinedResponse>('POST', '/api/worlds', { islandName }),
    joinWorld: (inviteCode, islandName) => request<JoinedResponse>('POST', '/api/worlds/join', { inviteCode, islandName }),
    regenerateInvite: (world) => request<InviteResponse>('POST', '/api/worlds/invite', { world }),
    request,
  };
}
