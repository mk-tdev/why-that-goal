import { readFile, writeFile } from 'node:fs/promises';
const read = async (file: string) =>
  JSON.parse(await readFile(`docs/evaluations/${file}.json`, 'utf8'));
const [deterministic, live, multi, load] = await Promise.all(
  ['enterprise', 'enterprise-live', 'multi-agent', 'enterprise-load'].map(read),
);
const fault = multi.fault;
const summary = {
  recordedAt: live.recordedAt,
  deterministic: {
    checks: deterministic.deterministic.checks,
    passed: deterministic.deterministic.passed,
  },
  live: live.summary,
  load: {
    requests: load.requests,
    p95Ms: load.p95Ms,
    burstLimited: load.burstLimited,
    unauthorizedDenied: load.unauthorizedDenied,
    providerInvocations: load.providerInvocations,
  },
  fault: {
    injection: fault.injection,
    structuralChecksAccepted: fault.singleAgentContractWouldAccept,
    finalMode: fault.mode,
    finalStatus: fault.trace.workflow.status,
    calls: fault.trace.calls,
    elapsedMs: fault.trace.elapsedMs,
    steps: fault.trace.workflow.steps.map(
      (s: { agent: string; status: string; attempt: number }) => ({
        agent: s.agent,
        status: s.status,
        attempt: s.attempt,
      }),
    ),
    issues: fault.trace.workflow.issues,
  },
  limits: [
    'Four authored reserved cases; not a blinded or independent benchmark.',
    'Human semantic review is pending; model review is not proof of correctness.',
    'The load test uses a controlled provider, not live Foundry scale testing.',
  ],
};
await writeFile('public/verification.json', JSON.stringify(summary, null, 2) + '\n');
console.log('Published report-derived verification summary; no model calls.');
