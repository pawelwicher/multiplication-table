import { Service, computed, effect, signal } from '@angular/core';
import {
  ARITHMETIC,
  DEFAULT_SETTINGS,
  OperationId,
  Range,
  Settings,
  clampTerms,
  isValid,
  sanitize,
} from '../domain/settings';
import { DEFAULT_TABLE_SETTINGS, TableSettings, sanitizeTables } from '../domain/tables';
import { readJson, writeJson } from './storage';

export type Mode = 'custom' | 'tables';

const KEY = 'math.settings';

interface Stored {
  mode: Mode;
  custom: Settings;
  tables: TableSettings;
  best: number;
}

@Service()
export class SettingsStore {
  private readonly stored = load();

  readonly mode = signal<Mode>(this.stored.mode);
  readonly custom = signal<Settings>(this.stored.custom);
  readonly tables = signal<TableSettings>(this.stored.tables);
  /** Najlepszy wynik punktowy sesji. */
  readonly best = signal(this.stored.best);

  readonly canStart = computed(() =>
    this.mode() === 'custom' ? isValid(this.custom()) : this.tables().tables.length > 0,
  );

  constructor() {
    effect(() => {
      writeJson(KEY, {
        mode: this.mode(),
        custom: this.custom(),
        tables: this.tables(),
        best: this.best(),
      } satisfies Stored);
    });
  }

  setMode(mode: Mode): void {
    this.mode.set(mode);
  }

  setRange(max: Range): void {
    this.custom.update((s) => ({ ...s, max }));
  }

  setTerms(terms: number): void {
    this.custom.update((s) => ({ ...s, terms: clampTerms(terms) }));
  }

  toggleOperation(id: OperationId): void {
    this.custom.update((s) => {
      const operations = s.operations.includes(id)
        ? s.operations.filter((op) => op !== id)
        : [...s.operations, id];
      return { ...s, operations };
    });
  }

  hasOperation(id: OperationId): boolean {
    return this.custom().operations.includes(id);
  }

  /** Nawiasy i niewiadoma same z siebie nie tworzą działania. */
  hasArithmetic(): boolean {
    return this.custom().operations.some((op) => ARITHMETIC.includes(op));
  }

  toggleTable(table: number): void {
    this.tables.update((t) => ({
      ...t,
      tables: t.tables.includes(table)
        ? t.tables.filter((n) => n !== table)
        : [...t.tables, table].sort((a, b) => a - b),
    }));
  }

  toggleTableDivision(): void {
    this.tables.update((t) => ({ ...t, withDivision: !t.withDivision }));
  }

  recordBest(points: number): void {
    if (points > this.best()) this.best.set(points);
  }
}

function load(): Stored {
  const raw = readJson(KEY);
  const data = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<Stored>;
  return {
    mode: data.mode === 'tables' ? 'tables' : 'custom',
    custom: raw === null ? DEFAULT_SETTINGS : sanitize(data.custom),
    tables: raw === null ? DEFAULT_TABLE_SETTINGS : sanitizeTables(data.tables),
    best: typeof data.best === 'number' && data.best >= 0 ? Math.round(data.best) : 0,
  };
}
