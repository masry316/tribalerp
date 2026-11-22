import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  doc,
  getDocFromServer,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore
} from 'firebase/firestore';
import firebaseConfigJson from '../../firebase-applet-config.json';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write'
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function buildFirestoreErrorInfo(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  return {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    }
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo = buildFirestoreErrorInfo(error, operationType, path);
  const serialized = JSON.stringify(errInfo);
  console.error('Firestore Error: ', serialized);
  throw new Error(serialized);
}

const DEVICE_TAG_KEY = 'tw_erp_device_tag_v1';
const CONN_TESTED_SESSION_KEY = 'tw_erp_conn_tested_v1';

function resolveDeviceTag(): string {
  try {
    if (typeof localStorage === 'undefined') return 'dev_node';
    let tag = localStorage.getItem(DEVICE_TAG_KEY);
    if (!tag) {
      tag = `dev_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
      localStorage.setItem(DEVICE_TAG_KEY, tag);
    }
    return tag;
  } catch {
    return 'dev_browser';
  }
}

export const DEVICE_TAG = resolveDeviceTag();

let appInstance: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;
let connectionTested = false;

export function initFirebaseClient(): { app: FirebaseApp; db: Firestore } | null {
  try {
    if (appInstance && dbInstance) {
      return { app: appInstance, db: dbInstance };
    }
    const existing = getApps();
    appInstance = existing.length > 0 ? existing[0] : initializeApp(firebaseConfigJson);

    if (typeof indexedDB !== 'undefined' && typeof window !== 'undefined') {
      try {
        dbInstance = initializeFirestore(
          appInstance,
          {
            localCache: persistentLocalCache({
              tabManager: persistentMultipleTabManager()
            })
          },
          firebaseConfigJson.firestoreDatabaseId
        );
      } catch {
        dbInstance = getFirestore(appInstance, firebaseConfigJson.firestoreDatabaseId);
      }
    } else {
      dbInstance = getFirestore(appInstance, firebaseConfigJson.firestoreDatabaseId);
    }

    return { app: appInstance, db: dbInstance };
  } catch (err) {
    console.warn('[FirebaseClient] Initialization failed:', err);
    return null;
  }
}

export async function testFirestoreConnection(): Promise<{ ok: boolean; offline: boolean; error?: string }> {
  try {
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(CONN_TESTED_SESSION_KEY) === '1') {
      connectionTested = true;
      return { ok: true, offline: false };
    }
  } catch {
    // ignore sessionStorage errors
  }

  const client = initFirebaseClient();
  if (!client) {
    return { ok: false, offline: true, error: 'Firebase client unavailable' };
  }
  try {
    await getDocFromServer(doc(client.db, 'test', 'connection'));
    connectionTested = true;
    try {
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(CONN_TESTED_SESSION_KEY, '1');
    } catch {
      // ignore
    }
    return { ok: true, offline: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const offline = msg.includes('the client is offline');
    if (offline) {
      console.error('Please check your Firebase configuration.');
    }
    return { ok: false, offline, error: msg };
  }
}

export function hasTestedConnection(): boolean {
  return connectionTested;
}
