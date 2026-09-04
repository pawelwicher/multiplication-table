/**
 * Wybór następnego faktu do pokazania.
 *
 * Losowość wpływa argumentem (`Rng`), tak samo jak czas — dzięki temu cała
 * logika wyboru jest deterministyczna w testach i nie zna `Math.random`.
 */

import { keyOf, type Fact, type FactKey, type Mastery } from './fact';
import { isDue } from './mastery';

/** Generator liczb z przedziału [0, 1). */
export type Rng = () => number;

/** Jaka część losowań idzie z listy zaległych. Reszta to powtórka rzeczy dobrze znanych. */
export const DUE_SHARE = 0.7;

/** Do powtórki „żeby nie wygasło" bierzemy fakty co najmniej płynne. */
export const REVIEW_MIN_MASTERY: Mastery = 3;

/**
 * Z ilu najbardziej zaległych faktów losujemy.
 *
 * Samo `due[0]` dałoby sesję w kółko na tym samym fakcie — świeży zbiór ma
 * wszystkie `dueAt: 0`, więc sortowanie nie rozstrzyga niczego.
 */
export const DUE_WINDOW = 5;

export interface NextFactQuery {
  readonly now: number;
  readonly rng: Rng;
  /** Klucze do pominięcia — zestaw roboczy podaje tu to, co już ma. */
  readonly excludeKeys?: readonly FactKey[];
  /** Zawężenie puli, np. do wybranego progu trudności. */
  readonly eligible?: (fact: Fact) => boolean;
}

function pickRandom<T>(items: readonly T[], rng: Rng): T {
  const index = Math.min(items.length - 1, Math.floor(rng() * items.length));
  return items[index] as T;
}

/** Zaległe fakty, od najdłużej czekających. Remisy rozstrzyga klucz, żeby wynik był stabilny. */
export function dueFacts(facts: readonly Fact[], now: number): Fact[] {
  return facts
    .filter((fact) => isDue(fact, now))
    .sort((x, y) => x.dueAt - y.dueAt || keyOf(x).localeCompare(keyOf(y)));
}

/**
 * Następny fakt albo `null`, gdy nic nie przechodzi przez filtry.
 *
 * `null` jest normalnym wynikiem, nie błędem: przy wąskim progu trudności
 * i pełnym zestawie roboczym może po prostu nie być czego dobrać.
 */
export function nextFact(facts: readonly Fact[], query: NextFactQuery): Fact | null {
  const { now, rng, excludeKeys = [], eligible } = query;

  const blocked = new Set<FactKey>(excludeKeys);
  const pool = facts.filter(
    (fact) => (eligible === undefined || eligible(fact)) && !blocked.has(keyOf(fact)),
  );

  if (pool.length === 0) {
    return null;
  }

  const due = dueFacts(pool, now);
  const review = pool.filter((fact) => fact.mastery >= REVIEW_MIN_MASTERY);

  const wantsDue = rng() < DUE_SHARE;
  if (wantsDue && due.length > 0) {
    return pickRandom(due.slice(0, DUE_WINDOW), rng);
  }
  if (!wantsDue && review.length > 0) {
    return pickRandom(review, rng);
  }

  // Jedna z pul była pusta — bierzemy z tej, która została.
  if (due.length > 0) {
    return pickRandom(due.slice(0, DUE_WINDOW), rng);
  }
  if (review.length > 0) {
    return pickRandom(review, rng);
  }
  return pickRandom(pool, rng);
}
