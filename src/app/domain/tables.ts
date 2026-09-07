import { bin, format, num } from './expression';
import { Rng, pick, randInt } from './random';
import { Problem } from './generator';

export const TABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export const TABLE_LIMIT = 10;

export interface TableSettings {
  /** Które tabliczki ćwiczymy, np. [3, 7, 8]. */
  readonly tables: readonly number[];
  readonly withDivision: boolean;
}

export const DEFAULT_TABLE_SETTINGS: TableSettings = {
  tables: [2, 3, 4, 5],
  withDivision: false,
};

export function sanitizeTables(value: unknown): TableSettings {
  if (typeof value !== 'object' || value === null) return DEFAULT_TABLE_SETTINGS;
  const raw = value as Partial<Record<keyof TableSettings, unknown>>;
  const tables = Array.isArray(raw.tables)
    ? TABLES.filter((t) => (raw.tables as unknown[]).includes(t))
    : DEFAULT_TABLE_SETTINGS.tables;
  return {
    tables: tables.length > 0 ? tables : DEFAULT_TABLE_SETTINGS.tables,
    withDivision: raw.withDivision === true,
  };
}

/** Punkty rosną z iloczynem — 9 × 8 jest trudniejsze niż 2 × 3. */
export function tablePoints(a: number, b: number, division: boolean): number {
  return Math.max(1, Math.round((a * b) / 15) + 1 + (division ? 1 : 0));
}

export function generateTableProblem(settings: TableSettings, rng: Rng): Problem {
  const tables = settings.tables.length > 0 ? settings.tables : DEFAULT_TABLE_SETTINGS.tables;
  const a = pick(rng, tables);
  const b = randInt(rng, 1, TABLE_LIMIT);
  const division = settings.withDivision && rng() < 0.4;

  if (division) {
    const expr = bin('/', num(a * b), num(b));
    return {
      display: format(expr),
      asks: 'result',
      answer: a,
      points: tablePoints(a, b, true),
    };
  }

  const expr = rng() < 0.5 ? bin('*', num(a), num(b)) : bin('*', num(b), num(a));
  return {
    display: format(expr),
    asks: 'result',
    answer: a * b,
    points: tablePoints(a, b, false),
  };
}
