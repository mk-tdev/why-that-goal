import type { Fact } from '../server/contracts';
import { useAnalysis } from './hooks/useAnalysis';
import { buildGuide, type GuideStep } from './core/guide';
import { Select, Slider, Disclosure } from './ui/Controls';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
const Stadium = lazy(() => import('./scene/Stadium'));
import { scenarios } from './core/scenarios';
import {
  clock,
  evidenceFor,
  exportOverlay,
  interpolate,
  matchState,
  type MatchEvent,
  type Scenario,
  type Language,
} from './core/model';
import { inspectSpace } from './core/spatial';

function Glyph({ kind }: { kind: string }) {
  const paths: Record<string, string> = {
    play: 'm8 5 11 7-11 7Z',
    pause: 'M8 5v14M16 5v14',
    back: 'm12 7-6 5 6 5M18 7l-6 5 6 5',
    arrow: 'M4 12h16m-6-6 6 6-6 6',
    layers: 'm3 8 9-5 9 5-9 5ZM3 12l9 5 9-5M3 16l9 5 9-5',
    target: 'M12 2v4m0 12v4M2 12h4m12 0h4M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
    download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
    compare: 'M12 3v18M8 6H3v12h5m8-12h5v12h-5',
    close: 'm6 6 12 12M6 18 18 6',
  };
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[kind] ?? paths.target} />
    </svg>
  );
}

function Field({
  scene,
  time,
  event,
  layer,
  focus,
  onFocus,
  comparison,
}: {
  scene: Scenario;
  time: number;
  event: MatchEvent;
  layer: string;
  focus: string | null;
  onFocus: (id: string | null) => void;
  comparison: boolean;
}) {
  const metric = inspectSpace(scene, event, time);
  const ball = interpolate(scene.ball, time);
  const pass = event.type === 'pass' && event.outcome === 'success';
  return (
    <svg
      className="field"
      viewBox="-8 -10 121 90"
      role="group"
      aria-label="Interactive synthetic match pitch"
    >
      <defs>
        <pattern id="grass" width="15" height="68" patternUnits="userSpaceOnUse">
          <rect width="7.5" height="68" fill="#ffffff" opacity=".025" />
        </pattern>
        <pattern id="grid" width="5" height="5" patternUnits="userSpaceOnUse">
          <path d="M5 0H0V5" fill="none" stroke="#fff" strokeOpacity=".025" strokeWidth=".1" />
        </pattern>
        <marker id="pass-arrow" markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto">
          <path d="M0 0 4 2 0 4Z" fill="#f6bc64" />
        </marker>
        <filter id="shadow">
          <feDropShadow dx="0" dy=".6" stdDeviation=".45" floodOpacity=".4" />
        </filter>
      </defs>
      <rect x="-8" y="-10" width="121" height="90" fill="#183e35" />
      <rect width="105" height="68" fill="url(#grass)" />
      <rect width="105" height="68" fill="url(#grid)" />
      <g stroke="#bed1bb" strokeOpacity=".42" strokeWidth=".18" fill="none">
        <rect width="105" height="68" />
        <path d="M52.5 0v68" />
        <circle cx="52.5" cy="34" r="9.15" />
        <circle cx="52.5" cy="34" r=".25" fill="#bed1bb" />
        <path d="M0 13.84h16.5v40.32H0M105 13.84H88.5v40.32H105M0 24.84h5.5v18.32H0M105 24.84h-5.5v18.32h5.5M0 30.34h-2v7.32h2M105 30.34h2v7.32h-2" />
        <path d="M16.5 26.68a9.15 9.15 0 0 1 0 14.64M88.5 26.68a9.15 9.15 0 0 0 0 14.64" />
        <circle cx="11" cy="34" r=".25" fill="#bed1bb" />
        <circle cx="94" cy="34" r=".25" fill="#bed1bb" />
      </g>
      <g className="field-labels">
        <text x="0" y="-4">
          NORTHSTAR FC
        </text>
        <text x="105" y="-4" textAnchor="end">
          ATTACKING →
        </text>
        <text x="0" y="74">
          105 × 68 M / SYNTHETIC TRACKING
        </text>
        <text x="105" y="74" textAnchor="end">
          {comparison ? 'EARLIER POSITIONS' : 'MATCH REPLAY'}
        </text>
      </g>
      {layer === 'trails' &&
        scene.players
          .filter((p) => p.team === 'home')
          .map((p) => {
            const a = interpolate(scene.tracks[p.id], Math.max(0, time - 3)),
              b = interpolate(scene.tracks[p.id], time);
            return (
              <path
                key={p.id}
                d={`M${a.x} ${a.y}L${b.x} ${b.y}`}
                stroke="#f6bc64"
                strokeWidth=".5"
                strokeDasharray=".6 .5"
                opacity=".7"
              />
            );
          })}
      {pass && layer !== 'clean' && (
        <g>
          <path
            d={`M${event.from.x} ${event.from.y}L${event.to.x} ${event.to.y}`}
            stroke="#f6bc64"
            strokeWidth="2.5"
            opacity=".1"
          />
          <path
            d={`M${event.from.x} ${event.from.y}L${event.to.x} ${event.to.y}`}
            stroke="#f6bc64"
            strokeWidth=".5"
            strokeDasharray="1 .8"
            markerEnd="url(#pass-arrow)"
          />
          <circle
            cx={event.to.x}
            cy={event.to.y}
            r={metric.receiver.receiverDistance}
            fill="#efbd72"
            fillOpacity=".07"
            stroke="#f6bc64"
            strokeWidth=".2"
            strokeDasharray=".7 .7"
          />
          <path
            d={`M${metric.lane.point.x} ${metric.lane.point.y}L${metric.lane.projection.x} ${metric.lane.projection.y}`}
            stroke="#fb9e87"
            strokeWidth=".35"
          />
          <circle
            cx={metric.lane.point.x}
            cy={metric.lane.point.y}
            r="2.1"
            fill="none"
            stroke="#fb9e87"
            strokeWidth=".25"
          />
          <g
            transform={`translate(${Math.max(9, Math.min(90, metric.lane.projection.x))} ${Math.max(6, metric.lane.projection.y - 5)})`}
          >
            <rect x="-9" y="-3" width="18" height="4.5" rx=".5" fill="#102c25" />
            <text textAnchor="middle" fill="#ffcfab" fontSize="1.7" fontFamily="monospace">
              {metric.lane.laneDistance.toFixed(1)} m TO LANE
            </text>
          </g>
        </g>
      )}
      {scene.players.map((p) => {
        const pt = interpolate(scene.tracks[p.id], time),
          active = focus === p.id,
          featured = p.id === event.player || p.id === event.recipient;
        return (
          <g
            key={p.id}
            tabIndex={0}
            role="button"
            aria-label={`Inspect ${p.name}`}
            aria-pressed={active}
            className="player"
            onClick={() => onFocus(active ? null : p.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onFocus(active ? null : p.id);
              }
            }}
            transform={`translate(${pt.x} ${pt.y})`}
          >
            <circle r="2.7" fill="transparent" />
            {active && <circle r="2.5" fill="none" stroke="#fff" strokeWidth=".3" />}
            <circle
              r="1.35"
              fill={p.team === 'home' ? '#f5dfae' : '#679b9d'}
              stroke={p.team === 'home' ? '#fff0cf' : '#a8d3d2'}
              strokeWidth=".25"
              filter="url(#shadow)"
            />
            <text textAnchor="middle" y=".55" fontSize="1.55" fontWeight="700" fill="#193e35">
              {p.number}
            </text>
            {(featured || active) && (
              <g>
                <rect x="-5" y="2.4" width="10" height="3.3" rx=".3" fill="#102c25" opacity=".9" />
                <text textAnchor="middle" y="4.65" fill="#f6f0df" fontSize="1.7">
                  {p.name}
                </text>
              </g>
            )}
          </g>
        );
      })}
      <circle cx={ball.x} cy={ball.y} r=".65" fill="white" stroke="#163b30" strokeWidth=".2" />
    </svg>
  );
}

export default function App() {
  const [recapReturn, setRecapReturn] = useState(false);
  const [evidenceGuide, setEvidenceGuide] = useState<GuideStep | undefined>();
  const [guideIndex, setGuideIndex] = useState<number | null>(null);
  const [guideRunning, setGuideRunning] = useState(false);
  const [guideReplay, setGuideReplay] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [threeD, setThreeD] = useState(true);
  const [immersive, setImmersive] = useState(true);
  const [sceneId, setSceneId] = useState(scenarios[0].id),
    [time, setTime] = useState(8),
    [selected, setSelected] = useState(2),
    [playing, setPlaying] = useState(false),
    [layer, setLayer] = useState('space'),
    [focus, setFocus] = useState<string | null>(null),
    [comparison, setComparison] = useState(false),
    [language, setLanguage] = useState<Language>('en'),
    [analyst, setAnalyst] = useState(false),
    [drawer, setDrawer] = useState(false),
    [notice, setNotice] = useState('');
  const scene = scenarios.find((s) => s.id === sceneId)!,
    event = scene.events[selected],
    displayTime = comparison ? Math.max(0, time - 2) : time;
  // Request only when event visibility changes, not on every animation frame.
  const evidenceThrough = Math.max(
    0,
    ...scene.events
      .filter((e) => e.at <= displayTime && e.receivedAt <= displayTime)
      .map((e) => Math.max(e.at, e.receivedAt)),
  );
  const analysis = useAnalysis({
    scenarioId: scene.id,
    through: evidenceThrough,
    receivedThrough: evidenceThrough,
    audience: analyst ? 'analyst' : 'fan',
    language,
  });
  const eventFacts =
    analysis.data?.evidence.facts.filter(
      (f) => f.eventId === event.id && f.version === event.version,
    ) ?? [];
  const serverExplanation = eventFacts.find((f) => f.kind === 'event');
  const guideSteps = useMemo(() => buildGuide(scene), [scene]);
  const guide = evidenceGuide ?? (guideIndex === null ? undefined : guideSteps[guideIndex]);
  function endGuide() {
    setEvidenceGuide(undefined);
    setGuideIndex(null);
    setGuideRunning(false);
  }
  function enterGuide(index: number) {
    setEvidenceGuide(undefined);
    const step = guideSteps[index];
    setGuideIndex(index);
    setGuideRunning(true);
    setGuideReplay((n) => n + 1);
    setPlaying(false);
    setComparison(false);
    setLayer('space');
    setThreeD(true);
    setTime(step.start);
    setSelected(scene.events.indexOf(step.event));
    setFocus(step.player ?? null);
  }
  useEffect(() => {
    if (!guide || !guideRunning) return;
    let previous = performance.now(),
      hold = 0;
    const timer = window.setInterval(() => {
      const now = performance.now(),
        elapsed = Math.min(0.1, (now - previous) / 1000);
      previous = now;
      if (document.hidden) return;
      setTime((t) => Math.min(guide.end, t + elapsed * 0.5));
      // Hold the final evidence frame for reading before the next chapter.
      if (time >= guide.end) {
        hold += elapsed;
        if (hold >= 3.5) {
          clearInterval(timer);
          if (!evidenceGuide && guideIndex! < guideSteps.length - 1) enterGuide(guideIndex! + 1);
          else setGuideRunning(false);
        }
      }
    }, 32);
    return () => clearInterval(timer);
  }, [guide, guideRunning, guideReplay, time >= (guide?.end ?? Infinity)]);
  const state = matchState(scene.events, displayTime),
    spatial = inspectSpace(scene, event, displayTime);
  const player = scene.players.find((p) => p.id === event.player)!,
    receiver = scene.players.find((p) => p.id === event.recipient);
  const focused = scene.players.find((p) => p.id === focus);
  useEffect(() => {
    if (!playing) return;
    let previous = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      setTime((t) => {
        const next = Math.min(scene.duration, t + ((now - previous) / 1000) * playbackRate);
        previous = now;
        if (next >= scene.duration) setPlaying(false);
        return next;
      });
    }, 32);
    return () => clearInterval(id);
  }, [playing, scene.duration, playbackRate]);
  useEffect(() => {
    if (playing) {
      const i = scene.events.reduce((last, e, i) => (e.at <= time ? i : last), -1);
      if (i >= 0) setSelected(i);
    }
  }, [time, playing, scene]);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(''), 3000);
    return () => clearTimeout(id);
  }, [notice]);
  function jump(index: number) {
    endGuide();
    setSelected(index);
    setTime(scene.events[index].at);
    setPlaying(false);
    setComparison(false);
  }
  function inspectFact(fact: Fact) {
    const index = scene.events.findIndex(
      (e) => e.id === fact.eventId && e.version === fact.version,
    );
    if (index < 0) return;
    if (scene.events[index].type === 'goal' || scene.events[index].type === 'save') {
      enterGuide(guideSteps.length - 1);
      return;
    }
    const start = fact.fromTime ?? Math.max(0, fact.at - 1);
    const end = fact.toTime ?? fact.at;
    endGuide();
    setSelected(index);
    setComparison(false);
    setPlaying(false);
    setFocus(fact.playerId);
    setThreeD(true);
    setLayer('space');
    setTime(start);
    setEvidenceGuide({
      id: fact.id,
      kind: fact.kind === 'off-ball-run' ? 'run' : fact.kind === 'space-change' ? 'space' : 'pass',
      title:
        fact.kind === 'off-ball-run'
          ? 'The receiving run'
          : fact.kind === 'space-change'
            ? 'The changing gap'
            : 'The connection',
      detail: fact.text,
      event: scene.events[index],
      start,
      end,
      anchor: fact.target,
      player: fact.playerId,
      before: fact.before,
      after: fact.after,
      metric:
        fact.before !== undefined
          ? `${fact.before} → ${fact.after} m`
          : fact.value !== undefined
            ? `${fact.value} m`
            : 'Recorded event',
    });
    setGuideRunning(true);
    setGuideReplay((n) => n + 1);
  }
  function changeScene(id: string) {
    setRecapReturn(false);
    endGuide();
    const next = scenarios.find((s) => s.id === id)!;
    setSceneId(id);
    setSelected(2);
    setTime(next.events[2].at);
    setPlaying(false);
    setComparison(false);
    setFocus(null);
  }
  function download() {
    const payload = {
      ...exportOverlay(scene, time, analyst ? 'analyst' : 'fan', language),
      recap: analysis.data?.recap ?? null,
      recapEvidence: analysis.data?.recap
        ? analysis.data.evidence.facts.filter((f) =>
            analysis.data!.recap!.cards.some((c) => c.factIds.includes(f.id)),
          )
        : [],
      selectedAnalysis:
        event.at <= time
          ? {
              event: event.id,
              frame: displayTime,
              nearestDefender: spatial.lane.player.id,
              laneClearanceMetres: spatial.lane.laneDistance,
              receiverSpaceMetres: spatial.receiver.receiverDistance,
              method:
                'finite-segment distance; synthetic illustrative tracking; no probability model',
            }
          : null,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `why-that-goal-${scene.id}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('Replay evidence exported');
  }
  const pass = event.type === 'pass' && event.outcome === 'success';
  const sideways = Math.abs(event.to.y - event.from.y);
  const headline = pass
    ? spatial.progress > 20
      ? 'Progress through the pitch.'
      : sideways > 18
        ? 'Change the angle.'
        : 'Connect the play.'
    : '';
  const subtitle = pass
    ? sideways > 18
      ? 'Find the far side.'
      : spatial.length < 18
        ? 'A shorter route to goal.'
        : 'Move the play forward.'
    : '';
  const spatialStory =
    language === 'en'
      ? `${player.name} moves the ball ${spatial.progress.toFixed(1)} m forward and ${sideways.toFixed(1)} m across the pitch. At ${clock(scene.baseClock, displayTime)}, the receiving point is ${spatial.receiver.receiverDistance.toFixed(1)} m from the nearest defender. ${analyst ? `The nearest opponent to the pass segment is ${spatial.lane.player.name}, ${spatial.lane.laneDistance.toFixed(1)} m away. These are frame measurements, not interception probabilities.` : 'The shaded circle shows that space; the pink marker identifies the defender closest to the passing lane.'}`
      : `${player.name} avanza el balón ${spatial.progress.toFixed(1)} m y lo desplaza ${sideways.toFixed(1)} m lateralmente. A las ${clock(scene.baseClock, displayTime)}, el punto de recepción está a ${spatial.receiver.receiverDistance.toFixed(1)} m del defensor más cercano. Son distancias geométricas, no probabilidades.`;
  return (
    <div className={`desk ${immersive ? 'desk-immersive' : ''} ${threeD ? 'desk-3d' : ''}`}>
      <header className="app-bar">
        <a className="brand" href="/" aria-label="Why That Goal home">
          <span className="brand-mark">
            w<span>↗</span>
          </span>
          <strong>
            why that goal<span>?</span>
          </strong>
        </a>
        <span className="app-divider" />
        <span className="workspace-name">
          Spatial replay <span>/</span> Northstar vs Atlas
        </span>
        <div className="header-actions">
          <span className="prototype-label">
            <i /> Synthetic replay
          </span>
          <button className="export" onClick={download}>
            <Glyph kind="download" /> Export analysis
          </button>
        </div>
      </header>
      <div className="desk-body">
        <nav className="tool-rail" aria-label="Analysis tools">
          <button
            className={!drawer ? 'rail-active' : ''}
            aria-label="Replay workspace"
            onClick={() => setDrawer(false)}
          >
            <Glyph kind="play" />
            <span>Replay</span>
          </button>
          <button
            className={drawer ? 'rail-active' : ''}
            aria-label="Open evidence notebook"
            onClick={() => {
              setDrawer(!drawer);
              setImmersive(false);
            }}
          >
            <Glyph kind="layers" />
            <span>Evidence</span>
          </button>
          <div className="rail-bottom">
            WTG
            <br />
            <span>0.5</span>
          </div>
        </nav>
        <main className="studio">
          <div className="session-bar">
            <div>
              <span className="crumb">MATCH LIBRARY / SYNTHETIC SERIES</span>
              <h1>
                Northstar <span>vs</span> Atlas Athletic
              </h1>
            </div>
            <div className="scenario-select">
              <span>SEQUENCE LIBRARY</span>
              <Select
                label="Choose synthetic scenario"
                value={sceneId}
                onChange={changeScene}
                options={scenarios.map((s) => ({
                  value: s.id,
                  label: s.title,
                  detail: s.subtitle,
                  badge: s.chapter,
                }))}
              />
            </div>
          </div>
          <div className="working-area">
            <section className="replay-surface" aria-label="Match replay">
              <div className="canvas-toolbar">
                <div className="scene-view-controls">
                  <button
                    className="guide-launch"
                    aria-pressed={!!guide}
                    onClick={() => (guide ? endGuide() : enterGuide(0))}
                  >
                    ✦ {guide ? 'Exit guided replay' : 'Guided replay'}
                  </button>
                  <button onClick={() => enterGuide(guideSteps.length - 1)}>
                    {scene.events.some((e) => e.type === 'shot')
                      ? 'Replay finish ↗'
                      : 'Replay breakdown ↗'}
                  </button>
                  <button
                    aria-pressed={threeD}
                    onClick={() => {
                      endGuide();
                      setThreeD(!threeD);
                    }}
                  >
                    {threeD ? '◈  3D Stadium' : '◇  Switch to 3D'}
                  </button>
                  <button aria-pressed={!immersive} onClick={() => setImmersive(!immersive)}>
                    {immersive ? 'Show analysis ↗' : 'Expand stadium ↗'}
                  </button>
                </div>
                <div className="view-tabs">
                  <button
                    className={layer === 'space' ? 'active' : ''}
                    onClick={() => {
                      endGuide();
                      setLayer('space');
                    }}
                  >
                    Passing lanes
                  </button>
                  <button
                    className={layer === 'trails' ? 'active' : ''}
                    onClick={() => {
                      endGuide();
                      setLayer('trails');
                    }}
                  >
                    Movement
                  </button>
                  <button
                    className={layer === 'clean' ? 'active' : ''}
                    onClick={() => {
                      endGuide();
                      setLayer('clean');
                    }}
                  >
                    Clean feed
                  </button>
                </div>
                <button
                  className={`compare-button ${comparison ? 'active' : ''}`}
                  aria-pressed={comparison}
                  onClick={() => {
                    endGuide();
                    setComparison(!comparison);
                    setPlaying(false);
                  }}
                >
                  <Glyph kind="compare" />
                  <span>{comparison ? 'Return to moment' : 'Compare −2s'}</span>
                </button>
              </div>
              <div className="match-stage">
                <div className="broadcast-score">
                  <b>NSF</b>
                  <strong>
                    {state.home} <span>—</span> {state.away}
                  </strong>
                  <b>ATL</b>
                  <time>{clock(scene.baseClock, displayTime)}</time>
                </div>
                <span className="replay-indicator">
                  {guide
                    ? 'GUIDED REPLAY'
                    : comparison
                      ? 'EARLIER FRAME'
                      : playing
                        ? 'REPLAYING'
                        : 'PAUSED'}{' '}
                  <i />
                </span>
                {threeD ? (
                  <Suspense
                    fallback={<div className="stadium-loading">Preparing the stadium…</div>}
                  >
                    <Stadium
                      onInspect={(id) => {
                        setPlaying(false);
                        setGuideRunning(false);
                        setFocus(id);
                      }}
                      guidePlaying={guideRunning}
                      guide={guide}
                      scene={scene}
                      time={displayTime}
                      event={event}
                      layer={layer}
                      focus={focus}
                      onFocus={setFocus}
                      comparison={comparison}
                      onFallback={() => {
                        endGuide();
                        setThreeD(false);
                      }}
                    />
                  </Suspense>
                ) : (
                  <Field
                    scene={scene}
                    time={displayTime}
                    event={event}
                    layer={layer}
                    focus={focus}
                    onFocus={setFocus}
                    comparison={comparison}
                  />
                )}
                {guide && (
                  <aside className="guide-card" aria-label="Guided replay chapter">
                    <div className="guide-eyebrow">
                      DIRECTOR’S REPLAY{' '}
                      <span>
                        {evidenceGuide ? 'EVIDENCE' : `${guideIndex! + 1} / ${guideSteps.length}`}
                      </span>
                    </div>
                    <div className="guide-chapters">
                      {guideSteps.map((step, i) => (
                        <button
                          key={step.id}
                          aria-label={`Guide chapter ${i + 1}: ${step.title}`}
                          aria-current={i === guideIndex ? 'step' : undefined}
                          onClick={() => enterGuide(i)}
                        >
                          <span />
                        </button>
                      ))}
                    </div>
                    <h2>{guide.title}</h2>
                    <strong className="guide-metric">{guide.metric}</strong>
                    <p>{guide.detail}</p>
                    <small>
                      Synthetic tracks · {guide.start.toFixed(1)}–{guide.end.toFixed(1)}s ·{' '}
                      {guide.event.id} v{guide.event.version}
                    </small>
                    <div className="guide-actions">
                      <button
                        aria-label="Previous guide chapter"
                        disabled={!!evidenceGuide || guideIndex === 0}
                        onClick={() => enterGuide(guideIndex! - 1)}
                      >
                        ←
                      </button>
                      <button onClick={() => setGuideRunning(!guideRunning)}>
                        {guideRunning ? 'Pause guide' : 'Resume guide'}
                      </button>
                      <button
                        onClick={() => {
                          if (evidenceGuide) {
                            setTime(evidenceGuide.start);
                            setGuideRunning(true);
                            setGuideReplay((n) => n + 1);
                          } else enterGuide(guideIndex!);
                        }}
                      >
                        Replay moment
                      </button>
                      <button
                        aria-label="Next guide chapter"
                        disabled={!!evidenceGuide || guideIndex === guideSteps.length - 1}
                        onClick={() => enterGuide(guideIndex! + 1)}
                      >
                        →
                      </button>
                    </div>
                    <span className="guide-status">
                      {!guideRunning
                        ? 'Paused · explore the evidence'
                        : time >= guide.end
                          ? 'Hold frame · reading the play'
                          : '½ speed · following the action'}
                    </span>
                  </aside>
                )}
                <div className="stage-bottom">
                  <span>
                    <i className="team-dot home" /> Northstar <i className="team-dot away" /> Atlas
                  </span>
                  <span>
                    {focus
                      ? `Following ${focused?.name} · click again to clear`
                      : 'Select any player to inspect'}
                  </span>
                </div>
              </div>
              <div className="transport">
                <button
                  className="transport-back"
                  aria-label="Rewind sequence"
                  onClick={() => {
                    endGuide();
                    setTime(0);
                    setSelected(0);
                    setPlaying(false);
                    setComparison(false);
                  }}
                >
                  <Glyph kind="back" />
                </button>
                <button
                  className="play"
                  aria-label={playing ? 'Pause replay' : 'Play replay'}
                  onClick={() => {
                    endGuide();
                    setComparison(false);
                    if (time >= scene.duration) {
                      endGuide();
                      setTime(0);
                      setSelected(0);
                    }
                    setPlaying(!playing);
                  }}
                >
                  <Glyph kind={playing ? 'pause' : 'play'} />
                </button>
                <time>{clock(scene.baseClock, displayTime)}</time>
                <div className="scrub">
                  <Slider
                    label="Replay time"
                    valueText={clock(scene.baseClock, time)}
                    max={scene.duration}
                    value={time}
                    onChange={(t) => {
                      endGuide();
                      setTime(t);
                      setSelected(
                        Math.max(
                          0,
                          scene.events.reduce((last, ev, i) => (ev.at <= t ? i : last), -1),
                        ),
                      );
                      setPlaying(false);
                      setComparison(false);
                    }}
                  />
                  <div className="scrub-marks">
                    {scene.events.map((e) => (
                      <i key={e.id} style={{ left: `${(e.at / scene.duration) * 100}%` }} />
                    ))}
                  </div>
                </div>
                <button
                  className="speed-control"
                  aria-label="Toggle slow motion"
                  disabled={!!guide}
                  aria-pressed={!!guide || playbackRate === 0.5}
                  onClick={() => setPlaybackRate(playbackRate === 1 ? 0.5 : 1)}
                >
                  {guide || playbackRate === 0.5 ? '.5×' : '1×'}
                  <span>{guide ? 'Guide' : playbackRate === 1 ? 'Speed' : 'Slow'}</span>
                </button>
                <span className="transport-divider" />
                <button
                  className="small-button"
                  onClick={() => {
                    jump(0);
                    setPlaying(true);
                  }}
                >
                  Play buildup <Glyph kind="arrow" />
                </button>
              </div>
              <div className="sequence-title">
                <span>THE BUILDUP</span>
                <span>
                  {scene.events.length} moments <span>·</span> Select to inspect
                </span>
              </div>
              <div className="filmstrip">
                {scene.events.map((e, i) => (
                  <button
                    key={e.id}
                    className={`film-frame ${selected === i ? 'selected' : ''}`}
                    aria-label={`Inspect ${e.label.en}`}
                    aria-pressed={selected === i}
                    onClick={() => jump(i)}
                  >
                    <div className="mini-pitch">
                      <svg viewBox="0 0 105 68" aria-hidden="true">
                        <path d="M0 0h105v68H0ZM52.5 0v68M105 14H88v40h17" />
                        <circle cx="52.5" cy="34" r="9" />
                        {scene.players
                          .filter((p) => p.team === 'home')
                          .map((p) => {
                            const pt = interpolate(scene.tracks[p.id], e.at);
                            return (
                              <circle
                                key={p.id}
                                cx={pt.x}
                                cy={pt.y}
                                r="1.5"
                                className="mini-player"
                              />
                            );
                          })}
                        <path
                          className="mini-pass"
                          d={`M${e.from.x} ${e.from.y}L${e.to.x} ${e.to.y}`}
                        />
                        <circle className="mini-ball" cx={e.to.x} cy={e.to.y} r="2" />
                      </svg>
                      <span>{clock(scene.baseClock, e.at)}</span>
                    </div>
                    <div className="frame-label">
                      <b>{String(i + 1).padStart(2, '0')}</b>
                      <span>{e.label[language]}</span>
                    </div>
                  </button>
                ))}
              </div>
              {recapReturn && !analysis.data?.recap && (
                <button
                  className="recap-return"
                  onClick={() => {
                    jump(scene.events.length - 1);
                    setRecapReturn(false);
                  }}
                >
                  {language === 'en' ? 'Return to sequence recap ↗' : 'Volver al resumen ↗'}
                </button>
              )}
              {analysis.data?.recap && (
                <section className="sequence-recap" aria-label="Automatic sequence recap">
                  <header>
                    <span>{language === 'en' ? 'SEQUENCE RECAP' : 'RESUMEN DE LA JUGADA'}</span>
                    <b>{analysis.data.recap.outcome.replace('-', ' ').toUpperCase()}</b>
                  </header>
                  <h2>{analysis.data.recap.title}</h2>
                  <p>{analysis.data.recap.summary}</p>
                  <div className="recap-cards">
                    {analysis.data.recap.cards.map((card, i) => (
                      <article key={card.title}>
                        <span className="recap-number">0{i + 1}</span>
                        <h3>{card.title}</h3>
                        <p>{card.text}</p>
                        {card.factIds.map((id) => {
                          const fact = analysis.data!.evidence.facts.find((f) => f.id === id)!;
                          return (
                            <button
                              key={id}
                              onClick={() => {
                                setRecapReturn(true);
                                inspectFact(fact);
                              }}
                            >
                              {language === 'en' ? 'Replay evidence' : 'Ver evidencia'} ·{' '}
                              {clock(scene.baseClock, fact.at)} ↗
                              <small>
                                {fact.eventId} · v{fact.version}
                              </small>
                            </button>
                          );
                        })}
                      </article>
                    ))}
                  </div>
                  <small>{analysis.data.recap.limitation}</small>
                </section>
              )}
            </section>
            <aside
              className={`notebook ${drawer ? 'notebook-open' : ''}`}
              aria-label="Evidence notebook"
            >
              <div className="notebook-heading">
                <span>THE ANALYST’S NOTEBOOK</span>
                <button
                  className="mobile-close"
                  aria-label="Close notebook"
                  onClick={() => setDrawer(false)}
                >
                  <Glyph kind="close" />
                </button>
                <span className="note-dot" />
              </div>
              <div className="note-body">
                <div className="note-number">
                  {String(selected + 1).padStart(2, '0')}
                  <span> / {scene.events.length}</span>
                </div>
                <div className="event-tag">
                  {event.type.toUpperCase()} <span>·</span> {clock(scene.baseClock, event.at)}
                </div>
                <h2>
                  {pass ? (
                    <>
                      {headline}
                      <br />
                      <em>{subtitle}</em>
                    </>
                  ) : event.type === 'goal' ? (
                    <>
                      The finish.
                      <br />
                      <em>Now rewind.</em>
                    </>
                  ) : event.type === 'save' ? (
                    <>
                      A chance.
                      <br />
                      <em>Not a goal.</em>
                    </>
                  ) : (
                    event.label[language]
                  )}
                </h2>
                <div className="audience-row">
                  <button className={!analyst ? 'selected' : ''} onClick={() => setAnalyst(false)}>
                    Fan view
                  </button>
                  <button className={analyst ? 'selected' : ''} onClick={() => setAnalyst(true)}>
                    Analyst view
                  </button>
                  <Select
                    compact
                    label="Explanation language"
                    value={language}
                    onChange={(v) => setLanguage(v as Language)}
                    options={[
                      { value: 'en', label: 'EN', detail: 'English' },
                      { value: 'es', label: 'ES', detail: 'Español' },
                    ]}
                  />
                </div>
                <p className="explanation">
                  {evidenceGuide
                    ? evidenceGuide.detail
                    : time < event.at && !comparison
                      ? 'The sequence is beginning. Play forward to inspect the first event.'
                      : serverExplanation
                        ? serverExplanation.text
                        : pass
                          ? spatialStory
                          : evidenceFor(scene, event, analyst ? 'analyst' : 'fan', language)}
                </p>
                {analysis.data?.buildup && (
                  <section className="buildup-story" aria-label="Explain this attack">
                    <span className="buildup-kicker">
                      {language === 'en' ? 'READ THE BUILDUP' : 'LEE LA JUGADA'}
                    </span>
                    <h3>{analysis.data.buildup.title}</h3>
                    <p>{analysis.data.buildup.summary}</p>
                    {analysis.data.buildup.factIds.map((id) => {
                      const fact = analysis.data!.evidence.facts.find((f) => f.id === id)!;
                      return (
                        <button
                          className="evidence-fact"
                          key={id}
                          onClick={() => inspectFact(fact)}
                        >
                          <small>
                            {fact.kind === 'off-ball-run'
                              ? 'RUN'
                              : fact.kind === 'space-change'
                                ? 'SPACE'
                                : 'PASS'}{' '}
                            · {clock(scene.baseClock, fact.at)}
                          </small>
                          <span>{fact.text}</span>
                          <b>
                            {language === 'en' ? 'Show the evidence ↗' : 'Ver la evidencia ↗'}
                          </b>
                          <small>
                            {analyst ? fact.method : `${fact.eventId} · v${fact.version}`}
                          </small>
                        </button>
                      );
                    })}
                    <small>{analysis.data.buildup.limitation}</small>
                  </section>
                )}
                <section className="api-evidence" aria-label="Replay intelligence">
                  <div className="api-evidence-status" role="status">
                    <span className={`api-dot ${analysis.status}`} />
                    {analysis.status === 'loading'
                      ? 'Loading replay evidence…'
                      : analysis.status === 'offline'
                        ? 'Local fallback · evidence API unavailable'
                        : 'Backend evidence · deterministic'}
                  </div>
                  <small>Foundry disconnected · synthetic match data</small>
                  {analysis.status === 'offline' && (
                    <button className="evidence-retry" onClick={analysis.retry}>
                      Retry connection ↗
                    </button>
                  )}
                  {eventFacts
                    .filter((f) => f.kind === 'pass-distance' || f.kind === 'receiver-space')
                    .map((f) => (
                      <button
                        className="evidence-fact"
                        key={f.id}
                        onClick={() => {
                          jump(selected);
                          setFocus(f.playerId);
                          setLayer('space');
                        }}
                      >
                        <span>{f.text}</span>
                        <small>{f.method}</small>
                        <b>Inspect at {clock(scene.baseClock, f.at)} ↗</b>
                      </button>
                    ))}
                  {!!analysis.data?.moments.length && (
                    <Disclosure title="Evidence-backed replay moments" open={analyst}>
                      {analysis.data.moments.map((moment) => (
                        <button
                          className="evidence-moment"
                          key={moment.id}
                          onClick={() => {
                            const index = scene.events.findIndex(
                              (e) => e.id === moment.eventId && e.version === moment.version,
                            );
                            if (index >= 0) {
                              jump(index);
                              setFocus(moment.playerId);
                              setLayer('space');
                            }
                          }}
                        >
                          <span>{clock(scene.baseClock, moment.replayAt)}</span>
                          {moment.text}
                          <small>
                            {moment.eventId} · v{moment.version}
                          </small>
                        </button>
                      ))}
                    </Disclosure>
                  )}
                </section>
                {pass && (
                  <>
                    <div className="connection">
                      <span>
                        <b>{player.number}</b>
                        {player.name}
                      </span>
                      <Glyph kind="arrow" />
                      <span>
                        <b>{receiver?.number}</b>
                        {receiver?.name}
                      </span>
                    </div>
                    <div className="measurement">
                      <div>
                        <span className="measure-index">A</span>
                        <span>
                          Pass distance<small>Recorded start → end</small>
                        </span>
                      </div>
                      <strong>
                        {spatial.length.toFixed(1)}
                        <small>m</small>
                      </strong>
                    </div>
                    <div className="measurement">
                      <div>
                        <span className="measure-index pink">B</span>
                        <span>
                          Nearest defender to lane
                          <small>
                            {spatial.lane.player.name} · {clock(scene.baseClock, displayTime)}
                          </small>
                        </span>
                      </div>
                      <strong>
                        {spatial.lane.laneDistance.toFixed(1)}
                        <small>m</small>
                      </strong>
                    </div>
                    <div className="measurement">
                      <div>
                        <span className="measure-index mint">C</span>
                        <span>
                          Space at receiving point<small>Nearest opponent distance</small>
                        </span>
                      </div>
                      <strong>
                        {spatial.receiver.receiverDistance.toFixed(1)}
                        <small>m</small>
                      </strong>
                    </div>
                    <button
                      className="compare-note"
                      onClick={() => {
                        endGuide();
                        setComparison(!comparison);
                        setPlaying(false);
                      }}
                    >
                      <Glyph kind="compare" />
                      {comparison
                        ? 'Return to selected moment'
                        : 'What changed in the last 2 seconds?'}
                      <span>↗</span>
                    </button>
                  </>
                )}
                {focused && (
                  <div className="player-inspector">
                    <span>PLAYER FOCUS</span>
                    <strong>
                      {focused.number} / {focused.name}
                    </strong>
                    <p>
                      {focused.team === 'home' ? scene.home : scene.away} · x{' '}
                      {interpolate(scene.tracks[focus!], displayTime).x.toFixed(1)} m · y{' '}
                      {interpolate(scene.tracks[focus!], displayTime).y.toFixed(1)} m
                    </p>
                    <button onClick={() => setFocus(null)}>Clear player focus ×</button>
                  </div>
                )}
                <Disclosure title="Inspect the evidence" open={drawer || analyst}>
                  <code>
                    {event.id}@{event.version}
                  </code>
                  <p>
                    Frame {displayTime.toFixed(1)}s · seed {scene.seed}. Lane clearance is the
                    shortest distance from an opponent to the finite pass segment. Receiving space
                    uses the endpoint, not the moving receiver.
                  </p>
                  <p>
                    Authored synthetic movement. These measurements do not establish pass success or
                    tactical causality.
                  </p>
                </Disclosure>
              </div>
              <div className="notebook-footer">
                <span className="engine-dot" />
                <span>
                  Geometry engine <b>·</b>{' '}
                  {analysis.status === 'ready' ? 'Backend evidence' : 'Local analysis'}
                </span>
              </div>
            </aside>
          </div>
          <footer className="status-bar">
            <span>
              <i /> SYNTHETIC MATCH LAB <b>/</b> Original fictional teams & tracking
            </span>
            <span>
              Foundry integration pending <b>·</b> v0.5
            </span>
          </footer>
        </main>
      </div>
      {notice && (
        <div role="status" className="toast">
          {notice}
        </div>
      )}
    </div>
  );
}
