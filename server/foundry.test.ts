import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createFoundryAdapter, configuredFoundry } from './foundry';
import { analyze } from './pipeline';
import { validateNarrative } from './narrative';
import { createAnalysisService } from './analysisService';
import { scenarios } from '../src/core/scenarios';
const request = {
  scenarioId: 'quick-break',
  through: 19,
  receivedThrough: 19,
  audience: 'fan' as const,
  language: 'en' as const,
};
function draft(base: Awaited<ReturnType<typeof analyze>>) {
  const factIds = base.evidence.facts
    .filter((f) => f.kind === 'event')
    .slice(-3)
    .map((f) => f.id);
  return {
    factIds,
    story: {
      title: 'The decisive connection',
      summary: 'The supplied evidence shows the recorded sequence.',
    },
    recap: base.recap
      ? {
          title: 'The recorded outcome',
          summary: 'The terminal event determines how this attack ended.',
          cards: [
            {
              title: 'Decisive event',
              text: 'Inspect the recorded outcome on the pitch.',
              factIds: [base.recap.terminalFactId],
            },
          ],
        }
      : null,
  };
}
test('narrative provenance gates reject future recaps, invented numbers, HTML and stale citations', async () => {
  for (const scenario of scenarios) {
    const base = await analyze({
      ...request,
      scenarioId: scenario.id,
      through: scenario.duration,
      receivedThrough: scenario.duration,
    });
    assert.ok(validateNarrative(draft(base), base.evidence, base.recap).recap);
    const bad = draft(base);
    bad.recap!.cards[0].factIds = ['invented'];
    assert.throws(() => validateNarrative(bad, base.evidence, base.recap));
    const early = await analyze({
      ...request,
      scenarioId: scenario.id,
      through: 1,
      receivedThrough: 1,
    });
    assert.throws(() => validateNarrative(draft(base), early.evidence, null));
    for (const text of ['A 99 metre pass', '<script>bad</script>', 'This proved the tactic.']) {
      const value = draft(base);
      value.story.summary = text;
      assert.throws(() => validateNarrative(value, base.evidence, base.recap));
    }
    const r = await analyze(
      {
        ...request,
        scenarioId: scenario.id,
        through: scenario.duration,
        receivedThrough: scenario.duration,
      },
      { name: 'test-writer', select: async () => draft(base) },
    );
    assert.equal(r.mode, 'model-selected');
    assert.equal(r.buildup.title, 'The decisive connection');
    assert.equal(r.recap!.title, 'The recorded outcome');
    assert.equal(r.recap!.outcome, base.recap!.outcome);
  }
});
test('real Responses HTTP transport sends structured output and caches; failures fall back', async () => {
  const base = await analyze(request);
  let count = 0,
    failure = '';
  const server = createServer(async (req, res) => {
    count++;
    let body = '';
    for await (const chunk of req) body += chunk;
    const input = JSON.parse(body);
    assert.equal(req.headers.authorization, 'Bearer simulation-only');
    assert.equal(input.model, 'wtg-insights');
    assert.equal(input.store, false);
    assert.equal(input.text.format.type, 'json_schema');
    assert.ok(JSON.parse(input.input).evidence.facts.length);
    if (failure === 'slow') {
      setTimeout(() => res.end('{}'), 100);
      return;
    }
    if (failure === '429' || failure === '500') {
      res.writeHead(Number(failure));
      res.end('upstream unavailable');
      return;
    }
    const value = draft(base);
    if (failure === 'invalid') value.factIds = ['invented'];
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        status: 'completed',
        output: [
          { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] },
        ],
        usage: { input_tokens: 100, output_tokens: 50 },
      }),
    );
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const options = {
    endpoint: `http://127.0.0.1:${address.port}/openai/v1/responses`,
    deployment: 'wtg-insights',
    allowLocalTestEndpoint: true,
    getToken: async () => 'simulation-only',
  };
  try {
    const adapter = createFoundryAdapter(options);
    const first = await analyze(request, adapter);
    assert.equal(first.mode, 'model-selected');
    assert.equal(first.trace.inputTokens, 100);
    const second = await analyze(request, adapter);
    assert.equal(second.trace.calls, 0);
    assert.equal(second.trace.cacheHit, true);
    assert.equal(count, 1);
    for (const type of ['429', '500', 'invalid', 'slow']) {
      failure = type;
      const result = await analyze(
        request,
        createFoundryAdapter({ ...options, timeoutMs: type === 'slow' ? 10 : 1000 }),
      );
      assert.equal(result.mode, 'fallback');
      assert.ok(result.recap);
      assert.equal(result.recap.outcome, 'goal');
    }
    failure = '';
    assert.equal(
      (await analyze(request, createFoundryAdapter({ ...options, maxCalls: 0 }))).mode,
      'fallback',
    );
    assert.throws(() => createFoundryAdapter({ ...options, allowLocalTestEndpoint: false }));
    assert.equal(configuredFoundry({ FOUNDRY_ENABLED: 'false' }), undefined);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
});
test('AI generation is nonblocking, deduplicated and snapshot-specific', async () => {
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const service = createAnalysisService({
    name: 'writer',
    select: async ({ evidence }) => {
      calls++;
      await gate;
      return draft(await analyze(evidence.request));
    },
  });
  const initial = await service(request);
  assert.equal(initial.trace.pending, true);
  assert.equal(initial.mode, 'deterministic');
  assert.ok(initial.recap);
  await service(request);
  assert.equal(calls, 1);
  const early = await service({ ...request, through: 0, receivedThrough: 0 });
  assert.equal(early.recap, null);
  assert.equal(calls, 1);
  release();
  await new Promise((r) => setTimeout(r, 5));
  const ready = await service(request);
  assert.equal(ready.mode, 'model-selected');
  assert.equal(ready.trace.cacheHit, true);
  assert.equal(ready.evidence.request.through, 19);
});
