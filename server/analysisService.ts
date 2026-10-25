import { analyze, type IntelligenceAdapter } from './pipeline';
import { parseRequest, type AnalysisResponse } from './contracts';

/** Serve measured evidence immediately; poll for the same snapshot's AI story. Never block live play on inference. */
export function createAnalysisService(adapter?: IntelligenceAdapter) {
  const jobs = new Map<string, { result?: AnalysisResponse; expires: number }>();
  let active = 0;
  return async (input: unknown) => {
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
    if (!existing && jobs.size >= 128) {
      const oldest = [...jobs].find(([, entry]) => entry.result);
      if (oldest) jobs.delete(oldest[0]);
    }
    if (!existing && active < 2 && jobs.size < 128) {
      const entry: { result?: AnalysisResponse; expires: number } = { expires: now + 600000 };
      jobs.set(key, entry);
      active++;
      void analyze(request, adapter, 20000)
        .then((result) => {
          entry.result = result;
          entry.expires = Date.now() + (result.mode === 'fallback' ? 20000 : 600000);
        })
        .catch(() => {
          jobs.delete(key);
        })
        .finally(() => {
          active--;
        });
    }
    return {
      ...baseline,
      provider: adapter.name,
      reason: 'generating' as const,
      trace: { ...baseline.trace, pending: true },
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
