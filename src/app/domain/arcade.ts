/**
 * Czysta logika trybu arcade: bufor wejścia, auto-commit, krzywa trudności, punktacja.
 *
 * Nie ma tu pozycji kafelków ani klatek — te żyją w `game/`. Tutaj kafelek to
 * para `{ id, answer }` i nic więcej.
 */

export const START_LIVES = 3;

/** Poziomy trudności. */
export const MIN_LEVEL = 1;
export const MAX_LEVEL = 10;

/** Czas przelotu od góry do linii na skrajnych poziomach; między nimi interpolacja liniowa. */
export const LEVEL_MIN_FLIGHT_MS = 2500;
export const LEVEL_MAX_FLIGHT_MS = 8000;

/** Trudność skalujemy czasem przelotu, nie liczbą obiektów — z jednym wyjątkiem. */
export const BASE_MAX_TILES = 2;
export const HIGH_MAX_TILES = 3;
export const THREE_TILE_LEVEL = 8;

/** Co tyle poprawnych odpowiedzi rośnie poziom. */
export const LEVEL_UP_EVERY = 10;

/** Ile czekamy na kolejną cyfrę, gdy trafienie koliduje z dłuższym wynikiem. */
export const PREFIX_TIMEOUT_MS = 800;

/** Po przekroczeniu linii kafelek stoi tyle, pokazując pełne działanie z wynikiem. */
export const LINE_PAUSE_MS = 1000;

/** Zła odpowiedź nie zabiera życia — tylko nieznacznie przyspiesza kafelek. */
export const WRONG_ANSWER_SPEEDUP = 1.15;

export const BASE_POINTS = 10;

/** Kafelek widziany oczami logiki wejścia. */
export interface TileAnswer {
  readonly id: number;
  readonly answer: number;
}

export type BufferResolution =
  /** Jednoznaczne trafienie — zatwierdzamy natychmiast. */
  | { readonly kind: 'commit'; readonly tileId: number }
  /** Trafienie, ale inny kafelek ma dłuższy wynik z tym samym prefiksem. */
  | { readonly kind: 'pending'; readonly tileId: number }
  /** Jeszcze nic nie trafione, ale bufor jest prefiksem czegoś na ekranie. */
  | { readonly kind: 'buffering' }
  /** Bufor nie pasuje do niczego. */
  | { readonly kind: 'miss' };

export type InputEffect =
  | { readonly kind: 'none' }
  /** Uzbrój timer — po `ms` wywołaj `resolveTimeout`. */
  | { readonly kind: 'wait'; readonly ms: number }
  | { readonly kind: 'commit'; readonly tileId: number }
  | { readonly kind: 'miss' };

export interface InputOutcome {
  readonly buffer: string;
  readonly effect: InputEffect;
}

const NONE: InputEffect = { kind: 'none' };

function clampLevel(level: number): number {
  if (!Number.isFinite(level)) {
    throw new RangeError(`Poziom musi być liczbą, otrzymano: ${level}`);
  }
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(level)));
}

/**
 * Czas przelotu kafelka na danym poziomie.
 *
 * Interpolacja liniowa 8000 ms → 2500 ms przez dziesięć poziomów, czyli krok
 * ~611 ms. Poziom 8 to ~3722 ms, nie równe 3000 — trudność rośnie płynnie,
 * a nie pod okrągłe liczby.
 */
export function flightDurationMs(level: number): number {
  const clamped = clampLevel(level);
  const progress = (clamped - MIN_LEVEL) / (MAX_LEVEL - MIN_LEVEL);
  return LEVEL_MAX_FLIGHT_MS + progress * (LEVEL_MIN_FLIGHT_MS - LEVEL_MAX_FLIGHT_MS);
}

/** Ile kafelków może być naraz na ekranie. */
export function maxTiles(level: number): number {
  return clampLevel(level) >= THREE_TILE_LEVEL ? HIGH_MAX_TILES : BASE_MAX_TILES;
}

/** Poziom wynikający z liczby poprawnych odpowiedzi w tej rozgrywce. */
export function levelForCorrect(correctCount: number): number {
  if (!Number.isFinite(correctCount) || correctCount < 0) {
    throw new RangeError(`Liczba poprawnych odpowiedzi musi być nieujemna, otrzymano: ${correctCount}`);
  }
  return clampLevel(MIN_LEVEL + Math.floor(correctCount / LEVEL_UP_EVERY));
}

/** Mnożnik za serię: rośnie co 5 trafień, zatrzymuje się na potrójnym. */
export function streakMultiplier(streak: number): number {
  return Math.min(3, 1 + Math.floor(Math.max(0, streak) / 5) * 0.5);
}

/** Punkty za jedno trafienie. Wyższy poziom i dłuższa seria są warte więcej. */
export function pointsFor(level: number, streak: number): number {
  return Math.round(BASE_POINTS * clampLevel(level) * streakMultiplier(streak));
}

/**
 * Rozstrzyga, co znaczy bieżący bufor wobec kafelków na ekranie.
 *
 * `tiles` powinny przyjść posortowane od najpilniejszego (najbliżej linii) —
 * przy niejednoznaczności wygrywa pierwszy.
 */
export function resolveBuffer(buffer: string, tiles: readonly TileAnswer[]): BufferResolution {
  if (buffer.length === 0) {
    return { kind: 'buffering' };
  }

  const value = Number(buffer);
  const hit = tiles.find((tile) => tile.answer === value);
  const hasLongerPrefix = tiles.some(
    (tile) => tile.answer !== value && String(tile.answer).startsWith(buffer),
  );

  if (hit !== undefined) {
    return hasLongerPrefix ? { kind: 'pending', tileId: hit.id } : { kind: 'commit', tileId: hit.id };
  }
  return hasLongerPrefix ? { kind: 'buffering' } : { kind: 'miss' };
}

/** Cyfra z numpada albo klawiatury. */
export function pressDigit(buffer: string, digit: number, tiles: readonly TileAnswer[]): InputOutcome {
  if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
    throw new RangeError(`Cyfra musi być z zakresu 0–9, otrzymano: ${digit}`);
  }

  const next = buffer + String(digit);
  const resolution = resolveBuffer(next, tiles);

  switch (resolution.kind) {
    case 'commit':
      return { buffer: '', effect: { kind: 'commit', tileId: resolution.tileId } };
    case 'pending':
      return { buffer: next, effect: { kind: 'wait', ms: PREFIX_TIMEOUT_MS } };
    case 'buffering':
      return { buffer: next, effect: NONE };
    case 'miss':
      return { buffer: '', effect: { kind: 'miss' } };
  }
}

export function pressBackspace(buffer: string): InputOutcome {
  return { buffer: buffer.slice(0, -1), effect: NONE };
}

/** Enter jest skrótem — zatwierdza to, co już wystarcza, zamiast czekać na timeout. */
export function pressEnter(buffer: string, tiles: readonly TileAnswer[]): InputOutcome {
  if (buffer.length === 0) {
    return { buffer: '', effect: NONE };
  }

  const resolution = resolveBuffer(buffer, tiles);
  if (resolution.kind === 'commit' || resolution.kind === 'pending') {
    return { buffer: '', effect: { kind: 'commit', tileId: resolution.tileId } };
  }
  return { buffer: '', effect: { kind: 'miss' } };
}

/**
 * Timer z `wait` dobiegł końca. Rozstrzygamy ponownie, bo przez te 800 ms
 * kafelek mógł przekroczyć linię i zniknąć — wtedy nie ma czego zatwierdzać
 * i po cichu czyścimy bufor, bez obwiniania gracza.
 */
export function resolveTimeout(buffer: string, tiles: readonly TileAnswer[]): InputOutcome {
  const resolution = resolveBuffer(buffer, tiles);
  if (resolution.kind === 'commit' || resolution.kind === 'pending') {
    return { buffer: '', effect: { kind: 'commit', tileId: resolution.tileId } };
  }
  return { buffer: '', effect: NONE };
}
