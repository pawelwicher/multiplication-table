/** Kryteria wyboru działań. Czysty TypeScript. */

export const RANGES = [20, 30, 40, 50, 60, 70, 80, 90, 100] as const;
export type Range = (typeof RANGES)[number];

export const MIN_TERMS = 2;
export const MAX_TERMS = 10;

export type OperationId = 'add' | 'sub' | 'mul' | 'div' | 'paren' | 'unknown';

export interface OperationInfo {
  readonly id: OperationId;
  readonly label: string;
  readonly sample: string;
}

/** Operatory arytmetyczne — przynajmniej jeden musi być wybrany. */
export const ARITHMETIC: readonly OperationId[] = ['add', 'sub', 'mul', 'div'];

export const OPERATIONS: readonly OperationInfo[] = [
  { id: 'add', label: 'Dodawanie', sample: '2 + 3' },
  { id: 'sub', label: 'Odejmowanie', sample: '7 \u2212 4' },
  { id: 'mul', label: 'Mnożenie', sample: '3 \u00d7 4' },
  { id: 'div', label: 'Dzielenie', sample: '12 \u00f7 3' },
  { id: 'paren', label: 'Nawiasy', sample: '(2 + 3) \u00d7 4' },
  { id: 'unknown', label: 'Niewiadoma', sample: 'x + 5 = 9' },
];

export interface Settings {
  readonly max: Range;
  readonly operations: readonly OperationId[];
  readonly terms: number;
}

export const DEFAULT_SETTINGS: Settings = {
  max: 20,
  operations: ['add', 'sub'],
  terms: 3,
};

export function clampTerms(terms: number): number {
  if (!Number.isFinite(terms)) return DEFAULT_SETTINGS.terms;
  return Math.min(MAX_TERMS, Math.max(MIN_TERMS, Math.round(terms)));
}

export function isValid(settings: Settings): boolean {
  return settings.operations.some((op) => ARITHMETIC.includes(op));
}

/** Naprawia ustawienia z pamięci przeglądarki — nie ufamy temu, co tam leży. */
export function sanitize(value: unknown): Settings {
  if (typeof value !== 'object' || value === null) return DEFAULT_SETTINGS;
  const raw = value as Partial<Record<keyof Settings, unknown>>;
  const max = RANGES.find((r) => r === raw.max) ?? DEFAULT_SETTINGS.max;
  const known = OPERATIONS.map((o) => o.id);
  const operations = Array.isArray(raw.operations)
    ? known.filter((id) => (raw.operations as unknown[]).includes(id))
    : DEFAULT_SETTINGS.operations;
  const terms = clampTerms(typeof raw.terms === 'number' ? raw.terms : DEFAULT_SETTINGS.terms);
  const settings: Settings = { max, operations, terms };
  return isValid(settings) ? settings : { ...settings, operations: DEFAULT_SETTINGS.operations };
}
