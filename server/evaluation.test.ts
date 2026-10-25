import test from 'node:test';
import assert from 'node:assert/strict';
import { runDeterministicEvaluation, evaluateSnapshot } from './evaluation/checks';
import { evaluationCases } from './evaluation/cases';
import { createEvidenceTools } from './evidence';
import { createRecap } from './recap';
import { evidenceFor } from '../src/core/model';
test('reserved attacks pass temporal, geometry, missing-data, duplicate and outcome oracles', async () => {
  const r = await runDeterministicEvaluation();
  assert.equal(r.checks, 40);
  assert.equal(r.passed, r.checks);
});
test('withdrawn outcomes and missing geometry never retain stale claims', async () => {
  for (const c of evaluationCases) {
    const s = structuredClone(c.scenario),
      terminal = s.events.at(-1)!;
    s.events.push({ ...terminal, version: 2, outcome: 'voided', receivedAt: s.duration });
    const req = {
      scenarioId: s.id,
      through: s.duration,
      receivedThrough: s.duration,
      audience: 'fan' as const,
      language: 'en' as const,
    };
    assert.equal(createRecap(s, createEvidenceTools(s, req).snapshot()), null);
  }
});
test('away-team recovery and shot-distance text follow the actual attacking direction', () => {
  const c = evaluationCases.find((c) => c.expected.attackingTeam === 'away')!;
  const s = c.scenario;
  assert.ok(!evidenceFor(s, s.events[0], 'fan', 'en').includes('broken down'));
  const shot = s.events.find((e) => e.type === 'shot')!;
  const metres = Math.hypot(shot.from.x, shot.from.y - 34).toFixed(1);
  assert.ok(evidenceFor(s, shot, 'fan', 'en').includes(`${metres} m`));
});
test('provider failure on reserved fixtures retains a time-bounded measured recap', async () => {
  for (const c of evaluationCases) {
    const r = await evaluateSnapshot(
      c,
      {
        scenarioId: c.id,
        through: c.scenario.duration,
        receivedThrough: c.scenario.duration,
        audience: 'fan',
        language: 'en',
      },
      {
        name: 'offline-provider',
        select: async () => {
          throw new Error('unavailable');
        },
      },
    );
    assert.equal(r.mode, 'fallback');
    assert.equal(r.recap?.outcome, c.expected.outcome);
  }
});
