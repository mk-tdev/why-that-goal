import assert from 'node:assert/strict';
import { createFoundryAdapter } from '../server/foundry';
import { analyze } from '../server/pipeline';
const request = {
  scenarioId: 'quick-break',
  through: 19,
  receivedThrough: 19,
  audience: 'fan' as const,
  language: 'en' as const,
};
for (const path of ['', 'rate-limit/', 'unavailable/', 'invalid/', 'slow/']) {
  const adapter = createFoundryAdapter({
    endpoint: `http://127.0.0.1:4900/foundry/${path}openai/v1/responses`,
    deployment: 'wtg-insights',
    getToken: async () => 'simulation-only',
    allowLocalTestEndpoint: true,
    timeoutMs: path === 'slow/' ? 50 : 3000,
  });
  const result = await analyze(request, adapter, 4000);
  assert.equal(result.mode, path ? 'fallback' : 'model-selected');
  assert.equal(result.recap?.outcome, 'goal');
  console.log(
    JSON.stringify({ case: path || 'success', mode: result.mode, reason: result.reason }),
  );
}
