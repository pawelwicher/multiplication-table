import { Component, computed, input } from '@angular/core';

import { START_LIVES } from '../domain/arcade';

@Component({
  selector: 'app-hud',
  template: `
    <header class="hud">
      <div class="lives" [attr.aria-label]="'Życia: ' + lives()">
        @for (slot of slots(); track $index) {
          <span class="heart" [class.heart--spent]="!slot">♥</span>
        }
      </div>

      <div class="stat stat--score">
        <span class="stat__value">{{ score() }}</span>
        <span class="stat__label">punkty</span>
      </div>

      <div class="stat">
        <span class="stat__value">{{ level() }}</span>
        <span class="stat__label">poziom</span>
      </div>

      <div class="stat" [class.stat--hot]="streak() >= 5">
        <span class="stat__value">{{ streak() }}</span>
        <span class="stat__label">seria</span>
      </div>
    </header>
  `,
  styles: `
    .hud {
      display: flex;
      gap: 16px;
      align-items: center;
      justify-content: space-between;
      padding: 10px 16px;
      border-bottom: 1px solid var(--edge);
      background: var(--bg-sunken);
    }

    .lives {
      display: flex;
      gap: 4px;
      font-size: 1.35rem;
      line-height: 1;
      color: var(--danger);
    }

    .heart--spent {
      color: var(--edge);
    }

    .stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      line-height: 1.1;
    }

    .stat__value {
      font-size: 1.15rem;
      font-weight: 700;
    }

    .stat__label {
      font-size: 0.65rem;
      color: var(--ink-dim);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .stat--score .stat__value {
      color: var(--accent-warm);
    }

    .stat--hot .stat__value {
      color: var(--good);
    }
  `,
})
export class Hud {
  readonly lives = input.required<number>();
  readonly score = input.required<number>();
  readonly level = input.required<number>();
  readonly streak = input.required<number>();

  /** `true` = serce pełne. Zawsze rysujemy trzy, żeby pasek nie skakał. */
  protected readonly slots = computed(() =>
    Array.from({ length: START_LIVES }, (_, i) => i < this.lives()),
  );
}
