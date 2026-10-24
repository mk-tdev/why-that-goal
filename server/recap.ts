import { visibleEvents, type Scenario } from '../src/core/model';
import type { EvidencePacket, SequenceRecap } from './contracts';

/** Recaps require the terminal event to be available, including its receipt timestamp. */
export function createRecap(s: Scenario, packet: EvidencePacket): SequenceRecap | null {
  const events = visibleEvents(
    s.events,
    packet.request.through,
    packet.request.receivedThrough,
  ).filter((e) => e.outcome !== 'voided');
  const terminalId = s.events.at(-1)!.id;
  const terminal = events.find((e) => e.id === terminalId);
  if (!terminal) return null;
  const failed = events.find((e) => e.outcome === 'failed');
  const outcome =
    terminal.type === 'goal'
      ? 'goal'
      : terminal.type === 'save'
        ? 'save'
        : failed
          ? 'failed-attack'
          : null;
  if (!outcome) return null;
  const en = packet.request.language === 'en';
  const byKind = (kind: string) => packet.facts.filter((f) => f.kind === kind);
  const passes = byKind('pass-progress');
  const run = byKind('off-ball-run').sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
  const space = byKind('space-change').sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
  const decisive = packet.facts.find(
    (f) => f.kind === 'event' && f.eventId === (failed?.id ?? terminal.id),
  )!;
  const terminalFact = packet.facts.find((f) => f.kind === 'event' && f.eventId === terminal.id)!;
  const endText = en
    ? outcome === 'goal'
      ? 'The move ends in a recorded goal. The passing route delivered the ball to the shooter; the finish converted that opportunity.'
      : outcome === 'save'
        ? 'The move reached a shot, but the goalkeeper stopped it. The preceding passes reached a shooting position; those patterns did not guarantee a goal.'
        : 'The attempted connection reached an opponent. Possession was lost before a shot, so the earlier progress never became a finish.'
    : outcome === 'goal'
      ? 'La jugada termina en gol. Los pases llevaron el balón al rematador y el remate convirtió la ocasión.'
      : outcome === 'save'
        ? 'La jugada llegó al remate, pero el portero lo detuvo. El avance no garantiza un gol.'
        : 'El pase llegó a un rival. Se perdió la posesión antes de rematar.';
  const cards: SequenceRecap['cards'] = [];
  const pass = passes.at(-1);
  if (pass)
    cards.push({
      title: en
        ? 'The connection that advanced the attack'
        : 'La conexión que hizo avanzar el ataque',
      text: pass.text,
      factIds: [pass.id],
    });
  if (run)
    cards.push({
      title: en ? 'The receiving movement' : 'El movimiento para recibir',
      text: run.text,
      factIds: [run.id],
    });
  if (space)
    cards.push({
      title: en ? 'What happened to the space' : 'Qué pasó con el espacio',
      text: space.text,
      factIds: [space.id],
    });
  cards.push({
    title: en ? 'Why this outcome' : 'Por qué terminó así',
    text: endText,
    factIds: [...new Set([decisive.id, terminalFact.id])],
  });
  return {
    outcome,
    title: en
      ? outcome === 'goal'
        ? 'A buildup converted'
        : outcome === 'save'
          ? 'A chance denied'
          : 'An attack interrupted'
      : outcome === 'goal'
        ? 'Una jugada convertida'
        : outcome === 'save'
          ? 'Una ocasión detenida'
          : 'Un ataque interrumpido',
    summary: en
      ? `${passes.length} completed passes. ${outcome === 'failed-attack' ? 'No shot: the interception ended the attack.' : outcome === 'goal' ? 'One shot, one goal.' : 'One shot, saved.'}`
      : `${passes.length} pases completados. ${outcome === 'failed-attack' ? 'Sin remate: una intercepción terminó el ataque.' : outcome === 'goal' ? 'Un remate, un gol.' : 'Un remate detenido.'}`,
    through: packet.request.through,
    terminalFactId: terminalFact.id,
    cards,
    limitation: en
      ? 'Automatic rule-based recap · synthetic data · observed buildup, not proof of tactical causation. Foundry disconnected.'
      : 'Resumen automático por reglas · datos sintéticos · no prueba causal. Foundry desconectado.',
  };
}
