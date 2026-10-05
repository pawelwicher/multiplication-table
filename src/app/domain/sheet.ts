/** Karta zadań do druku. Czysty TypeScript. */
import { Problem } from './generator';
import { Rng } from './random';
import { OPERATIONS, Settings } from './settings';

export const SHEET_SIZES = [10, 20, 30] as const;
export type SheetSize = (typeof SHEET_SIZES)[number];

/** Ile razy losujemy ponownie, gdy działanie już jest na karcie. */
const DISTINCT_ATTEMPTS = 50;

/**
 * Losuje `count` działań bez powtórek. Gdy pula jest mniejsza niż karta
 * (np. samo dodawanie w zakresie 1–2), powtórki są dozwolone — karta i tak musi być pełna.
 */
export function generateSheet(count: number, draw: (rng: Rng) => Problem, rng: Rng): Problem[] {
  const sheet: Problem[] = [];
  const seen = new Set<string>();
  while (sheet.length < count) {
    let problem = draw(rng);
    for (let i = 1; i < DISTINCT_ATTEMPTS && seen.has(problem.display); i++) {
      problem = draw(rng);
    }
    seen.add(problem.display);
    sheet.push(problem);
  }
  return sheet;
}

/** Podpis karty, np. „Mnożenie, dzielenie · liczby 1–100 · 2 liczby”. */
export function describeCustom(settings: Settings): string {
  const labels = OPERATIONS.filter((o) => settings.operations.includes(o.id)).map((o) =>
    o.label.toLowerCase(),
  );
  const ops = labels.join(', ');
  const terms = `${settings.terms} ${settings.terms < 5 ? 'liczby' : 'liczb'}`;
  return `${ops.charAt(0).toUpperCase()}${ops.slice(1)} · liczby ${settings.min}–${settings.max} · ${terms}`;
}
