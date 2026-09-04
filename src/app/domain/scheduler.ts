/**
 * Wybór następnego faktu do pokazania.
 *
 * Losowość wpływa argumentem (`Rng`), tak samo jak czas — dzięki temu cała
 * logika wyboru jest deterministyczna w testach i nie zna `Math.random`.
 */

import { factProduct, keyOf, type Fact, type FactKey, type Mastery } from './fact';
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
  /** Fakty aktualnie na ekranie — blokują swój klucz i swój wynik. */
  readonly onScreen?: readonly Fact[];
  /** Ostatnio pokazany fakt — blokuje swój klucz, żeby nie wypadł dwa razy pod rząd. */
  readonly lastKey?: FactKey | null;
  /**
   * Klucze do pominięcia bez blokowania ich wyników. Tryb spokojny trzyma tak
   * swój zestaw roboczy: te fakty już ma, chce dobrać coś spoza niego.
   */
  readonly excludeKeys?: readonly FactKey[];
  /** Zawężenie puli, np. wymóg `mastery >= 2` w arcade. */
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
 * `null` jest normalnym wynikiem, nie błędem: przy dwóch kafelkach na ekranie
 * i wąskiej puli może po prostu nie być czego pokazać.
 */
export function nextFact(facts: readonly Fact[], query: NextFactQuery): Fact | null {
  const { now, rng, onScreen = [], lastKey = null, excludeKeys = [], eligible } = query;

  const blockedKeys = new Set<FactKey>(onScreen.map(keyOf));
  for (const key of excludeKeys) {
    blockedKeys.add(key);
  }
  if (lastKey !== null) {
    blockedKeys.add(lastKey);
  }
  // Dwa kafelki z tym samym wynikiem (4x6 i 3x8) są nierozstrzygalne dla gracza:
  // wpisuje 24 i nie wie, który zniknie.
  const blockedProducts = new Set<number>(onScreen.map(factProduct));

  const pool = facts.filter(
    (fact) =>
      (eligible === undefined || eligible(fact)) &&
      !blockedKeys.has(keyOf(fact)) &&
      !blockedProducts.has(factProduct(fact)),
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
