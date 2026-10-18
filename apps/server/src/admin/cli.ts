import { configFromEnv } from '../config.ts';

// pnpm admin <command> [argument]: the host's admin commands (spec 5.4, 12.3), sent to the running server's admin
// interface on 127.0.0.1 (ISLAND_ADMIN_PORT, 8788 by default).

const USAGE = `Usage: pnpm admin <command> [argument]
  worlds                      list the worlds, their status and islands
  create-account <username>   create an account without an invite code (the first one); prints its password
  reset-code <username>       issue a one-time password reset code, valid for a day
  invite-code <world-id>      give a world a new invite code; the old one stops working
  resume <world-id>           resume a paused world; it catches up the paused time
  backup                      write a backup of the database now`;

const base = `http://127.0.0.1:${configFromEnv(process.env).adminPort}`;
const [command, argument] = process.argv.slice(2);

const requests: Record<string, [method: string, path: string, body?: (argument: string) => unknown]> = {
  worlds: ['GET', '/admin/worlds'],
  'create-account': ['POST', '/admin/accounts', (username) => ({ username })],
  'reset-code': ['POST', '/admin/reset-codes', (username) => ({ username })],
  'invite-code': ['POST', '/admin/invite-codes', (world) => ({ world })],
  resume: ['POST', '/admin/resume', (world) => ({ world })],
  backup: ['POST', '/admin/backup', () => ({})],
};

const request = command === undefined ? undefined : requests[command];
const needsArgument = request?.[2] !== undefined && command !== 'backup';
if (!request || (needsArgument && argument === undefined)) {
  console.error(USAGE);
  process.exit(2);
}

const [method, path, body] = request;
try {
  const init: RequestInit = { method, headers: { 'content-type': 'application/json' } };
  if (body) init.body = JSON.stringify(body(argument ?? ''));
  const response = await fetch(base + path, init);
  const result: unknown = await response.json();
  if (!response.ok) {
    console.error(`admin ${command} failed (${response.status}): ${JSON.stringify(result)}`);
    process.exit(1);
  }
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(`admin ${command}: no server answered at ${base} (${error instanceof Error ? error.message : String(error)})`);
  process.exit(1);
}
