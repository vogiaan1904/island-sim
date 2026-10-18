import type { AccountInfo, ApiReason, MeResponse } from '@island/protocol';

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
  /** Any other route, for the screens that come later (register, worlds, invite, logout, password). */
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
    request,
  };
}
