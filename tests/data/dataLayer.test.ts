import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createDefaultAppState, sanitizeStateForFirestore } from '../../src/core';
import {
  BLUEPRINT_LIMITS,
  OperationType,
  buildFirestoreErrorInfo,
  clearLocalCache,
  exportStateBackupJson,
  extractErdBatchRecords,
  getLocalCacheMeta,
  getProcessedSyncIds,
  handleFirestoreError,
  loadHydratedLocalCache,
  loadLocalCachedState,
  loadSnapshotFromIndexedDB,
  markBookmarkletLibrarySynced,
  markLocalCacheClean,
  markSyncIdProcessed,
  mutateApplyIncomingSync,
  mutateAssignVillagePlan,
  mutateDeleteAccount,
  mutateDeleteVillage,
  mutateImportBackupJson,
  mutateOverrideDailySession,
  mutateResetWorkspace,
  mutateSaveAccount,
  mutateSaveVillage,
  mutateSaveWorld,
  mutateUpdateContinentRates,
  persistLocalCachedState,
  prepareErpStateSnapshotDoc,
  prepareUserAccountDoc,
  prepareVillageDoc,
  prepareVillagePlanDoc,
  prepareWorldMarketDoc,
  sanitizeDocId,
  saveSnapshotToIndexedDB,
  shouldSkipRemoteSnapshot,
  shouldSyncBookmarkletLibrary,
  type CachedWorkspaceRecord,
  type IdbCacheAdapter,
  type StorageLike
} from '../../src/data';

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    }
  };
}

function createMemoryIdbAdapter(): IdbCacheAdapter {
  let stored: CachedWorkspaceRecord | null = null;
  return {
    async read() {
      return stored ? JSON.parse(JSON.stringify(stored)) : null;
    },
    async write(record) {
      stored = JSON.parse(JSON.stringify(record));
    },
    async clear() {
      stored = null;
    }
  };
}

const blueprint = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'firebase-blueprint.json'), 'utf8'));

test('handleFirestoreError formats FirestoreErrorInfo JSON matching firebase-integration skill contract', () => {
  const info = buildFirestoreErrorInfo(new Error('Missing or insufficient permissions.'), OperationType.WRITE, 'villages/vil_1');
  assert.equal(info.operationType, OperationType.WRITE);
  assert.equal(info.path, 'villages/vil_1');
  assert.match(info.error, /permissions/i);

  assert.throws(
    () => handleFirestoreError(new Error('permission-denied'), OperationType.GET, 'erpStates/master'),
    (thrown: Error) => {
      const parsed = JSON.parse(thrown.message);
      assert.equal(parsed.operationType, 'get');
      assert.equal(parsed.path, 'erpStates/master');
      assert.equal(parsed.error, 'permission-denied');
      assert.ok(parsed.authInfo);
      return true;
    }
  );
});

test('blueprintConstraints match firebase-blueprint.json limits and strip PII from UserAccount', () => {
  assert.equal(BLUEPRINT_LIMITS.stateJsonMaxLength, blueprint.entities.ErpStateSnapshot.properties.stateJson.maxLength);
  assert.equal(BLUEPRINT_LIMITS.accountNameMaxLength, blueprint.entities.UserAccount.properties.name.maxLength);
  assert.equal(BLUEPRINT_LIMITS.villageNameMaxLength, blueprint.entities.Village.properties.name.maxLength);

  const mockTs = { nowServerTimestamp: () => 'SERVER_TS' };
  const accDoc = prepareUserAccountDoc(
    {
      id: 'acc$bad!id',
      name: 'أبو عمر',
      password: 'secret_password_123',
      email: 'secret@example.com',
      pp: 4200,
      device: 'Mobile',
      browser: 'Chrome',
      ip: '197.1.2.3',
      deviceId: 'dev_1',
      lastSyncTime: 1000
    },
    mockTs
  );

  assert.equal('password' in accDoc, false);
  assert.equal('email' in accDoc, false);
  assert.match(accDoc.id, BLUEPRINT_LIMITS.idPattern);
  assert.deepEqual(Object.keys(accDoc).sort(), [...blueprint.entities.UserAccount.required].sort());
});

test('prepareVillageDoc, prepareWorldMarketDoc, prepareVillagePlanDoc, prepareErpStateSnapshotDoc emit exact required keys', () => {
  const mockTs = { nowServerTimestamp: () => 'SERVER_TS' };
  const state = createDefaultAppState();
  assert.equal(state.userAccounts.length, 0);
  assert.equal(state.villages.length, 0);

  const accRes = mutateSaveAccount(state, { name: 'لاعب 1', pp: 1000, ip: '1.2.3.4', device: 'PC', browser: 'Chrome', email: '', password: '' }, 5000);
  assert.equal(accRes.ok, true);
  const vilRes = mutateSaveVillage(
    accRes.state,
    {
      name: 'قرية البداية',
      accountId: accRes.updatedAccount!.id,
      worldId: 'w_94',
      continent: '44',
      coord: '512|488',
      flag: 6,
      woodItem: 10,
      clayItem: 10,
      ironItem: 10,
      premium: true,
      boost30: false,
      warehouseLevel: 12,
      marketLevel: 8,
      farmLevel: 10,
      woodLevel: 18,
      clayLevel: 18,
      ironLevel: 17,
      woodStock: 5000,
      clayStock: 4000,
      ironStock: 3500,
      spearsTotal: 250,
      swordsTotal: 50,
      axesTotal: 0,
      lightsTotal: 20,
      heaviesTotal: 0,
      unlockedScavTiers: 3
    },
    5000
  );
  assert.equal(vilRes.ok, true);

  const vilDoc = prepareVillageDoc(vilRes.updatedVillage!, mockTs);
  assert.deepEqual(Object.keys(vilDoc).sort(), [...blueprint.entities.Village.required].sort());
  assert.equal(vilDoc.spearsTotal, 250);
  assert.equal(vilDoc.lightsTotal, 20);

  const worldDoc = prepareWorldMarketDoc(vilRes.state.worlds[0], mockTs);
  assert.deepEqual(Object.keys(worldDoc).sort(), [...blueprint.entities.WorldMarket.required].sort());

  const planDoc = prepareVillagePlanDoc(
    `plan_${vilRes.updatedVillage!.id}`,
    vilRes.updatedVillage!.id,
    vilRes.updatedVillage!,
    {
      id: 'p1',
      name: 'خطة مرحلة 1',
      assignedAt: 5000,
      steps: [{ atype: 'bldg', bName: 'الخشاب م18', baseName: 'الخشاب', targetLvl: 18 }]
    },
    'virtual26',
    mockTs
  );
  assert.deepEqual(Object.keys(planDoc).sort(), [...blueprint.entities.VillagePlan.required].sort());
  assert.equal(planDoc.progressPct, 100);

  const prepared = sanitizeStateForFirestore(vilRes.state as any);
  const snapDoc = prepareErpStateSnapshotDoc(prepared, 'dev_test', 5000, mockTs);
  assert.deepEqual(Object.keys(snapDoc).sort(), [...blueprint.entities.ErpStateSnapshot.required].sort());
  assert.equal(snapDoc.accountsCount, 1);
  assert.equal(snapDoc.villagesCount, 1);

  const batch = extractErdBatchRecords(vilRes.state, mockTs);
  assert.equal(batch.length, 3);
  assert.equal(sanitizeDocId('weird id!@#'), 'weird_id___');
});

test('localCacheRepository persists, marks dirty/clean, and tracks processed sync IDs', () => {
  const storage = createMemoryStorage();
  const base = createDefaultAppState();
  const accRes = mutateSaveAccount(base, { name: 'كاش 1', pp: 250, ip: '', device: '', browser: '', email: '', password: '' }, 1000);
  assert.equal(accRes.ok, true);

  persistLocalCachedState(accRes.state, 9999, true, storage);
  const loaded = loadLocalCachedState(storage);
  assert.equal(loaded.hasLocalCache, true);
  assert.equal(loaded.localTs, 9999);
  assert.equal(loaded.dirty, true);
  assert.equal(loaded.state?.userAccounts.length, 1);

  markLocalCacheClean(12345, storage);
  const meta = getLocalCacheMeta(storage);
  assert.equal(meta.dirty, false);
  assert.equal(meta.clientTimestamp, 12345);

  markSyncIdProcessed('sync_abc', storage);
  assert.equal(getProcessedSyncIds(storage).has('sync_abc'), true);

  // Library sync 24h TTL
  assert.equal(shouldSyncBookmarkletLibrary('v1', 1000, storage), true);
  markBookmarkletLibrarySynced('v1', 1000, storage);
  assert.equal(shouldSyncBookmarkletLibrary('v1', 2000, storage), false);
  assert.equal(shouldSyncBookmarkletLibrary('v2', 2000, storage), true);
  assert.equal(shouldSyncBookmarkletLibrary('v1', 1000 + 25 * 3600_000, storage), true);

  // Remote snapshot skip logic avoids redundant reloads on reopen
  assert.equal(shouldSkipRemoteSnapshot({ cloudTs: 1000, localTs: 1000, dirty: false, sameDevice: true }), true);
  assert.equal(shouldSkipRemoteSnapshot({ cloudTs: 900, localTs: 1000, dirty: false, sameDevice: false }), true);
  assert.equal(shouldSkipRemoteSnapshot({ cloudTs: 1200, localTs: 1000, dirty: false, sameDevice: false }), false);
  assert.equal(shouldSkipRemoteSnapshot({ cloudTs: 1000, localTs: 1000, dirty: true, sameDevice: true }), false);
});

test('IndexedDB dual cache persists snapshots, recovers when localStorage is empty, and reconciles newer timestamps', async () => {
  const storage = createMemoryStorage();
  const idb = createMemoryIdbAdapter();

  const base = createDefaultAppState();
  const acc1 = mutateSaveAccount(base, { name: 'حساب كاش 1', pp: 500, ip: '', device: '', browser: '', email: '', password: '' }, 2000);
  assert.equal(acc1.ok, true);

  // Persist to both localStorage and IndexedDB
  persistLocalCachedState(acc1.state, 5000, true, storage, idb);
  const fromIdb = await loadSnapshotFromIndexedDB(idb);
  assert.equal(fromIdb.hasLocalCache, true);
  assert.equal(fromIdb.localTs, 5000);
  assert.equal(fromIdb.dirty, true);
  assert.equal(fromIdb.state?.userAccounts[0].name, 'حساب كاش 1');

  // Simulate cleared localStorage — loadHydratedLocalCache must recover from IndexedDB and repopulate localStorage
  const freshStorage = createMemoryStorage();
  const recovered = await loadHydratedLocalCache(freshStorage, idb);
  assert.equal(recovered.hasLocalCache, true);
  assert.equal(recovered.backend, 'indexedDB');
  assert.equal(recovered.state?.userAccounts.length, 1);
  assert.equal(loadLocalCachedState(freshStorage).hasLocalCache, true);

  // If IndexedDB has a newer snapshot than localStorage, IndexedDB wins
  const acc2 = mutateSaveAccount(acc1.state, { name: 'حساب أحدث', pp: 900, ip: '', device: '', browser: '', email: '', password: '' }, 9000);
  assert.equal(acc2.ok, true);
  await saveSnapshotToIndexedDB(acc2.state, { clientTimestamp: 9500, dirty: false, source: 'firestore' }, idb);

  const reconciled = await loadHydratedLocalCache(freshStorage, idb);
  assert.equal(reconciled.backend, 'indexedDB');
  assert.equal(reconciled.localTs, 9500);
  assert.equal(reconciled.state?.userAccounts.length, 2);
  assert.equal(loadLocalCachedState(freshStorage).state?.userAccounts.length, 2);

  // Clear removes both stores
  await clearLocalCache(freshStorage, idb);
  const afterClear = await loadHydratedLocalCache(freshStorage, idb);
  assert.equal(afterClear.hasLocalCache, false);
});

test('stateMutations enforce validation, cascade deletes cleanly, handle incoming syncs & backup import/export', () => {
  const s0 = mutateResetWorkspace();
  assert.equal(s0.userAccounts.length, 0);

  // Reject invalid account
  const badAcc = mutateSaveAccount(s0, { name: '', pp: -10 });
  assert.equal(badAcc.ok, false);
  assert.ok(badAcc.errors?.name);
  assert.ok(badAcc.errors?.pp);

  // Create valid account + village with invalid FK rejected
  const s1 = mutateSaveAccount(s0, { name: 'محمد', pp: 1500, ip: '41.40.10.2', device: 'Android', browser: 'Kiwi', email: '', password: '' }, 10000);
  assert.equal(s1.ok, true);
  const badVilFk = mutateSaveVillage(s1.state, { name: 'ق1', accountId: 'non_existent', worldId: 'w_94', continent: '44' });
  assert.equal(badVilFk.ok, false);
  assert.ok(badVilFk.errors?.accountId);

  // Create valid village
  const s2 = mutateSaveVillage(
    s1.state,
    {
      name: 'الحصن 1',
      accountId: s1.updatedAccount!.id,
      worldId: 'w_94',
      continent: '44',
      coord: '450|520',
      warehouseLevel: 10,
      woodLevel: 15,
      clayLevel: 15,
      ironLevel: 14,
      woodStock: 1200,
      clayStock: 1100,
      ironStock: 900,
      spearsTotal: 100,
      unlockedScavTiers: 2
    },
    10000
  );
  assert.equal(s2.ok, true);

  // Assign plan & update continent rates & manual PP session
  const s3 = mutateAssignVillagePlan(s2.state, s2.updatedVillage!.id, {
    id: 'plan_1',
    name: 'خطة تطوير',
    assignedAt: 10000,
    steps: [{ atype: 'bldg', bName: 'الخشاب م16', baseName: 'الخشاب', targetLvl: 16 }]
  });
  assert.equal(s3.ok, true);
  assert.equal(s3.updatedVillage?.assignedPlan?.name, 'خطة تطوير');

  const wAdd = mutateSaveWorld(s3.state, { id: 'w_95', name: 'عالم 95', speed: 1.5 }, 10000);
  assert.equal(wAdd.ok, true);
  const wRate = mutateUpdateContinentRates(wAdd.state, 'w_95', { continent: '45', sellRate: 120, buyRate: 115, sellWood: 125, sellClay: 120, sellIron: 115 }, 10000);
  assert.equal(wRate.ok, true);
  assert.equal(wRate.updatedWorld?.continents['45'].sellWood, 125);

  const sessRes = mutateOverrideDailySession(wRate.state, s1.updatedAccount!.id, '2026-11-15', 1000, 1650, 400, 10000);
  assert.equal(sessRes.ok, true);
  assert.equal(sessRes.state.dailySessions['2026-11-15'][s1.updatedAccount!.id].manualAdjusted, true);

  // Export & re-import JSON backup
  const jsonStr = exportStateBackupJson(sessRes.state);
  const impRes = mutateImportBackupJson(jsonStr);
  assert.equal(impRes.ok, true);
  assert.equal(impRes.state.userAccounts.length, 1);
  assert.equal(impRes.state.villages.length, 1);

  // Incoming sync updates existing or creates new village cleanly
  const syncRes = mutateApplyIncomingSync(
    impRes.state,
    {
      playerName: 'محمد',
      pp: 1700,
      worldCode: 'ae95',
      coord: '510|410',
      villageId: '9911',
      name: 'قرية مزامنة',
      woodLevel: 19,
      clayLevel: 19,
      ironLevel: 18,
      warehouseLevel: 12,
      woodStock: 3000,
      clayStock: 2500,
      ironStock: 2000,
      spearsHome: 80,
      spearsAway: 120,
      spearsTotal: 200,
      unlockedScavTiers: 3
    },
    20000
  );
  assert.equal(syncRes.ok, true);
  assert.equal(syncRes.nextState?.villages.length, 2);

  // Delete village adds to deletedVillageIds
  const delVil = mutateDeleteVillage(syncRes.nextState!, s2.updatedVillage!.id);
  assert.equal(delVil.ok, true);
  assert.equal(delVil.state.villages.length, 1);
  assert.ok(delVil.state.deletedVillageIds.includes(s2.updatedVillage!.id));

  // Delete account cascades remaining owned village
  const delAcc = mutateDeleteAccount(delVil.state, s1.updatedAccount!.id);
  assert.equal(delAcc.ok, true);
  assert.equal(delAcc.state.userAccounts.length, 0);
  assert.equal(delAcc.state.villages.length, 0);
  assert.equal(delAcc.deletedVillages?.length, 1);
});
