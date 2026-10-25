import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createApiServer } from '../server/http';
import { hashPassword } from '../server/security';
import { Operations } from '../server/operations';
const password = 'ephemeral-load-test-password',
  ops = new Operations(() => {});
let providerCalls = 0;
let release!: () => void;
const gate = new Promise<void>((r) => {
  release = r;
});
const server = createApiServer({
  auth: { mode: 'local', secureCookies: false, operatorHash: await hashPassword(password) },
  operations: ops,
  requestLimit: 30,
  adapter: {
    name: 'controlled-load-adapter',
    select: async () => {
      providerCalls++;
      await gate;
      throw new Error('Controlled failure; not a live model call');
    },
  },
});
await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
const a = server.address();
assert.ok(a && typeof a !== 'string');
const base = `http://127.0.0.1:${a.port}`;
try {
  const login = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const cookie = login.headers.get('Set-Cookie')!.split(';')[0],
    { csrf } = await login.json();
  const input = JSON.stringify({
    scenarioId: 'quick-break',
    through: 19,
    receivedThrough: 19,
    audience: 'fan',
    language: 'en',
  });
  const latencies: number[] = [];
  const post = async (auth = true) => {
    const at = performance.now();
    const r = await fetch(`${base}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(auth ? { Cookie: cookie, 'X-CSRF-Token': csrf } : {}),
      },
      body: input,
    });
    await r.json();
    latencies.push(performance.now() - at);
    return { status: r.status, retryAfter: r.headers.get('Retry-After') };
  };
  const first = await Promise.all(Array.from({ length: 20 }, () => post()));
  assert.ok(first.every((r) => r.status === 200));
  assert.equal(providerCalls, 1, 'Concurrent identical polls must share one AI job');
  release();
  await new Promise((r) => setTimeout(r, 10));
  const burst = await Promise.all(Array.from({ length: 20 }, () => post()));
  assert.equal(burst.filter((r) => r.status === 429).length, 10);
  assert.ok(burst.filter((r) => r.status === 429).every((r) => Number(r.retryAfter) > 0));
  const unauthorized = await Promise.all(Array.from({ length: 10 }, () => post(false)));
  assert.ok(unauthorized.every((r) => r.status === 401));
  assert.equal(providerCalls, 1);
  latencies.sort((a, b) => a - b);
  const p95 = latencies[Math.ceil(latencies.length * 0.95) - 1];
  assert.ok(
    p95 < 2000,
    'Local API response p95 must stay under two seconds during controlled load',
  );
  const report = {
    recordedAt: new Date().toISOString(),
    scope:
      '50 real loopback HTTP requests with local authentication and a controlled failing provider. Not a live Foundry concurrency/scale benchmark.',
    requests: 50,
    initialAccepted: 20,
    burstLimited: 10,
    unauthorizedDenied: 10,
    providerInvocations: providerCalls,
    p95Ms: Math.round(p95),
    metrics: ops.snapshot(),
    passed: true,
  };
  await writeFile('docs/evaluations/enterprise-load.json', JSON.stringify(report, null, 2) + '\n');
  console.log(
    JSON.stringify({
      requests: 50,
      providerInvocations: providerCalls,
      p95Ms: Math.round(p95),
      passed: true,
    }),
  );
} finally {
  release();
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
}
