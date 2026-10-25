import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
const scrypt = promisify(scryptCallback);
export type Principal = {
  id: string;
  role: 'viewer' | 'operator';
  expiresAt: number;
  demo?: boolean;
};
export type AuthConfig = {
  mode: 'local' | 'entra';
  secureCookies: boolean;
  publicDemo?: boolean;
  operatorHash?: string;
  viewerHash?: string;
  tenantId?: string;
  clientId?: string;
  audience?: string;
  scope?: string;
  sessionTtlMs?: number;
  jwks?: JWTVerifyGetKey;
  now?: () => number;
};
export type Session = { principal: Principal; csrf: string; expiresAt: number };
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${((await scrypt(password, salt, 32)) as Buffer).toString('hex')}`;
}
async function matches(password: string, hash?: string) {
  const [scheme, salt, encoded] = (hash ?? '').split('$');
  if (scheme !== 'scrypt' || !salt || !encoded || !/^[a-f0-9]{64}$/.test(encoded)) return false;
  const actual = (await scrypt(password, salt, 32)) as Buffer;
  return timingSafeEqual(actual, Buffer.from(encoded, 'hex'));
}
export function createSecurity(config: AuthConfig) {
  const now = config.now ?? Date.now;
  if (
    config.mode === 'local' &&
    !config.publicDemo &&
    !/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(config.operatorHash ?? '')
  )
    throw new Error('Local authentication requires a password hash');
  if (
    config.mode === 'entra' &&
    (!config.tenantId || !config.clientId || !config.audience || !config.scope)
  )
    throw new Error('Entra authentication requires tenant/client/audience/scope');
  const guid = /^[a-f0-9-]{36}$/i;
  if (
    config.mode === 'entra' &&
    (!guid.test(config.tenantId!) || !guid.test(config.clientId!) || !guid.test(config.audience!))
  )
    throw new Error('Invalid Entra tenant or client ID');
  const issuer = `https://login.microsoftonline.com/${config.tenantId}/v2.0`;
  const jwks =
    config.mode === 'entra'
      ? (config.jwks ??
        createRemoteJWKSet(
          new URL(`https://login.microsoftonline.com/${config.tenantId}/discovery/v2.0/keys`),
          { timeoutDuration: 5000, cooldownDuration: 30000 },
        ))
      : undefined;
  const sessions = new Map<string, Session>();
  const cookieName = config.secureCookies ? '__Host-wtg_session' : 'wtg_session';
  const cookiePath = config.secureCookies ? '/' : '/api';
  function session(req: IncomingMessage) {
    const raw = req.headers.cookie
      ?.split(';')
      .map((v) => v.trim())
      .find((v) => v.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1);
    if (!raw || !/^[a-f0-9]{64}$/.test(raw)) return;
    const key = digest(raw),
      s = sessions.get(key);
    if (!s || s.expiresAt <= now()) {
      sessions.delete(key);
      return;
    }
    return { key, ...s };
  }
  function revoke(req: IncomingMessage) {
    const s = session(req);
    if (s) sessions.delete(s.key);
  }
  async function bearer(req: IncomingMessage): Promise<Principal | undefined> {
    if (!req.headers.authorization) return;
    if (config.mode !== 'entra' || !/^Bearer [^ ]+$/.test(req.headers.authorization))
      throw new Error('Invalid bearer');
    const { payload } = await jwtVerify(req.headers.authorization.slice(7), jwks!, {
      issuer,
      audience: config.audience,
      algorithms: ['RS256'],
      requiredClaims: ['exp', 'iat', 'nbf', 'tid', 'oid', 'scp', 'azp', 'ver'],
      clockTolerance: 5,
    });
    if (
      payload.tid !== config.tenantId ||
      payload.azp !== config.clientId ||
      payload.ver !== '2.0' ||
      typeof payload.oid !== 'string' ||
      !guid.test(payload.oid) ||
      typeof payload.scp !== 'string' ||
      !payload.scp.split(' ').includes(config.scope!) ||
      typeof payload.iat !== 'number' ||
      payload.iat * 1000 > now() + 60000
    )
      throw new Error('Invalid claims');
    const roles = Array.isArray(payload.roles) ? payload.roles : [];
    return {
      id: digest(`${payload.tid}:${payload.oid}`),
      role: roles.includes('WTG.Operator') ? 'operator' : 'viewer',
      expiresAt: payload.exp! * 1000,
    };
  }
  return {
    mode: config.mode,
    publicConfig: () => ({
      mode: config.mode,
      publicDemo: config.publicDemo ?? false,
      ...(config.mode === 'entra'
        ? {
            tenantId: config.tenantId,
            clientId: config.clientId,
            scope: `api://${config.audience}/${config.scope}`,
          }
        : {}),
    }),
    async local(password: unknown): Promise<Principal | undefined> {
      if (config.mode !== 'local' || typeof password !== 'string' || password.length > 256) return;
      const [operator, viewer] = await Promise.all([
        matches(password, config.operatorHash),
        matches(password, config.viewerHash),
      ]);
      if (!operator && !viewer) return;
      return {
        id: operator ? 'local-operator' : 'local-viewer',
        role: operator ? 'operator' : 'viewer',
        expiresAt: now() + (config.sessionTtlMs ?? 900000),
      };
    },
    async authenticate(req: IncomingMessage) {
      if (req.headers.authorization)
        return { principal: await bearer(req), method: 'bearer' as const };
      const s = session(req);
      return s ? { principal: s.principal, method: 'cookie' as const, csrf: s.csrf } : undefined;
    },
    csrf(req: IncomingMessage, csrf: string) {
      const value = req.headers['x-csrf-token'];
      return (
        typeof value === 'string' &&
        Buffer.byteLength(value) === Buffer.byteLength(csrf) &&
        timingSafeEqual(Buffer.from(value), Buffer.from(csrf))
      );
    },
    open(req: IncomingMessage, res: ServerResponse, principal: Principal) {
      for (const [key, s] of sessions) if (s.expiresAt <= now()) sessions.delete(key);
      if (sessions.size >= 1000) throw new Error('Session capacity reached');
      revoke(req);
      const token = randomBytes(32).toString('hex'),
        csrf = randomBytes(24).toString('hex');
      const expiresAt = Math.min(principal.expiresAt, now() + (config.sessionTtlMs ?? 900000));
      const value = { principal: { ...principal, expiresAt }, csrf, expiresAt };
      sessions.set(digest(token), value);
      res.setHeader(
        'Set-Cookie',
        `${cookieName}=${token}; Path=${cookiePath}; HttpOnly; SameSite=Strict; Max-Age=${Math.max(0, Math.floor((expiresAt - now()) / 1000))}${config.secureCookies ? '; Secure' : ''}`,
      );
      return { role: principal.role, csrf, expiresAt, ...(principal.demo ? { demo: true } : {}) };
    },
    close(req: IncomingMessage, res: ServerResponse) {
      revoke(req);
      res.setHeader(
        'Set-Cookie',
        `${cookieName}=; Path=${cookiePath}; HttpOnly; SameSite=Strict; Max-Age=0${config.secureCookies ? '; Secure' : ''}`,
      );
    },
    info(req: IncomingMessage) {
      const s = session(req);
      return s
        ? {
            role: s.principal.role,
            csrf: s.csrf,
            expiresAt: s.expiresAt,
            ...(s.principal.demo ? { demo: true } : {}),
          }
        : undefined;
    },
  };
}
export function configuredSecurity(env = process.env): AuthConfig {
  const mode = env.AUTH_MODE ?? 'local';
  if (mode !== 'local' && mode !== 'entra') throw new Error('AUTH_MODE must be local or entra');
  if (env.NODE_ENV === 'production' && mode !== 'entra' && env.PUBLIC_DEMO !== 'true')
    throw new Error('Production requires Entra authentication');
  if (env.NODE_ENV === 'production') {
    const origins = (env.APP_ORIGINS ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    if (
      !origins.length ||
      origins.some((origin) => {
        try {
          const url = new URL(origin);
          return url.protocol !== 'https:' || url.origin !== origin;
        } catch {
          return true;
        }
      })
    )
      throw new Error('Production requires explicit HTTPS APP_ORIGINS');
  }
  const ttl = Number(env.AUTH_SESSION_SECONDS ?? 900);
  if (!Number.isInteger(ttl) || ttl < 60 || ttl > 3600) throw new Error('Invalid session duration');
  return {
    mode,
    publicDemo: env.PUBLIC_DEMO === 'true',
    secureCookies: env.NODE_ENV === 'production',
    sessionTtlMs: ttl * 1000,
    operatorHash: env.AUTH_OPERATOR_PASSWORD_HASH,
    viewerHash: env.AUTH_VIEWER_PASSWORD_HASH,
    tenantId: env.ENTRA_TENANT_ID,
    clientId: env.ENTRA_CLIENT_ID,
    audience: env.ENTRA_API_AUDIENCE,
    scope: env.ENTRA_API_SCOPE ?? 'access_as_user',
  };
}
