import { describe, expect, it } from 'vitest';
import {
  bin,
  countLeaves,
  evaluate,
  format,
  hasParens,
  hasUnknown,
  num,
  numbers,
  operatorList,
  replaceNumberWithUnknown,
  tryEvaluate,
} from './expression';

describe('evaluate', () => {
  it('liczy zgodnie z kolejnością działań', () => {
    // 5 + 3 × 2
    const expr = bin('+', num(5), bin('*', num(3), num(2)));
    expect(evaluate(expr)).toBe(11);
  });

  it('dzieli tylko całkowicie', () => {
    expect(evaluate(bin('/', num(12), num(3)))).toBe(4);
    expect(tryEvaluate(bin('/', num(7), num(2)))).toBeNull();
    expect(tryEvaluate(bin('/', num(7), num(0)))).toBeNull();
  });

  it('podstawia niewiadomą', () => {
    const expr = bin('+', { kind: 'unknown' }, num(5));
    expect(evaluate(expr, 4)).toBe(9);
    expect(tryEvaluate(expr)).toBeNull();
  });
});

describe('format', () => {
  it('nie dokłada zbędnych nawiasów', () => {
    const expr = bin('+', num(5), bin('*', num(3), num(2)));
    expect(format(expr)).toBe('5 + 3 × 2');
  });

  it('nawiasuje sumę użytą jako czynnik', () => {
    const expr = bin('*', bin('+', num(2), num(3)), num(4));
    expect(format(expr)).toBe('(2 + 3) × 4');
    expect(hasParens(expr)).toBe(true);
  });

  it('nawiasuje odjemnik będący sumą', () => {
    const expr = bin('-', num(10), bin('+', num(3), num(2)));
    expect(format(expr)).toBe('10 − (3 + 2)');
    expect(evaluate(expr)).toBe(5);
  });

  it('nie nawiasuje lewostronnego łańcucha', () => {
    const expr = bin('-', bin('-', num(10), num(3)), num(2));
    expect(format(expr)).toBe('10 − 3 − 2');
    expect(hasParens(expr)).toBe(false);
  });

  it('pisze niewiadomą jako x', () => {
    expect(format(bin('+', { kind: 'unknown' }, num(5)))).toBe('x + 5');
  });
});

describe('obchodzenie drzewa', () => {
  const expr = bin('-', bin('+', num(5), num(3)), bin('*', num(2), num(4)));

  it('zlicza liczby i operatory', () => {
    expect(countLeaves(expr)).toBe(4);
    expect(numbers(expr)).toEqual([5, 3, 2, 4]);
    expect(operatorList(expr).sort()).toEqual(['*', '+', '-']);
  });

  it('zamienia wskazaną liczbę na x', () => {
    const open = replaceNumberWithUnknown(expr, 2);
    expect(format(open)).toBe('5 + 3 − x × 4');
    expect(hasUnknown(open)).toBe(true);
    expect(evaluate(open, 2)).toBe(0);
  });
});
