import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { readAnalysis } from '../src/core/analysisClient';
import type { AnalysisRequest } from '../server/contracts';
const base = process.argv[2];
if (!base || !base.startsWith('https://')) throw new Error('Pass the public HTTPS origin');
const checks: Record<string, boolean> = {};
async function get(path: string) {
  return fetch(base + path, { signal: AbortSignal.timeout(60000) });
}
const home = await get('/');
checks.frontend = home.ok && (await home.text()).includes('id="root"');
checks.securityHeaders = !!home.headers.get('content-security-policy');
const health = await (await get('/api/health')).json();
checks.foundryConfigured = health.foundry === 'configured';
const config = await (await get('/api/auth/config')).json();
checks.publicDemo = config.publicDemo === true;
const meResponse = await get('/api/auth/me');
const me = await meResponse.json();
checks.noLoginOrSessionCookie =
  meResponse.ok &&
  me.guest === true &&
  me.role === 'viewer' &&
  !meResponse.headers.get('set-cookie');
checks.operatorProtected = (await get('/api/ops/metrics')).status === 403;
checks.secretFilesBlocked =
  (await get('/.env')).status === 404 && (await get('/server/index.ts')).status === 404;
const hostile = await fetch(base + '/api/auth/me', {
  headers: { Origin: 'https://untrusted.example' },
});
checks.originRestriction = hostile.status === 403;
const verification = await (await get('/verification.json')).json();
checks.recordedEvaluationEvidence =
  verification.live.cases === 4 &&
  verification.deterministic.checks === 40 &&
  verification.fault.steps.some((s: { status: string }) => s.status === 'revision-requested');
const workspaceResponse = await fetch(base + '/api/auth/demo', {
  method: 'POST',
  headers: { Origin: base },
});
const workspace = await workspaceResponse.json();
const cookie = workspaceResponse.headers.get('set-cookie')?.split(';')[0] ?? '';
checks.passwordlessWorkspace =
  workspaceResponse.ok && workspace.demo === true && workspace.role === 'operator' && !!cookie;
checks.workspaceMonitoring = (
  await fetch(base + '/api/ops/metrics', { headers: { Cookie: cookie } })
).ok;
checks.workspaceCsrf =
  (await fetch(base + '/api/auth/logout', { method: 'POST', headers: { Cookie: cookie } }))
    .status === 403;
checks.workspaceLogout = (
  await fetch(base + '/api/auth/logout', {
    method: 'POST',
    headers: { Cookie: cookie, 'X-CSRF-Token': workspace.csrf },
  })
).ok;
checks.workspaceRevoked =
  (await fetch(base + '/api/ops/metrics', { headers: { Cookie: cookie } })).status === 403;
const input: AnalysisRequest = {
  scenarioId: 'quick-break',
  through: 19,
  receivedThrough: 19,
  audience: 'fan',
  language: 'en',
};
let result;
const started = Date.now();
do {
  const response = await fetch(base + '/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, 200);
  result = readAnalysis(await response.json(), input);
  if (result.trace.pending) await new Promise((resolve) => setTimeout(resolve, 1500));
  else break;
} while (Date.now() - started < 120000);
checks.reviewedFoundryStory = result?.mode === 'model-selected' && result.reason === 'validated';
checks.threeConnectedAgents = ['analysis', 'storytelling', 'evidence-check'].every((agent) =>
  result?.trace.workflow?.steps.some((step) => step.agent === agent),
);
checks.goalRecap = result?.recap?.outcome === 'goal' && !!result.recap.cards.length;
// Consume one actual paced SSE sequence, including its completion frame.
const feedResponse = await get('/api/feed?scenarioId=quick-break');
const reader = feedResponse.body!.getReader();
const decoder = new TextDecoder();
let stream = '';
for (;;) {
  const part = await reader.read();
  if (part.done) break;
  stream += decoder.decode(part.value, { stream: true });
}
const frames = stream
  .split('\n\n')
  .filter((line) => line.startsWith('data: '))
  .map((line) => JSON.parse(line.slice(6)));
checks.liveFeed =
  feedResponse.ok &&
  frames.length > 2 &&
  frames.at(-1)?.complete === true &&
  frames.some((frame) => frame.events.length > 0);
const report = {
  recordedAt: new Date().toISOString(),
  origin: base,
  checks,
  passed: Object.values(checks).every(Boolean),
  generationModelCalls: result?.trace.workflow?.modelCalls ?? result?.trace.calls,
  verificationCacheHit: result?.trace.cacheHit ?? false,
  analysis: result,
  streamFrames: frames.length,
  scope:
    'Real public HTTPS app, anonymous judge access, deployed managed-identity Foundry workflow and paced synthetic SSE. Not a load/availability certification.',
};
await writeFile('docs/evaluations/deployment.json', JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify({
    checks,
    passed: report.passed,
    mode: result?.mode,
    reason: result?.reason,
    elapsedMs: result?.trace.elapsedMs,
  }),
);
if (!report.passed) process.exitCode = 1;
