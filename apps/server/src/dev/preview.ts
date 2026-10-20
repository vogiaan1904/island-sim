import { networkInterfaces } from 'node:os';
import { content, type BuildingId } from '@island/content';
import { applyCommand, buildingDefOf, checkPlacement, roadsFrom, type IslandState, type WorldState } from '@island/sim';
import { hashPassword } from '../accounts/passwords.ts';
import { DEFAULT_CONFIG } from '../config.ts';
import { startServer } from '../server.ts';

// pnpm preview [minute-of-day]: a throwaway server (in memory, nothing saved) with the built client and one prepared
// village, for looking at the living island without growing one for hours: the look check, the phone measurement,
// screenshots. Sign in as alice / password-1 at the printed address. The village is placed with the sim's own
// command next to the dock: a farm and a lumber camp further out, a well, a market with fish, two full cottages, an
// empty one and one still being built (the morning ferry brings newcomers to fill the open jobs), 4 hired commuters and
// one shipment on the road. The world starts at the given minute of its second day (default 415, five game minutes
// before the day shift).
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

/** Places a building as near the dock as it fits, at least `from` tiles away, with the sim's command (which lays its road). */
function place(world: WorldState, island: IslandState, type: BuildingId, from: number, sequence: number): void {
  const dock = island.buildings.find((b) => b.type === 'dock');
  if (!dock) throw new Error('preview: the island has no dock');
  const def = buildingDefOf(content, type);
  for (let r = from; r < 24; r += 1) {
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        const x = dock.x + dx;
        const y = dock.y + dy;
        if (!checkPlacement(island, content, def, x, y, 0).ok) continue;
        if (applyCommand(world, content, { type: 'place-building', slot: island.slot, building: type, x, y, rotation: 0 }, { sequence }).ok) return;
      }
    }
  }
  throw new Error(`preview: no room for a ${type}`);
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
const island = world.islands[0] as IslandState;
island.coinsCents = 50_000_000;
const plan: Array<[BuildingId, number]> = [
  ['farm', 12], ['lumber-camp', 12], ['well', 3], ['market', 3], ['cottage', 3], ['cottage', 3], ['cottage', 3], ['cottage', 3],
];
plan.forEach(([type, from], i) => place(world, island, type, from, 100 + i));
let cottages = 0;
const site = island.buildings.filter((b) => b.type === 'cottage').at(-1);
for (const building of island.buildings) {
  if (building === site) {
    // The last cottage is still being built, half way up its scaffold, with its builders at work.
    building.constructionLeft = Math.ceil(buildingDefOf(content, 'cottage').buildTicks / 2);
    continue;
  }
  building.constructionLeft = 0;
  building.conditions = [];
  if (building.home) Object.assign(building.home, { residents: cottages < 2 ? 4 : 0, happiness: 1000 });
  if (building.home) cottages += 1;
  if (building.type === 'market') building.stock = { fish: 20 };
}
island.commuters.hired = 4;

world.tick = content.rules.ticksPerDay + ((minute - content.rules.startMinute + content.rules.ticksPerDay) % content.rules.ticksPerDay);
const farm = island.buildings.find((b) => b.type === 'farm');
const dock = island.buildings.find((b) => b.type === 'dock');
const travel = farm && dock ? roadsFrom(island, content, farm).to(dock) : null;
if (farm && dock && travel !== null) {
  island.transit.push({ id: world.nextId, good: 'vegetables', amount: 20, from: farm.id, to: dock.id, arriveTick: world.tick + travel + 6 });
  world.nextId += 1;
}
// A world normally starts at tick 0, and its ticks are due from the moment it was made; this one starts later in the
// day, so its clock is anchored to now at that tick. A dev-only reach into the runtime: nothing in the game does this.
(created.runtime as unknown as { setAnchor(tick: number, ms: number): void }).setAnchor(world.tick, Date.now());

console.log(`preview: http://${address}:${PORT}  sign in as ${USERNAME} / ${PASSWORD}  (game minute ${minute}; Ctrl-C to stop)`);
