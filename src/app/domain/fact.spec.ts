import {
  MAX_FACTOR,
  MIN_FACTOR,
  TOTAL_FACT_COUNT,
  allFacts,
  createFact,
  factKey,
  factProduct,
  isFactKey,
  isFactor,
  keyOf,
  parseFactKey,
  productOf,
  type Fact,
} from './fact';

describe('factKey', () => {
  it('normalizuje kolejność czynników', () => {
    expect(factKey(7, 8)).toBe('7x8');
    expect(factKey(8, 7)).toBe('7x8');
  });

  it('radzi sobie z kwadratami', () => {
    expect(factKey(6, 6)).toBe('6x6');
  });

  it('odrzuca czynniki spoza zakresu', () => {
    expect(() => factKey(0, 5)).toThrow(RangeError);
    expect(() => factKey(5, 11)).toThrow(RangeError);
    expect(() => factKey(-3, 4)).toThrow(RangeError);
  });

  it('odrzuca czynniki niecałkowite i NaN', () => {
    expect(() => factKey(2.5, 4)).toThrow(RangeError);
    expect(() => factKey(4, Number.NaN)).toThrow(RangeError);
  });
});

describe('isFactor', () => {
  it('akceptuje dokładnie 1–10', () => {
    for (let n = MIN_FACTOR; n <= MAX_FACTOR; n++) {
      expect(isFactor(n)).toBe(true);
    }
    expect(isFactor(0)).toBe(false);
    expect(isFactor(11)).toBe(false);
    expect(isFactor(3.5)).toBe(false);
    expect(isFactor(Number.NaN)).toBe(false);
    expect(isFactor(Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe('isFactKey', () => {
  it('akceptuje każdy klucz wygenerowany przez factKey', () => {
    for (const fact of allFacts()) {
      expect(isFactKey(keyOf(fact))).toBe(true);
    }
  });

  it('odrzuca klucze nieznormalizowane', () => {
    expect(isFactKey('8x7')).toBe(false);
  });

  it('odrzuca śmieci', () => {
    for (const bad of ['', 'x', '7x', 'x8', '7x8x9', '7*8', ' 7x8', '07x8', '0x5', '7x11', 'ax8']) {
      expect(isFactKey(bad)).toBe(false);
    }
  });
});

describe('parseFactKey', () => {
  it('jest odwrotnością factKey dla wszystkich 55 faktów', () => {
    for (const fact of allFacts()) {
      const { a, b } = parseFactKey(keyOf(fact));
      expect(a).toBe(fact.a);
      expect(b).toBe(fact.b);
    }
  });

  it('rzuca na niepoprawnym kluczu', () => {
    expect(() => parseFactKey('8x7')).toThrow(RangeError);
    expect(() => parseFactKey('nonsens')).toThrow(RangeError);
  });
});

describe('productOf / factProduct', () => {
  it('liczy wynik', () => {
    expect(productOf(7, 8)).toBe(56);
    expect(factProduct(createFact(9, 6))).toBe(54);
  });
});

describe('createFact', () => {
  it('normalizuje czynniki', () => {
    const fact = createFact(9, 4);
    expect(fact.a).toBe(4);
    expect(fact.b).toBe(9);
    expect(keyOf(fact)).toBe('4x9');
  });

  it('ustawia stan początkowy „nic jeszcze nie wiemy"', () => {
    const fact = createFact(7, 8);
    expect(fact).toEqual<Fact>({
      a: 7,
      b: 8,
      box: 1,
      mastery: 0,
      recentTimes: [],
      dueAt: 0,
      streak: 0,
      lapses: 0,
    });
  });

});

describe('allFacts', () => {
  const facts = allFacts();

  it('generuje dokładnie 55 faktów', () => {
    expect(facts).toHaveLength(TOTAL_FACT_COUNT);
  });

  it('generuje wyłącznie unikalne klucze', () => {
    const keys = new Set(facts.map(keyOf));
    expect(keys.size).toBe(TOTAL_FACT_COUNT);
  });

  it('trzyma się a <= b i zakresu 1–10', () => {
    for (const fact of facts) {
      expect(fact.a).toBeLessThanOrEqual(fact.b);
      expect(isFactor(fact.a)).toBe(true);
      expect(isFactor(fact.b)).toBe(true);
    }
  });

  it('pokrywa całą siatkę 10×10 po normalizacji', () => {
    const keys = new Set(facts.map(keyOf));
    for (let a = MIN_FACTOR; a <= MAX_FACTOR; a++) {
      for (let b = MIN_FACTOR; b <= MAX_FACTOR; b++) {
        expect(keys.has(factKey(a, b))).toBe(true);
      }
    }
  });

  it('zwraca niezależne instancje przy każdym wywołaniu', () => {
    const first = allFacts();
    const target = first[0] as Fact;
    target.box = 5;
    target.recentTimes.push({ ms: 1234, noisy: false });

    const second = allFacts();
    expect((second[0] as Fact).box).toBe(1);
    expect((second[0] as Fact).recentTimes).toEqual([]);
  });

  it('jest posortowany rosnąco po a, potem po b', () => {
    const sorted = [...facts].sort((x, y) => x.a - y.a || x.b - y.b);
    expect(facts.map(keyOf)).toEqual(sorted.map(keyOf));
  });
});
