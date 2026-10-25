import type { WorkflowTrace } from './agentContracts';
import type { Audience, Language, Point } from '../src/core/model';

export type AnalysisRequest = {
  scenarioId: string;
  through: number;
  receivedThrough: number;
  audience: Audience;
  language: Language;
};
export type Fact = {
  id: string;
  eventId: string;
  version: number;
  at: number;
  playerId: string;
  kind:
    | 'event'
    | 'pass-distance'
    | 'receiver-space'
    | 'pass-progress'
    | 'off-ball-run'
    | 'space-change';
  fromTime?: number;
  toTime?: number;
  before?: number;
  after?: number;
  value?: number;
  unit?: 'm';
  target: Point;
  text: string;
  method: string;
};
export type EvidencePacket = {
  schemaVersion: '1.0';
  source: 'synthetic';
  request: AnalysisRequest;
  score: { home: number; away: number };
  facts: Fact[];
  limitations: string[];
};
/** Models select facts; trusted code supplies prose, measurements and replay coordinates. */
export type Selection = { factIds: string[] };
export type SequenceRecap = {
  outcome: 'goal' | 'save' | 'failed-attack';
  title: string;
  summary: string;
  through: number;
  terminalFactId: string;
  cards: { title: string; text: string; factIds: string[] }[];
  limitation: string;
};
export type AnalysisResponse = {
  recap: SequenceRecap | null;
  schemaVersion: '1.0';
  mode: 'deterministic' | 'model-selected' | 'fallback';
  provider: string;
  reason:
    | 'generating'
    | 'disconnected'
    | 'validated'
    | 'invalid-output'
    | 'provider-error'
    | 'timeout';
  evidence: EvidencePacket;
  buildup: { title: string; summary: string; limitation: string; factIds: string[] };
  moments: (Fact & { replayAt: number })[];
  trace: {
    elapsedMs: number;
    calls: number;
    validated: boolean;
    cacheHit?: boolean;
    pending?: boolean;
    workflow?: WorkflowTrace;
    inputTokens?: number;
    outputTokens?: number;
  };
};
export class ContractError extends Error {}
export class ProviderFailure extends Error {
  workflow?: WorkflowTrace;
  inputTokens?: number;
  outputTokens?: number;
  constructor(
    public reason: 'provider-error' | 'timeout' | 'invalid-output',
    public calls: number,
  ) {
    super(reason);
  }
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ContractError('Expected object');
  return value as Record<string, unknown>;
}
export function exactKeys(value: Record<string, unknown>, keys: string[]) {
  if (Object.keys(value).some((k) => !keys.includes(k)) || keys.some((k) => !(k in value)))
    throw new ContractError('Unexpected or missing fields');
}
export function parseRequest(value: unknown): AnalysisRequest {
  const v = object(value);
  exactKeys(v, ['scenarioId', 'through', 'receivedThrough', 'audience', 'language']);
  if (typeof v.scenarioId !== 'string' || !/^[a-z0-9-]{1,64}$/.test(v.scenarioId))
    throw new ContractError('Invalid scenarioId');
  for (const key of ['through', 'receivedThrough']) {
    if (typeof v[key] !== 'number' || !Number.isFinite(v[key]) || v[key] < 0 || v[key] > 7200)
      throw new ContractError('Invalid timestamp');
  }
  if (
    !['fan', 'analyst'].includes(v.audience as string) ||
    !['en', 'es'].includes(v.language as string)
  )
    throw new ContractError('Unsupported audience or language');
  return v as AnalysisRequest;
}
export function validateSelection(value: unknown, packet: EvidencePacket): Selection {
  const v = object(value);
  exactKeys(v, ['factIds']);
  if (
    !Array.isArray(v.factIds) ||
    v.factIds.length > 6 ||
    (packet.facts.length > 0 && !v.factIds.length)
  )
    throw new ContractError('Select between one and six facts when evidence exists');
  const allowed = new Set(packet.facts.map((f) => f.id));
  if (
    v.factIds.some((id) => typeof id !== 'string' || !allowed.has(id)) ||
    new Set(v.factIds).size !== v.factIds.length
  )
    throw new ContractError('Unknown, stale or duplicate evidence');
  return { factIds: v.factIds as string[] };
}
