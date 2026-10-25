import { useEffect, useRef, useState } from 'react';
import type { AnalysisResponse, Fact } from '../../server/contracts';
import { clock, type Language, type Scenario } from '../core/model';

type FeedState = {
  enabled: boolean;
  status: 'idle' | 'connecting' | 'live' | 'complete' | 'error';
  time: number;
  ids: string[];
};
type Stage = { name: string; state: 'on' | 'idle' | 'warn' | 'off'; value: string; detail: string };

const modeLabel: Record<AnalysisResponse['mode'], string> = {
  deterministic: 'RULES',
  'model-selected': 'MODEL',
  fallback: 'FALLBACK',
};
const kindLabel: Record<Fact['kind'], string> = {
  event: 'EVENT',
  'pass-distance': 'PASS',
  'pass-progress': 'PASS',
  'receiver-space': 'SPACE',
  'off-ball-run': 'RUN',
  'space-change': 'SPACE',
};

/** Production view of the same replay: only values the feed and evidence service report. */
export function OperatorConsole({
  scene,
  time,
  selected,
  live,
  analysis,
  language,
  onAir,
  graphic,
  onToggleAir,
  onJump,
  onCue,
}: {
  scene: Scenario;
  time: number;
  selected: number;
  live: FeedState;
  analysis: { status: 'loading' | 'ready' | 'offline'; data?: AnalysisResponse };
  language: Language;
  onAir: boolean;
  graphic: { kicker: string; title: string; text: string } | null;
  onToggleAir: () => void;
  onJump: (index: number) => void;
  onCue: (fact: Fact) => void;
}) {
  // Wall-clock arrival of each feed event, measured in this browser.
  const started = useRef(0);
  const [arrivals, setArrivals] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!live.enabled || live.status === 'connecting') {
      started.current = performance.now();
      setArrivals({});
    }
  }, [live.enabled, live.status === 'connecting']);
  useEffect(() => {
    const now = performance.now();
    setArrivals((known) => {
      const fresh = live.ids.filter((id) => !(id in known));
      if (!fresh.length) return known;
      return { ...known, ...Object.fromEntries(fresh.map((id) => [id, now - started.current])) };
    });
  }, [live.ids]);

  const data = analysis.data;
  const visible = scene.events
    .map((e, i) => ({ e, i, key: `${e.id}@${e.version}` }))
    .filter(({ e, key }) => (live.enabled ? live.ids.includes(key) : e.at <= time));
  const facts = (data?.evidence.facts ?? []).filter((f) => f.kind !== 'event');
  const stages: Stage[] = [
    {
      name: 'Match feed',
      state: !live.enabled ? 'idle' : live.status === 'error' ? 'warn' : 'on',
      value: live.enabled ? `${live.ids.length}/${scene.events.length}` : 'REPLAY',
      detail: live.enabled
        ? `${live.status.toUpperCase()} · T+${live.time.toFixed(1)}s`
        : 'Stored synthetic events',
    },
    {
      name: 'Evidence service',
      state: analysis.status === 'ready' ? 'on' : analysis.status === 'offline' ? 'warn' : 'idle',
      value: data ? `${data.evidence.facts.length}` : '—',
      detail:
        analysis.status === 'ready' && data
          ? `facts · ${data.trace.elapsedMs} ms`
          : analysis.status === 'offline'
            ? 'Unavailable · local fallback'
            : 'Requesting…',
    },
    {
      name: 'Insight selection',
      state: data ? (data.mode === 'model-selected' ? 'on' : 'idle') : 'idle',
      value: data ? modeLabel[data.mode] : '—',
      detail: data
        ? data.mode === 'model-selected' && data.trace.cacheHit
          ? 'Reviewed model output · cache hit · no new calls'
          : data.trace.calls
            ? `${data.trace.calls} model calls · ${data.trace.validated ? 'validated' : 'rejected'}`
            : 'Measured evidence · no model prose'
        : 'Waiting for evidence',
    },
    {
      name: 'Microsoft Foundry',
      state: data?.mode === 'model-selected' ? 'on' : data?.mode === 'fallback' ? 'warn' : 'idle',
      value:
        data?.mode === 'model-selected'
          ? data.trace.cacheHit
            ? 'CACHED'
            : 'REVIEWED'
          : data?.trace.pending
            ? 'WORKING'
            : data?.mode === 'fallback'
              ? 'FALLBACK'
              : 'STANDBY',
      detail:
        data?.provider && data.provider !== 'none'
          ? `${data.provider} · ${data.trace.pending ? 'agents processing' : data.evidence.facts.length ? data.reason : 'waiting for evidence'}`
          : 'Not configured',
    },
    {
      name: 'Auto recap',
      state: data?.recap ? 'on' : 'idle',
      value: data?.recap ? data.recap.outcome.replace('-', ' ').toUpperCase() : 'STANDBY',
      detail: data?.recap ? `${data.recap.cards.length} cards ready` : 'Waiting for the outcome',
    },
  ];

  return (
    <section className="operator-console" aria-label="Operator console">
      <div className="op-strip" role="status">
        <span className={`op-tally ${onAir ? 'on' : ''}`}>{onAir ? 'ON AIR' : 'PREVIEW'}</span>
        <span>
          MATCH <b>{clock(scene.baseClock, time)}</b>
        </span>
        <span>
          SEQ <b>{scene.chapter}</b> {scene.title}
        </span>
        <span>
          FEED <b>{live.enabled ? `T+${live.time.toFixed(1)}s` : 'OFF'}</b>
        </span>
        <span className="op-strip-note">
          Synthetic data · every figure below is reported, not estimated
        </span>
      </div>

      <div className="op-grid">
        <section className="op-panel op-chain" aria-label="Signal chain">
          <header>
            <span>SIGNAL CHAIN</span>
          </header>
          <ol>
            {stages.map((s) => (
              <li key={s.name} className={`op-stage ${s.state}`}>
                <i />
                <div>
                  <strong>{s.name}</strong>
                  <small>{s.detail}</small>
                </div>
                <b>{s.value}</b>
              </li>
            ))}
          </ol>
        </section>

        <section className="op-panel op-log" aria-label="Event log">
          <header>
            <span>EVENT LOG</span>
            <small>
              {visible.length} / {scene.events.length}
            </small>
          </header>
          <div className="op-table" role="table">
            <div className="op-row op-head" role="row">
              <span>CLOCK</span>
              <span>EVENT</span>
              <span>TYPE</span>
              <span>{live.enabled ? 'ARRIVED' : 'STATUS'}</span>
            </div>
            {visible.length === 0 && (
              <p className="op-empty">
                {live.enabled ? 'Listening for the first event…' : 'Play forward to log events.'}
              </p>
            )}
            {visible.map(({ e, i, key }) => (
              <button
                key={key}
                role="row"
                className={`op-row ${i === selected ? 'current' : ''}`}
                onClick={() => onJump(i)}
                disabled={live.enabled && live.status !== 'complete'}
              >
                <span>{clock(scene.baseClock, e.at)}</span>
                <span>
                  {e.id}
                  <em>v{e.version}</em>
                </span>
                <span className={`op-type t-${e.type}`}>
                  {e.type.toUpperCase()}
                  {e.outcome !== 'success' && <em>{e.outcome}</em>}
                </span>
                <span>
                  {live.enabled
                    ? key in arrivals
                      ? `+${(arrivals[key] / 1000).toFixed(1)}s`
                      : '—'
                    : e.version > 1
                      ? 'CORRECTED'
                      : 'LOGGED'}
                </span>
                <small>{e.label[language]}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="op-panel op-queue" aria-label="Evidence queue">
          <header>
            <span>EVIDENCE QUEUE</span>
            <small>{facts.length} measured</small>
          </header>
          <div className="op-scroll">
            {facts.length === 0 && (
              <p className="op-empty">
                {analysis.status === 'offline'
                  ? 'Evidence service unavailable.'
                  : 'No measured facts yet for this moment.'}
              </p>
            )}
            {facts.map((f) => (
              <article key={f.id} className="op-fact" data-kind={f.kind}>
                <div>
                  <span>
                    {kindLabel[f.kind]} · {clock(scene.baseClock, f.at)}
                  </span>
                  <p>{f.text}</p>
                  <small title={f.method}>
                    {f.eventId} v{f.version} · {f.method}
                  </small>
                </div>
                <button
                  onClick={() => onCue(f)}
                  disabled={live.enabled && live.status !== 'complete'}
                >
                  CUE
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="op-panel op-air" aria-label="On-air graphic">
          <header>
            <span>GRAPHIC · LOWER THIRD</span>
            <span className={`op-tally small ${onAir ? 'on' : ''}`}>{onAir ? 'PGM' : 'PVW'}</span>
          </header>
          <div className="op-monitor">
            {graphic ? (
              <div className="lower-third static">
                <span>{graphic.kicker}</span>
                <strong>{graphic.title}</strong>
                <p>{graphic.text}</p>
              </div>
            ) : (
              <p className="op-empty">Nothing to show for this moment yet.</p>
            )}
          </div>
          <button
            className={`op-take ${onAir ? 'on' : ''}`}
            disabled={!graphic}
            onClick={onToggleAir}
          >
            {onAir ? 'Take graphic off air' : 'Take graphic to air'}
          </button>
          <small className="op-air-note">
            Text comes from the evidence service; the graphic follows the selected moment.
          </small>
        </section>
      </div>
    </section>
  );
}
