import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage } from 'node:http';
import { scenarios } from '../src/core/scenarios';
import { streamFeed } from './feed';
import { ContractError } from './contracts';
import type { IntelligenceAdapter } from './pipeline';
import { createAnalysisService } from './analysisService';
import { createSecurity, type AuthConfig } from './security';
import { Operations, RateLimiter } from './operations';
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
async function json(req: IncomingMessage, max = 8192) {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json')
    throw new HttpError(415, 'json_required');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > max) throw new HttpError(413, 'body_too_large');
    chunks.push(Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}
export function createApiServer(
  options: {
    intervalMs?: number;
    speed?: number;
    adapter?: IntelligenceAdapter;
    auth?: AuthConfig;
    operations?: Operations;
    origins?: string[];
    requestLimit?: number;
    loginLimit?: number;
    jobLimit?: number;
    limiter?: RateLimiter;
    shutdownSignal?: AbortSignal;
  } = {},
) {
  const ops = options.operations ?? new Operations(() => {});
  const auth = options.auth ? createSecurity(options.auth) : undefined;
  const limiter = options.limiter ?? new RateLimiter();
  const analysis = createAnalysisService(options.adapter, {
    operations: ops,
    shutdownSignal: options.shutdownSignal,
  });
  const streams = new Map<string, number>();
  let totalStreams = 0;
  const origins = options.origins ?? [
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:4173',
    'http://localhost:4173',
  ];
  return createServer(async (req, res) => {
    const requestId = randomUUID(),
      started = performance.now();
    let url: URL;
    try {
      url = new URL(req.url ?? '/', 'http://localhost');
    } catch {
      res.writeHead(400, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-Request-Id': requestId,
      });
      res.end(JSON.stringify({ error: 'invalid_url', requestId }));
      ops.request('unknown', 400, performance.now() - started, requestId);
      return;
    }
    const routes = [
      '/api/health',
      '/api/ready',
      '/api/auth/config',
      '/api/auth/me',
      '/api/auth/login',
      '/api/auth/session',
      '/api/auth/logout',
      '/api/analyze',
      '/api/feed',
      '/api/ops/metrics',
      '/api/ops/prometheus',
    ];
    const route = routes.includes(url.pathname) ? url.pathname : 'unknown';
    const ip = req.socket.remoteAddress ?? 'unknown';
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    res.on('finish', () =>
      ops.request(route, res.statusCode, performance.now() - started, requestId),
    );
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    const limit = (key: string, count: number) => {
      const r = limiter.take(key, count);
      res.setHeader('X-RateLimit-Remaining', String(r.remaining));
      if (!r.allowed) {
        res.setHeader('Retry-After', String(r.retryAfter));
        throw new HttpError(429, 'rate_limit_exceeded');
      }
    };
    try {
      if (req.method === 'GET' && url.pathname === '/api/health')
        return send(200, {
          status: 'ok',
          foundry: options.adapter ? 'configured' : 'disconnected',
        });
      if (req.headers.origin && !origins.includes(req.headers.origin))
        throw new HttpError(403, 'browser_origin_not_enabled');
      if (url.pathname === '/api/auth/config' && req.method === 'GET')
        return send(200, auth?.publicConfig() ?? { mode: 'disabled' });
      if (url.pathname === '/api/auth/login') {
        if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
        limit(`login:${ip}`, options.loginLimit ?? 5);
        if (!auth || auth.mode !== 'local') throw new HttpError(404, 'local_login_not_enabled');
        const body = (await json(req, 2048)) as Record<string, unknown>;
        if (
          !body ||
          typeof body !== 'object' ||
          Array.isArray(body) ||
          Object.keys(body).some((k) => k !== 'password')
        )
          throw new HttpError(400, 'invalid_login');
        const principal = await auth.local(body.password);
        if (!principal) {
          ops.audit({ event: 'login_denied', requestId, reason: 'invalid_credentials' });
          throw new HttpError(401, 'invalid_credentials');
        }
        ops.audit({ event: 'login_succeeded', requestId, role: principal.role });
        return send(200, auth.open(req, res, principal));
      }
      let identity;
      try {
        identity = auth
          ? await auth.authenticate(req)
          : {
              principal: {
                id: 'test-loopback',
                role: 'operator' as const,
                expiresAt: Date.now() + 3600000,
              },
              method: 'bearer' as const,
            };
      } catch {
        limit(`invalid-token:${ip}`, 20);
        throw new HttpError(401, 'invalid_access_token');
      }
      if (!identity?.principal && options.auth?.publicDemo) {
        identity = {
          principal: {
            id: `guest:${ip}`,
            role: 'viewer' as const,
            expiresAt: Date.now() + 3600000,
          },
          method: 'guest' as const,
        };
      }
      if (!identity?.principal) {
        limit(`unauthenticated:${ip}`, 120);
        throw new HttpError(401, 'authentication_required');
      }
      const principal = identity.principal;
      if (
        req.method === 'POST' &&
        identity.method === 'cookie' &&
        auth &&
        !auth.csrf(req, identity.csrf!)
      )
        throw new HttpError(403, 'csrf_required');
      if (url.pathname === '/api/auth/logout') {
        if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
        auth?.close(req, res);
        ops.audit({ event: 'logout', requestId, role: principal.role });
        return send(200, { status: 'signed_out' });
      }
      limit(`requests:${principal.id}`, options.requestLimit ?? 120);
      if (url.pathname === '/api/auth/me' && req.method === 'GET')
        return send(
          200,
          auth?.info(req) ?? {
            role: principal.role,
            expiresAt: principal.expiresAt,
            guest: identity.method === 'guest',
          },
        );
      if (url.pathname === '/api/auth/session') {
        if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
        if (!auth || auth.mode !== 'entra' || identity.method !== 'bearer')
          throw new HttpError(403, 'entra_bearer_required');
        limit(`session:${principal.id}`, 10);
        return send(200, auth.open(req, res, principal));
      }
      if (url.pathname === '/api/ready' && req.method === 'GET')
        return send(200, {
          status: options.shutdownSignal?.aborted ? 'draining' : 'ready',
          authentication: auth?.mode ?? 'test-only',
          foundry: options.adapter ? 'configured' : 'disconnected',
          modelConnectivity: 'not_probed',
          requestId,
        });
      if (url.pathname.startsWith('/api/ops/')) {
        if (principal.role !== 'operator') throw new HttpError(403, 'operator_role_required');
        if (req.method !== 'GET') throw new HttpError(405, 'method_not_allowed');
        if (url.pathname === '/api/ops/metrics') return send(200, ops.snapshot());
        if (url.pathname === '/api/ops/prometheus') {
          res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' });
          res.end(ops.prometheus());
          return;
        }
        throw new HttpError(404, 'not_found');
      }
      if (options.shutdownSignal?.aborted) throw new HttpError(503, 'server_draining');
      if (url.pathname === '/api/feed') {
        if (req.method !== 'GET') throw new HttpError(405, 'method_not_allowed');
        const scenario = scenarios.find((s) => s.id === url.searchParams.get('scenarioId'));
        if (
          !scenario ||
          [...url.searchParams.keys()].some((k) => k !== 'scenarioId') ||
          url.searchParams.getAll('scenarioId').length !== 1
        )
          throw new HttpError(400, 'invalid_feed_request');
        limit(`feed:${principal.id}`, 10);
        if ((streams.get(principal.id) ?? 0) >= 2 || totalStreams >= 20) {
          res.setHeader('Retry-After', '20');
          throw new HttpError(429, 'stream_capacity_reached');
        }
        streams.set(principal.id, (streams.get(principal.id) ?? 0) + 1);
        totalStreams++;
        const expiry = setTimeout(() => res.end(), Math.max(1, principal.expiresAt - Date.now()));
        res.on('close', () => {
          clearTimeout(expiry);
          const count = (streams.get(principal.id) ?? 1) - 1;
          if (count) streams.set(principal.id, count);
          else streams.delete(principal.id);
          totalStreams--;
        });
        streamFeed(scenario, res, options.intervalMs, options.speed);
        return;
      }
      if (url.pathname !== '/api/analyze' || url.search) throw new HttpError(404, 'not_found');
      if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
      const input = await json(req);
      const result = await analysis(input, {
        requestId,
        canStart: () => limiter.take(`jobs:${principal.id}`, options.jobLimit ?? 8).allowed,
      });
      send(200, result);
    } catch (error) {
      if (res.headersSent) {
        res.end();
        return;
      }
      const status =
        error instanceof HttpError
          ? error.status
          : error instanceof SyntaxError || error instanceof ContractError
            ? 400
            : 500;
      if (status === 401) res.setHeader('WWW-Authenticate', 'Bearer');
      send(status, {
        error:
          error instanceof HttpError || error instanceof ContractError
            ? error.message
            : error instanceof SyntaxError
              ? 'invalid_json'
              : 'internal_error',
        requestId,
      });
    }
  });
}
