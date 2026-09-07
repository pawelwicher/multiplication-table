import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { MAX_TERMS, MIN_TERMS, OPERATIONS, OperationId, RANGES, Range } from '../domain/settings';
import { TABLES } from '../domain/tables';
import { Mode, SettingsStore } from '../state/settings-store';

@Component({
  selector: 'app-setup',
  templateUrl: './setup.html',
  styleUrl: './setup.css',
})
export class Setup {
  readonly start = output<void>();
  /** Po powrocie z gry fokus wraca na ekran ustawień. */
  readonly focusOnEnter = input(false);

  private readonly focusTarget = viewChild<ElementRef<HTMLElement>>('focusTarget');

  protected readonly settings = inject(SettingsStore);
  protected readonly ranges = RANGES;
  protected readonly operations = OPERATIONS;
  protected readonly tables = TABLES;
  protected readonly termOptions = Array.from(
    { length: MAX_TERMS - MIN_TERMS + 1 },
    (_, i) => MIN_TERMS + i,
  );

  protected readonly needsMoreTerms = computed(
    () => this.settings.custom().operations.includes('paren') && this.settings.custom().terms < 3,
  );

  protected readonly hint = computed(() => {
    if (this.settings.mode() === 'tables') {
      return this.settings.tables().tables.length === 0
        ? 'Wybierz przynajmniej jedną tabliczkę.'
        : '';
    }
    if (!this.settings.hasArithmetic()) {
      return 'Wybierz przynajmniej jedno działanie: dodawanie, odejmowanie, mnożenie albo dzielenie.';
    }
    return this.needsMoreTerms() ? 'Nawiasy pojawią się przy co najmniej 3 składnikach.' : '';
  });

  constructor() {
    effect(() => {
      if (this.focusOnEnter()) this.focusTarget()?.nativeElement.focus();
    });
  }

  protected setMode(mode: Mode): void {
    this.settings.setMode(mode);
  }

  protected setRange(max: Range): void {
    this.settings.setRange(max);
  }

  protected setTerms(terms: number): void {
    this.settings.setTerms(terms);
  }

  protected toggleOperation(id: OperationId): void {
    this.settings.toggleOperation(id);
  }

  protected isChecked(id: OperationId): boolean {
    return this.settings.hasOperation(id);
  }

  protected isTableChecked(table: number): boolean {
    return this.settings.tables().tables.includes(table);
  }
}
