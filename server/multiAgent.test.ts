import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from './pipeline';
import { createMultiAgentAdapter, mergeRevision, reviewTargets, validatePlan } from './multiAgent';
import { ProviderFailure, type AnalysisRequest } from './contracts';
import type { ModelCall, ModelClient } from './foundryClient';
import type { WorkflowTrace } from './agentContracts';
const request: AnalysisRequest = {
  scenarioId: 'quick-break',
  through: 19,
  receivedThrough: 19,
  audience: 'fan',
  language: 'en',
};
function plan(call: ModelCall) {
  const p = call.input as {
    evidence: { facts: { id: string; kind: string }[] };
    terminalFactId: string | null;
  };
  const run = p.evidence.facts.find((f) => f.kind === 'off-ball-run');
  const ids = [
    ...(run ? [run.id] : []),
    ...(p.terminalFactId ? [p.terminalFactId] : [p.evidence.facts[0].id]),
  ];
  return {
    factIds: [...new Set(ids)],
    findings: [
      ...(run ? [{ kind: 'run', factIds: [run.id] }] : []),
      {
        kind: p.terminalFactId ? 'outcome' : 'context',
        factIds: [p.terminalFactId ?? p.evidence.facts[0].id],
      },
    ],
  };
}
function story(call: ModelCall) {
  const p = call.input as {
    evidence: { facts: { id: string }[] };
    terminalRecap: { terminalFactId: string } | null;
  };
  return {
    factIds: p.evidence.facts.slice(0, 6).map((f) => f.id),
    story: { title: 'A cited account', summary: 'The evidence describes how this move developed.' },
    recap: p.terminalRecap
      ? {
          title: 'The finish',
          summary: 'The recorded outcome ends the sequence.',
          cards: [
            {
              title: 'Recorded outcome',
              text: 'Inspect the terminal event for the outcome.',
              factIds: [p.terminalRecap.terminalFactId],
            },
          ],
        }
      : null,
  };
}
function review(call: ModelCall, decision = 'approve') {
  const p = call.input as {
    draft: ReturnType<typeof story>;
    terminalRecap: { terminalFactId: string };
  };
  return {
    decision,
    coveredTargets: reviewTargets(p.draft),
    issues:
      decision === 'approve'
        ? []
        : [
            {
              target: 'story',
              reason: 'wrong-outcome',
              detail: 'The terminal event records a goal, not a save.',
              factIds: [p.terminalRecap.terminalFactId],
            },
          ],
  };
}
function model(override?: (call: ModelCall, index: number) => unknown | Promise<unknown>) {
  const calls: ModelCall[] = [];
  const client: ModelClient = {
    async run(call) {
      calls.push({ ...call, input: structuredClone(call.input) });
      const value =
        (await override?.(call, calls.length)) ??
        (call.agent === 'analysis'
          ? plan(call)
          : call.agent === 'storytelling'
            ? story(call)
            : review(call));
      return { value, inputTokens: 100, outputTokens: 30 };
    },
  };
  return { client, calls };
}
test('three specialized agents exchange hydrated state and publish only after full review', async () => {
  const { client, calls } = model();
  const progress: WorkflowTrace[] = [];
  const r = await analyze(request, createMultiAgentAdapter(client), 2000, (t) => progress.push(t));
  assert.equal(r.mode, 'model-selected');
  assert.deepEqual(
    calls.map((c) => c.agent),
    ['analysis', 'storytelling', 'evidence_check'],
  );
  assert.equal(r.trace.calls, 3);
  assert.equal(r.trace.inputTokens, 300);
  assert.equal(r.trace.workflow?.status, 'approved');
  assert.equal(r.trace.workflow?.handoffs.length, 2);
  const { readAnalysis } = await import('../src/core/analysisClient');
  assert.equal(readAnalysis(r, request).trace.workflow?.status, 'approved');
  const invalid = structuredClone(r);
  invalid.trace.workflow!.steps[0].factIds = ['future'];
  assert.throws(() => readAnalysis(invalid, request));
  const writer = calls[1].input as {
    analysis: { factIds: string[] };
    evidence: { facts: { id: string }[] };
  };
  assert.deepEqual(
    writer.evidence.facts.map((f) => f.id),
    writer.analysis.factIds,
  );
  assert.ok((calls[2].input as typeof writer).evidence.facts.length > writer.evidence.facts.length);
  assert.ok(
    progress.some((t) =>
      t.steps.some((s) => s.agent === 'evidence-check' && s.status === 'running'),
    ),
  );
  progress[0].status = 'fallback';
  assert.equal(r.trace.workflow?.status, 'approved');
});
test('review sends concrete correction to writer, then independently checks the revised draft', async () => {
  let reviews = 0;
  const { client, calls } = model((call) =>
    call.agent === 'evidence_check'
      ? review(call, ++reviews === 1 ? 'revise' : 'approve')
      : undefined,
  );
  const r = await analyze(request, createMultiAgentAdapter(client));
  assert.equal(r.mode, 'model-selected');
  assert.equal(r.trace.calls, 5);
  assert.equal(r.trace.workflow?.revisions, 1);
  assert.deepEqual(
    calls.map((c) => c.agent),
    ['analysis', 'storytelling', 'evidence_check', 'storytelling', 'evidence_check'],
  );
  assert.equal(
    (calls[3].input as { feedback: { reason: string }[] }).feedback[0].reason,
    'wrong-outcome',
  );
  assert.equal(r.trace.workflow?.steps[2].status, 'revision-requested');
});
test('persistent disagreement exhausts one revision and withholds unapproved prose', async () => {
  const { client } = model((call) =>
    call.agent === 'evidence_check' ? review(call, 'revise') : undefined,
  );
  const r = await analyze(request, createMultiAgentAdapter(client));
  assert.equal(r.mode, 'fallback');
  assert.equal(r.reason, 'invalid-output');
  assert.equal(r.trace.calls, 5);
  assert.equal(r.trace.workflow?.status, 'fallback');
  assert.equal(r.trace.workflow?.revisions, 1);
  assert.equal(r.recap?.outcome, 'goal');
  assert.notEqual(r.buildup.title, 'A cited account');
});
test('missing audit coverage cannot approve and reviewer outages preserve a deterministic result', async () => {
  for (const outage of [false, true]) {
    const { client } = model((call) => {
      if (call.agent !== 'evidence_check') return;
      if (outage) throw new ProviderFailure('provider-error', 1);
      return { ...review(call), coveredTargets: ['story'] };
    });
    const r = await analyze(request, createMultiAgentAdapter(client));
    assert.equal(r.mode, 'fallback');
    assert.equal(r.trace.calls, 3);
    assert.equal(r.trace.workflow?.steps.at(-1)?.status, 'failed');
  }
});
test('host contract violations get at most one repair before independent review', async () => {
  let writes = 0;
  const { client, calls } = model((call) =>
    call.agent === 'storytelling' && ++writes === 1
      ? { ...story(call), story: { title: 'Bad output', summary: 'An invented 999 metre pass.' } }
      : undefined,
  );
  const r = await analyze(request, createMultiAgentAdapter(client));
  assert.equal(r.mode, 'model-selected');
  assert.equal(r.trace.calls, 4);
  assert.equal(r.trace.workflow?.revisions, 1);
  assert.equal(r.trace.workflow?.issues[0].reason, 'format');
  assert.equal(calls[3].agent, 'evidence_check');
});
test('analyst findings cannot reverse the measured sign or omit the terminal citation', async () => {
  const base = await analyze(request);
  const closed = base.evidence.facts.find((f) => f.kind === 'space-change' && (f.value ?? 0) < 0)!;
  assert.ok(closed);
  const terminal = base.recap!.terminalFactId;
  assert.throws(() =>
    validatePlan(
      {
        factIds: [closed.id, terminal],
        findings: [{ kind: 'space-opened', factIds: [closed.id] }],
      },
      base.evidence,
      terminal,
    ),
  );
  assert.throws(() =>
    validatePlan(
      { factIds: [closed.id], findings: [{ kind: 'space-closed', factIds: [closed.id] }] },
      base.evidence,
      terminal,
    ),
  );
  const { client, calls } = model((call) =>
    call.agent === 'analysis' ? { factIds: ['future-or-invented'], findings: [] } : undefined,
  );
  const r = await analyze(request, createMultiAgentAdapter(client));
  assert.equal(r.mode, 'fallback');
  assert.equal(calls.length, 2);
});
test('each workflow owns its snapshot; early views cannot publish a terminal recap', async () => {
  const { client } = model();
  const adapter = createMultiAgentAdapter(client);
  const [early, final] = await Promise.all([
    analyze({ ...request, through: 4, receivedThrough: 4 }, adapter),
    analyze(request, adapter),
  ]);
  assert.equal(early.recap, null);
  assert.equal(final.recap?.outcome, 'goal');
  assert.notEqual(early.trace.workflow?.snapshotId, final.trace.workflow?.snapshotId);
  assert.ok(
    early.trace.workflow?.steps
      .flatMap((s) => s.factIds)
      .every((id) => !id.includes('quick-break-06')),
  );
});
test('workflow deadline aborts a hanging agent and never starts the next agent', async () => {
  let count = 0;
  const client: ModelClient = {
    run: async (call) => {
      count++;
      await new Promise<void>((_, reject) =>
        call.signal.addEventListener('abort', () => reject(new ProviderFailure('timeout', 1)), {
          once: true,
        }),
      );
      throw new Error('unreachable');
    },
  };
  const r = await analyze(request, createMultiAgentAdapter(client), 10);
  assert.equal(r.mode, 'fallback');
  assert.equal(r.reason, 'timeout');
  assert.equal(count, 1);
  assert.equal(r.trace.workflow?.status, 'fallback');
});

test('review corrections cannot regress accepted cards or change card structure', async () => {
  const { client, calls } = model();
  await analyze(request, createMultiAgentAdapter(client));
  const original = story(calls[1]);
  const revised = structuredClone(original);
  revised.story.summary = 'A corrected explanation.';
  revised.recap!.cards[0].text = 'An unrelated rewritten claim.';
  const issues = [
    {
      target: 'story',
      reason: 'wrong-outcome' as const,
      detail: 'Correct the story.',
      factIds: original.factIds,
    },
  ];
  const merged = mergeRevision(original, revised, issues);
  assert.equal(merged.story.summary, 'A corrected explanation.');
  assert.equal(merged.recap!.cards[0].text, original.recap!.cards[0].text);
  revised.recap!.cards.push(structuredClone(revised.recap!.cards[0]));
  assert.throws(() => mergeRevision(original, revised, issues));
});
