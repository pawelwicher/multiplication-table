import { Service, computed, inject, signal } from '@angular/core';
import { Problem, generateProblem } from '../domain/generator';
import { Rng } from '../domain/random';
import { awardFor, starsFor, streakMultiplier } from '../domain/scoring';
import { generateTableProblem } from '../domain/tables';
import { SettingsStore } from './settings-store';

export type Phase = 'ask' | 'reveal';

const MAX_DIGITS = 4;

@Service()
export class GameStore {
  private readonly settings = inject(SettingsStore);
  /** Jedyne miejsce, w którym gra sięga po losowość — domena dostaje ją jako argument. */
  private readonly rng: Rng = () => Math.random();

  readonly problem = signal<Problem | null>(null);
  readonly entry = signal('');
  readonly phase = signal<Phase>('ask');

  readonly correct = signal(0);
  readonly wrong = signal(0);
  readonly points = signal(0);
  readonly streak = signal(0);
  readonly bestStreak = signal(0);
  readonly lastGain = signal(0);
  readonly lastCorrect = signal(false);

  readonly answered = computed(() => this.correct() + this.wrong());
  readonly multiplier = computed(() => streakMultiplier(this.streak()));
  readonly stars = computed(() => starsFor(this.correct(), this.wrong()));
  readonly accuracy = computed(() => {
    const total = this.answered();
    return total === 0 ? 0 : Math.round((this.correct() / total) * 100);
  });
  readonly canSubmit = computed(() => this.phase() === 'ask' && this.entry().length > 0);

  start(): void {
    this.correct.set(0);
    this.wrong.set(0);
    this.points.set(0);
    this.streak.set(0);
    this.bestStreak.set(0);
    this.lastGain.set(0);
    this.next();
  }

  next(): void {
    this.entry.set('');
    this.phase.set('ask');
    this.problem.set(this.draw());
  }

  press(digit: string): void {
    if (this.phase() !== 'ask') return;
    this.entry.update((value) => {
      if (value.length >= MAX_DIGITS) return value;
      // Wiodące zero nie ma sensu, ale samo „0” jest poprawną odpowiedzią.
      if (value === '0') return digit;
      return value + digit;
    });
  }

  erase(): void {
    if (this.phase() !== 'ask') return;
    this.entry.update((value) => value.slice(0, -1));
  }

  clear(): void {
    if (this.phase() !== 'ask') return;
    this.entry.set('');
  }

  submit(): void {
    const problem = this.problem();
    if (!problem || !this.canSubmit()) return;

    const given = Number(this.entry());
    const ok = given === problem.answer;
    this.lastCorrect.set(ok);

    if (ok) {
      const gain = awardFor(problem.points, this.streak());
      this.lastGain.set(gain);
      this.points.update((p) => p + gain);
      this.correct.update((c) => c + 1);
      this.streak.update((s) => s + 1);
      this.bestStreak.update((best) => Math.max(best, this.streak()));
    } else {
      this.lastGain.set(0);
      this.wrong.update((w) => w + 1);
      this.streak.set(0);
    }

    this.phase.set('reveal');
    this.settings.recordBest(this.points());
  }

  private draw(): Problem {
    return this.settings.mode() === 'tables'
      ? generateTableProblem(this.settings.tables(), this.rng)
      : generateProblem(this.settings.custom(), this.rng);
  }
}
