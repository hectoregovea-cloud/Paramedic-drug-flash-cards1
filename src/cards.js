import { DEFAULT_CARDS } from './data.js';

export { DEFAULT_CARDS };
export const STORAGE_KEY = 'paramedic-flashcards:v1';

const cloneDefaults = () => structuredClone(DEFAULT_CARDS);
const isCard = (card) => card && typeof card === 'object' &&
  ['id', 'name', 'category', 'prompt', 'answer'].every((key) =>
    typeof card[key] === 'string' && card[key].trim().length > 0);

export function loadCards(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return cloneDefaults();
    const cards = JSON.parse(raw);
    if (!Array.isArray(cards) || !cards.every(isCard) ||
        new Set(cards.map((card) => card.id)).size !== cards.length) return cloneDefaults();
    return cards;
  } catch {
    return cloneDefaults();
  }
}

export function saveCards(storage, cards) {
  storage.setItem(STORAGE_KEY, JSON.stringify(cards));
}

export function filterCards(cards, query = '', category = 'all') {
  const term = query.trim().toLocaleLowerCase();
  return cards.filter((card) => (category === 'all' || card.category === category) &&
    [card.name, card.category, card.prompt, card.answer].some((value) =>
      value.toLocaleLowerCase().includes(term)));
}

export function createCard({ name, category, prompt, answer }) {
  const values = {
    name: String(name ?? '').trim(),
    category: String(category ?? '').trim() || 'Custom',
    prompt: String(prompt ?? '').trim(),
    answer: String(answer ?? '').trim(),
  };
  if (!values.name || !values.prompt || !values.answer) {
    throw new Error('Enter a drug name, a question, and an answer.');
  }
  if (values.name.length > 120 || values.category.length > 80 ||
      values.prompt.length > 1000 || values.answer.length > 10000) {
    throw new Error('Please shorten the card to fit the field limits.');
  }
  return { id: crypto.randomUUID(), ...values };
}
