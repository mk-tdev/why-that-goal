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
  const goal = packet.facts.find(
    (f) =>
      f.kind === 'event' && scenario.events.some((e) => e.id === f.eventId && e.type === 'goal'),
  );
  const save = packet.facts.find(
    (f) =>
      f.kind === 'event' && scenario.events.some((e) => e.id === f.eventId && e.type === 'save'),
  );
  const failed = packet.facts.find(
    (f) =>
      f.kind === 'event' &&
      scenario.events.some((e) => e.id === f.eventId && e.outcome === 'failed'),
  );
  const en = request.language === 'en';
  const chain = packet.facts.filter((f) =>
    ['pass-progress', 'off-ball-run', 'space-change'].includes(f.kind),
  );
  const progresses = chain.filter((f) => f.kind === 'pass-progress');
  const run = chain
    .filter((f) => f.kind === 'off-ball-run')
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
  const gap = chain
    .filter((f) => f.kind === 'space-change')
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
  const featured = [
    ...new Map(
      [progresses[0], run, gap, progresses.at(-1)]
        .filter((f): f is NonNullable<typeof f> => !!f)
        .map((f) => [f.id, f]),
    ).values(),
  ].sort((a, b) => a.at - b.at);
  return {
    buildup: {
      title: failed
        ? en
          ? 'Where the attack broke down'
          : 'Dónde se perdió el ataque'
        : en
          ? goal
            ? 'How the goal was built'
            : save
              ? 'How the chance was built'
              : 'The buildup so far'
          : goal
            ? 'Cómo se construyó el gol'
            : 'La construcción de la jugada',
      summary: failed
        ? en
          ? 'The attempted pass was intercepted. Earlier passes progressed the ball, but the attack lost possession before producing a shot.'
          : 'El pase fue interceptado. El ataque perdió la posesión antes de rematar.'
        : en
          ? goal
            ? 'The completed passes moved the attack into a shooting position. Receiver movement and the changing gaps below show how the ball reached the finish; the goal is the recorded outcome.'
            : save
              ? 'The buildup produced a shot, but the goalkeeper saved it. The same passing and movement patterns do not guarantee a goal.'
              : 'Follow the completed connections and the movement around them. The outcome is not yet available at this replay time.'
          : goal
            ? 'Los pases completados llevaron el ataque a una posición de remate. Los movimientos y espacios muestran cómo llegó el balón; el gol es el resultado registrado.'
            : save
              ? 'La jugada produjo un remate, pero el portero lo detuvo. Estos patrones no garantizan un gol.'
              : 'Sigue los pases completados y los movimientos. El resultado aún no está disponible.',
      limitation: en
        ? 'Rule-based explanation of synthetic tracking. These observations support a buildup interpretation, not proof that a run or gap caused the outcome.'
        : 'Explicación por reglas con datos sintéticos. Las observaciones no prueban que un movimiento o espacio causara el resultado.',
      factIds: [
        ...(request.audience === 'analyst' ? chain : featured),
        ...(failed ? [failed] : []),
      ].map((f) => f.id),
    },
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
