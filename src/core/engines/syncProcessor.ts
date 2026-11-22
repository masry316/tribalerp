import { FIXED_CONTINENTS, SCAV_UNIT_DEFS } from '../constants/gameData';
import type {
  ContinentRates,
  DailySessionEntry,
  ErpAppState,
  ErpUserAccount,
  ErpVillage,
  ErpWorld,
  LoginHistoryItem,
  SyncProcessResult
} from '../types';
import {
  getCairoDateKey,
  pruneOldDailySessions,
  resolveBaselineBeforeDate
} from './ppFlowEngine';
import { computeVillageLiveStatus, normalizeBuildingsMap } from './resourceEngine';

export function makeDefaultContinents(
  sellRate: number = 64,
  buyRate: number = 64
): Record<string, ContinentRates> {
  const obj: Record<string, ContinentRates> = {};
  FIXED_CONTINENTS.forEach((c) => {
    obj[c] = {
      sellRate,
      buyRate,
      sellWood: sellRate,
      sellClay: sellRate,
      sellIron: sellRate,
      lastUpdated: null
    };
  });
  return obj;
}

export function createDefaultAppState(): ErpAppState {
  return {
    activeTab: 'dashboard',
    activeVillageId: '',
    selectedWorldFilter: 'all',
    selectedDeviceFilter: 'all',
    simDiscountMode: 'smart',
    upgradeBudgetPP: 350,
    gameRules: {
      rewPct: 10,
      minRewW: 150,
      minRewC: 150,
      minRewI: 100,
      freeFinishSec: 180,
      giftSpears: 30,
      giftSwords: 30,
      critHours: 1,
      warnHours: 4,
      premPct: 20,
      boostPct: 30
    },
    finance: {
      bundlePoints: 10000,
      bundleEGP: 2500,
      bundleUSD: 50,
      currency: 'EGP'
    },
    worlds: [
      {
        id: 'w_94',
        name: 'عالم 94',
        speed: 1.0,
        settingsUrl: '',
        continents: makeDefaultContinents(64, 64)
      }
    ],
    deletedCoreNames: [],
    deletedVillageIds: [],
    userAccounts: [],
    villages: [],
    dailySessions: {},
    ppLog: {},
    sessionLogs: [],
    asimConfig: {
      simType: 'virtual26',
      realVilId: '',
      windowDays: 3,
      hours: 42,
      autoPlan: true,
      optMode: 'per_phase',
      scavMode: 'max_profit',
      ppRate: 64,
      buyRate: 64,
      activeHrs: 12,
      sessionHrs: 2,
      worldSpeed: 1,
      unitSpeed: 1,
      flagPct: 0,
      premPct: 0,
      wBon: 0,
      cBon: 0,
      iBon: 0,
      wStart: 500,
      cStart: 500,
      iStart: 500,
      freeFinish: true,
      harvestSide: true,
      marketBoost: true,
      boostPP: 0,
      extraSpears: 0,
      worldId: 'w_94',
      phases: {
        p2: { enabled: true, days: 4, startRate: 120, endRate: 150 },
        p3: { enabled: false, days: 5, startRate: 150, endRate: 200 },
        p4: { enabled: false, days: 7, startRate: 200, endRate: 260 }
      }
    }
  };
}

export function getAccountTargetDailyPP(accId: string, state: ErpAppState): number {
  const vils = state.villages.filter((v) => v.accountId === accId);
  return vils.reduce((sum, v) => sum + computeVillageLiveStatus(v, state).dailyPP, 0);
}

export function ensureAccountDailySessionInState(
  state: ErpAppState,
  acc: ErpUserAccount,
  baselineOverridePP?: number,
  nowMs: number = Date.now()
): DailySessionEntry {
  const today = getCairoDateKey(nowMs);
  if (!state.dailySessions) state.dailySessions = {};
  pruneOldDailySessions(state.dailySessions, 60, today);
  if (!state.dailySessions[today]) state.dailySessions[today] = {};
  const estTargetPP = Math.max(Math.round(getAccountTargetDailyPP(acc.id, state)), 1);
  const existing = state.dailySessions[today][acc.id];
  if (!existing) {
    const prevBaseline = resolveBaselineBeforeDate(
      acc.id,
      today,
      state.dailySessions,
      state.ppLog,
      null
    );
    const startVal =
      prevBaseline !== null
        ? prevBaseline
        : baselineOverridePP !== undefined && Number.isFinite(baselineOverridePP)
          ? Math.max(0, baselineOverridePP)
          : Math.max(0, Number(acc.pp || 0));
    state.dailySessions[today][acc.id] = {
      startPP: startVal,
      targetPP: estTargetPP,
      lastSyncedPP: Math.max(0, Number(acc.pp || 0)),
      firstSyncTime: nowMs,
      lastSyncTime: nowMs
    };
  } else {
    existing.targetPP = Math.max(estTargetPP, existing.targetPP || 1);
    existing.lastSyncedPP = Math.max(0, Number(acc.pp || 0));
    existing.lastSyncTime = nowMs;
  }
  return state.dailySessions[today][acc.id];
}

export function repairStateIntegrity(
  raw: Partial<ErpAppState> | Record<string, any> | null | undefined
): ErpAppState {
  const base = createDefaultAppState();
  const rawObj = raw && typeof raw === 'object' ? { ...raw } : {};
  if ('uiConfig' in rawObj) delete rawObj.uiConfig;
  const s: ErpAppState = { ...base, ...(rawObj as Partial<ErpAppState>) };

  s.gameRules = { ...base.gameRules, ...(s.gameRules || {}) };
  s.finance = { ...base.finance, ...(s.finance || {}) };
  s.asimConfig = {
    ...base.asimConfig,
    ...(s.asimConfig || {}),
    phases: {
      p2: { ...base.asimConfig.phases.p2, ...(s.asimConfig?.phases?.p2 || {}) },
      p3: { ...base.asimConfig.phases.p3, ...(s.asimConfig?.phases?.p3 || {}) },
      p4: { ...base.asimConfig.phases.p4, ...(s.asimConfig?.phases?.p4 || {}) }
    }
  };
  s.deletedCoreNames = Array.isArray(s.deletedCoreNames) ? s.deletedCoreNames : [];
  s.deletedVillageIds = Array.isArray(s.deletedVillageIds) ? s.deletedVillageIds : [];
  s.dailySessions = s.dailySessions && typeof s.dailySessions === 'object' ? s.dailySessions : {};
  s.ppLog = s.ppLog && typeof s.ppLog === 'object' ? s.ppLog : {};
  s.sessionLogs = Array.isArray(s.sessionLogs) ? s.sessionLogs : [];

  if (!Array.isArray(s.worlds) || s.worlds.length === 0) {
    s.worlds = base.worlds;
  } else {
    s.worlds = s.worlds.map((w) => {
      const continents: Record<string, ContinentRates> = { ...(w.continents || {}) };
      FIXED_CONTINENTS.forEach((c) => {
        const cur = continents[c] || {
          sellRate: 64,
          buyRate: 64,
          sellWood: 64,
          sellClay: 64,
          sellIron: 64,
          lastUpdated: null
        };
        const sr = Math.max(64, Number(cur.sellRate || 64));
        continents[c] = {
          sellRate: sr,
          buyRate: Math.max(1, Number(cur.buyRate || 64)),
          sellWood: Math.max(64, Number(cur.sellWood || sr)),
          sellClay: Math.max(64, Number(cur.sellClay || sr)),
          sellIron: Math.max(64, Number(cur.sellIron || sr)),
          lastUpdated: cur.lastUpdated || null,
          stockWood: cur.stockWood,
          stockClay: cur.stockClay,
          stockIron: cur.stockIron,
          capWood: cur.capWood,
          capClay: cur.capClay,
          capIron: cur.capIron,
          ...(cur.isMarketClosed || w.tradeEnded ? { isMarketClosed: true } : {})
        };
      });
      return {
        ...w,
        speed: Math.max(0.1, Number(w.speed || 1)),
        tradeEnded: Boolean(w.tradeEnded),
        tradeEndedAt: w.tradeEndedAt ?? null,
        tradeSummaryPP:
          w.tradeSummaryPP !== undefined && w.tradeSummaryPP !== null && Number.isFinite(Number(w.tradeSummaryPP))
            ? Number(w.tradeSummaryPP)
            : null,
        startedAt: w.startedAt ?? null,
        continents
      };
    });
  }

  if (!Array.isArray(s.userAccounts)) {
    s.userAccounts = [];
  }

  const deletedSet = new Set(s.deletedVillageIds.map((x) => String(x || '').trim()).filter(Boolean));
  const seenVilIds = new Set<string>();
  s.villages = (Array.isArray(s.villages) ? s.villages : []).filter((v) => {
    if (!v || !v.id) return false;
    const isSynthetic1 =
      v.id === 'vil_1' && !v.villageId && v.villagePoints === 820 && v.warehouse?.woodStock === 12000;
    const isSynthetic2 =
      v.id === 'vil_2' && !v.villageId && v.villagePoints === 410 && v.warehouse?.woodStock === 6000;
    if (isSynthetic1 || isSynthetic2) return false;
    if (deletedSet.has(String(v.id)) || (v.villageId && deletedSet.has(String(v.villageId)))) return false;
    if (seenVilIds.has(v.id)) return false;
    seenVilIds.add(v.id);
    return true;
  });

  s.villages = s.villages.map((v) => {
    const mines = {
      wood: { curr: Number(v.mines?.wood?.curr || 0), target: Number(v.mines?.wood?.target || 20) },
      clay: { curr: Number(v.mines?.clay?.curr || 0), target: Number(v.mines?.clay?.target || 20) },
      iron: { curr: Number(v.mines?.iron?.curr || 0), target: Number(v.mines?.iron?.target || 20) }
    };
    const warehouse = {
      level: Math.max(1, Number(v.warehouse?.level || 1)),
      woodStock: Math.max(0, Number(v.warehouse?.woodStock || 0)),
      clayStock: Math.max(0, Number(v.warehouse?.clayStock || 0)),
      ironStock: Math.max(0, Number(v.warehouse?.ironStock || 0)),
      lastUpdated: Number(v.warehouse?.lastUpdated || v.lastSyncTime || Date.now())
    };
    return {
      ...v,
      isVirtual: Boolean(v.isVirtual),
      mines,
      warehouse,
      buildings: normalizeBuildingsMap(v.buildings, { ...v, mines, warehouse })
    };
  });

  if (!s.activeVillageId && s.villages.length > 0) {
    s.activeVillageId = s.villages[0].id;
  }

  return s;
}

export function normalizeVillageTroops(v: Partial<ErpVillage>) {
  function getCount(f1: unknown, f2: unknown, f3: unknown): number {
    return Math.max(0, Math.trunc(Number(f1 ?? f2 ?? f3 ?? 0) || 0));
  }

  const uHome = v.unitsHome || v.scavData?.unitsHome || {};
  const uAway = v.unitsAway || v.scavData?.unitsAway || {};
  const uTotal = v.unitsTotal || v.scavData?.unitsTotal || {};

  const spHome = getCount(v.spearsHome, uHome.spear, v.scavData?.spearsHome);
  const swHome = getCount(v.swordsHome, uHome.sword, v.scavData?.swordsHome);
  const axHome = getCount(v.axesHome, uHome.axe, v.scavData?.axesHome);
  const arHome = getCount(uHome.archer, 0, 0);
  const spyHome = getCount(v.spiesHome, uHome.spy, v.scavData?.spiesHome);
  const lcHome = getCount(v.lightsHome, uHome.light, v.scavData?.lightsHome);
  const maHome = getCount(uHome.marcher, 0, 0);
  const hcHome = getCount(v.heaviesHome, uHome.heavy, v.scavData?.heaviesHome);
  const ramHome = getCount(uHome.ram, 0, 0);
  const catHome = getCount(uHome.catapult, 0, 0);
  const knHome = getCount(uHome.knight, 0, 0);
  const snobHome = getCount(uHome.snob, 0, 0);

  const spAway = getCount(v.spearsAway, uAway.spear, v.scavData?.spearsAway);
  const swAway = getCount(v.swordsAway, uAway.sword, v.scavData?.swordsAway);
  const axAway = getCount(v.axesAway, uAway.axe, v.scavData?.axesAway);
  const arAway = getCount(uAway.archer, 0, 0);
  const spyAway = getCount(v.spiesAway, uAway.spy, v.scavData?.spiesAway);
  const lcAway = getCount(v.lightsAway, uAway.light, v.scavData?.lightsAway);
  const maAway = getCount(uAway.marcher, 0, 0);
  const hcAway = getCount(v.heaviesAway, uAway.heavy, v.scavData?.heaviesAway);
  const ramAway = getCount(uAway.ram, 0, 0);
  const catAway = getCount(uAway.catapult, 0, 0);
  const knAway = getCount(uAway.knight, 0, 0);
  const snobAway = getCount(uAway.snob, 0, 0);

  function resolveTotal(rawTot: unknown, home: number, away: number): number {
    return rawTot !== undefined && rawTot !== null
      ? Math.max(home + away, Math.trunc(Number(rawTot) || 0))
      : home + away;
  }

  const spearsTotal = resolveTotal(v.spearsTotal ?? uTotal.spear ?? v.scavData?.spearsTotal, spHome, spAway);
  const swordsTotal = resolveTotal(v.swordsTotal ?? uTotal.sword ?? v.scavData?.swordsTotal, swHome, swAway);
  const axesTotal = resolveTotal(v.axesTotal ?? uTotal.axe ?? v.scavData?.axesTotal, axHome, axAway);
  const archersTotal = resolveTotal(uTotal.archer, arHome, arAway);
  const spiesTotal = resolveTotal(v.spiesTotal ?? uTotal.spy ?? v.scavData?.spiesTotal, spyHome, spyAway);
  const lightsTotal = resolveTotal(v.lightsTotal ?? uTotal.light ?? v.scavData?.lightsTotal, lcHome, lcAway);
  const marchersTotal = resolveTotal(uTotal.marcher, maHome, maAway);
  const heaviesTotal = resolveTotal(v.heaviesTotal ?? uTotal.heavy ?? v.scavData?.heaviesTotal, hcHome, hcAway);
  const ramsTotal = resolveTotal(uTotal.ram, ramHome, ramAway);
  const catapultsTotal = resolveTotal(uTotal.catapult, catHome, catAway);
  const knightsTotal = resolveTotal(uTotal.knight, knHome, knAway);
  const snobsTotal = resolveTotal(uTotal.snob, snobHome, snobAway);

  const unitsHome: Record<string, number> = {
    spear: spHome,
    sword: swHome,
    axe: axHome,
    archer: arHome,
    spy: spyHome,
    light: lcHome,
    marcher: maHome,
    heavy: hcHome,
    ram: ramHome,
    catapult: catHome,
    knight: knHome,
    snob: snobHome
  };
  const unitsAway: Record<string, number> = {
    spear: spAway,
    sword: swAway,
    axe: axAway,
    archer: arAway,
    spy: spyAway,
    light: lcAway,
    marcher: maAway,
    heavy: hcAway,
    ram: ramAway,
    catapult: catAway,
    knight: knAway,
    snob: snobAway
  };
  const unitsTotal: Record<string, number> = {
    spear: spearsTotal,
    sword: swordsTotal,
    axe: axesTotal,
    archer: archersTotal,
    spy: spiesTotal,
    light: lightsTotal,
    marcher: marchersTotal,
    heavy: heaviesTotal,
    ram: ramsTotal,
    catapult: catapultsTotal,
    knight: knightsTotal,
    snob: snobsTotal
  };

  return {
    spearsHome: Math.min(100000, spHome),
    swordsHome: Math.min(100000, swHome),
    axesHome: Math.min(100000, axHome),
    spiesHome: Math.min(100000, spyHome),
    lightsHome: Math.min(100000, lcHome),
    heaviesHome: Math.min(100000, hcHome),
    spearsAway: Math.min(100000, spAway),
    swordsAway: Math.min(100000, swAway),
    axesAway: Math.min(100000, axAway),
    spiesAway: Math.min(100000, spyAway),
    lightsAway: Math.min(100000, lcAway),
    heaviesAway: Math.min(100000, hcAway),
    spearsTotal: Math.min(200000, spearsTotal),
    swordsTotal: Math.min(200000, swordsTotal),
    axesTotal: Math.min(200000, axesTotal),
    spiesTotal: Math.min(200000, spiesTotal),
    lightsTotal: Math.min(200000, lightsTotal),
    heaviesTotal: Math.min(200000, heaviesTotal),
    unitsHome,
    unitsAway,
    unitsTotal
  };
}

export function sanitizeStateForFirestore(rawState: Partial<ErpAppState> & Record<string, any>) {
  const clone: Record<string, any> = JSON.parse(JSON.stringify(rawState || {}));
  const accounts: any[] = Array.isArray(clone.userAccounts) ? clone.userAccounts : [];
  const villages: any[] = Array.isArray(clone.villages) ? clone.villages : [];

  let totalPP = 0;
  accounts.forEach((acc) => {
    totalPP += Math.max(0, Math.trunc(Number(acc.pp) || 0));
    acc.password = '';
  });

  villages.forEach((vil) => {
    const troops = normalizeVillageTroops(vil);
    vil.spearsHome = troops.spearsHome;
    vil.swordsHome = troops.swordsHome;
    vil.axesHome = troops.axesHome;
    vil.spiesHome = troops.spiesHome;
    vil.lightsHome = troops.lightsHome;
    vil.heaviesHome = troops.heaviesHome;

    vil.spearsAway = troops.spearsAway;
    vil.swordsAway = troops.swordsAway;
    vil.axesAway = troops.axesAway;
    vil.spiesAway = troops.spiesAway;
    vil.lightsAway = troops.lightsAway;
    vil.heaviesAway = troops.heaviesAway;

    vil.spearsTotal = troops.spearsTotal;
    vil.swordsTotal = troops.swordsTotal;
    vil.axesTotal = troops.axesTotal;
    vil.spiesTotal = troops.spiesTotal;
    vil.lightsTotal = troops.lightsTotal;
    vil.heaviesTotal = troops.heaviesTotal;

    vil.unitsHome = troops.unitsHome;
    vil.unitsAway = troops.unitsAway;
    vil.unitsTotal = troops.unitsTotal;
  });

  const stateJson = JSON.stringify(clone);
  return {
    sanitizedState: clone,
    stateJson,
    accountsCount: Math.min(500, accounts.length),
    villagesCount: Math.min(5000, villages.length),
    totalPP: Math.min(100000000, totalPP)
  };
}

export function mergeCloudSnapshotWithLocalSecrets<T extends { userAccounts?: Array<{ id: string; password?: string }> }>(
  incomingCloudState: T,
  localCachedState: T | null
): T {
  const merged: T = JSON.parse(JSON.stringify(incomingCloudState || {}));
  if (!localCachedState || !Array.isArray(localCachedState.userAccounts) || !Array.isArray(merged.userAccounts)) {
    return merged;
  }
  const localMap = new Map<string, string>();
  localCachedState.userAccounts.forEach((acc) => {
    if (acc.id && acc.password) {
      localMap.set(acc.id, acc.password);
    }
  });
  merged.userAccounts.forEach((acc) => {
    if (!acc.password && localMap.has(acc.id)) {
      acc.password = localMap.get(acc.id);
    }
  });
  return merged;
}

export function resolveConflictResolutionStrategy(params: {
  localTimestamp: number;
  cloudTimestamp: number;
  hasPendingLocalChanges: boolean;
  deviceTagMatchesSelf: boolean;
}): 'PUSH_LOCAL_TO_CLOUD' | 'APPLY_CLOUD_TO_LOCAL' | 'NO_OP' {
  const { localTimestamp, cloudTimestamp, hasPendingLocalChanges, deviceTagMatchesSelf } = params;
  if (deviceTagMatchesSelf && Math.abs(cloudTimestamp - localTimestamp) < 2000 && !hasPendingLocalChanges) {
    return 'NO_OP';
  }
  if (hasPendingLocalChanges && localTimestamp > cloudTimestamp) {
    return 'PUSH_LOCAL_TO_CLOUD';
  }
  if (cloudTimestamp > localTimestamp) {
    return 'APPLY_CLOUD_TO_LOCAL';
  }
  return 'NO_OP';
}

function cleanUnitsMap(raw: any): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return out;
  SCAV_UNIT_DEFS.forEach((u) => {
    if (raw[u.key] !== undefined && raw[u.key] !== null) {
      out[u.key] = Math.max(0, parseInt(String(raw[u.key]), 10) || 0);
    }
  });
  return out;
}

function mergeLoginRows(acc: ErpUserAccount, rows: any, ts: number): number {
  if (!Array.isArray(rows) || !rows.length) return 0;
  acc.loginHistory = Array.isArray(acc.loginHistory) ? acc.loginHistory : [];
  const keys = new Set(acc.loginHistory.map((r) => `${r.date}|${r.ip}`));
  const fresh: LoginHistoryItem[] = [];
  rows.forEach((r) => {
    if (!r || !r.ip || !r.date) return;
    const item: LoginHistoryItem = {
      date: String(r.date).slice(0, 40),
      device: String(r.device || '').slice(0, 40),
      ip: String(r.ip).slice(0, 45),
      sitter: String(r.sitter || '').slice(0, 60),
      ts
    };
    const key = `${item.date}|${item.ip}`;
    if (keys.has(key)) return;
    keys.add(key);
    fresh.push(item);
  });
  acc.loginHistory = fresh.concat(acc.loginHistory).slice(0, 25);
  return fresh.length;
}

export function processIncomingVillageSync(
  prevState: ErpAppState,
  rawInput: string | Record<string, any>,
  nowMs: number = Date.now()
): SyncProcessResult {
  let parsed: Record<string, any> | null = null;
  if (typeof rawInput === 'string') {
    const trimmed = rawInput.trim();
    if (!trimmed) {
      return { ok: false, error: 'لم يتم إدخال أي بيانات JSON للمزامنة.' };
    }
    if (trimmed.startsWith('javascript:') || trimmed.includes('window.game_data')) {
      return {
        ok: false,
        error: 'هذا كود أداة البوك مارك نفسها! شغّل الأداة داخل صفحة اللعبة أولاً ثم الصق النتيجة.'
      };
    }
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return { ok: false, error: 'النص المدخل ليس كود JSON صالح من اللعبة.' };
    }
  } else {
    parsed = rawInput;
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'بيانات المزامنة فارغة أو غير صالحة.' };
  }

  const nextState: ErpAppState = JSON.parse(JSON.stringify(prevState));

  // 1. Automatic Account Match or Creation
  let targetAcc: ErpUserAccount | undefined;
  let isNewAccount = false;
  const rawPName = parsed.playerName || parsed.accountName || parsed.player?.name;
  if (rawPName && String(rawPName).trim()) {
    const clean = String(rawPName).trim().toLowerCase();
    targetAcc = nextState.userAccounts.find((a) => a.name.trim().toLowerCase() === clean);
    if (!targetAcc) {
      targetAcc = {
        id: `uacc_${nowMs}_${Math.floor(Math.random() * 1000)}`,
        name: String(rawPName).trim(),
        password: '',
        email: '',
        device: 'Mobile',
        browser: 'Chrome',
        ip: '',
        pp: Math.max(0, parseInt(String(parsed.pp || 0), 10) || 0),
        lastSyncTime: nowMs
      };
      nextState.userAccounts.push(targetAcc);
      isNewAccount = true;
    }
  } else {
    targetAcc = nextState.userAccounts[0];
  }

  if (!targetAcc) {
    return { ok: false, error: 'لم يتم العثور على أي حساب لربط القرية به.' };
  }

  const prevPPBeforeSync = Math.max(0, Number(targetAcc.pp || 0));
  if (parsed.pp !== null && parsed.pp !== undefined && !Number.isNaN(Number(parsed.pp))) {
    targetAcc.pp = Math.max(0, parseInt(String(parsed.pp), 10) || 0);
    if (!nextState.ppLog) nextState.ppLog = {};
    if (!Array.isArray(nextState.ppLog[targetAcc.id])) nextState.ppLog[targetAcc.id] = [];
    const arr = nextState.ppLog[targetAcc.id];
    const last = arr[arr.length - 1];
    if (!last || last.pp !== targetAcc.pp || nowMs - last.t > 1800000) {
      arr.push({ t: nowMs, pp: targetAcc.pp });
      if (arr.length > 180) arr.shift();
    }
  }

  const syncTs = Number(parsed.timestamp || nowMs);
  if (parsed.device && String(parsed.device).trim()) targetAcc.device = String(parsed.device).trim().slice(0, 80);
  if (parsed.browser && String(parsed.browser).trim()) targetAcc.browser = String(parsed.browser).trim().slice(0, 80);
  if (parsed.ip && /^\d{1,3}(\.\d{1,3}){3}$/.test(String(parsed.ip))) targetAcc.ip = String(parsed.ip);
  const addedLogins = mergeLoginRows(targetAcc, parsed.loginHistory, syncTs);
  targetAcc.deviceLog = Array.isArray(targetAcc.deviceLog) ? targetAcc.deviceLog : [];

  let deviceChanged = false;
  if (parsed.deviceId) {
    const did = String(parsed.deviceId).slice(0, 80);
    deviceChanged = Boolean(targetAcc.deviceId && targetAcc.deviceId !== did);
    if (targetAcc.deviceId !== did) {
      targetAcc.deviceLog.unshift({
        t: syncTs,
        deviceId: did,
        device: targetAcc.device || '',
        browser: targetAcc.browser || '',
        ip: targetAcc.ip || ''
      });
      targetAcc.deviceLog = targetAcc.deviceLog.slice(0, 20);
    }
    targetAcc.deviceId = did;
  }

  const prevSyncTs = Number(targetAcc.lastSyncTime || 0);
  let recordedSessionSec = Number(parsed.sessionDurationSec || 0);
  if ((!recordedSessionSec || recordedSessionSec <= 0) && prevSyncTs > 0) {
    const gapSec = Math.round((syncTs - prevSyncTs) / 1000);
    if (gapSec >= 5 && gapSec <= 600) recordedSessionSec = gapSec;
  }
  if (recordedSessionSec >= 3 && recordedSessionSec <= 1800) {
    nextState.sessionLogs = Array.isArray(nextState.sessionLogs) ? nextState.sessionLogs : [];
    nextState.sessionLogs.unshift({
      accountId: targetAcc.id,
      accountName: targetAcc.name,
      villageId: parsed.villageId ? String(parsed.villageId) : undefined,
      durationSec: Math.round(recordedSessionSec),
      timestamp: syncTs,
      dateKey: getCairoDateKey(syncTs)
    });
    nextState.sessionLogs = nextState.sessionLogs.slice(0, 300);
  }
  targetAcc.lastSyncTime = syncTs;

  // 2. World detection
  let targetWorld: ErpWorld | undefined;
  const rawWCode = parsed.worldCode || parsed.world;
  if (rawWCode) {
    const numCode = String(rawWCode).replace(/[^0-9]/g, '');
    targetWorld = nextState.worlds.find(
      (w) =>
        (numCode && (w.id.includes(numCode) || w.name.includes(numCode))) ||
        w.id.toLowerCase().includes(String(rawWCode).toLowerCase())
    );
    if (!targetWorld && numCode) {
      targetWorld = {
        id: `w_${numCode}`,
        name: `عالم ${numCode}`,
        speed: 1.0,
        settingsUrl: '',
        continents: makeDefaultContinents(64, 64)
      };
      nextState.worlds.push(targetWorld);
    }
  }
  if (!targetWorld) targetWorld = nextState.worlds[0];

  // 3. Continent detection
  let targetContinent = '44';
  const coordStr = String(parsed.coord || parsed.name || '');
  const cm = coordStr.match(/(\d{3})\|(\d{3})/);
  if (cm) {
    targetContinent = cm[2].charAt(0) + cm[1].charAt(0);
  } else if (parsed.continent) {
    targetContinent = String(parsed.continent).replace(/[^0-9]/g, '') || '44';
  }
  if (!(FIXED_CONTINENTS as readonly string[]).includes(targetContinent)) {
    targetContinent = '44';
  }

  // 4. Market rates sync
  if (!targetWorld.continents[targetContinent]) {
    targetWorld.continents[targetContinent] = {
      sellRate: 64,
      buyRate: 64,
      sellWood: 64,
      sellClay: 64,
      sellIron: 64,
      lastUpdated: null
    };
  }
  const contObj = targetWorld.continents[targetContinent];
  const pRates = parsed.rates || {};
  const rWood = parseInt(String(pRates.wood || parsed.rates_wood || parsed.marketSellRate || 0), 10);
  const rClay = parseInt(String(pRates.clay || pRates.stone || parsed.rates_clay || 0), 10);
  const rIron = parseInt(String(pRates.iron || parsed.rates_iron || 0), 10);
  if (rWood || rClay || rIron) {
    if (rWood > 0) contObj.sellWood = rWood;
    if (rClay > 0) contObj.sellClay = rClay;
    if (rIron > 0) contObj.sellIron = rIron;
    const valid = [contObj.sellWood, contObj.sellClay, contObj.sellIron].filter((r) => r > 0);
    if (valid.length > 0) {
      contObj.sellRate = Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
    }
    contObj.lastUpdated = nowMs;
  }

  // Market capacity & stock ingestion (سعة ومخزون بورصة التميز)
  const pStock = parsed.marketStock || parsed.stock || {};
  const pCap = parsed.marketCap || parsed.marketCapacity || parsed.capacity || {};
  const sWood = parseInt(String(pStock.wood ?? parsed.stockWood ?? parsed.stock_wood ?? -1), 10);
  const sClay = parseInt(String(pStock.clay ?? pStock.stone ?? parsed.stockClay ?? parsed.stock_clay ?? parsed.stock_stone ?? -1), 10);
  const sIron = parseInt(String(pStock.iron ?? parsed.stockIron ?? parsed.stock_iron ?? -1), 10);

  const cWood = parseInt(String(pCap.wood ?? parsed.capWood ?? parsed.cap_wood ?? -1), 10);
  const cClay = parseInt(String(pCap.clay ?? pCap.stone ?? parsed.capClay ?? parsed.cap_clay ?? parsed.cap_stone ?? -1), 10);
  const cIron = parseInt(String(pCap.iron ?? parsed.capIron ?? parsed.cap_iron ?? -1), 10);

  if (sWood >= 0) contObj.stockWood = sWood;
  if (sClay >= 0) contObj.stockClay = sClay;
  if (sIron >= 0) contObj.stockIron = sIron;
  if (cWood >= 0) contObj.capWood = cWood;
  if (cClay >= 0) contObj.capClay = cClay;
  if (cIron >= 0) contObj.capIron = cIron;
  if (parsed.isMarketClosed !== undefined) {
    contObj.isMarketClosed = Boolean(parsed.isMarketClosed);
  }

  const flagVal = parsed.flagPct !== undefined && parsed.flagPct !== null ? Number(parsed.flagPct) : 0;
  const bWood = parsed.bonusPct?.wood !== undefined && parsed.bonusPct?.wood !== null ? Number(parsed.bonusPct.wood) : 0;
  const bClay = parsed.bonusPct?.clay !== undefined && parsed.bonusPct?.clay !== null ? Number(parsed.bonusPct.clay) : 0;
  const bIron = parsed.bonusPct?.iron !== undefined && parsed.bonusPct?.iron !== null ? Number(parsed.bonusPct.iron) : 0;
  const hasPrem = parsed.premium !== undefined ? Boolean(parsed.premium) : false;

  // 5. Village matching or creation
  let vil: ErpVillage | undefined;
  if (parsed.villageId) {
    vil = nextState.villages.find((v) => v.villageId && String(v.villageId) === String(parsed.villageId));
  }
  if (!vil && cm) {
    vil = nextState.villages.find((v) => v.worldId === targetWorld!.id && v.coord && v.coord.includes(cm[0]));
  }
  if (!vil && parsed.name) {
    vil = nextState.villages.find(
      (v) =>
        v.worldId === targetWorld!.id &&
        v.name.trim().toLowerCase() === String(parsed.name).trim().toLowerCase()
    );
  }
  if (!vil && targetAcc) {
    const accVils = nextState.villages.filter(
      (v) => v.accountId === targetAcc!.id && v.worldId === targetWorld!.id
    );
    const virtualCandidates = accVils.filter((v) => v.isVirtual || !v.villageId || v.villageId === '');
    if (virtualCandidates.length > 0) {
      vil =
        virtualCandidates.find((v) => String(v.continent) === String(targetContinent)) ||
        virtualCandidates[0];
    } else if (accVils.length === 1 && (!accVils[0].villageId || accVils[0].villageId === '')) {
      vil = accVils[0];
    }
  }

  const cleanName = String(parsed.name || (cm ? `قرية ${cm[0]}` : 'قرية مستوردة')).trim();
  let isNewVillage = false;

  if (!vil) {
    const rawVid = String(parsed.villageId || parsed.villageGameId || '');
    const rawCoord = cm ? cm[0] : '';
    if (
      Array.isArray(nextState.deletedVillageIds) &&
      ((rawVid && nextState.deletedVillageIds.includes(rawVid)) ||
        (rawCoord && nextState.deletedVillageIds.includes(rawCoord)))
    ) {
      return { ok: false, error: 'تم تجاهل هذه المزامنة لأن القرية محذوفة مسبقاً من النظام.' };
    }
    isNewVillage = true;
    vil = {
      id: `vil_${nowMs}_${Math.floor(Math.random() * 1000)}`,
      villageId: parsed.villageId ? String(parsed.villageId) : '',
      name: cleanName,
      accountId: targetAcc.id,
      worldId: targetWorld.id,
      continent: targetContinent,
      coord: cm ? cm[0] : String(parsed.coord || '500|500'),
      villagePoints: Number(parsed.villagePoints || 26),
      lastSyncTime: syncTs,
      flag: flagVal,
      woodItem: flagVal > 0 && bWood >= flagVal ? bWood - flagVal : bWood,
      clayItem: flagVal > 0 && bClay >= flagVal ? bClay - flagVal : bClay,
      ironItem: flagVal > 0 && bIron >= flagVal ? bIron - flagVal : bIron,
      premium: hasPrem,
      boost30: false,
      marketLevel: Number(parsed.marketLevel || 0),
      farmLevel: Number(parsed.farmLevel || 1),
      mines: {
        wood: { curr: Number(parsed.woodLevel || 0), target: 20 },
        clay: { curr: Number(parsed.clayLevel || 0), target: 20 },
        iron: { curr: Number(parsed.ironLevel || 0), target: 20 }
      },
      warehouse: {
        level: Number(parsed.warehouseLevel || 1),
        woodStock: Number(parsed.woodStock || 0),
        clayStock: Number(parsed.clayStock || 0),
        ironStock: Number(parsed.ironStock || 0),
        lastUpdated: syncTs
      },
      buildings: null,
      buildingDiscounts: {}
    };
    nextState.villages.push(vil);
  } else {
    vil.accountId = targetAcc.id;
    vil.worldId = targetWorld.id;
    vil.isVirtual = false;
    vil.lastSyncTime = syncTs;
    if (parsed.villageId) vil.villageId = String(parsed.villageId);
    if (cm) vil.coord = cm[0];
    vil.continent = targetContinent;
    vil.name = cleanName;
    if (parsed.villagePoints) vil.villagePoints = Number(parsed.villagePoints);
    if (flagVal > 0) vil.flag = flagVal;
    if (bWood > 0) vil.woodItem = flagVal > 0 && bWood >= flagVal ? bWood - flagVal : bWood;
    if (bClay > 0) vil.clayItem = flagVal > 0 && bClay >= flagVal ? bClay - flagVal : bClay;
    if (bIron > 0) vil.ironItem = flagVal > 0 && bIron >= flagVal ? bIron - flagVal : bIron;
    if (parsed.premium !== undefined) vil.premium = hasPrem;
    vil.mines = vil.mines || {
      wood: { curr: 0, target: 20 },
      clay: { curr: 0, target: 20 },
      iron: { curr: 0, target: 20 }
    };
    vil.mines.wood.curr = Number(parsed.woodLevel ?? vil.mines.wood.curr);
    vil.mines.clay.curr = Number(parsed.clayLevel ?? vil.mines.clay.curr);
    vil.mines.iron.curr = Number(parsed.ironLevel ?? vil.mines.iron.curr);
    vil.warehouse = vil.warehouse || {
      level: 1,
      woodStock: 0,
      clayStock: 0,
      ironStock: 0,
      lastUpdated: syncTs
    };
    vil.warehouse.level = Number(parsed.warehouseLevel ?? vil.warehouse.level);
    vil.warehouse.woodStock = Number(parsed.woodStock ?? vil.warehouse.woodStock);
    vil.warehouse.clayStock = Number(parsed.clayStock ?? vil.warehouse.clayStock);
    vil.warehouse.ironStock = Number(parsed.ironStock ?? vil.warehouse.ironStock);
    vil.warehouse.lastUpdated = syncTs;
    if (parsed.farmLevel !== undefined) vil.farmLevel = Number(parsed.farmLevel);
    if (parsed.marketLevel !== undefined) vil.marketLevel = Number(parsed.marketLevel);
    (vil as any).marketStock = { wood: sWood, clay: sClay, iron: sIron };
    (vil as any).marketCap = { wood: cWood, clay: cClay, iron: cIron };
    if (parsed.isMarketClosed !== undefined) {
      (vil as any).isMarketClosed = Boolean(parsed.isMarketClosed);
    }
  }

  vil.buildings = normalizeBuildingsMap(parsed.buildings, vil);

  const existingScav = vil.scavData || {};
  const isExistingScavActive = Boolean(existingScav.scavReturnAt && existingScav.scavReturnAt > nowMs);
  let finalScavReturnAt = Number(parsed.scavReturnAt || 0);
  let finalScavNextReturnAt = Number(parsed.scavNextReturnAt || 0);
  let finalScavActiveCount = Number(parsed.scavActiveCount || 0);
  let finalScavLoot = parsed.scavLoot || { wood: 0, clay: 0, iron: 0, total: 0 };

  if (!finalScavReturnAt && isExistingScavActive) {
    finalScavReturnAt = existingScav.scavReturnAt || 0;
    finalScavNextReturnAt = existingScav.scavNextReturnAt || 0;
    finalScavActiveCount = existingScav.scavActiveCount || 0;
    finalScavLoot = existingScav.loot || finalScavLoot;
  }

  vil.scavReturnAt = finalScavReturnAt;
  vil.scavNextReturnAt = finalScavNextReturnAt;
  vil.scavActiveCount = finalScavActiveCount;

  const hasFreshUnitsInPayload = Boolean(
    parsed.unitsHome ||
      parsed.unitsAway ||
      parsed.unitsTotal ||
      parsed.spearsHome !== undefined ||
      parsed.spearsTotal !== undefined
  );

  const mergedHome = hasFreshUnitsInPayload
    ? cleanUnitsMap(parsed.unitsHome || {})
    : { ...(existingScav.unitsHome || {}), ...(vil.unitsHome || {}) };
  const mergedAway = hasFreshUnitsInPayload
    ? cleanUnitsMap(parsed.unitsAway || {})
    : { ...(existingScav.unitsAway || {}), ...(vil.unitsAway || {}) };
  const mergedTotal = hasFreshUnitsInPayload
    ? cleanUnitsMap(parsed.unitsTotal || {})
    : { ...(existingScav.unitsTotal || {}), ...(vil.unitsTotal || {}) };

  if (parsed.spearsHome !== undefined && mergedHome.spear === undefined) mergedHome.spear = Number(parsed.spearsHome) || 0;
  if (parsed.swordsHome !== undefined && mergedHome.sword === undefined) mergedHome.sword = Number(parsed.swordsHome) || 0;
  if (parsed.axesHome !== undefined && mergedHome.axe === undefined) mergedHome.axe = Number(parsed.axesHome) || 0;
  if (parsed.spiesHome !== undefined && mergedHome.spy === undefined) mergedHome.spy = Number(parsed.spiesHome) || 0;
  if (parsed.lightsHome !== undefined && mergedHome.light === undefined) mergedHome.light = Number(parsed.lightsHome) || 0;
  if (parsed.heaviesHome !== undefined && mergedHome.heavy === undefined) mergedHome.heavy = Number(parsed.heaviesHome) || 0;

  if (parsed.spearsAway !== undefined && mergedAway.spear === undefined) mergedAway.spear = Number(parsed.spearsAway) || 0;
  if (parsed.swordsAway !== undefined && mergedAway.sword === undefined) mergedAway.sword = Number(parsed.swordsAway) || 0;
  if (parsed.axesAway !== undefined && mergedAway.axe === undefined) mergedAway.axe = Number(parsed.axesAway) || 0;
  if (parsed.spiesAway !== undefined && mergedAway.spy === undefined) mergedAway.spy = Number(parsed.spiesAway) || 0;
  if (parsed.lightsAway !== undefined && mergedAway.light === undefined) mergedAway.light = Number(parsed.lightsAway) || 0;
  if (parsed.heaviesAway !== undefined && mergedAway.heavy === undefined) mergedAway.heavy = Number(parsed.heaviesAway) || 0;

  if (parsed.spearsTotal !== undefined && mergedTotal.spear === undefined) mergedTotal.spear = Number(parsed.spearsTotal) || 0;
  if (parsed.swordsTotal !== undefined && mergedTotal.sword === undefined) mergedTotal.sword = Number(parsed.swordsTotal) || 0;
  if (parsed.axesTotal !== undefined && mergedTotal.axe === undefined) mergedTotal.axe = Number(parsed.axesTotal) || 0;
  if (parsed.spiesTotal !== undefined && mergedTotal.spy === undefined) mergedTotal.spy = Number(parsed.spiesTotal) || 0;
  if (parsed.lightsTotal !== undefined && mergedTotal.light === undefined) mergedTotal.light = Number(parsed.lightsTotal) || 0;
  if (parsed.heaviesTotal !== undefined && mergedTotal.heavy === undefined) mergedTotal.heavy = Number(parsed.heaviesTotal) || 0;

  const garageLvl = Number(vil.buildings['الورشة'] || 0);
  const stableLvl = Number(vil.buildings['الإسطبل'] || 0);
  if (garageLvl === 0) {
    mergedHome.ram = 0;
    mergedAway.ram = 0;
    mergedTotal.ram = 0;
    mergedHome.catapult = 0;
    mergedAway.catapult = 0;
    mergedTotal.catapult = 0;
  }
  if (stableLvl === 0) {
    ['spy', 'light', 'marcher', 'heavy'].forEach((cu) => {
      mergedHome[cu] = 0;
      mergedAway[cu] = 0;
      mergedTotal[cu] = 0;
    });
  }

  SCAV_UNIT_DEFS.forEach((u) => {
    const k = u.key;
    let hVal = Math.max(0, Number(mergedHome[k] || 0));
    const aVal = Math.max(0, Number(mergedAway[k] || 0));
    let tVal = Math.max(0, Number(mergedTotal[k] || 0));
    if (
      hVal > 0 &&
      aVal > 0 &&
      hVal === aVal &&
      tVal === hVal + aVal &&
      (finalScavActiveCount > 0 || k === 'spear' || k === 'sword' || k === 'axe')
    ) {
      hVal = 0;
      tVal = aVal;
    } else {
      tVal = Math.max(tVal, hVal + aVal);
    }
    mergedHome[k] = hVal;
    mergedAway[k] = aVal;
    mergedTotal[k] = tVal;
  });

  vil.spearsHome = mergedHome.spear || 0;
  vil.swordsHome = mergedHome.sword || 0;
  vil.axesHome = mergedHome.axe || 0;
  vil.spiesHome = mergedHome.spy || 0;
  vil.lightsHome = mergedHome.light || 0;
  vil.heaviesHome = mergedHome.heavy || 0;

  vil.spearsAway = mergedAway.spear || 0;
  vil.swordsAway = mergedAway.sword || 0;
  vil.axesAway = mergedAway.axe || 0;
  vil.spiesAway = mergedAway.spy || 0;
  vil.lightsAway = mergedAway.light || 0;
  vil.heaviesAway = mergedAway.heavy || 0;

  vil.spearsTotal = mergedTotal.spear || 0;
  vil.swordsTotal = mergedTotal.sword || 0;
  vil.axesTotal = mergedTotal.axe || 0;
  vil.spiesTotal = mergedTotal.spy || 0;
  vil.lightsTotal = mergedTotal.light || 0;
  vil.heaviesTotal = mergedTotal.heavy || 0;

  vil.unitsHome = mergedHome;
  vil.unitsAway = mergedAway;
  vil.unitsTotal = mergedTotal;
  vil.unitsTs = syncTs;

  const resolvedUnlockedTiers = Number(
    parsed.unlockedScavTiers ||
      existingScav.unlockedScavTiers ||
      existingScav.unlockedTiers ||
      vil.unlockedScavTiers ||
      0
  );
  vil.unlockedScavTiers = resolvedUnlockedTiers;
  vil.scavData = {
    scavReturnAt: finalScavReturnAt,
    scavNextReturnAt: finalScavNextReturnAt,
    scavActiveCount: finalScavActiveCount,
    loot: finalScavLoot,
    spearsHome: vil.spearsHome,
    swordsHome: vil.swordsHome,
    axesHome: vil.axesHome,
    spiesHome: vil.spiesHome,
    lightsHome: vil.lightsHome,
    heaviesHome: vil.heaviesHome,
    spearsAway: vil.spearsAway,
    swordsAway: vil.swordsAway,
    axesAway: vil.axesAway,
    spiesAway: vil.spiesAway,
    lightsAway: vil.lightsAway,
    heaviesAway: vil.heaviesAway,
    spearsTotal: vil.spearsTotal,
    swordsTotal: vil.swordsTotal,
    axesTotal: vil.axesTotal,
    spiesTotal: vil.spiesTotal,
    lightsTotal: vil.lightsTotal,
    heaviesTotal: vil.heaviesTotal,
    unitsHome: mergedHome,
    unitsAway: mergedAway,
    unitsTotal: mergedTotal,
    unlockedScavTiers: resolvedUnlockedTiers,
    unlockedTiers: resolvedUnlockedTiers,
    buildEndAt: Number(parsed.buildEndAt || existingScav.buildEndAt || 0),
    timestamp: syncTs
  };

  nextState.activeVillageId = vil.id;
  ensureAccountDailySessionInState(nextState, targetAcc, prevPPBeforeSync, nowMs);

  const summaryText = `تمت مزامنة ${vil.name} (K${targetContinent} · ${targetWorld.name}) لحساب ${targetAcc.name} (${targetAcc.pp.toLocaleString('en-US')} PP)`;

  return {
    ok: true,
    nextState,
    account: targetAcc,
    village: vil,
    world: targetWorld,
    continent: targetContinent,
    isNewAccount,
    isNewVillage,
    deviceChanged,
    addedLogins,
    summaryText
  };
}
