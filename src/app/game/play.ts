import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { GameStore } from '../state/game-store';
import { SettingsStore } from '../state/settings-store';
import { Keypad } from '../ui/keypad';

const NEXT_AFTER_CORRECT = 800;
const NEXT_AFTER_WRONG = 2200;

const SPOKEN: Readonly<Record<string, string>> = {
  '+': 'plus',
  '−': 'minus',
  '×': 'razy',
  '÷': 'podzielić przez',
  '=': 'równa się',
  '(': 'nawias',
  ')': 'zamknij nawias',
  x: 'iks',
};

@Component({
  selector: 'app-play',
  imports: [Keypad],
  templateUrl: './play.html',
  styleUrl: './play.css',
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class Play {
  readonly quit = output<void>();

  protected readonly game = inject(GameStore);
  protected readonly settings = inject(SettingsStore);
  protected readonly finished = signal(false);

  private timer: ReturnType<typeof setTimeout> | null = null;

  protected readonly question = computed(() => (this.game.problem()?.asks === 'x' ? 'x =' : '='));

  /** Działanie przeczytane słowami — symbole matematyczne bywają pomijane przez czytniki. */
  protected readonly spoken = computed(() => {
    const problem = this.game.problem();
    if (!problem) return '';
    const words = problem.display
      .replace(/[+−×÷=()x]/g, (sign) => ` ${SPOKEN[sign] ?? sign} `)
      .replace(/\s+/g, ' ')
      .trim();
    return problem.asks === 'x' ? `${words}. Ile wynosi iks?` : `${words}. Ile to jest?`;
  });

  protected readonly verdict = computed(() => {
    if (this.game.phase() !== 'reveal') return '';
    if (this.game.lastCorrect()) return `Dobrze! +${this.game.lastGain()} pkt`;
    return `Niestety. Poprawna odpowiedź to ${this.game.problem()?.answer}.`;
  });

  /** Plansza albo podsumowanie — po zmianie ekranu fokus musi tam trafić. */
  private readonly focusTarget = viewChild<ElementRef<HTMLElement>>('focusTarget');

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancel());
    this.game.start();
    effect(() => this.focusTarget()?.nativeElement.focus());
  }

  protected onSubmit(): void {
    if (this.game.phase() === 'reveal') {
      this.advance();
      return;
    }
    if (!this.game.canSubmit()) return;
    this.game.submit();
    this.cancel();
    this.timer = setTimeout(
      () => this.advance(),
      this.game.lastCorrect() ? NEXT_AFTER_CORRECT : NEXT_AFTER_WRONG,
    );
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (this.finished()) return;
    if (event.key >= '0' && event.key <= '9') {
      this.game.press(event.key);
    } else if (event.key === 'Backspace') {
      this.game.erase();
    } else if (event.key === 'Enter' || event.key === ' ') {
      // Spacja i Enter na przyciskach są obsługiwane natywnie.
      if ((event.target as HTMLElement)?.tagName === 'BUTTON') return;
      this.onSubmit();
    } else if (event.key === 'Escape') {
      this.game.clear();
      return;
    } else {
      return;
    }
    event.preventDefault();
  }

  protected finish(): void {
    this.cancel();
    this.settings.recordBest(this.game.points());
    this.finished.set(true);
  }

  protected again(): void {
    this.finished.set(false);
    this.game.start();
  }

  private advance(): void {
    this.cancel();
    this.game.next();
  }

  private cancel(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
}
