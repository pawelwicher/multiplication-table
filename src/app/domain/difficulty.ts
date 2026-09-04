/**
 * Poziomy trudności — zakres wyniku działania.
 *
 * Trudność skalujemy wielkością wyniku, nie liczbą działań: przy „1–20"
 * dziecko widzi tylko działania o wyniku najwyżej 20, więc zaczyna od małych
 * liczb i całej tabliczki jedynki i dwójki. Kolejne progi tylko dokładają.
 */

import { factProduct, type Fact } from './fact';

export const DIFFICULTIES = [20, 30, 40, 50, 60, 70, 80, 90, 100] as const;

export type Difficulty = (typeof DIFFICULTIES)[number];

/** Najniższy próg — z niego zaczyna ktoś, kto pierwszy raz otwiera aplikację. */
export const DEFAULT_DIFFICULTY: Difficulty = 20;

export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === 'number' && (DIFFICULTIES as readonly number[]).includes(value);
}

/** Czy działanie mieści się w progu. Wynik równy progowi jeszcze się mieści. */
export function withinDifficulty(fact: Fact, difficulty: Difficulty): boolean {
  return factProduct(fact) <= difficulty;
}

export function factsWithin(facts: readonly Fact[], difficulty: Difficulty): Fact[] {
  return facts.filter((fact) => withinDifficulty(fact, difficulty));
}

/** Etykieta progu, tak jak widzi ją dziecko. */
export function difficultyLabel(difficulty: Difficulty): string {
  return `1–${difficulty}`;
}
