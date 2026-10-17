export interface ServerConfig {
  /** Address the game listens on; HTTPS is terminated by the reverse proxy in front (spec 5.4, 5.5). */
  host: string;
  /** 0 picks a free port (tests). */
  port: number;
  /** The admin interface always listens on 127.0.0.1 only (spec 12.3). 0 picks a free port. */
  adminPort: number;
  /** The game's own origin as browsers send it, e.g. https://island.example: the Origin check compares to it. */
  origin: string;
  /** The SQLite file, or ':memory:' (tests). */
  databasePath: string;
  /** Where the daily backups go; null turns them off. */
  backupDir: string | null;
  /** 2.5 s per tick, the same for every world (spec 4.1). */
  tickMs: number;
  /** A snapshot of each world this often, in real time (spec 12.3: every 5 minutes, configurable for tests). */
  snapshotMs: number;
  backupMs: number;
  /** The most ticks a world runs to catch up after downtime or a pause: 24 real hours (spec 12.3). */
  catchUpCapTicks: number;
  /** Secure cookies need HTTPS; turn this off only to develop over plain HTTP. */
  secureCookies: boolean;
  /** Take the client's address from X-Forwarded-For; only behind a reverse proxy you run, which sets it. */
  trustProxy: boolean;
  /** Ping every connection this often; one that has not answered the last ping is closed. */
  heartbeatMs: number;
  /** A connection must say hello within this time. */
  helloTimeoutMs: number;
}

export const DEFAULT_CONFIG: ServerConfig = {
  host: '127.0.0.1',
  port: 8787,
  adminPort: 8788,
  origin: 'http://localhost:8787',
  databasePath: 'data/island.sqlite',
  backupDir: 'data/backups',
  tickMs: 2_500,
  snapshotMs: 5 * 60_000,
  backupMs: 24 * 60 * 60_000,
  catchUpCapTicks: 34_560,
  secureCookies: true,
  trustProxy: false,
  heartbeatMs: 30_000,
  helloTimeoutMs: 5_000,
};

/** The deployment settings from ISLAND_* environment variables; the game's timings are fixed. */
export function configFromEnv(env: Record<string, string | undefined>): ServerConfig {
  const config = { ...DEFAULT_CONFIG };
  if (env.ISLAND_HOST) config.host = env.ISLAND_HOST;
  if (env.ISLAND_PORT) config.port = port(env.ISLAND_PORT, 'ISLAND_PORT');
  if (env.ISLAND_ADMIN_PORT) config.adminPort = port(env.ISLAND_ADMIN_PORT, 'ISLAND_ADMIN_PORT');
  if (env.ISLAND_ORIGIN) config.origin = new URL(env.ISLAND_ORIGIN).origin;
  if (env.ISLAND_DB) config.databasePath = env.ISLAND_DB;
  if (env.ISLAND_BACKUP_DIR !== undefined) config.backupDir = env.ISLAND_BACKUP_DIR === '' ? null : env.ISLAND_BACKUP_DIR;
  if (env.ISLAND_SECURE_COOKIES === '0') config.secureCookies = false;
  if (env.ISLAND_TRUST_PROXY === '1') config.trustProxy = true;
  return config;
}

function port(text: string, name: string): number {
  const value = Number(text);
  if (!Number.isInteger(value) || value < 0 || value > 65_535) throw new Error(`${name} must be a port number`);
  return value;
}
