import { Service, computed, signal } from '@angular/core';

import { allFacts, keyOf, type AnswerEvent, type Fact, type FactKey, type Mastery } from '../domain/fact';
import { applyAnswer, isArcadeReady, trackedProgress } from '../domain/mastery';
import { nextFact, type Rng } from '../domain/scheduler';

/**
 * Mock na pierwszą iterację: pula faktów żyje w pamięci i znika przy odświeżeniu.
 * IndexedDB przyjdzie osobno — tutaj chodzi tylko o to, żeby arcade miało
 * co pokazywać i żeby prawdziwy scheduler był realnie użyty, nie obchodzony.
 */
const MOCK_MASTERY: Mastery = 3;

/**
 * Arcade nie wpuszcza faktów poniżej poziomu 2, a świeży zbiór ma wszystkie
 * na zerze — bez trybu spokojnego pula byłaby pusta. Mock udaje więc dziecko,
 * które materiał już poznało i teraz buduje płynność.
 */
function seed(): Fact[] {
  return allFacts().map((fact) => ({ ...fact, mastery: MOCK_MASTERY, box: 3 }));
}

@Service()
export class FactStore {
  private readonly facts = signal<readonly Fact[]>(seed());
  private readonly rng: Rng = Math.random;

  readonly progress = computed(() => trackedProgress(this.facts()));

  /** Następny fakt do pokazania albo `null`, gdy pula jest w tej chwili pusta. */
  next(onScreen: readonly Fact[], lastKey: FactKey | null): Fact | null {
    return nextFact(this.facts(), {
      now: Date.now(),
      rng: this.rng,
      onScreen,
      lastKey,
      eligible: isArcadeReady,
    });
  }

  /** Zapisuje wynik odpowiedzi. Bez persystencji — po odświeżeniu strony przepada. */
  record(event: AnswerEvent): void {
    const now = Date.now();
    this.facts.update((facts) =>
      facts.map((fact) => (keyOf(fact) === event.key ? applyAnswer(fact, event, now) : fact)),
    );
  }
}
