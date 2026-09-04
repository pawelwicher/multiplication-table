// Minimalny sterownik Chrome DevTools Protocol. Zero zależności — Node 24 ma WebSocket.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME_CANDIDATES = [
  process.env['CHROME_PATH'],
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter((path) => typeof path === 'string');

function findChrome() {
  const found = CHROME_CANDIDATES.find((path) => existsSync(path));
  if (found === undefined) {
    throw new Error('Nie znalazłem przeglądarki. Wskaż ją zmienną CHROME_PATH.');
  }
  return found;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function poll(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch {
      /* jeszcze nie wstał */
    }
    await sleep(250);
  }
  throw new Error(`Nie doczekałem się ${url}`);
}

export async function launch(port = 9333) {
  const profile = mkdtempSync(join(tmpdir(), 'cdp-'));
  const child = spawn(
    findChrome(),
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      'about:blank',
    ],
    { stdio: 'ignore', detached: false },
  );

  await poll(`http://127.0.0.1:${port}/json/version`);
  const targets = await poll(`http://127.0.0.1:${port}/json`);
  const page = targets.find((t) => t.type === 'page');
  if (!page) throw new Error('Brak karty typu page');

  return { child, wsUrl: page.webSocketDebuggerUrl, port };
}

export class Cdp {
  #ws;
  #id = 0;
  #pending = new Map();
  #listeners = new Map();

  static async connect(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = () => reject(new Error('WebSocket padł'));
    });
    return new Cdp(ws);
  }

  constructor(ws) {
    this.#ws = ws;
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id !== undefined) {
        const slot = this.#pending.get(msg.id);
        this.#pending.delete(msg.id);
        if (!slot) return;
        msg.error ? slot.reject(new Error(JSON.stringify(msg.error))) : slot.resolve(msg.result);
        return;
      }
      for (const fn of this.#listeners.get(msg.method) ?? []) fn(msg.params);
    };
  }

  send(method, params = {}) {
    const id = ++this.#id;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, fn) {
    if (!this.#listeners.has(method)) this.#listeners.set(method, []);
    this.#listeners.get(method).push(fn);
  }

  once(method) {
    return new Promise((resolve) => this.on(method, resolve));
  }

  close() {
    this.#ws.close();
  }

  /** Wykonuje wyrażenie w stronie i zwraca wartość (musi być serializowalna). */
  async evaluate(expression) {
    const { result, exceptionDetails } = await this.send('Runtime.evaluate', {
      expression: `(async () => { ${expression} })()`,
      returnByValue: true,
      awaitPromise: true,
    });
    if (exceptionDetails) {
      throw new Error(exceptionDetails.exception?.description ?? JSON.stringify(exceptionDetails));
    }
    return result.value;
  }

  async screenshot(path) {
    const { data } = await this.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(path, Buffer.from(data, 'base64'));
    return path;
  }

  async key(key) {
    const map = {
      Enter: { code: 'Enter', vk: 13, text: '\r' },
      Backspace: { code: 'Backspace', vk: 8, text: undefined },
    };
    const spec = map[key] ?? { code: `Digit${key}`, vk: key.charCodeAt(0), text: key };

    await this.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key,
      code: spec.code,
      windowsVirtualKeyCode: spec.vk,
      nativeVirtualKeyCode: spec.vk,
      ...(spec.text ? { text: spec.text } : {}),
    });
    await this.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key,
      code: spec.code,
      windowsVirtualKeyCode: spec.vk,
      nativeVirtualKeyCode: spec.vk,
    });
  }

  async type(digits) {
    for (const d of String(digits)) await this.key(d);
  }
}

/** Ekran telefonu — gra jest projektowana pod dotyk. */
export async function setupPage(cdp, { width = 390, height = 844 } = {}) {
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: true,
  });
}

export async function goto(cdp, url) {
  const loaded = cdp.once('Page.loadEventFired');
  await cdp.send('Page.navigate', { url });
  await loaded;
}
