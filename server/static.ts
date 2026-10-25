import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const types: Record<string, string> = {
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};
/** Serve only the built frontend; never expose source, environment or arbitrary files. */
export async function serveFrontend(
  req: IncomingMessage,
  res: ServerResponse,
  directory: string,
  pathname: string,
) {
  const fail = (status: number) => {
    res.writeHead(status, { 'Cache-Control': 'no-store' });
    res.end();
  };
  if (req.method !== 'GET' && req.method !== 'HEAD') return fail(405);
  let path: string;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    return fail(400);
  }
  const root = resolve(directory);
  let file = resolve(root, '.' + path);
  if (!file.startsWith(root + sep) && file !== root) return fail(404);
  if (path.split('/').some((part) => part.startsWith('.'))) return fail(404);
  if (!extname(path)) file = resolve(root, 'index.html');
  const type = types[extname(file)];
  if (!type) return fail(404);
  try {
    const info = await stat(file);
    if (!info.isFile()) return fail(404);
    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': info.size,
      'Cache-Control': path.startsWith('/assets/')
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://login.microsoftonline.com; frame-src https://login.microsoftonline.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    });
    res.end(req.method === 'HEAD' ? undefined : await readFile(file));
  } catch {
    if (!res.headersSent) fail(404);
    else res.destroy();
  }
}
