import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  CALM_WORKING_SET,
  answerQuestion,
  calmResolve,
  hasGraduated,
  isSessionDone,
  pickFromSet,
  sessionProgress,
  startSession,
} from '../domain/calm';
import { factProduct, keyOf, type Fact, type FactKey } from '../domain/fact';
import { FactStore } from '../state/fact-store';
import { Numpad } from './numpad';

@Component({
  selector: 'app-calm-screen',
  imports: [Numpad, RouterLink],
  host: { '(document:keydown)': 'onKey($event)' },
  template: `
    <main class="calm">
      <header class="bar">
        <a class="back" routerLink="/" aria-label="Wróć do menu">‹</a>
        <div class="progress" [attr.aria-label]="'Postęp sesji'">
          <div class="progress__fill" [style.width.%]="progress() * 100"></div>
        </div>
        <span class="count">{{ session().asked }}/{{ session().length }}</span>
      </header>

      @if (done()) {
        <section class="summary">
          <h2>Koniec sesji</h2>
          <p class="summary__score">{{ session().correct }} / {{ session().length }}</p>
          <p class="summary__label">za pierwszym razem</p>
          <button type="button" class="primary" (click)="restart()">Jeszcze raz</button>
          <a class="secondary" routerLink="/game">Spróbuj arcade</a>
          <a class="secondary" routerLink="/map">Mapa opanowania</a>
        </section>
      } @else if (fact(); as current) {
        <section class="question" [class.question--revealed]="revealed()">
          <p class="equation">
            {{ current.a }} × {{ current.b }} =
            <span class="slot">{{ shown() }}</span>
          </p>

          @if (revealed()) {
            <p class="hint">Przepisz wynik</p>
          } @else {
            <button type="button" class="reveal" (click)="reveal()">Nie wiem</button>
          }
        </section>

        <div class="pad">
          <app-numpad (digit)="onDigit($event)" (backspace)="onBackspace()" (submit)="onSubmit()" />
        </div>
      } @else {
        <p class="loading">Wczytuję…</p>
      }
    </main>
  `,
  styles: `
    .calm {
      display: grid;
      grid-template-rows: auto 1fr var(--numpad-share);
      height: 100%;
    }

    .bar {
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 10px 16px;
      border-bottom: 1px solid var(--edge);
      background: var(--bg-sunken);
    }

    .back {
      padding: 0 8px;
      color: var(--ink-dim);
      font-size: 1.6rem;
      line-height: 1;
      text-decoration: none;
    }

    .progress {
      flex: 1;
      height: 8px;
      overflow: hidden;
      border-radius: 999px;
      background: var(--bg-raised);
    }

    .progress__fill {
      height: 100%;
      border-radius: 999px;
      background: var(--accent);
      transition: width 200ms ease;
    }

    .count {
      color: var(--ink-dim);
      font-size: 0.85rem;
    }

    .question {
      display: flex;
      flex-direction: column;
      gap: 22px;
      align-items: center;
      justify-content: center;
      min-height: 0;
      padding: 16px;
    }

    .equation {
      margin: 0;
      font-size: clamp(2rem, 11vw, 3.25rem);
      font-weight: 700;
      white-space: nowrap;
    }

    .slot {
      display: inline-block;
      min-width: 2.4ch;
      border-bottom: 4px solid var(--edge);
      color: var(--accent);
      text-align: center;
    }

    .question--revealed .slot {
      border-bottom-color: var(--danger);
      color: var(--danger);
    }

    .hint {
      margin: 0;
      color: var(--danger);
      font-size: 0.95rem;
    }

    .reveal {
      padding: 10px 22px;
      border: 1px solid var(--edge);
      border-radius: var(--radius);
      color: var(--ink-dim);
      font-size: 0.95rem;
    }

    .pad {
      min-height: 0;
    }

    .summary {
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: center;
      justify-content: center;
      grid-row: 2 / 4;
      padding: 24px;
      text-align: center;
    }

    .summary h2 {
      margin: 0;
      font-size: 1.4rem;
    }

    .summary__score {
      margin: 0;
      color: var(--good);
      font-size: 3rem;
      font-weight: 800;
      line-height: 1;
    }

    .summary__label {
      margin: 0 0 18px;
      color: var(--ink-dim);
    }

    .primary {
      padding: 14px 32px;
      border-radius: var(--radius);
      background: var(--accent);
      color: #06202b;
      font-size: 1.05rem;
      font-weight: 700;
    }

    .secondary {
      margin-top: 10px;
      color: var(--ink-dim);
      font-size: 0.9rem;
    }

    .loading {
      display: grid;
      place-items: center;
      grid-row: 2 / 4;
      color: var(--ink-dim);
    }
  `,
})
export class CalmScreen {
  private readonly store = inject(FactStore);

  protected readonly fact = signal<Fact | null>(null);
  protected readonly buffer = signal('');
  protected readonly revealed = signal(false);
  protected readonly session = signal(startSession());

  protected readonly done = computed(() => isSessionDone(this.session()));
  protected readonly progress = computed(() => sessionProgress(this.session()));

  /** W polu wyniku widać albo to, co wpisuje dziecko, albo podpowiedziany wynik. */
  protected readonly shown = computed(() => {
    if (this.revealed() && this.buffer().length === 0) {
      const current = this.fact();
      return current === null ? '' : String(factProduct(current));
    }
    return this.buffer();
  });

  private askedAt = 0;
  private lastKey: FactKey | null = null;

  /**
   * Działania krążące w tej sesji. Fakt wypada dopiero po awansie na poziom 2 —
   * kolejka Leitnera odesłałaby go o dziesięć minut, czyli poza sesję.
   */
  private workingSet: FactKey[] = [];

  constructor() {
    // Baza wczytuje się asynchronicznie; pierwsze pytanie dopiero po niej,
    // inaczej pytalibyśmy o fakty ze świeżego zbioru zamiast z zapisanych postępów.
    effect(() => {
      if (this.store.ready() && this.fact() === null && !this.done()) {
        this.ask();
      }
    });
  }

  protected onDigit(digit: number): void {
    this.apply(this.buffer() + String(digit));
  }

  protected onBackspace(): void {
    this.buffer.update((buffer) => buffer.slice(0, -1));
  }

  protected onSubmit(): void {
    // Enter jest tu tylko skrótem; auto-commit i tak zdąży wcześniej.
    this.apply(this.buffer());
  }

  protected onKey(event: KeyboardEvent): void {
    if (this.done()) {
      return;
    }
    if (event.key >= '0' && event.key <= '9') {
      event.preventDefault();
      this.onDigit(Number(event.key));
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      this.onBackspace();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.onSubmit();
    }
  }

  /** „Nie wiem" — pokazujemy wynik i liczymy pytanie jako nietrafione. */
  protected reveal(): void {
    if (this.revealed()) {
      return;
    }
    this.buffer.set('');
    this.markWrong();
  }

  protected restart(): void {
    this.session.set(startSession());
    this.revealed.set(false);
    this.buffer.set('');
    this.fact.set(null);
    this.workingSet = [];
    this.lastKey = null;
    this.ask();
  }

  private apply(buffer: string): void {
    const current = this.fact();
    if (current === null || this.done()) {
      return;
    }

    const answer = factProduct(current);
    switch (calmResolve(buffer, answer)) {
      case 'buffering':
        this.buffer.set(buffer);
        break;
      case 'commit':
        this.buffer.set(buffer);
        this.commit(current);
        break;
      case 'miss':
        this.buffer.set('');
        this.markWrong();
        break;
    }
  }

  private commit(current: Fact): void {
    // Po podpowiedzi dziecko tylko przepisuje wynik — to nie jest przypomnienie,
    // więc nie zapisujemy tego jako poprawnej odpowiedzi po raz drugi.
    const firstTry = !this.revealed();
    if (firstTry) {
      this.store.record({
        key: keyOf(current),
        correct: true,
        elapsedMs: Date.now() - this.askedAt,
        // Tryb spokojny to jedyne miejsce z czystym pomiarem — stąd poziom 4.
        noisy: false,
      });
    }

    this.session.update((session) => answerQuestion(session, firstTry));
    this.advance();
  }

  private markWrong(): void {
    const current = this.fact();
    if (current === null || this.revealed()) {
      return;
    }
    this.revealed.set(true);
    this.store.record({
      key: keyOf(current),
      correct: false,
      elapsedMs: Date.now() - this.askedAt,
      noisy: false,
    });
  }

  private advance(): void {
    this.revealed.set(false);
    this.buffer.set('');
    this.retireGraduates();

    if (isSessionDone(this.session())) {
      this.fact.set(null);
      return;
    }
    this.ask();
  }

  /** Co awansowało na poziom 2, wraca do normalnego rytmu powtórek. */
  private retireGraduates(): void {
    this.workingSet = this.workingSet.filter((key) => {
      const fact = this.store.find(key);
      return fact !== null && !hasGraduated(fact);
    });
  }

  private refill(): void {
    while (this.workingSet.length < CALM_WORKING_SET) {
      const next = this.store.nextCalm(this.workingSet);
      if (next === null) {
        return;
      }
      this.workingSet.push(keyOf(next));
    }
  }

  private ask(): void {
    this.refill();
    const key = pickFromSet(this.workingSet, this.lastKey, Math.random);
    this.fact.set(key === null ? null : this.store.find(key));
    if (key !== null) {
      this.lastKey = key;
    }
    this.askedAt = Date.now();
  }
}
