import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { securedFetch, setSessionCsrf, ApiError } from '../core/session';
type Session = { role: 'viewer' | 'operator'; csrf?: string; guest?: boolean; expiresAt: number };
type Config = {
  mode: 'local' | 'entra' | 'disabled';
  publicDemo?: boolean;
  tenantId?: string;
  clientId?: string;
  scope?: string;
};
const AccessContext = createContext<{
  session: Session;
  signOut: () => void;
  openOperator: () => void;
}>({
  session: { role: 'viewer', expiresAt: 0 },
  signOut: () => {},
  openOperator: () => {},
});
export const useAccess = () => useContext(AccessContext);
export function AccessGate({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<Config>(),
    [session, setSession] = useState<Session>(),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [attempt, setAttempt] = useState(0);
  function accept(value: Session) {
    setSessionCsrf(value.csrf);
    setSession(value);
    setError('');
  }
  useEffect(() => {
    let active = true;
    void fetch('/api/auth/config', { credentials: 'same-origin' })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const c = (await r.json()) as Config;
        if (!active) return;
        setConfig(c);
        if (c.mode === 'disabled') {
          accept({ role: 'operator', expiresAt: Date.now() + 3600000 });
          return;
        }
        try {
          const r = await fetch('/api/auth/me', { credentials: 'same-origin' });
          if (r.ok && active) accept(await r.json());
        } catch {
          if (active) setError('The access service is unavailable.');
        }
      })
      .catch(() => {
        if (active) setError('The access service is unavailable. Start the API and retry.');
      });
    const expire = () => {
      setSession(undefined);
      setSessionCsrf();
      setError('Your session ended. Sign in again to continue.');
    };
    window.addEventListener('wtg-session-expired', expire);
    return () => {
      active = false;
      window.removeEventListener('wtg-session-expired', expire);
    };
  }, [attempt]);
  useEffect(() => {
    if (!session || session.guest) return;
    const timer = setTimeout(
      () => {
        setSession(undefined);
        setSessionCsrf();
        setError('Your session ended. Sign in again to continue.');
      },
      Math.max(1, session.expiresAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [session]);
  async function signIn() {
    setBusy(true);
    setError('');
    try {
      if (config?.mode === 'local') {
        const r = await securedFetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });
        accept(await r.json());
        setPassword('');
      } else if (config?.mode === 'entra') {
        const { PublicClientApplication, BrowserCacheLocation } = await import(
          '@azure/msal-browser'
        );
        const client = new PublicClientApplication({
          auth: {
            clientId: config.clientId!,
            authority: `https://login.microsoftonline.com/${config.tenantId}`,
            redirectUri: `${window.location.origin}/redirect.html`,
          },
          cache: { cacheLocation: BrowserCacheLocation.MemoryStorage },
        });
        await client.initialize();
        const result = await client.loginPopup({ scopes: [config.scope!] });
        const r = await securedFetch('/api/auth/session', {
          method: 'POST',
          headers: { Authorization: `Bearer ${result.accessToken}` },
        });
        accept(await r.json());
        await client.clearCache();
      }
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 429
          ? `Too many attempts. Try again in ${e.retryAfter} seconds.`
          : config?.mode === 'entra'
            ? 'Microsoft sign-in did not complete. Verify the app registration and API permissions.'
            : 'Access could not be verified. Check the password and try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    try {
      await securedFetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    setSession(undefined);
    setSessionCsrf();
    if (config?.publicDemo) setAttempt((n) => n + 1);
  }
  if (session)
    return (
      <AccessContext.Provider
        value={{ session, signOut, openOperator: () => setSession(undefined) }}
      >
        {children}
      </AccessContext.Provider>
    );
  return (
    <main className="access-screen">
      <section className="access-card">
        <span className="access-brand">WTG / MATCH INTELLIGENCE</span>
        <h1>
          The play.
          <br />
          <em>Behind the finish.</em>
        </h1>
        <p>Sign in to the replay workspace.</p>
        {config?.mode === 'local' && (
          <label className="access-label">
            Workspace password
            <input
              aria-label="Workspace password"
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !busy) void signIn();
              }}
            />
          </label>
        )}
        <button
          className="access-submit"
          disabled={busy || !config || (config.mode === 'local' && !password)}
          onClick={() => void signIn()}
        >
          {busy
            ? 'Verifying access…'
            : config?.mode === 'entra'
              ? 'Sign in with Microsoft'
              : 'Enter workspace ↗'}
        </button>
        {error && (
          <p role="alert" className="access-error">
            {error}
          </p>
        )}
        {!config && (
          <button className="access-retry" onClick={() => setAttempt((n) => n + 1)}>
            Retry connection
          </button>
        )}
        {config?.publicDemo && (
          <button className="access-retry" onClick={() => setAttempt((n) => n + 1)}>
            Back to demo
          </button>
        )}
        <small>Fictional match data · evidence-linked AI stories</small>
      </section>
    </main>
  );
}
export function AccessControls() {
  const { session, signOut, openOperator } = useAccess();
  return (
    <div className="access-controls">
      <span>
        {session.guest
          ? 'Public demo'
          : session.role === 'operator'
            ? 'Operator access'
            : 'Viewer access'}
      </span>
      {session.guest ? (
        <button onClick={openOperator}>Operator sign-in</button>
      ) : (
        <button onClick={signOut}>Sign out</button>
      )}
    </div>
  );
}
