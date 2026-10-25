import { writeFile } from 'node:fs/promises';
import { createFoundryClient } from '../server/foundryClient';
import { createMultiAgentAdapter } from '../server/multiAgent';
import { analyze } from '../server/pipeline';
import type { AnalysisRequest } from '../server/contracts';
const endpoint = process.env.FOUNDRY_RESPONSES_ENDPOINT;
const deployment = process.env.FOUNDRY_DEPLOYMENT;
if (!endpoint || !deployment)
  throw new Error('Configure server-side Foundry endpoint and deployment');
const client = createFoundryClient({ endpoint, deployment, maxCalls: 42 });
const adapter = createMultiAgentAdapter(client);
const cases: (AnalysisRequest & { label: string })[] = [
  {
    label: 'goal-first',
    scenarioId: 'quick-break',
    through: 19,
    receivedThrough: 19,
    audience: 'fan',
    language: 'en',
  },
  {
    label: 'goal-repeat',
    scenarioId: 'quick-break',
    through: 19,
    receivedThrough: 19,
    audience: 'fan',
    language: 'en',
  },
  {
    label: 'goal-analyst',
    scenarioId: 'quick-break',
    through: 19,
    receivedThrough: 19,
    audience: 'analyst',
    language: 'en',
  },
  {
    label: 'save',
    scenarioId: 'cutback-save',
    through: 21,
    receivedThrough: 21,
    audience: 'fan',
    language: 'en',
  },
  {
    label: 'interception',
    scenarioId: 'counter-cut-out',
    through: 14,
    receivedThrough: 14,
    audience: 'fan',
    language: 'en',
  },
  {
    label: 'spanish-analyst',
    scenarioId: 'quick-break',
    through: 19,
    receivedThrough: 19,
    audience: 'analyst',
    language: 'es',
  },
  {
    label: 'nonterminal',
    scenarioId: 'quick-break',
    through: 8,
    receivedThrough: 8,
    audience: 'fan',
    language: 'en',
  },
];
const rows = [];
for (const { label, ...request } of cases) {
  const capacity = client.capacity!();
  if (capacity.remainingMinute < 6 || capacity.retryAfterSeconds > 0) {
    console.log(JSON.stringify({ pacing: true, beforeCase: label }));
    await new Promise((r) => setTimeout(r, 60000));
  }
  const result = await analyze(request, adapter);
  const row = {
    label,
    request,
    mode: result.mode,
    reason: result.reason,
    outcome: result.recap?.outcome ?? null,
    elapsedMs: result.trace.elapsedMs,
    modelCalls: result.trace.calls,
    inputTokens: result.trace.inputTokens,
    outputTokens: result.trace.outputTokens,
    workflow: result.trace.workflow,
    story: result.buildup,
    recap: result.recap,
  };
  rows.push(row);
  console.log(
    JSON.stringify({
      label,
      mode: row.mode,
      reason: row.reason,
      calls: row.modelCalls,
      elapsedMs: row.elapsedMs,
    }),
  );
  await writeFile(
    'docs/evaluations/validation-repair-live.json',
    JSON.stringify(
      {
        recordedAt: new Date().toISOString(),
        cases: rows,
        passed:
          rows.length === cases.length &&
          rows.every((r) => r.mode === 'model-selected' && r.workflow?.status === 'approved'),
        scope:
          'Seven predeclared fresh local-coordinator workflows using the real Foundry deployment, no adapter cache. Repeated authored goal plus audience/language/save/interception/early-snapshot coverage. No failing case is rerun until green. Not blinded, independent accuracy, an A/B benchmark or a proof that semantic rejection cannot recur. Production managed-identity access is checked separately.',
      },
      null,
      2,
    ) + '\n',
  );
}
if (!rows.every((r) => r.mode === 'model-selected')) process.exitCode = 1;
