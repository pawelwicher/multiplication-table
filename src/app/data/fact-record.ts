/**
 * Serializacja faktów do IndexedDB i z powrotem.
 *
 * Wszystko tu jest czyste i defensywne: dane z bazy pochodzą z poprzedniej
 * wersji aplikacji albo z ręcznych grzebań w DevToolsach. Rekord, któremu
 * nie ufamy, odrzucamy i zastępujemy świeżym faktem — nigdy nie wpuszczamy
 * do domeny czegoś, co złamie jej niezmienniki.
 */

import {
  MAX_FACTOR,
  RECENT_TIMES_WINDOW,
  allFacts,
  createFact,
  isFactKey,
  keyOf,
  parseFactKey,
  type AnswerSample,
  type Fact,
  type FactKey,
  type LeitnerBox,
  type Mastery,
} from '../domain/fact';

export interface FactRecord {
  readonly key: FactKey;
  readonly box: LeitnerBox;
  readonly mastery: Mastery;
  readonly recentTimes: readonly AnswerSample[];
  readonly dueAt: number;
  readonly streak: number;
  readonly lapses: number;
}

/** `trivial`, `a` i `b` wynikają z klucza — zapisywanie ich byłoby zapraszaniem rozjazdu. */
export function toRecord(fact: Fact): FactRecord {
  return {
    key: keyOf(fact),
    box: fact.box,
    mastery: fact.mastery,
    recentTimes: fact.recentTimes,
    dueAt: fact.dueAt,
    streak: fact.streak,
    lapses: fact.lapses,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function intIn(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
    ? value
    : null;
}

function finiteAtLeast(value: unknown, min: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= min ? value : null;
}

function parseSamples(value: unknown): AnswerSample[] | null {
  if (!Array.isArray(value) || value.length > RECENT_TIMES_WINDOW) {
    return null;
  }

  const samples: AnswerSample[] = [];
  for (const entry of value) {
    if (!isObject(entry) || typeof entry['noisy'] !== 'boolean') {
      return null;
    }
    const ms = finiteAtLeast(entry['ms'], 0);
    if (ms === null) {
      return null;
    }
    samples.push({ ms, noisy: entry['noisy'] });
  }
  return samples;
}

/** Fakt z rekordu albo `null`, gdy rekord jest niekompletny lub bezsensowny. */
export function fromRecord(value: unknown): Fact | null {
  if (!isObject(value) || typeof value['key'] !== 'string' || !isFactKey(value['key'])) {
    return null;
  }

  const box = intIn(value['box'], 1, 5);
  const mastery = intIn(value['mastery'], 0, 4);
  const streak = intIn(value['streak'], 0, Number.MAX_SAFE_INTEGER);
  const lapses = intIn(value['lapses'], 0, Number.MAX_SAFE_INTEGER);
  const dueAt = finiteAtLeast(value['dueAt'], 0);
  const recentTimes = parseSamples(value['recentTimes']);

  if (box === null || mastery === null || streak === null || lapses === null || dueAt === null) {
    return null;
  }
  if (recentTimes === null) {
    return null;
  }

  const { a, b } = parseFactKey(value['key']);
  return {
    ...createFact(a, b),
    box: box as LeitnerBox,
    mastery: mastery as Mastery,
    recentTimes,
    dueAt,
    streak,
    lapses,
  };
}

/**
 * Pełny zbiór 55 faktów zbudowany na zapisanych rekordach.
 *
 * Braki i odrzucone rekordy uzupełniamy świeżymi faktami, nadmiarowe klucze
 * ignorujemy. Dzięki temu dołożenie faktów w przyszłej wersji nie wymaga migracji.
 */
export function mergeRecords(records: readonly unknown[]): Fact[] {
  const restored = new Map<FactKey, Fact>();
  for (const record of records) {
    const fact = fromRecord(record);
    if (fact !== null) {
      restored.set(keyOf(fact), fact);
    }
  }
  return allFacts().map((fresh) => restored.get(keyOf(fresh)) ?? fresh);
}

/** Ile faktów mieści się w pełnym zbiorze — do sanity checków w testach. */
export const GRID_SIZE = MAX_FACTOR;
