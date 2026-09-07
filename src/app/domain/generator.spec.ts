import { describe, expect, it } from 'vitest';
import { generateProblem } from './generator';
import { seeded } from './random';
import { MAX_TERMS, MIN_TERMS, OperationId, RANGES, Settings } from './settings';

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
];

function everySetting(): Settings[] {
  const all: Settings[] = [];
  for (const operations of COMBINATIONS) {
    for (const max of RANGES) {
      for (let terms = MIN_TERMS; terms <= MAX_TERMS; terms++) {
        all.push({ max, operations, terms });
      }
    }
  }
  return all;
}

describe('generateProblem', () => {
  it('daje sensowne działanie dla każdej kombinacji kryteriów', () => {
    for (const settings of everySetting()) {
      for (let seed = 1; seed <= 5; seed++) {
        const problem = generateProblem(settings, seeded(seed * 7919 + settings.terms));
        const label = `${settings.operations.join('+')} do ${settings.max}, ${settings.terms} liczb`;

        expect(Number.isInteger(problem.answer), label).toBe(true);
        expect(problem.answer, label).toBeGreaterThanOrEqual(0);
        expect(problem.answer, label).toBeLessThanOrEqual(settings.max);
        expect(problem.points, label).toBeGreaterThan(0);
        expect(problem.display, label).not.toMatch(/NaN|Infinity|undefined/);
        expect(problem.display, label).not.toMatch(/\d+\.\d/);
      }
    }
  });

  it('używa tylu liczb, ile wybrano', () => {
    const settings: Settings = { max: 100, operations: ['add', 'sub', 'mul', 'div'], terms: 6 };
    for (let seed = 1; seed <= 40; seed++) {
      const { display } = generateProblem(settings, seeded(seed));
      expect(display.match(/\d+/g)?.length).toBe(6);
    }
  });

  it('nie wstawia operatorów spoza wyboru', () => {
    const settings: Settings = { max: 50, operations: ['add', 'mul'], terms: 4 };
    for (let seed = 1; seed <= 40; seed++) {
      const { display } = generateProblem(settings, seeded(seed));
      expect(display).not.toContain('−');
      expect(display).not.toContain('÷');
    }
  });

  it('pyta o x i pokazuje wynik po prawej', () => {
    const settings: Settings = { max: 30, operations: ['add', 'sub', 'unknown'], terms: 3 };
    for (let seed = 1; seed <= 30; seed++) {
      const problem = generateProblem(settings, seeded(seed));
      expect(problem.asks).toBe('x');
      expect(problem.display).toContain('x');
      expect(problem.display).toMatch(/=\s\d+$/);
    }
  });

  it('stawia nawiasy, gdy o nie poproszono', () => {
    const settings: Settings = { max: 100, operations: ['add', 'mul', 'paren'], terms: 4 };
    const withParens = Array.from({ length: 30 }, (_, i) =>
      generateProblem(settings, seeded(i + 1)),
    ).filter((p) => p.display.includes('('));
    expect(withParens.length).toBeGreaterThan(10);
  });

  it('stawia nawiasy także przy pełnym zestawie działań', () => {
    const settings: Settings = {
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
    const easy = generateProblem({ max: 20, operations: ['add'], terms: 2 }, seeded(3));
    const hard = generateProblem(
      { max: 100, operations: ['add', 'sub', 'mul', 'div', 'paren', 'unknown'], terms: 8 },
      seeded(3),
    );
    expect(hard.points).toBeGreaterThan(easy.points);
  });
});
