import { scenarios } from '../src/core/scenarios';
import {
  ContractError,
  parseRequest,
  validateSelection,
  type AnalysisResponse,
  type EvidencePacket,
} from './contracts';
import { createEvidenceTools, type EvidenceTools } from './evidence';

/** Future Foundry adapter boundary. No SDK, credentials or network provider is installed. */
export interface IntelligenceAdapter {
  name: string;
  select(input: {
    evidence: EvidencePacket;
    tools: EvidenceTools;
    signal: AbortSignal;
  }): Promise<unknown>;
}
export async function analyze(
  input: unknown,
  adapter?: IntelligenceAdapter,
  timeoutMs = 5000,
): Promise<AnalysisResponse> {
  const started = performance.now();
  const request = parseRequest(input);
  const scenario = scenarios.find((s) => s.id === request.scenarioId);
  if (!scenario) throw new ContractError('Unknown scenario');
  const tools = createEvidenceTools(scenario, request);
  const packet = tools.snapshot();
  let selection = {
    factIds: packet.facts
      .filter((f) => f.kind === 'event')
      .slice(-6)
      .map((f) => f.id),
  };
  let reason: AnalysisResponse['reason'] = 'disconnected';
  let mode: AnalysisResponse['mode'] = 'deterministic';
  if (adapter) {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const output = await Promise.race([
        Promise.resolve().then(() =>
          adapter.select({ evidence: tools.snapshot(), tools, signal: controller.signal }),
        ),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error('timeout'));
          }, timeoutMs);
        }),
      ]);
      try {
        selection = validateSelection(output, packet);
        reason = 'validated';
        mode = 'model-selected';
      } catch {
        reason = 'invalid-output';
        mode = 'fallback';
      }
    } catch {
      reason = controller.signal.aborted ? 'timeout' : 'provider-error';
      mode = 'fallback';
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  }
  return {
    schemaVersion: '1.0',
    mode,
    provider: adapter?.name ?? 'none',
    reason,
    evidence: packet,
    moments: selection.factIds.map((id) => {
      const fact = tools.getFact(id);
      return { ...fact, replayAt: fact.at };
    }),
    trace: {
      elapsedMs: Math.round(performance.now() - started),
      calls: adapter ? 1 : 0,
      validated: reason === 'validated',
    },
  };
}
