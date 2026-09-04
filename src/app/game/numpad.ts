import { Component, output } from '@angular/core';

/**
 * Własny numpad 3×4. Świadomie nie używamy `<input>` — natywna klawiatura
 * systemowa zjadłaby pół ekranu i rozbiła układ gry.
 */
@Component({
  selector: 'app-numpad',
  template: `
    <div class="pad">
      @for (digit of digits; track digit) {
        <button type="button" class="key" (pointerdown)="digit_.emit(digit)">{{ digit }}</button>
      }
      <button
        type="button"
        class="key key--soft"
        aria-label="Skasuj cyfrę"
        (pointerdown)="backspace.emit()"
      >
        ⌫
      </button>
      <button type="button" class="key" (pointerdown)="digit_.emit(0)">0</button>
      <button
        type="button"
        class="key key--accent"
        aria-label="Zatwierdź"
        (pointerdown)="submit.emit()"
      >
        ⏎
      </button>
    </div>
  `,
  styles: `
    .pad {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      grid-auto-rows: 1fr;
      gap: var(--gap);
      height: 100%;
      padding: var(--gap);
    }

    .key {
      display: grid;
      place-items: center;
      border: 1px solid var(--edge);
      border-radius: var(--radius);
      background: var(--bg-raised);
      font-size: clamp(1.25rem, 6vh, 2rem);
      font-weight: 600;
      /* Bez tego przytrzymanie klawisza na dotyku podświetla go na niebiesko. */
      -webkit-tap-highlight-color: transparent;
      transition: transform 60ms ease, background 60ms ease;
    }

    .key:active {
      transform: scale(0.94);
      background: #1e2750;
    }

    .key--soft {
      color: var(--ink-dim);
    }

    .key--accent {
      color: var(--accent);
    }
  `,
})
export class Numpad {
  /** `digit` koliduje z nazwą pola w szablonie, stąd podkreślnik. */
  readonly digit_ = output<number>({ alias: 'digit' });
  readonly backspace = output<void>();
  readonly submit = output<void>();

  protected readonly digits = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
}
