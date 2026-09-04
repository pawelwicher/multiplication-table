import {
  CALM_SESSION_LENGTH,
  answerQuestion,
  calmResolve,
  isSessionDone,
  sessionProgress,
  startSession,
  hasGraduated,
  pickFromSet,
} from './calm';
import { createFact, type FactKey } from './fact';
import { isArcadeReady } from './mastery';

describe('calmResolve', () => {
  it('pusty bufor czeka', () => {
    expect(calmResolve('', 56)).toBe('buffering');
  });

  it('prefiks czeka na kolejną cyfrę', () => {
    expect(calmResolve('5', 56)).toBe('buffering');
    expect(calmResolve('10', 100)).toBe('buffering');
  });

  it('trafienie zatwierdza bez Entera', () => {
    expect(calmResolve('56', 56)).toBe('commit');
    expect(calmResolve('4', 4)).toBe('commit');
    expect(calmResolve('100', 100)).toBe('commit');
  });

  it('rozbieżna cyfra to od razu pudło', () => {
    expect(calmResolve('6', 56)).toBe('miss');
    expect(calmResolve('57', 56)).toBe('miss');
  });

  it('zero na starcie to pudło — żaden wynik nie zaczyna się od zera', () => {
    expect(calmResolve('0', 56)).toBe('miss');
  });

  it('trafienie wygrywa z prefiksem dłuższej liczby', () => {
    // Wynik to 8; wpisanie 8 zatwierdza od razu, bo innych działań nie ma.
    expect(calmResolve('8', 8)).toBe('commit');
  });
});

describe('sesja', () => {
  it('startuje pusta i domyślnie ma 20 pytań', () => {
    expect(startSession()).toEqual({ length: CALM_SESSION_LENGTH, asked: 0, correct: 0 });
  });

  it('rzuca na bezsensownej długości', () => {
    expect(() => startSession(0)).toThrow(RangeError);
    expect(() => startSession(2.5)).toThrow(RangeError);
  });

  it('liczy tylko trafienia za pierwszym razem', () => {
    let session = startSession(3);
    session = answerQuestion(session, true);
    session = answerQuestion(session, false);
    session = answerQuestion(session, true);
    expect(session).toEqual({ length: 3, asked: 3, correct: 2 });
  });

  it('nie mutuje sesji wejściowej', () => {
    const session = startSession(3);
    answerQuestion(session, true);
    expect(session).toEqual({ length: 3, asked: 0, correct: 0 });
  });

  it('kończy się po zadanej liczbie pytań', () => {
    let session = startSession(2);
    expect(isSessionDone(session)).toBe(false);
    session = answerQuestion(session, true);
    expect(isSessionDone(session)).toBe(false);
    session = answerQuestion(session, true);
    expect(isSessionDone(session)).toBe(true);
  });

  it('nie przekracza swojej długości', () => {
    let session = startSession(1);
    session = answerQuestion(session, true);
    session = answerQuestion(session, true);
    expect(session.asked).toBe(1);
  });

  it('postęp idzie od zera do jedynki', () => {
    let session = startSession(4);
    expect(sessionProgress(session)).toBe(0);
    session = answerQuestion(session, true);
    session = answerQuestion(session, false);
    expect(sessionProgress(session)).toBe(0.5);
  });
});

describe('hasGraduated', () => {
  it('wypuszcza z zestawu dopiero od poziomu 2', () => {
    const base = createFact(7, 8);
    expect(hasGraduated({ ...base, mastery: 0 })).toBe(false);
    expect(hasGraduated({ ...base, mastery: 1 })).toBe(false);
    expect(hasGraduated({ ...base, mastery: 2 })).toBe(true);
    expect(hasGraduated({ ...base, mastery: 4 })).toBe(true);
  });

  it('zgadza się z progiem arcade', () => {
    const base = createFact(7, 8);
    for (const mastery of [0, 1, 2, 3, 4] as const) {
      expect(hasGraduated({ ...base, mastery })).toBe(isArcadeReady({ ...base, mastery }));
    }
  });
});

describe('pickFromSet', () => {
  const set: FactKey[] = ['3x4', '6x7', '8x9'];
  const rng = (value: number) => () => value;

  it('pusty zestaw nie daje pytania', () => {
    expect(pickFromSet([], null, rng(0))).toBeNull();
  });

  it('wybiera z zestawu', () => {
    expect(set).toContain(pickFromSet(set, null, rng(0.5)));
  });

  it('nigdy nie powtarza poprzedniego pytania', () => {
    for (let i = 0; i < 100; i++) {
      expect(pickFromSet(set, '6x7', rng(i / 100))).not.toBe('6x7');
    }
  });

  it('przy jednym elemencie powtarza, zamiast oddawać null', () => {
    expect(pickFromSet(['3x4'], '3x4', rng(0.9))).toBe('3x4');
  });

  it('sięga po każdy element zestawu', () => {
    const seen = new Set<FactKey | null>();
    for (let i = 0; i < 60; i++) {
      seen.add(pickFromSet(set, null, rng(i / 60)));
    }
    expect(seen.size).toBe(set.length);
  });
});
