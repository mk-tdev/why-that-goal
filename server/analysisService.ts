import type { Operations } from './operations';
import type { WorkflowTrace } from './agentContracts';
import { analyze, type IntelligenceAdapter } from './pipeline';
import { parseRequest, type AnalysisResponse } from './contracts';

/** Serve measured evidence immediately; poll for the same snapshot's AI story. Never block live play on inference. */
export function createAnalysisService(
  adapter?: IntelligenceAdapter,
  options: { operations?: Operations; shutdownSignal?: AbortSignal } = {},
) {
  const jobs = new Map<
    string,
    { result?: AnalysisResponse; expires: number; workflow?: WorkflowTrace }
  >();
  let active = 0;
  const buildupCheckpoints = new Map<string, { key: string; expires: number }>();
  return async (input: unknown, context: { requestId?: string; canStart?: () => boolean } = {}) => {
    const request = parseRequest(input);
    if (!adapter) return analyze(request);
    const key = JSON.stringify(request);
    const now = Date.now();
    for (const [id, entry] of jobs) if (entry.result && entry.expires < now) jobs.delete(id);
    const existing = jobs.get(key);
    if (existing?.result)
      return { ...existing.result, trace: { ...existing.result.trace, calls: 0, cacheHit: true } };
    const baseline = await analyze(request);
    if (!baseline.evidence.facts.length) return { ...baseline, provider: adapter.name };
    const checkpointKey = JSON.stringify([request.scenarioId, request.audience, request.language]);
    for (const [id, entry] of buildupCheckpoints)
      if (entry.expires < now) buildupCheckpoints.delete(id);
    const checkpoint = buildupCheckpoints.get(checkpointKey);
    const completedPasses = baseline.evidence.facts.filter(
      (f) => f.kind === 'pass-progress',
    ).length;
    if (!baseline.recap && (completedPasses < 2 || (checkpoint && checkpoint.key !== key)))
      return {
        ...baseline,
        provider: adapter.name,
        reason: 'collecting' as const,
        trace: { ...baseline.trace, pending: false },
      };
    if (!existing && jobs.size >= 128) {
      const oldest = [...jobs].find(([, entry]) => entry.result);
      if (oldest) jobs.delete(oldest[0]);
    }
    if (!existing && active < 2 && jobs.size < 128) {
      if (context.canStart && !context.canStart())
        return {
          ...baseline,
          mode: 'fallback' as const,
          provider: adapter.name,
          reason: 'capacity' as const,
          trace: { ...baseline.trace, pending: false },
          recap: baseline.recap
            ? {
                ...baseline.recap,
                limitation: 'AI generation quota reached; measured recap · synthetic data.',
              }
            : null,
        };
      const entry: { result?: AnalysisResponse; expires: number; workflow?: WorkflowTrace } = {
        expires: now + 600000,
      };
      jobs.set(key, entry);
      if (!baseline.recap) buildupCheckpoints.set(checkpointKey, { key, expires: now + 600000 });
      active++;
      options.operations?.start();
      const boundedAdapter = options.shutdownSignal
        ? {
            ...adapter,
            select: (input: Parameters<IntelligenceAdapter['select']>[0]) =>
              adapter.select({
                ...input,
                signal: AbortSignal.any([input.signal, options.shutdownSignal!]),
              }),
          }
        : adapter;
      void analyze(request, boundedAdapter, adapter.timeoutMs ?? 20000, (workflow) => {
        entry.workflow = workflow;
      })
        .then((result) => {
          entry.result = result;
          options.operations?.complete(result, context.requestId);
          entry.expires = Date.now() + (result.mode === 'fallback' ? 20000 : 600000);
        })
        .catch(() => {
          jobs.delete(key);
          options.operations?.failure(context.requestId);
        })
        .finally(() => {
          active--;
        });
    }
    return {
      ...baseline,
      provider: adapter.name,
      reason: 'generating' as const,
      trace: { ...baseline.trace, pending: true, workflow: jobs.get(key)?.workflow },
      recap: baseline.recap
        ? {
            ...baseline.recap,
            limitation:
              'Rule-based recap while Foundry prepares a cited interpretation · synthetic data.',
          }
        : null,
    };
  };
}
