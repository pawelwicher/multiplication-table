import { describe, expect, it } from 'vitest';
import { seeded } from './random';
import { DEFAULT_TABLE_SETTINGS, generateTableProblem, sanitizeTables } from './tables';

describe('generateTableProblem', () => {
  it('trzyma się wybranych tabliczek', () => {
    const settings = { tables: [7], withDivision: false };
    for (let seed = 1; seed <= 40; seed++) {
      const { display, answer } = generateTableProblem(settings, seeded(seed));
      const [a, b] = display.match(/\d+/g)!.map(Number);
      expect(a === 7 || b === 7).toBe(true);
      expect(answer).toBe(a * b);
    }
  });

  it('dzielenie wychodzi całkowite', () => {
    const settings = { tables: [6, 8], withDivision: true };
    for (let seed = 1; seed <= 60; seed++) {
      const { display, answer } = generateTableProblem(settings, seeded(seed));
      if (!display.includes('÷')) continue;
      const [a, b] = display.match(/\d+/g)!.map(Number);
      expect(a % b).toBe(0);
      expect(answer).toBe(a / b);
    }
  });

  it('większy iloczyn to więcej punktów', () => {
    const small = generateTableProblem({ tables: [2], withDivision: false }, seeded(1));
    const big = generateTableProblem({ tables: [9], withDivision: false }, seeded(1));
    expect(big.points).toBeGreaterThanOrEqual(small.points);
  });

  it('naprawia ustawienia z pamięci', () => {
    expect(sanitizeTables(null)).toEqual(DEFAULT_TABLE_SETTINGS);
    expect(sanitizeTables({ tables: [], withDivision: 'tak' })).toEqual(DEFAULT_TABLE_SETTINGS);
    expect(sanitizeTables({ tables: [3, 99, 7], withDivision: true })).toEqual({
      tables: [3, 7],
      withDivision: true,
    });
  });
});
