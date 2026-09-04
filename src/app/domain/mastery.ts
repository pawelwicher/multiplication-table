/**
 * Poziomy opanowania, progi czasowe i przejścia po odpowiedzi.
 *
 * Wszystko tutaj to czyste funkcje. `applyAnswer` nie mutuje faktu i nie zna
 * bieżącego czasu — `now` wpływa argumentem, żeby testy nie musiały udawać zegara.
 */

import {
  RECENT_TIMES_WINDOW,
  type AnswerEvent,
  type AnswerSample,
  type Fact,
  type LeitnerBox,
  type Mastery,
  keyOf,
} from './fact';

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export const MIN_BOX: LeitnerBox = 1;
export const MAX_BOX: LeitnerBox = 5;

/** Odstęp do następnej powtórki, indeksowany `box - 1`. */
export const BOX_INTERVALS_MS: readonly number[] = [0, 10 * MINUTE_MS, DAY_MS, 3 * DAY_MS, 7 * DAY_MS];

/** Mediana poniżej tego progu oznacza płynność (poziom 3). */
export const FLUENT_MEDIAN_MS = 3000;

/** Mediana czystych pomiarów poniżej tego progu oznacza automatyzację (poziom 4). */
export const AUTOMATIC_MEDIAN_MS = 2000;

/** Poziom 2 („znany") wymaga tylu poprawnych z rzędu. */
export const KNOWN_MIN_STREAK = 2;

/** Poziomy 3 i 4 wymagają tylu poprawnych z rzędu. */
export const FLUENT_MIN_STREAK = 3;

/** Tylu pomiarów wymagamy, zanim mediana zacznie cokolwiek znaczyć. */
export const MIN_SAMPLES = 3;

/** Od tego poziomu fakt wpuszczamy do arcade — presja czasu nie służy nauce nowego materiału. */
export const ARCADE_MIN_MASTERY: Mastery = 2;

/**
 * Mediana, nie średnia — jeden przypadkowy zawis nie może przekreślić serii
 * dobrych odpowiedzi. Zwraca `null` dla pustego zbioru.
 */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((x, y) => x - y);
  const mid = sorted.length >> 1;
  if (sorted.length % 2 === 1) {
    return sorted[mid] as number;
  }
  return ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

/** Mediana ograniczona do pomiarów z jednym kafelkiem na ekranie. */
function medianOf(samples: readonly AnswerSample[], onlyClean: boolean): number | null {
  const values = samples.filter((s) => !onlyClean || !s.noisy).map((s) => s.ms);
  return values.length >= MIN_SAMPLES ? median(values) : null;
}

/**
 * Poziom, na który statystyki faktu *zasługują* — bez ograniczenia „krok po kroku".
 * Nie schodzi do zera, gdy jest choć jeden pomiar: raz poznanego faktu nie odpoznajemy.
 */
export function earnedMastery(fact: Fact): Mastery {
  if (fact.recentTimes.length === 0) {
    return 0;
  }
  if (fact.streak < KNOWN_MIN_STREAK) {
    return 1;
  }

  const fastEnough = fact.streak >= FLUENT_MIN_STREAK;
  const overall = medianOf(fact.recentTimes, false);
  const fluent = fastEnough && overall !== null && overall < FLUENT_MEDIAN_MS;
  if (!fluent) {
    return 2;
  }

  // Automatyzację mierzymy wyłącznie na czysto — przy dwóch kafelkach na ekranie
  // czas odpowiedzi mierzy też przeszukiwanie ekranu, nie samo przypomnienie.
  const clean = medianOf(fact.recentTimes, true);
  return clean !== null && clean < AUTOMATIC_MEDIAN_MS ? 4 : 3;
}

/** Ruch o co najwyżej jeden poziom w stronę celu. */
function stepToward(current: Mastery, target: Mastery): Mastery {
  if (target > current) {
    return (current + 1) as Mastery;
  }
  if (target < current) {
    return (current - 1) as Mastery;
  }
  return current;
}

/** Degradacja cofa o jeden poziom i nigdy nie schodzi do zera. */
function demote(current: Mastery): Mastery {
  if (current === 0) {
    return 0;
  }
  return Math.max(1, current - 1) as Mastery;
}

function pushSample(samples: readonly AnswerSample[], sample: AnswerSample): AnswerSample[] {
  return [...samples, sample].slice(-RECENT_TIMES_WINDOW);
}

/** Kiedy fakt z danego pudełka wróci do powtórki. */
export function dueAtForBox(box: LeitnerBox, now: number): number {
  return now + (BOX_INTERVALS_MS[box - 1] as number);
}

/** Czy fakt czeka na powtórkę. */
export function isDue(fact: Fact, now: number): boolean {
  return fact.dueAt <= now;
}

/** Czy fakt wolno wpuścić do arcade. */
export function isArcadeReady(fact: Fact): boolean {
  return fact.mastery >= ARCADE_MIN_MASTERY;
}

/**
 * Przejście po jednej odpowiedzi. Zwraca nowy fakt — wejściowy zostaje nietknięty.
 *
 * Przekroczenie linii w arcade zgłaszamy jako `correct: false`; z punktu widzenia
 * powtórek to ten sam sygnał co zła odpowiedź.
 */
export function applyAnswer(fact: Fact, event: AnswerEvent, now: number): Fact {
  const key = keyOf(fact);
  if (event.key !== key) {
    throw new RangeError(`Odpowiedź dotyczy faktu ${event.key}, a fakt to ${key}`);
  }
  if (!Number.isFinite(now)) {
    throw new RangeError(`now musi być skończoną liczbą, otrzymano: ${now}`);
  }
  if (!Number.isFinite(event.elapsedMs) || event.elapsedMs < 0) {
    throw new RangeError(`elapsedMs musi być nieujemną liczbą, otrzymano: ${event.elapsedMs}`);
  }

  if (!event.correct) {
    // Czasu błędnej odpowiedzi nie zapisujemy — nie mierzy płynności przypomnienia.
    return {
      ...fact,
      box: MIN_BOX,
      streak: 0,
      lapses: fact.lapses + 1,
      recentTimes: [...fact.recentTimes],
      dueAt: dueAtForBox(MIN_BOX, now),
      mastery: demote(fact.mastery),
    };
  }

  const box = Math.min(fact.box + 1, MAX_BOX) as LeitnerBox;
  const advanced: Fact = {
    ...fact,
    box,
    streak: fact.streak + 1,
    recentTimes: pushSample(fact.recentTimes, { ms: event.elapsedMs, noisy: event.noisy }),
    dueAt: dueAtForBox(box, now),
  };

  return { ...advanced, mastery: stepToward(fact.mastery, earnedMastery(advanced)) };
}

/** Ile z 21 nietrywialnych faktów jest już zautomatyzowanych — to jest pasek postępu. */
export function trackedProgress(facts: readonly Fact[]): { readonly automated: number; readonly total: number } {
  const tracked = facts.filter((fact) => !fact.trivial);
  return {
    automated: tracked.filter((fact) => fact.mastery === 4).length,
    total: tracked.length,
  };
}
