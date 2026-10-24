import test from 'node:test';
import assert from 'node:assert/strict';
import { scenarios } from '../src/core/scenarios';
import { analyze } from './pipeline';
import { createEvidenceTools } from './evidence';
import { createRecap } from './recap';
import { readAnalysis } from '../src/core/analysisClient';
const request = (s = scenarios[0]) => ({
  scenarioId: s.id,
  through: s.duration,
  receivedThrough: s.duration,
  audience: 'fan' as const,
  language: 'en' as const,
});
for (const s of scenarios)
  test(`${s.id}: automatic recap cites available facts and actual outcome`, async () => {
    const r = await analyze(request(s));
    assert.ok(r.recap);
    assert.equal(
      r.recap.outcome,
      s.events.some((e) => e.type === 'goal')
        ? 'goal'
        : s.events.some((e) => e.type === 'save')
          ? 'save'
          : 'failed-attack',
    );
    assert.ok(
      r.recap.cards.every(
        (c) =>
          c.factIds.length && c.factIds.every((id) => r.evidence.facts.some((f) => f.id === id)),
      ),
    );
    assert.ok(r.recap.cards.at(-1)!.factIds.includes(r.recap.terminalFactId));
    const end = s.events.at(-1)!;
    assert.equal(
      (await analyze({ ...request(s), through: end.at - 0.01, receivedThrough: end.at - 0.01 }))
        .recap,
      null,
    );
    const spanish = await analyze({ ...request(s), language: 'es' });
    assert.deepEqual(
      spanish.recap!.cards.map((c) => c.factIds),
      r.recap.cards.map((c) => c.factIds),
    );
    assert.equal(r.trace.calls, 0);
  });
test('delayed and withdrawn terminal events cannot yield a final recap', () => {
  const s = structuredClone(scenarios[0]);
  const end = s.events.at(-1)!;
  end.receivedAt = s.duration + 5;
  assert.equal(createRecap(s, createEvidenceTools(s, request(s)).snapshot()), null);
  const late = { ...request(s), receivedThrough: s.duration + 6 };
  assert.equal(createRecap(s, createEvidenceTools(s, late).snapshot())!.outcome, 'goal');
  s.events.push({ ...end, version: 2, outcome: 'voided', receivedAt: s.duration + 6 });
  assert.equal(createRecap(s, createEvidenceTools(s, late).snapshot()), null);
});
test('client rejects fabricated recap citations and mismatched recap time', async () => {
  const req = request();
  const r = await analyze(req);
  const fake = structuredClone(r);
  fake.recap!.cards[0].factIds = ['invented'];
  assert.throws(() => readAnalysis(fake, req));
  const wrongTime = structuredClone(r);
  wrongTime.recap!.through += 1;
  assert.throws(() => readAnalysis(wrongTime, req));
});
