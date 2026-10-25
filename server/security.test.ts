import { request as httpRequest } from 'node:http';
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from 'jose';
import { createApiServer } from './http';
import { hashPassword, configuredSecurity, type AuthConfig } from './security';
import { Operations, RateLimiter, type AuditRecord } from './operations';
const request = {
  scenarioId: 'quick-break',
  through: 19,
  receivedThrough: 19,
  audience: 'fan',
  language: 'en',
};
async function listen(auth: AuthConfig, options: Parameters<typeof createApiServer>[0] = {}) {
  const server = createApiServer({ auth, ...options });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const a = server.address();
  assert.ok(a && typeof a !== 'string');
  return {
    server,
    base: `http://127.0.0.1:${a.port}`,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((r) => server.close(() => r()));
    },
  };
}
const password = 'test-only-random-workspace-password';
const hashes = Promise.all([hashPassword(password), hashPassword('test-only-viewer-password')]);
async function local() {
  const [operatorHash, viewerHash] = await hashes;
  return { mode: 'local' as const, secureCookies: false, operatorHash, viewerHash };
}
async function login(base: string, password: string) {
  const r = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  return {
    response: r,
    cookie: r.headers.get('set-cookie')!.split(';')[0],
    session: await r.json(),
  };
}
test('local sessions enforce authentication, CSRF, roles, logout and secure cookie flags', async () => {
  const logs: AuditRecord[] = [];
  const ops = new Operations((r) => logs.push(r));
  const app = await listen(await local(), { operations: ops });
  try {
    assert.equal(
      (
        await fetch(`${app.base}/api/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        })
      ).status,
      401,
    );
    assert.equal((await fetch(`${app.base}/api/feed?scenarioId=quick-break`)).status, 401);
    const user = await login(app.base, password);
    assert.equal(user.response.status, 200);
    assert.match(user.response.headers.get('set-cookie')!, /HttpOnly/);
    assert.match(user.response.headers.get('set-cookie')!, /SameSite=Strict/);
    const post = (csrf?: string) =>
      fetch(`${app.base}/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: user.cookie,
          ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        },
        body: JSON.stringify(request),
      });
    assert.equal((await post()).status, 403);
    assert.equal((await post('wrong')).status, 403);
    assert.equal((await post(user.session.csrf)).status, 200);
    assert.equal(
      (
        await fetch(`${app.base}/api/auth/me`, {
          headers: { Cookie: 'wtg_session=' + 'a'.repeat(64) },
        })
      ).status,
      401,
    );
    const metrics = await fetch(`${app.base}/api/ops/metrics`, {
      headers: { Cookie: user.cookie },
    });
    assert.equal(metrics.status, 200);
    assert.ok((await metrics.json()).authDenied >= 3);
    assert.match(metrics.headers.get('x-request-id')!, /^[a-f0-9-]{36}$/);
    assert.match(
      await (
        await fetch(`${app.base}/api/ops/prometheus`, { headers: { Cookie: user.cookie } })
      ).text(),
      /wtg_http_requests_total/,
    );
    const viewer = await login(app.base, 'test-only-viewer-password');
    assert.equal(viewer.session.role, 'viewer');
    assert.equal(
      (await fetch(`${app.base}/api/ops/metrics`, { headers: { Cookie: viewer.cookie } })).status,
      403,
    );
    assert.equal(
      (
        await fetch(`${app.base}/api/auth/logout`, {
          method: 'POST',
          headers: { Cookie: user.cookie, 'X-CSRF-Token': user.session.csrf },
        })
      ).status,
      200,
    );
    assert.equal(
      (await fetch(`${app.base}/api/auth/me`, { headers: { Cookie: user.cookie } })).status,
      401,
    );
    const raw = JSON.stringify(logs);
    assert.ok(!raw.includes(password));
    assert.ok(!raw.includes(user.cookie));
    assert.ok(!raw.includes(user.session.csrf));
    assert.ok(!raw.includes('quick-break'));
    assert.ok(logs.some((l) => l.event === 'login_succeeded'));
    assert.throws(() => configuredSecurity({ NODE_ENV: 'production', AUTH_MODE: 'local' }));
  } finally {
    await app.close();
  }
});
test('session expiry, login throttling, user throttling and stream caps resist bypass headers', async () => {
  let now = Date.now();
  const config = { ...(await local()), now: () => now, sessionTtlMs: 60000 };
  const limiter = new RateLimiter(() => now);
  const app = await listen(config, { limiter, requestLimit: 3, loginLimit: 2 });
  try {
    const user = await login(app.base, password);
    const headers = { Cookie: user.cookie, 'X-Forwarded-For': 'untrusted-client' };
    assert.equal((await fetch(`${app.base}/api/auth/me`, { headers })).status, 200);
    assert.equal((await fetch(`${app.base}/api/auth/me`, { headers })).status, 200);
    assert.equal((await fetch(`${app.base}/api/auth/me`, { headers })).status, 200);
    const limited = await fetch(`${app.base}/api/auth/me`, {
      headers: { ...headers, 'X-Forwarded-For': 'another-fake' },
    });
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get('Retry-After')) > 0);
    assert.equal(
      (
        await fetch(`${app.base}/api/auth/logout`, {
          method: 'POST',
          headers: { Cookie: user.cookie, 'X-CSRF-Token': user.session.csrf },
        })
      ).status,
      200,
      'Logout must remain possible after request quota exhaustion',
    );
    now += 61000;
    assert.equal((await fetch(`${app.base}/api/auth/me`, { headers })).status, 401);
    await fetch(`${app.base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'bad' }),
    });
    await fetch(`${app.base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'bad' }),
    });
    const blocked = await fetch(`${app.base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': 'spoofed' },
      body: JSON.stringify({ password }),
    });
    assert.equal(blocked.status, 429);
  } finally {
    await app.close();
  }
  const feedApp = await listen(await local());
  const stop = new AbortController();
  try {
    const u = await login(feedApp.base, password);
    const init = { headers: { Cookie: u.cookie }, signal: stop.signal };
    const a = await fetch(`${feedApp.base}/api/feed?scenarioId=quick-break`, init);
    const b = await fetch(`${feedApp.base}/api/feed?scenarioId=quick-break`, init);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.equal(
      (await fetch(`${feedApp.base}/api/feed?scenarioId=quick-break`, init)).status,
      429,
    );
    stop.abort();
  } finally {
    await feedApp.close();
  }
});
test('signed Entra tokens require the exact tenant, audience, client, scope, dates and operator role', async () => {
  const tenant = '11111111-1111-4111-8111-111111111111',
    client = '22222222-2222-4222-8222-222222222222',
    oid = '33333333-3333-4333-8333-333333333333';
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const key = await exportJWK(publicKey);
  key.kid = 'test-key';
  const config: AuthConfig = {
    mode: 'entra',
    secureCookies: true,
    tenantId: tenant,
    clientId: client,
    audience: client,
    scope: 'access_as_user',
    jwks: createLocalJWKSet({ keys: [key] }),
  };
  const app = await listen(config);
  const token = async (overrides: Record<string, unknown> = {}) =>
    new SignJWT({
      tid: tenant,
      oid,
      azp: client,
      ver: '2.0',
      scp: 'access_as_user',
      roles: ['WTG.Operator'],
      ...overrides,
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(`https://login.microsoftonline.com/${tenant}/v2.0`)
      .setAudience(client)
      .setIssuedAt()
      .setNotBefore('0s')
      .setExpirationTime('5m')
      .sign(privateKey);
  try {
    const good = await token();
    assert.equal(
      (await fetch(`${app.base}/api/ops/metrics`, { headers: { Authorization: `Bearer ${good}` } }))
        .status,
      200,
    );
    const session = await fetch(`${app.base}/api/auth/session`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${good}` },
    });
    assert.equal(session.status, 200);
    assert.match(session.headers.get('set-cookie')!, /__Host-wtg_session=/);
    assert.match(session.headers.get('set-cookie')!, /; Secure/);
    const badTokens = [
      await token({ tid: 'wrong' }),
      await token({ azp: 'wrong' }),
      await token({ scp: 'User.Read' }),
      await token({ ver: '1.0' }),
      good.slice(0, -4) + 'abcd',
    ];
    const expired = await new SignJWT({
      tid: tenant,
      oid,
      azp: client,
      ver: '2.0',
      scp: 'access_as_user',
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(`https://login.microsoftonline.com/${tenant}/v2.0`)
      .setAudience(client)
      .setIssuedAt()
      .setNotBefore('-2h')
      .setExpirationTime('-1h')
      .sign(privateKey);
    badTokens.push(expired);
    const wrongAud = await new SignJWT({
      tid: tenant,
      oid,
      azp: client,
      ver: '2.0',
      scp: 'access_as_user',
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(`https://login.microsoftonline.com/${tenant}/v2.0`)
      .setAudience('https://graph.microsoft.com')
      .setIssuedAt()
      .setNotBefore('0s')
      .setExpirationTime('5m')
      .sign(privateKey);
    badTokens.push(wrongAud);
    const standard = { tid: tenant, oid, azp: client, ver: '2.0', scp: 'access_as_user' };
    badTokens.push(
      await new SignJWT(standard)
        .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
        .setIssuer('https://login.microsoftonline.com/other/v2.0')
        .setAudience(client)
        .setIssuedAt()
        .setNotBefore('0s')
        .setExpirationTime('5m')
        .sign(privateKey),
    );
    badTokens.push(
      await new SignJWT(standard)
        .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
        .setIssuer(`https://login.microsoftonline.com/${tenant}/v2.0`)
        .setAudience(client)
        .setIssuedAt()
        .setNotBefore('1h')
        .setExpirationTime('2h')
        .sign(privateKey),
    );
    badTokens.push(
      await new SignJWT(standard)
        .setProtectedHeader({ alg: 'HS256', kid: 'test-key' })
        .setIssuer(`https://login.microsoftonline.com/${tenant}/v2.0`)
        .setAudience(client)
        .setIssuedAt()
        .setNotBefore('0s')
        .setExpirationTime('5m')
        .sign(new Uint8Array(32)),
    );
    for (const value of badTokens)
      assert.equal(
        (await fetch(`${app.base}/api/auth/me`, { headers: { Authorization: `Bearer ${value}` } }))
          .status,
        401,
      );
    assert.equal(
      (
        await fetch(`${app.base}/api/ops/metrics`, {
          headers: { Authorization: `Bearer ${await token({ roles: [] })}` },
        })
      ).status,
      403,
    );
    const service = await fetch(`${app.base}/api/analyze`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${good}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    assert.equal(service.status, 200);
  } finally {
    await app.close();
  }
});
test('monitoring counts workflow outcomes once; job limits preserve measured fallback', async () => {
  const ops = new Operations(() => {});
  let calls = 0;
  const app = await listen(await local(), {
    operations: ops,
    jobLimit: 1,
    adapter: {
      name: 'controlled-failure',
      select: async () => {
        calls++;
        throw new Error('expected failure');
      },
    },
  });
  try {
    const u = await login(app.base, password);
    const headers = {
      Cookie: u.cookie,
      'Content-Type': 'application/json',
      'X-CSRF-Token': u.session.csrf,
    };
    const post = (value: unknown) =>
      fetch(`${app.base}/api/analyze`, {
        method: 'POST',
        headers,
        body: JSON.stringify(value),
      }).then((r) => r.json());
    await post(request);
    await new Promise((r) => setTimeout(r, 5));
    await post(request);
    await post(request);
    const denied = await post({ ...request, audience: 'analyst' });
    assert.equal(denied.reason, 'capacity');
    assert.equal(denied.recap.outcome, 'goal');
    const m = ops.snapshot();
    assert.equal(calls, 1);
    assert.equal(m.workflows.started, 1);
    assert.equal(m.workflows.completed, 1);
    assert.equal(m.workflows.fallback, 1);
    assert.equal(m.workflows.calls, 1);
  } finally {
    await app.close();
  }
});

test('live checkpoint policy reserves inference for a meaningful buildup and terminal outcome', async () => {
  const { createAnalysisService } = await import('./analysisService');
  let calls = 0;
  const service = createAnalysisService({
    name: 'checkpoint-probe',
    select: async ({ evidence }) => {
      calls++;
      return { factIds: [evidence.facts.at(-1)!.id] };
    },
  });
  for (const through of [1, 4]) {
    const r = await service({ ...request, through, receivedThrough: through });
    assert.equal(r.reason, 'collecting');
  }
  await service({ ...request, through: 8, receivedThrough: 8 });
  await new Promise((r) => setTimeout(r, 5));
  for (const through of [12, 15]) {
    const r = await service({ ...request, through, receivedThrough: through });
    assert.equal(r.reason, 'collecting');
  }
  await service(request);
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(calls, 2);
});

test('malformed absolute request URLs fail closed without terminating the server', async () => {
  const app = await listen(await local());
  try {
    const status = await new Promise<number>((resolve, reject) => {
      const req = httpRequest(app.base, { path: 'http://[' }, (res) => {
        res.resume();
        resolve(res.statusCode!);
      });
      req.on('error', reject);
      req.end();
    });
    assert.equal(status, 400);
    assert.equal((await fetch(`${app.base}/api/health`)).status, 200);
  } finally {
    await app.close();
  }
});

test('public demo admits judges without credentials, retains quotas and protects operator metrics', async () => {
  const app = await listen({ ...(await local()), publicDemo: true }, { requestLimit: 4 });
  try {
    const config = await (await fetch(`${app.base}/api/auth/config`)).json();
    assert.equal(config.publicDemo, true);
    const me = await fetch(`${app.base}/api/auth/me`);
    assert.equal(me.status, 200);
    assert.equal(me.headers.get('set-cookie'), null);
    assert.equal((await me.json()).guest, true);
    assert.equal((await fetch(`${app.base}/api/ops/metrics`)).status, 403);
    const analysis = await fetch(`${app.base}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    assert.equal(analysis.status, 200);
    const stream = await fetch(`${app.base}/api/feed?scenarioId=quick-break`);
    assert.equal(stream.status, 200);
    await stream.body?.cancel();
    assert.equal((await fetch(`${app.base}/api/auth/me`)).status, 429);
    const operator = await login(app.base, password);
    assert.equal(operator.response.status, 200);
    assert.equal(
      (await fetch(`${app.base}/api/ops/metrics`, { headers: { Cookie: operator.cookie } })).status,
      200,
    );
  } finally {
    await app.close();
  }
});

test('open demo workspace requires no password, preserves caller quota and revokes its inspection session', async () => {
  const app = await listen(
    { mode: 'local', publicDemo: true, secureCookies: false },
    { requestLimit: 4 },
  );
  try {
    assert.equal((await fetch(`${app.base}/api/auth/me`)).status, 200);
    const entry = await fetch(`${app.base}/api/auth/demo`, { method: 'POST' });
    assert.equal(entry.status, 200);
    const cookie = entry.headers.get('set-cookie')!.split(';')[0];
    const session = await entry.json();
    assert.equal(session.role, 'operator');
    assert.equal(session.demo, true);
    assert.ok(session.csrf);
    const me = await (
      await fetch(`${app.base}/api/auth/me`, { headers: { Cookie: cookie } })
    ).json();
    assert.equal(me.demo, true);
    assert.equal(
      (await fetch(`${app.base}/api/ops/metrics`, { headers: { Cookie: cookie } })).status,
      200,
    );
    const second = await fetch(`${app.base}/api/auth/demo`, {
      method: 'POST',
      headers: { Cookie: cookie },
    });
    assert.equal(second.status, 200);
    const secondCookie = second.headers.get('set-cookie')!.split(';')[0];
    const secondSession = await second.json();
    // Re-entering does not create a fresh caller quota identity.
    assert.equal(
      (await fetch(`${app.base}/api/auth/me`, { headers: { Cookie: secondCookie } })).status,
      200,
    );
    assert.equal(
      (await fetch(`${app.base}/api/auth/me`, { headers: { Cookie: secondCookie } })).status,
      429,
    );
    assert.equal(
      (
        await fetch(`${app.base}/api/auth/logout`, {
          method: 'POST',
          headers: { Cookie: secondCookie },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(`${app.base}/api/auth/logout`, {
          method: 'POST',
          headers: { Cookie: secondCookie, 'X-CSRF-Token': secondSession.csrf },
        })
      ).status,
      200,
    );
    assert.equal(
      (await fetch(`${app.base}/api/ops/metrics`, { headers: { Cookie: cookie } })).status,
      429,
    );
  } finally {
    await app.close();
  }
});

test('private mode never exposes the passwordless demo entry endpoint', async () => {
  const app = await listen(await local());
  try {
    assert.equal((await fetch(`${app.base}/api/auth/demo`, { method: 'POST' })).status, 404);
    assert.equal((await fetch(`${app.base}/api/ops/metrics`)).status, 401);
  } finally {
    await app.close();
  }
});
