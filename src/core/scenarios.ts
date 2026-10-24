import { buildMotion } from './motion';
import { interpolate, type EventType, MatchEvent, Player, Point, Scenario } from './model';

const names = [
  'Mora',
  'Kato',
  'Marin',
  'Costa',
  'Reyes',
  'Osei',
  'Vega',
  'Silva',
  'Okafor',
  'Tan',
  'Mendes',
];
const formation: Point[] = [
  { x: 8, y: 34 },
  { x: 30, y: 10 },
  { x: 27, y: 25 },
  { x: 27, y: 43 },
  { x: 30, y: 58 },
  { x: 49, y: 26 },
  { x: 57, y: 53 },
  { x: 60, y: 19 },
  { x: 82, y: 34 },
  { x: 67, y: 43 },
  { x: 71, y: 12 },
];
type Action = [number, EventType, number, Point, Point, number?, string?, string?];
function makeScenario(
  id: string,
  title: string,
  subtitle: string,
  chapter: string,
  seed: number,
  baseClock: number,
  actions: Action[],
  thesis: Scenario['thesis'],
): Scenario {
  const duration = actions[actions.length - 1][0] + 3;
  const players: Player[] = ['home', 'away'].flatMap((team, side) =>
    names.map((name, i) => ({
      id: `${side ? 'A' : 'N'}-${i + 1}`,
      name: side
        ? [
            'Paz',
            'Sato',
            'Frey',
            'Park',
            'Diaz',
            'Amin',
            'Duarte',
            'Cole',
            'Luca',
            'Santos',
            'Ibrahim',
          ][i]
        : name,
      number: i + 1,
      team: team as Player['team'],
    })),
  );
  const events: MatchEvent[] = actions.map(
    ([at, type, number, from, to, recipient, en, es], i) => ({
      id: `${id}-${String(i + 1).padStart(2, '0')}`,
      version: 1,
      at,
      receivedAt: at,
      type,
      team: type === 'save' ? 'away' : 'home',
      player: type === 'save' ? 'A-1' : `N-${number}`,
      recipient: recipient ? `N-${recipient}` : undefined,
      from,
      to,
      outcome: 'success',
      label: { en: en ?? type, es: es ?? type },
    }),
  );
  return buildMotion(
    {
      id,
      title,
      subtitle,
      chapter,
      home: 'Northstar FC',
      away: 'Atlas Athletic',
      baseClock,
      duration,
      seed,
      players,
      events,
      tracks: {},
      ball: [],
      thesis,
      limitation: {
        en: 'These are authored synthetic events. Spatial movement is illustrative; it does not prove tactical causality.',
        es: 'Eventos sintéticos diseñados. El movimiento es ilustrativo y no demuestra causalidad táctica.',
      },
    },
    formation,
  );
}

export const scenarios: Scenario[] = [
  makeScenario(
    'quick-break',
    'The quick break',
    'One recovery. Three passes. A finish.',
    '01',
    71,
    72 * 60,
    [
      [
        1,
        'recovery',
        6,
        { x: 57, y: 31 },
        { x: 57, y: 31 },
        undefined,
        'The recovery',
        'La recuperación',
      ],
      [4, 'pass', 6, { x: 57, y: 31 }, { x: 72, y: 24 }, 8, 'The first pass', 'El primer pase'],
      [
        8,
        'pass',
        8,
        { x: 72, y: 24 },
        { x: 88, y: 46 },
        7,
        'Into the wide channel',
        'Hacia la banda',
      ],
      [12, 'pass', 7, { x: 88, y: 46 }, { x: 94, y: 34 }, 9, 'The final pass', 'El último pase'],
      [15, 'shot', 9, { x: 94, y: 34 }, { x: 104, y: 34 }, undefined, 'The finish', 'El remate'],
      [
        16,
        'goal',
        9,
        { x: 104, y: 34 },
        { x: 105, y: 34 },
        undefined,
        'Goal, Northstar',
        'Gol de Northstar',
      ],
    ],
    {
      en: 'The finish took a second. The buildup tells the story.',
      es: 'El remate duró un segundo. La jugada cuenta la historia.',
    },
  ),
  makeScenario(
    'switch-play',
    'A change of perspective',
    'Across the pitch. Into a new angle.',
    '02',
    214,
    38 * 60,
    [
      [
        1,
        'recovery',
        3,
        { x: 38, y: 52 },
        { x: 38, y: 52 },
        undefined,
        'A fresh possession',
        'Una nueva posesión',
      ],
      [
        5,
        'pass',
        3,
        { x: 38, y: 52 },
        { x: 60, y: 18 },
        8,
        'Switching the play',
        'Cambio de orientación',
      ],
      [
        9,
        'pass',
        8,
        { x: 60, y: 18 },
        { x: 85, y: 12 },
        11,
        'Progress on the left',
        'Avance por la izquierda',
      ],
      [
        14,
        'pass',
        11,
        { x: 85, y: 12 },
        { x: 93, y: 31 },
        9,
        'Back into the centre',
        'Hacia el centro',
      ],
      [
        17,
        'shot',
        9,
        { x: 93, y: 31 },
        { x: 104, y: 33 },
        undefined,
        'The close-range shot',
        'El remate cercano',
      ],
      [
        18,
        'goal',
        9,
        { x: 104, y: 33 },
        { x: 105, y: 33 },
        undefined,
        'The move pays off',
        'La jugada termina en gol',
      ],
    ],
    {
      en: 'Follow the ball across the pitch, then back into the centre.',
      es: 'Sigue el balón por el campo y después hacia el centro.',
    },
  ),
  makeScenario(
    'no-finish',
    'Possession isn’t a promise',
    'A passing sequence. A save. No goal.',
    '03',
    503,
    54 * 60,
    [
      [
        1,
        'recovery',
        4,
        { x: 40, y: 42 },
        { x: 40, y: 42 },
        undefined,
        'A new sequence',
        'Una nueva secuencia',
      ],
      [
        5,
        'pass',
        4,
        { x: 40, y: 42 },
        { x: 56, y: 23 },
        6,
        'Building patiently',
        'Construcción paciente',
      ],
      [
        10,
        'pass',
        6,
        { x: 56, y: 23 },
        { x: 69, y: 42 },
        10,
        'Another connection',
        'Otra conexión',
      ],
      [
        14,
        'pass',
        10,
        { x: 69, y: 42 },
        { x: 79, y: 28 },
        9,
        'An opening to shoot',
        'Oportunidad de remate',
      ],
      [
        17,
        'shot',
        9,
        { x: 79, y: 28 },
        { x: 100, y: 34 },
        undefined,
        'A shot from distance',
        'Un remate lejano',
      ],
      [
        18,
        'save',
        9,
        { x: 100, y: 34 },
        { x: 101, y: 34 },
        undefined,
        'Saved by Atlas',
        'Parada de Atlas',
      ],
    ],
    {
      en: 'Three completed passes. A shot. Still no goal.',
      es: 'Tres pases completados. Un remate. Ningún gol.',
    },
  ),
];

/** Derived regression fixtures reuse valid motion, then transform the entire coordinate system. */
function variation(source: Scenario, id: string, title: string, chapter: string): Scenario {
  const s = structuredClone(source);
  s.id = id;
  s.title = title;
  s.chapter = chapter;
  s.seed += 1000;
  s.events.forEach((e, i) => {
    e.id = `${id}-${String(i + 1).padStart(2, '0')}`;
    e.from.y = 68 - e.from.y;
    e.to.y = 68 - e.to.y;
  });
  for (const frames of [...Object.values(s.tracks), s.ball])
    for (const f of frames) f.point.y = 68 - f.point.y;
  return s;
}

// A longer switch followed by a close-range save, with a different passing route.
scenarios.push(
  makeScenario(
    'cutback-save',
    'The cutback denied',
    'A switch, a cutback, a goalkeeper intervention.',
    '04',
    842,
    63 * 60,
    [
      [
        1,
        'recovery',
        3,
        { x: 38, y: 52 },
        { x: 38, y: 52 },
        undefined,
        'Build from deep',
        'Desde atrás',
      ],
      [
        5,
        'pass',
        3,
        { x: 38, y: 52 },
        { x: 60, y: 18 },
        8,
        'Switch to the left',
        'Cambio a la izquierda',
      ],
      [
        9,
        'pass',
        8,
        { x: 60, y: 18 },
        { x: 85, y: 12 },
        11,
        'Release the winger',
        'Pase al extremo',
      ],
      [14, 'pass', 11, { x: 85, y: 12 }, { x: 93, y: 31 }, 9, 'The cutback', 'Pase atrás'],
      [
        17,
        'shot',
        9,
        { x: 93, y: 31 },
        { x: 100, y: 34 },
        undefined,
        'Close-range attempt',
        'Remate cercano',
      ],
      [
        18,
        'save',
        1,
        { x: 100, y: 34 },
        { x: 100, y: 34 },
        undefined,
        'Keeper denies the finish',
        'El portero evita el gol',
      ],
    ],
    {
      en: 'A clear passing route can still end with a save.',
      es: 'Una buena combinación también puede terminar en parada.',
    },
  ),
);

function intercepted(
  source: Scenario,
  id: string,
  title: string,
  chapter: string,
  passIndex: number,
) {
  const s = variation(source, id, title, chapter);
  const failed = s.events.filter((e) => e.type === 'pass')[passIndex];
  const intended = failed.recipient!;
  // Swap complete tracks so the defender meets the ball without introducing a collision or teleport.
  const defender = 'A-6';
  [s.tracks[intended], s.tracks[defender]] = [s.tracks[defender], s.tracks[intended]];
  failed.recipient = defender;
  failed.outcome = 'failed';
  failed.label = { en: 'Pass intercepted', es: 'Pase interceptado' };
  s.events = s.events.filter((e) => e.at <= failed.at);
  s.events.push({
    ...failed,
    id: `${id}-turnover`,
    at: failed.at + 0.1,
    receivedAt: failed.at + 0.1,
    type: 'recovery',
    team: 'away',
    player: defender,
    recipient: undefined,
    from: { ...failed.to },
    to: { ...failed.to },
    outcome: 'success',
    label: { en: 'Atlas takes possession', es: 'Atlas recupera el balón' },
  });
  s.duration = failed.at + 2;
  for (const [player, frames] of Object.entries(s.tracks)) {
    const point = interpolate(frames, failed.at);
    s.tracks[player] = [
      ...frames.filter((f) => f.at < failed.at),
      { at: failed.at, point },
      { at: s.duration, point: { ...point } },
    ];
  }
  s.ball = s.ball.filter((f) => f.at <= failed.at);
  s.subtitle = 'An intercepted pass. No shot. No goal.';
  s.thesis = {
    en: 'The intended connection never arrived. The opponent recovered possession before a shot.',
    es: 'El pase no llegó al compañero. El rival recuperó antes del remate.',
  };
  return s;
}
scenarios.push(intercepted(scenarios[0], 'counter-cut-out', 'The counter cut out', '05', 2));
scenarios.push(intercepted(scenarios[1], 'switch-intercepted', 'The switch intercepted', '06', 1));
