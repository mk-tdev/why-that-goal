import { distance, interpolate, type Point, type Scenario, type MatchEvent } from './model';

/** Closest point on a finite segment, including zero-length events. */
export function projectToSegment(p: Point, a: Point, b: Point): Point {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared
    ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared))
    : 0;
  return { x: a.x + t * dx, y: a.y + t * dy };
}
export function inspectSpace(scenario: Scenario, event: MatchEvent, at: number) {
  const opponents = scenario.players
    .filter((p) => p.team !== event.team)
    .map((player) => {
      const point = interpolate(scenario.tracks[player.id], at);
      const projection = projectToSegment(point, event.from, event.to);
      return {
        player,
        point,
        projection,
        laneDistance: distance(point, projection),
        receiverDistance: distance(point, event.to),
      };
    });
  return {
    lane: [...opponents].sort((a, b) => a.laneDistance - b.laneDistance)[0],
    receiver: [...opponents].sort((a, b) => a.receiverDistance - b.receiverDistance)[0],
    length: distance(event.from, event.to),
    progress: event.to.x - event.from.x,
    at,
  };
}
