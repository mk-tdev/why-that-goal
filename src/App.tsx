import { useEffect, useState } from 'react';
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
  const pass = event.type === 'pass';
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
        const next = Math.min(scene.duration, t + (now - previous) / 1000);
        previous = now;
        if (next >= scene.duration) setPlaying(false);
        return next;
      });
    }, 32);
    return () => clearInterval(id);
  }, [playing, scene.duration]);
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
    setSelected(index);
    setTime(scene.events[index].at);
    setPlaying(false);
    setComparison(false);
  }
  function changeScene(id: string) {
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
  const pass = event.type === 'pass';
  const sideways = Math.abs(event.to.y - event.from.y);
  const headline = pass
    ? spatial.progress > 20
      ? 'Progress through the pitch.'
      : sideways > 18
        ? 'Change the angle.'
        : 'The final connection.'
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
    <div className="desk">
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
          Match studio <span>/</span> Untitled analysis
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
            onClick={() => setDrawer(!drawer)}
          >
            <Glyph kind="layers" />
            <span>Evidence</span>
          </button>
          <div className="rail-bottom">
            WTG
            <br />
            <span>0.2</span>
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
            <label className="scenario-select">
              <span>SEQUENCE</span>
              <select
                aria-label="Choose synthetic scenario"
                value={sceneId}
                onChange={(e) => changeScene(e.target.value)}
              >
                {scenarios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.chapter} / {s.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="working-area">
            <section className="replay-surface" aria-label="Match replay">
              <div className="canvas-toolbar">
                <div className="view-tabs">
                  <button
                    className={layer === 'space' ? 'active' : ''}
                    onClick={() => setLayer('space')}
                  >
                    Passing lanes
                  </button>
                  <button
                    className={layer === 'trails' ? 'active' : ''}
                    onClick={() => setLayer('trails')}
                  >
                    Movement
                  </button>
                  <button
                    className={layer === 'clean' ? 'active' : ''}
                    onClick={() => setLayer('clean')}
                  >
                    Clean feed
                  </button>
                </div>
                <button
                  className={`compare-button ${comparison ? 'active' : ''}`}
                  aria-pressed={comparison}
                  onClick={() => {
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
                  {comparison ? 'EARLIER FRAME' : playing ? 'REPLAYING' : 'PAUSED'} <i />
                </span>
                <Field
                  scene={scene}
                  time={displayTime}
                  event={event}
                  layer={layer}
                  focus={focus}
                  onFocus={setFocus}
                  comparison={comparison}
                />
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
                    setComparison(false);
                    if (time >= scene.duration) {
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
                  <input
                    aria-label="Replay time"
                    type="range"
                    min="0"
                    max={scene.duration}
                    step=".1"
                    value={time}
                    onChange={(e) => {
                      const t = Number(e.target.value);
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
                <span className="duration">{scene.duration}s</span>
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
                  06 moments <span>·</span> Select to inspect
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
                  <span> / 06</span>
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
                  <select
                    aria-label="Explanation language"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as Language)}
                  >
                    <option value="en">EN</option>
                    <option value="es">ES</option>
                  </select>
                </div>
                <p className="explanation">
                  {time < event.at && !comparison
                    ? 'The sequence is beginning. Play forward to inspect the first event.'
                    : pass
                      ? spatialStory
                      : evidenceFor(scene, event, analyst ? 'analyst' : 'fan', language)}
                </p>
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
                <details className="evidence-details" open={drawer || analyst}>
                  <summary>
                    Inspect the evidence <span>↗</span>
                  </summary>
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
                </details>
              </div>
              <div className="notebook-footer">
                <span className="engine-dot" />
                <span>
                  Geometry engine <b>·</b> Local analysis
                </span>
              </div>
            </aside>
          </div>
          <footer className="status-bar">
            <span>
              <i /> SYNTHETIC MATCH LAB <b>/</b> Original fictional teams & tracking
            </span>
            <span>
              Foundry integration pending <b>·</b> v0.2
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
