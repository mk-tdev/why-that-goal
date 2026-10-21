import type { AnalysisRequest, AnalysisResponse } from '../../server/contracts';

/** Reject mismatched snapshots before any server text or coordinates reach the replay. */
export function readAnalysis(value: unknown, request: AnalysisRequest): AnalysisResponse {
  const data = value as AnalysisResponse;
  if (
    !data ||
    data.schemaVersion !== '1.0' ||
    !['deterministic', 'fallback', 'model-selected'].includes(data.mode) ||
    !data.evidence ||
    Object.entries(request).some(
      ([key, value]) => data.evidence.request?.[key as keyof AnalysisRequest] !== value,
    ) ||
    !Array.isArray(data.evidence.facts) ||
    !Array.isArray(data.moments)
  )
    throw new Error('Invalid analysis response');
  for (const fact of [...data.evidence.facts, ...data.moments]) {
    if (
      !fact ||
      typeof fact.id !== 'string' ||
      typeof fact.eventId !== 'string' ||
      !Number.isInteger(fact.version) ||
      typeof fact.text !== 'string' ||
      typeof fact.method !== 'string' ||
      !Number.isFinite(fact.at) ||
      fact.at < 0 ||
      fact.at > request.through ||
      !fact.target ||
      !Number.isFinite(fact.target.x) ||
      !Number.isFinite(fact.target.y)
    )
      throw new Error('Invalid evidence');
  }
  for (const moment of data.moments) {
    const fact = data.evidence.facts.find((f) => f.id === moment.id);
    if (
      !fact ||
      moment.replayAt !== fact.at ||
      moment.eventId !== fact.eventId ||
      moment.version !== fact.version
    )
      throw new Error('Invalid replay target');
  }
  return data;
}
export async function fetchAnalysis(request: AnalysisRequest, signal: AbortSignal, base = '') {
  const response = await fetch(`${base}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  });
  if (!response.ok) throw new Error(`Evidence API returned ${response.status}`);
  return readAnalysis(await response.json(), request);
}
