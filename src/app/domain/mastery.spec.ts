import { allFacts, createFact, keyOf, type AnswerEvent, type Fact, type Mastery } from './fact';
import {
  ARCADE_MIN_MASTERY,
  BOX_INTERVALS_MS,
  MAX_BOX,
  applyAnswer,
  dueAtForBox,
  earnedMastery,
  isArcadeReady,
  isDue,
  median,
  trackedProgress,
} from './mastery';

const NOW = 1_700_000_000_000;

function answer(fact: Fact, overrides: Partial<AnswerEvent> = {}): AnswerEvent {
  return { key: keyOf(fact), correct: true, elapsedMs: 1500, noisy: false, ...overrides };
}

/** Powtarza tę samą odpowiedź `times` razy, przesuwając zegar o sekundę. */
function repeat(fact: Fact, times: number, overrides: Partial<AnswerEvent> = {}): Fact {
  let current = fact;
  for (let i = 0; i < times; i++) {
    current = applyAnswer(current, answer(current, overrides), NOW + i * 1000);
  }
  return current;
}

describe('median', () => {
  it('liczy medianę dla nieparzystej liczby próbek', () => {
    expect(median([3000, 1000, 2000])).toBe(2000);
  });

  it('uśrednia dwie środkowe dla parzystej liczby próbek', () => {
    expect(median([1000, 2000, 3000, 5000])).toBe(2500);
  });

  it('radzi sobie z jedną próbką', () => {
    expect(median([1234])).toBe(1234);
  });

  it('zwraca null dla pustego zbioru', () => {
    expect(median([])).toBeNull();
  });

  it('nie mutuje wejścia', () => {
    const input = [3000, 1000, 2000];
    median(input);
    expect(input).toEqual([3000, 1000, 2000]);
  });

  it('jest odporna na pojedynczy zawis — inaczej niż średnia', () => {
    expect(median([1200, 1300, 1400, 1500, 30_000])).toBe(1400);
  });
});

describe('dueAtForBox', () => {
  it('pudełko 1 wraca natychmiast', () => {
    expect(dueAtForBox(1, NOW)).toBe(NOW);
  });

  it('odstępy rosną z numerem pudełka', () => {
    const intervals = ([1, 2, 3, 4, 5] as const).map((box) => dueAtForBox(box, NOW) - NOW);
    expect(intervals).toEqual([...BOX_INTERVALS_MS]);
    for (let i = 1; i < intervals.length; i++) {
      expect(intervals[i] as number).toBeGreaterThan(intervals[i - 1] as number);
    }
  });
});

describe('isDue', () => {
  it('świeży fakt jest zaległy od zawsze', () => {
    expect(isDue(createFact(7, 8), NOW)).toBe(true);
  });

  it('fakt zaplanowany w przyszłość nie jest zaległy', () => {
    const fact = { ...createFact(7, 8), dueAt: NOW + 1 };
    expect(isDue(fact, NOW)).toBe(false);
    expect(isDue(fact, NOW + 1)).toBe(true);
  });
});

describe('applyAnswer — czystość i walidacja', () => {
  it('nie mutuje faktu wejściowego', () => {
    const fact = createFact(7, 8);
    const snapshot = structuredClone(fact);
    applyAnswer(fact, answer(fact), NOW);
    expect(fact).toEqual(snapshot);
  });

  it('nie współdzieli tablicy recentTimes z wynikiem', () => {
    const fact = createFact(7, 8);
    const next = applyAnswer(fact, answer(fact), NOW);
    expect(next.recentTimes).not.toBe(fact.recentTimes);
  });

  it('rzuca, gdy odpowiedź dotyczy innego faktu', () => {
    const fact = createFact(7, 8);
    expect(() => applyAnswer(fact, { ...answer(fact), key: '3x4' }, NOW)).toThrow(RangeError);
  });

  it('rzuca na niepoprawnym czasie', () => {
    const fact = createFact(7, 8);
    expect(() => applyAnswer(fact, { ...answer(fact), elapsedMs: -1 }, NOW)).toThrow(RangeError);
    expect(() => applyAnswer(fact, { ...answer(fact), elapsedMs: Number.NaN }, NOW)).toThrow(RangeError);
    expect(() => applyAnswer(fact, answer(fact), Number.NaN)).toThrow(RangeError);
  });
});

describe('applyAnswer — poprawna odpowiedź', () => {
  it('awansuje pudełko, serię i zapisuje pomiar', () => {
    const fact = createFact(7, 8);
    const next = applyAnswer(fact, answer(fact, { elapsedMs: 2400, noisy: true }), NOW);

    expect(next.box).toBe(2);
    expect(next.streak).toBe(1);
    expect(next.lapses).toBe(0);
    expect(next.recentTimes).toEqual([{ ms: 2400, noisy: true }]);
    expect(next.dueAt).toBe(dueAtForBox(2, NOW));
  });

  it('zatrzymuje pudełko na 5', () => {
    expect(repeat(createFact(7, 8), 8).box).toBe(MAX_BOX);
  });

  it('trzyma tylko 5 ostatnich pomiarów', () => {
    let fact = createFact(7, 8);
    for (let i = 0; i < 7; i++) {
      fact = applyAnswer(fact, answer(fact, { elapsedMs: 1000 + i }), NOW + i);
    }
    expect(fact.recentTimes).toHaveLength(5);
    expect(fact.recentTimes.map((s) => s.ms)).toEqual([1002, 1003, 1004, 1005, 1006]);
  });
});

describe('applyAnswer — błąd i przekroczenie linii', () => {
  it('resetuje pudełko i serię, dolicza wpadkę', () => {
    const fluent = repeat(createFact(7, 8), 4);
    const lapsed = applyAnswer(fluent, answer(fluent, { correct: false }), NOW);

    expect(lapsed.box).toBe(1);
    expect(lapsed.streak).toBe(0);
    expect(lapsed.lapses).toBe(1);
    expect(lapsed.dueAt).toBe(NOW);
  });

  it('nie zapisuje czasu błędnej odpowiedzi', () => {
    const fact = repeat(createFact(7, 8), 3);
    const before = fact.recentTimes;
    const lapsed = applyAnswer(fact, answer(fact, { correct: false, elapsedMs: 9999 }), NOW);
    expect(lapsed.recentTimes).toEqual(before);
  });
});

describe('drabinka mastery', () => {
  it('świeży fakt jest nieznany', () => {
    expect(createFact(7, 8).mastery).toBe(0);
    expect(earnedMastery(createFact(7, 8))).toBe(0);
  });

  it('wspina się po jednym poziomie na odpowiedź', () => {
    let fact = createFact(7, 8);
    const path: Mastery[] = [];
    for (let i = 0; i < 5; i++) {
      fact = applyAnswer(fact, answer(fact, { elapsedMs: 1500, noisy: false }), NOW + i * 1000);
      path.push(fact.mastery);
    }
    expect(path).toEqual([1, 2, 3, 4, 4]);
  });

  it('nie przeskakuje poziomów nawet przy błyskawicznych odpowiedziach', () => {
    let fact = createFact(7, 8);
    let previous: Mastery = fact.mastery;
    for (let i = 0; i < 6; i++) {
      fact = applyAnswer(fact, answer(fact, { elapsedMs: 200 }), NOW + i * 1000);
      expect(fact.mastery - previous).toBeLessThanOrEqual(1);
      previous = fact.mastery;
    }
  });

  it('zatrzymuje się na 2 przy odpowiedziach wolniejszych niż 3 s', () => {
    const fact = repeat(createFact(7, 8), 6, { elapsedMs: 4200 });
    expect(fact.mastery).toBe(2);
    expect(earnedMastery(fact)).toBe(2);
  });

  it('sięga 3 przy medianie poniżej 3 s', () => {
    expect(repeat(createFact(7, 8), 6, { elapsedMs: 2600, noisy: true }).mastery).toBe(3);
  });

  it('nie sięga 4 z samych pomiarów zaszumionych', () => {
    const fact = repeat(createFact(7, 8), 8, { elapsedMs: 900, noisy: true });
    expect(fact.mastery).toBe(3);
    expect(earnedMastery(fact)).toBe(3);
  });

  it('sięga 4 dopiero na czystych pomiarach poniżej 2 s', () => {
    const noisy = repeat(createFact(7, 8), 4, { elapsedMs: 900, noisy: true });
    expect(noisy.mastery).toBe(3);

    const clean = repeat(noisy, 3, { elapsedMs: 900, noisy: false });
    expect(clean.mastery).toBe(4);
  });

  it('degradacja cofa o jeden poziom', () => {
    const automated = repeat(createFact(7, 8), 6, { elapsedMs: 900 });
    expect(automated.mastery).toBe(4);
    expect(applyAnswer(automated, answer(automated, { correct: false }), NOW).mastery).toBe(3);
  });

  it('degradacja nigdy nie schodzi do zera', () => {
    let fact = repeat(createFact(7, 8), 1);
    expect(fact.mastery).toBe(1);
    for (let i = 0; i < 5; i++) {
      fact = applyAnswer(fact, answer(fact, { correct: false }), NOW + i);
    }
    expect(fact.mastery).toBe(1);
  });

  it('fakt nigdy nieodpowiedziany zostaje na zerze', () => {
    const fact = createFact(7, 8);
    expect(applyAnswer(fact, answer(fact, { correct: false }), NOW).mastery).toBe(0);
  });

  it('spowolnienie zbija poziom także po poprawnych odpowiedziach', () => {
    const automated = repeat(createFact(7, 8), 6, { elapsedMs: 900 });
    expect(automated.mastery).toBe(4);
    expect(repeat(automated, 5, { elapsedMs: 5000 }).mastery).toBe(2);
  });
});

describe('isArcadeReady', () => {
  it('wpuszcza dopiero od poziomu 2', () => {
    let fact = createFact(7, 8);
    expect(isArcadeReady(fact)).toBe(false);

    fact = repeat(fact, 1);
    expect(fact.mastery).toBe(1);
    expect(isArcadeReady(fact)).toBe(false);

    fact = repeat(fact, 1);
    expect(fact.mastery).toBe(ARCADE_MIN_MASTERY);
    expect(isArcadeReady(fact)).toBe(true);
  });
});

describe('trackedProgress', () => {
  it('liczy tylko fakty nietrywialne', () => {
    expect(trackedProgress(allFacts())).toEqual({ automated: 0, total: 21 });
  });

  it('ignoruje zautomatyzowane fakty trywialne', () => {
    const facts = allFacts().map((fact) => (fact.trivial ? { ...fact, mastery: 4 as Mastery } : fact));
    expect(trackedProgress(facts)).toEqual({ automated: 0, total: 21 });
  });

  it('zlicza zautomatyzowane fakty nietrywialne', () => {
    const facts = allFacts().map((fact) =>
      !fact.trivial && fact.a === 7 ? { ...fact, mastery: 4 as Mastery } : fact,
    );
    // 7x7, 7x8, 7x9 — pary siódemki z {3,4,6} mają a < 7
    expect(trackedProgress(facts).automated).toBe(3);
  });
});
