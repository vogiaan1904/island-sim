import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, sep } from 'node:path';

// Serves the client's build output from the same origin as /api and /ws (spec "Serving the client"). The page, its
// scripts, the models and the icons are public files, so the work here is only to keep every lookup inside the build
// folder and to cache the right files for the right time.

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.glb': 'model/gltf-binary',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
};

/** Vite names built files in assets/ with a content hash: assets/index-Dk3j9sLq.js. A new build means a new name. */
const HASHED_ASSET = /^assets\/[^/]+-[\w-]{8}\.[a-z0-9]+$/i;
const IMMUTABLE = 'public, max-age=31536000, immutable';

type Lookup = { kind: 'file'; path: string; relative: string } | { kind: 'screen' } | { kind: 'refused'; status: 400 | 404 };

export type StaticHandler = (req: IncomingMessage, res: ServerResponse) => Promise<boolean>;

/**
 * The handler for every path that is not the API. It answers true when it answered, and false when there is nothing
 * to serve (no build folder yet), so the caller can give its usual not-found answer.
 */
export function createStaticHandler(clientDir: string): StaticHandler {
  return async (req, res) => {
    let rootPath: string;
    try {
      rootPath = await realpath(clientDir);
    } catch {
      return false;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { allow: 'GET, HEAD' }).end();
      return true;
    }
    const found = await lookup(rootPath, req.url ?? '/');
    if (found.kind === 'refused') {
      res.writeHead(found.status, { 'content-type': 'text/plain; charset=utf-8', 'x-content-type-options': 'nosniff' }).end(found.status === 400 ? 'Bad request' : 'Not found');
      return true;
    }
    const target = found.kind === 'file' ? found : { path: join(rootPath, 'index.html'), relative: 'index.html' };
    const info = await stat(target.path).catch(() => null);
    if (!info?.isFile()) {
      if (found.kind === 'screen') return false;
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
      return true;
    }
    const etag = `W/"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
    const headers = {
      'content-type': CONTENT_TYPES[extname(target.relative).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': HASHED_ASSET.test(target.relative) ? IMMUTABLE : 'no-cache',
      'x-content-type-options': 'nosniff',
      etag,
    };
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, headers).end();
      return true;
    }
    res.writeHead(200, { ...headers, 'content-length': info.size });
    if (req.method === 'HEAD') {
      res.end();
      return true;
    }
    await new Promise<void>((resolve) => {
      const stream = createReadStream(target.path);
      stream.on('error', () => {
        // The headers are out already: all that is left is to cut the connection.
        res.destroy();
        resolve();
      });
      res.on('close', resolve);
      stream.pipe(res);
    });
    return true;
  };
}

/** Turns a request target into a file inside the build folder, a screen path (index.html), or a refusal. */
async function lookup(rootPath: string, target: string): Promise<Lookup> {
  // The raw target, not URL parsing: Node accepts request targets such as "//" that `new URL` throws on.
  const rawPath = target.split(/[?#]/, 1)[0] ?? '';
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return { kind: 'refused', status: 400 };
  }
  // NUL ends a path early in some file systems, and a backslash is a separator on Windows.
  if (decoded.includes('\0') || decoded.includes('\\')) return { kind: 'refused', status: 400 };
  const segments = decoded.split('/').filter((segment) => segment !== '');
  if (segments.includes('..')) return { kind: 'refused', status: 400 };
  // No dotfiles and no folders that start with a dot (.env, .git, .well-known), also as "." itself.
  if (segments.some((segment) => segment.startsWith('.'))) return { kind: 'refused', status: 404 };

  const relative = segments.join('/');
  const last = segments.at(-1) ?? '';
  if (relative === '') return { kind: 'screen' };
  const path = join(rootPath, ...segments);
  let real: string;
  try {
    real = await realpath(path);
  } catch {
    // Nothing there. A name with an extension is a missing file, anything else is a screen of the client.
    return extname(last) === '' ? { kind: 'screen' } : { kind: 'refused', status: 404 };
  }
  // A link inside the build folder that leads out of it is not followed.
  if (real !== rootPath && !real.startsWith(rootPath + sep)) return { kind: 'refused', status: 404 };
  // Nor a link to a dotfile inside it.
  if (real.slice(rootPath.length).split(sep).some((segment) => segment.startsWith('.'))) return { kind: 'refused', status: 404 };
  if ((await stat(real)).isDirectory()) return { kind: 'screen' };
  return { kind: 'file', path: real, relative };
}
