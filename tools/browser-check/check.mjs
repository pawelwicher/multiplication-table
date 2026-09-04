import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

import { Cdp, goto, launch, setupPage, sleep } from './cdp.mjs';

const PORT = process.env['APP_PORT'] ?? '4287';
const URL = process.env['APP_URL'] ?? `http://localhost:${PORT}/`;
const SHOTS = process.env['SHOT_DIR'] ?? 'tools/browser-check/shots';

/** Musi się zgadzać z REPEAT_COOLDOWN w domain/practice.ts. */
const REPEAT_COOLDOWN = 4;

mkdirSync(SHOTS, { recursive: true });

const fail = [];
const log = (...a) => console.log(...a);
function check(name, ok, detail = '') {
  log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) fail.push(name);
}

async function reachable() {
  try {
    return (await fetch(URL)).ok;
  } catch {
    return false;
  }
}

/** Podnosi `ng serve`, jeśli nikt go jeszcze nie uruchomił. */
async function ensureServer() {
  if (await reachable()) {
    return null;
  }
  log('Podnoszę ng serve…');
  const server = spawn('npx', ['ng', 'serve', '--port', PORT], { stdio: 'ignore', shell: true });
  for (let i = 0; i < 120; i++) {
    if (await reachable()) return server;
    await sleep(500);
  }
  server.kill();
  throw new Error(`Serwer nie wstał na ${URL}`);
}

const READ_IDB = `
  return await new Promise((resolve) => {
    const open = indexedDB.open('tabliczka-mnozenia');
    open.onsuccess = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains('facts')) return resolve([]);
      const req = db.transaction('facts', 'readonly').objectStore('facts').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve([]);
    };
    open.onerror = () => resolve([]);
  });
`;

const READ_STATE = `
  const eq = document.querySelector('.equation');
  const m = eq ? eq.textContent.replace(/\\s+/g, ' ').match(/(\\d+) × (\\d+)/) : null;
  return {
    a: m ? Number(m[1]) : null,
    b: m ? Number(m[2]) : null,
    slot: document.querySelector('.slot')?.textContent.trim() ?? null,
    revealed: !!document.querySelector('.question--revealed'),
    hint: document.querySelector('.hint')?.textContent.trim() ?? null,
    count: document.querySelector('.count')?.textContent.trim() ?? null,
    known: document.querySelector('.known')?.textContent.trim() ?? null,
    levels: [...document.querySelectorAll('.level')].map((e) => e.textContent.trim()),
    active: document.querySelector('.level--on')?.textContent.trim() ?? null,
    numpadKeys: document.querySelectorAll('.key').length,
    done: !!document.querySelector('.summary'),
    summary: document.querySelector('.summary__score')?.textContent.trim() ?? null,
  };
`;

/** Odpowiada na pytania aż do końca sesji, zwracając kolejność zadanych działań. */
async function playSession(cdp, limit = 80) {
  const order = [];
  for (let i = 0; i < limit; i++) {
    const q = await cdp.evaluate(READ_STATE);
    if (q.done) break;
    if (q.a === null) {
      await sleep(200);
      continue;
    }
    order.push({ key: `${q.a}x${q.b}`, product: q.a * q.b });
    await cdp.type(q.a * q.b);
    await sleep(110);
  }
  return order;
}

const server = await ensureServer();
const { child, wsUrl } = await launch(9334);
const cdp = await Cdp.connect(wsUrl);
const errors = [];
cdp.on('Runtime.exceptionThrown', (p) =>
  errors.push(p.exceptionDetails?.exception?.description ?? 'wyjątek'),
);
cdp.on('Runtime.consoleAPICalled', (p) => {
  if (p.type === 'error') errors.push(p.args.map((a) => a.value ?? a.description).join(' '));
});

try {
  await setupPage(cdp);
  await goto(cdp, URL);

  // Czysty start.
  await cdp.evaluate(`
    localStorage.clear();
    return await new Promise((resolve) => {
      const req = indexedDB.deleteDatabase('tabliczka-mnozenia');
      req.onsuccess = req.onerror = req.onblocked = () => resolve(true);
    });
  `);
  await goto(cdp, URL);
  await sleep(900);

  // ——— 1. Jeden ekran, dziewięć progów ———
  let state = await cdp.evaluate(READ_STATE);
  check('aplikacja ma jeden ekran — bez menu i tras', state.numpadKeys === 12, `${state.numpadKeys} klawiszy`);
  check('dziewięć progów trudności', state.levels.length === 9, state.levels.join(' '));
  check('progi opisane jako zakres wyniku', state.levels[0] === '1–20' && state.levels[8] === '1–100', state.levels.join(' '));
  check('start od najniższego progu', state.active === '1–20', state.active ?? '');
  check('pierwsze pytanie jest gotowe', state.a !== null, `${state.a} × ${state.b}`);
  await cdp.screenshot(`${SHOTS}/20-ekran.png`);

  // ——— 2. Sesja w progu 1–20 ———
  const easy = await playSession(cdp);
  state = await cdp.evaluate(READ_STATE);

  check('sesja kończy się po 20 pytaniach', state.done === true, state.count ?? '');
  check('podsumowanie pokazuje 20/20', state.summary === '20 / 20', state.summary ?? '');
  check(
    'żadne pytanie nie wychodzi poza próg 1–20',
    easy.every((q) => q.product <= 20),
    `maks. wynik ${Math.max(...easy.map((q) => q.product))}`,
  );

  const tooSoon = [];
  for (let i = 0; i < easy.length; i++) {
    const window = easy.slice(Math.max(0, i - REPEAT_COOLDOWN), i).map((q) => q.key);
    if (window.includes(easy[i].key)) tooSoon.push(easy[i].key);
  }
  check(
    `żadne pytanie nie wraca wcześniej niż po ${REPEAT_COOLDOWN} innych`,
    tooSoon.length === 0,
    tooSoon.join(', '),
  );
  check(
    'sesja jest urozmaicona',
    new Set(easy.map((q) => q.key)).size >= 8,
    `${new Set(easy.map((q) => q.key)).size} różnych działań na ${easy.length} pytań`,
  );
  await cdp.screenshot(`${SHOTS}/21-podsumowanie.png`);

  // ——— 3. Postęp w bazie ———
  const rows = await cdp.evaluate(READ_IDB);
  check('postęp zapisany w IndexedDB', rows.length > 0, `${rows.length} rekordów`);
  check(
    'działania awansowały w jednej sesji',
    rows.filter((r) => r.mastery >= 2).length > 0,
    `${rows.filter((r) => r.mastery >= 2).length} opanowanych`,
  );

  // ——— 4. Zmiana progu ———
  await cdp.evaluate(`
    [...document.querySelectorAll('.level')].find((e) => e.textContent.trim() === '1–100').click();
    return true;
  `);
  await sleep(700);
  state = await cdp.evaluate(READ_STATE);
  check('zmiana progu przełącza zakres', state.active === '1–100', state.active ?? '');
  check('zmiana progu zaczyna sesję od nowa', state.count === '0/20', state.count ?? '');
  check('po zmianie progu jest nowe pytanie', state.a !== null && state.done === false);

  const hard = await playSession(cdp, 40);
  check(
    'wyższy próg wpuszcza większe wyniki',
    hard.some((q) => q.product > 20),
    `maks. wynik ${Math.max(...hard.map((q) => q.product))}`,
  );
  await cdp.screenshot(`${SHOTS}/22-wyzszy-prog.png`);

  // ——— 5. Wybrany próg przeżywa przeładowanie ———
  await goto(cdp, URL);
  await sleep(900);
  state = await cdp.evaluate(READ_STATE);
  check('wybrany próg zapamiętany po przeładowaniu', state.active === '1–100', state.active ?? '');
  check('licznik opanowanych działań jest widoczny', /^umiesz \d+\/\d+$/.test(state.known ?? ''), state.known ?? '');

  // ——— 6. „Nie wiem" pokazuje wynik do przepisania ———
  const before = await cdp.evaluate(READ_STATE);
  await cdp.evaluate(`document.querySelector('.reveal').click(); return true;`);
  await sleep(250);
  const revealed = await cdp.evaluate(READ_STATE);
  check('„Nie wiem" odsłania wynik', revealed.revealed === true && revealed.slot === String(before.a * before.b), revealed.slot ?? '');
  check('i prosi o przepisanie', revealed.hint === 'Przepisz wynik', revealed.hint ?? '');
  await cdp.screenshot(`${SHOTS}/23-nie-wiem.png`);

  await cdp.type(before.a * before.b);
  await sleep(300);
  const after = await cdp.evaluate(READ_STATE);
  check('przepisanie wyniku prowadzi do kolejnego pytania', after.revealed === false && after.count === '1/20', after.count ?? '');

  // ——— 7. Zła odpowiedź ———
  const wrongTarget = await cdp.evaluate(READ_STATE);
  await cdp.type(wrongTarget.a * wrongTarget.b === 7 ? 9 : 7);
  await sleep(250);
  const afterWrong = await cdp.evaluate(READ_STATE);
  check('zła odpowiedź odsłania wynik zamiast przechodzić dalej', afterWrong.revealed === true);

  check('brak błędów w konsoli', errors.length === 0, errors.join(' | '));
} finally {
  cdp.close();
  child.kill();
  server?.kill();
}

log(`\n${fail.length === 0 ? 'WSZYSTKO OK' : `NIEPOWODZENIA (${fail.length}): ${fail.join(', ')}`}`);
process.exit(fail.length === 0 ? 0 : 1);
