import { Service, computed, signal } from '@angular/core';

import { toRecord, mergeRecords } from '../data/fact-record';
import { FACTS_STORE, clearStore, isAvailable, openDb, readAll, writeAll } from '../data/idb';
import { allFacts, keyOf, type AnswerEvent, type Fact, type FactKey } from '../domain/fact';
import { applyAnswer, isArcadeReady, trackedProgress } from '../domain/mastery';
import { nextFact, type Rng } from '../domain/scheduler';

/**
 * Jedyne źródło prawdy o postępach. Trzyma cały zbiór w sygnale, a każdą
 * zmianę odkłada do IndexedDB.
 *
 * Gdy bazy nie ma (tryb prywatny, zablokowane dane), gra działa dalej —
 * tyle że postęp znika po zamknięciu karty. Lepsze to niż biały ekran.
 */
@Service()
export class FactStore {
  private readonly facts = signal<readonly Fact[]>(allFacts());
  private readonly loaded = signal(false);
  private readonly persistent = signal(false);
  private db: IDBDatabase | null = null;
  private readonly rng: Rng = Math.random;

  /** `false` dopóki nie wiemy, co jest w bazie — do tego czasu nie zaczynamy gry. */
  readonly ready = this.loaded.asReadonly();

  /** `false`, gdy postęp nie przetrwa zamknięcia karty. */
  readonly saving = this.persistent.asReadonly();

  readonly all = this.facts.asReadonly();
  readonly progress = computed(() => trackedProgress(this.facts()));

  /** Ile faktów wolno w tej chwili wpuścić do arcade. */
  readonly arcadeReady = computed(() => this.facts().filter(isArcadeReady).length);

  constructor() {
    void this.load();
  }

  /** Następny fakt do arcade — tylko te o `mastery >= 2`. */
  nextArcade(onScreen: readonly Fact[], lastKey: FactKey | null): Fact | null {
    return nextFact(this.facts(), {
      now: Date.now(),
      rng: this.rng,
      onScreen,
      lastKey,
      eligible: isArcadeReady,
    });
  }

  /**
   * Fakt do dobrania do zestawu roboczego trybu spokojnego — cały zbiór,
   * łącznie z nieznanymi, z pominięciem tego, co już w zestawie jest.
   */
  nextCalm(exclude: readonly FactKey[]): Fact | null {
    return nextFact(this.facts(), {
      now: Date.now(),
      rng: this.rng,
      excludeKeys: exclude,
    });
  }

  find(key: FactKey): Fact | null {
    return this.facts().find((fact) => keyOf(fact) === key) ?? null;
  }

  record(event: AnswerEvent): void {
    const now = Date.now();
    let updated: Fact | null = null;

    this.facts.update((facts) =>
      facts.map((fact) => {
        if (keyOf(fact) !== event.key) {
          return fact;
        }
        updated = applyAnswer(fact, event, now);
        return updated;
      }),
    );

    if (updated !== null) {
      void this.persist([updated]);
    }
  }

  /** Kasuje cały postęp. Dla rodzica, który chce zacząć od zera. */
  async reset(): Promise<void> {
    this.facts.set(allFacts());
    if (this.db !== null) {
      try {
        await clearStore(this.db, FACTS_STORE);
      } catch {
        this.persistent.set(false);
      }
    }
  }

  private async load(): Promise<void> {
    try {
      if (!isAvailable()) {
        return;
      }
      this.db = await openDb();
      this.facts.set(mergeRecords(await readAll(this.db, FACTS_STORE)));
      this.persistent.set(true);
    } catch {
      // Baza niedostępna — gramy w pamięci.
      this.db = null;
    } finally {
      this.loaded.set(true);
    }
  }

  private async persist(facts: readonly Fact[]): Promise<void> {
    if (this.db === null) {
      return;
    }
    try {
      await writeAll(this.db, FACTS_STORE, facts.map(toRecord));
    } catch {
      this.persistent.set(false);
    }
  }
}
