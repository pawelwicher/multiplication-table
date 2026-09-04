/**
 * Czysta logika trybu spokojnego.
 *
 * Ten tryb wprowadza materiał: jedno działanie naraz, bez zegara i bez żyć.
 * To tutaj fakt dochodzi do poziomu 2, od którego wolno go wpuścić do arcade,
 * i tutaj — bo pomiary są czyste — zdobywa poziom 4.
 */

import type { Fact, FactKey } from './fact';
import { ARCADE_MIN_MASTERY } from './mastery';
import type { Rng } from './scheduler';

/** Ile pytań ma sesja. Krótka i policzalna: dziecko widzi koniec. */
export const CALM_SESSION_LENGTH = 20;

/**
 * Ile działań krąży naraz w zestawie roboczym.
 *
 * Bez tego tryb spokojny by nie działał: poprawna odpowiedź przesuwa fakt do
 * pudełka 2, czyli o dziesięć minut w przyszłość, a sesja trwa kilka minut.
 * Fakt nigdy nie wróciłby w tej samej sesji, więc nigdy nie zrobiłby serii
 * dwóch trafień z rzędu i nigdy nie doszedłby do poziomu 2. Zestaw roboczy
 * krąży niezależnie od kolejki powtórek — dopiero po awansie fakt z niego
 * wypada i wchodzi w rytm Leitnera.
 */
export const CALM_WORKING_SET = 5;

export type CalmVerdict = 'commit' | 'buffering' | 'miss';

export interface CalmSession {
  readonly length: number;
  readonly asked: number;
  /** Odpowiedzi trafione za pierwszym razem, bez podglądania wyniku. */
  readonly correct: number;
}

/**
 * Co znaczy bufor wobec jedynego widocznego działania.
 *
 * Tak samo jak w arcade zatwierdzamy bez Entera, ale bez kolizji prefiksów —
 * na ekranie jest tylko jedna liczba do trafienia.
 */
export function calmResolve(buffer: string, answer: number): CalmVerdict {
  if (buffer.length === 0) {
    return 'buffering';
  }
  if (Number(buffer) === answer) {
    return 'commit';
  }
  return String(answer).startsWith(buffer) ? 'buffering' : 'miss';
}

export function startSession(length: number = CALM_SESSION_LENGTH): CalmSession {
  if (!Number.isInteger(length) || length < 1) {
    throw new RangeError(`Sesja musi mieć co najmniej jedno pytanie, otrzymano: ${length}`);
  }
  return { length, asked: 0, correct: 0 };
}

/** Domyka jedno pytanie. `firstTry` znaczy „trafione bez podglądania wyniku". */
export function answerQuestion(session: CalmSession, firstTry: boolean): CalmSession {
  return {
    length: session.length,
    asked: Math.min(session.length, session.asked + 1),
    correct: session.correct + (firstTry ? 1 : 0),
  };
}

export function isSessionDone(session: CalmSession): boolean {
  return session.asked >= session.length;
}

/** Postęp sesji 0–1, do paska. */
export function sessionProgress(session: CalmSession): number {
  return session.asked / session.length;
}

/** Fakt opuszcza zestaw roboczy, gdy jest już na tyle znany, że wpuszcza go arcade. */
export function hasGraduated(fact: Fact): boolean {
  return fact.mastery >= ARCADE_MIN_MASTERY;
}

/** Następne pytanie z zestawu roboczego, nigdy to samo dwa razy pod rząd. */
export function pickFromSet(
  set: readonly FactKey[],
  lastKey: FactKey | null,
  rng: Rng,
): FactKey | null {
  if (set.length === 0) {
    return null;
  }

  // Przy jednym elemencie nie ma wyboru — powtórka jest lepsza niż brak pytania.
  const candidates = set.length > 1 ? set.filter((key) => key !== lastKey) : set;
  if (candidates.length === 0) {
    return set[0] ?? null;
  }

  const index = Math.min(candidates.length - 1, Math.floor(rng() * candidates.length));
  return candidates[index] ?? null;
}
