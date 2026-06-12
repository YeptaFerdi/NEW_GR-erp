// Lightweight IndexedDB-backed queue for offline Supabase writes.
// When the browser is offline, mutating REST calls to /rest/v1/* are stored
// locally and replayed (FIFO) as soon as connectivity returns.

const DB_NAME = 'newgr_offline';
const STORE = 'pending_writes';
const DB_VERSION = 1;

export interface PendingWrite {
  id?: number;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  created_at: number;
}

const listeners = new Set<(count: number) => void>();

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const out = fn(store);
    if (out instanceof IDBRequest) {
      out.onsuccess = () => resolve(out.result as T);
      out.onerror = () => reject(out.error);
    } else {
      Promise.resolve(out).then(resolve, reject);
    }
    t.onerror = () => reject(t.error);
  });
}

export async function enqueueWrite(entry: Omit<PendingWrite, 'id' | 'created_at'>) {
  await tx('readwrite', (store) => store.add({ ...entry, created_at: Date.now() }));
  notify();
}

export async function listPending(): Promise<PendingWrite[]> {
  return tx('readonly', (store) => store.getAll()) as Promise<PendingWrite[]>;
}

export async function pendingCount(): Promise<number> {
  return tx('readonly', (store) => store.count());
}

async function removeEntry(id: number) {
  await tx('readwrite', (store) => store.delete(id));
  notify();
}

function notify() {
  pendingCount().then((n) => listeners.forEach((l) => l(n)));
}

export function onPendingChange(cb: (count: number) => void) {
  listeners.add(cb);
  pendingCount().then(cb);
  return () => listeners.delete(cb);
}

let syncing = false;
export async function syncPending(): Promise<{ ok: number; failed: number }> {
  if (syncing || !navigator.onLine) return { ok: 0, failed: 0 };
  syncing = true;
  let ok = 0;
  let failed = 0;
  try {
    const items = await listPending();
    items.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
    for (const item of items) {
      try {
        const res = await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: item.body ?? undefined,
        });
        if (res.ok || res.status === 409) {
          await removeEntry(item.id!);
          ok++;
        } else {
          failed++;
          break;
        }
      } catch {
        failed++;
        break;
      }
    }
  } finally {
    syncing = false;
  }
  return { ok, failed };
}

export function offlineFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const method = (init?.method || 'GET').toUpperCase();
  const isRest = url.includes('/rest/v1/');
  const isWrite = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method);

  if (!navigator.onLine && isRest && isWrite) {
    const headers: Record<string, string> = {};
    const h = new Headers(init?.headers || {});
    h.forEach((v, k) => (headers[k] = v));
    const body = typeof init?.body === 'string' ? init!.body : init?.body ? String(init.body) : null;
    enqueueWrite({ url, method, headers, body });
    return Promise.resolve(
      new Response('[]', {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      })
    );
  }
  return fetch(input, init);
}

export function initOfflineSync() {
  const tryRun = () => {
    syncPending().catch(() => undefined);
  };
  window.addEventListener('online', tryRun);
  window.addEventListener('focus', tryRun);
  setInterval(tryRun, 30000);
  if (navigator.onLine) tryRun();
}
