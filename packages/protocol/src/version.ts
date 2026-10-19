/** Bump for any change an older client or server would misread; the client's first message carries it (spec 5.3). */
export const PROTOCOL_VERSION = 1;

/**
 * Real milliseconds per tick (one game minute). A constant both sides build on: the server ticks every worlds at this
 * pace and the client's gliding clock glides one tick over this long. It is not a message, so changing it is not a
 * protocol change by itself.
 */
export const TICK_MS = 2_500;

/**
 * WebSocket close codes the server uses (4000 to 4999 are free for applications). A connection that cannot keep up or
 * stops answering pings is dropped without a close frame (the client sees 1006) and reconnects for a fresh full state.
 */
export const CLOSE_CODES = {
  /** The server is stopping: reconnect with backoff. */
  shuttingDown: 1001,
  /** The client's protocol version differs: reload the app. */
  updateRequired: 4001,
  /** The first message was not a hello, or none came in time. */
  badHello: 4002,
  /** The session ended: logged out, password changed or reset. */
  sessionEnded: 4003,
  /** A message that is not JSON. */
  badData: 4005,
} as const;
