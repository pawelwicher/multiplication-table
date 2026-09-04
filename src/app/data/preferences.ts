/**
 * Wybrany próg trudności.
 *
 * Świadomie `localStorage`, nie IndexedDB: to jedna liczba, a osobny magazyn
 * w bazie oznaczałby podbicie wersji schematu i ścieżkę migracji dla czegoś,
 * co i tak jest tylko preferencją, a nie postępem nauki.
 */

import { DEFAULT_DIFFICULTY, isDifficulty, type Difficulty } from '../domain/difficulty';

const KEY = 'tabliczka:difficulty';

export function readDifficulty(): Difficulty {
  try {
    const stored = Number(localStorage.getItem(KEY));
    return isDifficulty(stored) ? stored : DEFAULT_DIFFICULTY;
  } catch {
    // Tryb prywatny albo zablokowane dane — startujemy od domyślnego progu.
    return DEFAULT_DIFFICULTY;
  }
}

export function writeDifficulty(difficulty: Difficulty): void {
  try {
    localStorage.setItem(KEY, String(difficulty));
  } catch {
    // Nie zapisze się — trudno, próg zostanie na tę sesję.
  }
}
