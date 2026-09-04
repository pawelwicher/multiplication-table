import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ARCADE_MIN_MASTERY } from '../domain/mastery';
import { FactStore } from '../state/fact-store';

@Component({
  selector: 'app-home-screen',
  imports: [RouterLink],
  template: `
    <main class="home">
      <h1>Tabliczka mnożenia</h1>

      <p class="progress">
        <strong>{{ store.progress().automated }}</strong> z {{ store.progress().total }}
        działań opanowanych
      </p>

      <nav class="modes">
        <a class="mode mode--calm" routerLink="/calm">
          <span class="mode__name">Spokojnie</span>
          <span class="mode__desc">Bez zegara. Tu poznajesz nowe działania.</span>
        </a>

        <a class="mode mode--arcade" routerLink="/game" [class.mode--locked]="!arcadeOpen()">
          <span class="mode__name">Arcade</span>
          <span class="mode__desc">
            @if (arcadeOpen()) {
              Zdąż odpowiedzieć, zanim działanie spadnie.
            } @else {
              Najpierw poćwicz spokojnie kilka działań.
            }
          </span>
        </a>

        <a class="mode mode--map" routerLink="/map">
          <span class="mode__name">Mapa</span>
          <span class="mode__desc">Co już umiesz, a co jeszcze przed tobą.</span>
        </a>
      </nav>
    </main>
  `,
  styles: `
    .home {
      display: flex;
      flex-direction: column;
      gap: 10px;
      justify-content: center;
      height: 100%;
      padding: 24px;
    }

    h1 {
      margin: 0;
      font-size: clamp(1.6rem, 8vw, 2.4rem);
      text-align: center;
    }

    .progress {
      margin: 0 0 18px;
      color: var(--ink-dim);
      text-align: center;
    }

    .progress strong {
      color: var(--good);
      font-size: 1.5rem;
    }

    .modes {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .mode {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 18px 20px;
      border: 1px solid var(--edge);
      border-left: 4px solid var(--accent);
      border-radius: var(--radius);
      background: var(--bg-raised);
      color: inherit;
      text-decoration: none;
    }

    .mode--arcade {
      border-left-color: var(--accent-warm);
    }

    .mode--map {
      border-left-color: var(--good);
    }

    .mode--locked {
      opacity: 0.55;
    }

    .mode__name {
      font-size: 1.25rem;
      font-weight: 700;
    }

    .mode__desc {
      color: var(--ink-dim);
      font-size: 0.85rem;
      line-height: 1.4;
    }
  `,
})
export class HomeScreen {
  protected readonly store = inject(FactStore);

  /** Arcade ma sens dopiero, gdy jest co w nie wpuścić. */
  protected readonly arcadeOpen = computed(() => this.store.arcadeReady() > 0);

  protected readonly minMastery = ARCADE_MIN_MASTERY;
}
