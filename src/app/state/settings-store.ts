import { Service, computed, effect, signal } from '@angular/core';
import {
  ARITHMETIC,
  DEFAULT_SETTINGS,
  OperationId,
  Settings,
  clampTerms,
  isValid,
  sanitize,
} from '../domain/settings';
import { canGenerate } from '../domain/generator';
import { readJson, writeJson } from './storage';

const KEY = 'math.settings';

interface Stored {
  custom: Settings;
  best: number;
}

@Service()
export class SettingsStore {
  private readonly stored = load();

  readonly custom = signal<Settings>(this.stored.custom);
  /** Najlepszy wynik punktowy sesji. */
  readonly best = signal(this.stored.best);

  /** Czy z tych kryteriów da się w ogóle ułożyć działanie (np. 5 mnożeń liczb od 20 — nie). */
  readonly feasible = computed(() => canGenerate(this.custom()));
  readonly canStart = computed(() => isValid(this.custom()) && this.feasible());

  constructor() {
    effect(() => {
      writeJson(KEY, { custom: this.custom(), best: this.best() } satisfies Stored);
    });
  }

  setRange(min: number, max: number): void {
    this.custom.update((s) => (s.min === min && s.max === max ? s : { ...s, min, max }));
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

  recordBest(points: number): void {
    if (points > this.best()) this.best.set(points);
  }
}

/** Dawny tryb tabliczki mnożenia to teraz mnożenie (i dzielenie) dwóch liczb od 1 do 10. */
interface LegacyTables {
  mode?: unknown;
  tables?: { withDivision?: unknown };
}

function load(): Stored {
  const raw = readJson(KEY);
  const data = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<Stored> &
    LegacyTables;
  const best = typeof data.best === 'number' && data.best >= 0 ? Math.round(data.best) : 0;
  if (data.mode === 'tables') {
    const operations: OperationId[] = data.tables?.withDivision === true ? ['mul', 'div'] : ['mul'];
    return { custom: { min: 1, max: 10, operations, terms: 2 }, best };
  }
  return { custom: raw === null ? DEFAULT_SETTINGS : sanitize(data.custom), best };
}
