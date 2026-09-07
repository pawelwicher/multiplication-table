import { Component, computed, inject, signal } from '@angular/core';
import { Play } from './game/play';
import { Setup } from './setup/setup';
import { ThemeStore } from './state/theme-store';

type View = 'setup' | 'play';

@Component({
  selector: 'app-root',
  imports: [Setup, Play],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly theme = inject(ThemeStore);
  protected readonly view = signal<View>('setup');
  protected readonly cameBack = signal(false);

  protected readonly themeLabel = computed(() =>
    this.theme.theme() === 'dark' ? 'Włącz tryb jasny' : 'Włącz tryb ciemny',
  );

  protected play(): void {
    this.view.set('play');
  }

  protected setup(): void {
    this.cameBack.set(true);
    this.view.set('setup');
  }
}
