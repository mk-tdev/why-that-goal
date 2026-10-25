import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createFoundryClient, type ModelCall, type FoundryOptions } from './foundryClient';
import { ProviderFailure } from './contracts';
const call: ModelCall = {
  agent: 'test',
  instructions: 'Test',
  schema: {},
  input: {},
  signal: new AbortController().signal,
};
async function harness(options: Partial<FoundryOptions>, throttle = false) {
  let received = 0;
  const server = createServer(async (req, res) => {
    for await (const _ of req) {
      /* drain request */
    }
    received++;
    if (throttle && received === 1) {
      res.writeHead(429, { 'Retry-After': '120' });
      res.end('{}');
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        status: 'completed',
        output: [{ type: 'message', content: [{ type: 'output_text', text: '{}' }] }],
      }),
    );
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const client = createFoundryClient({
    endpoint: `http://127.0.0.1:${address.port}/openai/v1/responses`,
    deployment: 'test',
    allowLocalTestEndpoint: true,
    getToken: async () => 'test-only',
    ...options,
  });
  return {
    client,
    received: () => received,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((r) => server.close(() => r()));
    },
  };
}
const capacityFailure = (e: unknown) => e instanceof ProviderFailure && e.reason === 'capacity';
test('Foundry call budget expires automatically without a restart or repeated paid requests', async () => {
  let now = 1000;
  const h = await harness({ now: () => now, maxCalls: 2, budgetWindowMs: 1000 });
  try {
    await h.client.run(call);
    await h.client.run(call);
    await assert.rejects(h.client.run(call), capacityFailure);
    assert.equal(h.received(), 2);
    assert.equal(h.client.capacity!().remainingWindow, 0);
    now += 999;
    await assert.rejects(h.client.run(call), capacityFailure);
    assert.equal(h.client.capacity!().retryAfterSeconds, 1);
    now++;
    await h.client.run(call);
    assert.equal(h.received(), 3);
    assert.equal(h.client.capacity!().remainingWindow, 1);
  } finally {
    await h.close();
  }
});
test('minute throttle recovers while retaining the longer rolling call budget', async () => {
  let now = 1000;
  const h = await harness({ now: () => now, maxCalls: 10, requestsPerMinute: 1 });
  try {
    await h.client.run(call);
    await assert.rejects(h.client.run(call), capacityFailure);
    now += 60000;
    await h.client.run(call);
    assert.equal(h.client.capacity!().remainingWindow, 8);
    assert.equal(h.received(), 2);
  } finally {
    await h.close();
  }
});
test('Azure Retry-After is honored without automatic retries and inference resumes after cooldown', async () => {
  let now = 1000;
  const h = await harness({ now: () => now }, true);
  try {
    await assert.rejects(h.client.run(call), capacityFailure);
    assert.equal(h.client.capacity!().retryAfterSeconds, 120);
    now += 119999;
    await assert.rejects(h.client.run(call), capacityFailure);
    assert.equal(h.received(), 1);
    now++;
    await h.client.run(call);
    assert.equal(h.received(), 2);
  } finally {
    await h.close();
  }
});
test('concurrent token acquisition cannot overspend the rolling budget', async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const h = await harness({
    maxCalls: 1,
    getToken: async () => {
      await gate;
      return 'test-only';
    },
  });
  try {
    const first = h.client.run(call),
      second = h.client.run(call);
    const settled = Promise.allSettled([first, second]);
    release();
    const results = await settled;
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(h.received(), 1);
    assert.equal(h.client.capacity!().remainingWindow, 0);
  } finally {
    await h.close();
  }
});
