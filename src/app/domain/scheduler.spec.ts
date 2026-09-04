import { allFacts, createFact, factProduct, keyOf, type Fact, type Mastery } from './fact';
import { ARCADE_MIN_MASTERY, isArcadeReady } from './mastery';
import { DUE_WINDOW, dueFacts, nextFact, type Rng } from './scheduler';

const NOW = 1_700_000_000_000;

/** RNG odgrywający zadaną sekwencję, potem powtarzający ostatnią wartość. */
function scripted(values: readonly number[]): Rng {
  let i = 0;
  return () => {
    const value = values[Math.min(i, values.length - 1)] as number;
    i++;
    return value;
  };
}

const alwaysDue: Rng = scripted([0.0]);
const alwaysReview: Rng = scripted([0.99]);

function withState(a: number, b: number, state: Partial<Fact>): Fact {
  return { ...createFact(a, b), ...state };
}

describe('dueFacts', () => {
  it('zwraca tylko zaległe', () => {
    const facts = [
      withState(3, 4, { dueAt: NOW - 1000 }),
      withState(6, 7, { dueAt: NOW + 1000 }),
      withState(8, 9, { dueAt: NOW }),
    ];
    expect(dueFacts(facts, NOW).map(keyOf)).toEqual(['8x9', '3x4'].sort());
  });

  it('sortuje od najdłużej czekających', () => {
    const facts = [
      withState(3, 4, { dueAt: NOW - 10 }),
      withState(6, 7, { dueAt: NOW - 5000 }),
      withState(8, 9, { dueAt: NOW - 100 }),
    ];
    expect(dueFacts(facts, NOW).map(keyOf)).toEqual(['6x7', '8x9', '3x4']);
  });

  it('rozstrzyga remisy stabilnie', () => {
    const facts = [withState(8, 9, { dueAt: 0 }), withState(3, 4, { dueAt: 0 })];
    expect(dueFacts(facts, NOW).map(keyOf)).toEqual(dueFacts([...facts].reverse(), NOW).map(keyOf));
  });

  it('nie mutuje wejścia', () => {
    const facts = [withState(8, 9, { dueAt: NOW - 1 }), withState(3, 4, { dueAt: NOW - 2 })];
    const order = facts.map(keyOf);
    dueFacts(facts, NOW);
    expect(facts.map(keyOf)).toEqual(order);
  });
});

describe('nextFact — pusta pula', () => {
  it('zwraca null, gdy nic nie przechodzi przez filtr', () => {
    const facts = allFacts();
    expect(nextFact(facts, { now: NOW, rng: alwaysDue, eligible: () => false })).toBeNull();
  });

  it('zwraca null dla pustej listy faktów', () => {
    expect(nextFact([], { now: NOW, rng: alwaysDue })).toBeNull();
  });
});

describe('nextFact — wykluczenia', () => {
  it('nigdy nie zwraca faktu z ekranu', () => {
    const facts = allFacts();
    const onScreen = [facts[0] as Fact, facts[1] as Fact];
    const blocked = new Set(onScreen.map(keyOf));

    for (let i = 0; i < 200; i++) {
      const picked = nextFact(facts, { now: NOW, rng: scripted([i / 200, (i * 7) % 97 / 97]), onScreen });
      expect(picked).not.toBeNull();
      expect(blocked.has(keyOf(picked as Fact))).toBe(false);
    }
  });

  it('nigdy nie zwraca tego samego faktu dwa razy pod rząd', () => {
    const facts = allFacts();
    let last = keyOf(facts[0] as Fact);

    for (let i = 0; i < 200; i++) {
      const picked = nextFact(facts, {
        now: NOW,
        rng: scripted([(i % 10) / 10, ((i * 13) % 97) / 97]),
        lastKey: last,
      });
      expect(picked).not.toBeNull();
      const key = keyOf(picked as Fact);
      expect(key).not.toBe(last);
      last = key;
    }
  });

  it('nigdy nie zwraca faktu o wyniku już obecnym na ekranie', () => {
    const facts = allFacts();
    // 4x6 = 24, na ekranie jest więc też zablokowane 3x8
    const onScreen = [createFact(4, 6)];

    for (let i = 0; i < 200; i++) {
      const picked = nextFact(facts, {
        now: NOW,
        rng: scripted([(i % 10) / 10, ((i * 29) % 97) / 97]),
        onScreen,
      });
      expect(picked).not.toBeNull();
      expect(factProduct(picked as Fact)).not.toBe(24);
    }
  });

  it('kolizja wyników jest realna — 3x8 zostaje odrzucone przez 4x6', () => {
    const facts = [createFact(3, 8)];
    expect(factProduct(facts[0] as Fact)).toBe(24);
    expect(nextFact(facts, { now: NOW, rng: alwaysDue, onScreen: [createFact(4, 6)] })).toBeNull();
  });
});

describe('nextFact — podział zaległe / powtórka', () => {
  const overdue = withState(3, 7, { dueAt: NOW - 60_000, mastery: 2 });
  const fluent = withState(6, 8, { dueAt: NOW + 60_000, mastery: 4 });
  const facts = [overdue, fluent];

  it('przy niskim losowaniu bierze z zaległych', () => {
    expect(keyOf(nextFact(facts, { now: NOW, rng: alwaysDue }) as Fact)).toBe('3x7');
  });

  it('przy wysokim losowaniu bierze fakt do odświeżenia', () => {
    expect(keyOf(nextFact(facts, { now: NOW, rng: alwaysReview }) as Fact)).toBe('6x8');
  });

  it('spada na zaległe, gdy nie ma czego odświeżać', () => {
    const onlyOverdue = [overdue];
    expect(keyOf(nextFact(onlyOverdue, { now: NOW, rng: alwaysReview }) as Fact)).toBe('3x7');
  });

  it('spada na powtórkę, gdy nic nie jest zaległe', () => {
    const onlyFuture = [fluent];
    expect(keyOf(nextFact(onlyFuture, { now: NOW, rng: alwaysDue }) as Fact)).toBe('6x8');
  });

  it('wybiera cokolwiek z puli, gdy obie kategorie są puste', () => {
    const neither = [withState(3, 7, { dueAt: NOW + 60_000, mastery: 2 })];
    expect(keyOf(nextFact(neither, { now: NOW, rng: alwaysDue }) as Fact)).toBe('3x7');
  });

  it('trzyma proporcję ~70/30 na dużej próbie', () => {
    let due = 0;
    const samples = 2000;
    for (let i = 0; i < samples; i++) {
      const picked = nextFact(facts, { now: NOW, rng: scripted([i / samples, 0.5]) });
      if (keyOf(picked as Fact) === '3x7') {
        due++;
      }
    }
    expect(due / samples).toBeCloseTo(0.7, 2);
  });
});

describe('nextFact — okno zaległych', () => {
  it('losuje spośród najbardziej zaległych, nie tylko z pierwszego', () => {
    // Świeży zbiór: wszystko ma dueAt 0, więc bez okna zawsze wypadałby ten sam fakt.
    const facts = allFacts();
    const picked = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const fact = nextFact(facts, { now: NOW, rng: scripted([0.0, i / 50]) });
      picked.add(keyOf(fact as Fact));
    }
    expect(picked.size).toBeGreaterThan(1);
    expect(picked.size).toBeLessThanOrEqual(DUE_WINDOW);
  });

  it('trzyma się priorytetu — nie sięga poza okno najbardziej zaległych', () => {
    const facts = allFacts().map((fact, index) => ({ ...fact, dueAt: NOW - (100 - index) }));
    const window = new Set(dueFacts(facts, NOW).slice(0, DUE_WINDOW).map(keyOf));

    for (let i = 0; i < 100; i++) {
      const picked = nextFact(facts, { now: NOW, rng: scripted([0.0, i / 100]) });
      expect(window.has(keyOf(picked as Fact))).toBe(true);
    }
  });
});

describe('nextFact — filtr arcade', () => {
  it('nie wpuszcza faktów poniżej progu mastery', () => {
    const facts = allFacts().map((fact, index) => ({ ...fact, mastery: (index % 5) as Mastery }));

    for (let i = 0; i < 200; i++) {
      const picked = nextFact(facts, {
        now: NOW,
        rng: scripted([(i % 10) / 10, ((i * 17) % 97) / 97]),
        eligible: isArcadeReady,
      });
      expect(picked).not.toBeNull();
      expect((picked as Fact).mastery).toBeGreaterThanOrEqual(ARCADE_MIN_MASTERY);
    }
  });

  it('zwraca null na świeżym zbiorze — nic nie osiągnęło jeszcze poziomu 2', () => {
    expect(nextFact(allFacts(), { now: NOW, rng: alwaysDue, eligible: isArcadeReady })).toBeNull();
  });
});
