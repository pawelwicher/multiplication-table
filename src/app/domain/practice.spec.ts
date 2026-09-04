import { createFact, type FactKey } from './fact';
import { GRADUATION_MASTERY } from './mastery';
import {
  REPEAT_COOLDOWN,
  SESSION_LENGTH,
  WORKING_SET,
  answerQuestion,
  hasGraduated,
  isSessionDone,
  pickFromSet,
  rememberAsked,
  resolveBuffer,
  sessionProgress,
  startSession,
} from './practice';

const rng = (value: number) => () => value;

describe('resolveBuffer', () => {
  it('pusty bufor czeka', () => {
    expect(resolveBuffer('', 56)).toBe('buffering');
  });

  it('prefiks czeka na kolejną cyfrę', () => {
    expect(resolveBuffer('5', 56)).toBe('buffering');
    expect(resolveBuffer('10', 100)).toBe('buffering');
  });

  it('trafienie zatwierdza bez Entera', () => {
    expect(resolveBuffer('56', 56)).toBe('commit');
    expect(resolveBuffer('4', 4)).toBe('commit');
    expect(resolveBuffer('100', 100)).toBe('commit');
  });

  it('rozbieżna cyfra to od razu pudło', () => {
    expect(resolveBuffer('6', 56)).toBe('miss');
    expect(resolveBuffer('57', 56)).toBe('miss');
  });

  it('zero na starcie to pudło — żaden wynik nie zaczyna się od zera', () => {
    expect(resolveBuffer('0', 56)).toBe('miss');
  });
});

describe('sesja', () => {
  it('startuje pusta i domyślnie ma 20 pytań', () => {
    expect(startSession()).toEqual({ length: SESSION_LENGTH, asked: 0, correct: 0 });
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
  it('wypuszcza z zestawu dopiero od progu opanowania', () => {
    const base = createFact(7, 8);
    expect(hasGraduated({ ...base, mastery: 1 })).toBe(false);
    expect(hasGraduated({ ...base, mastery: GRADUATION_MASTERY })).toBe(true);
    expect(hasGraduated({ ...base, mastery: 4 })).toBe(true);
  });
});

describe('rememberAsked', () => {
  it('przycina historię do długości karencji', () => {
    let recent: FactKey[] = [];
    for (const key of ['1x1', '1x2', '1x3', '1x4', '1x5', '1x6'] as FactKey[]) {
      recent = rememberAsked(recent, key);
    }
    expect(recent).toHaveLength(REPEAT_COOLDOWN);
    expect(recent).toEqual(['1x3', '1x4', '1x5', '1x6']);
  });
});

describe('pickFromSet', () => {
  const set: FactKey[] = ['3x4', '6x7', '8x9', '2x5', '4x4', '3x3', '7x7', '6x8'];

  it('pusty zestaw nie daje pytania', () => {
    expect(pickFromSet([], [], rng(0))).toBeNull();
  });

  it('wybiera z zestawu', () => {
    expect(set).toContain(pickFromSet(set, [], rng(0.5)));
  });

  it('omija wszystko z okna karencji', () => {
    const recent: FactKey[] = ['3x4', '6x7', '8x9', '2x5'];
    for (let i = 0; i < 100; i++) {
      expect(recent).not.toContain(pickFromSet(set, recent, rng(i / 100)));
    }
  });

  it('rozrzuca pytania — żadne nie wraca przed upływem karencji', () => {
    let recent: FactKey[] = [];
    const order: FactKey[] = [];
    for (let i = 0; i < 60; i++) {
      const key = pickFromSet(set, recent, rng(((i * 37) % 101) / 101)) as FactKey;
      order.push(key);
      recent = rememberAsked(recent, key);
    }

    for (let i = 0; i < order.length; i++) {
      const window = order.slice(Math.max(0, i - REPEAT_COOLDOWN), i);
      expect(window).not.toContain(order[i]);
    }
  });

  it('skraca karencję, zamiast zostać bez pytania', () => {
    const tiny: FactKey[] = ['3x4', '6x7'];
    const recent: FactKey[] = ['3x4', '6x7', '3x4', '6x7'];
    expect(tiny).toContain(pickFromSet(tiny, recent, rng(0.5)));
  });

  it('przy jednym działaniu powtarza, zamiast oddawać null', () => {
    expect(pickFromSet(['3x4'], ['3x4', '3x4'], rng(0.9))).toBe('3x4');
  });

  it('sięga po każde działanie z zestawu', () => {
    const seen = new Set<FactKey | null>();
    for (let i = 0; i < 200; i++) {
      seen.add(pickFromSet(set, [], rng(i / 200)));
    }
    expect(seen.size).toBe(set.length);
  });

  it('zestaw roboczy jest większy niż karencja — inaczej nie byłoby z czego wybierać', () => {
    expect(WORKING_SET).toBeGreaterThan(REPEAT_COOLDOWN);
  });
});
