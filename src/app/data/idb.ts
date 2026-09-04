/**
 * Cienka warstwa nad IndexedDB. Bez Dexie — potrzebujemy jednego magazynu
 * i czterech operacji, biblioteka byłaby cięższa od problemu.
 */

export const DB_NAME = 'tabliczka-mnozenia';
export const DB_VERSION = 1;
export const FACTS_STORE = 'facts';

/** Klucz główny magazynu faktów. */
const KEY_PATH = 'key';

function wrap<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Operacja IndexedDB nie powiodła się'));
  });
}

function finished(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('Transakcja przerwana'));
    tx.onerror = () => reject(tx.error ?? new Error('Transakcja nie powiodła się'));
  });
}

/** Czy przeglądarka w ogóle daje nam IndexedDB (tryb prywatny bywa skąpy). */
export function isAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

export function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FACTS_STORE)) {
        db.createObjectStore(FACTS_STORE, { keyPath: KEY_PATH });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Nie udało się otworzyć bazy'));
    request.onblocked = () => reject(new Error('Baza zablokowana przez inną kartę'));
  });
}

export function readAll(db: IDBDatabase, store: string): Promise<unknown[]> {
  return wrap(db.transaction(store, 'readonly').objectStore(store).getAll());
}

export async function writeAll(db: IDBDatabase, store: string, records: readonly unknown[]): Promise<void> {
  const tx = db.transaction(store, 'readwrite');
  const objectStore = tx.objectStore(store);
  for (const record of records) {
    objectStore.put(record);
  }
  await finished(tx);
}

export async function clearStore(db: IDBDatabase, store: string): Promise<void> {
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).clear();
  await finished(tx);
}
