import { buildupFacts } from './buildup';
import { distance, evidenceFor, matchState, visibleEvents, type Scenario } from '../src/core/model';
import { inspectSpace } from '../src/core/spatial';
import { ContractError, type AnalysisRequest, type EvidencePacket, type Fact } from './contracts';

/** Request-scoped, immutable-by-copy tools. Never expose the full scenario to an adapter. */
export function createEvidenceTools(scenario: Scenario, request: AnalysisRequest) {
  if (scenario.id !== request.scenarioId || request.through > scenario.duration)
    throw new ContractError('Unknown scenario or timestamp outside sequence');
  const events = visibleEvents(scenario.events, request.through, request.receivedThrough).filter(
    (e) => e.outcome !== 'voided',
  );
  const facts: Fact[] = [];
  for (const event of events) {
    const base = {
      eventId: event.id,
      version: event.version,
      at: event.at,
      playerId: event.player,
      target: { ...event.to },
    };
    const key = `${event.id}@${event.version}`;
    facts.push({
      ...base,
      id: `${key}:event`,
      kind: 'event',
      text:
        event.outcome === 'failed'
          ? request.language === 'en'
            ? 'This action is recorded as unsuccessful.'
            : 'Esta acción está registrada como fallida.'
          : evidenceFor(scenario, event, request.audience, request.language),
      method: 'Recorded synthetic event; not causal evidence.',
    });
    if (event.type !== 'pass' || event.outcome !== 'success') continue;
    const value = Math.round(distance(event.from, event.to) * 10) / 10;
    facts.push({
      ...base,
      id: `${key}:distance`,
      kind: 'pass-distance',
      value,
      unit: 'm',
      text:
        request.language === 'en'
          ? `The pass travelled ${value} m.`
          : `El pase recorrió ${value} m.`,
      method: 'Euclidean distance between event endpoints.',
    });
    // Only use frames already inside the requested snapshot, with coverage at the measurement time.
    const tracks = Object.fromEntries(
      Object.entries(scenario.tracks).map(([id, frames]) => [
        id,
        frames.filter((f) => f.at <= request.through),
      ]),
    );
    const opponents = scenario.players.filter((p) => p.team !== event.team);
    if (
      !opponents.length ||
      opponents.some(
        (p) =>
          !tracks[p.id]?.length ||
          tracks[p.id][0].at > event.at ||
          tracks[p.id].at(-1)!.at < event.at,
      )
    )
      continue;
    const space = inspectSpace({ ...scenario, tracks }, event, event.at);
    const clearance = Math.round(space.receiver.receiverDistance * 10) / 10;
    facts.push({
      ...base,
      id: `${key}:space`,
      kind: 'receiver-space',
      value: clearance,
      unit: 'm',
      text:
        request.language === 'en'
          ? `At reception, the nearest opponent was ${clearance} m from the receiving point.`
          : `En la recepción, el rival más cercano estaba a ${clearance} m del punto de recepción.`,
      method:
        'Nearest opponent distance at reception from synthetic tracking; not pressure, pass difficulty or causation.',
    });
  }
  facts.push(...buildupFacts(scenario, events, request));
  const state = matchState(scenario.events, request.through, request.receivedThrough);
  const packet: EvidencePacket = {
    schemaVersion: '1.0',
    source: 'synthetic',
    request: { ...request },
    score: { home: state.home, away: state.away },
    facts,
    limitations: [
      'Authored synthetic sequence, not live football.',
      'Spatial measurements are retrospective and do not establish why a goal happened.',
      'Tracking is preloaded synthetic data; independent tracking arrival timestamps are not modeled.',
    ],
  };
  return {
    snapshot: () => structuredClone(packet),
    listEvents: (start: number, end: number) => {
      if (
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        start < 0 ||
        end < start ||
        end > request.through ||
        end - start > 30
      )
        throw new ContractError('Event window must be bounded to 30 seconds within snapshot');
      return structuredClone(events.filter((e) => e.at >= start && e.at <= end));
    },
    getFact: (id: string) => {
      const fact = facts.find((f) => f.id === id);
      if (!fact) throw new ContractError('Evidence unavailable in this snapshot');
      return structuredClone(fact);
    },
  };
}
export type EvidenceTools = ReturnType<typeof createEvidenceTools>;
