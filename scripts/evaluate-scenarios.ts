import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { scenarios } from '../src/core/scenarios';
import { analyze } from '../server/pipeline';
const results = [];
for (const scene of scenarios) {
  const outcome = scene.events.some((e) => e.type === 'goal')
    ? 'goal'
    : scene.events.some((e) => e.type === 'save')
      ? 'save'
      : 'interception';
  const result = await analyze({
    scenarioId: scene.id,
    through: scene.duration,
    receivedThrough: scene.duration,
    audience: 'analyst',
    language: 'en',
  });
  assert.equal(result.trace.calls, 0);
  assert.equal(result.evidence.score.home, outcome === 'goal' ? 1 : 0);
  assert.equal(
    result.buildup.title,
    outcome === 'goal'
      ? 'How the goal was built'
      : outcome === 'save'
        ? 'How the chance was built'
        : 'Where the attack broke down',
  );
  assert.ok(result.buildup.factIds.every((id) => result.evidence.facts.some((f) => f.id === id)));
  assert.equal(result.recap?.outcome, outcome === 'interception' ? 'failed-attack' : outcome);
  assert.ok(
    result.recap?.cards.every((c) =>
      c.factIds.every((id) => result.evidence.facts.some((f) => f.id === id)),
    ),
  );
  results.push({
    recap: result.recap!.title,
    scenario: scene.id,
    outcome,
    events: scene.events.length,
    shots: scene.events.filter((e) => e.type === 'shot').length,
    title: result.buildup.title,
    claims: result.buildup.factIds.length,
    modelCalls: result.trace.calls,
    checks: 'passed',
  });
}
writeFileSync(
  'docs/evaluations/scenarios.json',
  JSON.stringify(
    {
      scope:
        'Authored regression fixtures; not a held-out generalization or model-quality benchmark.',
      results,
    },
    null,
    2,
  ) + '\n',
);
console.log(`${results.length} scenario outcome/citation checks passed; Foundry disconnected.`);
