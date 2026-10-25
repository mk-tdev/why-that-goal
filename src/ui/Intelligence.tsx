import { useEffect, useState } from 'react';
import type { AnalysisResponse } from '../../server/contracts';
import { Modal } from './Modal';
import { OperationsPanel } from './Operations';
import { useAccess } from './Access';
type Verification = {
  recordedAt: string;
  deterministic: { checks: number; passed: number };
  live: { cases: number; approved: number; p95Ms: number };
  load: { requests: number; burstLimited: number; providerInvocations: number };
  fault: {
    injection: string;
    structuralChecksAccepted: boolean;
    finalStatus: string;
    calls: number;
    steps: { agent: string; status: string; attempt: number }[];
  };
  limits: string[];
};
const roles = [
  [
    'analysis',
    'Match analyst',
    'Selects observed pass progress, receiving movement and space changes. Host checks the measured direction.',
  ],
  [
    'storytelling',
    'Studio storyteller',
    'Turns selected facts into audience-specific prose and a cited outcome recap.',
  ],
  [
    'evidence-check',
    'Evidence reviewer',
    'Audits every narrative target against the full snapshot. Can approve, reject or request one correction.',
  ],
] as const;
export function IntelligenceReview({
  analysis,
  onClose,
  onStart,
}: {
  analysis?: AnalysisResponse;
  onClose: () => void;
  onStart: () => void;
}) {
  const { session, openOperator } = useAccess();
  const [verification, setVerification] = useState<Verification>();
  useEffect(() => {
    const c = new AbortController();
    void fetch('/verification.json', { signal: c.signal })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setVerification)
      .catch(() => {});
    return () => c.abort();
  }, []);
  const workflow = analysis?.trace.workflow;
  return (
    <Modal titleId="intelligence-title" onClose={onClose} className="intelligence-review">
      <header className="review-heading">
        <div>
          <span className="access-brand">WHY THAT GOAL / SYSTEM OVERVIEW</span>
          <h1 id="intelligence-title">Inside the intelligence.</h1>
          <p>A studio producer’s path from incoming events to a story you can inspect.</p>
        </div>
        <button onClick={onClose}>Back to replay ×</button>
      </header>
      <div className="review-value">
        <strong>From scoreline to explanation</strong>
        <p>
          A producer can inspect what changed before the finish, cue the exact supporting replay and
          take a concise graphic to air. Fans get a short story; analysts retain the measurements,
          provenance and review trail. This is a synthetic prototype, not an integrated broadcast
          service.
        </p>
        <button onClick={onStart}>Watch the live pipeline ↗</button>
      </div>
      <ol className="pipeline-proof">
        {[
          ['01', 'Ingest', 'Paced synthetic events, event/receipt timestamps and versioned IDs.'],
          ['02', 'Interpret', 'Measured pass progress, receiver movement and before/after space.'],
          ['03', 'Explain', 'Three Foundry roles write, review and revise a cited narrative.'],
          ['04', 'Render', 'Click a fact to cue its interval, camera and on-pitch evidence.'],
          [
            '05',
            'Personalize',
            'Fan / analyst depth, English / Spanish and player-follow cameras.',
          ],
        ].map(([n, title, text]) => (
          <li key={n}>
            <span>{n}</span>
            <h3>{title}</h3>
            <p>{text}</p>
          </li>
        ))}
      </ol>
      <section className="review-block">
        <div className="review-section-heading">
          <div>
            <span>MICROSOFT FOUNDRY / CURRENT SNAPSHOT</span>
            <h2>One shared snapshot. Three accountable roles.</h2>
          </div>
          <strong className="review-status">
            {workflow?.status === 'approved'
              ? 'REVIEWED'
              : workflow?.status === 'running'
                ? 'WORKING'
                : workflow?.status === 'fallback'
                  ? 'MEASURED FALLBACK'
                  : 'AWAITING AI CHECKPOINT'}
          </strong>
        </div>
        <p>
          Deployment <code>wtg-insights</code> · Azure-hosted managed identity · structured
          Responses API · custom TypeScript coordinator. All roles use the same model with separate
          contexts; this is not Microsoft Agent Framework.
        </p>
        <p className="review-snapshot">
          {workflow
            ? `Snapshot ${workflow.snapshotId} · ${workflow.modelCalls} generation calls · ${workflow.revisions} revisions · ${analysis?.trace.cacheHit ? 'cached result' : 'current workflow'} · ${((analysis?.trace.elapsedMs ?? 0) / 1000).toFixed(1)}s`
            : 'Start the live feed to generate an observable workflow. Measured evidence stays available between AI checkpoints.'}
        </p>
        <div className="review-agent-grid">
          {roles.map(([id, title, description]) => {
            const steps = workflow?.steps.filter((s) => s.agent === id) ?? [];
            const latest = steps.at(-1);
            return (
              <article key={id}>
                <span>{latest?.status ?? 'waiting'}</span>
                <h3>{title}</h3>
                <p>{description}</p>
                {latest && (
                  <small>
                    Attempt {latest.attempt} · {(latest.elapsedMs / 1000).toFixed(1)}s ·{' '}
                    {latest.factIds.length} evidence references · {latest.toolCalls.length} fact
                    lookups
                  </small>
                )}
              </article>
            );
          })}
        </div>
        {workflow && (
          <ol className="review-handoffs">
            {workflow.handoffs.map((h, i) => (
              <li key={i}>
                <strong>
                  {h.from} → {h.to}
                </strong>
                <p>{h.reason}</p>
              </li>
            ))}
          </ol>
        )}
        {!!workflow?.issues.length && (
          <p>
            Review flagged: {workflow.issues.map((i) => `${i.reason}: ${i.detail}`).join(' · ')}
          </p>
        )}
        <p>
          Only approved prose is published. A timeout, provider error or unresolved disagreement
          retains measured evidence and a labeled fallback. Citations establish provenance, not
          tactical causal proof.
        </p>
      </section>
      <section className="review-block">
        <span>RECORDED EVALUATIONS / NOT LIVE METRICS</span>
        <h2>Why add a reviewer?</h2>
        <p>
          A controlled test inserted a false save into a goal story while keeping its citations
          structurally valid. The Foundry reviewer requested a correction, then checked the revised
          story.
        </p>
        {verification ? (
          <>
            <div className="review-score-grid">
              <article>
                <strong>
                  {verification.deterministic.passed}/{verification.deterministic.checks}
                </strong>
                <span>Temporal / degraded-data checks</span>
              </article>
              <article>
                <strong>
                  {verification.live.approved}/{verification.live.cases}
                </strong>
                <span>Reserved authored outcomes approved</span>
              </article>
              <article>
                <strong>{(verification.live.p95Ms / 1000).toFixed(1)}s</strong>
                <span>Four-case live workflow p95</span>
              </article>
              <article>
                <strong>{verification.load.requests}</strong>
                <span>Controlled HTTP requests tested</span>
              </article>
            </div>
            <ol className="review-fault">
              {verification.fault.steps.map((s, i) => (
                <li key={i}>
                  {s.agent} · attempt {s.attempt} <strong>{s.status}</strong>
                </li>
              ))}
            </ol>
            <p>
              {verification.fault.calls} model calls in this recorded fault test. Extra review costs
              tokens and latency; this small test does not establish general superiority over a
              single agent.
            </p>
            <small>
              Recorded {new Date(verification.recordedAt).toLocaleDateString('en-GB')} ·{' '}
              {verification.limits.join(' ')}
            </small>
          </>
        ) : (
          <p>Recorded summary is unavailable. Full reports remain in the public repository.</p>
        )}
        <div className="review-links">
          <a
            href="https://github.com/mk-tdev/why-that-goal/tree/main/docs/evaluations"
            target="_blank"
            rel="noreferrer"
          >
            Inspect full evaluation reports ↗
          </a>
          <a href="/verification.json" target="_blank" rel="noreferrer">
            Download verification summary ↗
          </a>
        </div>
      </section>
      <section className="review-block">
        <span>ENTERPRISE ADOPTION / WORKING CONTROLS & LIMITS</span>
        <h2>Transparent enough to operate.</h2>
        <div className="review-agent-grid">
          <article>
            <h3>Working today</h3>
            <p>
              HTTPS on Azure Container Apps, managed-identity inference, caller and model quotas,
              bounded concurrency, snapshot isolation, structured audits, reviewed publication and
              health probes.
            </p>
          </article>
          <article>
            <h3>Open demonstration</h3>
            <p>
              Anyone can enter the workspace and inspect aggregate monitoring. It exposes no Azure
              administration or private match data. Private deployments can enable tenant-bound
              access; this public mode is not an enterprise authorization boundary.
            </p>
          </article>
          <article>
            <h3>Before production adoption</h3>
            <p>
              Shared sessions and budgets, persistent telemetry and alerting, human editorial
              review, tenant/data isolation, load targets and broadcast integration remain.
              Scale-to-zero can cause a cold start.
            </p>
          </article>
        </div>
        {session.role === 'operator' ? (
          <OperationsPanel />
        ) : (
          <button
            onClick={() => {
              onClose();
              openOperator();
            }}
          >
            Enter the open workspace to inspect monitoring ↗
          </button>
        )}
        <div className="review-links">
          <a
            href="https://github.com/mk-tdev/why-that-goal/blob/main/docs/enterprise-readiness.md"
            target="_blank"
            rel="noreferrer"
          >
            Controls & adoption plan ↗
          </a>
          <a href="https://github.com/mk-tdev/why-that-goal" target="_blank" rel="noreferrer">
            Source & reproducible setup ↗
          </a>
        </div>
      </section>
    </Modal>
  );
}
