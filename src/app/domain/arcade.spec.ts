import {
  BASE_MAX_TILES,
  HIGH_MAX_TILES,
  LEVEL_MAX_FLIGHT_MS,
  LEVEL_MIN_FLIGHT_MS,
  LEVEL_UP_EVERY,
  MAX_LEVEL,
  MIN_LEVEL,
  PREFIX_TIMEOUT_MS,
  THREE_TILE_LEVEL,
  flightDurationMs,
  levelForCorrect,
  maxTiles,
  pointsFor,
  pressBackspace,
  pressDigit,
  pressEnter,
  resolveBuffer,
  resolveTimeout,
  streakMultiplier,
  type TileAnswer,
} from './arcade';

/** 7x8 = 56 i 9x8 = 72 — bez kolizji prefiksów. */
const CLEAN: readonly TileAnswer[] = [
  { id: 1, answer: 56 },
  { id: 2, answer: 72 },
];

/** 8 i 81 — wpisanie „8" jest trafieniem, ale „81" też jest w grze. */
const PREFIX_COLLISION: readonly TileAnswer[] = [
  { id: 1, answer: 8 },
  { id: 2, answer: 81 },
];

describe('flightDurationMs', () => {
  it('trzyma krańce', () => {
    expect(flightDurationMs(MIN_LEVEL)).toBe(LEVEL_MAX_FLIGHT_MS);
    expect(flightDurationMs(MAX_LEVEL)).toBe(LEVEL_MIN_FLIGHT_MS);
  });

  it('maleje monotonicznie', () => {
    for (let level = MIN_LEVEL + 1; level <= MAX_LEVEL; level++) {
      expect(flightDurationMs(level)).toBeLessThan(flightDurationMs(level - 1));
    }
  });

  it('interpoluje liniowo — poziom 8 to ~3,7 s, nie 3 s', () => {
    expect(flightDurationMs(THREE_TILE_LEVEL)).toBeCloseTo(3722, 0);
  });

  it('przycina poziomy spoza zakresu', () => {
    expect(flightDurationMs(0)).toBe(LEVEL_MAX_FLIGHT_MS);
    expect(flightDurationMs(99)).toBe(LEVEL_MIN_FLIGHT_MS);
  });

  it('rzuca na poziomie, który nie jest liczbą', () => {
    expect(() => flightDurationMs(Number.NaN)).toThrow(RangeError);
  });
});

describe('maxTiles', () => {
  it('dwa kafelki poniżej poziomu 8', () => {
    for (let level = MIN_LEVEL; level < THREE_TILE_LEVEL; level++) {
      expect(maxTiles(level)).toBe(BASE_MAX_TILES);
    }
  });

  it('trzy kafelki od poziomu 8', () => {
    for (let level = THREE_TILE_LEVEL; level <= MAX_LEVEL; level++) {
      expect(maxTiles(level)).toBe(HIGH_MAX_TILES);
    }
  });
});

describe('levelForCorrect', () => {
  it('zaczyna od poziomu 1', () => {
    expect(levelForCorrect(0)).toBe(MIN_LEVEL);
    expect(levelForCorrect(LEVEL_UP_EVERY - 1)).toBe(MIN_LEVEL);
  });

  it('awansuje co dziesięć trafień', () => {
    expect(levelForCorrect(LEVEL_UP_EVERY)).toBe(2);
    expect(levelForCorrect(LEVEL_UP_EVERY * 3)).toBe(4);
  });

  it('zatrzymuje się na poziomie 10', () => {
    expect(levelForCorrect(LEVEL_UP_EVERY * 50)).toBe(MAX_LEVEL);
  });

  it('rzuca na ujemnej liczbie', () => {
    expect(() => levelForCorrect(-1)).toThrow(RangeError);
  });
});

describe('punktacja', () => {
  it('mnożnik serii rośnie co pięć trafień i zatrzymuje się na 3', () => {
    expect(streakMultiplier(0)).toBe(1);
    expect(streakMultiplier(4)).toBe(1);
    expect(streakMultiplier(5)).toBe(1.5);
    expect(streakMultiplier(10)).toBe(2);
    expect(streakMultiplier(100)).toBe(3);
  });

  it('nie wywraca się na ujemnej serii', () => {
    expect(streakMultiplier(-5)).toBe(1);
  });

  it('wyższy poziom jest wart więcej', () => {
    expect(pointsFor(1, 0)).toBe(10);
    expect(pointsFor(5, 0)).toBe(50);
    expect(pointsFor(5, 10)).toBe(100);
  });
});

describe('resolveBuffer', () => {
  it('pusty bufor nic nie znaczy', () => {
    expect(resolveBuffer('', CLEAN)).toEqual({ kind: 'buffering' });
  });

  it('prefiks bez trafienia każe czekać', () => {
    expect(resolveBuffer('5', CLEAN)).toEqual({ kind: 'buffering' });
  });

  it('jednoznaczne trafienie zatwierdza', () => {
    expect(resolveBuffer('56', CLEAN)).toEqual({ kind: 'commit', tileId: 1 });
    expect(resolveBuffer('72', CLEAN)).toEqual({ kind: 'commit', tileId: 2 });
  });

  it('trafienie kolidujące z dłuższym wynikiem czeka', () => {
    expect(resolveBuffer('8', PREFIX_COLLISION)).toEqual({ kind: 'pending', tileId: 1 });
  });

  it('doprecyzowanie prefiksu zatwierdza dłuższy', () => {
    expect(resolveBuffer('81', PREFIX_COLLISION)).toEqual({ kind: 'commit', tileId: 2 });
  });

  it('nic niepasującego to pudło', () => {
    expect(resolveBuffer('3', CLEAN)).toEqual({ kind: 'miss' });
    expect(resolveBuffer('57', CLEAN)).toEqual({ kind: 'miss' });
  });

  it('zero na starcie to od razu pudło — żaden wynik nie zaczyna się od zera', () => {
    expect(resolveBuffer('0', CLEAN)).toEqual({ kind: 'miss' });
  });

  it('pusty ekran to pudło, nie zawieszenie', () => {
    expect(resolveBuffer('56', [])).toEqual({ kind: 'miss' });
  });

  it('przy niejednoznaczności wygrywa pierwszy kafelek — najpilniejszy', () => {
    const duplicates: readonly TileAnswer[] = [
      { id: 7, answer: 24 },
      { id: 9, answer: 24 },
    ];
    expect(resolveBuffer('24', duplicates)).toEqual({ kind: 'commit', tileId: 7 });
  });
});

describe('pressDigit', () => {
  it('zatwierdza bez Entera', () => {
    const first = pressDigit('', 5, CLEAN);
    expect(first).toEqual({ buffer: '5', effect: { kind: 'none' } });

    expect(pressDigit(first.buffer, 6, CLEAN)).toEqual({
      buffer: '',
      effect: { kind: 'commit', tileId: 1 },
    });
  });

  it('przy kolizji prefiksów uzbraja timer zamiast zatwierdzać', () => {
    expect(pressDigit('', 8, PREFIX_COLLISION)).toEqual({
      buffer: '8',
      effect: { kind: 'wait', ms: PREFIX_TIMEOUT_MS },
    });
  });

  it('kolejna cyfra rozstrzyga kolizję', () => {
    expect(pressDigit('8', 1, PREFIX_COLLISION)).toEqual({
      buffer: '',
      effect: { kind: 'commit', tileId: 2 },
    });
  });

  it('czyści bufor na pudle', () => {
    expect(pressDigit('', 3, CLEAN)).toEqual({ buffer: '', effect: { kind: 'miss' } });
  });

  it('trzecia niepasująca cyfra też kończy pudłem, bufor nie rośnie w nieskończoność', () => {
    const tiles: readonly TileAnswer[] = [{ id: 1, answer: 100 }];
    expect(pressDigit('', 1, tiles).buffer).toBe('1');
    expect(pressDigit('1', 0, tiles).buffer).toBe('10');
    expect(pressDigit('10', 0, tiles)).toEqual({ buffer: '', effect: { kind: 'commit', tileId: 1 } });
    expect(pressDigit('10', 5, tiles)).toEqual({ buffer: '', effect: { kind: 'miss' } });
  });

  it('rzuca na czymś, co nie jest cyfrą', () => {
    expect(() => pressDigit('', 10, CLEAN)).toThrow(RangeError);
    expect(() => pressDigit('', -1, CLEAN)).toThrow(RangeError);
    expect(() => pressDigit('', 1.5, CLEAN)).toThrow(RangeError);
  });
});

describe('pressBackspace', () => {
  it('kasuje ostatnią cyfrę', () => {
    expect(pressBackspace('56')).toEqual({ buffer: '5', effect: { kind: 'none' } });
  });

  it('na pustym buforze nic nie robi', () => {
    expect(pressBackspace('')).toEqual({ buffer: '', effect: { kind: 'none' } });
  });
});

describe('pressEnter', () => {
  it('zatwierdza trafienie', () => {
    expect(pressEnter('56', CLEAN)).toEqual({ buffer: '', effect: { kind: 'commit', tileId: 1 } });
  });

  it('przecina czekanie na timeout', () => {
    expect(pressEnter('8', PREFIX_COLLISION)).toEqual({
      buffer: '',
      effect: { kind: 'commit', tileId: 1 },
    });
  });

  it('na niedokończonym prefiksie to pudło', () => {
    expect(pressEnter('5', CLEAN)).toEqual({ buffer: '', effect: { kind: 'miss' } });
  });

  it('na pustym buforze nic nie robi', () => {
    expect(pressEnter('', CLEAN)).toEqual({ buffer: '', effect: { kind: 'none' } });
  });
});

describe('resolveTimeout', () => {
  it('zatwierdza trafienie, które czekało', () => {
    expect(resolveTimeout('8', PREFIX_COLLISION)).toEqual({
      buffer: '',
      effect: { kind: 'commit', tileId: 1 },
    });
  });

  it('po zniknięciu kafelka czyści bufor bez obwiniania gracza', () => {
    const afterTileCrossedLine: readonly TileAnswer[] = [{ id: 2, answer: 81 }];
    expect(resolveTimeout('8', afterTileCrossedLine)).toEqual({ buffer: '', effect: { kind: 'none' } });
  });

  it('po zniknięciu całego ekranu też nie karze', () => {
    expect(resolveTimeout('8', [])).toEqual({ buffer: '', effect: { kind: 'none' } });
  });
});
