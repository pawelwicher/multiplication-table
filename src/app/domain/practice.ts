/**
 * Czysta logika ćwiczenia: sesja, bufor wejścia i dobór pytań.
 *
 * Jedno działanie naraz, bez zegara i bez żyć. Pomiar czasu jest tu czysty,
 * więc to na jego podstawie liczy się poziom opanowania.
 */

import type { Fact, FactKey } from './fact';
import { GRADUATION_MASTERY } from './mastery';
import type { Rng } from './scheduler';

/** Ile pytań ma sesja. Krótka i policzalna: dziecko widzi koniec. */
export const SESSION_LENGTH = 20;

/**
 * Ile działań krąży naraz w zestawie roboczym.
 *
 * Zestaw istnieje, bo poprawna odpowiedź przesuwa działanie do pudełka 2,
 * czyli o dziesięć minut w przyszłość, a sesja trwa kilka minut. Bez zestawu
 * działanie nigdy nie wróciłoby w tej samej sesji, więc nigdy nie zrobiłoby
 * serii dwóch trafień z rzędu i nigdy nie awansowało.
 */
export const WORKING_SET = 8;

/**
 * Ile innych pytań musi przejść, zanim działanie może wrócić.
 *
 * Sam zakaz powtórki „dwa razy pod rząd" za mało rozrzucał pytania — przy
 * małym zestawie to samo działanie wracało co drugie albo co trzecie i sesja
 * robiła się nużąca.
 */
export const REPEAT_COOLDOWN = 4;

export type Verdict = 'commit' | 'buffering' | 'miss';

export interface Session {
  readonly length: number;
  readonly asked: number;
  /** Odpowiedzi trafione za pierwszym razem, bez podglądania wyniku. */
  readonly correct: number;
}

/**
 * Co znaczy bufor wobec jedynego widocznego działania.
 *
 * Zatwierdzamy bez Entera. Kolizji prefiksów nie ma — na ekranie jest tylko
 * jedna liczba do trafienia.
 */
export function resolveBuffer(buffer: string, answer: number): Verdict {
  if (buffer.length === 0) {
    return 'buffering';
  }
  if (Number(buffer) === answer) {
    return 'commit';
  }
  return String(answer).startsWith(buffer) ? 'buffering' : 'miss';
}

export function startSession(length: number = SESSION_LENGTH): Session {
  if (!Number.isInteger(length) || length < 1) {
    throw new RangeError(`Sesja musi mieć co najmniej jedno pytanie, otrzymano: ${length}`);
  }
  return { length, asked: 0, correct: 0 };
}

/** Domyka jedno pytanie. `firstTry` znaczy „trafione bez podglądania wyniku". */
export function answerQuestion(session: Session, firstTry: boolean): Session {
  return {
    length: session.length,
    asked: Math.min(session.length, session.asked + 1),
    correct: session.correct + (firstTry ? 1 : 0),
  };
}

export function isSessionDone(session: Session): boolean {
  return session.asked >= session.length;
}

/** Postęp sesji 0–1, do paska. */
export function sessionProgress(session: Session): number {
  return session.asked / session.length;
}

/** Działanie opuszcza zestaw roboczy, gdy jest już uznane za znane. */
export function hasGraduated(fact: Fact): boolean {
  return fact.mastery >= GRADUATION_MASTERY;
}

function pickRandom(items: readonly FactKey[], rng: Rng): FactKey {
  const index = Math.min(items.length - 1, Math.floor(rng() * items.length));
  return items[index] as FactKey;
}

/**
 * Następne pytanie z zestawu roboczego, z pominięciem ostatnio zadanych.
 *
 * `recent` to historia od najstarszego. Karencję skracamy stopniowo, gdy
 * zestaw jest za mały, żeby nigdy nie zostać bez pytania — lepsza wcześniejsza
 * powtórka niż zacięta sesja.
 */
export function pickFromSet(
  set: readonly FactKey[],
  recent: readonly FactKey[],
  rng: Rng,
): FactKey | null {
  if (set.length === 0) {
    return null;
  }

  for (let window = Math.min(recent.length, REPEAT_COOLDOWN); window > 0; window--) {
    const blocked = new Set(recent.slice(-window));
    const candidates = set.filter((key) => !blocked.has(key));
    if (candidates.length > 0) {
      return pickRandom(candidates, rng);
    }
  }
  return pickRandom(set, rng);
}

/** Dopisuje pytanie do historii, przycinając ją do długości karencji. */
export function rememberAsked(recent: readonly FactKey[], key: FactKey): FactKey[] {
  return [...recent, key].slice(-REPEAT_COOLDOWN);
}
