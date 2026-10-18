import type { JoinedResponse } from '@island/protocol';
import { afterEach, describe, expect, it } from 'vitest';
import { hashPassword } from '../src/accounts/passwords.ts';
import { DEFAULT_CONFIG } from '../src/config.ts';
import { startServer, type IslandServer } from '../src/server.ts';
import { Player } from './player.ts';
import { Browser, ORIGIN } from './server.ts';
import { memoryLog } from './support.ts';

let server: IslandServer | null = null;
let player: Player | null = null;

afterEach(async () => {
  player?.socket.terminate();
  await server?.close();
  server = null;
  player = null;
});

// Every other server test turns the tick timers off (autoTick: false) and runs ticks by hand. This one drives the
// real timers, the system clock and a real socket, as production does.
describe('a world created while the server runs', () => {
  it('ticks on its own timer and streams the ticks to a real socket', async () => {
    server = await startServer(
      { ...DEFAULT_CONFIG, port: 0, adminPort: 0, databasePath: ':memory:', backupDir: null, origin: ORIGIN, tickMs: 20 },
      { log: memoryLog() },
    );
    const account = server.accounts.newAccount('alice', await hashPassword('password-1'));
    server.accounts.store.insertAccount(account);
    const browser = new Browser(server.url);
    await browser.login('alice');
    const created = await browser.post<JoinedResponse>('/api/worlds', { islandName: 'Palm Cove' });
    expect(created.status).toBe(201);

    player = await Player.connect(server, browser);
    await player.hello();
    await player.open(created.body.world.id, created.body.world.slot);
    const update = await player.next('update', (message) => message.tick >= 3);
    expect(update.tick).toBeGreaterThanOrEqual(3);
  });
});
