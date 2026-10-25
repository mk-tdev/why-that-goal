import assert from 'node:assert/strict';
import { createFoundryClient } from '../server/foundryClient';
import { createMultiAgentAdapter } from '../server/multiAgent';
import { analyze } from '../server/pipeline';
const request = {
  scenarioId: 'quick-break',
  through: 19,
  receivedThrough: 19,
  audience: 'fan' as const,
  language: 'en' as const,
};
for (const path of [
  '',
  'semantic-fault/',
  'reject/',
  'rate-limit/',
  'unavailable/',
  'invalid/',
  'slow/',
]) {
  const adapter = createMultiAgentAdapter(
    createFoundryClient({
      endpoint: `http://127.0.0.1:4900/foundry/${path}openai/v1/responses`,
      deployment: 'wtg-insights',
      getToken: async () => 'simulation-only',
      allowLocalTestEndpoint: true,
      timeoutMs: path === 'slow/' ? 50 : 3000,
    }),
  );
  const r = await analyze(request, adapter);
  assert.equal(r.mode, !path || path === 'semantic-fault/' ? 'model-selected' : 'fallback');
  assert.equal(r.recap?.outcome, 'goal');
  if (path === 'semantic-fault/') {
    assert.equal(r.trace.workflow?.revisions, 1);
    assert.equal(r.trace.calls, 5);
    assert.ok(!r.buildup.summary.includes('goalkeeper saved'));
  }
  console.log(
    JSON.stringify({
      case: path || 'success',
      mode: r.mode,
      calls: r.trace.calls,
      status: r.trace.workflow?.status,
      revisions: r.trace.workflow?.revisions,
    }),
  );
}
