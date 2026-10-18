import { execFile, spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { JoinedResponse, MeResponse } from '@island/protocol';
import { describe, expect, it } from 'vitest';

const run = promisify(execFile);
const SRC = join(import.meta.dirname, '..', 'src');
const NODE_FLAGS = ['--disable-warning=ExperimentalWarning'];
const ORIGIN = 'http://game.test';

function serverEnv() {
  return {
    ...process.env,
    ISLAND_DB: join(mkdtempSync(join(tmpdir(), 'island-main-')), 'island.sqlite'),
    ISLAND_PORT: '0',
    ISLAND_ADMIN_PORT: '0',
    ISLAND_BACKUP_DIR: '',
    ISLAND_ORIGIN: ORIGIN,
    ISLAND_SECURE_COOKIES: '0',
  };
}

/** Runs `pnpm server` as its own process and waits for it to start. */
async function startProcess(env: Record<string, string | undefined>) {
  const child = spawn(process.execPath, [...NODE_FLAGS, join(SRC, 'main.ts')], { env });
  let output = '';
  const exited = new Promise<{ code: number | null; signal: string | null }>((resolve) => {
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
  const started = await new Promise<{ url: string; adminUrl: string }>((resolve, reject) => {
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString();
      const line = output.split('\n').find((text) => text.includes('"server started"'));
      if (line) resolve(JSON.parse(line) as { url: string; adminUrl: string });
    });
    void exited.then(({ code }) => reject(new Error(`server exited with ${code}: ${output}`)));
  });
  return { child, started, exited, output: () => output };
}

/** Runs `pnpm admin` against a running server's admin interface. */
function adminCommand(env: Record<string, string | undefined>, adminUrl: string, ...args: string[]) {
  return run(process.execPath, [...NODE_FLAGS, join(SRC, 'admin', 'cli.ts'), ...args], {
    env: { ...env, ISLAND_ADMIN_PORT: new URL(adminUrl).port },
  });
}

async function login(url: string, username: string, password: string): Promise<{ status: number; cookie: string }> {
  const response = await fetch(`${url}/api/login`, {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return { status: response.status, cookie: (response.headers.getSetCookie()[0] ?? '').split(';')[0] ?? '' };
}

describe('pnpm server and pnpm admin', () => {
  it('start from the command line, take admin commands, and stop gracefully on SIGTERM', async () => {
    const env = serverEnv();
    const server = await startProcess(env);
    const created = await adminCommand(env, server.started.adminUrl, 'create-account', 'host');
    const { password } = JSON.parse(created.stdout) as { password: string };
    const signedIn = await fetch(`${server.started.url}/api/login`, {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'host', password }),
    });
    expect(signedIn.status).toBe(200);
    expect(signedIn.headers.getSetCookie()[0]).not.toContain('Secure');
    await expect(adminCommand(env, server.started.adminUrl, 'resume')).rejects.toMatchObject({ code: 2 });

    server.child.kill('SIGTERM');
    expect(await server.exited).toEqual({ code: 0, signal: null });
    expect(server.output()).toContain('"server stopped"');
  }, 20_000);

  it('keep a world created just before the process is killed (spec 5.2: no action is lost)', async () => {
    const env = serverEnv();
    const first = await startProcess(env);
    const { password } = JSON.parse((await adminCommand(env, first.started.adminUrl, 'create-account', 'host')).stdout) as {
      password: string;
    };
    const { cookie } = await login(first.started.url, 'host', password);
    const created = await fetch(`${first.started.url}/api/worlds`, {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/json', cookie },
      body: JSON.stringify({ islandName: 'Palm Cove' }),
    });
    const { world } = (await created.json()) as JoinedResponse;
    first.child.kill('SIGKILL');
    expect(await first.exited).toEqual({ code: null, signal: 'SIGKILL' });

    const second = await startProcess(env);
    const again = await login(second.started.url, 'host', password);
    const me = (await (await fetch(`${second.started.url}/api/me`, { headers: { cookie: again.cookie } })).json()) as MeResponse;
    expect(me.worlds.map(({ id, islandName, status }) => ({ id, islandName, status }))).toEqual([
      { id: world.id, islandName: 'Palm Cove', status: 'running' },
    ]);
    second.child.kill('SIGTERM');
    expect((await second.exited).code).toBe(0);
  }, 20_000);
});
