/** Źródło losowości wstrzykiwane z zewnątrz — dzięki temu domena jest deterministycznie testowalna. */
export type Rng = () => number;

export function randInt(rng: Rng, lo: number, hi: number): number {
  if (hi < lo) return lo;
  return lo + Math.floor(rng() * (hi - lo + 1));
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[randInt(rng, 0, items.length - 1)];
}

export function chance(rng: Rng, probability: number): boolean {
  return rng() < probability;
}

/** Deterministyczny generator (mulberry32) — do testów i powtarzalnych sesji. */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
