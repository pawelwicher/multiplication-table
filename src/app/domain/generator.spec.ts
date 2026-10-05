import { describe, expect, it } from 'vitest';
import { MAX_RESULT, canGenerate, generateProblem } from './generator';
import { seeded } from './random';
import { MAX_TERMS, MIN_TERMS, OperationId, Settings } from './settings';

const COMBINATIONS: readonly OperationId[][] = [
  ['add'],
  ['sub'],
  ['mul'],
  ['div'],
  ['add', 'sub'],
  ['mul', 'div'],
  ['add', 'mul'],
  ['add', 'sub', 'mul', 'div'],
  ['add', 'sub', 'paren'],
  ['add', 'mul', 'paren'],
  ['add', 'sub', 'mul', 'div', 'paren'],
  ['add', 'unknown'],
  ['add', 'sub', 'mul', 'unknown'],
  ['add', 'sub', 'mul', 'div', 'paren', 'unknown'],
  ['mul', 'paren'],
  ['sub', 'mul', 'paren'],
  ['sub', 'unknown'],
  ['mul', 'unknown'],
  ['div', 'unknown'],
];

const RANGES: readonly [number, number][] = [
  [1, 10],
  [2, 10],
  [1, 20],
  [5, 30],
  [1, 100],
  [10, 100],
];

const SYMBOL: Partial<Record<OperationId, string>> = { add: '+', sub: '−', mul: '×', div: '÷' };

function everySetting(): Settings[] {
  const all: Settings[] = [];
  for (const operations of COMBINATIONS) {
    for (const [min, max] of RANGES) {
      for (let terms = MIN_TERMS; terms <= MAX_TERMS; terms++) {
        all.push({ min, max, operations, terms });
      }
    }
  }
  return all;
}

describe('generateProblem', () => {
  it('daje sensowne działanie dla każdej wykonalnej kombinacji kryteriów', () => {
    for (const settings of everySetting()) {
      if (!canGenerate(settings)) continue;
      for (let seed = 1; seed <= 5; seed++) {
        const problem = generateProblem(settings, seeded(seed * 7919 + settings.terms));
        const label = `${settings.operations.join('+')} ${settings.min}–${settings.max}, ${settings.terms} liczb`;

        expect(Number.isInteger(problem.answer), label).toBe(true);
        expect(problem.answer, label).toBeGreaterThanOrEqual(0);
        expect(problem.answer, label).toBeLessThanOrEqual(MAX_RESULT);
        expect(problem.points, label).toBeGreaterThan(0);
        expect(problem.display, label).not.toMatch(/NaN|Infinity|undefined/);
        expect(problem.display, label).not.toMatch(/\d+\.\d/);
      }
    }
  });

  // Regresja: przy samym mnożeniu albo wielu składnikach generator poddawał się
  // i po cichu dawał „a − b” — zła liczba składników i nie te działania.
  it('dla każdej wykonalnej kombinacji trzyma się liczby składników, zakresu i działań', () => {
    for (const settings of everySetting()) {
      // Np. 10 mnożeń liczb od 10 wzwyż nie zmieści się w MAX_RESULT — tego ekran nie przepuści.
      if (!canGenerate(settings)) continue;
      const allowed = settings.operations.map((op) => SYMBOL[op]).filter(Boolean);
      for (let seed = 1; seed <= 5; seed++) {
        const { display } = generateProblem(settings, seeded(seed * 104729 + settings.max));
        const label = `${settings.operations.join('+')} ${settings.min}–${settings.max}, ${settings.terms} liczb: ${display}`;
        const left = display.split('=')[0];

        expect(left.match(/\d+|x/g)?.length, label).toBe(settings.terms);
        for (const symbol of left.match(/[+−×÷]/g) ?? []) {
          expect(allowed, label).toContain(symbol);
        }
        // Każda liczba z zakresu — poza dzielną, która wynika z dzielnika i ilorazu.
        for (const [, n, next] of left.matchAll(/(\d+)\s*(÷?)/g)) {
          if (next === '÷') continue;
          expect(Number(n), label).toBeGreaterThanOrEqual(settings.min);
          expect(Number(n), label).toBeLessThanOrEqual(settings.max);
        }
      }
    }
  });

  it('przy zakresie od 1 każda kombinacja jest wykonalna', () => {
    for (const settings of everySetting().filter((s) => s.min === 1)) {
      const label = `${settings.operations.join('+')} ${settings.min}–${settings.max}, ${settings.terms} liczb`;
      expect(canGenerate(settings), label).toBe(true);
    }
  });

  it('wykrywa kryteria, z których nie da się ułożyć działania', () => {
    // 20⁵ = 3 200 000 — daleko poza MAX_RESULT.
    expect(canGenerate({ min: 20, max: 30, operations: ['mul'], terms: 5 })).toBe(false);
    expect(canGenerate({ min: 20, max: 30, operations: ['mul'], terms: 2 })).toBe(true);
    // 10 − 2 − 2 − 2 − 2 − 2 − 2 < 0: sześć odjemników po co najmniej 2 nie zmieści się w 10.
    expect(canGenerate({ min: 2, max: 10, operations: ['sub'], terms: 7 })).toBe(false);
    expect(canGenerate({ min: 2, max: 10, operations: ['sub'], terms: 5 })).toBe(true);
  });

  it('trzyma się dolnej granicy zakresu', () => {
    const settings: Settings = {
      min: 2,
      max: 10,
      operations: ['add', 'sub', 'mul', 'div'],
      terms: 4,
    };
    for (let seed = 1; seed <= 40; seed++) {
      const { display } = generateProblem(settings, seeded(seed));
      expect(display, display).not.toMatch(/(^|[^\d])[01](?!\d)/);
    }
  });

  it('mnożenie w zakresie 1–10 to tabliczka mnożenia', () => {
    const settings: Settings = { min: 1, max: 10, operations: ['mul'], terms: 2 };
    for (let seed = 1; seed <= 40; seed++) {
      const { display, answer } = generateProblem(settings, seeded(seed));
      const [a, b] = display.match(/\d+/g)!.map(Number);
      expect(a).toBeLessThanOrEqual(10);
      expect(b).toBeLessThanOrEqual(10);
      expect(answer).toBe(a * b);
    }
  });

  it('dzielenie w zakresie 1–10 ma dzielnik i wynik z zakresu', () => {
    const settings: Settings = { min: 1, max: 10, operations: ['div'], terms: 2 };
    const dividends: number[] = [];
    for (let seed = 1; seed <= 40; seed++) {
      const { display, answer } = generateProblem(settings, seeded(seed));
      const [a, b] = display.match(/\d+/g)!.map(Number);
      expect(b).toBeLessThanOrEqual(10);
      expect(answer).toBeLessThanOrEqual(10);
      expect(answer * b).toBe(a);
      dividends.push(a);
    }
    // Dzielna wychodzi poza zakres — inaczej byłoby samo 8 ÷ 2.
    expect(Math.max(...dividends)).toBeGreaterThan(10);
  });

  it('wynik nie jest ograniczony zakresem', () => {
    const settings: Settings = { min: 1, max: 10, operations: ['add'], terms: 4 };
    const answers = Array.from(
      { length: 30 },
      (_, i) => generateProblem(settings, seeded(i + 1)).answer,
    );
    expect(Math.max(...answers)).toBeGreaterThan(10);
  });

  it('używa tylu liczb, ile wybrano', () => {
    const settings: Settings = {
      min: 1,
      max: 100,
      operations: ['add', 'sub', 'mul', 'div'],
      terms: 6,
    };
    for (let seed = 1; seed <= 40; seed++) {
      const { display } = generateProblem(settings, seeded(seed));
      expect(display.match(/\d+/g)?.length).toBe(6);
    }
  });

  it('nie wstawia operatorów spoza wyboru', () => {
    const settings: Settings = { min: 1, max: 50, operations: ['add', 'mul'], terms: 4 };
    for (let seed = 1; seed <= 40; seed++) {
      const { display } = generateProblem(settings, seeded(seed));
      expect(display).not.toContain('−');
      expect(display).not.toContain('÷');
    }
  });

  it('pyta o x i pokazuje wynik po prawej', () => {
    const settings: Settings = { min: 1, max: 30, operations: ['add', 'sub', 'unknown'], terms: 3 };
    for (let seed = 1; seed <= 30; seed++) {
      const problem = generateProblem(settings, seeded(seed));
      expect(problem.asks).toBe('x');
      expect(problem.display).toContain('x');
      expect(problem.display).toMatch(/=\s\d+$/);
    }
  });

  it('stawia nawiasy, gdy o nie poproszono', () => {
    const settings: Settings = { min: 1, max: 100, operations: ['add', 'mul', 'paren'], terms: 4 };
    const withParens = Array.from({ length: 30 }, (_, i) =>
      generateProblem(settings, seeded(i + 1)),
    ).filter((p) => p.display.includes('('));
    expect(withParens.length).toBeGreaterThan(10);
  });

  it('stawia nawiasy także przy pełnym zestawie działań', () => {
    const settings: Settings = {
      min: 1,
      max: 100,
      operations: ['add', 'sub', 'mul', 'div', 'paren'],
      terms: 5,
    };
    const withParens = Array.from({ length: 40 }, (_, i) =>
      generateProblem(settings, seeded(i + 1)),
    ).filter((p) => p.display.includes('('));
    expect(withParens.length).toBeGreaterThan(20);
  });

  it('trudniejsze działanie jest wyżej punktowane', () => {
    const easy = generateProblem({ min: 1, max: 20, operations: ['add'], terms: 2 }, seeded(3));
    const hard = generateProblem(
      { min: 1, max: 100, operations: ['add', 'sub', 'mul', 'div', 'paren', 'unknown'], terms: 8 },
      seeded(3),
    );
    expect(hard.points).toBeGreaterThan(easy.points);
  });
});
