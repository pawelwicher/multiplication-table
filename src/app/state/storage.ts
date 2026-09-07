/** Cienka osłona na localStorage — w prywatnym oknie albo w teście może go nie być. */

export function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Brak pamięci trwałej nie może psuć gry.
  }
}
