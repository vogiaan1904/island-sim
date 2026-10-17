/** Operations log. Never put passwords, session tokens, cookies, reset codes or invite codes in it. */
export interface Log {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

/** One JSON line per entry: info to stdout, warnings and errors to stderr. */
export const consoleLog: Log = {
  info: (message, fields) => console.log(line('info', message, fields)),
  warn: (message, fields) => console.error(line('warn', message, fields)),
  error: (message, fields) => console.error(line('error', message, fields)),
};

function line(level: string, message: string, fields: Record<string, unknown> = {}): string {
  return JSON.stringify({ time: new Date().toISOString(), level, message, ...fields });
}
