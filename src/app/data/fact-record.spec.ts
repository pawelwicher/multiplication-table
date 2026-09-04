import { TOTAL_FACT_COUNT, createFact, keyOf, type Fact } from '../domain/fact';
import { fromRecord, mergeRecords, toRecord } from './fact-record';

function stored(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    key: '7x8',
    box: 3,
    mastery: 2,
    recentTimes: [{ ms: 1500, noisy: false }],
    dueAt: 1_700_000_000_000,
    streak: 4,
    lapses: 1,
    ...overrides,
  };
}

describe('toRecord', () => {
  it('nie zapisuje pól wyliczalnych z klucza', () => {
    const record = toRecord(createFact(7, 8));
    expect(record).not.toHaveProperty('a');
    expect(record).not.toHaveProperty('b');
    expect(record.key).toBe('7x8');
  });
});

describe('fromRecord', () => {
  it('odtwarza fakt razem z polami wyliczanymi', () => {
    const fact = fromRecord(stored()) as Fact;
    expect(fact.a).toBe(7);
    expect(fact.b).toBe(8);
    expect(fact.box).toBe(3);
    expect(fact.mastery).toBe(2);
    expect(fact.recentTimes).toEqual([{ ms: 1500, noisy: false }]);
  });

  it('przechodzi pełny obieg bez strat', () => {
    const original: Fact = {
      ...createFact(3, 9),
      box: 5,
      mastery: 4,
      recentTimes: [
        { ms: 900, noisy: true },
        { ms: 1100, noisy: false },
      ],
      dueAt: 1_700_000_123_456,
      streak: 7,
      lapses: 2,
    };
    expect(fromRecord(toRecord(original))).toEqual(original);
  });

  it('odrzuca rekord bez klucza albo z kluczem niekanonicznym', () => {
    expect(fromRecord(stored({ key: undefined }))).toBeNull();
    expect(fromRecord(stored({ key: '8x7' }))).toBeNull();
    expect(fromRecord(stored({ key: '7x11' }))).toBeNull();
  });

  it('odrzuca wartości spoza dopuszczalnych zakresów', () => {
    expect(fromRecord(stored({ box: 0 }))).toBeNull();
    expect(fromRecord(stored({ box: 6 }))).toBeNull();
    expect(fromRecord(stored({ mastery: 5 }))).toBeNull();
    expect(fromRecord(stored({ mastery: -1 }))).toBeNull();
    expect(fromRecord(stored({ streak: -1 }))).toBeNull();
    expect(fromRecord(stored({ dueAt: -1 }))).toBeNull();
    expect(fromRecord(stored({ dueAt: Number.NaN }))).toBeNull();
  });

  it('odrzuca zepsute pomiary', () => {
    expect(fromRecord(stored({ recentTimes: 'nie tablica' }))).toBeNull();
    expect(fromRecord(stored({ recentTimes: [{ ms: 100 }] }))).toBeNull();
    expect(fromRecord(stored({ recentTimes: [{ ms: -1, noisy: false }] }))).toBeNull();
    expect(fromRecord(stored({ recentTimes: [1500] }))).toBeNull();
  });

  it('odrzuca okno pomiarów dłuższe niż wolno', () => {
    const tooMany = Array.from({ length: 6 }, () => ({ ms: 1000, noisy: false }));
    expect(fromRecord(stored({ recentTimes: tooMany }))).toBeNull();
  });

  it('odrzuca to, co nie jest obiektem', () => {
    for (const junk of [null, undefined, 42, 'x', []]) {
      expect(fromRecord(junk)).toBeNull();
    }
  });
});

describe('mergeRecords', () => {
  it('z pustej bazy robi świeży pełny zbiór', () => {
    const facts = mergeRecords([]);
    expect(facts).toHaveLength(TOTAL_FACT_COUNT);
    expect(facts.every((fact) => fact.mastery === 0)).toBe(true);
  });

  it('nakłada zapisany postęp na resztę świeżych faktów', () => {
    const facts = mergeRecords([stored()]);
    expect(facts).toHaveLength(TOTAL_FACT_COUNT);

    const restored = facts.find((fact) => keyOf(fact) === '7x8') as Fact;
    expect(restored.mastery).toBe(2);
    expect(facts.filter((fact) => fact.mastery !== 0)).toHaveLength(1);
  });

  it('zastępuje zepsuty rekord świeżym faktem, zamiast go gubić', () => {
    const facts = mergeRecords([stored({ mastery: 99 })]);
    expect(facts).toHaveLength(TOTAL_FACT_COUNT);
    expect((facts.find((fact) => keyOf(fact) === '7x8') as Fact).mastery).toBe(0);
  });

  it('ignoruje klucze spoza aktualnego zbioru', () => {
    const facts = mergeRecords([stored(), { ...stored(), key: '3x3', box: 4 }, 'śmieć']);
    expect(facts).toHaveLength(TOTAL_FACT_COUNT);
    expect((facts.find((fact) => keyOf(fact) === '3x3') as Fact).box).toBe(4);
  });

  it('nie współdzieli instancji między wywołaniami', () => {
    const first = mergeRecords([]);
    (first[0] as Fact).box = 5;
    expect((mergeRecords([])[0] as Fact).box).toBe(1);
  });
});
