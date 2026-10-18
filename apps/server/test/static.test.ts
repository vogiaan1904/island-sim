import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { IslandServer } from '../src/server.ts';
import { Player } from './player.ts';
import { Browser, addAccount, startTestServer } from './server.ts';

let running: IslandServer[] = [];

afterEach(async () => {
  await Promise.all(running.map((server) => server.close()));
  running = [];
});

const INDEX = '<!doctype html><title>Island</title><div id="root"></div>';
const SECRET = 'top secret, outside the build folder';

/**
 * A build folder shaped like Vite's output, inside a parent folder that holds a secret the server must never give out.
 * Returns the build folder.
 */
function buildFolder(): string {
  const parent = mkdtempSync(join(tmpdir(), 'island-client-'));
  const root = join(parent, 'dist');
  mkdirSync(join(root, 'assets'), { recursive: true });
  mkdirSync(join(root, 'models'));
  mkdirSync(join(root, 'icons'));
  mkdirSync(join(root, '.git'));
  writeFileSync(join(parent, 'secret.txt'), SECRET);
  writeFileSync(join(root, 'index.html'), INDEX);
  writeFileSync(join(root, 'assets', 'index-Dk3j9sLq.js'), 'console.log("game");');
  writeFileSync(join(root, 'assets', 'index-Bq81xZpa.css'), 'body{margin:0}');
  writeFileSync(join(root, 'assets', 'plain.js'), 'console.log("not hashed");');
  writeFileSync(join(root, 'models', 'building_cottage_a.glb'), 'glTF');
  writeFileSync(join(root, 'icons', 'good_wood_a.png'), 'png');
  writeFileSync(join(root, '.env'), 'PASSWORD=hunter2');
  writeFileSync(join(root, '.git', 'config'), '[core]');
  writeFileSync(join(root, 'assets', '.hidden.js'), 'hidden');
  return root;
}

async function serverWithClient(clientDir: string | null = buildFolder()) {
  const setup = await startTestServer({ clientDir });
  running.push(setup.server);
  return setup;
}

interface Answer {
  status: number;
  type: string | null;
  cache: string | null;
  body: string;
  headers: Record<string, string | string[] | undefined>;
}

/** A request with the target exactly as given: fetch would tidy ".." away before it left. */
function raw(server: IslandServer, path: string, method = 'GET', headers: Record<string, string> = {}): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const url = new URL(server.url);
    const req = request({ host: url.hostname, port: url.port, path, method, headers }, (res) => {
      let body = '';
      res.on('data', (chunk: Buffer) => (body += chunk.toString()));
      res.on('end', () =>
        resolve({
          status: res.statusCode ?? 0,
          type: res.headers['content-type'] ?? null,
          cache: res.headers['cache-control'] ?? null,
          body,
          headers: res.headers,
        }),
      );
    });
    req.on('error', reject);
    req.end();
  });
}

describe('serving the built client', () => {
  it('answers the game address with index.html', async () => {
    const { server } = await serverWithClient();
    const answer = await raw(server, '/');
    expect(answer.status).toBe(200);
    expect(answer.type).toBe('text/html; charset=utf-8');
    expect(answer.body).toBe(INDEX);
  });

  it('gives each file the content type of its extension', async () => {
    const { server } = await serverWithClient();
    expect((await raw(server, '/assets/index-Dk3j9sLq.js')).type).toBe('text/javascript; charset=utf-8');
    expect((await raw(server, '/assets/index-Bq81xZpa.css')).type).toBe('text/css; charset=utf-8');
    expect((await raw(server, '/models/building_cottage_a.glb')).type).toBe('model/gltf-binary');
    const icon = await raw(server, '/icons/good_wood_a.png');
    expect(icon.type).toBe('image/png');
    expect(icon.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('caching', () => {
  it('keeps hashed asset files for a year and makes everything else revalidate', async () => {
    const { server } = await serverWithClient();
    const immutable = 'public, max-age=31536000, immutable';
    expect((await raw(server, '/assets/index-Dk3j9sLq.js')).cache).toBe(immutable);
    expect((await raw(server, '/assets/index-Bq81xZpa.css')).cache).toBe(immutable);
    expect((await raw(server, '/assets/plain.js')).cache).toBe('no-cache');
    expect((await raw(server, '/')).cache).toBe('no-cache');
    expect((await raw(server, '/models/building_cottage_a.glb')).cache).toBe('no-cache');
    expect((await raw(server, '/some/screen')).cache).toBe('no-cache');
  });

  it('answers 304 to a request that already holds the current file', async () => {
    const { server } = await serverWithClient();
    const first = await raw(server, '/models/building_cottage_a.glb');
    const etag = first.headers.etag;
    expect(typeof etag).toBe('string');
    const again = await raw(server, '/models/building_cottage_a.glb', 'GET', { 'if-none-match': String(etag) });
    expect(again.status).toBe(304);
    expect(again.body).toBe('');
  });
});

describe('unknown paths and the API', () => {
  it('answers a screen path with index.html but a missing file with 404', async () => {
    const { server } = await serverWithClient();
    expect(await raw(server, '/worlds/abc?x=1')).toMatchObject({ status: 200, body: INDEX });
    expect(await raw(server, '//')).toMatchObject({ status: 200, body: INDEX });
    expect(await raw(server, '/assets/index-Missing1.js')).toMatchObject({ status: 404 });
    expect((await raw(server, '/models/nothing.glb')).body).not.toBe(INDEX);
  });

  it('leaves /api and /ws to the server: no index.html, JSON errors as before', async () => {
    const { server } = await serverWithClient();
    expect(await raw(server, '/api/nothing')).toMatchObject({ status: 404, type: 'application/json', body: '{"error":"not-found"}' });
    expect(await raw(server, '/api')).toMatchObject({ status: 404, body: '{"error":"not-found"}' });
    expect(await raw(server, '/api/me')).toMatchObject({ status: 401, body: '{"error":"not-signed-in"}' });
    expect(await raw(server, '/ws')).toMatchObject({ status: 404, body: '{"error":"not-found"}' });
  });

  it('still upgrades /ws for a signed-in player, and refuses the upgrade of a stranger as before', async () => {
    const { server } = await serverWithClient();
    await addAccount(server, 'alice');
    const alice = new Browser(server.url);
    await alice.login('alice');
    const player = await Player.connect(server, alice);
    player.socket.close();
    await expect(Player.connect(server, new Browser(server.url))).rejects.toThrow('upgrade refused with 401');
  });

  it('serves only GET and HEAD', async () => {
    const { server } = await serverWithClient();
    expect(await raw(server, '/', 'POST')).toMatchObject({ status: 405 });
    const head = await raw(server, '/', 'HEAD');
    expect(head.status).toBe(200);
    expect(head.body).toBe('');
  });

  it('answers the API alone when there is no build folder', async () => {
    const { server } = await serverWithClient(join(tmpdir(), 'island-no-such-build'));
    expect(await raw(server, '/')).toMatchObject({ status: 404, body: '{"error":"not-found"}' });
    const { server: noClient } = await serverWithClient(null);
    expect(await raw(noClient, '/')).toMatchObject({ status: 404, body: '{"error":"not-found"}' });
  });
});

describe('safe path lookup', () => {
  const traversal = [
    '/../secret.txt',
    '/..%2Fsecret.txt',
    '/%2e%2e/secret.txt',
    '/%2E%2E%2Fsecret.txt',
    '/assets/../../secret.txt',
    '/assets/%2e%2e/%2e%2e/secret.txt',
    '/..%5Csecret.txt',
    '/assets/..%5C..%5Csecret.txt',
    '/%2e%2e%5csecret.txt',
    '//../secret.txt',
    '/./../secret.txt',
    '/assets/%00/../../secret.txt',
    '/%00',
    '/index.html%00.png',
  ];

  it.each(traversal)('never gives out a file outside the build folder: %s', async (path) => {
    const { server } = await serverWithClient();
    const answer = await raw(server, path);
    expect(answer.body).not.toContain(SECRET);
    expect([400, 404]).toContain(answer.status);
  });

  it('refuses a path that is not valid percent-encoding', async () => {
    const { server } = await serverWithClient();
    expect((await raw(server, '/%E0%A4%A')).status).toBe(400);
  });

  const dotfiles = ['/.env', '/%2eenv', '/.git/config', '/.git', '/assets/.hidden.js', '/assets/%2ehidden.js', '/.well-known/x'];

  it.each(dotfiles)('refuses a dotfile or a folder that starts with a dot: %s', async (path) => {
    const { server } = await serverWithClient();
    const answer = await raw(server, path);
    expect(answer.status).toBe(404);
    expect(answer.body).not.toContain('hunter2');
    expect(answer.body).not.toContain('[core]');
    expect(answer.body).not.toBe(INDEX);
  });

  it('does not follow a link that points outside the build folder', async () => {
    const root = buildFolder();
    symlinkSync(join(root, '..', 'secret.txt'), join(root, 'assets', 'link.txt'));
    const { server } = await serverWithClient(root);
    const answer = await raw(server, '/assets/link.txt');
    expect(answer.status).toBe(404);
    expect(answer.body).not.toContain(SECRET);
  });

  it('never lists a folder: it answers like any screen path', async () => {
    const { server } = await serverWithClient();
    expect(await raw(server, '/assets/')).toMatchObject({ status: 200, body: INDEX });
    expect(await raw(server, '/models')).toMatchObject({ status: 200, body: INDEX });
  });
});
