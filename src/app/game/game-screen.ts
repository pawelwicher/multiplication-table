import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  LINE_PAUSE_MS,
  START_LIVES,
  WRONG_ANSWER_SPEEDUP,
  flightDurationMs,
  levelForCorrect,
  maxTiles,
  pointsFor,
  pressBackspace,
  pressDigit,
  pressEnter,
  resolveTimeout,
  type InputOutcome,
  type TileAnswer,
} from '../domain/arcade';
import { factProduct, keyOf, type Fact, type FactKey } from '../domain/fact';
import { FactStore } from '../state/fact-store';
import { Hud } from './hud';
import { Numpad } from './numpad';

/** Musi się zgadzać z `.tile { height }` w stylach poniżej. */
const TILE_HEIGHT = 68;

/** Odległość linii od dolnej krawędzi pola. Musi się zgadzać z `.line { bottom }`. */
const LINE_OFFSET = 72;

/** Pole gry dzielimy na stałe trzy pasy, niezależnie od limitu kafelków. */
const LANES = 3;

const LANE_PADDING = 6;

/** Po powrocie z tła `dt` potrafi wynieść kilka sekund — kafelki teleportowałyby się za linię. */
const MAX_FRAME_MS = 100;

const WRONG_FLASH_MS = 220;

/** Kafelek widziany przez szablon. Zmienia się tylko przy pojawieniu, trafieniu i minięciu linii. */
interface TileView {
  readonly id: number;
  readonly a: number;
  readonly b: number;
  readonly answer: number;
  readonly missed: boolean;
}

/**
 * Ruch kafelka. Świadomie zwykły obiekt, nie sygnał — zmienia się co klatkę
 * i nie ma prawa uruchamiać detekcji zmian.
 */
interface Motion {
  readonly fact: Fact;
  readonly answer: number;
  x: number;
  y: number;
  /** px na milisekundę; wyliczane z `lineY`, `flightMs` i `speedFactor`. */
  speed: number;
  /** Czas przelotu z poziomu, na którym kafelek się pojawił. */
  readonly flightMs: number;
  /** Narastające przyspieszenie za złe odpowiedzi. Trzymane osobno, żeby przeliczenie
      prędkości po zmianie rozmiaru ekranu go nie kasowało. */
  speedFactor: number;
  lane: number;
  spawnedAt: number;
  /** `0` gdy kafelek leci; inaczej znacznik czasu, do którego stoi za linią. */
  frozenUntil: number;
  el: HTMLElement | null;
}

@Component({
  selector: 'app-game-screen',
  imports: [Hud, Numpad, RouterLink],
  host: { '(document:keydown)': 'onKey($event)' },
  template: `
    <main class="game">
      <app-hud [lives]="lives()" [score]="score()" [level]="level()" [streak]="streak()" />

      <section class="field" #field>
        @for (tile of tiles(); track tile.id) {
          <div class="tile" [class.tile--missed]="tile.missed" [attr.data-tile]="tile.id">
            @if (tile.missed) {
              {{ tile.a }} × {{ tile.b }} = {{ tile.answer }}
            } @else {
              {{ tile.a }} × {{ tile.b }}
            }
          </div>
        }
        <div class="line"></div>
      </section>

      <div class="echo" [class.echo--wrong]="wrong()" aria-live="polite">{{ buffer() }}</div>

      <div class="pad">
        <app-numpad (digit)="onDigit($event)" (backspace)="onBackspace()" (submit)="onSubmit()" />
      </div>

      @if (over()) {
        <div class="over" role="dialog" aria-modal="true" aria-label="Koniec gry">
          <h2>Koniec gry</h2>
          <p class="over__score">{{ score() }}</p>
          <p class="over__label">punktów · poziom {{ level() }}</p>
          <button type="button" class="over__again" (click)="restart()">Jeszcze raz</button>
          <a class="over__link" routerLink="/map">Mapa opanowania</a>
        </div>
      }
    </main>
  `,
  styles: `
    .game {
      display: grid;
      grid-template-rows: auto 1fr auto var(--numpad-share);
      position: relative;
      height: 100%;
    }

    .field {
      min-height: 0;
      position: relative;
      overflow: hidden;
    }

    .tile {
      position: absolute;
      top: 0;
      left: 0;
      display: grid;
      place-items: center;
      width: calc(100% / 3 - 12px);
      height: 68px;
      border: 1px solid var(--edge);
      border-radius: var(--radius);
      background: var(--tile-face);
      box-shadow: 0 6px 18px rgb(0 0 0 / 35%);
      font-size: 1.45rem;
      font-weight: 700;
      white-space: nowrap;

      /* Pozycję ustawia wyłącznie pętla gry, wpisując transform prosto w element.
         Szablon go nie dotyka, więc odświeżenie widoku nie cofa kafelka. */
      transform: translate3d(0, -200px, 0);
      will-change: transform;
    }

    .tile--missed {
      border-color: var(--danger);
      background: linear-gradient(160deg, #5c1f30, #3a1220);
      color: var(--danger);
      font-size: 1.05rem;
    }

    .line {
      position: absolute;
      right: 0;
      bottom: 72px;
      left: 0;
      height: 2px;
      background: repeating-linear-gradient(
        90deg,
        var(--danger) 0 12px,
        transparent 12px 24px
      );
    }

    .echo {
      display: grid;
      place-items: center;
      min-height: 52px;
      border-top: 1px solid var(--edge);
      background: var(--bg-sunken);
      font-size: 1.9rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      transition: color 100ms ease;
    }

    .echo--wrong {
      color: var(--danger);
    }

    .pad {
      min-height: 0;
    }

    .over {
      position: absolute;
      inset: 0;
      z-index: 1;
      display: flex;
      flex-direction: column;
      gap: 6px;
      align-items: center;
      justify-content: center;
      background: rgb(7 11 24 / 92%);
      text-align: center;
    }

    .over h2 {
      margin: 0 0 8px;
      font-size: 1.5rem;
    }

    .over__score {
      margin: 0;
      color: var(--accent-warm);
      font-size: 3.5rem;
      font-weight: 800;
      line-height: 1;
    }

    .over__label {
      margin: 0 0 20px;
      color: var(--ink-dim);
    }

    .over__again {
      padding: 14px 32px;
      border-radius: var(--radius);
      background: var(--accent);
      color: #06202b;
      font-size: 1.1rem;
      font-weight: 700;
    }

    .over__link {
      margin-top: 14px;
      color: var(--ink-dim);
      font-size: 0.9rem;
    }
  `,
})
export class GameScreen {
  private readonly store = inject(FactStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly field = viewChild.required<ElementRef<HTMLElement>>('field');

  // Stan dyskretny — i tylko taki — mieszka w sygnałach.
  protected readonly tiles = signal<readonly TileView[]>([]);
  protected readonly buffer = signal('');
  protected readonly lives = signal(START_LIVES);
  protected readonly score = signal(0);
  protected readonly streak = signal(0);
  protected readonly wrong = signal(false);
  protected readonly over = signal(false);
  private readonly correct = signal(0);
  protected readonly level = computed(() => levelForCorrect(this.correct()));

  private readonly motions = new Map<number, Motion>();
  private nextId = 1;
  private lastKey: FactKey | null = null;
  private lastTs = 0;
  private lastSpawnTs = Number.NEGATIVE_INFINITY;
  private frame = 0;
  private prefixTimer = 0;
  private wrongTimer = 0;
  private fieldWidth = 0;
  private lineY = 0;
  private pendingOver = false;

  constructor() {
    afterNextRender(() => {
      const element = this.field().nativeElement;
      const observer = new ResizeObserver(() => this.measure(element));
      observer.observe(element);
      this.measure(element);
      this.start();

      this.destroyRef.onDestroy(() => {
        observer.disconnect();
        this.stop();
      });
    });
  }

  protected onDigit(digit: number): void {
    this.apply(pressDigit(this.buffer(), digit, this.answers()));
  }

  protected onBackspace(): void {
    this.apply(pressBackspace(this.buffer()));
  }

  protected onSubmit(): void {
    this.apply(pressEnter(this.buffer(), this.answers()));
  }

  protected onKey(event: KeyboardEvent): void {
    if (this.over()) {
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

  protected restart(): void {
    this.motions.clear();
    this.tiles.set([]);
    this.buffer.set('');
    this.lives.set(START_LIVES);
    this.score.set(0);
    this.streak.set(0);
    this.correct.set(0);
    this.over.set(false);
    this.lastKey = null;
    this.lastSpawnTs = Number.NEGATIVE_INFINITY;
    this.pendingOver = false;
    this.start();
  }

  // ——— pętla gry ———

  private start(): void {
    this.stop();
    this.lastTs = performance.now();
    this.frame = requestAnimationFrame(this.tick);
  }

  private stop(): void {
    if (this.frame !== 0) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    }
    this.clearPrefixTimer();
    window.clearTimeout(this.wrongTimer);
  }

  private readonly tick = (ts: number): void => {
    const dt = Math.min(ts - this.lastTs, MAX_FRAME_MS);
    this.lastTs = ts;

    for (const [id, motion] of this.motions) {
      if (motion.frozenUntil > 0) {
        if (ts >= motion.frozenUntil) {
          this.despawn(id);
        }
        continue;
      }

      motion.y += motion.speed * dt;
      this.paint(id, motion);

      if (motion.y + TILE_HEIGHT >= this.lineY) {
        this.crossLine(id, motion, ts);
      }
    }

    // `finish()` mogło właśnie zatrzymać grę — bez tego wyjścia pętla wskrzeszałaby
    // samą siebie i sypała kafelkami po ekranie końca.
    if (this.over()) {
      this.frame = 0;
      return;
    }

    if (!this.pendingOver) {
      this.trySpawn(ts);
    }
    this.frame = requestAnimationFrame(this.tick);
  };

  /** Jedyne miejsce, w którym cokolwiek rusza się co klatkę. Zapis prosto do stylu elementu. */
  private paint(id: number, motion: Motion): void {
    motion.el ??= this.field().nativeElement.querySelector<HTMLElement>(`[data-tile="${id}"]`);
    if (motion.el !== null) {
      motion.el.style.transform = `translate3d(${motion.x}px, ${motion.y}px, 0)`;
    }
  }

  /**
   * Obrót ekranu albo pojawienie się paska przeglądarki zmienia wysokość pola.
   * Przeliczamy wtedy nie tylko pozycje, ale i prędkości — inaczej kafelki
   * zmierzone przy zerowej wysokości leciałyby w złym tempie do końca gry.
   */
  private measure(element: HTMLElement): void {
    const previousLineY = this.lineY;
    this.fieldWidth = element.clientWidth;
    this.lineY = Math.max(TILE_HEIGHT * 2, element.clientHeight - LINE_OFFSET);

    for (const motion of this.motions.values()) {
      motion.x = this.laneX(motion.lane);
      if (previousLineY > 0) {
        motion.y = (motion.y / previousLineY) * this.lineY;
      }
      motion.speed = this.speedOf(motion);
    }
  }

  private speedOf(motion: Pick<Motion, 'flightMs' | 'speedFactor'>): number {
    return (this.lineY / motion.flightMs) * motion.speedFactor;
  }

  private laneX(lane: number): number {
    return lane * (this.fieldWidth / LANES) + LANE_PADDING;
  }

  private freeLane(): number {
    const taken = new Set([...this.motions.values()].map((motion) => motion.lane));
    const free = Array.from({ length: LANES }, (_, lane) => lane).filter((lane) => !taken.has(lane));
    return free.length === 0 ? 0 : (free[Math.floor(Math.random() * free.length)] as number);
  }

  private trySpawn(ts: number): void {
    const limit = maxTiles(this.level());
    if (this.motions.size >= limit) {
      return;
    }

    const flight = flightDurationMs(this.level());
    if (ts - this.lastSpawnTs < flight / limit) {
      return;
    }

    const onScreen = [...this.motions.values()].map((motion) => motion.fact);
    const fact = this.store.next(onScreen, this.lastKey);
    if (fact === null) {
      return;
    }

    const id = this.nextId++;
    const lane = this.freeLane();
    this.motions.set(id, {
      fact,
      answer: factProduct(fact),
      x: this.laneX(lane),
      y: -TILE_HEIGHT,
      speed: this.speedOf({ flightMs: flight, speedFactor: 1 }),
      flightMs: flight,
      speedFactor: 1,
      lane,
      spawnedAt: ts,
      frozenUntil: 0,
      el: null,
    });

    this.lastKey = keyOf(fact);
    this.lastSpawnTs = ts;
    this.tiles.update((tiles) => [
      ...tiles,
      { id, a: fact.a, b: fact.b, answer: factProduct(fact), missed: false },
    ]);
  }

  /**
   * Kafelek minął linię. Zatrzymujemy go na sekundę z pełnym działaniem —
   * to moment, w którym dziecko najbardziej uważa.
   */
  private crossLine(id: number, motion: Motion, ts: number): void {
    motion.frozenUntil = ts + LINE_PAUSE_MS;
    motion.y = this.lineY - TILE_HEIGHT;
    this.paint(id, motion);

    this.store.record({
      key: keyOf(motion.fact),
      correct: false,
      elapsedMs: ts - motion.spawnedAt,
      noisy: this.motions.size > 1,
    });

    this.streak.set(0);
    this.buffer.set('');
    this.tiles.update((tiles) => tiles.map((tile) => (tile.id === id ? { ...tile, missed: true } : tile)));

    const remaining = this.lives() - 1;
    this.lives.set(Math.max(0, remaining));
    if (remaining <= 0) {
      this.pendingOver = true;
    }
  }

  private despawn(id: number): void {
    this.motions.delete(id);
    this.tiles.update((tiles) => tiles.filter((tile) => tile.id !== id));

    // Ekran końca dopiero po tym, jak ostatni kafelek za linią pokaże swoje działanie.
    const revealing = [...this.motions.values()].some((motion) => motion.frozenUntil > 0);
    if (this.pendingOver && !revealing) {
      this.finish();
    }
  }

  private finish(): void {
    this.pendingOver = false;
    this.stop();
    this.motions.clear();
    this.tiles.set([]);
    this.buffer.set('');
    this.over.set(true);
  }

  // ——— wejście ———

  /** Kafelki posortowane od najpilniejszego. Te za linią już nie przyjmują odpowiedzi. */
  private answers(): TileAnswer[] {
    return [...this.motions.entries()]
      .filter(([, motion]) => motion.frozenUntil === 0)
      .sort(([, x], [, y]) => y.y - x.y)
      .map(([id, motion]) => ({ id, answer: motion.answer }));
  }

  private apply(outcome: InputOutcome): void {
    if (this.over()) {
      return;
    }

    this.buffer.set(outcome.buffer);
    this.clearPrefixTimer();

    switch (outcome.effect.kind) {
      case 'wait':
        this.prefixTimer = window.setTimeout(
          () => this.apply(resolveTimeout(this.buffer(), this.answers())),
          outcome.effect.ms,
        );
        break;
      case 'commit':
        this.commit(outcome.effect.tileId);
        break;
      case 'miss':
        this.miss();
        break;
      case 'none':
        break;
    }
  }

  private commit(tileId: number): void {
    const motion = this.motions.get(tileId);
    if (motion === undefined) {
      return;
    }

    this.store.record({
      key: keyOf(motion.fact),
      correct: true,
      elapsedMs: performance.now() - motion.spawnedAt,
      noisy: this.motions.size > 1,
    });

    const streak = this.streak() + 1;
    this.streak.set(streak);
    this.score.update((score) => score + pointsFor(this.level(), streak));
    this.correct.update((count) => count + 1);
    this.despawn(tileId);
  }

  /**
   * Zła odpowiedź nie zabiera życia — kafelki tylko nieznacznie przyspieszają.
   * Nie zapisujemy jej też w historii faktu: skoro liczba nie pasuje do żadnego
   * kafelka, nie wiadomo, o które działanie dziecku chodziło.
   */
  private miss(): void {
    this.streak.set(0);
    for (const motion of this.motions.values()) {
      if (motion.frozenUntil === 0) {
        motion.speedFactor *= WRONG_ANSWER_SPEEDUP;
        motion.speed = this.speedOf(motion);
      }
    }

    this.wrong.set(true);
    window.clearTimeout(this.wrongTimer);
    this.wrongTimer = window.setTimeout(() => this.wrong.set(false), WRONG_FLASH_MS);
  }

  private clearPrefixTimer(): void {
    window.clearTimeout(this.prefixTimer);
    this.prefixTimer = 0;
  }
}
