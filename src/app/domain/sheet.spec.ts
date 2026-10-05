import { describe, expect, it } from 'vitest';
import { generateProblem } from './generator';
import { seeded } from './random';
import { Settings } from './settings';
import { describeCustom, generateSheet } from './sheet';

const multiply = { min: 1, max: 100, operations: ['mul'], terms: 2 } as const;

describe('generateSheet', () => {
  it('daje dokładnie tyle działań, ile trzeba', () => {
    const sheet = generateSheet(20, (rng) => generateProblem(multiply, rng), seeded(1));
    expect(sheet).toHaveLength(20);
  });

  it('nie powtarza działań, gdy pula jest wystarczająca', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const sheet = generateSheet(30, (rng) => generateProblem(multiply, rng), seeded(seed));
      expect(new Set(sheet.map((p) => p.display)).size).toBe(30);
    }
  });

  it('wypełnia kartę także przy zbyt małej puli', () => {
    // Dwie liczby od 1 do 2 i samo dodawanie: tylko 1 + 1, 1 + 2, 2 + 1, 2 + 2.
    const tiny = { min: 1, max: 2, operations: ['add'], terms: 2 } as unknown as Settings;
    const sheet = generateSheet(30, (rng) => generateProblem(tiny, rng), seeded(3));
    expect(sheet).toHaveLength(30);
    expect(new Set(sheet.map((p) => p.display)).size).toBe(4);
  });

  it('ten sam seed daje tę samą kartę', () => {
    const draw = (rng: () => number) => generateProblem(multiply, rng);
    expect(generateSheet(10, draw, seeded(42))).toEqual(generateSheet(10, draw, seeded(42)));
  });
});

describe('opis karty', () => {
  it('wymienia działania, zakres i liczbę składników', () => {
    expect(describeCustom({ min: 1, max: 100, operations: ['mul', 'div'], terms: 2 })).toBe(
      'Mnożenie, dzielenie · liczby 1–100 · 2 liczby',
    );
    expect(describeCustom({ min: 1, max: 20, operations: ['add'], terms: 5 })).toBe(
      'Dodawanie · liczby 1–20 · 5 liczb',
    );
  });
});
