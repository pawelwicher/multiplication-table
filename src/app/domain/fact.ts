/**
 * Model faktu mnożenia — fundament całej domeny.
 *
 * Ten plik, jak cały katalog `domain/`, jest czystym TypeScriptem:
 * zero importów z `@angular/*`, zero DOM, zero I/O, zero `Date.now()`.
 * Czas zawsze wpływa z zewnątrz jako argument.
 */

/** Najmniejszy czynnik w tabliczce. */
export const MIN_FACTOR = 1;

/** Największy czynnik w tabliczce. */
export const MAX_FACTOR = 10;

/**
 * Czynniki, które dziecko liczy odruchowo — dopisanie zera, podwojenie,
 * połowa dziesiątki, mnożenie przez jeden. Fakt z takim czynnikiem wchodzi
 * do gry, ale nie liczy się do paska postępu.
 */
export const TRIVIAL_FACTORS: readonly number[] = [1, 2, 5, 10];

/** Ile ostatnich czasów odpowiedzi trzymamy w `Fact.recentTimes`. */
export const RECENT_TIMES_WINDOW = 5;

/** Wszystkich unikalnych faktów `a <= b` w zakresie 1–10. */
export const TOTAL_FACT_COUNT = 55;

/** Faktów nietrywialnych — to jest miara „ile jeszcze zostało do opanowania". */
export const TRACKED_FACT_COUNT = 21;

/** Klucz znormalizowany: zawsze mniejszy czynnik pierwszy. `7×8` i `8×7` to jeden fakt. */
export type FactKey = `${number}x${number}`;

/** 0 nieznany · 1 poznany · 2 znany · 3 płynny · 4 zautomatyzowany */
export type Mastery = 0 | 1 | 2 | 3 | 4;

/** Pudełko Leitnera; wyższe = rzadsza powtórka. */
export type LeitnerBox = 1 | 2 | 3 | 4 | 5;

export interface Fact {
  /** Mniejszy czynnik. Zawsze `a <= b`. */
  readonly a: number;
  /** Większy czynnik. */
  readonly b: number;
  /** Czy fakt jest trywialny (czynnik 1, 2, 5 lub 10). Wynika z `a` i `b`, więc jest niezmienny. */
  readonly trivial: boolean;
  box: LeitnerBox;
  mastery: Mastery;
  /** Ostatnie `RECENT_TIMES_WINDOW` czasów odpowiedzi w ms, od najstarszego. */
  recentTimes: number[];
  /** Timestamp (ms) — fakt jest zaległy, gdy `dueAt <= now`. */
  dueAt: number;
  streak: number;
  lapses: number;
}

export interface AnswerEvent {
  readonly key: FactKey;
  readonly correct: boolean;
  readonly elapsedMs: number;
  /** `true`, gdy w momencie odpowiedzi na ekranie był więcej niż jeden kafelek. */
  readonly noisy: boolean;
}

function assertFactor(value: number, label: string): void {
  if (!Number.isInteger(value) || value < MIN_FACTOR || value > MAX_FACTOR) {
    throw new RangeError(
      `${label} musi być liczbą całkowitą z zakresu ${MIN_FACTOR}–${MAX_FACTOR}, otrzymano: ${value}`,
    );
  }
}

/** Czy liczba jest dopuszczalnym czynnikiem tabliczki. */
export function isFactor(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_FACTOR && value <= MAX_FACTOR;
}

/**
 * Klucz faktu, znormalizowany — kolejność czynników nie ma znaczenia.
 * `factKey(8, 7) === factKey(7, 8) === '7x8'`
 */
export function factKey(a: number, b: number): FactKey {
  assertFactor(a, 'a');
  assertFactor(b, 'b');
  return a <= b ? `${a}x${b}` : `${b}x${a}`;
}

/** Czy string jest poprawnym, znormalizowanym kluczem faktu. */
export function isFactKey(value: string): value is FactKey {
  const parts = value.split('x');
  if (parts.length !== 2) {
    return false;
  }
  const [rawA, rawB] = parts as [string, string];
  // Klucz musi być kanoniczny: `Number` wybaczyłby '07', ' 7' czy '7e0',
  // a wtedy jeden fakt miałby kilka kluczy — i docelowo kilka wierszy w bazie.
  const canonical = /^[1-9]\d*$/;
  if (!canonical.test(rawA) || !canonical.test(rawB)) {
    return false;
  }
  const a = Number(rawA);
  const b = Number(rawB);
  return isFactor(a) && isFactor(b) && a <= b;
}

/** Rozbiera klucz na czynniki. Rzuca, gdy klucz jest niepoprawny lub nieznormalizowany. */
export function parseFactKey(key: string): { readonly a: number; readonly b: number } {
  if (!isFactKey(key)) {
    throw new RangeError(`Niepoprawny klucz faktu: ${JSON.stringify(key)}`);
  }
  const [rawA, rawB] = key.split('x') as [string, string];
  return { a: Number(rawA), b: Number(rawB) };
}

/** Czy fakt jest trywialny — ma czynnik 1, 2, 5 lub 10. */
export function isTrivial(a: number, b: number): boolean {
  return TRIVIAL_FACTORS.includes(a) || TRIVIAL_FACTORS.includes(b);
}

/** Wynik działania. Jedyne miejsce, w którym mnożymy. */
export function productOf(a: number, b: number): number {
  return a * b;
}

/** Wynik działania dla faktu. */
export function factProduct(fact: Fact): number {
  return productOf(fact.a, fact.b);
}

/** Klucz faktu. */
export function keyOf(fact: Fact): FactKey {
  return factKey(fact.a, fact.b);
}

/** Świeży, nieuczony fakt. `dueAt: 0` znaczy „zaległy od zawsze". */
export function createFact(a: number, b: number): Fact {
  assertFactor(a, 'a');
  assertFactor(b, 'b');
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return {
    a: lo,
    b: hi,
    trivial: isTrivial(lo, hi),
    box: 1,
    mastery: 0,
    recentTimes: [],
    dueAt: 0,
    streak: 0,
    lapses: 0,
  };
}

/**
 * Pełny zbiór 55 faktów, posortowany po `a`, potem po `b`.
 * Każde wywołanie zwraca nowe, niezależne obiekty — `Fact` jest mutowalny.
 */
export function allFacts(): Fact[] {
  const facts: Fact[] = [];
  for (let a = MIN_FACTOR; a <= MAX_FACTOR; a++) {
    for (let b = a; b <= MAX_FACTOR; b++) {
      facts.push(createFact(a, b));
    }
  }
  return facts;
}
