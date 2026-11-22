import { serverTimestamp, type FieldValue } from 'firebase/firestore';
import type { AssignedPlan, ErpAppState, ErpUserAccount, ErpVillage, ErpWorld } from '../core';
import { normalizeVillageTroops } from '../core';

export const BLUEPRINT_LIMITS = {
  idMaxLength: 128,
  idPattern: /^[a-zA-Z0-9_\-]+$/,
  stateJsonMaxLength: 950000,
  safeStateJsonCeiling: 940000,
  deviceTagMaxLength: 120,
  accountNameMaxLength: 120,
  deviceMaxLength: 120,
  browserMaxLength: 120,
  ipMaxLength: 64,
  deviceIdMaxLength: 128,
  villageIdMaxLength: 64,
  worldIdMaxLength: 64,
  continentMaxLength: 16,
  villageNameMaxLength: 160,
  coordMaxLength: 32,
  buildingsJsonMaxLength: 10000,
  unitsJsonMaxLength: 10000,
  planNameMaxLength: 200,
  simTypeMaxLength: 32,
  stepsJsonMaxLength: 250000,
  worldNameMaxLength: 120,
  continentsJsonMaxLength: 10000,
  syncPayloadJsonMaxLength: 250000,
  maxAccountsCount: 500,
  maxVillagesCount: 5000,
  maxTotalPP: 100000000
} as const;

export function sanitizeDocId(id: string): string {
  const clean = String(id || '').replace(/[^a-zA-Z0-9_\-]/g, '_');
  return clean.slice(0, BLUEPRINT_LIMITS.idMaxLength) || 'doc_default';
}

export interface TimestampProvider {
  nowServerTimestamp: () => FieldValue | unknown;
}

const defaultTimestampProvider: TimestampProvider = {
  nowServerTimestamp: () => serverTimestamp()
};

export function prepareErpStateSnapshotDoc(
  prepared: {
    stateJson: string;
    accountsCount: number;
    villagesCount: number;
    totalPP: number;
  },
  deviceTag: string,
  clientTimestamp: number,
  tsProvider: TimestampProvider = defaultTimestampProvider
) {
  return {
    workspaceId: 'master',
    stateJson: prepared.stateJson.slice(0, BLUEPRINT_LIMITS.stateJsonMaxLength),
    accountsCount: Math.max(0, Math.min(BLUEPRINT_LIMITS.maxAccountsCount, Math.trunc(prepared.accountsCount))),
    villagesCount: Math.max(0, Math.min(BLUEPRINT_LIMITS.maxVillagesCount, Math.trunc(prepared.villagesCount))),
    totalPP: Math.max(0, Math.min(BLUEPRINT_LIMITS.maxTotalPP, Math.trunc(prepared.totalPP))),
    deviceTag: String(deviceTag || 'dev_browser').slice(0, BLUEPRINT_LIMITS.deviceTagMaxLength) || 'dev_browser',
    clientTimestamp: Math.max(0, Math.trunc(clientTimestamp)),
    updatedAt: tsProvider.nowServerTimestamp()
  };
}

export function prepareUserAccountDoc(
  acc: ErpUserAccount,
  tsProvider: TimestampProvider = defaultTimestampProvider
) {
  const id = sanitizeDocId(acc.id);
  return {
    id,
    name: String(acc.name || 'حساب').trim().slice(0, BLUEPRINT_LIMITS.accountNameMaxLength) || 'حساب',
    pp: Math.max(0, Math.min(BLUEPRINT_LIMITS.maxTotalPP, Math.trunc(Number(acc.pp) || 0))),
    device: String(acc.device || '').slice(0, BLUEPRINT_LIMITS.deviceMaxLength),
    browser: String(acc.browser || '').slice(0, BLUEPRINT_LIMITS.browserMaxLength),
    ip: String(acc.ip || '').slice(0, BLUEPRINT_LIMITS.ipMaxLength),
    deviceId: String(acc.deviceId || '').slice(0, BLUEPRINT_LIMITS.deviceIdMaxLength),
    lastSyncTime: Math.max(0, Math.trunc(Number(acc.lastSyncTime) || 0)),
    updatedAt: tsProvider.nowServerTimestamp()
  };
}

export function prepareWorldMarketDoc(
  world: ErpWorld,
  tsProvider: TimestampProvider = defaultTimestampProvider
) {
  const id = sanitizeDocId(world.id);
  return {
    id,
    name: String(world.name || 'عالم').trim().slice(0, BLUEPRINT_LIMITS.worldNameMaxLength) || 'عالم',
    speed: Math.max(0, Math.min(100, Number(world.speed) || 1)),
    continentsJson: JSON.stringify(world.continents || {}).slice(0, BLUEPRINT_LIMITS.continentsJsonMaxLength),
    updatedAt: tsProvider.nowServerTimestamp()
  };
}

export function prepareVillageDoc(
  vil: ErpVillage,
  tsProvider: TimestampProvider = defaultTimestampProvider
) {
  const id = sanitizeDocId(vil.id);
  const troops = normalizeVillageTroops(vil);
  return {
    id,
    villageId: String(vil.villageId || '').slice(0, BLUEPRINT_LIMITS.villageIdMaxLength),
    accountId: sanitizeDocId(vil.accountId || 'acc_unknown'),
    worldId: sanitizeDocId(vil.worldId || 'w_94').slice(0, BLUEPRINT_LIMITS.worldIdMaxLength),
    continent: String(vil.continent || '44').slice(0, BLUEPRINT_LIMITS.continentMaxLength) || '44',
    name: String(vil.name || 'قرية').trim().slice(0, BLUEPRINT_LIMITS.villageNameMaxLength) || 'قرية',
    coord: String(vil.coord || '').slice(0, BLUEPRINT_LIMITS.coordMaxLength),
    villagePoints: Math.max(0, Math.min(50000, Math.trunc(Number(vil.villagePoints) || 0))),
    flag: Math.max(0, Math.min(100, Math.trunc(Number(vil.flag) || 0))),
    woodItem: Math.max(0, Math.min(500, Math.trunc(Number(vil.woodItem) || 0))),
    clayItem: Math.max(0, Math.min(500, Math.trunc(Number(vil.clayItem) || 0))),
    ironItem: Math.max(0, Math.min(500, Math.trunc(Number(vil.ironItem) || 0))),
    premium: Boolean(vil.premium),
    boost30: Boolean(vil.boost30),
    marketLevel: Math.max(0, Math.min(30, Math.trunc(Number(vil.marketLevel) || 0))),
    farmLevel: Math.max(0, Math.min(30, Math.trunc(Number(vil.farmLevel) || 1))),
    warehouseLevel: Math.max(0, Math.min(30, Math.trunc(Number(vil.warehouse?.level) || 1))),
    woodStock: Math.max(0, Math.min(1000000, Math.trunc(Number(vil.warehouse?.woodStock) || 0))),
    clayStock: Math.max(0, Math.min(1000000, Math.trunc(Number(vil.warehouse?.clayStock) || 0))),
    ironStock: Math.max(0, Math.min(1000000, Math.trunc(Number(vil.warehouse?.ironStock) || 0))),
    spearsHome: troops.spearsHome,
    swordsHome: troops.swordsHome,
    spearsAway: troops.spearsAway,
    swordsAway: troops.swordsAway,
    spearsTotal: troops.spearsTotal,
    swordsTotal: troops.swordsTotal,
    axesTotal: troops.axesTotal,
    lightsTotal: troops.lightsTotal,
    heaviesTotal: troops.heaviesTotal,
    unlockedScavTiers: Math.max(0, Math.min(10, Math.trunc(Number(vil.unlockedScavTiers) || 0))),
    scavReturnAt: Math.max(0, Math.trunc(Number(vil.scavReturnAt || vil.scavData?.scavReturnAt) || 0)),
    scavNextReturnAt: Math.max(0, Math.trunc(Number(vil.scavNextReturnAt || vil.scavData?.scavNextReturnAt) || 0)),
    buildingsJson: JSON.stringify(vil.buildings || {}).slice(0, BLUEPRINT_LIMITS.buildingsJsonMaxLength),
    unitsJson: JSON.stringify({
      home: troops.unitsHome,
      away: troops.unitsAway,
      total: troops.unitsTotal
    }).slice(0, BLUEPRINT_LIMITS.unitsJsonMaxLength),
    lastSyncTime: Math.max(0, Math.trunc(Number(vil.lastSyncTime) || 0)),
    updatedAt: tsProvider.nowServerTimestamp()
  };
}

export function prepareVillagePlanDoc(
  planDocId: string,
  villageIdRef: string,
  vil: ErpVillage,
  plan: AssignedPlan,
  simType: string,
  tsProvider: TimestampProvider = defaultTimestampProvider
) {
  const steps = Array.isArray(plan.steps) ? plan.steps : [];
  const bldgs = vil.buildings || {};
  let completed = 0;
  steps.forEach((s) => {
    if (s.atype === 'scav_return') {
      completed++;
      return;
    }
    if (s.atype === 'scav_unlock' && (vil.unlockedScavTiers || 0) >= (s.targetLvl || 1)) {
      completed++;
    } else if (s.atype === 'train_spear' && (vil.spearsTotal || 0) >= (s.targetLvl || 1)) {
      completed++;
    } else {
      const base = s.baseName || s.bName.replace(/\s*م\d+/g, '').trim();
      if (Number(bldgs[base] ?? 0) >= (s.targetLvl || 1)) completed++;
    }
  });

  const totalSteps = Math.min(5000, steps.length);
  const completedSteps = Math.min(totalSteps, completed);
  const progressPct = totalSteps > 0 ? Math.min(100, Math.round((completedSteps / totalSteps) * 100)) : 0;

  return {
    id: sanitizeDocId(planDocId),
    villageId: String(villageIdRef || vil.id).slice(0, BLUEPRINT_LIMITS.idMaxLength),
    name: String(plan.name || 'خطة ذكية').trim().slice(0, BLUEPRINT_LIMITS.planNameMaxLength) || 'خطة ذكية',
    simType: String(simType || 'virtual26').slice(0, BLUEPRINT_LIMITS.simTypeMaxLength),
    totalSteps,
    completedSteps,
    progressPct,
    stepsJson: JSON.stringify(steps).slice(0, BLUEPRINT_LIMITS.stepsJsonMaxLength),
    assignedAt: Math.max(0, Math.trunc(Number(plan.assignedAt || Date.now()))),
    updatedAt: tsProvider.nowServerTimestamp()
  };
}

export function extractErdBatchRecords(
  state: ErpAppState,
  tsProvider: TimestampProvider = defaultTimestampProvider
): Array<{ col: 'userAccounts' | 'worlds' | 'villages'; id: string; data: Record<string, unknown> }> {
  const records: Array<{ col: 'userAccounts' | 'worlds' | 'villages'; id: string; data: Record<string, unknown> }> = [];

  (state.userAccounts || []).slice(0, 500).forEach((acc) => {
    const docData = prepareUserAccountDoc(acc, tsProvider);
    records.push({ col: 'userAccounts', id: docData.id, data: docData });
  });

  (state.worlds || []).slice(0, 50).forEach((w) => {
    const docData = prepareWorldMarketDoc(w, tsProvider);
    records.push({ col: 'worlds', id: docData.id, data: docData });
  });

  (state.villages || []).slice(0, 1000).forEach((vil) => {
    const docData = prepareVillageDoc(vil, tsProvider);
    records.push({ col: 'villages', id: docData.id, data: docData });
  });

  return records;
}
