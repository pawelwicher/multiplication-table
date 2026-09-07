import {
  Expr,
  bin,
  countLeaves,
  evaluate,
  format,
  num,
  numbers,
  replaceNumberWithUnknown,
  tryEvaluate,
} from './expression';
import { Rng, pick, randInt } from './random';
import { pointsFor } from './scoring';
import { OperationId, Settings } from './settings';

export interface Problem {
  /** Pełny zapis, np. „5 + 3 × 2” albo „5 + x × 2 = 11”. */
  readonly display: string;
  /** Czego szukamy: wyniku działania czy niewiadomej. */
  readonly asks: 'result' | 'x';
  readonly answer: number;
  readonly points: number;
}

interface Ctx {
  readonly max: number;
  readonly add: boolean;
  readonly sub: boolean;
  readonly mul: boolean;
  readonly div: boolean;
  readonly paren: boolean;
  readonly rng: Rng;
}

interface Built {
  readonly expr: Expr;
  readonly value: number;
}

const MAX_ATTEMPTS = 400;
const BIGGEST_FACTOR = 5;

function ctxOf(settings: Settings, rng: Rng): Ctx {
  const has = (id: OperationId) => settings.operations.includes(id);
  return {
    max: settings.max,
    add: has('add'),
    sub: has('sub'),
    mul: has('mul'),
    div: has('div'),
    paren: has('paren'),
    rng,
  };
}

/** Rozkłada `total` na `parts` dodatnich składników połączonych plusem. */
function plusChain(total: number, parts: number, ctx: Ctx): Built | null {
  if (!ctx.add && parts > 1) return null;
  if (total < parts || total > ctx.max) return null;
  if (parts === 1) return { expr: num(total), value: total };

  let rest = total;
  const values: number[] = [];
  for (let i = 0; i < parts - 1; i++) {
    const left = parts - 1 - i;
    const fair = Math.max(1, Math.ceil((rest - left) / (parts - i)) * 2);
    const value = randInt(ctx.rng, 1, Math.min(rest - left, fair));
    values.push(value);
    rest -= value;
  }
  values.push(rest);

  let expr = num(values[0]);
  for (let i = 1; i < values.length; i++) expr = bin('+', expr, num(values[i]));
  return { expr, value: total };
}

/**
 * Suma o z góry zadanej wartości, rozbita na `leaves` liczb.
 * Każda część jest dodatnia, a każdy wynik częściowy mieści się w zakresie.
 */
function sumTo(target: number, leaves: number, ctx: Ctx): Built | null {
  if (leaves < 1 || target < 1 || target > ctx.max) return null;
  if (leaves === 1) return { expr: num(target), value: target };

  // Wariant z odejmowaniem: (a + b − c). Dodatnie części sumują się do target + c.
  if (ctx.sub && ctx.add && leaves >= 3 && target < ctx.max && ctx.rng() < 0.4) {
    const c = randInt(ctx.rng, 1, ctx.max - target);
    const plus = plusChain(target + c, leaves - 1, ctx);
    if (plus) return { expr: bin('-', plus.expr, num(c)), value: target };
  }
  return plusChain(target, leaves, ctx);
}

/**
 * Łańcuch mnożeń i dzieleń, np. „12 ÷ 3 × 4”.
 * Pierwszy czynnik jest wielokrotnością wszystkich dzielników, więc każdy wynik
 * pośredni wychodzi całkowity — bez tego dzielenie sypałoby ułamkami.
 */
function buildProduct(leaves: number, ctx: Ctx, allowParen: boolean): Built | null {
  const available: ('*' | '/')[] = [];
  if (ctx.mul) available.push('*');
  if (ctx.div) available.push('/');
  if (available.length === 0) return null;

  // Ile liczb trafia do nawiasu stojącego w roli pierwszego czynnika.
  let parenLeaves = 0;
  if (allowParen && leaves >= 3) {
    parenLeaves = Math.min(randInt(ctx.rng, 2, 3), leaves - 1);
  }
  const factors = leaves - parenLeaves + (parenLeaves > 0 ? 1 : 0);
  if (factors < 2) return null;

  const ops = Array.from({ length: factors - 1 }, () => pick(ctx.rng, available));
  const sizes = ops.map(() => randInt(ctx.rng, 2, BIGGEST_FACTOR));
  const divisor = sizes.reduce((acc, size, i) => (ops[i] === '/' ? acc * size : acc), 1);
  const multiplier = sizes.reduce((acc, size, i) => (ops[i] === '*' ? acc * size : acc), 1);
  if (divisor * multiplier > ctx.max) return null;

  const lowest = divisor === 1 ? 2 : 1;
  const highest = Math.floor(ctx.max / (divisor * multiplier));
  if (highest < lowest) return null;
  const first = randInt(ctx.rng, lowest, highest) * divisor;

  // Gdy nawias się nie składa, pierwszy czynnik zostaje zwykłą liczbą.
  const head = parenLeaves > 0 ? sumTo(first, parenLeaves, ctx) : null;
  let expr = head ? head.expr : num(first);
  let leafCount = head ? parenLeaves : 1;
  let value = first;

  for (let i = 0; i < ops.length; i++) {
    value = ops[i] === '*' ? value * sizes[i] : value / sizes[i];
    expr = bin(ops[i], expr, num(sizes[i]));
    leafCount++;
  }
  return leafCount === leaves ? { expr, value } : null;
}

/** Pojedynczy składnik sumy: liczba albo łańcuch mnożeń i dzieleń. */
function buildTerm(leaves: number, ctx: Ctx, allowParen: boolean): Built | null {
  if (leaves === 1) {
    const value = randInt(ctx.rng, 1, ctx.max);
    return { expr: num(value), value };
  }
  return buildProduct(leaves, ctx, allowParen);
}

/** Rozbicie liczb na składniki sumy. */
function splitTerms(leaves: number, ctx: Ctx): number[] {
  if (!ctx.mul && !ctx.div) return Array.from({ length: leaves }, () => 1);

  const sizes: number[] = [];
  let rest = leaves;
  // Nawias mieszka w składniku o co najmniej trzech liczbach — bez rezerwacji
  // wypadałby zbyt rzadko, żeby dziecko go w ogóle zobaczyło.
  if (ctx.paren && leaves >= 3) {
    sizes.push(3);
    rest -= 3;
  }
  while (rest > 0) {
    const size = Math.min(rest, randInt(ctx.rng, 1, 3));
    sizes.push(size);
    rest -= size;
  }
  return shuffle(sizes, ctx.rng);
}

function shuffle(items: number[], rng: Rng): number[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randInt(rng, 0, i);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

interface Slot {
  readonly leaves: number;
  /** Nawias po minusie: a − (b + c). Ma sens także bez mnożenia. */
  readonly grouped: boolean;
}

function planSlots(leaves: number, ctx: Ctx): Slot[] {
  const sizes = splitTerms(leaves, ctx);
  const slots: Slot[] = sizes.map((size) => ({ leaves: size, grouped: false }));
  const plainSum = !ctx.mul && !ctx.div;
  if (ctx.paren && ctx.sub && plainSum && slots.length >= 3) {
    const at = randInt(ctx.rng, 1, slots.length - 2);
    slots.splice(at, 2, { leaves: 2, grouped: true });
  }
  return slots;
}

function buildExpression(leaves: number, ctx: Ctx): Built | null {
  if (leaves === 1) {
    const value = randInt(ctx.rng, 1, ctx.max);
    return { expr: num(value), value };
  }
  if (!ctx.add && !ctx.sub) return buildTerm(leaves, ctx, ctx.paren);

  const slots = planSlots(leaves, ctx);
  const canMulDiv = ctx.mul || ctx.div;
  let expr: Expr | null = null;
  let value = 0;
  for (const slot of slots) {
    if (slot.grouped && expr !== null && value >= 3) {
      const target = randInt(ctx.rng, 2, Math.min(value, ctx.max));
      const group = plusChain(target, slot.leaves, ctx);
      if (group) {
        expr = bin('-', expr, group.expr);
        value -= target;
        continue;
      }
    }

    const allowParen = ctx.paren && canMulDiv;
    const term = buildTerm(slot.leaves, ctx, allowParen);
    if (!term) return null;
    if (expr === null) {
      if (term.value > ctx.max) return null;
      expr = term.expr;
      value = term.value;
      continue;
    }
    const canPlus = ctx.add && value + term.value <= ctx.max;
    const canMinus = ctx.sub && value - term.value >= 0;
    if (!canPlus && !canMinus) return null;
    const op = canPlus && canMinus ? pick(ctx.rng, ['+', '-'] as const) : canPlus ? '+' : '-';
    expr = bin(op, expr, term.expr);
    value = op === '+' ? value + term.value : value - term.value;
  }

  return expr === null ? null : { expr, value };
}

/** Czy równanie z x ma dokładnie jedno całkowite rozwiązanie w zakresie. */
function solvesUniquely(expr: Expr, target: number, answer: number, max: number): boolean {
  let found = 0;
  for (let x = 0; x <= max; x++) {
    if (tryEvaluate(expr, x) === target) found++;
    if (found > 1) return false;
  }
  return found === 1 && tryEvaluate(expr, answer) === target;
}

export function generateProblem(settings: Settings, rng: Rng): Problem {
  const ctx = ctxOf(settings, rng);
  const wantsUnknown = settings.operations.includes('unknown');

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const built = buildExpression(settings.terms, ctx);
    if (!built) continue;
    if (countLeaves(built.expr) !== settings.terms) continue;
    const value = tryEvaluate(built.expr);
    if (value === null || value !== built.value || value < 0 || value > ctx.max) continue;

    if (wantsUnknown) {
      const leaves = numbers(built.expr);
      const index = randInt(rng, 0, leaves.length - 1);
      const answer = leaves[index];
      const open = replaceNumberWithUnknown(built.expr, index);
      if (!solvesUniquely(open, value, answer, ctx.max)) continue;
      return {
        display: `${format(open)} = ${value}`,
        asks: 'x',
        answer,
        points: pointsFor(open, ctx.max),
      };
    }

    return {
      display: format(built.expr),
      asks: 'result',
      answer: value,
      points: pointsFor(built.expr, ctx.max),
    };
  }

  return fallback(ctx);
}

/** Gdy losowanie nie dowiozło — proste działanie, zawsze poprawne. */
function fallback(ctx: Ctx): Problem {
  const b = randInt(ctx.rng, 1, Math.max(1, Math.floor(ctx.max / 2)));
  const a = randInt(ctx.rng, 1, ctx.max - b);
  const expr = ctx.add ? bin('+', num(a), num(b)) : bin('-', num(a + b), num(b));
  const value = evaluate(expr);
  return { display: format(expr), asks: 'result', answer: value, points: pointsFor(expr, ctx.max) };
}
