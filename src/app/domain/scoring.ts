import { Expr, hasParens, hasUnknown, operatorList, Op } from './expression';

const OP_WEIGHT: Readonly<Record<Op, number>> = { '+': 1, '-': 1.4, '*': 2.2, '/': 2.8 };

/** Im więcej i trudniejszych operacji oraz im większy zakres, tym wyżej. */
export function difficultyOf(expr: Expr, max: number): number {
  const ops = operatorList(expr).reduce((sum, op) => sum + OP_WEIGHT[op], 0);
  const parens = hasParens(expr) ? 2.5 : 0;
  const unknown = hasUnknown(expr) ? 3 : 0;
  const range = max / 40;
  return ops + parens + unknown + range;
}

export function pointsFor(expr: Expr, max: number): number {
  return Math.max(1, Math.round(difficultyOf(expr, max) * 1.2));
}

/** Seria poprawnych odpowiedzi podbija zdobycz: 1× ... 2×, co piąta odpowiedź o 0,25. */
export function streakMultiplier(streak: number): number {
  return Math.min(2, 1 + Math.floor(Math.max(0, streak) / 5) * 0.25);
}

export function awardFor(points: number, streak: number): number {
  return Math.round(points * streakMultiplier(streak));
}

/** Gwiazdki 0–3 dla podsumowania sesji. */
export function starsFor(correct: number, wrong: number): number {
  const total = correct + wrong;
  if (total === 0) return 0;
  const ratio = correct / total;
  if (ratio >= 0.9) return 3;
  if (ratio >= 0.7) return 2;
  if (ratio >= 0.5) return 1;
  return 0;
}
