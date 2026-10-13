import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_CARDS,
  STORAGE_KEY,
  createCard,
  filterCards,
  loadCards,
  saveCards,
} from '../src/cards.js';

function memoryStorage(initialValue) {
  const values = new Map();
  if (initialValue !== undefined) values.set(STORAGE_KEY, initialValue);
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

const exampleCards = [
  {
    id: 'first',
    name: 'Example Alpha',
    category: 'Airway',
    prompt: 'When is an alpha intervention indicated?',
    answer: 'Refer to the supplied study material.',
  },
  {
    id: 'second',
    name: 'Example Beta',
    category: 'Cardiac',
    prompt: 'Which considerations apply?',
    answer: 'Review contraindications before use.',
  },
  {
    id: 'third',
    name: 'Example Gamma',
    category: 'Airway',
    prompt: 'What should be reassessed?',
    answer: 'Monitor the response and reassess.',
  },
];

function assertSeparateObjects(actual, reference) {
  if (reference === null || typeof reference !== 'object') return;
  assert.notStrictEqual(actual, reference, 'Each loaded object should be an independent copy');
  for (const key of Object.keys(reference)) {
    assertSeparateObjects(actual[key], reference[key]);
  }
}

describe('bundled study deck', () => {
  it('contains one complete, uniquely identified card for each of the 38 PDF drug pages', () => {
    assert.equal(DEFAULT_CARDS.length, 38);
    assert.equal(new Set(DEFAULT_CARDS.map((card) => card.id)).size, 38);
    assert.deepEqual(
      DEFAULT_CARDS.map((card) => card.sourcePage).sort((a, b) => a - b),
      Array.from({ length: 38 }, (_, index) => index + 2),
    );
    for (const card of DEFAULT_CARDS) {
      for (const field of ['id', 'name', 'category', 'prompt', 'answer']) {
        assert.equal(typeof card[field], 'string', `${field} on page ${card.sourcePage}`);
        assert.ok(card[field].trim().length > 0, `${field} on page ${card.sourcePage} must contain text`);
      }
    }
  });
});

describe('persistent cards', () => {
  it('uses the versioned storage key', () => {
    assert.equal(STORAGE_KEY, 'paramedic-flashcards:v1');
  });

  it('returns independent default copies when no saved deck exists', () => {
    const first = loadCards(memoryStorage());
    const second = loadCards(memoryStorage());
    assert.deepEqual(first, DEFAULT_CARDS);
    assert.deepEqual(second, DEFAULT_CARDS);
    assertSeparateObjects(first, DEFAULT_CARDS);
    assertSeparateObjects(second, first);
    first[0].name = 'Changed locally';
    first.pop();
    assert.equal(second.length, 38);
    assert.deepEqual(second, DEFAULT_CARDS);
  });

  it('saves and reloads a custom deck without losing card content or order', () => {
    const storage = memoryStorage();
    const cards = [...exampleCards, createCard({
      name: 'Personal revision',
      category: 'Custom',
      prompt: 'What should I revise?',
      answer: 'My course material.',
    })];
    saveCards(storage, cards);
    assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)), cards);
    assert.deepEqual(loadCards(storage), cards);
  });

  it('honors an intentionally empty saved deck', () => {
    const storage = memoryStorage();
    saveCards(storage, []);
    assert.deepEqual(loadCards(storage), []);
  });

  it('falls back to defaults for malformed JSON, nonarrays, and invalid records', () => {
    const invalidValues = [
      '{broken',
      'null',
      '{}',
      '"text"',
      '42',
      '[null]',
      '["text"]',
      JSON.stringify([exampleCards[0], { id: 'incomplete' }]),
    ];
    for (const value of invalidValues) {
      assert.deepEqual(loadCards(memoryStorage(value)), DEFAULT_CARDS, `Stored value: ${value}`);
    }
  });

  it('rejects an entire saved deck when a required field is missing, empty, or not a string', () => {
    for (const field of ['id', 'name', 'category', 'prompt', 'answer']) {
      const missing = { ...exampleCards[0] };
      delete missing[field];
      for (const card of [missing, { ...exampleCards[0], [field]: '' }, { ...exampleCards[0], [field]: '   ' }, { ...exampleCards[0], [field]: 123 }]) {
        assert.deepEqual(loadCards(memoryStorage(JSON.stringify([card]))), DEFAULT_CARDS, `Invalid ${field}`);
      }
    }
  });

  it('loads defaults when storage access fails', () => {
    const storage = {
      getItem() {
        throw new Error('Storage access denied');
      },
    };
    const loaded = loadCards(storage);
    assert.deepEqual(loaded, DEFAULT_CARDS);
    assertSeparateObjects(loaded, DEFAULT_CARDS);
  });

  it('exposes a persistence failure so the interface can inform the user', () => {
    const failure = new Error('Storage quota exceeded');
    const storage = {
      setItem() {
        throw failure;
      },
    };
    assert.throws(() => saveCards(storage, exampleCards), (error) => error === failure);
  });
});

describe('finding cards', () => {
  it('returns all cards when no search or category is specified', () => {
    assert.deepEqual(filterCards(exampleCards), exampleCards);
    assert.deepEqual(filterCards([], 'anything'), []);
  });

  it('searches names, categories, questions, and answers without regard to letter case', () => {
    assert.deepEqual(filterCards(exampleCards, 'EXAMPLE BETA'), [exampleCards[1]]);
    assert.deepEqual(filterCards(exampleCards, 'aIrWaY'), [exampleCards[0], exampleCards[2]]);
    assert.deepEqual(filterCards(exampleCards, 'REASSESSED'), [exampleCards[2]]);
    assert.deepEqual(filterCards(exampleCards, 'CONTRAINDICATIONS'), [exampleCards[1]]);
    assert.deepEqual(filterCards(exampleCards, 'no matching text'), []);
  });

  it('combines search with an exact category filter', () => {
    assert.deepEqual(filterCards(exampleCards, '', 'Airway'), [exampleCards[0], exampleCards[2]]);
    assert.deepEqual(filterCards(exampleCards, 'alpha', 'Airway'), [exampleCards[0]]);
    assert.deepEqual(filterCards(exampleCards, 'alpha', 'Cardiac'), []);
    assert.deepEqual(filterCards(exampleCards, '', 'airway'), []);
    assert.deepEqual(filterCards(exampleCards, 'example', 'all'), exampleCards);
  });

  it('preserves the original card array and its records', () => {
    const cards = structuredClone(exampleCards);
    const before = structuredClone(cards);
    filterCards(cards, 'airway', 'Airway');
    assert.deepEqual(cards, before);
  });
});

describe('creating personal cards', () => {
  it('trims entered text and assigns different valid UUIDs to new cards', () => {
    const input = {
      name: '  Revision topic  ',
      category: '  Personal  ',
      prompt: '  What should I remember?  ',
      answer: '  Refer to the source.  ',
    };
    const first = createCard(input);
    const second = createCard(input);
    assert.equal(first.name, 'Revision topic');
    assert.equal(first.category, 'Personal');
    assert.equal(first.prompt, 'What should I remember?');
    assert.equal(first.answer, 'Refer to the source.');
    assert.match(first.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    assert.notEqual(first.id, second.id);
    assert.equal(input.name, '  Revision topic  ');
  });

  it('uses the Custom category when it is omitted or blank', () => {
    const input = { name: 'Revision', prompt: 'Question?', answer: 'Answer.' };
    assert.equal(createCard(input).category, 'Custom');
    assert.equal(createCard({ ...input, category: '   ' }).category, 'Custom');
  });

  it('rejects missing or whitespace-only names, prompts, and answers', () => {
    const input = { name: 'Revision', prompt: 'Question?', answer: 'Answer.' };
    for (const field of ['name', 'prompt', 'answer']) {
      const missing = { ...input };
      delete missing[field];
      assert.throws(() => createCard(missing), `${field} is required`);
      assert.throws(() => createCard({ ...input, [field]: '   ' }), `${field} must contain text`);
    }
  });
});
