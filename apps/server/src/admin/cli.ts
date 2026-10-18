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

const [command, ...args] = process.argv.slice(2);

/** Each command's request, and how many arguments it takes. */
const requests: Record<string, { method: string; path: string; arguments: 0 | 1; body?: (argument: string) => unknown }> = {
  worlds: { method: 'GET', path: '/admin/worlds', arguments: 0 },
  'create-account': { method: 'POST', path: '/admin/accounts', arguments: 1, body: (username) => ({ username }) },
  'reset-code': { method: 'POST', path: '/admin/reset-codes', arguments: 1, body: (username) => ({ username }) },
  'invite-code': { method: 'POST', path: '/admin/invite-codes', arguments: 1, body: (world) => ({ world }) },
  resume: { method: 'POST', path: '/admin/resume', arguments: 1, body: (world) => ({ world }) },
  backup: { method: 'POST', path: '/admin/backup', arguments: 0, body: () => ({}) },
};

const request = command === undefined ? undefined : requests[command];
if (!request || args.length !== request.arguments) {
  console.error(USAGE);
  process.exit(2);
}

try {
  const base = `http://127.0.0.1:${configFromEnv(process.env).adminPort}`;
  const init: RequestInit = { method: request.method, headers: { 'content-type': 'application/json' } };
  if (request.body) init.body = JSON.stringify(request.body(args[0] ?? ''));
  let response: Response;
  try {
    response = await fetch(base + request.path, init);
  } catch (error) {
    console.error(`admin ${command}: no server answered at ${base} (${error instanceof Error ? error.message : String(error)})`);
    process.exit(1);
  }
  let result: unknown;
  try {
    result = await response.json();
  } catch {
    console.error(`admin ${command}: the server at ${base} answered something unexpected (${response.status}, not JSON)`);
    process.exit(1);
  }
  if (!response.ok) {
    console.error(`admin ${command} failed (${response.status}): ${JSON.stringify(result)}`);
    // A 400 means the argument was not accepted: show what each command takes.
    if (response.status === 400) console.error(USAGE);
    process.exit(1);
  }
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(`admin ${command}: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
