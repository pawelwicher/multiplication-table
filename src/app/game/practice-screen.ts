import { Component, computed, effect, inject, signal } from '@angular/core';

import { readDifficulty, writeDifficulty } from '../data/preferences';
import {
  DIFFICULTIES,
  difficultyLabel,
  factsWithin,
  withinDifficulty,
  type Difficulty,
} from '../domain/difficulty';
import { factProduct, keyOf, type Fact, type FactKey } from '../domain/fact';
import { countMastered } from '../domain/mastery';
import {
  WORKING_SET,
  answerQuestion,
  hasGraduated,
  isSessionDone,
  pickFromSet,
  rememberAsked,
  resolveBuffer,
  sessionProgress,
  startSession,
} from '../domain/practice';
import { FactStore } from '../state/fact-store';
import { Numpad } from './numpad';

@Component({
  selector: 'app-practice-screen',
  imports: [Numpad],
  host: { '(document:keydown)': 'onKey($event)' },
  template: `
    <main class="screen">
      <header class="bar">
        <div class="levels" role="group" aria-label="Poziom trudności">
          @for (level of levels; track level) {
            <button
              type="button"
              class="level"
              [class.level--on]="level === difficulty()"
              [attr.aria-pressed]="level === difficulty()"
              (click)="setDifficulty(level)"
            >
              {{ label(level) }}
            </button>
          }
        </div>
      </header>

      <div class="status">
        <div class="progress" aria-hidden="true">
          <div class="progress__fill" [style.width.%]="progress() * 100"></div>
        </div>
        <span class="count">{{ session().asked }}/{{ session().length }}</span>
        <span class="known">umiesz {{ known().mastered }}/{{ known().total }}</span>
      </div>

      @if (done()) {
        <section class="summary">
          <h2>Koniec sesji</h2>
          <p class="summary__score">{{ session().correct }} / {{ session().length }}</p>
          <p class="summary__label">za pierwszym razem</p>
          <button type="button" class="primary" (click)="restart()">Jeszcze raz</button>
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

      @if (store.ready() && !store.saving()) {
        <p class="warn">Postęp nie zapisze się w tej przeglądarce.</p>
      }
    </main>
  `,
  styles: `
    .screen {
      display: grid;
      /* minmax(0, 1fr) zamiast domyślnego auto: bez tego najszerszy wiersz
         rozpycha całą siatkę i numpad wychodzi poza ekran. */
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto auto 1fr var(--numpad-share);
      height: 100%;
    }

    .bar {
      min-width: 0;
      border-bottom: 1px solid var(--edge);
      background: var(--bg-sunken);
    }

    /* Wszystkie dziewięć progów naraz — chowanie ich w poziomym scrollu
       znaczyłoby, że dziecko o nich nie wie. */
    .levels {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      justify-content: center;
      padding: 10px 12px;
    }

    .level {
      flex: none;
      padding: 7px 13px;
      border: 1px solid var(--edge);
      border-radius: 999px;
      background: var(--bg-raised);
      color: var(--ink-dim);
      font-size: 0.82rem;
      font-weight: 600;
      white-space: nowrap;
      -webkit-tap-highlight-color: transparent;
    }

    .level--on {
      border-color: var(--accent);
      background: var(--accent);
      color: #06202b;
    }

    .status {
      display: flex;
      gap: 10px;
      align-items: center;
      padding: 8px 16px;
      color: var(--ink-dim);
      font-size: 0.78rem;
    }

    .progress {
      flex: 1;
      height: 6px;
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

    .known {
      color: var(--good);
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
      grid-row: 3 / 5;
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

    .loading {
      display: grid;
      place-items: center;
      grid-row: 3 / 5;
      color: var(--ink-dim);
    }

    .warn {
      margin: 0;
      padding: 0 16px 10px;
      color: var(--accent-warm);
      font-size: 0.72rem;
      text-align: center;
    }
  `,
})
export class PracticeScreen {
  protected readonly store = inject(FactStore);

  protected readonly levels = DIFFICULTIES;
  protected readonly difficulty = signal<Difficulty>(readDifficulty());

  protected readonly fact = signal<Fact | null>(null);
  protected readonly buffer = signal('');
  protected readonly revealed = signal(false);
  protected readonly session = signal(startSession());

  protected readonly done = computed(() => isSessionDone(this.session()));
  protected readonly progress = computed(() => sessionProgress(this.session()));

  /** Ile działań w wybranym progu jest już opanowanych. */
  protected readonly known = computed(() =>
    countMastered(factsWithin(this.store.all(), this.difficulty())),
  );

  /** W polu wyniku widać albo to, co wpisuje dziecko, albo podpowiedziany wynik. */
  protected readonly shown = computed(() => {
    if (this.revealed() && this.buffer().length === 0) {
      const current = this.fact();
      return current === null ? '' : String(factProduct(current));
    }
    return this.buffer();
  });

  private askedAt = 0;

  /** Ostatnio zadane pytania — pilnują, żeby działanie nie wróciło za szybko. */
  private recent: FactKey[] = [];

  /** Działania krążące w tej sesji. Wypadają dopiero po awansie. */
  private workingSet: FactKey[] = [];

  constructor() {
    // Baza wczytuje się asynchronicznie; pierwsze pytanie dopiero po niej,
    // inaczej pytalibyśmy o działania ze świeżego zbioru zamiast z zapisanych postępów.
    effect(() => {
      if (this.store.ready() && this.fact() === null && !this.done()) {
        this.ask();
      }
    });
  }

  protected label(difficulty: Difficulty): string {
    return difficultyLabel(difficulty);
  }

  /** Zmiana progu zaczyna sesję od nowa — stary zestaw roboczy może być spoza zakresu. */
  protected setDifficulty(difficulty: Difficulty): void {
    if (difficulty === this.difficulty()) {
      return;
    }
    this.difficulty.set(difficulty);
    writeDifficulty(difficulty);
    this.restart();
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
      if (event.key === 'Enter') {
        event.preventDefault();
        this.restart();
      }
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
    this.recent = [];
    this.ask();
  }

  private apply(buffer: string): void {
    const current = this.fact();
    if (current === null || this.done()) {
      return;
    }

    const answer = factProduct(current);
    switch (resolveBuffer(buffer, answer)) {
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
    // więc nie zapisujemy tego jako poprawnej odpowiedzi.
    const firstTry = !this.revealed();
    if (firstTry) {
      this.store.record({
        key: keyOf(current),
        correct: true,
        elapsedMs: Date.now() - this.askedAt,
        // Jedno działanie na ekranie, więc pomiar jest czysty.
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

  /** Co osiągnęło próg opanowania, wraca do normalnego rytmu powtórek. */
  private retireGraduates(): void {
    this.workingSet = this.workingSet.filter((key) => {
      const fact = this.store.find(key);
      return fact !== null && !hasGraduated(fact);
    });
  }

  private refill(): void {
    const difficulty = this.difficulty();
    while (this.workingSet.length < WORKING_SET) {
      const next = this.store.next(this.workingSet, (fact) => withinDifficulty(fact, difficulty));
      if (next === null) {
        return;
      }
      this.workingSet.push(keyOf(next));
    }
  }

  private ask(): void {
    this.refill();
    const key = pickFromSet(this.workingSet, this.recent, Math.random);
    this.fact.set(key === null ? null : this.store.find(key));
    if (key !== null) {
      this.recent = rememberAsked(this.recent, key);
    }
    this.askedAt = Date.now();
  }
}
