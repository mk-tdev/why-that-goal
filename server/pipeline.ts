import type { Scenario } from '../src/core/model';
import type { WorkflowTrace } from './agentContracts';
import { createRecap } from './recap';
import { validateNarrative, type Narrative } from './narrative';
import { scenarios } from '../src/core/scenarios';
import {
  ContractError,
  ProviderFailure,
  parseRequest,
  validateSelection,
  type AnalysisResponse,
  type EvidencePacket,
} from './contracts';
import { createEvidenceTools, type EvidenceTools } from './evidence';

/** Provider boundary: model prose and evidence selection are validated before rendering. */
export interface IntelligenceAdapter {
  name: string;
  timeoutMs?: number;
  select(input: {
    evidence: EvidencePacket;
    tools: EvidenceTools;
    signal: AbortSignal;
    recap?: AnalysisResponse['recap'];
    onProgress?: (trace: WorkflowTrace) => void;
  }): Promise<unknown>;
}
export async function analyze(
  input: unknown,
  adapter?: IntelligenceAdapter,
  timeoutMs = adapter?.timeoutMs ?? 5000,
  onProgress?: (trace: WorkflowTrace) => void,
  evaluationScenario?: Scenario,
): Promise<AnalysisResponse> {
  const started = performance.now();
  const request = parseRequest(input);
  const scenario = evaluationScenario ?? scenarios.find((s) => s.id === request.scenarioId);
  if (!scenario) throw new ContractError('Unknown scenario');
  const tools = createEvidenceTools(scenario, request);
  const packet = tools.snapshot();
  const terminalRecap = createRecap(scenario, packet);
  let narrative: Narrative | undefined;
  let latestWorkflow: WorkflowTrace | undefined;
  let telemetry: Partial<AnalysisResponse['trace']> = {};
  let selection = {
    factIds: packet.facts
      .filter((f) => f.kind === 'event')
      .slice(-6)
      .map((f) => f.id),
  };
  let reason: AnalysisResponse['reason'] = 'disconnected';
  let mode: AnalysisResponse['mode'] = 'deterministic';
  if (adapter && packet.facts.length) {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const output = await Promise.race([
        Promise.resolve().then(() =>
          adapter.select({
            evidence: tools.snapshot(),
            tools,
            signal: controller.signal,
            recap: terminalRecap,
            onProgress: (trace) => {
              latestWorkflow = trace;
              onProgress?.(trace);
            },
          }),
        ),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error('timeout'));
          }, timeoutMs);
        }),
      ]);
      try {
        if (output && typeof output === 'object' && 'story' in output) {
          const { telemetry: metrics, ...draft } = output as Record<string, unknown>;
          const validated = validateNarrative(draft, packet, terminalRecap);
          selection = { factIds: validated.factIds };
          narrative = validated;
          if (metrics && typeof metrics === 'object') {
            const m = metrics as Record<string, unknown>;
            telemetry = {
              calls:
                typeof m.calls === 'number' &&
                Number.isInteger(m.calls) &&
                m.calls >= 0 &&
                m.calls <= 6
                  ? m.calls
                  : 1,
              ...(m.workflow ? { workflow: m.workflow as WorkflowTrace } : {}),
              cacheHit: m.cacheHit === true,
              ...(typeof m.inputTokens === 'number' ? { inputTokens: m.inputTokens } : {}),
              ...(typeof m.outputTokens === 'number' ? { outputTokens: m.outputTokens } : {}),
            };
          }
        } else selection = validateSelection(output, packet);
        reason = 'validated';
        mode = 'model-selected';
      } catch {
        reason = 'invalid-output';
        mode = 'fallback';
      }
    } catch (error) {
      if (error instanceof ProviderFailure) {
        telemetry = {
          calls: error.calls,
          workflow: error.workflow,
          inputTokens: error.inputTokens,
          outputTokens: error.outputTokens,
        };
      }
      if (!telemetry.workflow && latestWorkflow)
        telemetry.workflow = {
          ...latestWorkflow,
          status: 'fallback',
          steps: latestWorkflow.steps.map((step) =>
            step.status === 'running'
              ? {
                  ...step,
                  status: 'failed',
                  summary: 'Workflow deadline reached; unreviewed output withheld.',
                }
              : step,
          ),
        };
      reason =
        error instanceof ProviderFailure
          ? error.reason
          : controller.signal.aborted
            ? 'timeout'
            : 'provider-error';
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
  const result: AnalysisResponse = {
    recap: terminalRecap,
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
      calls: adapter && packet.facts.length ? 1 : 0,
      validated: reason === 'validated',
      ...telemetry,
    },
  };
  if (adapter && !narrative && result.recap)
    result.recap.limitation = en
      ? `Measured fallback recap · AI status: ${reason} · synthetic data.`
      : `Resumen medido de respaldo · estado de IA: ${reason} · datos sintéticos.`;
  if (narrative) {
    const limitation = en
      ? 'Foundry-generated interpretation · citations and structure checked; interpretation may be imperfect. Synthetic tracking, not proof of tactical causation.'
      : 'Interpretación de Foundry · citas y estructura verificadas; puede contener errores. Datos sintéticos, no prueba causal.';
    result.buildup = { ...narrative.story, factIds: selection.factIds, limitation };
    if (terminalRecap && narrative.recap)
      result.recap = { ...terminalRecap, ...narrative.recap, limitation };
  }
  return result;
}
