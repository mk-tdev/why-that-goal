import {
  distance,
  interpolate,
  type Point,
  type Scenario,
  type MatchEvent,
  type Keyframe,
} from './model';

export type BallFlight = {
  start: number;
  end: number;
  from: Point;
  to: Point;
  kind: 'pass' | 'shot';
  owner: string;
  receiver?: string;
  loft: number;
};
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const mix = (a: Point, b: Point, u: number) => ({
  x: a.x + (b.x - a.x) * u,
  y: a.y + (b.y - a.y) * u,
});
const ease = (u: number) => u * u * u * (10 + u * (-15 + 6 * u));
export function flightFor(event: MatchEvent, events: MatchEvent[]): BallFlight | null {
  if (event.type === 'pass') {
    const d = distance(event.from, event.to),
      lofted = d > 35;
    // Ground passes decelerate at 1.2 m/s². Long switches use a ballistic arc.
    const duration = lofted ? d / 22 : (20 - Math.sqrt(400 - 2 * 1.2 * d)) / 1.2;
    return {
      start: event.at - duration,
      end: event.at,
      from: event.from,
      to: event.to,
      kind: 'pass',
      owner: event.player,
      receiver: event.recipient,
      loft: lofted ? (9.81 * duration * duration) / 8 : 0,
    };
  }
  if (event.type === 'shot') {
    const finish = events.find((e) => (e.type === 'goal' || e.type === 'save') && e.at > event.at)!;
    return {
      start: event.at,
      end: finish.at,
      from: event.from,
      to: finish.from,
      kind: 'shot',
      owner: event.player,
      loft: (9.81 * (finish.at - event.at) ** 2) / 8,
    };
  }
  return null;
}

/** Bake smooth bounded trajectories once. Replays are deterministic at any time. */
export function buildMotion(s: Scenario, formation: Point[]) {
  // Receiving players take a settling touch and carry before releasing the next ball.
  let passNumber = 0;
  for (const event of s.events)
    if (event.type === 'pass') {
      if (passNumber++ > 0)
        event.from = { x: event.from.x + 2.2, y: event.from.y + (event.from.y > 34 ? -0.8 : 0.8) };
    }
  const shot = s.events.find((e) => e.type === 'shot')!,
    finish = s.events.find((e) => e.type === 'goal' || e.type === 'save')!;
  shot.from = { x: shot.from.x + 1.4, y: shot.from.y + 0.35 };
  // Record the shot at boot contact, and its outcome at arrival, at 24 m/s horizontally.
  if (finish.type === 'goal') {
    finish.from = { x: 105, y: s.id === 'quick-break' ? 31.8 : 36.1 };
    finish.to = { ...finish.from };
  } else {
    finish.from = { x: 100, y: 34.8 };
    finish.to = { ...finish.from };
  }
  shot.to = { ...finish.from };
  shot.at = finish.at - distance(shot.from, shot.to) / 24;
  shot.receivedAt = shot.at;
  const flights = s.events.map((e) => flightFor(e, s.events)).filter((f): f is BallFlight => !!f);
  const defensive: Point[] = [
    { x: 100, y: 34 },
    { x: 83, y: 13 },
    { x: 85, y: 27 },
    { x: 87, y: 40 },
    { x: 82, y: 55 },
    { x: 69, y: 26 },
    { x: 70, y: 45 },
    { x: 59, y: 16 },
    { x: 49, y: 34 },
    { x: 60, y: 51 },
    { x: 61, y: 34 },
  ];
  const tracks: Record<string, Keyframe[]> = {};
  for (const p of s.players) {
    let anchors: Keyframe[] = [];
    for (const e of s.events) {
      const f = flightFor(e, s.events);
      if (e.type === 'recovery' && e.player === p.id) anchors.push({ at: e.at, point: e.from });
      if (f?.owner === p.id) anchors.push({ at: f.start, point: f.from });
      if (f?.receiver === p.id) anchors.push({ at: f.end, point: f.to });
    }
    if (p.id === 'A-1') {
      anchors = [
        { at: 0, point: { x: 100, y: 34 } },
        { at: shot.at - 0.35, point: { x: 100.5, y: 34 } },
        {
          at: finish.at,
          point: finish.type === 'save' ? finish.from : { x: 102, y: finish.from.y + 0.5 },
        },
        {
          at: s.duration,
          point: finish.type === 'save' ? finish.from : { x: 102, y: finish.from.y + 0.5 },
        },
      ];
    } else if (anchors.length) {
      anchors.sort((a, b) => a.at - b.at);
      const first = anchors[0],
        last = anchors.at(-1)!;
      const runway = Math.min(6, first.at * 1.5);
      anchors.unshift({
        at: 0,
        point: {
          x: first.point.x - runway,
          y: first.point.y + (p.number % 2 ? 1 : -1) * Math.min(2, first.at * 0.4),
        },
      });
      // In the featured counterattack, the winger and striker time their runs late
      // rather than drifting toward reception throughout the entire buildup.
      if (s.id === 'quick-break' && (p.id === 'N-7' || p.id === 'N-9')) {
        anchors.splice(1, 0, { at: Math.max(0.1, first.at - 2.8), point: { ...anchors[0].point } });
      }
      // Support after the action, never return to the kickoff formation.
      anchors.push({
        at: s.duration,
        point: {
          x: Math.min(100, last.point.x + Math.min(9, (s.duration - last.at) * 1.5)),
          y: clamp(last.point.y + (34 - last.point.y) * 0.1, 2, 66),
        },
      });
    } else {
      const base = p.team === 'home' ? formation[p.number - 1] : defensive[p.number - 1];
      const shift = p.team === 'home' ? Math.min(14, Math.max(4, shot.from.x - 65)) : 9;
      const start = { ...base };
      const end = {
        x: clamp(base.x + (p.number === 1 ? 2 : shift), 2, 101),
        y: clamp(base.y + (shot.from.y - base.y) * 0.15, 3, 65),
      };
      anchors = [
        { at: 0, point: start },
        { at: Math.max(5, shot.at), point: end },
        { at: s.duration, point: end },
      ];
    }
    const unique = [...new Map(anchors.map((f) => [f.at, f])).values()].sort((a, b) => a.at - b.at);
    // Fail loudly if an authored route is not feasible under the 8.5 m/s design bound.
    for (let i = 1; i < unique.length; i++) {
      const a = unique[i - 1],
        b = unique[i];
      if ((1.875 * distance(a.point, b.point)) / (b.at - a.at) > 8.5)
        throw new Error(`Infeasible run: ${s.id}/${p.id}`);
    }
    tracks[p.id] = [];
    for (let n = 0; n <= Math.ceil(s.duration * 30); n++) {
      const at = Math.min(n / 30, s.duration);
      let i = unique.findIndex((f) => f.at >= at);
      if (i < 0) i = unique.length - 1;
      const a = unique[Math.max(0, i - 1)],
        b = unique[i];
      const u = b.at === a.at ? 0 : ease(clamp((at - a.at) / (b.at - a.at), 0, 1));
      tracks[p.id].push({ at, point: mix(a.point, b.point, u) });
    }
  }
  s.tracks = tracks;
  s.ball = Array.from({ length: Math.ceil(s.duration * 60) + 1 }, (_, i) => {
    const at = Math.min(i / 60, s.duration);
    return { at, point: ballMotion(s, at, flights).point };
  });
  return s;
}

export function ballMotion(s: Scenario, time: number, prepared?: BallFlight[]) {
  const t = clamp(time, 0, s.duration),
    flights =
      prepared ?? s.events.map((e) => flightFor(e, s.events)).filter((f): f is BallFlight => !!f);
  let owner = s.events[0].player;
  let lastPoint = s.events[0].from;
  const finish = s.events.find((e) => e.type === 'goal' || e.type === 'save')!;
  for (const f of flights) {
    if (t < f.start) break;
    if (t <= f.end) {
      const u = clamp((t - f.start) / (f.end - f.start), 0, 1),
        d = distance(f.from, f.to);
      const progress =
        f.kind === 'pass' && !f.loft ? (20 * (t - f.start) - 0.6 * (t - f.start) ** 2) / d : u;
      const point = mix(f.from, f.to, clamp(progress, 0, 1));
      return {
        point,
        height: 0.11 + 4 * f.loft * u * (1 - u) + (f.kind === 'shot' ? 0.65 * u : 0),
        phase: f.kind,
        owner: null,
        spin: (progress * d) / 0.11,
        flight: f,
      };
    }
    owner = f.receiver ?? f.owner;
    lastPoint = f.to;
  }
  if (t >= finish.at) {
    const dt = t - finish.at;
    if (finish.type === 'goal') {
      const x = dt < 0.18 ? 105 + dt * 9 : 106.62 - 0.8 * (1 - Math.exp(-(dt - 0.18) * 3));
      return {
        point: { x, y: finish.from.y },
        height: 0.11 + 0.65 * Math.exp(-dt * 3) * Math.abs(Math.cos(dt * 10)),
        phase: 'net',
        owner: null,
        spin: dt * 12,
        flight: null,
      };
    }
    const u = Math.min(1, dt / 1.1);
    return {
      point: mix(finish.from, { x: finish.from.x - 3.2, y: finish.from.y + 2 }, 1 - (1 - u) ** 2),
      height: 0.11 + 0.65 * (1 - u) * Math.abs(Math.cos(u * 9)),
      phase: 'parry',
      owner: null,
      spin: dt * 12,
      flight: null,
    };
  }
  // During possession the ball stays on the next kicking path, with small touches.
  const next = flights.find((f) => f.start > t);
  const pos = interpolate(s.tracks[owner], t);
  const target = next?.from ?? lastPoint;
  const v = { x: target.x - pos.x, y: target.y - pos.y };
  const len = Math.hypot(v.x, v.y);
  const before = interpolate(s.tracks[owner], Math.max(0, t - 0.08));
  const speed = distance(before, pos) / Math.max(0.001, Math.min(0.08, t));
  const movement = ease(clamp(speed / 0.8, 0, 1));
  const previousFlight = flights.filter((f) => f.end < t).at(-1);
  const received = previousFlight ? ease(clamp((t - previousFlight.end) / 0.28, 0, 1)) : 1;
  const remaining = next ? Math.min(1, (next.start - t) / 0.3) : 1;
  const offset =
    (0.23 + 0.16 * (0.5 + 0.5 * Math.sin(t * 9))) *
    movement *
    remaining *
    received *
    ease(clamp(len / 0.4, 0, 1));
  return {
    point: {
      x: pos.x + (len > 0.01 ? v.x / len : 1) * offset,
      y: pos.y + (len > 0.01 ? v.y / len : 0) * offset,
    },
    height: 0.11 + 0.015 * movement * remaining * received * Math.abs(Math.sin(t * 9)),
    phase: 'carry',
    owner,
    spin: t * 8,
    flight: null,
  };
}

export function playerMotion(s: Scenario, id: string, t: number) {
  const frames = s.tracks[id],
    point = interpolate(frames, t);
  const a = interpolate(frames, Math.max(0, t - 0.06)),
    b = interpolate(frames, Math.min(s.duration, t + 0.06));
  const speed =
    distance(a, b) / Math.max(0.001, Math.min(s.duration, t + 0.06) - Math.max(0, t - 0.06));
  let travel = 0;
  for (let i = 1; i < frames.length && frames[i - 1].at < t; i++)
    travel += distance(frames[i - 1].point, frames[i].at > t ? point : frames[i].point);
  const ball = ballMotion(s, t);
  const upcoming = s.events
    .map((e) => flightFor(e, s.events))
    .find((f) => f && f.owner === id && f.start >= t);
  const look = ball.owner === id && upcoming ? upcoming.to : ball.point;
  const moveLength = Math.max(0.0001, distance(a, b)),
    lookLength = Math.max(0.0001, distance(point, look));
  const weight = ease(clamp(speed / 1.2, 0, 1));
  const heading = Math.atan2(
    ((b.x - a.x) / moveLength) * weight + ((look.x - point.x) / lookLength) * (1 - weight),
    ((b.y - a.y) / moveLength) * weight + ((look.y - point.y) / lookLength) * (1 - weight),
  );
  const kick = s.events
    .map((e) => flightFor(e, s.events))
    .filter((f): f is BallFlight => !!f && f.owner === id)
    .reduce((v, f) => Math.max(v, Math.max(0, 1 - Math.abs(t - f.start) / 0.22)), 0);
  const finish = s.events.find((e) => e.type === 'goal' || e.type === 'save')!;
  const dive =
    id === 'A-1' ? Math.sin((clamp((t - (finish.at - 0.35)) / 0.7, 0, 1) * Math.PI) / 2) : 0;
  const contacts = s.events.map((e) => flightFor(e, s.events)).filter((f): f is BallFlight => !!f);
  const strike = contacts.find((f) => f.owner === id && t >= f.start - 0.32 && t <= f.start + 0.4);
  const strikeTime = strike ? t - strike.start : 0;
  const swing = strike
    ? strikeTime < 0
      ? Math.sin(((strikeTime + 0.32) / 0.32) * Math.PI) * 0.45
      : -Math.sin(Math.min(1, strikeTime / 0.4) * Math.PI) * 0.85
    : 0;
  const receive = contacts
    .filter((f) => f.receiver === id)
    .reduce((v, f) => Math.max(v, Math.max(0, 1 - Math.abs(t - f.end) / 0.3)), 0);
  return { point, speed, heading, travel, kick, dive, swing, receive };
}

/** Two-link leg solve: ground-contact phase followed by a lifted recovery step. */
export function footPose(travel: number, speed: number, side: number) {
  const active = ease(clamp(speed / 0.8, 0, 1));
  const phase = (((travel / 1.8 + side * 0.5) % 1) + 1) % 1;
  const stance = phase < 0.45;
  const u = stance ? phase / 0.45 : (phase - 0.45) / 0.55;
  const z = (stance ? 0.405 - 0.81 * u : -0.405 + 0.81 * ease(u)) * active;
  const lift = stance ? 0 : Math.sin(Math.PI * u) * 0.16 * active;
  const drop = 0.8 - 0.12 * active - lift;
  const reach = Math.min(0.8, Math.hypot(z, drop));
  const knee = 2 * Math.acos(reach / 0.8);
  const hip = -Math.atan2(z, drop) - knee / 2;
  return { hip, knee, lift, settle: -0.12 * active };
}
