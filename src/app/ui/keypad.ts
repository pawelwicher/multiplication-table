import { Component, input, output } from '@angular/core';

/** Własna klawiatura — dzięki niej na telefonie nie wyjeżdża klawiatura systemowa. */
@Component({
  selector: 'app-keypad',
  template: `
    <div class="pad" role="group" aria-label="Klawiatura numeryczna">
      @for (digit of digits; track digit) {
        <button type="button" class="key" (click)="press.emit(digit)">{{ digit }}</button>
      }
      <button type="button" class="key key--soft" aria-label="Wyczyść" (click)="clear.emit()">
        C
      </button>
      <button type="button" class="key" (click)="press.emit('0')">0</button>
      <button type="button" class="key key--soft" aria-label="Skasuj cyfrę" (click)="erase.emit()">
        <span aria-hidden="true">⌫</span>
      </button>
    </div>
    <button type="button" class="submit" [disabled]="!canSubmit()" (click)="submit.emit()">
      {{ submitLabel() }}
    </button>
  `,
  styles: `
    :host {
      display: grid;
      gap: 0.6rem;
    }

    .pad {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.6rem;
    }

    .key {
      min-height: 3.4rem;
      font-size: 1.5rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: var(--text);
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      cursor: pointer;
      touch-action: manipulation;
      transition:
        background-color 0.12s ease,
        transform 0.06s ease;
    }

    .key--soft {
      color: var(--muted);
      background: var(--surface-2);
    }

    .key:hover {
      background: var(--hover);
    }

    .key:active {
      transform: translateY(1px);
    }

    .submit {
      min-height: 3.4rem;
      font-size: 1.1rem;
      font-weight: 650;
      color: var(--accent-text);
      background: var(--accent);
      border: 1px solid transparent;
      border-radius: var(--radius);
      cursor: pointer;
      touch-action: manipulation;
    }

    .submit:disabled {
      color: var(--muted);
      background: var(--surface-2);
      border-color: var(--border);
      cursor: not-allowed;
    }

    @media (min-width: 480px) {
      .key,
      .submit {
        min-height: 3.8rem;
      }
    }
  `,
})
export class Keypad {
  readonly canSubmit = input(false);
  readonly submitLabel = input('Sprawdź');

  readonly press = output<string>();
  readonly erase = output<void>();
  readonly clear = output<void>();
  readonly submit = output<void>();

  protected readonly digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
}
