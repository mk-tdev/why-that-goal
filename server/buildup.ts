import { distance, interpolate, type Scenario, type MatchEvent } from '../src/core/model';
import { inspectSpace } from '../src/core/spatial';
import type { AnalysisRequest, Fact } from './contracts';

/** Observed relationships, not counterfactual proof of tactical causation. */
export function buildupFacts(s: Scenario, events: MatchEvent[], request: AnalysisRequest): Fact[] {
  const en = request.language === 'en';
  const facts: Fact[] = [];
  const tracks = Object.fromEntries(
    Object.entries(s.tracks).map(([id, frames]) => [
      id,
      frames.filter((f) => f.at <= request.through),
    ]),
  );
  const covered = (id: string, a: number, b: number) =>
    !!tracks[id]?.length && tracks[id][0].at <= a && tracks[id].at(-1)!.at >= b;
  const name = (id: string) => s.players.find((p) => p.id === id)?.name ?? id;
  const round = (n: number) => Math.round(n * 10) / 10;
  for (const e of events) {
    if (e.type !== 'pass' || e.outcome !== 'success') continue;
    const previous = events.filter((p) => p.at < e.at).at(-1);
    const start = Math.max(previous?.at ?? 0, e.at - 2);
    const end = Math.max(start, e.at - 0.1);
    const base = {
      eventId: e.id,
      version: e.version,
      at: e.at,
      playerId: e.player,
      target: e.to,
      fromTime: start,
      toTime: e.at,
    };
    const key = `${e.id}@${e.version}`;
    const gain = round((e.to.x - e.from.x) * (e.team === 'home' ? 1 : -1));
    facts.push({
      ...base,
      id: `${key}:progress`,
      kind: 'pass-progress',
      value: gain,
      unit: 'm',
      text: en
        ? `${name(e.player)} found ${name(e.recipient ?? e.player)}, moving the ball ${Math.abs(gain)} m ${gain >= 0 ? 'toward' : 'away from'} goal. This changed where the next action could begin.`
        : `${name(e.player)} encontró a ${name(e.recipient ?? e.player)} y desplazó el balón ${Math.abs(gain)} m ${gain >= 0 ? 'hacia' : 'lejos de'} la portería, cambiando el punto de inicio de la siguiente acción.`,
      method:
        'Signed endpoint progress along the team attacking axis; not a line-break classification.',
    });
    const runner = e.recipient;
    // The receiver must not be the previous ball carrier or act on the ball inside the interval.
    const priorCarrier = previous?.type === 'pass' ? previous.recipient : previous?.player;
    if (
      runner &&
      runner !== priorCarrier &&
      runner !== e.player &&
      end > start &&
      covered(runner, start, end) &&
      !events.some(
        (p) => p.at > start && p.at <= end && (p.player === runner || p.recipient === runner),
      )
    ) {
      const a = interpolate(tracks[runner], start),
        b = interpolate(tracks[runner], end);
      const metres = round(distance(a, b));
      if (metres >= 1)
        facts.push({
          ...base,
          playerId: runner,
          target: b,
          toTime: end,
          id: `${key}:run`,
          kind: 'off-ball-run',
          value: metres,
          unit: 'm',
          text: en
            ? `${name(runner)} moved ${metres} m before receiving, offering a new passing destination ahead of the pass from ${name(e.player)}.`
            : `${name(runner)} se desplazó ${metres} m antes de recibir, ofreciendo un nuevo destino para el pase de ${name(e.player)}.`,
          method:
            'Receiver endpoint displacement before reception, excluding recorded possession/actions; not distance travelled or proof a defender was drawn away.',
        });
    }
    const opponents = s.players.filter((p) => p.team !== e.team);
    if (!opponents.length || opponents.some((p) => !covered(p.id, start, e.at))) continue;
    const before = inspectSpace({ ...s, tracks }, e, start).receiver.receiverDistance;
    const after = inspectSpace({ ...s, tracks }, e, e.at).receiver.receiverDistance;
    const delta = round(after - before);
    const direction =
      delta > 0.1
        ? en
          ? 'opened'
          : 'aumentó'
        : delta < -0.1
          ? en
            ? 'closed'
            : 'disminuyó'
          : en
            ? 'held roughly steady'
            : 'se mantuvo estable';
    facts.push({
      ...base,
      id: `${key}:space-change`,
      kind: 'space-change',
      value: delta,
      before: round(before),
      after: round(after),
      unit: 'm',
      text: en
        ? `Space at the receiving point ${direction}: the nearest opponent was ${round(before)} m away, then ${round(after)} m at reception. ${delta > 0.1 ? 'The pass arrived with more separation from the nearest defender.' : 'The gap at that fixed point did not grow during this interval.'}`
        : `El espacio en el punto de recepción ${direction}: el rival más cercano estaba a ${round(before)} m y después a ${round(after)} m al recibir.`,
      method:
        'Nearest-opponent distance to one fixed receiving point at two timestamps. The nearest opponent may change; this does not establish that the run caused the gap.',
    });
  }
  return facts;
}
