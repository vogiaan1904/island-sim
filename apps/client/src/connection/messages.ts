import type { ServerMessage } from '@island/protocol';

// The protocol types the server's messages but ships no schema for them (the client trusts its own server, and the
// protocol version catches a mismatch). So a frame is checked only as far as its `type`, then typed as the protocol's.

const SERVER_TYPES: ReadonlySet<string> = new Set<ServerMessage['type']>([
  'welcome',
  'update-required',
  'island',
  'update',
  'status',
  'result',
  'error',
]);

/** A server frame as a protocol message, or null for anything that is not JSON of a known message type. */
export function parseServerMessage(data: unknown): ServerMessage | null {
  if (typeof data !== 'string') return null;
  let value: unknown;
  try {
    value = JSON.parse(data);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const type = (value as { type?: unknown }).type;
  return typeof type === 'string' && SERVER_TYPES.has(type) ? (value as ServerMessage) : null;
}
