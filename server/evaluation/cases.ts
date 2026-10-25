import type { Scenario, Point, Keyframe, MatchEvent } from '../../src/core/model';
export type EvaluationCase = {
  id: string;
  scenario: Scenario;
  expected: {
    outcome: 'goal' | 'save' | 'failed-attack';
    space: 'closing' | 'opening';
    runs: boolean;
    attackingTeam: 'home' | 'away';
  };
};
/** New authored sequences reserved for enterprise validation, separate from the six replay/demo fixtures. */
function build(
  id: string,
  outcome: 'goal' | 'save' | 'failed-attack',
  closing: boolean,
  away = false,
  stationary = false,
): EvaluationCase {
  const duration = outcome === 'failed-attack' ? 10 : 14;
  const a: Point = { x: 55, y: 20 },
    b: Point = { x: 70, y: 26 },
    c: Point = { x: 84, y: 38 },
    shot: Point = { x: 88, y: 34 },
    goal: Point = { x: 105, y: 32 };
  const team: 'home' | 'away' = away ? 'away' : 'home',
    opponent: 'home' | 'away' = away ? 'home' : 'away';
  const map = (p: Point) => ({ x: away ? 105 - p.x : p.x, y: p.y });
  const names = [
    'Aster',
    'Rowan',
    'Noor',
    'Kai',
    'Linden',
    'Iris',
    'Ellis',
    'Quinn',
    'Mika',
    'Sage',
    'Vale',
  ];
  const players = [
    ...names.map((name, i) => ({ id: `A${i}`, name, number: i + 1, team })),
    ...names.map((_, i) => ({
      id: `D${i}`,
      name: `Rival ${String.fromCharCode(65 + i)}`,
      number: i + 1,
      team: opponent,
    })),
  ];
  const event = (
    suffix: string,
    at: number,
    type: MatchEvent['type'],
    player: string,
    from: Point,
    to: Point,
    recipient?: string,
    success = true,
  ): MatchEvent => ({
    id: `${id}-${suffix}`,
    version: 1,
    at,
    receivedAt: at,
    type,
    team,
    player,
    recipient,
    from: map(from),
    to: map(to),
    outcome: success ? 'success' : 'failed',
    label: { en: suffix, es: suffix },
  });
  const events = [
    event('recover', 1, 'recovery', 'A0', a, a),
    event('first', 4, 'pass', 'A0', a, b, 'A1'),
    event('second', 8, 'pass', 'A1', b, c, 'A2', outcome !== 'failed-attack'),
  ];
  if (outcome === 'failed-attack')
    events.push({ ...event('turnover', 8.3, 'recovery', 'D0', c, c), team: opponent });
  else {
    events.push(event('shot', 11, 'shot', 'A2', shot, goal));
    events.push(event('terminal', 12, outcome, 'A2', shot, goal));
  }
  function lerp(x: Point, y: Point, t: number): Point {
    return { x: x.x + (y.x - x.x) * t, y: x.y + (y.y - x.y) * t };
  }
  function point(player: string, t: number): Point {
    if (player === 'A0') return a;
    if (player === 'A1') return stationary ? b : lerp({ x: 64, y: 22 }, b, Math.min(1, t / 4));
    if (player === 'A2')
      return stationary
        ? c
        : t < 8
          ? lerp({ x: 76, y: 40 }, c, Math.min(1, Math.max(0, (t - 4) / 4)))
          : lerp(c, shot, Math.min(1, (t - 8) / 3));
    if (player === 'D0')
      return lerp(
        { x: closing ? 98 : 89, y: 38 },
        { x: closing ? 88 : 98, y: 38 },
        Math.min(1, Math.max(0, (t - 6) / 2)),
      );
    if (player === 'D1') return lerp({ x: 78, y: 24 }, { x: 73, y: 26 }, Math.min(1, t / 4));
    if (player === 'D10') return { x: 102, y: 34 };
    const n = Number(player.slice(1));
    return player[0] === 'D'
      ? { x: 82 + (n % 3) * 5, y: 8 + (n % 5) * 12 }
      : { x: 40 + (n % 4) * 5, y: 8 + (n % 5) * 12 };
  }
  const tracks: Record<string, Keyframe[]> = {};
  for (const p of players)
    tracks[p.id] = Array.from({ length: duration * 10 + 1 }, (_, i) => ({
      at: i / 10,
      point: map(point(p.id, i / 10)),
    }));
  const scenario: Scenario = {
    id,
    title: id,
    subtitle: 'Reserved synthetic evaluation attack',
    chapter: 'EVAL',
    home: 'Aster XI',
    away: 'Rival XI',
    baseClock: 0,
    duration,
    seed: 901,
    players,
    events,
    tracks,
    ball: events.map((e) => ({ at: e.at, point: e.to })),
    thesis: {
      en: 'Evaluate only what the evidence supports.',
      es: 'Evaluar solo lo respaldado por evidencia.',
    },
    limitation: {
      en: 'Authored validation data, not a real match.',
      es: 'Datos de validación ficticios.',
    },
  };
  return {
    id,
    scenario,
    expected: {
      outcome,
      space: closing ? 'closing' : 'opening',
      runs: !stationary,
      attackingTeam: team,
    },
  };
}
export const evaluationCases = [
  build('reserved-patient-goal', 'goal', true),
  build('reserved-wide-save', 'save', false),
  build('reserved-square-interception', 'failed-attack', true),
  build('reserved-away-finish', 'goal', false, true, true),
];
