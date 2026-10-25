import { writeFile } from 'node:fs/promises';
import { createFoundryClient, type ModelClient } from '../server/foundryClient';
import { createFoundryAdapter } from '../server/foundry';
import { createMultiAgentAdapter } from '../server/multiAgent';
import { analyze } from '../server/pipeline';
import { validateNarrative } from '../server/narrative';
const options = {
  endpoint: process.env.FOUNDRY_RESPONSES_ENDPOINT!,
  deployment: process.env.FOUNDRY_DEPLOYMENT!,
  requestsPerMinute: 30,
  maxCalls: 30,
};
const client = createFoundryClient(options);
const baseRequest = {
  scenarioId: 'quick-break',
  through: 19,
  receivedThrough: 19,
  audience: 'fan' as const,
  language: 'en' as const,
};
const results = [];
for (const request of [
  baseRequest,
  { ...baseRequest, scenarioId: 'cutback-save', through: 20, receivedThrough: 20 },
  { ...baseRequest, scenarioId: 'counter-cut-out', through: 14, receivedThrough: 14 },
]) {
  // Clamp the fixture cutoff through its actual duration using known authored fixture values below.
  const { scenarios } = await import('../src/core/scenarios');
  const scene = scenarios.find((s) => s.id === request.scenarioId)!;
  request.through = scene.duration;
  request.receivedThrough = scene.duration;
  const single = await analyze(request, createFoundryAdapter(options), 20000);
  const multi = await analyze(request, createMultiAgentAdapter(client));
  const record = {
    request,
    single: { mode: single.mode, trace: single.trace, story: single.buildup, recap: single.recap },
    multi: {
      mode: multi.mode,
      reason: multi.reason,
      trace: multi.trace,
      story: multi.buildup,
      recap: multi.recap,
    },
  };
  results.push(record);
  console.log(
    JSON.stringify({
      scenario: request.scenarioId,
      single: single.mode,
      multi: multi.mode,
      calls: multi.trace.calls,
      revisions: multi.trace.workflow?.revisions,
      elapsedMs: multi.trace.elapsedMs,
    }),
  );
}
// Controlled semantic fault: valid citation IDs but a false save in a goal sequence.
let injected = false,
  hostAccepted = false;
const faultClient: ModelClient = {
  run: async (call) => {
    const result = await client.run(call);
    if (call.agent === 'storytelling' && !injected) {
      injected = true;
      const value = structuredClone(result.value) as { story: { summary: string } };
      value.story.summary = 'The goalkeeper saved the shot and the attack ended without a goal.';
      const baseline = await analyze(baseRequest);
      validateNarrative(value, baseline.evidence, baseline.recap);
      hostAccepted = true;
      return { ...result, value };
    }
    return result;
  },
};
const recovered = await analyze(baseRequest, createMultiAgentAdapter(faultClient));
const fault = {
  injection: 'A false save in the goal story; citation structure remains valid.',
  singleAgentContractWouldAccept: hostAccepted,
  mode: recovered.mode,
  reason: recovered.reason,
  trace: recovered.trace,
  story: recovered.buildup,
  recap: recovered.recap,
};
console.log(
  JSON.stringify({
    case: 'controlled-outcome-fault',
    hostAccepted,
    mode: recovered.mode,
    issues: recovered.trace.workflow?.issues.map((i) => i.reason),
    revisions: recovered.trace.workflow?.revisions,
  }),
);
await writeFile(
  'docs/evaluations/multi-agent.json',
  JSON.stringify(
    {
      recordedAt: new Date().toISOString(),
      scope:
        'Small authored regression comparison plus one controlled semantic fault; not a held-out quality benchmark or proof of general superiority. Same deployed model in all roles; extra review incurs additional tokens and latency.',
      deployment: options.deployment,
      results,
      fault,
    },
    null,
    2,
  ) + '\n',
);
if (
  results.some((r) => r.multi.mode !== 'model-selected') ||
  !hostAccepted ||
  recovered.trace.workflow?.issues.every((i) => i.reason !== 'wrong-outcome') ||
  recovered.mode !== 'model-selected' ||
  recovered.buildup.summary.includes('goalkeeper saved')
)
  process.exitCode = 1;
