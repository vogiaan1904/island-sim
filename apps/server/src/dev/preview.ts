import { networkInterfaces } from 'node:os';
import { content } from '@island/content';
import { hashPassword } from '../accounts/passwords.ts';
import { DEFAULT_CONFIG } from '../config.ts';
import { startServer } from '../server.ts';
import { previewVillage } from './village.ts';

// pnpm preview [minute-of-day]: a throwaway server (in memory, nothing saved) with the built client and one prepared
// village, for looking at the living island without growing one for hours: the look check, the phone measurement,
// screenshots. Sign in as alice / password-1 at the printed address. The village (`previewVillage` in village.ts, which
// lists what it holds) starts at the given minute of its second day (default 415, five game minutes before the day
// shift).
// Build the client first: pnpm client:build. With --lan it also listens on this machine's local network address, so a
// phone on the same Wi-Fi can open it (plain http: the browser then allows no Wake Lock); without it, only this machine.

const PORT = 8795;
const USERNAME = 'alice';
const PASSWORD = 'password-1';

const args = process.argv.slice(2);
const lan = args.includes('--lan');
const minute = Number(args.find((a) => a !== '--lan') ?? 415);
if (!Number.isInteger(minute) || minute < 0 || minute >= content.rules.ticksPerDay) {
  throw new Error(`preview: the minute of day must be a whole number from 0 to ${content.rules.ticksPerDay - 1}`);
}

/** This machine's first IPv4 address on the local network, for --lan. */
function lanAddress(): string {
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list ?? []) if (net.family === 'IPv4' && !net.internal) return net.address;
  }
  throw new Error('preview: no local network address found for --lan');
}

const address = lan ? lanAddress() : '127.0.0.1';
const server = await startServer({
  ...DEFAULT_CONFIG,
  host: lan ? '0.0.0.0' : '127.0.0.1',
  port: PORT,
  adminPort: 0,
  origin: `http://${address}:${PORT}`,
  databasePath: ':memory:',
  backupDir: null,
  secureCookies: false,
});
const account = server.accounts.newAccount(USERNAME, await hashPassword(PASSWORD));
server.accounts.store.insertAccount(account);
const created = server.worlds.create(account.id, 'Palm Cove', 42);
if (!created.ok) throw new Error(`preview: ${created.reason}`);

const world = created.runtime.world;
previewVillage(world, minute);
// A world normally starts at tick 0, and its ticks are due from the moment it was made; this one starts later in the
// day, so its clock is anchored to now at that tick. A dev-only reach into the runtime: nothing in the game does this.
(created.runtime as unknown as { setAnchor(tick: number, ms: number): void }).setAnchor(world.tick, Date.now());

console.log(`preview: http://${address}:${PORT}  sign in as ${USERNAME} / ${PASSWORD}  (game minute ${minute}; Ctrl-C to stop)`);
