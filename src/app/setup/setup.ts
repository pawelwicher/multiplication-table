import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormField, form, max, min, required, validate } from '@angular/forms/signals';
import {
  MAX_TERMS,
  MIN_TERMS,
  OPERATIONS,
  OperationId,
  RANGE_FLOOR,
  RANGE_LIMIT,
} from '../domain/settings';
import { SettingsStore } from '../state/settings-store';

interface RangeModel {
  min: number | null;
  max: number | null;
}

@Component({
  selector: 'app-setup',
  imports: [FormField],
  templateUrl: './setup.html',
  styleUrl: './setup.css',
})
export class Setup {
  readonly start = output<void>();
  readonly sheet = output<void>();
  /** Po powrocie z gry fokus wraca na ekran ustawień. */
  readonly focusOnEnter = input(false);

  private readonly focusTarget = viewChild<ElementRef<HTMLElement>>('focusTarget');

  protected readonly settings = inject(SettingsStore);
  protected readonly operations = OPERATIONS;
  protected readonly rangeFloor = RANGE_FLOOR;
  protected readonly rangeLimit = RANGE_LIMIT;
  protected readonly termOptions = Array.from(
    { length: MAX_TERMS - MIN_TERMS + 1 },
    (_, i) => MIN_TERMS + i,
  );

  /** Pola mogą chwilowo trzymać coś niepoprawnego — do ustawień trafia tylko poprawny zakres. */
  private readonly range = signal<RangeModel>({
    min: this.settings.custom().min,
    max: this.settings.custom().max,
  });

  protected readonly rangeForm = form(this.range, (path) => {
    for (const bound of [path.min, path.max]) {
      required(bound, { message: 'Wpisz liczbę.' });
      min(bound, RANGE_FLOOR, { message: `Najmniej ${RANGE_FLOOR}.` });
      max(bound, RANGE_LIMIT, { message: `Najwięcej ${RANGE_LIMIT}.` });
      validate(bound, ({ value }) => {
        const v = value();
        return v === null || Number.isInteger(v)
          ? undefined
          : { kind: 'integer', message: 'Tylko liczby całkowite.' };
      });
    }
    validate(path.max, ({ value, valueOf }) => {
      const lo = valueOf(path.min);
      const hi = value();
      return lo !== null && hi !== null && hi < lo
        ? { kind: 'order', message: 'Górna granica nie może być mniejsza od dolnej.' }
        : undefined;
    });
  });

  protected readonly ready = computed(() => this.rangeForm().valid() && this.settings.canStart());

  protected readonly needsMoreTerms = computed(
    () => this.settings.custom().operations.includes('paren') && this.settings.custom().terms < 3,
  );

  protected readonly hint = computed(() => {
    if (!this.rangeForm().valid()) return 'Popraw zakres liczb.';
    if (!this.settings.hasArithmetic()) {
      return 'Wybierz przynajmniej jedno działanie: dodawanie, odejmowanie, mnożenie albo dzielenie.';
    }
    if (!this.settings.feasible()) {
      return 'Z takich liczb nie da się ułożyć działania. Zmniejsz zakres albo liczbę składników.';
    }
    const ops = this.settings.custom().operations;
    if (ops.includes('paren') && !ops.includes('add') && !ops.includes('sub')) {
      return 'Nawiasy pojawią się dopiero z dodawaniem albo odejmowaniem.';
    }
    return this.needsMoreTerms() ? 'Nawiasy pojawią się przy co najmniej 3 składnikach.' : '';
  });

  constructor() {
    effect(() => {
      if (this.focusOnEnter()) this.focusTarget()?.nativeElement.focus();
    });
    effect(() => {
      const { min: lo, max: hi } = this.range();
      if (this.rangeForm().valid() && lo !== null && hi !== null) this.settings.setRange(lo, hi);
    });
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
}
