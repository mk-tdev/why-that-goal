import { useEffect, useState } from 'react';
import { securedFetch } from '../core/session';
import { useAccess } from './Access';
type Metrics = {
  uptimeSeconds: number;
  requests: number;
  serverErrors: number;
  rateLimited: number;
  authDenied: number;
  workflows: {
    active: number;
    completed: number;
    approved: number;
    fallback: number;
    calls: number;
    inputTokens: number;
    outputTokens: number;
    p95Ms: number;
    approvalRate: number | null;
  };
  alerts: string[];
};
export function OperationsPanel() {
  const { session } = useAccess();
  const [data, setData] = useState<Metrics>(),
    [error, setError] = useState(''),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (session.role !== 'operator') return;
    const controller = new AbortController();
    const load = () =>
      securedFetch('/api/ops/metrics', { signal: controller.signal })
        .then((r) => r.json())
        .then((v) => {
          setData(v);
          setError('');
        })
        .catch(() => {
          if (!controller.signal.aborted) setError('Operations data is unavailable.');
        });
    void load();
    const timer = setInterval(() => void load(), 30000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [session.role, attempt]);
  if (session.role !== 'operator') return null;
  return (
    <section className="operations-panel" aria-label="Service operations">
      <header>
        <div>
          <span>LIVE SERVICE HEALTH</span>
          <h2>Operations pulse</h2>
        </div>
        <button onClick={() => setAttempt((n) => n + 1)}>Refresh metrics ↻</button>
      </header>
      {error && <p role="status">{error}</p>}
      {data && (
        <>
          <div className="ops-metrics">
            {[
              ['API requests', data.requests],
              ['Denied access', data.authDenied],
              ['Rate limited', data.rateLimited],
              ['Server errors', data.serverErrors],
              ['Active AI jobs', data.workflows.active],
              ['Reviewed stories', data.workflows.approved],
              ['AI fallbacks', data.workflows.fallback],
              ['Model requests', data.workflows.calls],
              ['Input tokens', data.workflows.inputTokens],
              ['Output tokens', data.workflows.outputTokens],
              ['AI latency p95', `${(data.workflows.p95Ms / 1000).toFixed(1)}s`],
            ].map(([label, value]) => (
              <article key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </div>
          <p>{data.alerts.length ? data.alerts.join(' · ') : 'No configured threshold alerts.'}</p>
          <small>
            Process-local counters · usage from completed workflows · last 500 latency samples ·
            refreshes every 30 seconds · not an external uptime monitor.
          </small>
        </>
      )}
    </section>
  );
}
