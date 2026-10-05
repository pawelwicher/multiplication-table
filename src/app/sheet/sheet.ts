import {
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { generateProblem } from '../domain/generator';
import { seeded } from '../domain/random';
import {
  SHEET_SIZES,
  SheetSize,
  describeCustom,
  generateSheet,
} from '../domain/sheet';
import { SettingsStore } from '../state/settings-store';

/** Powyżej tej długości działanie nie mieści się w dwóch kolumnach kartki. */
const WIDE_DISPLAY = 22;

@Component({
  selector: 'app-sheet',
  templateUrl: './sheet.html',
  styleUrl: './sheet.css',
})
export class Sheet {
  readonly back = output<void>();

  private readonly settings = inject(SettingsStore);
  private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');

  protected readonly sizes = SHEET_SIZES;
  protected readonly size = signal<SheetSize>(10);
  protected readonly withAnswers = signal(true);
  /** Seed zamiast tablicy działań — zmiana liczby zadań dokłada nowe, nie losuje od zera. */
  private readonly seed = signal(newSeed());

  protected readonly subtitle = computed(() => describeCustom(this.settings.custom()));

  protected readonly problems = computed(() => {
    const settings = this.settings.custom();
    return generateSheet(this.size(), (rng) => generateProblem(settings, rng), seeded(this.seed()));
  });

  protected readonly wide = computed(() =>
    this.problems().some((p) => p.display.length > WIDE_DISPLAY),
  );

  constructor() {
    afterNextRender(() => this.heading().nativeElement.focus());
  }

  protected reshuffle(): void {
    this.seed.set(newSeed());
  }

  protected toggleAnswers(): void {
    this.withAnswers.update((on) => !on);
  }

  protected print(): void {
    window.print();
  }
}

/** Jedyne miejsce, w którym karta sięga po losowość — domena dostaje ją jako seed. */
function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 32);
}
