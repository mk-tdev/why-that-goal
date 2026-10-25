import {
  ContractError,
  exactKeys,
  object,
  validateSelection,
  type EvidencePacket,
  type Selection,
  type SequenceRecap,
} from './contracts';

export type Narrative = {
  story: { title: string; summary: string };
  recap: { title: string; summary: string; cards: SequenceRecap['cards'] } | null;
};
/** Structural and provenance checks do not prove the truth of a model's interpretation. */
export function validateNarrative(
  value: unknown,
  packet: EvidencePacket,
  terminal: SequenceRecap | null,
): Selection & Narrative {
  const v = object(value);
  exactKeys(v, ['factIds', 'story', 'recap']);
  const selection = validateSelection({ factIds: v.factIds }, packet);
  const text = (value: unknown, max: number): string => {
    if (
      typeof value !== 'string' ||
      !value.trim() ||
      value.length > max ||
      /[<>\d]/u.test(value) ||
      /\b(guarantee[sd]?|proved?|certainly caused|xg)\b/i.test(value)
    )
      throw new ContractError('Unsafe or unsupported narrative text');
    return value.trim();
  };
  const story = object(v.story);
  exactKeys(story, ['title', 'summary']);
  const result: Selection & Narrative = {
    ...selection,
    story: { title: text(story.title, 100), summary: text(story.summary, 800) },
    recap: null,
  };
  if (!terminal) {
    if (v.recap !== null) throw new ContractError('Premature recap');
    return result;
  }
  const recap = object(v.recap);
  exactKeys(recap, ['title', 'summary', 'cards']);
  if (!Array.isArray(recap.cards) || !recap.cards.length || recap.cards.length > 4)
    throw new ContractError('Invalid recap cards');
  const cards = recap.cards.map((value) => {
    const card = object(value);
    exactKeys(card, ['title', 'text', 'factIds']);
    const refs = validateSelection({ factIds: card.factIds }, packet);
    if (!refs.factIds.length) throw new ContractError('Uncited recap');
    return { title: text(card.title, 100), text: text(card.text, 600), factIds: refs.factIds };
  });
  if (!cards.some((c) => c.factIds.includes(terminal.terminalFactId)))
    throw new ContractError('Missing outcome evidence');
  result.recap = { title: text(recap.title, 100), summary: text(recap.summary, 800), cards };
  return result;
}
