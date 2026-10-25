import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApiServer } from './http';
import { hashPassword } from './security';

test('production frontend serves only built assets, preserves API protection and applies cache/security headers', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wtg-static-'));
  await mkdir(join(root, 'assets'));
  await writeFile(join(root, 'index.html'), '<html>public replay</html>');
  await writeFile(join(root, 'assets', 'main-123.js'), 'console.log("replay")');
  await writeFile(join(root, '.env'), 'private');
  const server = createApiServer({
    staticDirectory: root,
    auth: {
      mode: 'local',
      publicDemo: true,
      secureCookies: true,
      operatorHash: await hashPassword('test-only'),
    },
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const home = await fetch(base);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /public replay/);
    assert.match(home.headers.get('content-security-policy')!, /frame-ancestors 'none'/);
    assert.equal(home.headers.get('cache-control'), 'no-cache');
    const asset = await fetch(`${base}/assets/main-123.js`);
    assert.match(asset.headers.get('cache-control')!, /immutable/);
    assert.equal((await fetch(`${base}/assets/missing.js`)).status, 404);
    assert.equal((await fetch(`${base}/.env`)).status, 404);
    assert.equal((await fetch(`${base}/%2eenv`)).status, 404);
    assert.equal((await fetch(`${base}/%2e%2e%2f.env`)).status, 404);
    assert.equal((await fetch(`${base}/server/index.ts`)).status, 404);
    assert.equal((await fetch(`${base}/api/missing`)).status, 404);
    assert.equal((await fetch(`${base}/api/ops/metrics`)).status, 403);
    assert.equal((await fetch(base, { method: 'POST' })).status, 405);
    const head = await fetch(base, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
  } finally {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
    await rm(root, { recursive: true });
  }
});

test('explicit ACA ingress trust uses only the platform-appended rightmost IP for caller quotas', async () => {
  const server = createApiServer({
    trustAzureIngress: true,
    requestLimit: 1,
    auth: {
      mode: 'local',
      publicDemo: true,
      secureCookies: false,
      operatorHash: await hashPassword('test-only'),
    },
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api/auth/me`;
  try {
    assert.equal(
      (await fetch(base, { headers: { 'X-Forwarded-For': '1.1.1.1, 203.0.113.1' } })).status,
      200,
    );
    assert.equal(
      (await fetch(base, { headers: { 'X-Forwarded-For': '2.2.2.2, 203.0.113.1' } })).status,
      429,
    );
    assert.equal(
      (await fetch(base, { headers: { 'X-Forwarded-For': '203.0.113.2' } })).status,
      200,
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
});
