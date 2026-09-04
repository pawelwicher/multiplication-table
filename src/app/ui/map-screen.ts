import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MAX_FACTOR, MIN_FACTOR, factKey, keyOf, productOf, type Fact } from '../domain/fact';
import { FactStore } from '../state/fact-store';

const LEVEL_NAMES = ['nieznany', 'poznany', 'znany', 'płynny', 'zautomatyzowany'] as const;

interface Cell {
  readonly a: number;
  readonly b: number;
  readonly mastery: number;
  readonly trivial: boolean;
  readonly label: string;
}

@Component({
  selector: 'app-map-screen',
  imports: [RouterLink],
  template: `
    <main class="screen">
      <header class="bar">
        <a class="back" routerLink="/" aria-label="Wróć do menu">‹</a>
        <h1>Mapa opanowania</h1>
      </header>

      <p class="progress">
        <strong>{{ store.progress().automated }}</strong> z {{ store.progress().total }}
        działań zautomatyzowanych
      </p>

      <div class="grid-wrap">
        <table class="grid">
          <caption class="visually-hidden">
            Poziom opanowania każdego działania od 1×1 do 10×10
          </caption>
          <thead>
            <tr>
              <th scope="col"><span class="visually-hidden">czynnik</span>×</th>
              @for (b of axis; track b) {
                <th scope="col">{{ b }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track $index) {
              <tr>
                <th scope="row">{{ axis[$index] }}</th>
                @for (cell of row; track cell.label) {
                  <td
                    class="cell"
                    [class]="'cell--m' + cell.mastery"
                    [class.cell--trivial]="cell.trivial"
                    [attr.title]="cell.label"
                  >
                    <span class="visually-hidden">{{ cell.label }}</span>
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>

      <ul class="legend">
        @for (name of levels; track name; let i = $index) {
          <li><span class="swatch" [class]="'cell--m' + i"></span>{{ name }}</li>
        }
      </ul>

      <p class="note">
        Jaśniejsza ramka to działanie trywialne — z czynnikiem 1, 2, 5 albo 10.
        Wchodzi do gry, ale nie liczy się do postępu.
      </p>

      @if (!store.saving() && store.ready()) {
        <p class="warn">Postęp nie zapisze się w tej przeglądarce — zniknie po zamknięciu karty.</p>
      }

      <div class="actions">
        @if (confirming()) {
          <button type="button" class="danger" (click)="reset()">Na pewno wyczyścić postęp?</button>
          <button type="button" class="ghost" (click)="confirming.set(false)">Anuluj</button>
        } @else {
          <button type="button" class="ghost" (click)="confirming.set(true)">Wyczyść postęp</button>
        }
      </div>
    </main>
  `,
  styles: `
    .screen {
      display: flex;
      flex-direction: column;
      gap: 14px;
      height: 100%;
      overflow-y: auto;
      padding-bottom: 28px;
    }

    .bar {
      display: flex;
      gap: 8px;
      align-items: center;
      padding: 10px 12px;
      border-bottom: 1px solid var(--edge);
      background: var(--bg-sunken);
    }

    .bar h1 {
      margin: 0;
      font-size: 1.1rem;
    }

    .back {
      padding: 0 8px;
      color: var(--ink-dim);
      font-size: 1.6rem;
      line-height: 1;
      text-decoration: none;
    }

    .progress {
      margin: 0;
      padding: 0 16px;
      color: var(--ink-dim);
    }

    .progress strong {
      color: var(--good);
      font-size: 1.4rem;
    }

    .grid-wrap {
      overflow-x: auto;
      padding: 0 16px;
    }

    .grid {
      border-collapse: separate;
      border-spacing: 3px;
      margin-inline: auto;
    }

    .grid th {
      color: var(--ink-dim);
      font-size: 0.7rem;
      font-weight: 600;
    }

    .cell {
      width: 26px;
      height: 26px;
      border-radius: 5px;
      background: var(--bg-raised);
    }

    .cell--m0 { background: #1a2140; }
    .cell--m1 { background: #2c3a72; }
    .cell--m2 { background: #3f6fb5; }
    .cell--m3 { background: #4cc9f0; }
    .cell--m4 { background: #56d364; }

    .cell--trivial {
      box-shadow: inset 0 0 0 2px rgb(255 255 255 / 38%);
    }

    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 14px;
      margin: 0;
      padding: 0 16px;
      color: var(--ink-dim);
      font-size: 0.75rem;
      list-style: none;
    }

    .legend li {
      display: flex;
      gap: 6px;
      align-items: center;
    }

    .swatch {
      width: 12px;
      height: 12px;
      border-radius: 3px;
    }

    .note,
    .warn {
      margin: 0;
      padding: 0 16px;
      font-size: 0.75rem;
      line-height: 1.5;
    }

    .note {
      color: var(--ink-dim);
    }

    .warn {
      color: var(--accent-warm);
    }

    .actions {
      display: flex;
      gap: 10px;
      justify-content: center;
      padding: 8px 16px 0;
    }

    .ghost,
    .danger {
      padding: 10px 18px;
      border: 1px solid var(--edge);
      border-radius: var(--radius);
      font-size: 0.85rem;
    }

    .ghost {
      color: var(--ink-dim);
    }

    .danger {
      border-color: var(--danger);
      color: var(--danger);
    }

    .visually-hidden {
      position: absolute;
      overflow: hidden;
      width: 1px;
      height: 1px;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  `,
})
export class MapScreen {
  protected readonly store = inject(FactStore);
  protected readonly confirming = signal(false);

  protected readonly axis = Array.from(
    { length: MAX_FACTOR - MIN_FACTOR + 1 },
    (_, i) => MIN_FACTOR + i,
  );
  protected readonly levels = LEVEL_NAMES;

  /**
   * Siatka 10×10. Klucze są znormalizowane, więc `7×8` i `8×7` to ten sam fakt
   * i ta sama komórka po obu stronach przekątnej — dziecko widzi symetrię,
   * a my nie zmyślamy dodatkowych danych.
   */
  protected readonly rows = computed<readonly (readonly Cell[])[]>(() => {
    const byKey = new Map<string, Fact>(this.store.all().map((fact) => [keyOf(fact), fact]));

    return this.axis.map((a) =>
      this.axis.map((b) => {
        const fact = byKey.get(factKey(a, b));
        const mastery = fact?.mastery ?? 0;
        return {
          a,
          b,
          mastery,
          trivial: fact?.trivial ?? false,
          label: `${a} × ${b} = ${productOf(a, b)} — ${LEVEL_NAMES[mastery]}`,
        };
      }),
    );
  });

  protected reset(): void {
    this.confirming.set(false);
    void this.store.reset();
  }
}
