import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Unsubscribe
} from 'firebase/firestore';
import { validateIncomingSyncPayload } from '../validation';
import { OperationType, handleFirestoreError, initFirebaseClient } from './firebaseClient';
import {
  getProcessedSyncIds,
  markBookmarkletLibrarySynced,
  markSyncIdProcessed,
  shouldSyncBookmarkletLibrary
} from './localCacheRepository';

const LIB_VERSION = '6.0';

export async function ensureBookmarkletLibrarySynced(force = false): Promise<void> {
  if (!force && !shouldSyncBookmarkletLibrary(LIB_VERSION)) return;

  const client = initFirebaseClient();
  if (!client || typeof fetch === 'undefined') return;

  let scriptText = '';
  try {
    const res = await fetch('/tw-erp-auto-sync.user.js', { cache: 'default' });
    if (!res.ok) return;
    scriptText = await res.text();
  } catch {
    return;
  }

  if (!scriptText || scriptText.length < 500 || scriptText.length > 240000) return;

  const docPath = 'incomingVillageSyncs/tw_lib';
  const docRef = doc(client.db, 'incomingVillageSyncs', 'tw_lib');
  let existing;
  try {
    existing = await getDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, docPath);
  }

  if (existing.exists() && existing.data()?.payloadJson === scriptText) {
    markBookmarkletLibrarySynced(LIB_VERSION);
    return;
  }

  try {
    await setDoc(
      docRef,
      {
        syncId: 'tw_lib',
        villageId: 'tw_lib',
        worldCode: 'lib',
        playerName: 'tw_lib',
        villageName: 'TW ERP Library',
        payloadJson: scriptText,
        clientTimestamp: Date.now(),
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
    markBookmarkletLibrarySynced(LIB_VERSION);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, docPath);
  }
}

export async function fetchAndConsumeIncomingSyncsOnce(
  onIncomingPayload: (syncId: string, payload: Record<string, any>) => void
): Promise<number> {
  const client = initFirebaseClient();
  if (!client) return 0;

  const q = query(collection(client.db, 'incomingVillageSyncs'), where('clientTimestamp', '>=', 0));
  let snapshot;
  try {
    snapshot = await getDocs(q);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'incomingVillageSyncs');
  }

  const processed = getProcessedSyncIds();
  let appliedCount = 0;

  for (const snapDoc of snapshot.docs) {
    const d = snapDoc.data();
    const syncId = String(d.syncId || snapDoc.id || '');
    if (!syncId || syncId === 'sync_1001' || syncId === 'tw_lib') continue;
    if (processed.has(syncId)) continue;

    let parsed: Record<string, any>;
    try {
      parsed = JSON.parse(String(d.payloadJson || '{}'));
    } catch {
      continue;
    }
    const validation = validateIncomingSyncPayload(parsed);
    if (!validation.valid) continue;

    const payload = validation.data;
    if (!payload.timestamp && d.clientTimestamp) {
      payload.timestamp = Number(d.clientTimestamp);
    }

    markSyncIdProcessed(syncId);
    onIncomingPayload(syncId, payload);
    appliedCount += 1;

    const consumedPath = `incomingVillageSyncs/${snapDoc.id}`;
    deleteDoc(doc(client.db, 'incomingVillageSyncs', snapDoc.id)).catch((delErr) => {
      handleFirestoreError(delErr, OperationType.DELETE, consumedPath);
    });
  }

  return appliedCount;
}

export function subscribeIncomingSyncs(
  onIncomingPayload: (syncId: string, payload: Record<string, any>) => void
): Unsubscribe | null {
  const client = initFirebaseClient();
  if (!client) return null;

  const q = query(collection(client.db, 'incomingVillageSyncs'), where('clientTimestamp', '>=', 0));
  return onSnapshot(
    q,
    (snapshot) => {
      const processed = getProcessedSyncIds();
      snapshot.docChanges().forEach((change) => {
        if (change.type !== 'added' && change.type !== 'modified') return;
        const d = change.doc.data();
        const syncId = String(d.syncId || change.doc.id || '');
        if (!syncId || syncId === 'sync_1001' || syncId === 'tw_lib') return;
        if (processed.has(syncId)) return;

        let parsed: Record<string, any>;
        try {
          parsed = JSON.parse(String(d.payloadJson || '{}'));
        } catch {
          return;
        }
        const validation = validateIncomingSyncPayload(parsed);
        if (!validation.valid) return;

        const payload = validation.data;
        if (!payload.timestamp && d.clientTimestamp) {
          payload.timestamp = Number(d.clientTimestamp);
        }

        markSyncIdProcessed(syncId);
        onIncomingPayload(syncId, payload);

        const consumedPath = `incomingVillageSyncs/${change.doc.id}`;
        deleteDoc(doc(client.db, 'incomingVillageSyncs', change.doc.id)).catch((delErr) => {
          handleFirestoreError(delErr, OperationType.DELETE, consumedPath);
        });
      });
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'incomingVillageSyncs');
    }
  );
}
