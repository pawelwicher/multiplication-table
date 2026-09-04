import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

import { Cdp, goto, launch, setupPage, sleep } from './cdp.mjs';

const PORT = process.env['APP_PORT'] ?? '4287';
const URL = process.env['APP_URL'] ?? `http://localhost:${PORT}/`;
const SHOTS = process.env['SHOT_DIR'] ?? 'tools/browser-check/shots';

mkdirSync(SHOTS, { recursive: true });

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
  console.log('Podnoszę ng serve…');
  const server = spawn('npx', ['ng', 'serve', '--port', PORT], {
    stdio: 'ignore',
    shell: true,
  });
  for (let i = 0; i < 120; i++) {
    if (await reachable()) return server;
    await sleep(500);
  }
  server.kill();
  throw new Error(`Serwer nie wstał na ${URL}`);
}

const server = await ensureServer();

const fail = [];
const log = (...a) => console.log(...a);
function check(name, ok, detail = '') {
  log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) fail.push(name);
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

  // Czysty start — kasujemy bazę i przeładowujemy.
  await cdp.evaluate(`
    return await new Promise((resolve) => {
      const req = indexedDB.deleteDatabase('tabliczka-mnozenia');
      req.onsuccess = req.onerror = req.onblocked = () => resolve(true);
    });
  `);
  await goto(cdp, URL);
  await sleep(900);

  // ——— 1. Ekran startowy na świeżej instalacji ———
  let home = await cdp.evaluate(`
    return {
      url: location.pathname,
      modes: [...document.querySelectorAll('.mode__name')].map((e) => e.textContent.trim()),
      arcadeLocked: !!document.querySelector('.mode--locked'),
      progress: document.querySelector('.progress')?.textContent.replace(/\\s+/g, ' ').trim(),
    };
  `);
  check('start na ekranie menu', home.url === '/', home.url);
  check('trzy tryby na liście', home.modes.length === 3, home.modes.join(', '));
  check('arcade zablokowane na świeżej instalacji', home.arcadeLocked === true);
  check('postęp startuje od zera', /^0 z 21/.test(home.progress ?? ''), home.progress);
  await cdp.screenshot(`${SHOTS}/10-menu.png`);

  // ——— 2. Arcade odmawia startu, gdy pula pusta ———
  await goto(cdp, `${URL}game`);
  await sleep(700);
  const lockedScreen = await cdp.evaluate(`
    return {
      notice: !!document.querySelector('.notice--locked'),
      tiles: document.querySelectorAll('.tile').length,
    };
  `);
  check('arcade pokazuje blokadę zamiast pustego pola', lockedScreen.notice === true);
  check('nie spawnuje kafelków bez puli', lockedScreen.tiles === 0, `${lockedScreen.tiles}`);
  await cdp.screenshot(`${SHOTS}/11-arcade-zamkniete.png`);

  // ——— 3. Sesja spokojna: 20 pytań, wszystkie poprawnie ———
  await goto(cdp, `${URL}calm`);
  await sleep(900);
  await cdp.screenshot(`${SHOTS}/12-spokojnie.png`);

  const READ_CALM = `
    const eq = document.querySelector('.equation');
    const done = !!document.querySelector('.summary');
    const m = eq ? eq.textContent.replace(/\\s+/g, ' ').match(/(\\d+) × (\\d+)/) : null;
    return {
      a: m ? Number(m[1]) : null,
      b: m ? Number(m[2]) : null,
      revealed: !!document.querySelector('.question--revealed'),
      count: document.querySelector('.count')?.textContent.trim() ?? null,
      done,
      summary: done ? document.querySelector('.summary__score').textContent.trim() : null,
    };
  `;

  let asked = 0;
  const seen = new Set();
  for (let i = 0; i < 60; i++) {
    const q = await cdp.evaluate(READ_CALM);
    if (q.done) break;
    if (q.a === null) {
      await sleep(200);
      continue;
    }
    seen.add(`${q.a}x${q.b}`);
    await cdp.type(q.a * q.b);
    asked++;
    await sleep(120);
  }

  const calm = await cdp.evaluate(READ_CALM);
  check('sesja spokojna kończy się po 20 pytaniach', calm.done === true, calm.count ?? '');
  check('podsumowanie pokazuje 20/20', calm.summary === '20 / 20', calm.summary ?? '');
  check(
    'zestaw roboczy krąży, zamiast losować 20 różnych działań',
    seen.size > 0 && seen.size <= 12,
    `${seen.size} różnych działań na ${asked} pytań`,
  );
  await cdp.screenshot(`${SHOTS}/13-podsumowanie.png`);

  // ——— 4. Postęp trafił do IndexedDB ———
  const rows = await cdp.evaluate(READ_IDB);
  const graduated = rows.filter((r) => r.mastery >= 2);
  check('postęp zapisany w IndexedDB', rows.length > 0, `${rows.length} rekordów`);
  check(
    'część działań awansowała na poziom 2 w jednej sesji',
    graduated.length > 0,
    `${graduated.length} działań, maks. mastery ${Math.max(...rows.map((r) => r.mastery))}`,
  );
  check(
    'rekordy nie trzymają pól wyliczalnych',
    rows.every((r) => r.a === undefined && r.trivial === undefined),
  );

  // ——— 5. Postęp przeżywa przeładowanie ———
  await goto(cdp, URL);
  await sleep(900);
  home = await cdp.evaluate(`
    return {
      arcadeLocked: !!document.querySelector('.mode--locked'),
      progress: document.querySelector('.progress')?.textContent.replace(/\\s+/g, ' ').trim(),
    };
  `);
  check('arcade odblokowane po sesji spokojnej', home.arcadeLocked === false);
  await cdp.screenshot(`${SHOTS}/14-menu-po-sesji.png`);

  // ——— 6. Arcade gra na prawdziwych danych ———
  await goto(cdp, `${URL}game`);
  await sleep(1600);
  const arcade = await cdp.evaluate(`
    return {
      locked: !!document.querySelector('.notice--locked'),
      tiles: [...document.querySelectorAll('.tile')].map((e) => e.textContent.replace(/\\s+/g,' ').trim()),
      lives: document.querySelectorAll('.heart:not(.heart--spent)').length,
    };
  `);
  check('arcade startuje na zapisanych postępach', arcade.locked === false);
  check('kafelki lecą', arcade.tiles.length > 0, arcade.tiles.join(' | '));
  check('życia pełne', arcade.lives === 3, `${arcade.lives}`);
  await cdp.screenshot(`${SHOTS}/15-arcade-na-danych.png`);

  // ——— 7. Mapa ———
  await goto(cdp, `${URL}map`);
  await sleep(900);
  const map = await cdp.evaluate(`
    const cells = [...document.querySelectorAll('.cell')];
    const byLevel = {};
    for (const c of cells) {
      const m = c.className.match(/cell--m(\\d)/);
      if (m) byLevel[m[1]] = (byLevel[m[1]] ?? 0) + 1;
    }
    return {
      cells: cells.length,
      byLevel,
      trivial: document.querySelectorAll('.cell--trivial').length,
      progress: document.querySelector('.progress')?.textContent.replace(/\\s+/g, ' ').trim(),
      legend: document.querySelectorAll('.legend li').length,
      levels: [...document.querySelectorAll('.grid tbody tr')].map((tr) =>
        [...tr.querySelectorAll('.cell')].map((c) => Number(c.className.match(/cell--m(\\d)/)[1])),
      ),
      labels: [...document.querySelectorAll('.cell')].map((c) => c.getAttribute('title')),
    };
  `);
  check('mapa ma pełną siatkę 10×10', map.cells === 100, `${map.cells}`);
  check('legenda ma pięć poziomów', map.legend === 5, `${map.legend}`);
  check('mapa pokazuje symetryczne oznaczenia trywialnych', map.trivial === 64, `${map.trivial}`);
  const asymmetric = [];
  for (let a = 0; a < 10; a++) {
    for (let b = 0; b < 10; b++) {
      if (map.levels[a][b] !== map.levels[b][a]) asymmetric.push(`${a + 1}x${b + 1}`);
    }
  }
  check('siatka jest symetryczna — 7x8 i 8x7 to jeden fakt', asymmetric.length === 0, asymmetric.join(','));
  check(
    'każda komórka ma opis dla czytnika ekranu',
    map.labels.length === 100 && map.labels.every((l) => /^\d+ × \d+ = \d+ — /.test(l ?? '')),
    map.labels[0] ?? '',
  );
  check(
    'mapa odzwierciedla postęp z sesji',
    Object.keys(map.byLevel).length > 1,
    JSON.stringify(map.byLevel),
  );
  await cdp.screenshot(`${SHOTS}/16-mapa.png`);

  // ——— 8. Kasowanie postępu ———
  await cdp.evaluate(`
    document.querySelector('.ghost').click();
    return true;
  `);
  await sleep(200);
  await cdp.evaluate(`document.querySelector('.danger').click(); return true;`);
  await sleep(600);
  const afterReset = await cdp.evaluate(`
    return {
      progress: document.querySelector('.progress')?.textContent.replace(/\\s+/g, ' ').trim(),
      m0: document.querySelectorAll('.cell.cell--m0').length,
    };
  `);
  check('kasowanie postępu czyści mapę', afterReset.m0 === 100, `${afterReset.m0} komórek na zerze`);
  check('po skasowaniu w bazie nie ma rekordów', (await cdp.evaluate(READ_IDB)).length === 0);

  check('brak błędów w konsoli', errors.length === 0, errors.join(' | '));
} finally {
  cdp.close();
  child.kill();
  server?.kill();
}

log(`\n${fail.length === 0 ? 'WSZYSTKO OK' : `NIEPOWODZENIA (${fail.length}): ${fail.join(', ')}`}`);
process.exit(fail.length === 0 ? 0 : 1);
