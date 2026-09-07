import { DOCUMENT, Service, effect, inject, signal } from '@angular/core';
import { readJson, writeJson } from './storage';

export type Theme = 'light' | 'dark';
const KEY = 'math.theme';

@Service()
export class ThemeStore {
  private readonly document = inject(DOCUMENT);
  readonly theme = signal<Theme>(initial());

  constructor() {
    effect(() => {
      const theme = this.theme();
      this.document.documentElement.dataset['theme'] = theme;
      writeJson(KEY, theme);
    });
  }

  toggle(): void {
    this.theme.update((current) => (current === 'dark' ? 'light' : 'dark'));
  }
}

function initial(): Theme {
  const stored = readJson(KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  const prefersDark =
    typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}
