import { securedFetch } from './session';
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
  if (!data.trace || !Number.isFinite(data.trace.calls) || data.trace.calls < 0)
    throw new Error('Invalid analysis trace');
  const workflow = data.trace.workflow;
  if (workflow) {
    const validRefs = (ids: unknown) =>
      Array.isArray(ids) &&
      ids.every((id) => typeof id === 'string' && data.evidence.facts.some((f) => f.id === id));
    const validAgent = (name: unknown) =>
      ['analysis', 'storytelling', 'evidence-check'].includes(name as string);
    if (
      workflow.version !== '1.0' ||
      typeof workflow.snapshotId !== 'string' ||
      !/^[a-f0-9]{16}$/.test(workflow.snapshotId) ||
      !['running', 'approved', 'fallback'].includes(workflow.status) ||
      !Number.isInteger(workflow.modelCalls) ||
      workflow.modelCalls < 0 ||
      workflow.modelCalls > 6 ||
      !Number.isInteger(workflow.revisions) ||
      workflow.revisions < 0 ||
      workflow.revisions > 1 ||
      !Array.isArray(workflow.steps) ||
      workflow.steps.length > 6 ||
      workflow.steps.some(
        (step) =>
          !step ||
          !validAgent(step.agent) ||
          ![1, 2].includes(step.attempt) ||
          !['running', 'completed', 'revision-requested', 'rejected', 'failed'].includes(
            step.status,
          ) ||
          typeof step.summary !== 'string' ||
          !Number.isFinite(step.elapsedMs) ||
          !validRefs(step.factIds) ||
          !Array.isArray(step.toolCalls) ||
          step.toolCalls.some((t) => !t || t.name !== 'getFact' || !validRefs([t.factId])),
      ) ||
      !Array.isArray(workflow.handoffs) ||
      workflow.handoffs.some(
        (h) =>
          !h ||
          !validAgent(h.from) ||
          !validAgent(h.to) ||
          typeof h.reason !== 'string' ||
          !validRefs(h.factIds),
      ) ||
      !Array.isArray(workflow.issues) ||
      workflow.issues.some(
        (issue) =>
          !issue ||
          typeof issue.target !== 'string' ||
          typeof issue.reason !== 'string' ||
          typeof issue.detail !== 'string' ||
          !validRefs(issue.factIds),
      )
    )
      throw new Error('Invalid collaboration trace');
  }
  return data;
}
export async function fetchAnalysis(request: AnalysisRequest, signal: AbortSignal, base = '') {
  const response = await securedFetch(`${base}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  });
  if (!response.ok) throw new Error(`Evidence API returned ${response.status}`);
  return readAnalysis(await response.json(), request);
}
