import { execFile } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const CLI = join(import.meta.dirname, '..', 'src', 'admin', 'cli.ts');

let stub: Server | null = null;

afterEach(async () => {
  if (stub) await new Promise((resolve) => stub?.close(resolve));
  stub = null;
});

interface Outcome {
  code: number;
  stdout: string;
  stderr: string;
}

function cli(env: Record<string, string>, ...args: string[]): Promise<Outcome> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      ['--disable-warning=ExperimentalWarning', CLI, ...args],
      { env: { ...process.env, ...env } },
      (error, stdout, stderr) => resolve({ code: error ? (typeof error.code === 'number' ? error.code : 1) : 0, stdout, stderr }),
    );
  });
}

/** A stand-in admin interface that answers every request the same way; returns the port to point the CLI at. */
async function answering(status: number, body: string): Promise<{ ISLAND_ADMIN_PORT: string }> {
  stub = createServer((_req, res) => {
    res.writeHead(status, { 'content-type': 'application/json' }).end(body);
  });
  const server = stub;
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { ISLAND_ADMIN_PORT: String((server.address() as { port: number }).port) };
}

describe('pnpm admin', () => {
  it('prints one line, not a stack, for an admin port that is not a port', async () => {
    const result = await cli({ ISLAND_ADMIN_PORT: 'nonsense' }, 'worlds');
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/^admin worlds: .*ISLAND_ADMIN_PORT.*\n$/);
  });

  it('says so when something other than the admin interface answers', async () => {
    const env = await answering(200, 'hello');
    const result = await cli(env, 'worlds');
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/answered something unexpected/);
    expect(result.stderr).not.toMatch(/no server answered/);
  });

  it('shows the usage after a 400', async () => {
    const env = await answering(400, '{"error":"bad-request"}');
    const result = await cli(env, 'create-account', 'x');
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('(400)');
    expect(result.stderr).toContain('Usage: pnpm admin');
  });

  it('refuses more arguments than the command takes, and none that it needs', async () => {
    const env = await answering(200, '{}');
    for (const args of [['worlds', 'extra'], ['backup', 'extra'], ['resume', 'a', 'b'], ['resume'], ['nonsense'], []]) {
      const result = await cli(env, ...args);
      expect([args, result.code]).toEqual([args, 2]);
      expect(result.stderr).toContain('Usage: pnpm admin');
    }
  });

  it('prints the server answer on success', async () => {
    const env = await answering(200, '{"worlds":[]}');
    const result = await cli(env, 'worlds');
    expect([result.code, JSON.parse(result.stdout)]).toEqual([0, { worlds: [] }]);
  });
});
