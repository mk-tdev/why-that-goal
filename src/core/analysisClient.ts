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
  if (
    !data.buildup ||
    typeof data.buildup.title !== 'string' ||
    typeof data.buildup.summary !== 'string' ||
    typeof data.buildup.limitation !== 'string' ||
    !Array.isArray(data.buildup.factIds) ||
    data.buildup.factIds.some((id) => !data.evidence.facts.some((f) => f.id === id))
  )
    throw new Error('Invalid buildup evidence');
  for (const fact of data.evidence.facts) {
    if (
      fact.fromTime !== undefined &&
      (!Number.isFinite(fact.fromTime) || fact.fromTime < 0 || fact.fromTime > fact.at)
    )
      throw new Error('Invalid evidence interval');
    if (
      fact.toTime !== undefined &&
      (!Number.isFinite(fact.toTime) ||
        fact.toTime < (fact.fromTime ?? 0) ||
        fact.toTime > request.through)
    )
      throw new Error('Invalid evidence interval');
  }
  if (data.recap !== null) {
    const recap = data.recap;
    const exists = (id: string) => data.evidence.facts.some((f) => f.id === id);
    if (
      !recap ||
      !['goal', 'save', 'failed-attack'].includes(recap.outcome) ||
      typeof recap.title !== 'string' ||
      typeof recap.summary !== 'string' ||
      typeof recap.limitation !== 'string' ||
      recap.through !== request.through ||
      !exists(recap.terminalFactId) ||
      !Array.isArray(recap.cards) ||
      !recap.cards.length ||
      recap.cards.some(
        (c) =>
          !c ||
          typeof c.title !== 'string' ||
          typeof c.text !== 'string' ||
          !Array.isArray(c.factIds) ||
          !c.factIds.length ||
          c.factIds.some((id) => !exists(id)),
      )
    )
      throw new Error('Invalid recap evidence');
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
