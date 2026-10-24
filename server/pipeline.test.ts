import test from 'node:test';
import assert from 'node:assert/strict';
import { scenarios } from '../src/core/scenarios';
import { parseRequest, validateSelection } from './contracts';
import { createEvidenceTools } from './evidence';
import { analyze, type IntelligenceAdapter } from './pipeline';
import { createApiServer } from './http';

const scenario = scenarios[0];
const request = {
  scenarioId: scenario.id,
  through: scenario.duration,
  receivedThrough: scenario.duration,
  audience: 'analyst' as const,
  language: 'en' as const,
};
const adapter = (select: IntelligenceAdapter['select']): IntelligenceAdapter => ({
  name: 'test-only',
  select,
});

test('offline pipeline has zero model calls and replay targets derived from evidence', async () => {
  const result = await analyze(request);
  assert.equal(result.mode, 'deterministic');
  assert.equal(result.provider, 'none');
  assert.equal(result.trace.calls, 0);
  assert.ok(result.moments.length);
  for (const m of result.moments) {
    assert.equal(m.replayAt, m.at);
    assert.deepEqual(m.target, scenario.events.find((e) => e.id === m.eventId)!.to);
  }
});
test('strict request validation rejects extra fields, malformed types and out of range times', async () => {
  for (const invalid of [
    null,
    [],
    { ...request, through: NaN },
    { ...request, through: -1 },
    { ...request, language: 'fr' },
    { ...request, apiKey: 'not-accepted' },
    { ...request, through: '16' },
  ])
    assert.throws(() => parseRequest(invalid));
  await assert.rejects(analyze({ ...request, through: scenario.duration + 1 }));
  await assert.rejects(analyze({ ...request, scenarioId: 'unknown' }));
});
test('event and receipt gates exclude future and delayed evidence', () => {
  const changed = structuredClone(scenario);
  changed.events[0].receivedAt = scenario.duration;
  const tools = createEvidenceTools(changed, { ...request, through: 8, receivedThrough: 8 });
  assert.ok(tools.snapshot().facts.every((f) => f.at <= 8 && f.eventId !== changed.events[0].id));
  assert.throws(() => tools.listEvents(0, 9));
  assert.throws(() => tools.listEvents(-1, 8));
  assert.throws(() => tools.getFact('invented'));
});
test('corrections replace old revisions and voided goals cannot be selected', () => {
  const changed = structuredClone(scenario);
  const goal = changed.events.find((e) => e.type === 'goal')!;
  changed.events.push({ ...goal, version: goal.version + 1, outcome: 'voided' });
  const packet = createEvidenceTools(changed, request).snapshot();
  assert.equal(packet.score.home, 0);
  assert.ok(packet.facts.every((f) => f.eventId !== goal.id));
  assert.throws(() => validateSelection({ factIds: [`${goal.id}@${goal.version}:event`] }, packet));
});
test('missing tracking omits spatial claims and tools return defensive copies', () => {
  const changed = structuredClone(scenario);
  changed.tracks = {};
  const tools = createEvidenceTools(changed, request);
  const packet = tools.snapshot();
  assert.ok(packet.facts.every((f) => f.kind !== 'receiver-space'));
  packet.facts[0].target.x = -100;
  assert.notEqual(tools.getFact(packet.facts[0].id).target.x, -100);
});
test('validated model selection resolves only trusted facts', async () => {
  const result = await analyze(
    request,
    adapter(async ({ evidence }) => ({ factIds: [evidence.facts[0].id] })),
  );
  assert.equal(result.mode, 'model-selected');
  assert.equal(result.trace.validated, true);
  assert.equal(result.moments.length, 1);
});
test('invented evidence, duplicate IDs, fabricated numbers and prose are rejected', async () => {
  const id = createEvidenceTools(scenario, request).snapshot().facts[0].id;
  for (const output of [
    { factIds: ['fake'] },
    { factIds: [id, id] },
    { factIds: [id], value: 999 },
    { factIds: [id], explanation: 'The run caused the goal' },
    { factIds: [] },
    null,
  ]) {
    const result = await analyze(
      request,
      adapter(async () => output),
    );
    assert.equal(result.mode, 'fallback');
    assert.equal(result.reason, 'invalid-output');
    assert.ok(result.moments.length);
  }
});
test('provider errors and hangs fall back with an abort signal', async () => {
  const failed = await analyze(
    request,
    adapter(async () => {
      throw new Error('private upstream details');
    }),
  );
  assert.equal(failed.reason, 'provider-error');
  let signal: AbortSignal | undefined;
  const timed = await analyze(
    request,
    adapter(async (input) => {
      signal = input.signal;
      return new Promise(() => {});
    }),
    10,
  );
  assert.equal(timed.reason, 'timeout');
  assert.equal(signal?.aborted, true);
  assert.ok(!JSON.stringify(failed).includes('private upstream'));
});
test('language and audience preserve evidence identities and numeric measurements', () => {
  const a = createEvidenceTools(scenario, request).snapshot();
  const b = createEvidenceTools(scenario, {
    ...request,
    language: 'es',
    audience: 'fan',
  }).snapshot();
  assert.deepEqual(
    a.facts.map((f) => [f.id, f.value, f.target]),
    b.facts.map((f) => [f.id, f.value, f.target]),
  );
  assert.notEqual(a.facts[0].text, b.facts[0].text);
});
test('real local HTTP service validates payloads and stays disconnected', async () => {
  const server = createApiServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    assert.equal((await (await fetch(`${base}/api/health`)).json()).foundry, 'disconnected');
    const post = (body: string, headers = { 'Content-Type': 'application/json' }) =>
      fetch(`${base}/api/analyze`, { method: 'POST', headers, body });
    const good = await post(JSON.stringify(request));
    assert.equal(good.status, 200);
    assert.equal((await good.json()).trace.calls, 0);
    assert.equal((await post('{')).status, 400);
    assert.equal((await post(JSON.stringify({ ...request, through: 'bad' }))).status, 400);
    assert.equal((await post('x'.repeat(9000))).status, 413);
    assert.equal((await post('{}', { 'Content-Type': 'text/plain' })).status, 415);
    assert.equal((await fetch(`${base}/api/analyze`)).status, 405);
    assert.equal((await fetch(`${base}/missing`)).status, 404);
    assert.equal(
      (
        await fetch(`${base}/api/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Origin: 'https://example.com' },
          body: JSON.stringify(request),
        })
      ).status,
      403,
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test('frontend HTTP client resolves the real backend and rejects mismatched snapshots', async () => {
  const { fetchAnalysis, readAnalysis } = await import('../src/core/analysisClient');
  const server = createApiServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    const data = await fetchAnalysis(
      request,
      new AbortController().signal,
      `http://127.0.0.1:${address.port}`,
    );
    assert.equal(data.mode, 'deterministic');
    assert.throws(() => readAnalysis(data, { ...request, language: 'es' }));
    const invalid = structuredClone(data);
    invalid.moments[0].replayAt = 999;
    assert.throws(() => readAnalysis(invalid, request));
    await assert.rejects(
      fetchAnalysis(request, AbortSignal.abort(), `http://127.0.0.1:${address.port}`),
    );
    const browser = await fetch(`http://127.0.0.1:${address.port}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:5173' },
      body: JSON.stringify(request),
    });
    assert.equal(browser.status, 200);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('buildup claims cite visible evidence and distinguish goals from saves', async () => {
  for (const scene of scenarios) {
    const result = await analyze({
      ...request,
      scenarioId: scene.id,
      through: scene.duration,
      receivedThrough: scene.duration,
    });
    for (const id of result.buildup.factIds) {
      const fact = result.evidence.facts.find((f) => f.id === id)!;
      assert.ok(fact);
      assert.ok(fact.at <= scene.duration);
      assert.ok(fact.fromTime! <= fact.toTime!);
      assert.ok(fact.toTime! <= fact.at);
    }
    if (scene.events.some((e) => e.type === 'save')) {
      assert.equal(result.buildup.title, 'How the chance was built');
      assert.match(result.buildup.summary, /saved/);
    }
  }
  const early = await analyze({ ...request, through: 8, receivedThrough: 8 });
  assert.equal(early.buildup.title, 'The buildup so far');
  assert.ok(early.evidence.facts.every((f) => f.at <= 8));
});
test('space change measures one fixed destination and reports closing as well as opening', async () => {
  const { buildupFacts } = await import('./buildup');
  const { inspectSpace } = await import('../src/core/spatial');
  const facts = buildupFacts(scenario, scenario.events, request);
  assert.ok(facts.some((f) => f.kind === 'off-ball-run'));
  for (const fact of facts.filter((f) => f.kind === 'space-change')) {
    const e = scenario.events.find((e) => e.id === fact.eventId)!;
    const before = inspectSpace(scenario, e, fact.fromTime!).receiver.receiverDistance;
    const after = inspectSpace(scenario, e, fact.toTime!).receiver.receiverDistance;
    assert.equal(fact.value, Math.round((after - before) * 10) / 10);
    assert.match(
      fact.text,
      fact.value! > 0.1 ? /opened/ : fact.value! < -0.1 ? /closed/ : /steady/,
    );
  }
});
test('missing tracking omits runs and gap changes; withdrawn passes have no buildup claims', () => {
  const changed = structuredClone(scenario);
  changed.tracks = {};
  const pass = changed.events.find((e) => e.type === 'pass')!;
  changed.events.push({ ...pass, version: pass.version + 1, outcome: 'voided' });
  const facts = createEvidenceTools(changed, request).snapshot().facts;
  assert.ok(facts.every((f) => f.kind !== 'off-ball-run' && f.kind !== 'space-change'));
  assert.ok(facts.every((f) => f.eventId !== pass.id));
});
