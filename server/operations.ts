import { performance } from 'node:perf_hooks';
import type { AnalysisResponse } from './contracts';
/** Fixed-window limiter. Bounded memory; never trusts caller-supplied forwarding headers. */
export class RateLimiter {
  private entries = new Map<string, { count: number; until: number }>();
  constructor(
    private now = Date.now,
    private maxKeys = 10000,
  ) {}
  take(key: string, limit: number, windowMs = 60000) {
    const now = this.now();
    for (const [id, e] of this.entries) if (e.until <= now) this.entries.delete(id);
    let entry = this.entries.get(key);
    if (!entry) {
      if (this.entries.size >= this.maxKeys)
        return { allowed: false, remaining: 0, retryAfter: 60 };
      entry = { count: 0, until: now + windowMs };
      this.entries.set(key, entry);
    }
    if (entry.count >= limit)
      return {
        allowed: false,
        remaining: 0,
        retryAfter: Math.max(1, Math.ceil((entry.until - now) / 1000)),
      };
    entry.count++;
    return {
      allowed: true,
      remaining: limit - entry.count,
      retryAfter: Math.max(1, Math.ceil((entry.until - now) / 1000)),
    };
  }
}
export type AuditRecord = {
  event: string;
  requestId?: string;
  route?: string;
  status?: number;
  elapsedMs?: number;
  role?: string;
  reason?: string;
  calls?: number;
  mode?: string;
};
export class Operations {
  private started = performance.now();
  private requests = 0;
  private errors = 0;
  private limited = 0;
  private denied = 0;
  private routes = new Map<string, { count: number; errors: number; latencies: number[] }>();
  private workflows = {
    started: 0,
    active: 0,
    completed: 0,
    approved: 0,
    fallback: 0,
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    latencies: [] as number[],
    reasons: {} as Record<string, number>,
  };
  constructor(
    private log: (record: AuditRecord) => void = (record) =>
      console.log(JSON.stringify({ ...record, timestamp: new Date().toISOString() })),
  ) {}
  audit(record: AuditRecord) {
    this.log(record);
  }
  request(route: string, status: number, elapsedMs: number, requestId: string) {
    this.requests++;
    if (status >= 500) this.errors++;
    if (status === 429) this.limited++;
    if (status === 401 || status === 403) this.denied++;
    const row = this.routes.get(route) ?? { count: 0, errors: 0, latencies: [] };
    row.count++;
    if (status >= 500) row.errors++;
    row.latencies.push(elapsedMs);
    if (row.latencies.length > 500) row.latencies.shift();
    this.routes.set(route, row);
    this.audit({
      event: 'http_request',
      requestId,
      route,
      status,
      elapsedMs: Math.round(elapsedMs),
    });
  }
  start() {
    this.workflows.started++;
    this.workflows.active++;
  }
  complete(result: AnalysisResponse, requestId?: string) {
    const w = this.workflows;
    w.active = Math.max(0, w.active - 1);
    w.completed++;
    if (result.mode === 'model-selected') w.approved++;
    else w.fallback++;
    w.calls += result.trace.calls;
    w.inputTokens += result.trace.inputTokens ?? 0;
    w.outputTokens += result.trace.outputTokens ?? 0;
    w.latencies.push(result.trace.elapsedMs);
    if (w.latencies.length > 500) w.latencies.shift();
    w.reasons[result.reason] = (w.reasons[result.reason] ?? 0) + 1;
    this.audit({
      event: 'workflow_completed',
      requestId,
      mode: result.mode,
      reason: result.reason,
      calls: result.trace.calls,
      elapsedMs: result.trace.elapsedMs,
    });
  }
  failure(requestId?: string) {
    this.workflows.active = Math.max(0, this.workflows.active - 1);
    this.workflows.fallback++;
    this.workflows.completed++;
    this.workflows.reasons.internal_error = (this.workflows.reasons.internal_error ?? 0) + 1;
    this.audit({ event: 'workflow_failed', requestId });
  }
  snapshot() {
    const p95 = (values: number[]) => {
      const sorted = [...values].sort((a, b) => a - b);
      return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? 0;
    };
    const w = this.workflows;
    return {
      uptimeSeconds: Math.floor((performance.now() - this.started) / 1000),
      requests: this.requests,
      serverErrors: this.errors,
      rateLimited: this.limited,
      authDenied: this.denied,
      routes: Object.fromEntries(
        [...this.routes].map(([key, row]) => [
          key,
          { requests: row.count, serverErrors: row.errors, p95Ms: Math.round(p95(row.latencies)) },
        ]),
      ),
      workflows: {
        ...w,
        latencies: undefined,
        p95Ms: Math.round(p95(w.latencies)),
        approvalRate: w.completed ? w.approved / w.completed : null,
      },
      alerts: [
        ...(w.completed >= 3 && w.fallback / w.completed > 0.25 ? ['High AI fallback rate'] : []),
        ...(w.active >= 2 ? ['AI job capacity busy'] : []),
        ...(this.requests >= 10 && this.errors / this.requests > 0.05
          ? ['Elevated API server errors']
          : []),
      ],
    };
  }
  prometheus() {
    const s = this.snapshot();
    return `# TYPE wtg_http_requests_total counter\nwtg_http_requests_total ${s.requests}\n# TYPE wtg_http_server_errors_total counter\nwtg_http_server_errors_total ${s.serverErrors}\n# TYPE wtg_rate_limited_total counter\nwtg_rate_limited_total ${s.rateLimited}\n# TYPE wtg_workflow_active gauge\nwtg_workflow_active ${s.workflows.active}\n# TYPE wtg_workflow_approved_total counter\nwtg_workflow_approved_total ${s.workflows.approved}\n# TYPE wtg_workflow_fallback_total counter\nwtg_workflow_fallback_total ${s.workflows.fallback}\n# TYPE wtg_model_calls_total counter\nwtg_model_calls_total ${s.workflows.calls}\n# TYPE wtg_model_input_tokens_total counter\nwtg_model_input_tokens_total ${s.workflows.inputTokens}\n# TYPE wtg_model_output_tokens_total counter\nwtg_model_output_tokens_total ${s.workflows.outputTokens}\n`;
  }
}
