import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { readAnalysis } from '../src/core/analysisClient';
import type { AnalysisRequest } from '../server/contracts';
const base = process.argv[2];
if (!base || !base.startsWith('https://')) throw new Error('Pass the public HTTPS origin');
const rows = [];
const started = new Date().toISOString();
const request = (path: string, init: RequestInit = {}) =>
  fetch(base + path, { ...init, signal: AbortSignal.timeout(60000) });
const notices = await request('/third-party-notices.txt');
assert.equal(notices.status, 200);
assert.match(await notices.text(), /THIRD-PARTY NOTICES/);
const workspace = await request('/api/auth/demo', { method: 'POST', headers: { Origin: base } });
const cookie = workspace.headers.get('set-cookie')?.split(';')[0] ?? '';
const access = await workspace.json();
assert.ok(workspace.ok && access.demo && access.role === 'operator' && cookie);
const metrics = async () => {
  const response = await request('/api/ops/metrics', { headers: { Cookie: cookie } });
  assert.equal(response.status, 200);
  return response.json();
};
const before = await metrics();
assert.equal(before.foundryCapacity?.windowSeconds, 3600);
assert.equal(before.foundryCapacity?.callsPerWindow, 200);
for (const [scenarioId, through, outcome] of [
  ['quick-break', 19, 'goal'],
  ['cutback-save', 21, 'save'],
  ['counter-cut-out', 14, 'failed-attack'],
] as const) {
  // Pace this small live check; do not run a paid load test against the public deployment.
  const capacity = (await metrics()).foundryCapacity;
  if (capacity.remainingMinute < 6 || capacity.retryAfterSeconds > 0)
    await new Promise((r) =>
      setTimeout(r, Math.min(60000, Math.max(1000, capacity.retryAfterSeconds * 1000 || 60000))),
    );
  const input: AnalysisRequest = {
    scenarioId,
    through,
    receivedThrough: through,
    audience: 'fan',
    language: 'en',
  };
  const at = Date.now();
  let result;
  let generationObserved = false;
  do {
    const response = await request('/api/analyze', {
      method: 'POST',
      headers: { Origin: base, 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    assert.equal(response.status, 200);
    result = readAnalysis(await response.json(), input);
    if (!result.trace.pending) break;
    generationObserved = true;
    await new Promise((r) => setTimeout(r, 2000));
  } while (Date.now() - at < 110000);
  const row = {
    scenarioId,
    expectedOutcome: outcome,
    actualOutcome: result?.recap?.outcome,
    mode: result?.mode,
    reason: result?.reason,
    cacheHit: result?.trace.cacheHit ?? false,
    generationObserved,
    workflowStatus: result?.trace.workflow?.status,
    roles: [...new Set(result?.trace.workflow?.steps.map((s) => s.agent))],
    modelCalls: result?.trace.workflow?.modelCalls,
    steps: result?.trace.workflow?.steps.map(({ agent, attempt, status, summary }) => ({
      agent,
      attempt,
      status,
      summary,
    })),
    issues: result?.trace.workflow?.issues,
    elapsedMs: Date.now() - at,
    clickableEvidence: !!result?.recap?.cards.every(
      (c) =>
        c.factIds.length > 0 &&
        c.factIds.every((id) => result?.evidence.facts.some((f) => f.id === id)),
    ),
  };
  rows.push(row);
  console.log(JSON.stringify(row));
}
const after = await metrics();
await request('/api/auth/logout', {
  method: 'POST',
  headers: { Cookie: cookie, 'X-CSRF-Token': access.csrf },
});
const report = {
  recordedAt: started,
  origin: base,
  anonymousReplay: true,
  passwordlessWorkspace: true,
  publicNotices: true,
  capacityBefore: before.foundryCapacity,
  capacityAfter: after.foundryCapacity,
  cases: rows,
  passed: rows.every(
    (r) =>
      r.mode === 'model-selected' &&
      r.workflowStatus === 'approved' &&
      r.actualOutcome === r.expectedOutcome &&
      r.clickableEvidence &&
      r.roles.length === 3,
  ),
  scope:
    'Small real public-deployment judge walkthrough with managed-identity Foundry. Each first uncached workflow may incur charges. Cached results are explicit. Not an uptime guarantee, traffic forecast or independent semantic accuracy assessment.',
};
await writeFile('docs/evaluations/judging-access.json', JSON.stringify(report, null, 2) + '\n');
if (!report.passed) process.exitCode = 1;
