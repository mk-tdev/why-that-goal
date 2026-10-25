export type Point = { x: number; y: number };
export type Language = 'en' | 'es';
export type Audience = 'fan' | 'analyst';
export type EventType = 'recovery' | 'pass' | 'shot' | 'goal' | 'save';
export type MatchEvent = {
  id: string;
  version: number;
  at: number;
  receivedAt: number;
  type: EventType;
  team: 'home' | 'away';
  player: string;
  recipient?: string;
  from: Point;
  to: Point;
  outcome: 'success' | 'failed' | 'voided';
  label: Record<Language, string>;
};
export type Player = { id: string; name: string; number: number; team: 'home' | 'away' };
export type Keyframe = { at: number; point: Point };
export type Scenario = {
  id: string;
  title: string;
  subtitle: string;
  chapter: string;
  home: string;
  away: string;
  baseClock: number;
  duration: number;
  seed: number;
  events: MatchEvent[];
  players: Player[];
  tracks: Record<string, Keyframe[]>;
  ball: Keyframe[];
  thesis: Record<Language, string>;
  limitation: Record<Language, string>;
};

export function distance(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Event time and arrival time both gate visibility. A revision replaces its ID. */
export function visibleEvents(events: MatchEvent[], at: number, receivedAt = at): MatchEvent[] {
  const latest = new Map<string, MatchEvent>();
  for (const event of events) {
    if (event.at > at || event.receivedAt > receivedAt) continue;
    const prior = latest.get(event.id);
    if (
      !prior ||
      event.version > prior.version ||
      (event.version === prior.version && event.receivedAt > prior.receivedAt)
    )
      latest.set(event.id, event);
  }
  return [...latest.values()].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
}

export function matchState(events: MatchEvent[], at: number, receivedAt = at) {
  const visible = visibleEvents(events, at, receivedAt);
  const active = visible.filter((e) => e.outcome !== 'voided');
  return {
    events: visible,
    home: active.filter((e) => e.type === 'goal' && e.team === 'home').length,
    away: active.filter((e) => e.type === 'goal' && e.team === 'away').length,
    passes: active.filter((e) => e.type === 'pass' && e.outcome === 'success').length,
    shots: active.filter((e) => e.type === 'shot').length,
  };
}

export function interpolate(frames: Keyframe[], at: number): Point {
  if (!frames.length) throw new Error('Tracking frames are required');
  if (at <= frames[0].at) return frames[0].point;
  for (let i = 1; i < frames.length; i++) {
    if (at <= frames[i].at) {
      const left = frames[i - 1],
        right = frames[i];
      const ratio = (at - left.at) / (right.at - left.at);
      return {
        x: left.point.x + (right.point.x - left.point.x) * ratio,
        y: left.point.y + (right.point.y - left.point.y) * ratio,
      };
    }
  }
  return frames[frames.length - 1].point;
}

export function clock(base: number, at: number) {
  const seconds = Math.floor(base + at);
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

export function evidenceFor(
  scenario: Scenario,
  event: MatchEvent,
  audience: Audience,
  language: Language,
) {
  const name = scenario.players.find((p) => p.id === event.player)?.name ?? event.player;
  const receiver = scenario.players.find((p) => p.id === event.recipient)?.name ?? event.recipient;
  const metres = distance(event.from, event.to).toFixed(1);
  const progress = (event.to.x - event.from.x).toFixed(1);
  if (event.outcome === 'voided')
    return language === 'en'
      ? 'This event was withdrawn. Its earlier interpretation is no longer valid.'
      : 'Este evento fue anulado. Su interpretación anterior ya no es válida.';
  if (
    event.type === 'recovery' &&
    scenario.events.some((e) => e.at < event.at && e.outcome === 'failed' && e.team !== event.team)
  )
    return language === 'en'
      ? `${name} takes possession for the opposition. The attack has broken down.`
      : `${name} recupera para el rival. El ataque termina.`;
  if (event.outcome === 'failed')
    return language === 'en'
      ? `${name}'s attempted pass was intercepted. The attack lost possession before this connection could be completed.`
      : `El pase de ${name} fue interceptado. El ataque perdió la posesión.`;
  if (event.type === 'pass') {
    return language === 'en'
      ? audience === 'analyst'
        ? `${name} → ${receiver}. ${metres} m completed pass; ${progress} m change along the attacking axis. Distance is calculated from the recorded start and end coordinates.`
        : `${name} finds ${receiver} with a ${metres}-metre pass. The highlighted line shows the ball's recorded route.`
      : audience === 'analyst'
        ? `${name} → ${receiver}. Pase completado de ${metres} m; cambio de ${progress} m en el eje de ataque. La distancia se calcula con las coordenadas registradas.`
        : `${name} encuentra a ${receiver} con un pase de ${metres} metros. La línea muestra la trayectoria registrada del balón.`;
  }
  const text: Record<EventType, Record<Language, string>> = {
    recovery: {
      en: `${name} recovers the ball. This is the first recorded action in this sequence; the preceding pressure is not measured.`,
      es: `${name} recupera el balón. Es la primera acción registrada; no se mide la presión anterior.`,
    },
    pass: { en: '', es: '' },
    shot: {
      en: `${name} takes a shot from ${distance(event.from, { x: event.team === 'home' ? 105 : 0, y: 34 }).toFixed(1)} m from the centre of goal. This is distance, not an expected-goals probability.`,
      es: `${name} remata a ${distance(event.from, { x: event.team === 'home' ? 105 : 0, y: 34 }).toFixed(1)} m del centro de la portería. Es una distancia, no una probabilidad de gol.`,
    },
    goal: {
      en: `${name}'s finish is recorded as a goal. Rewind the preceding passes to inspect how the ball reached this position.`,
      es: `El remate de ${name} se registra como gol. Rebobina los pases anteriores para ver cómo llegó el balón.`,
    },
    save: {
      en: 'The goalkeeper saves the shot. Completed passes advanced the ball, but this sequence did not produce a goal.',
      es: 'El portero detiene el remate. Los pases hicieron avanzar el balón, pero la secuencia no terminó en gol.',
    },
  };
  return text[event.type][language];
}

export function exportOverlay(
  scenario: Scenario,
  at: number,
  audience: Audience,
  language: Language,
) {
  const state = matchState(scenario.events, at);
  return {
    schemaVersion: '1.0',
    matchId: scenario.id,
    source: 'synthetic',
    generatorSeed: scenario.seed,
    generatedThrough: at,
    units: 'metres',
    pitch: { length: 105, width: 68 },
    mode: 'deterministic-template',
    audience,
    language,
    overlays: state.events
      .filter((e) => e.outcome !== 'voided')
      .map((e) => ({
        start: e.at,
        end: Math.min(e.at + 4, scenario.duration),
        text: evidenceFor(scenario, e, audience, language),
        evidence: [{ id: e.id, version: e.version }],
        target: e.to,
      })),
  };
}
