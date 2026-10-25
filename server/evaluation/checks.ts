import assert from 'node:assert/strict';
import type { AnalysisRequest, AnalysisResponse } from '../contracts';
import { analyze, type IntelligenceAdapter } from '../pipeline';
import { evaluationCases, type EvaluationCase } from './cases';
export async function evaluateSnapshot(
  c: EvaluationCase,
  request: AnalysisRequest,
  adapter?: IntelligenceAdapter,
) {
  const result = await analyze(request, adapter, adapter?.timeoutMs ?? 5000, undefined, c.scenario);
  for (const fact of result.evidence.facts) {
    const candidates = c.scenario.events.filter(
      (e) =>
        e.id === fact.eventId && e.at <= request.through && e.receivedAt <= request.receivedThrough,
    );
    assert.ok(
      candidates.some((e) => e.version === fact.version && e.outcome !== 'voided'),
      'Evidence must resolve to an available source event',
    );
    assert.equal(
      fact.version,
      Math.max(...candidates.map((e) => e.version)),
      'Evidence must use the latest available revision',
    );
    assert.ok(fact.at <= request.through);
    assert.ok(fact.toTime === undefined || fact.toTime <= request.through);
    assert.ok(Number.isFinite(fact.target.x) && Number.isFinite(fact.target.y));
    if (fact.kind === 'pass-distance') {
      const e = c.scenario.events.find((e) => e.id === fact.eventId && e.version === fact.version)!;
      assert.equal(
        fact.value,
        Math.round(Math.hypot(e.to.x - e.from.x, e.to.y - e.from.y) * 10) / 10,
        'Independent pass-distance oracle',
      );
    }
  }
  const terminal = c.scenario.events.at(-1)!;
  const terminalVisible =
    terminal.at <= request.through &&
    terminal.receivedAt <= request.receivedThrough &&
    terminal.outcome !== 'voided';
  assert.equal(result.recap !== null, terminalVisible, 'Recap requires visible terminal event');
  if (result.recap) {
    assert.equal(result.recap.outcome, c.expected.outcome);
    for (const card of result.recap.cards)
      for (const id of card.factIds) assert.ok(result.evidence.facts.some((f) => f.id === id));
  }
  return result;
}
export function lexicalOutcomeScreen(
  r: AnalysisResponse,
  expected: EvaluationCase['expected']['outcome'],
) {
  const prose = [
    r.buildup.summary,
    r.recap?.summary,
    ...(r.recap?.cards.map((c) => c.text) ?? []),
  ].join(' ');
  const mentions =
    expected === 'goal'
      ? /\bgoal\b/i.test(prose)
      : expected === 'save'
        ? /\b(saved|stopped|save)\b/i.test(prose)
        : /\b(intercept|interception|possession was lost|lost possession)/i.test(prose);
  return {
    mentionsExpectedOutcome: mentions,
    note: 'Lexical screening only; not an independent semantic-accuracy score. Human review remains required.',
  };
}
export async function runDeterministicEvaluation() {
  const rows = [];
  for (const c of evaluationCases) {
    for (const cut of [0, 1, 3.9, 4, 7.9, 8, c.scenario.duration]) {
      const request: AnalysisRequest = {
        scenarioId: c.id,
        through: cut,
        receivedThrough: cut,
        audience: 'analyst',
        language: 'en',
      };
      await evaluateSnapshot(c, request);
      rows.push({ id: c.id, case: 'snapshot', cut, status: 'passed' });
    }
    const request: AnalysisRequest = {
      scenarioId: c.id,
      through: c.scenario.duration,
      receivedThrough: c.scenario.duration,
      audience: 'analyst',
      language: 'en',
    };
    const noTracks = structuredClone(c);
    noTracks.scenario.tracks = {};
    const absent = await evaluateSnapshot(noTracks, request);
    assert.ok(
      absent.evidence.facts.every(
        (f) => !['receiver-space', 'off-ball-run', 'space-change'].includes(f.kind),
      ),
    );
    rows.push({ id: c.id, case: 'missing-tracking', status: 'passed' });
    const delayed = structuredClone(c);
    delayed.scenario.events.at(-1)!.receivedAt = c.scenario.duration + 2;
    await evaluateSnapshot(delayed, request);
    rows.push({ id: c.id, case: 'delayed-terminal', status: 'passed' });
    const duplicates = structuredClone(c);
    duplicates.scenario.events.splice(1, 0, structuredClone(duplicates.scenario.events[0]));
    const dedup = await evaluateSnapshot(duplicates, request);
    assert.equal(new Set(dedup.evidence.facts.map((f) => f.id)).size, dedup.evidence.facts.length);
    rows.push({ id: c.id, case: 'duplicate-event', status: 'passed' });
    const r = await evaluateSnapshot(c, request);
    if (!c.expected.runs) assert.ok(r.evidence.facts.every((f) => f.kind !== 'off-ball-run'));
    const expectedKind = c.expected.space === 'closing' ? 'closed' : 'opened';
    assert.ok(
      r.evidence.facts.some(
        (f) =>
          f.kind === 'space-change' &&
          f.eventId.endsWith('second') &&
          (expectedKind === 'closed' ? (f.value ?? 0) < 0 : (f.value ?? 0) > 0),
      ) || c.expected.outcome === 'failed-attack',
      'Independent space-direction fixture expectation',
    );
  }
  return {
    recordedAt: new Date().toISOString(),
    scope:
      'Four new authored reserved attacks with deterministic temporal, geometry, missing-data and duplicate stress checks. Not external/blinded football data or statistical AI accuracy.',
    checks: rows.length,
    passed: rows.length,
    rows,
  };
}
