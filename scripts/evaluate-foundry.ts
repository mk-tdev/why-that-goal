import { writeFile } from 'node:fs/promises';
import { configuredFoundry } from '../server/foundry';
import { analyze } from '../server/pipeline';
import { scenarios } from '../src/core/scenarios';
const adapter = configuredFoundry();
if (!adapter) throw new Error('Enable Foundry in the server environment first');
const cases = [
  ...scenarios.map((s) => ({
    scenarioId: s.id,
    through: s.duration,
    receivedThrough: s.duration,
    audience: 'fan' as const,
    language: 'en' as const,
  })),
  {
    scenarioId: 'quick-break',
    through: 8,
    receivedThrough: 8,
    audience: 'analyst' as const,
    language: 'es' as const,
  },
];
const results = [];
for (let i = 0; i < cases.length; i += 2) {
  const batch = await Promise.all(
    cases.slice(i, i + 2).map(async (request) => {
      const r = await analyze(request, adapter, adapter.timeoutMs ?? 20000);
      const row = {
        request,
        mode: r.mode,
        reason: r.reason,
        trace: r.trace,
        story: r.buildup,
        recap: r.recap,
      };
      console.log(
        JSON.stringify({
          scenario: request.scenarioId,
          language: request.language,
          mode: r.mode,
          elapsedMs: r.trace.elapsedMs,
        }),
      );
      return row;
    }),
  );
  results.push(...batch);
}
await writeFile(
  'docs/evaluations/foundry.json',
  JSON.stringify(
    {
      recordedAt: new Date().toISOString(),
      scope:
        'Live Foundry integration checks on authored regression fixtures; not held-out model-quality or causal validation.',
      deployment: process.env.FOUNDRY_DEPLOYMENT,
      results,
    },
    null,
    2,
  ) + '\n',
);
if (results.some((r) => r.mode !== 'model-selected')) process.exitCode = 1;
