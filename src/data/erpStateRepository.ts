import {
  collection,
  doc,
  getDoc,
  getDocFromCache,
  getDocFromServer,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
  type Firestore,
  type Unsubscribe
} from 'firebase/firestore';
import {
  computeFirestoreDashboardSummary,
  createDefaultAppState,
  mergeCloudSnapshotWithLocalSecrets,
  repairStateIntegrity,
  resolveConflictResolutionStrategy,
  sanitizeStateForFirestore,
  type ErpAppState,
  type SyncStatusState
} from '../core';
import {
  BLUEPRINT_LIMITS,
  extractErdBatchRecords,
  prepareErpStateSnapshotDoc
} from './blueprintConstraints';
import {
  DEVICE_TAG,
  OperationType,
  buildFirestoreErrorInfo,
  handleFirestoreError,
  initFirebaseClient
} from './firebaseClient';
import {
  loadLocalCachedState,
  markLocalCacheClean,
  persistLocalCachedState,
  shouldSkipRemoteSnapshot
} from './localCacheRepository';

export async function loadMasterState(options?: { forceNetwork?: boolean }): Promise<{
  state: ErpAppState;
  cloudTs: number;
  source: 'firestore' | 'cache' | 'default';
  shouldPushLocal?: boolean;
  errorMessage?: string;
}> {
  const cached = loadLocalCachedState();
  const client = initFirebaseClient();
  if (!client) {
    return {
      state: cached.state || createDefaultAppState(),
      cloudTs: cached.localTs,
      source: cached.state ? 'cache' : 'default'
    };
  }

  // If browser already holds a local cache and caller didn't force a network fetch,
  // serve immediately and let the single onSnapshot listener apply any newer delta.
  if (cached.hasLocalCache && cached.state && !options?.forceNetwork) {
    return {
      state: cached.state,
      cloudTs: cached.localTs,
      source: 'cache',
      shouldPushLocal: cached.dirty
    };
  }

  const path = 'erpStates/master';
  const docRef = doc(client.db, 'erpStates', 'master');
  let snap;
  try {
    if (!options?.forceNetwork) {
      try {
        snap = await getDocFromCache(docRef);
      } catch {
        snap = await getDoc(docRef);
      }
    } else {
      snap = await getDocFromServer(docRef);
    }
  } catch (err) {
    if (cached.state) {
      const info = buildFirestoreErrorInfo(err, OperationType.GET, path);
      console.warn('Firestore Error (cached fallback active):', JSON.stringify(info));
      return {
        state: cached.state,
        cloudTs: cached.localTs,
        source: 'cache',
        errorMessage: info.error
      };
    }
    handleFirestoreError(err, OperationType.GET, path);
  }

  if (snap.exists()) {
    const data = snap.data();
    const cloudTs = Number(data.clientTimestamp || 0);
    const rawCloud = JSON.parse(String(data.stateJson || '{}'));
    const cloudState = repairStateIntegrity(rawCloud);

    const strategy = resolveConflictResolutionStrategy({
      localTimestamp: cached.localTs,
      cloudTimestamp: cloudTs,
      hasPendingLocalChanges: cached.dirty,
      deviceTagMatchesSelf: data.deviceTag === DEVICE_TAG
    });

    if (cached.state && strategy === 'PUSH_LOCAL_TO_CLOUD') {
      return {
        state: cached.state,
        cloudTs: cached.localTs,
        source: 'cache',
        shouldPushLocal: true
      };
    }

    const merged = cached.state
      ? (mergeCloudSnapshotWithLocalSecrets(cloudState as any, cached.state as any) as unknown as ErpAppState)
      : cloudState;

    persistLocalCachedState(merged, cloudTs, false);
    markLocalCacheClean(cloudTs);
    return { state: merged, cloudTs, source: 'firestore' };
  }

  return {
    state: cached.state || createDefaultAppState(),
    cloudTs: cached.localTs,
    source: cached.state ? 'cache' : 'default',
    shouldPushLocal: Boolean(cached.state)
  };
}

export async function syncErdCollectionsToFirestore(db: Firestore, state: ErpAppState): Promise<void> {
  const allDocs = extractErdBatchRecords(state);
  for (let i = 0; i < allDocs.length; i += 400) {
    const chunk = allDocs.slice(i, i + 400);
    const batch = writeBatch(db);
    chunk.forEach((item) => {
      batch.set(doc(db, item.col, item.id), item.data, { merge: true });
    });
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'batch/erdCollections');
    }
  }
}

export async function saveMasterState(state: ErpAppState): Promise<{
  ok: boolean;
  clientTimestamp: number;
  error?: string;
}> {
  const clientTimestamp = Date.now();
  persistLocalCachedState(state, clientTimestamp, true);

  const client = initFirebaseClient();
  if (!client) {
    return { ok: false, clientTimestamp, error: 'Firebase غير متصل' };
  }

  const prepared = sanitizeStateForFirestore(state as any);
  if (prepared.stateJson.length > BLUEPRINT_LIMITS.safeStateJsonCeiling) {
    return { ok: false, clientTimestamp, error: 'حجم البيانات تخطى الحد الأقصى لوثيقة Firestore' };
  }

  const snapshotDoc = prepareErpStateSnapshotDoc(prepared, DEVICE_TAG, clientTimestamp);
  const path = 'erpStates/master';
  try {
    await setDoc(doc(client.db, 'erpStates', 'master'), snapshotDoc, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }

  markLocalCacheClean(clientTimestamp);
  syncErdCollectionsToFirestore(client.db, prepared.sanitizedState as unknown as ErpAppState).catch((e) => {
    console.warn('[ErpStateRepository] ERD sub-collection sync warning:', e);
  });

  return { ok: true, clientTimestamp };
}

export function subscribeMasterState(
  onRemoteState: (remoteState: ErpAppState, cloudTs: number) => void,
  onSyncStatus?: (patch: Partial<SyncStatusState>) => void
): Unsubscribe | null {
  const client = initFirebaseClient();
  if (!client) return null;

  const path = 'erpStates/master';
  return onSnapshot(
    doc(client.db, 'erpStates', 'master'),
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const cloudTs = Number(data.clientTimestamp || 0);
      const cached = loadLocalCachedState();
      const sameDevice = data.deviceTag === DEVICE_TAG;

      if (
        sameDevice ||
        shouldSkipRemoteSnapshot({
          cloudTs,
          localTs: cached.localTs,
          dirty: cached.dirty,
          sameDevice
        })
      ) {
        onSyncStatus?.({
          online: true,
          status: 'synced',
          lastSyncAt: cloudTs || cached.localTs || Date.now(),
          source: snap.metadata.fromCache ? 'cache' : 'firestore'
        });
        return;
      }

      try {
        const rawCloud = JSON.parse(String(data.stateJson || '{}'));
        const repaired = repairStateIntegrity(rawCloud);
        const merged = cached.state
          ? (mergeCloudSnapshotWithLocalSecrets(repaired as any, cached.state as any) as unknown as ErpAppState)
          : repaired;
        persistLocalCachedState(merged, cloudTs, false);
        markLocalCacheClean(cloudTs);
        onRemoteState(merged, cloudTs);
        onSyncStatus?.({
          online: true,
          status: 'synced',
          lastSyncAt: cloudTs,
          accountsCount: merged.userAccounts.length,
          villagesCount: merged.villages.length,
          totalPP: merged.userAccounts.reduce((s, a) => s + (Number(a.pp) || 0), 0),
          source: snap.metadata.fromCache ? 'cache' : 'firestore'
        });
      } catch (e) {
        console.warn('[ErpStateRepository] Remote snapshot parse failed:', e);
      }
    },
    (err) => {
      onSyncStatus?.({ online: typeof navigator !== 'undefined' ? navigator.onLine : true, status: 'error', errorMessage: err.message });
      handleFirestoreError(err, OperationType.GET, path);
    }
  );
}

export async function fetchFirestoreDashboardSummary(localState: ErpAppState) {
  const client = initFirebaseClient();
  if (!client) {
    return computeFirestoreDashboardSummary({ erpState: localState });
  }
  try {
    const [vilsSnap, accsSnap, plansSnap, worldsSnap] = await Promise.all([
      getDocs(collection(client.db, 'villages')),
      getDocs(collection(client.db, 'userAccounts')),
      getDocs(collection(client.db, 'villagePlans')),
      getDocs(collection(client.db, 'worlds'))
    ]);
    return computeFirestoreDashboardSummary({
      erpState: localState,
      villageDocs: vilsSnap.docs.map((d) => d.data()),
      accountDocs: accsSnap.docs.map((d) => d.data()),
      planDocs: plansSnap.docs.map((d) => d.data()),
      worldDocs: worldsSnap.docs.map((d) => d.data()),
      syncStatus: { status: 'synced', online: true, source: 'firestore' }
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'dashboardSummary');
  }
}
