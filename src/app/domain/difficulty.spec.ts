import {
  DEFAULT_DIFFICULTY,
  DIFFICULTIES,
  difficultyLabel,
  factsWithin,
  isDifficulty,
  withinDifficulty,
} from './difficulty';
import { TOTAL_FACT_COUNT, allFacts, createFact, factProduct, keyOf } from './fact';

describe('DIFFICULTIES', () => {
  it('idzie co dziesięć od 20 do 100', () => {
    expect([...DIFFICULTIES]).toEqual([20, 30, 40, 50, 60, 70, 80, 90, 100]);
  });

  it('domyślny próg to najniższy', () => {
    expect(DEFAULT_DIFFICULTY).toBe(DIFFICULTIES[0]);
  });
});

describe('isDifficulty', () => {
  it('przyjmuje wyłącznie zdefiniowane progi', () => {
    for (const value of DIFFICULTIES) {
      expect(isDifficulty(value)).toBe(true);
    }
    for (const junk of [0, 10, 25, 110, -20, '20', null, undefined, Number.NaN]) {
      expect(isDifficulty(junk)).toBe(false);
    }
  });
});

describe('withinDifficulty', () => {
  it('wpuszcza wynik równy progowi', () => {
    expect(factProduct(createFact(4, 5))).toBe(20);
    expect(withinDifficulty(createFact(4, 5), 20)).toBe(true);
  });

  it('odrzuca wynik o jeden za duży', () => {
    expect(factProduct(createFact(3, 7))).toBe(21);
    expect(withinDifficulty(createFact(3, 7), 20)).toBe(false);
  });
});

describe('factsWithin', () => {
  it('najwyższy próg obejmuje całą tabliczkę', () => {
    expect(factsWithin(allFacts(), 100)).toHaveLength(TOTAL_FACT_COUNT);
  });

  it('najniższy próg daje 25 działań — dość na sensowną sesję', () => {
    expect(factsWithin(allFacts(), 20)).toHaveLength(25);
  });

  it('progi są zagnieżdżone — wyższy zawiera wszystko z niższego', () => {
    const facts = allFacts();
    for (let i = 1; i < DIFFICULTIES.length; i++) {
      const lower = new Set(factsWithin(facts, DIFFICULTIES[i - 1]!).map(keyOf));
      const higher = new Set(factsWithin(facts, DIFFICULTIES[i]!).map(keyOf));
      for (const key of lower) {
        expect(higher.has(key)).toBe(true);
      }
      expect(higher.size).toBeGreaterThan(lower.size);
    }
  });

  it('żaden próg nie jest pusty', () => {
    for (const difficulty of DIFFICULTIES) {
      expect(factsWithin(allFacts(), difficulty).length).toBeGreaterThan(0);
    }
  });

  it('nie przepuszcza działania spoza progu', () => {
    for (const difficulty of DIFFICULTIES) {
      for (const fact of factsWithin(allFacts(), difficulty)) {
        expect(factProduct(fact)).toBeLessThanOrEqual(difficulty);
      }
    }
  });
});

describe('difficultyLabel', () => {
  it('opisuje próg jako zakres wyniku', () => {
    expect(difficultyLabel(20)).toBe('1–20');
    expect(difficultyLabel(100)).toBe('1–100');
  });
});
