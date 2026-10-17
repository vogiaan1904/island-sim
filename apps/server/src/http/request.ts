import type { IncomingMessage, ServerResponse } from 'node:http';
import { SESSION_MS } from '../accounts/accounts.ts';

// Small HTTP helpers for the account endpoints and the WebSocket upgrade.

export const SESSION_COOKIE = 'island_session';

/** Request bodies are small JSON objects. */
const MAX_BODY_BYTES = 4_096;

export type Body = { ok: true; value: unknown } | { ok: false; reason: 'too-large' | 'bad-request' };

export async function readJson(req: IncomingMessage): Promise<Body> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > MAX_BODY_BYTES) return { ok: false, reason: 'too-large' };
    chunks.push(buffer);
  }
  try {
    return { ok: true, value: JSON.parse(Buffer.concat(chunks).toString('utf8')) };
  } catch {
    return { ok: false, reason: 'bad-request' };
  }
}

export function sendJson(res: ServerResponse, status: number, body: unknown, cookie?: string): void {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'cache-control': 'no-store' };
  if (cookie !== undefined) headers['set-cookie'] = cookie;
  res.writeHead(status, headers).end(JSON.stringify(body));
}

export function cookieValue(req: IncomingMessage, name: string): string | null {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

/** The session cookie (spec 5.4): httpOnly, Secure over HTTPS, sent to this site only, for the 90 days a session lasts. */
export function sessionCookie(token: string, secure: boolean): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MS / 1_000}${secure ? '; Secure' : ''}`;
}

export function clearedSessionCookie(secure: boolean): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`;
}

/** The client's address; X-Forwarded-For only counts behind a reverse proxy we run, which appends the real one. */
export function clientIp(req: IncomingMessage, trustProxy: boolean): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (trustProxy && typeof forwarded === 'string') {
    const last = forwarded.split(',').at(-1)?.trim();
    if (last) return last;
  }
  return req.socket.remoteAddress ?? 'unknown';
}

/** Requests that change something, and the WebSocket upgrade, must come from the game's own pages (spec 12.3). */
export function fromOrigin(req: IncomingMessage, origin: string): boolean {
  return req.headers.origin === origin;
}
