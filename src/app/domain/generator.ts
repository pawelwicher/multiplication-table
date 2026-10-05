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
import { Rng, pick, randInt, seeded } from './random';
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

/** Największy wynik — także pośredni. Tyle mieści klawiatura: cztery cyfry. */
export const MAX_RESULT = 9999;

interface Ctx {
  readonly min: number;
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

interface Slot {
  readonly leaves: number;
  /** Nawias po minusie: a − (b + c). Ma sens także bez mnożenia. */
  readonly grouped: boolean;
}

const MAX_ATTEMPTS = 400;

function ctxOf(settings: Settings, rng: Rng): Ctx {
  const has = (id: OperationId) => settings.operations.includes(id);
  return {
    min: settings.min,
    max: settings.max,
    add: has('add'),
    sub: has('sub'),
    mul: has('mul'),
    div: has('div'),
    paren: has('paren'),
    rng,
  };
}

/** Liczba z zakresu kryteriów, dodatkowo przycięta do `lo..hi`. */
function operand(ctx: Ctx, lo: number, hi: number): number | null {
  const bottom = Math.max(ctx.min, lo);
  const top = Math.min(ctx.max, hi);
  return top < bottom ? null : randInt(ctx.rng, bottom, top);
}

/** Najmniejszy dzielnik — dzielenie przez 1 niczego nie uczy. */
function smallestDivisor(ctx: Ctx): number {
  return Math.max(2, ctx.min);
}

/**
 * Łańcuch mnożeń i dzieleń, np. „56 ÷ 7 × 3”, o wartości najwyżej `cap`.
 * Dzielnik i iloraz są z zakresu, a dzielna z nich wynika — jak w tabliczce
 * mnożenia: 56 ÷ 7 to odwrotność 8 × 7. Dzięki temu dzielenie zawsze wychodzi
 * całkowicie, a przy zakresie 2–10 nie kończy się na samym 8 ÷ 2.
 */
function buildProduct(leaves: number, ctx: Ctx, allowParen: boolean, cap: number): Built | null {
  const available: ('*' | '/')[] = [];
  if (ctx.mul) available.push('*');
  if (ctx.div) available.push('/');
  if (available.length === 0) return null;

  // Ile liczb trafia do nawiasu stojącego w roli pierwszego czynnika.
  // Nawias potrzebuje plusa albo minusa — „(3 × 4) × 2” niczego nie uczy.
  let parenLeaves = 0;
  if (allowParen && (ctx.add || ctx.sub) && leaves >= 3) {
    parenLeaves = Math.min(randInt(ctx.rng, 2, 3), leaves - 1);
  }
  const factors = leaves - parenLeaves + (parenLeaves > 0 ? 1 : 0);
  if (factors < 2) return null;
  const ops = Array.from({ length: factors - 1 }, () => pick(ctx.rng, available));

  let expr: Expr;
  let value: number;
  let from = 0;
  if (parenLeaves > 0) {
    // Nawias równy 1 robi z mnożenia i dzielenia formalność.
    const group = buildGroup(parenLeaves, ctx, 2);
    if (!group) return null;
    expr = group.expr;
    value = group.value;
  } else {
    // Dzielenia tuż na początku: pierwsza liczba to iloraz razy wszystkie te dzielniki.
    while (from < ops.length && ops[from] === '/') from++;
    const quotient = operand(ctx, 1, Math.floor(MAX_RESULT / smallestDivisor(ctx) ** from));
    if (quotient === null) return null;
    const divisors = budgetFactors(from, Math.floor(MAX_RESULT / quotient), ctx);
    if (!divisors) return null;
    const first = divisors.reduce((acc, d) => acc * d, quotient);
    expr = num(first);
    value = first;
    for (const divisor of divisors) {
      expr = bin('/', expr, num(divisor));
      value /= divisor;
    }
  }

  for (let i = from; i < ops.length; i++) {
    if (ops[i] === '*') {
      // Bez dzielenia przed końcem łańcucha iloczyn od razu musi zmieścić się w `cap`.
      const limit = ops.slice(i + 1).includes('/') ? MAX_RESULT : cap;
      // Zostaw miejsce na kolejne mnożenia — każde co najmniej przez dolną granicę zakresu.
      const later = ops.slice(i + 1).filter((op) => op === '*').length;
      const factor = operand(ctx, 1, Math.floor(limit / (value * ctx.min ** later)));
      if (factor === null) return null;
      expr = bin('*', expr, num(factor));
      value *= factor;
    } else {
      const divisors = divisorsOf(value, ctx);
      if (divisors.length === 0) return null;
      const divisor = pick(ctx.rng, divisors);
      expr = bin('/', expr, num(divisor));
      value /= divisor;
    }
  }
  return value <= cap ? { expr, value } : null;
}

/**
 * `count` dzielników z zakresu, których iloczyn mieści się w budżecie. Gdy budżet
 * się kończy, reszta to 1 — o ile zakres zaczyna się od 1; inaczej się nie da.
 */
function budgetFactors(count: number, budget: number, ctx: Ctx): number[] | null {
  const factors = Array.from({ length: count }, () => 1);
  const smallest = smallestDivisor(ctx);
  let left = budget;
  let remaining = count;
  for (const index of shuffle(
    Array.from({ length: count }, (_, i) => i),
    ctx.rng,
  )) {
    remaining--;
    const factor = operand(ctx, 2, Math.floor(left / smallest ** remaining));
    if (factor === null) {
      if (ctx.min > 1) return null;
      continue;
    }
    factors[index] = factor;
    left = Math.floor(left / factor);
  }
  return factors;
}

/** Dzielniki `value` z zakresu, od 2 wzwyż. */
function divisorsOf(value: number, ctx: Ctx): number[] {
  const result: number[] = [];
  for (let d = smallestDivisor(ctx); d <= Math.min(ctx.max, value); d++) {
    if (value % d === 0) result.push(d);
  }
  return result;
}

/** Nawias z samych plusów i minusów, np. „(7 − 3)”. Wartość co najmniej `minValue`. */
function buildGroup(leaves: number, ctx: Ctx, minValue = 1): Built | null {
  const slots = Array.from({ length: leaves }, () => ({ leaves: 1, grouped: false }));
  return buildSum(slots, ctx, false, minValue);
}

/** Pojedynczy składnik sumy: liczba z zakresu albo łańcuch mnożeń i dzieleń. */
function buildTerm(slot: Slot, ctx: Ctx, allowParen: boolean, lo: number, hi: number): Built | null {
  if (slot.leaves === 1) {
    const value = operand(ctx, lo, hi);
    return value === null ? null : { expr: num(value), value };
  }
  const term = buildProduct(slot.leaves, ctx, allowParen, hi);
  return term && term.value >= lo ? term : null;
}

/** Najmniejsza wartość składnika — tyle trzeba mu zostawić przy samym odejmowaniu. */
function minValue(slot: Slot, ctx: Ctx): number {
  return slot.grouped ? slot.leaves * ctx.min : ctx.min;
}

/** Górna granica składnika, żeby pierwsze liczby nie zjadły całego miejsca na resztę. */
function fairShare(room: number, laterCount: number): number {
  return Math.min(room, Math.max(1, Math.ceil((2 * (room + laterCount)) / (laterCount + 1))));
}

/**
 * Suma składników budowana od lewej. Po każdym kroku wynik jest całkowity,
 * nieujemny i nie większy niż MAX_RESULT; na końcu co najmniej `minResult`.
 */
function buildSum(slots: Slot[], ctx: Ctx, allowParen: boolean, minResult: number): Built | null {
  if (!ctx.add && slots.every((s) => s.leaves === 1 && !s.grouped)) {
    return minusChain(slots.length, ctx, minResult);
  }
  let expr: Expr | null = null;
  let value = 0;
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const later = slots.slice(i + 1);
    const last = later.length === 0;
    // Przy samym odejmowaniu każdy krok zostawia miejsce na kolejne odejmowania.
    const reserve = later.reduce((sum, s) => sum + minValue(s, ctx), 0) + minResult;

    if (expr === null) {
      // Sam minus: pierwsza liczba z górnej połowy zakresu, inaczej wszystko kończy się na zerze.
      const lo = ctx.add
        ? Math.max(1, last ? minResult : 1)
        : Math.min(ctx.max, Math.max(1, reserve, Math.ceil(ctx.max / 2)));
      const term = buildTerm(slot, ctx, allowParen, lo, MAX_RESULT);
      if (!term) return null;
      expr = term.expr;
      value = term.value;
      continue;
    }

    const plusRoom = MAX_RESULT - value;
    const minusRoom = value - (ctx.add && !last ? 0 : reserve);

    if (slot.grouped) {
      if (!ctx.sub || minusRoom < minValue(slot, ctx)) return null;
      const group = buildGroup(slot.leaves, ctx);
      if (!group || group.value > minusRoom) return null;
      expr = bin('-', expr, group.expr);
      value -= group.value;
      continue;
    }

    const need = minValue(slot, ctx);
    const ops: ('+' | '-')[] = [];
    if (ctx.add && plusRoom >= need) ops.push('+');
    if (ctx.sub && minusRoom >= need) ops.push('-');
    if (ops.length === 0) return null;
    const op = pick(ctx.rng, ops);
    const hi = op === '+' ? plusRoom : ctx.add ? minusRoom : fairShare(minusRoom, later.length);

    const term = buildTerm(slot, ctx, allowParen, 1, hi);
    if (!term) return null;
    expr = bin(op, expr, term.expr);
    value = op === '+' ? value + term.value : value - term.value;
  }
  return expr === null || value < minResult ? null : { expr, value };
}

/**
 * Same odejmowania: „17 − 4 − 6”. Najpierw wynik, potem rozkład różnicy na
 * odjemniki — losowane po kolei zjeżdżały prawie zawsze do zera.
 */
function minusChain(leaves: number, ctx: Ctx, minResult: number): Built | null {
  const subtrahends = leaves - 1;
  const lowest = subtrahends * ctx.min + minResult;
  const first = operand(ctx, Math.max(lowest, Math.ceil(ctx.max / 2)), ctx.max);
  if (first === null) return null;
  const result = randInt(ctx.rng, minResult, first - subtrahends * ctx.min);
  // Każdy odjemnik dostaje dolną granicę zakresu, a nadwyżka rozkłada się po równo.
  const extra = first - result - subtrahends * ctx.min;
  let expr = num(first);
  for (const part of splitPositive(extra + subtrahends, subtrahends, ctx.rng)) {
    expr = bin('-', expr, num(part - 1 + ctx.min));
  }
  return { expr, value: result };
}

/** Rozkłada `total` na `parts` dodatnich liczb, mniej więcej po równo. */
function splitPositive(total: number, parts: number, rng: Rng): number[] {
  let rest = total;
  const values: number[] = [];
  for (let i = 0; i < parts - 1; i++) {
    const left = parts - 1 - i;
    const fair = Math.max(1, Math.ceil((rest - left) / (parts - i)) * 2);
    const value = randInt(rng, 1, Math.min(rest - left, fair));
    values.push(value);
    rest -= value;
  }
  values.push(rest);
  return values;
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
    const value = operand(ctx, 1, ctx.max);
    return value === null ? null : { expr: num(value), value };
  }
  if (!ctx.add && !ctx.sub) return buildProduct(leaves, ctx, ctx.paren, MAX_RESULT);
  return buildSum(planSlots(leaves, ctx), ctx, ctx.paren && (ctx.mul || ctx.div), 0);
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

/** Jedna próba ułożenia zadania; null, gdy losowanie się nie złożyło. */
function attempt(settings: Settings, ctx: Ctx): Problem | null {
  const built = buildExpression(settings.terms, ctx);
  if (!built) return null;
  if (countLeaves(built.expr) !== settings.terms) return null;
  const value = tryEvaluate(built.expr);
  if (value === null || value !== built.value || value < 0 || value > MAX_RESULT) return null;

  if (settings.operations.includes('unknown')) {
    // x zastępuje liczbę z zakresu — nie dzielną, która wynika z działania.
    const candidates = numbers(built.expr)
      .map((n, i) => ({ n, i }))
      .filter(({ n }) => n >= ctx.min && n <= ctx.max);
    if (candidates.length === 0) return null;
    const { n: answer, i: index } = pick(ctx.rng, candidates);
    const open = replaceNumberWithUnknown(built.expr, index);
    if (!solvesUniquely(open, value, answer, ctx.max)) return null;
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

export function generateProblem(settings: Settings, rng: Rng): Problem {
  const ctx = ctxOf(settings, rng);
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const problem = attempt(settings, ctx);
    if (problem) return problem;
  }
  return fallback(ctx);
}

/**
 * Czy z takich kryteriów da się ułożyć działanie — np. 5 mnożeń liczb od 20 wzwyż
 * nie zmieści się w MAX_RESULT. Deterministyczne, żeby podpowiedź nie migała.
 */
export function canGenerate(settings: Settings): boolean {
  const ctx = ctxOf(settings, seeded(1));
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    if (attempt(settings, ctx)) return true;
  }
  return false;
}

/** Gdy losowanie nie dowiozło — proste działanie z wybranych operacji. */
function fallback(ctx: Ctx): Problem {
  const chosen = (['+', '-', '*', '/'] as const).filter(
    (_, i) => [ctx.add, ctx.sub, ctx.mul, ctx.div][i],
  );
  const op = chosen.length > 0 ? pick(ctx.rng, chosen) : '+';
  const a = randInt(ctx.rng, ctx.min, ctx.max);
  const b = randInt(ctx.rng, ctx.min, ctx.max);
  const expr =
    op === '/'
      ? bin('/', num(a * b), num(b))
      : op === '-'
        ? bin('-', num(Math.max(a, b)), num(Math.min(a, b)))
        : bin(op, num(a), num(b));
  const value = evaluate(expr);
  return { display: format(expr), asks: 'result', answer: value, points: pointsFor(expr, ctx.max) };
}
