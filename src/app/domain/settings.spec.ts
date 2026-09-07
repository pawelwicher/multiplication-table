import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, clampTerms, isValid, sanitize } from './settings';
import { starsFor, streakMultiplier } from './scoring';

describe('sanitize', () => {
  it('przyjmuje poprawne ustawienia', () => {
    const settings = { max: 50, operations: ['mul', 'div'], terms: 4 };
    expect(sanitize(settings)).toEqual(settings);
  });

  it('odrzuca zakres i operacje spoza listy', () => {
    const result = sanitize({ max: 37, operations: ['add', 'pierwiastek'], terms: 3 });
    expect(result.max).toBe(DEFAULT_SETTINGS.max);
    expect(result.operations).toEqual(['add']);
  });

  it('wraca do domyślnych, gdy nie wybrano żadnego działania', () => {
    const result = sanitize({ max: 20, operations: ['paren', 'unknown'], terms: 3 });
    expect(result.operations).toEqual(DEFAULT_SETTINGS.operations);
  });

  it('przycina liczbę składników', () => {
    expect(clampTerms(0)).toBe(2);
    expect(clampTerms(99)).toBe(10);
    expect(clampTerms(Number.NaN)).toBe(DEFAULT_SETTINGS.terms);
  });

  it('wymaga działania arytmetycznego', () => {
    expect(isValid({ max: 20, operations: ['unknown'], terms: 3 })).toBe(false);
    expect(isValid({ max: 20, operations: ['unknown', 'add'], terms: 3 })).toBe(true);
  });
});

describe('punktacja', () => {
  it('mnożnik serii rośnie co pięć trafień i zatrzymuje się na 2×', () => {
    expect(streakMultiplier(0)).toBe(1);
    expect(streakMultiplier(5)).toBe(1.25);
    expect(streakMultiplier(20)).toBe(2);
    expect(streakMultiplier(100)).toBe(2);
  });

  it('gwiazdki zależą od skuteczności', () => {
    expect(starsFor(0, 0)).toBe(0);
    expect(starsFor(10, 0)).toBe(3);
    expect(starsFor(8, 2)).toBe(2);
    expect(starsFor(1, 9)).toBe(0);
  });
});
