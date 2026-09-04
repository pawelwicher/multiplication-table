import { Service, signal } from '@angular/core';

import { mergeRecords, toRecord } from '../data/fact-record';
import { FACTS_STORE, isAvailable, openDb, readAll, writeAll } from '../data/idb';
import { allFacts, keyOf, type AnswerEvent, type Fact, type FactKey } from '../domain/fact';
import { applyAnswer } from '../domain/mastery';
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

  /** `false` dopóki nie wiemy, co jest w bazie — do tego czasu nie zadajemy pytań. */
  readonly ready = this.loaded.asReadonly();

  /** `false`, gdy postęp nie przetrwa zamknięcia karty. */
  readonly saving = this.persistent.asReadonly();

  readonly all = this.facts.asReadonly();

  constructor() {
    void this.load();
  }

  /** Działanie do dobrania do zestawu roboczego, z pominięciem tego, co już w nim jest. */
  next(exclude: readonly FactKey[], eligible: (fact: Fact) => boolean): Fact | null {
    return nextFact(this.facts(), {
      now: Date.now(),
      rng: this.rng,
      excludeKeys: exclude,
      eligible,
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
      void this.persist(updated);
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

  private async persist(fact: Fact): Promise<void> {
    if (this.db === null) {
      return;
    }
    try {
      await writeAll(this.db, FACTS_STORE, [toRecord(fact)]);
    } catch {
      this.persistent.set(false);
    }
  }
}
