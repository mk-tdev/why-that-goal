import { writeFile } from 'node:fs/promises';
import {
  runDeterministicEvaluation,
  evaluateSnapshot,
  lexicalOutcomeScreen,
} from '../server/evaluation/checks';
import { evaluationCases } from '../server/evaluation/cases';
import { createFoundryClient } from '../server/foundryClient';
import { createMultiAgentAdapter } from '../server/multiAgent';
const deterministic = await runDeterministicEvaluation();
const live = process.argv.includes('--live');
const policy = {
  maxModelCalls: 30,
  requestsPerMinute: 30,
  maxWorkflowCalls: 6,
  maxWorkflowKnownTokens: 20000,
  maxP95Ms: 30000,
  minApprovedFraction: 0.75,
};
const results = [];
if (live) {
  if (!process.env.FOUNDRY_RESPONSES_ENDPOINT || !process.env.FOUNDRY_DEPLOYMENT)
    throw new Error('Foundry endpoint and deployment required');
  const client = createFoundryClient({
    endpoint: process.env.FOUNDRY_RESPONSES_ENDPOINT,
    deployment: process.env.FOUNDRY_DEPLOYMENT,
    maxCalls: policy.maxModelCalls,
    requestsPerMinute: policy.requestsPerMinute,
  });
  const adapter = createMultiAgentAdapter(client);
  for (const c of evaluationCases) {
    const result = await evaluateSnapshot(
      c,
      {
        scenarioId: c.id,
        through: c.scenario.duration,
        receivedThrough: c.scenario.duration,
        audience: 'analyst',
        language: 'en',
      },
      adapter,
    );
    const row = {
      case: c.id,
      expected: c.expected,
      mode: result.mode,
      reason: result.reason,
      trace: result.trace,
      story: result.buildup,
      recap: result.recap,
      screen: lexicalOutcomeScreen(result, c.expected.outcome),
      humanSemanticReview: 'pending',
    };
    results.push(row);
    console.log(
      JSON.stringify({
        case: c.id,
        mode: result.mode,
        calls: result.trace.calls,
        elapsedMs: result.trace.elapsedMs,
      }),
    );
  }
}
const latencies = results.map((r) => r.trace.elapsedMs).sort((a, b) => a - b),
  p95 = latencies[Math.max(0, Math.ceil(latencies.length * 0.95) - 1)] ?? null;
const approved = results.filter((r) => r.mode === 'model-selected').length;
const gates = {
  deterministic: deterministic.checks === deterministic.passed,
  workflowCallBound: results.every((r) => r.trace.calls <= policy.maxWorkflowCalls),
  knownTokenBound: results.every(
    (r) =>
      (r.trace.inputTokens ?? 0) + (r.trace.outputTokens ?? 0) <= policy.maxWorkflowKnownTokens,
  ),
  latency: !live || (p95 !== null && p95 <= policy.maxP95Ms),
  approval: !live || approved / results.length >= policy.minApprovedFraction,
};
const report = {
  recordedAt: new Date().toISOString(),
  scope:
    'Reserved authored synthetic attacks and stress snapshots; not blinded, external football data or independent human AI accuracy. These cases exposed away-team baseline defects before the final live run. Prompts were not tuned to these live outputs. Token totals reflect reported usage, not a dollar-cost estimate; human semantic review remains pending.',
  live,
  policy,
  deterministic,
  summary: {
    cases: results.length,
    approved,
    fallback: results.length - approved,
    p95Ms: p95,
    knownInputTokens: results.reduce((s, r) => s + (r.trace.inputTokens ?? 0), 0),
    knownOutputTokens: results.reduce((s, r) => s + (r.trace.outputTokens ?? 0), 0),
  },
  gates,
  passed: Object.values(gates).every(Boolean),
  results,
};
await writeFile(
  `docs/evaluations/enterprise${live ? '-live' : ''}.json`,
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify({ summary: report.summary, gates, passed: report.passed }));
if (!report.passed) process.exitCode = 1;
