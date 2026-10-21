import { distance, interpolate, type Scenario, type Point, type MatchEvent } from './model';
import { flightFor } from './motion';
import { inspectSpace } from './spatial';

export type GuideStep = {
  id: string;
  kind: 'pass' | 'run' | 'space' | 'finish';
  title: string;
  detail: string;
  event: MatchEvent;
  start: number;
  end: number;
  anchor: Point;
  player?: string;
  before?: number;
  after?: number;
  metric: string;
};
/** Retrospective chapters: all measurements refer to the authored synthetic tracks. */
export function buildGuide(s: Scenario): GuideStep[] {
  const passes = s.events.filter((e) => e.type === 'pass');
  const name = (id?: string) => s.players.find((p) => p.id === id)?.name ?? '';
  const passStep = (e: MatchEvent, title: string): GuideStep => {
    const f = flightFor(e, s.events)!;
    return {
      id: e.id,
      kind: 'pass',
      title,
      event: e,
      start: Math.max(0, f.start - 0.5),
      end: e.at + 0.3,
      anchor: { x: (e.from.x + e.to.x) / 2, y: (e.from.y + e.to.y) / 2 },
      detail: `${name(e.player)} → ${name(e.recipient)}. Follow the gold line from release to reception.`,
      metric: `${distance(e.from, e.to).toFixed(1)} m pass`,
    };
  };
  const e = passes[1],
    f = flightFor(e, s.events)!;
  const start = Math.max(passes[0].at + 0.2, f.start - 1.8),
    end = e.at;
  // Exclude every player who owns or receives the ball during this interval.
  const involved = new Set<string>();
  for (const ev of s.events) {
    const flight = flightFor(ev, s.events);
    if (
      (flight && flight.end >= start && flight.start <= end) ||
      (ev.at >= start && ev.at <= end)
    ) {
      involved.add(ev.player);
      if (ev.recipient) involved.add(ev.recipient);
    }
  }
  const runners = s.players
    .filter((p) => p.team === e.team && p.number !== 1 && !involved.has(p.id))
    .map((p) => ({ p, a: interpolate(s.tracks[p.id], start), b: interpolate(s.tracks[p.id], end) }))
    .sort((a, b) => distance(b.a, b.b) - distance(a.a, a.b));
  const runEnd = s.id === 'quick-break' ? end - 0.15 : end;
  const featured = s.players.find((p) => p.id === e.recipient)!;
  const runner =
    s.id === 'quick-break'
      ? {
          p: featured,
          a: interpolate(s.tracks[featured.id], start),
          b: interpolate(s.tracks[featured.id], runEnd),
        }
      : runners[0];
  const before = inspectSpace(s, e, start).receiver.receiverDistance;
  const after = inspectSpace(s, e, end).receiver.receiverDistance;
  const delta = after - before;
  const shot = s.events.find((e) => e.type === 'shot')!;
  const finish = s.events.find((e) => e.type === 'goal' || e.type === 'save')!;
  return [
    passStep(passes[0], 'The first connection'),
    {
      id: `${e.id}-run`,
      kind: 'run',
      title: `${name(runner.p.id)} moves off the ball`,
      event: e,
      start,
      end: runEnd,
      anchor: runner.b,
      player: runner.p.id,
      metric: `${distance(runner.a, runner.b).toFixed(1)} m displacement`,
      detail:
        'The cyan trace follows a supporting player without possession. The hollow marker shows the starting position.',
    },
    {
      id: `${e.id}-space`,
      kind: 'space',
      title:
        delta > 0.05
          ? 'Space opens at the receiving point'
          : delta < -0.05
            ? 'The receiving gap closes'
            : 'The receiving gap holds',
      event: e,
      start,
      end,
      anchor: e.to,
      before,
      after,
      metric: `${before.toFixed(1)} → ${after.toFixed(1)} m`,
      detail:
        'Nearest-opponent distance to the same receiving point. Dashed white is the earlier gap; gold is the current gap. This comparison does not establish causation.',
    },
    passStep(passes[passes.length - 1], 'The final connection'),
    {
      id: finish.id,
      kind: 'finish',
      title: finish.type === 'goal' ? 'The finish' : 'The goalkeeper intervenes',
      event: shot,
      start: Math.max(0, shot.at - 0.7),
      end: Math.min(s.duration, finish.at + 0.7),
      anchor: shot.to,
      metric: finish.type === 'goal' ? 'Goal' : 'Saved',
      detail: `${name(shot.player)} shoots. The replay follows the recorded ${finish.type === 'goal' ? 'goal' : 'save'} outcome; it does not estimate scoring probability.`,
    },
  ];
}
