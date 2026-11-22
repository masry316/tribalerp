import { repairStateIntegrity, type ErpAppState } from '../core';

export const LOCAL_STATE_KEY = 'tw_multiacc_state_v6';
export const LOCAL_META_KEY = 'tw_erp_firestore_meta_v1';
export const PROCESSED_SYNCS_KEY = 'tw_erp_processed_syncs_v1';
export const LIB_SYNCED_KEY = 'tw_erp_lib_synced_v1';
export const DEFAULT_LIB_SYNC_TTL_MS = 24 * 60 * 60 * 1000;

export const IDB_DB_NAME = 'tw_erp_cache_db_v1';
export const IDB_STORE_NAME = 'workspace_cache';
export const IDB_SNAPSHOT_KEY = 'master_snapshot';

export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
}

export interface LocalCacheMeta {
  clientTimestamp: number;
  dirty: boolean;
  source: string;
}

export interface CachedWorkspaceRecord {
  state: ErpAppState;
  meta: LocalCacheMeta;
}

export interface IdbCacheAdapter {
  read: () => Promise<CachedWorkspaceRecord | null>;
  write: (record: CachedWorkspaceRecord) => Promise<void>;
  clear: () => Promise<void>;
}

export interface LoadedLocalCacheResult {
  state: ErpAppState | null;
  localTs: number;
  dirty: boolean;
  hasLocalCache: boolean;
  backend?: 'localStorage' | 'indexedDB' | 'none';
}

function getDefaultStorage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function openCacheDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(IDB_DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
          db.createObjectStore(IDB_STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

const browserIdbAdapter: IdbCacheAdapter = {
  async read(): Promise<CachedWorkspaceRecord | null> {
    const db = await openCacheDatabase();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE_NAME, 'readonly');
        const store = tx.objectStore(IDB_STORE_NAME);
        const req = store.get(IDB_SNAPSHOT_KEY);
        req.onsuccess = () => {
          const val = req.result;
          db.close();
          if (val && typeof val === 'object' && val.state) {
            resolve({
              state: repairStateIntegrity(val.state),
              meta: {
                clientTimestamp: Number(val.meta?.clientTimestamp || 0),
                dirty: Boolean(val.meta?.dirty),
                source: String(val.meta?.source || 'indexeddb')
              }
            });
          } else {
            resolve(null);
          }
        };
        req.onerror = () => {
          db.close();
          resolve(null);
        };
      } catch {
        try {
          db.close();
        } catch {
          // ignore
        }
        resolve(null);
      }
    });
  },
  async write(record: CachedWorkspaceRecord): Promise<void> {
    const db = await openCacheDatabase();
    if (!db) return;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
        const store = tx.objectStore(IDB_STORE_NAME);
        store.put(record, IDB_SNAPSHOT_KEY);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          resolve();
        };
        tx.onabort = () => {
          db.close();
          resolve();
        };
      } catch {
        try {
          db.close();
        } catch {
          // ignore
        }
        resolve();
      }
    });
  },
  async clear(): Promise<void> {
    const db = await openCacheDatabase();
    if (!db) return;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
        tx.objectStore(IDB_STORE_NAME).delete(IDB_SNAPSHOT_KEY);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          resolve();
        };
      } catch {
        try {
          db.close();
        } catch {
          // ignore
        }
        resolve();
      }
    });
  }
};

export function getDefaultIdbAdapter(): IdbCacheAdapter | null {
  if (typeof indexedDB === 'undefined') return null;
  return browserIdbAdapter;
}

export function getLocalCacheMeta(storage: StorageLike | null = getDefaultStorage()): LocalCacheMeta {
  try {
    if (!storage) return { clientTimestamp: 0, dirty: false, source: 'none' };
    const raw = storage.getItem(LOCAL_META_KEY);
    if (!raw) return { clientTimestamp: 0, dirty: false, source: 'none' };
    const parsed = JSON.parse(raw);
    return {
      clientTimestamp: Number(parsed?.clientTimestamp || 0),
      dirty: Boolean(parsed?.dirty),
      source: String(parsed?.source || 'local')
    };
  } catch {
    return { clientTimestamp: 0, dirty: false, source: 'none' };
  }
}

export function loadLocalCachedState(
  storage: StorageLike | null = getDefaultStorage()
): LoadedLocalCacheResult {
  try {
    if (!storage) {
      return { state: null, localTs: 0, dirty: false, hasLocalCache: false, backend: 'none' };
    }
    const raw = storage.getItem(LOCAL_STATE_KEY);
    if (!raw) {
      return { state: null, localTs: 0, dirty: false, hasLocalCache: false, backend: 'none' };
    }
    const parsed = JSON.parse(raw);
    const meta = getLocalCacheMeta(storage);
    return {
      state: repairStateIntegrity(parsed),
      localTs: meta.clientTimestamp,
      dirty: meta.dirty,
      hasLocalCache: true,
      backend: 'localStorage'
    };
  } catch {
    return { state: null, localTs: 0, dirty: false, hasLocalCache: false, backend: 'none' };
  }
}

export function persistLocalCachedState(
  state: ErpAppState,
  clientTimestamp?: number,
  markDirty = false,
  storage: StorageLike | null = getDefaultStorage(),
  idbAdapter: IdbCacheAdapter | null = getDefaultIdbAdapter()
): void {
  const prevMeta = getLocalCacheMeta(storage);
  const nextMeta: LocalCacheMeta = {
    clientTimestamp: clientTimestamp ?? (prevMeta.clientTimestamp || Date.now()),
    dirty: markDirty ? true : prevMeta.dirty,
    source: 'react-erp'
  };

  try {
    if (storage) {
      storage.setItem(LOCAL_STATE_KEY, JSON.stringify(state));
      storage.setItem(LOCAL_META_KEY, JSON.stringify(nextMeta));
    }
  } catch {
    // localStorage quota exceeded — IndexedDB below still persists full snapshot
  }

  if (idbAdapter) {
    void idbAdapter.write({ state, meta: nextMeta }).catch(() => {});
  }
}

export function markLocalCacheClean(
  clientTimestamp: number,
  storage: StorageLike | null = getDefaultStorage(),
  idbAdapter: IdbCacheAdapter | null = getDefaultIdbAdapter()
): void {
  const cleanMeta: LocalCacheMeta = {
    clientTimestamp,
    dirty: false,
    source: 'firestore'
  };

  try {
    if (storage) {
      storage.setItem(LOCAL_META_KEY, JSON.stringify(cleanMeta));
    }
  } catch {
    // ignore storage errors
  }

  if (idbAdapter) {
    const lsCached = loadLocalCachedState(storage);
    if (lsCached.state) {
      void idbAdapter.write({ state: lsCached.state, meta: cleanMeta }).catch(() => {});
    } else {
      void idbAdapter
        .read()
        .then((existing) => {
          if (existing?.state) {
            return idbAdapter.write({ state: existing.state, meta: cleanMeta });
          }
          return undefined;
        })
        .catch(() => {});
    }
  }
}

export async function saveSnapshotToIndexedDB(
  state: ErpAppState,
  meta: LocalCacheMeta,
  idbAdapter: IdbCacheAdapter | null = getDefaultIdbAdapter()
): Promise<void> {
  if (!idbAdapter) return;
  await idbAdapter.write({ state, meta });
}

export async function loadSnapshotFromIndexedDB(
  idbAdapter: IdbCacheAdapter | null = getDefaultIdbAdapter()
): Promise<LoadedLocalCacheResult> {
  if (!idbAdapter) {
    return { state: null, localTs: 0, dirty: false, hasLocalCache: false, backend: 'none' };
  }
  const rec = await idbAdapter.read();
  if (!rec || !rec.state) {
    return { state: null, localTs: 0, dirty: false, hasLocalCache: false, backend: 'none' };
  }
  return {
    state: repairStateIntegrity(rec.state),
    localTs: Number(rec.meta?.clientTimestamp || 0),
    dirty: Boolean(rec.meta?.dirty),
    hasLocalCache: true,
    backend: 'indexedDB'
  };
}

/**
 * Hydrates workspace state from both localStorage and IndexedDB, selecting the
 * freshest available snapshot and mirroring it back so reloads never require
 * network requests to Firestore.
 */
export async function loadHydratedLocalCache(
  storage: StorageLike | null = getDefaultStorage(),
  idbAdapter: IdbCacheAdapter | null = getDefaultIdbAdapter()
): Promise<LoadedLocalCacheResult> {
  const lsResult = loadLocalCachedState(storage);
  const idbResult = await loadSnapshotFromIndexedDB(idbAdapter);

  if (idbResult.hasLocalCache && idbResult.state) {
    const idbIsNewer = !lsResult.hasLocalCache || idbResult.localTs > lsResult.localTs;
    if (idbIsNewer) {
      // Mirror fresher IndexedDB snapshot back into localStorage for instant next paint
      try {
        if (storage) {
          storage.setItem(LOCAL_STATE_KEY, JSON.stringify(idbResult.state));
          storage.setItem(
            LOCAL_META_KEY,
            JSON.stringify({
              clientTimestamp: idbResult.localTs,
              dirty: idbResult.dirty,
              source: 'indexeddb'
            })
          );
        }
      } catch {
        // ignore quota errors
      }
      return idbResult;
    }
  }

  if (lsResult.hasLocalCache && lsResult.state) {
    // Ensure IndexedDB mirrors the localStorage snapshot when missing or older
    if (idbAdapter && (!idbResult.hasLocalCache || lsResult.localTs > idbResult.localTs)) {
      const meta = getLocalCacheMeta(storage);
      void idbAdapter.write({ state: lsResult.state, meta }).catch(() => {});
    }
    return lsResult;
  }

  return { state: null, localTs: 0, dirty: false, hasLocalCache: false, backend: 'none' };
}

export async function clearLocalCache(
  storage: StorageLike | null = getDefaultStorage(),
  idbAdapter: IdbCacheAdapter | null = getDefaultIdbAdapter()
): Promise<void> {
  try {
    storage?.removeItem?.(LOCAL_STATE_KEY);
    storage?.removeItem?.(LOCAL_META_KEY);
  } catch {
    // ignore storage errors
  }
  if (idbAdapter) {
    await idbAdapter.clear().catch(() => {});
  }
}

export function getProcessedSyncIds(storage: StorageLike | null = getDefaultStorage()): Set<string> {
  try {
    if (!storage) return new Set();
    const raw = storage.getItem(PROCESSED_SYNCS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}

export function markSyncIdProcessed(
  syncId: string,
  storage: StorageLike | null = getDefaultStorage()
): void {
  try {
    if (!storage) return;
    const set = getProcessedSyncIds(storage);
    set.add(syncId);
    const arr = Array.from(set).slice(-300);
    storage.setItem(PROCESSED_SYNCS_KEY, JSON.stringify(arr));
  } catch {
    // ignore storage errors
  }
}

export function shouldSyncBookmarkletLibrary(
  version: string,
  nowMs: number = Date.now(),
  storage: StorageLike | null = getDefaultStorage(),
  ttlMs: number = DEFAULT_LIB_SYNC_TTL_MS
): boolean {
  try {
    if (!storage) return true;
    const raw = storage.getItem(LIB_SYNCED_KEY);
    if (!raw) return true;
    const parsed = JSON.parse(raw);
    if (String(parsed?.version || '') !== version) return true;
    const ts = Number(parsed?.syncedAt || 0);
    return nowMs - ts >= ttlMs;
  } catch {
    return true;
  }
}

export function markBookmarkletLibrarySynced(
  version: string,
  nowMs: number = Date.now(),
  storage: StorageLike | null = getDefaultStorage()
): void {
  try {
    if (!storage) return;
    storage.setItem(LIB_SYNCED_KEY, JSON.stringify({ version, syncedAt: nowMs }));
  } catch {
    // ignore storage errors
  }
}

export function shouldSkipRemoteSnapshot(params: {
  cloudTs: number;
  localTs: number;
  dirty: boolean;
  sameDevice: boolean;
}): boolean {
  if (params.sameDevice && !params.dirty && params.cloudTs <= params.localTs) {
    return true;
  }
  if (!params.dirty && params.cloudTs > 0 && params.localTs > 0 && params.cloudTs <= params.localTs) {
    return true;
  }
  return false;
}
