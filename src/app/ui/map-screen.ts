import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TRACKED_FACT_COUNT } from '../domain/fact';

/** Zaślepka — właściwa mapa 10×10 przyjdzie w kolejnej iteracji. */
@Component({
  selector: 'app-map-screen',
  imports: [RouterLink],
  template: `
    <main class="screen">
      <h1>Mapa opanowania</h1>
      <p>
        Tu stanie siatka 10×10 pokazująca, które działania są już zautomatyzowane.
        Do opanowania jest {{ tracked }} działań nietrywialnych.
      </p>
      <a class="link" routerLink="/game">Wróć do gry</a>
    </main>
  `,
  styles: `
    .screen {
      display: flex;
      flex-direction: column;
      gap: 20px;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 24px;
      text-align: center;
    }

    h1 {
      margin: 0;
      font-size: clamp(1.5rem, 6vw, 2.25rem);
    }

    p {
      max-width: 34ch;
      margin: 0;
      color: var(--ink-dim);
      line-height: 1.55;
    }

    .link {
      padding: 12px 24px;
      border-radius: var(--radius);
      background: var(--bg-raised);
      color: var(--accent);
      font-weight: 600;
      text-decoration: none;
    }
  `,
})
export class MapScreen {
  protected readonly tracked = TRACKED_FACT_COUNT;
}
