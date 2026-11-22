import {
  BUILDING_POINTS_TABLE,
  BUILDINGS_DATA,
  FARM_CAPACITIES,
  MARKET_MERCHANTS,
  MINE_BASE_PROD,
  SCAV_UNIT_DEFS,
  UNIT_CARRY_CAP,
  UNIT_POP_COST,
  WAREHOUSE_CAPACITIES
} from '../constants/gameData';
import type {
  ArmyMatrixItem,
  ErpAppState,
  ErpGameRules,
  ErpUserAccount,
  ErpVillage,
  ErpWorld,
  FirestoreDashboardSummary,
  UnitCountMap,
  UnitKey,
  VillageLiveResourcesAndArmy,
  VillageLiveStatus
} from '../types';
import { calcScavDispatch } from './scavengingEngine';

export function getWarehouseCap(lvl: number): number {
  const l = Math.max(1, Math.min(30, parseInt(String(lvl || 1), 10) || 1));
  return WAREHOUSE_CAPACITIES[l] || 1000;
}

export function getFarmCap(lvl: number): number {
  const l = Math.max(1, Math.min(30, parseInt(String(lvl || 1), 10) || 1));
  return FARM_CAPACITIES[l] || 240;
}

export function getMerchantsCount(mktLvl: number): number {
  const l = Math.max(0, Math.min(25, parseInt(String(mktLvl || 0), 10) || 0));
  return MARKET_MERCHANTS[l] !== undefined ? MARKET_MERCHANTS[l] : l;
}

export function getBuildingTotalPop(bName: string, lvl: number): number {
  if (!lvl || lvl <= 0 || !BUILDINGS_DATA[bName]) return 0;
  const row = BUILDINGS_DATA[bName].levels[Math.min(BUILDINGS_DATA[bName].levels.length, lvl) - 1];
  if (!row || !row.pop) return 0;
  const parts = String(row.pop).split('/');
  return parseInt((parts[1] || parts[0] || '0').replace(/[^0-9]/g, ''), 10) || 0;
}

export function getVillageUsedPop(
  lvls: Record<string, number>,
  spearsOrUnits: number | UnitCountMap = 0,
  swordsCount: number = 0
): number {
  let pop = 0;
  if (typeof spearsOrUnits === 'object' && spearsOrUnits !== null) {
    (Object.keys(UNIT_POP_COST) as UnitKey[]).forEach((uk) => {
      const cnt = Math.max(0, Number(spearsOrUnits[uk] || 0));
      pop += cnt * UNIT_POP_COST[uk];
    });
  } else {
    pop += Math.max(0, Number(spearsOrUnits || 0)) + Math.max(0, Number(swordsCount || 0));
  }
  Object.keys(lvls || {}).forEach((k) => {
    pop += getBuildingTotalPop(k, lvls[k]);
  });
  return pop;
}

export function getSpearUnitTrainSec(barracksLvl: number, worldSpeed: number): number {
  const bl = Math.max(1, parseInt(String(barracksLvl || 1), 10) || 1);
  return Math.max(1, Math.round((1020 * (2 / 3) * Math.pow(1.06, -bl)) / Math.max(0.1, worldSpeed)));
}

export function getMineHourlyProd(
  lvl: number,
  isPrem: boolean,
  flagPct: number,
  itemPct: number,
  has30Boost: boolean,
  worldSpeed: number,
  rules?: Partial<ErpGameRules>
): number {
  const premFactor = isPrem ? (rules?.premPct ?? 20) / 100 : 0;
  const boostFactor = has30Boost ? (rules?.boostPct ?? 30) / 100 : 0;
  const wMult = Math.max(0.1, Number(worldSpeed || 1.0));
  if (lvl <= 0) {
    return Math.round(
      5 * wMult * (1 + premFactor + boostFactor + (flagPct || 0) / 100 + (itemPct || 0) / 100)
    );
  }
  const bData = BUILDINGS_DATA['الخشاب'];
  const row = bData.levels[Math.min(30, lvl) - 1];
  const base1x = row ? row.prod : 0;
  return base1x * wMult * (1 + premFactor + boostFactor + (flagPct || 0) / 100 + (itemPct || 0) / 100);
}

export function estimateMineHourly(
  level: number,
  hasPremium: boolean = false,
  flagPct: number = 0,
  itemPct: number = 0,
  boost30: boolean = false,
  worldSpeed: number = 1
): number {
  const lvl = Math.max(0, Math.min(30, parseInt(String(level || 0), 10) || 0));
  const base = MINE_BASE_PROD[lvl] ?? 5;
  const speed = Math.max(0.1, Number(worldSpeed) || 1);
  const mult =
    1 +
    (hasPremium ? 0.2 : 0) +
    Math.max(0, Number(flagPct) || 0) / 100 +
    Math.max(0, Number(itemPct) || 0) / 100 +
    (boost30 ? 0.3 : 0);
  return Math.round(base * speed * mult);
}

export function makeStarter26Buildings(): Record<string, number> {
  return {
    'المبنى الرئيسي': 1,
    'الثكنات': 0,
    'الإسطبل': 0,
    'الورشة': 0,
    'الأكاديمية': 0,
    'الحداد': 0,
    'نقطة التجمع': 1,
    'النصب التذكاري': 0,
    'السوق': 0,
    'الخشاب': 0,
    'حفرة الطمي': 0,
    'منجم الحديد': 0,
    'المزارع': 1,
    'المخازن': 1,
    'المخابئ': 1,
    'الحائط': 0
  };
}

export function normalizeBuildingsMap(
  existing?: Record<string, number> | null,
  vil?: Partial<ErpVillage>
): Record<string, number> {
  const res = makeStarter26Buildings();
  if (existing && typeof existing === 'object') {
    if (existing['المركز الرئيسي'] !== undefined && existing['المبنى الرئيسي'] === undefined) {
      res['المبنى الرئيسي'] = Math.max(
        0,
        Math.min(30, parseInt(String(existing['المركز الرئيسي']), 10) || 0)
      );
    }
    if (existing['المخبأ'] !== undefined && existing['المخابئ'] === undefined) {
      res['المخابئ'] = Math.max(0, Math.min(10, parseInt(String(existing['المخبأ']), 10) || 0));
    }
    Object.keys(BUILDINGS_DATA).forEach((k) => {
      if (existing[k] !== undefined && existing[k] !== null) {
        const maxL = BUILDINGS_DATA[k].max_lvl || 30;
        res[k] = Math.max(0, Math.min(maxL, parseInt(String(existing[k]), 10) || 0));
      }
    });
  }
  if (vil) {
    res['الخشاب'] = Math.max(0, Math.min(30, parseInt(String(vil.mines?.wood?.curr ?? res['الخشاب']), 10) || 0));
    res['حفرة الطمي'] = Math.max(
      0,
      Math.min(30, parseInt(String(vil.mines?.clay?.curr ?? res['حفرة الطمي']), 10) || 0)
    );
    res['منجم الحديد'] = Math.max(
      0,
      Math.min(30, parseInt(String(vil.mines?.iron?.curr ?? res['منجم الحديد']), 10) || 0)
    );
    res['المخازن'] = Math.max(1, Math.min(30, parseInt(String(vil.warehouse?.level ?? res['المخازن']), 10) || 1));
    res['المزارع'] = Math.max(1, Math.min(30, parseInt(String(vil.farmLevel ?? res['المزارع']), 10) || 1));
    res['السوق'] = Math.max(0, Math.min(25, parseInt(String(vil.marketLevel ?? res['السوق']), 10) || 0));
  }
  return res;
}

export function calcVillagePointsFromBuildings(
  buildings: Record<string, number> | null | undefined
): number {
  if (!buildings) return 26;
  let pts = 0;
  Object.keys(BUILDING_POINTS_TABLE).forEach((bName) => {
    const lvl = Number(buildings[bName] || 0);
    if (lvl > 0) {
      const arr = BUILDING_POINTS_TABLE[bName];
      const p = arr[Math.min(lvl, arr.length) - 1] || 0;
      pts += p;
    }
  });
  return Math.max(26, pts);
}

export function formatTimeAgo(ts?: number | null): string {
  if (!ts || ts <= 0) return 'لم يزامَن بعد';
  const diff = Math.max(0, Date.now() - ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'الآن';
  if (min < 60) return `منذ ${min} د`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `منذ ${hrs} س`;
  const days = Math.floor(hrs / 24);
  return `منذ ${days} ي`;
}

export function formatHoursShortAr(hours: number): string {
  if (!Number.isFinite(hours) || hours >= 900) return '—';
  if (hours <= 0) return '0د';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}د`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}س ${m}د` : `${h}س`;
}

export function formatSecArabic(sec: number): string {
  const s = Math.max(0, Math.round(Number(sec || 0)));
  if (s <= 0) return '0ث';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  if (h > 0) return m > 0 ? `${h}س ${m}د` : `${h}س`;
  if (m > 0) return rem > 0 ? `${m}د ${rem}ث` : `${m}د`;
  return `${rem}ث`;
}

export function formatExactDateTime(ts?: number | null): string {
  if (!ts || ts <= 0) return '—';
  try {
    return new Intl.DateTimeFormat('ar-EG', {
      timeZone: 'Africa/Cairo',
      day: 'numeric',
      month: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleString();
  }
}

export function getCairoHoursElapsed(nowMs: number = Date.now()): number {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Cairo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(new Date(nowMs));
    const h = Number(parts.find((p) => p.type === 'hour')?.value || 0);
    const m = Number(parts.find((p) => p.type === 'minute')?.value || 0);
    return Math.max(0.25, h + m / 60);
  } catch {
    const d = new Date(nowMs);
    return Math.max(0.25, d.getHours() + d.getMinutes() / 60);
  }
}

export function getAccountCleanDevice(acc?: Partial<ErpUserAccount> | null): string {
  const raw = String(acc?.device || '').trim();
  return raw || 'غير محدد';
}

export function getVillageContinentRates(vil: Partial<ErpVillage> & Record<string, any>, worlds: ErpWorld[]) {
  const wObj = worlds.find((w) => w.id === vil.worldId) || worlds[0];
  const worldSpeed = Math.max(0.1, Number(wObj?.speed || 1.0));
  const worldName = wObj?.name || 'عالم 94';
  const cont = String(vil.continent || '44');
  const cObj = wObj?.continents?.[cont];
  const sellRate = Math.max(64, Number(cObj?.sellRate || 64));
  const sellWood = Math.max(64, Number(cObj?.sellWood || sellRate));
  const sellClay = Math.max(64, Number(cObj?.sellClay || sellRate));
  const sellIron = Math.max(64, Number(cObj?.sellIron || sellRate));
  const buyRate = Math.max(1, Number(cObj?.buyRate || 64));

  const stockWood = cObj?.stockWood ?? vil.marketStock?.wood ?? vil.stockWood;
  const stockClay = cObj?.stockClay ?? vil.marketStock?.clay ?? vil.stockClay;
  const stockIron = cObj?.stockIron ?? vil.marketStock?.iron ?? vil.stockIron;

  const capWood = cObj?.capWood ?? vil.marketCap?.wood ?? vil.capWood;
  const capClay = cObj?.capClay ?? vil.marketCap?.clay ?? vil.capClay;
  const capIron = cObj?.capIron ?? vil.marketCap?.iron ?? vil.capIron;

  const tradeEnded = Boolean(wObj?.tradeEnded);
  const isMarketClosed = Boolean(
    tradeEnded ||
    cObj?.isMarketClosed ||
    vil.isMarketClosed ||
    (capWood !== undefined && capClay !== undefined && capIron !== undefined && capWood === 0 && capClay === 0 && capIron === 0)
  );

  return {
    continent: cont,
    sellRate,
    sellWood,
    sellClay,
    sellIron,
    buyRate,
    worldSpeed,
    worldName,
    lastUpdated: cObj?.lastUpdated || null,
    stockWood,
    stockClay,
    stockIron,
    capWood,
    capClay,
    capIron,
    isMarketClosed,
    tradeEnded
  };
}

export function computeVillageLiveResourcesAndArmy(
  vil: Partial<ErpVillage> & Record<string, any> = {},
  options: {
    nowMs?: number;
    worldSpeed?: number;
    accountLastSync?: number;
    wProd?: number;
    cProd?: number;
    iProd?: number;
  } = {}
): VillageLiveResourcesAndArmy {
  const nowMs = Number(options.nowMs || Date.now());
  const worldSpeed = Math.max(0.1, Number(options.worldSpeed || 1));
  const accountLastSync = Number(options.accountLastSync || 0);

  const whLvl = Math.max(1, Math.min(30, parseInt(String(vil.warehouse?.level ?? vil.warehouseLevel ?? 1), 10) || 1));
  const cap = getWarehouseCap(whLvl);

  const wLvl = vil.mines?.wood?.curr ?? vil.buildings?.['الخشاب'] ?? 0;
  const cLvl = vil.mines?.clay?.curr ?? vil.buildings?.['حفرة الطمي'] ?? 0;
  const iLvl = vil.mines?.iron?.curr ?? vil.buildings?.['منجم الحديد'] ?? 0;

  const wProd = Number(
    options.wProd ??
      estimateMineHourly(wLvl, Boolean(vil.premium), vil.flag, vil.woodItem, Boolean(vil.boost30), worldSpeed)
  );
  const cProd = Number(
    options.cProd ??
      estimateMineHourly(cLvl, Boolean(vil.premium), vil.flag, vil.clayItem, Boolean(vil.boost30), worldSpeed)
  );
  const iProd = Number(
    options.iProd ??
      estimateMineHourly(iLvl, Boolean(vil.premium), vil.flag, vil.ironItem, Boolean(vil.boost30), worldSpeed)
  );

  const vSync = Number(vil.lastSyncTime || 0);
  const whUpd = Number(vil.warehouse?.lastUpdated || 0);
  const uTs = Number(vil.unitsTs || 0);
  const pTs = Number(vil.assignedPlan?.assignedAt || 0);
  const validCandidates = [vSync, uTs, accountLastSync, pTs].filter((t) => t > 1000000000000);

  let syncRefTs = nowMs;
  if (vSync > 1000000000000) {
    syncRefTs = whUpd > 1000000000000 ? Math.min(vSync, whUpd) : vSync;
  } else if (validCandidates.length > 0) {
    const earliest = Math.min(...validCandidates);
    syncRefTs = whUpd > 1000000000000 ? Math.min(whUpd, earliest) : earliest;
  } else if (whUpd > 1000000000000) {
    syncRefTs = whUpd;
  }

  const elapsedHours = Math.max(0, (nowMs - syncRefTs) / 3600000);
  const baseWood = Math.max(0, Math.round(Number(vil.warehouse?.woodStock ?? vil.woodStock ?? 0)));
  const baseClay = Math.max(0, Math.round(Number(vil.warehouse?.clayStock ?? vil.clayStock ?? 0)));
  const baseIron = Math.max(0, Math.round(Number(vil.warehouse?.ironStock ?? vil.ironStock ?? 0)));

  const prodWood = Math.round(wProd * elapsedHours);
  const prodClay = Math.round(cProd * elapsedHours);
  const prodIron = Math.round(iProd * elapsedHours);

  const scavRet = Number(vil.scavData?.scavReturnAt || vil.scavReturnAt || 0);
  const sLoot = vil.scavData?.loot || { wood: 0, clay: 0, iron: 0 };
  const raidReturnedUnsynced = scavRet > 0 && nowMs >= scavRet && syncRefTs < scavRet;
  const lootWood = raidReturnedUnsynced ? Math.max(0, Math.round(Number(sLoot.wood || 0))) : 0;
  const lootClay = raidReturnedUnsynced ? Math.max(0, Math.round(Number(sLoot.clay || 0))) : 0;
  const lootIron = raidReturnedUnsynced ? Math.max(0, Math.round(Number(sLoot.iron || 0))) : 0;

  const currentWood = Math.min(cap, baseWood + prodWood + lootWood);
  const currentClay = Math.min(cap, baseClay + prodClay + lootClay);
  const currentIron = Math.min(cap, baseIron + prodIron + lootIron);

  const addedWood = Math.max(0, currentWood - baseWood);
  const addedClay = Math.max(0, currentClay - baseClay);
  const addedIron = Math.max(0, currentIron - baseIron);
  const totalAddedSinceSync = addedWood + addedClay + addedIron;

  const uHomeSrc: Record<string, number> = { ...(vil.scavData?.unitsHome || {}), ...(vil.unitsHome || {}) };
  const uAwaySrc: Record<string, number> = { ...(vil.scavData?.unitsAway || {}), ...(vil.unitsAway || {}) };
  const uTotSrc: Record<string, number> = { ...(vil.scavData?.unitsTotal || {}), ...(vil.unitsTotal || {}) };
  const isReturnedNow = scavRet > 0 && nowMs >= scavRet;

  const armyMatrix: ArmyMatrixItem[] = [];
  let totalTroops = 0;
  let homeTroops = 0;
  let awayTroops = 0;
  let haulTotal = 0;
  let haulHome = 0;

  SCAV_UNIT_DEFS.forEach((u) => {
    let rawH = Number(uHomeSrc[u.key] ?? 0);
    let rawA = Number(uAwaySrc[u.key] ?? 0);
    let rawT = Number(uTotSrc[u.key] ?? 0);
    if (u.key === 'spear') {
      if (!rawH) rawH = Number(vil.scavData?.spearsHome ?? vil.spearsHome ?? 0);
      if (!rawA) rawA = Number(vil.scavData?.spearsAway ?? vil.spearsAway ?? 0);
      if (!rawT) rawT = Number(vil.spearsTotal ?? vil.scavData?.spearsTotal ?? rawH + rawA);
    } else if (u.key === 'sword') {
      if (!rawH) rawH = Number(vil.scavData?.swordsHome ?? vil.swordsHome ?? 0);
      if (!rawA) rawA = Number(vil.scavData?.swordsAway ?? vil.swordsAway ?? 0);
      if (!rawT) rawT = Number(vil.swordsTotal ?? vil.scavData?.swordsTotal ?? rawH + rawA);
    } else if (u.key === 'axe') {
      if (!rawH) rawH = Number(vil.scavData?.axesHome ?? vil.axesHome ?? 0);
      if (!rawA) rawA = Number(vil.scavData?.axesAway ?? vil.axesAway ?? 0);
      if (!rawT) rawT = Number(vil.axesTotal ?? vil.scavData?.axesTotal ?? rawH + rawA);
    } else if (u.key === 'spy') {
      if (!rawH) rawH = Number(vil.scavData?.spiesHome ?? vil.spiesHome ?? 0);
      if (!rawA) rawA = Number(vil.scavData?.spiesAway ?? vil.spiesAway ?? 0);
      if (!rawT) rawT = Number(vil.spiesTotal ?? vil.scavData?.spiesTotal ?? rawH + rawA);
    } else if (u.key === 'light') {
      if (!rawH) rawH = Number(vil.scavData?.lightsHome ?? vil.lightsHome ?? 0);
      if (!rawA) rawA = Number(vil.scavData?.lightsAway ?? vil.lightsAway ?? 0);
      if (!rawT) rawT = Number(vil.lightsTotal ?? vil.scavData?.lightsTotal ?? rawH + rawA);
    } else if (u.key === 'heavy') {
      if (!rawH) rawH = Number(vil.scavData?.heaviesHome ?? vil.heaviesHome ?? 0);
      if (!rawA) rawA = Number(vil.scavData?.heaviesAway ?? vil.heaviesAway ?? 0);
      if (!rawT) rawT = Number(vil.heaviesTotal ?? vil.scavData?.heaviesTotal ?? rawH + rawA);
    }

    rawT = Math.max(rawT, rawH + rawA);
    const effHome = isReturnedNow ? Math.max(rawH, rawT) : rawH;
    const effAway = isReturnedNow ? 0 : Math.max(rawA, rawT - effHome);
    const effTot = Math.max(rawT, effHome + effAway);

    totalTroops += effTot;
    homeTroops += effHome;
    awayTroops += effAway;
    haulTotal += effTot * u.haul;
    haulHome += effHome * u.haul;

    if (effTot > 0) {
      armyMatrix.push({
        key: u.key,
        ar: u.ar,
        total: effTot,
        home: effHome,
        away: effAway,
        haul: effTot * u.haul
      });
    }
  });

  return {
    cap,
    syncRefTs,
    elapsedHours,
    baseWood,
    baseClay,
    baseIron,
    prodWood,
    prodClay,
    prodIron,
    lootWood,
    lootClay,
    lootIron,
    addedWood,
    addedClay,
    addedIron,
    totalAddedSinceSync,
    currentWood,
    currentClay,
    currentIron,
    wProd,
    cProd,
    iProd,
    armyMatrix,
    totalTroops,
    homeTroops,
    awayTroops,
    haulTotal,
    haulHome
  };
}

export function computeMerchantSellablePP(
  woodStock: number,
  clayStock: number,
  ironStock: number,
  sellWood: number,
  sellClay: number,
  sellIron: number,
  merchants: number,
  headrooms?: { wood?: number; clay?: number; iron?: number }
): { sellableNowRes: number; sellableNowPP: number } {
  const cap = Math.max(0, Math.floor(Number(merchants) || 0)) * 1000;
  if (cap <= 0) return { sellableNowRes: 0, sellableNowPP: 0 };

  const hWood = headrooms?.wood !== undefined ? Math.max(0, headrooms.wood) : Infinity;
  const hClay = headrooms?.clay !== undefined ? Math.max(0, headrooms.clay) : Infinity;
  const hIron = headrooms?.iron !== undefined ? Math.max(0, headrooms.iron) : Infinity;

  const buckets = [
    {
      stock: Math.max(0, Number(woodStock) || 0),
      rate: Math.max(64, Number(sellWood) || 64),
      headroom: hWood
    },
    {
      stock: Math.max(0, Number(clayStock) || 0),
      rate: Math.max(64, Number(sellClay) || 64),
      headroom: hClay
    },
    {
      stock: Math.max(0, Number(ironStock) || 0),
      rate: Math.max(64, Number(sellIron) || 64),
      headroom: hIron
    }
  ]
    .filter((b) => b.headroom > 0)
    .sort((a, b) => a.rate - b.rate);

  let rem = cap;
  let sellableNowRes = 0;
  let sellableNowPP = 0;
  for (const b of buckets) {
    if (rem <= 0) break;
    const take = Math.min(rem, b.stock, b.headroom);
    if (take > 0) {
      sellableNowRes += take;
      sellableNowPP += take / b.rate;
      rem -= take;
    }
  }
  return { sellableNowRes, sellableNowPP };
}

export function computeVillageLiveStatus(
  vil: ErpVillage,
  state: ErpAppState,
  nowMs: number = Date.now()
): VillageLiveStatus {
  const acc = state.userAccounts.find((a) => a.id === vil.accountId);
  const info = getVillageContinentRates(vil, state.worlds);
  const wLvl = vil.mines?.wood?.curr ?? vil.buildings?.['الخشاب'] ?? 0;
  const cLvl = vil.mines?.clay?.curr ?? vil.buildings?.['حفرة الطمي'] ?? 0;
  const iLvl = vil.mines?.iron?.curr ?? vil.buildings?.['منجم الحديد'] ?? 0;

  const wProd = getMineHourlyProd(
    wLvl,
    vil.premium,
    vil.flag,
    vil.woodItem,
    vil.boost30,
    info.worldSpeed,
    state.gameRules
  );
  const cProd = getMineHourlyProd(
    cLvl,
    vil.premium,
    vil.flag,
    vil.clayItem,
    vil.boost30,
    info.worldSpeed,
    state.gameRules
  );
  const iProd = getMineHourlyProd(
    iLvl,
    vil.premium,
    vil.flag,
    vil.ironItem,
    vil.boost30,
    info.worldSpeed,
    state.gameRules
  );

  const liveCore = computeVillageLiveResourcesAndArmy(vil, {
    nowMs,
    worldSpeed: info.worldSpeed,
    accountLastSync: acc?.lastSyncTime || 0,
    wProd,
    cProd,
    iProd
  });

  const cap = liveCore.cap || 1000;
  const currentWood = liveCore.currentWood;
  const currentClay = liveCore.currentClay;
  const currentIron = liveCore.currentIron;

  const wPct = Math.min(100, Math.round((currentWood / cap) * 100));
  const cPct = Math.min(100, Math.round((currentClay / cap) * 100));
  const iPct = Math.min(100, Math.round((currentIron / cap) * 100));
  const maxWhPct = Math.max(wPct, cPct, iPct);

  const wHrs = wProd > 0 ? Math.max(0, (cap - currentWood) / wProd) : 999;
  const cHrs = cProd > 0 ? Math.max(0, (cap - currentClay) / cProd) : 999;
  const iHrs = iProd > 0 ? Math.max(0, (cap - currentIron) / iProd) : 999;
  const minHoursLeft = Math.min(wHrs, cHrs, iHrs);
  const firstFullRes = wHrs <= cHrs && wHrs <= iHrs ? 'الخشب' : cHrs <= iHrs ? 'الطمي' : 'الحديد';

  let status: 'safe' | 'warning' | 'critical' = 'safe';
  const critH = Number(state.gameRules?.critHours ?? 1);
  const warnH = Number(state.gameRules?.warnHours ?? 4);
  if (!info.tradeEnded && !vil.isVirtual) {
    if (minHoursLeft <= critH || maxWhPct >= 95) status = 'critical';
    else if (minHoursLeft <= warnH || maxWhPct >= 80) status = 'warning';
  }

  const totalHourly = wProd + cProd + iProd;
  const dailyRes = totalHourly * 24;

  const mLevel = Math.max(0, Number(vil.marketLevel ?? vil.buildings?.['السوق'] ?? 0));
  const merchants = getMerchantsCount(mLevel);
  const isMarketBuildingMissing = mLevel < 1;
  const isMarketClosedOverall = Boolean(info.isMarketClosed || isMarketBuildingMissing);

  const marketHeadroomWood =
    isMarketClosedOverall
      ? 0
      : info.capWood !== undefined && info.capWood > 0
        ? Math.max(0, info.capWood - Math.max(0, info.stockWood || 0))
        : (info.capWood === 0 ? 0 : Infinity);
  const marketHeadroomClay =
    isMarketClosedOverall
      ? 0
      : info.capClay !== undefined && info.capClay > 0
        ? Math.max(0, info.capClay - Math.max(0, info.stockClay || 0))
        : (info.capClay === 0 ? 0 : Infinity);
  const marketHeadroomIron =
    isMarketClosedOverall
      ? 0
      : info.capIron !== undefined && info.capIron > 0
        ? Math.max(0, info.capIron - Math.max(0, info.stockIron || 0))
        : (info.capIron === 0 ? 0 : Infinity);

  const isMarketFullWood = isMarketClosedOverall || (info.capWood !== undefined && marketHeadroomWood <= 0);
  const isMarketFullClay = isMarketClosedOverall || (info.capClay !== undefined && marketHeadroomClay <= 0);
  const isMarketFullIron = isMarketClosedOverall || (info.capIron !== undefined && marketHeadroomIron <= 0);
  const isMarketCompletelyBlocked = isMarketClosedOverall || (isMarketFullWood && isMarketFullClay && isMarketFullIron);

  const expectedWoodDaily = isMarketFullWood ? 0 : wProd * 24;
  const expectedClayDaily = isMarketFullClay ? 0 : cProd * 24;
  const expectedIronDaily = isMarketFullIron ? 0 : iProd * 24;

  const dailyWoodPP = expectedWoodDaily / info.sellWood;
  const dailyClayPP = expectedClayDaily / info.sellClay;
  const dailyIronPP = expectedIronDaily / info.sellIron;
  const mineDailyPP = isMarketCompletelyBlocked ? 0 : dailyWoodPP + dailyClayPP + dailyIronPP;

  const sLoot = vil.scavData?.loot || { wood: 0, clay: 0, iron: 0 };
  const scavLootWood = isMarketFullWood ? 0 : Number(sLoot.wood || 0);
  const scavLootClay = isMarketFullClay ? 0 : Number(sLoot.clay || 0);
  const scavLootIron = isMarketFullIron ? 0 : Number(sLoot.iron || 0);
  const scavLootPP = isMarketCompletelyBlocked
    ? 0
    : scavLootWood / info.sellWood + scavLootClay / info.sellClay + scavLootIron / info.sellIron;

  const unlockedScav = Number(
    vil.unlockedScavTiers ||
      vil.scavData?.unlockedScavTiers ||
      (Number(vil.scavData?.scavReturnAt || vil.scavReturnAt || 0) > nowMs ||
      Number(vil.scavData?.scavActiveCount || vil.scavActiveCount || 0) > 0
        ? 1
        : 0)
  );
  const unitCounts: Record<string, number> = {};
  liveCore.armyMatrix.forEach((m) => {
    unitCounts[m.key] = m.total;
  });
  const EXPECTED_SCAV_DAILY_HOURS = 12;
  const scavProj =
    unlockedScav > 0 && liveCore.haulTotal > 0
      ? calcScavDispatch(
          unitCounts.spear || 0,
          unitCounts.sword || 0,
          unlockedScav,
          state.asimConfig?.sessionHrs ?? 2,
          EXPECTED_SCAV_DAILY_HOURS,
          info.worldSpeed,
          state.asimConfig?.scavMode ?? 'max_profit',
          state.asimConfig?.unitSpeed ?? 1.0,
          unitCounts.axe || 0,
          unitCounts.spy || 0,
          unitCounts.light || 0,
          unitCounts.heavy || 0,
          unitCounts.archer || 0,
          unitCounts.marcher || 0,
          unitCounts.knight || 0
        )
      : null;

  const dailyScavLootPerRes = scavProj && scavProj.dailyLoot > 0 ? scavProj.dailyLoot / 3.0 : 0;
  const expectedScavWood = isMarketFullWood ? 0 : dailyScavLootPerRes;
  const expectedScavClay = isMarketFullClay ? 0 : dailyScavLootPerRes;
  const expectedScavIron = isMarketFullIron ? 0 : dailyScavLootPerRes;

  const scavDailyPP = isMarketCompletelyBlocked
    ? 0
    : expectedScavWood / info.sellWood + expectedScavClay / info.sellClay + expectedScavIron / info.sellIron;

  const dailyPP = isMarketCompletelyBlocked
    ? 0
    : mineDailyPP + (scavDailyPP > 0 ? scavDailyPP : scavLootPP);

  const unsoldWood = isMarketFullWood ? 0 : Math.min(currentWood, marketHeadroomWood);
  const unsoldClay = isMarketFullClay ? 0 : Math.min(currentClay, marketHeadroomClay);
  const unsoldIron = isMarketFullIron ? 0 : Math.min(currentIron, marketHeadroomIron);
  const unsoldPP = isMarketCompletelyBlocked
    ? 0
    : unsoldWood / info.sellWood + unsoldClay / info.sellClay + unsoldIron / info.sellIron;
  const unsoldRes = currentWood + currentClay + currentIron;

  const marketStatusText = info.tradeEnded
    ? 'انتهت التجارة (الصرف ممتلئ ومغلق)'
    : isMarketBuildingMissing
      ? 'السوق غير مبني (م0)'
      : isMarketCompletelyBlocked
        ? 'السوق ممتلئ 100% (البيع معلق)'
        : (isMarketFullWood || isMarketFullClay || isMarketFullIron)
          ? `سعة جزئية (ممتلئ: ${isMarketFullWood ? 'خشب ' : ''}${isMarketFullClay ? 'طمي ' : ''}${isMarketFullIron ? 'حديد' : ''})`
          : `سوق متاح (م${mLevel})`;

  const bundlePts = Math.max(1, Number(state.finance?.bundlePoints || 10000));
  const egpPerPP = Math.max(0, Number(state.finance?.bundleEGP ?? 2500)) / bundlePts;
  const usdPerPP = Math.max(0, Number(state.finance?.bundleUSD ?? 50)) / bundlePts;

  const scavRet = Number(vil.scavData?.scavReturnAt || vil.scavReturnAt || 0);
  const scavCnt = Number(vil.scavData?.scavActiveCount || vil.scavActiveCount || 0);
  const bldgs = vil.buildings || {};
  const hasBarracks = (bldgs['الثكنات'] || 0) >= 1 || (bldgs['الإسطبل'] || 0) >= 1;
  const canScavenge = liveCore.homeTroops >= 10 || liveCore.haulHome >= 150;

  let scavState: VillageLiveStatus['scavState'] = 'no_barracks';
  let scavRemHours = 999;
  let scavStatusText = 'بدون ثكنات';

  if (scavRet > nowMs) {
    scavState = 'running';
    scavRemHours = (scavRet - nowMs) / 3600000;
    scavStatusText = `إغارة جارية (${scavCnt || 1}) · تعود بعد ${formatHoursShortAr(scavRemHours)}`;
  } else if (scavRet > 0 && nowMs >= scavRet && canScavenge) {
    scavState = 'returned';
    scavRemHours = 0;
    scavStatusText = `الجيش عاد للقرية (${liveCore.haulHome.toLocaleString('en-US')} حمولة)`;
    status = 'critical';
  } else if (canScavenge) {
    scavState = 'idle_troops';
    scavRemHours = 0;
    scavStatusText = `الجيش بالقرية غير مرسل (${liveCore.haulHome.toLocaleString('en-US')} حمولة)`;
    status = 'critical';
  } else if (hasBarracks) {
    scavState = 'no_troops';
    scavRemHours = 999;
    scavStatusText = 'الثكنات جاهزة · درّب جيشاً للإغارة';
  }

  const nextActionHours = Math.min(minHoursLeft, scavRemHours);

  const armyMatrix = liveCore.armyMatrix;
  const homeParts = armyMatrix.filter((m) => m.home > 0).map((m) => `${m.home} ${m.ar}`);
  const totalParts = armyMatrix.filter((m) => m.total > 0).map((m) => `${m.total} ${m.ar}`);

  const { sellableNowRes, sellableNowPP } = computeMerchantSellablePP(
    currentWood,
    currentClay,
    currentIron,
    info.sellWood,
    info.sellClay,
    info.sellIron,
    merchants,
    { wood: marketHeadroomWood, clay: marketHeadroomClay, iron: marketHeadroomIron }
  );
  const scavActiveDailyPP = scavState === 'running' ? scavDailyPP : 0;
  const syncAgeHours = Math.max(0, (nowMs - liveCore.syncRefTs) / 3600000);
  const isStaleSync = !vil.isVirtual && syncAgeHours >= 24;
  const isRateCalibrated = Boolean(info.lastUpdated && info.lastUpdated > 0);

  return {
    ...info,
    cap,
    wProd,
    cProd,
    iProd,
    syncRefTs: liveCore.syncRefTs,
    elapsedHours: liveCore.elapsedHours,
    baseWood: liveCore.baseWood,
    baseClay: liveCore.baseClay,
    baseIron: liveCore.baseIron,
    prodWood: liveCore.prodWood,
    prodClay: liveCore.prodClay,
    prodIron: liveCore.prodIron,
    lootWood: liveCore.lootWood,
    lootClay: liveCore.lootClay,
    lootIron: liveCore.lootIron,
    addedWood: liveCore.addedWood,
    addedClay: liveCore.addedClay,
    addedIron: liveCore.addedIron,
    totalAddedSinceSync: liveCore.totalAddedSinceSync,
    totalHourly,
    dailyRes,
    dailyPP,
    mineDailyPP,
    scavLootPP,
    dailyEGP: dailyPP * egpPerPP,
    dailyUSD: dailyPP * usdPerPP,
    currentWood,
    currentClay,
    currentIron,
    wPct,
    cPct,
    iPct,
    maxWhPct,
    minHoursLeft,
    firstFullRes,
    scavState,
    scavRemHours,
    scavStatusText,
    status,
    nextActionHours,
    armyMatrix,
    totalTroops: liveCore.totalTroops,
    homeTroops: liveCore.homeTroops,
    awayTroops: liveCore.awayTroops,
    haulTotal: liveCore.haulTotal,
    haulHome: liveCore.haulHome,
    merchants,
    canScavenge,
    homeText: homeParts.length > 0 ? homeParts.join(' + ') : '0 جندي',
    totalText: totalParts.length > 0 ? totalParts.join(' + ') : '0 جندي',
    unsoldPP,
    unsoldRes,
    sellableNowPP,
    sellableNowRes,
    scavDailyPP,
    scavActiveDailyPP,
    syncAgeHours,
    isStaleSync,
    isRateCalibrated,
    stockWood: info.stockWood,
    stockClay: info.stockClay,
    stockIron: info.stockIron,
    capWood: info.capWood,
    capClay: info.capClay,
    capIron: info.capIron,
    marketHeadroomWood: Number.isFinite(marketHeadroomWood) ? marketHeadroomWood : 999999,
    marketHeadroomClay: Number.isFinite(marketHeadroomClay) ? marketHeadroomClay : 999999,
    marketHeadroomIron: Number.isFinite(marketHeadroomIron) ? marketHeadroomIron : 999999,
    isMarketFullWood,
    isMarketFullClay,
    isMarketFullIron,
    isMarketCompletelyBlocked,
    isMarketClosed: isMarketClosedOverall,
    tradeEnded: Boolean(info.tradeEnded),
    marketStatusText
  };
}

function isSyntheticStarterVillage(v: any): boolean {
  if (!v || typeof v !== 'object') return true;
  const isFakeVil1 =
    v.id === 'vil_1' &&
    !v.villageId &&
    Number(v.villagePoints) === 820 &&
    Number(v.warehouse?.woodStock ?? v.woodStock) === 12000;
  const isFakeVil2 =
    v.id === 'vil_2' &&
    !v.villageId &&
    Number(v.villagePoints) === 410 &&
    Number(v.warehouse?.woodStock ?? v.woodStock) === 6000;
  return isFakeVil1 || isFakeVil2;
}

function computeVillageHaulAndTroops(v: Record<string, any>) {
  const uTotal: Record<string, number> =
    v.unitsTotal && typeof v.unitsTotal === 'object' ? v.unitsTotal : {};
  const uHome: Record<string, number> =
    v.unitsHome && typeof v.unitsHome === 'object' ? v.unitsHome : {};

  const spearsTotal = Math.max(0, Number(v.spearsTotal ?? uTotal.spear ?? 0));
  const swordsTotal = Math.max(0, Number(v.swordsTotal ?? uTotal.sword ?? 0));
  const axesTotal = Math.max(0, Number(v.axesTotal ?? uTotal.axe ?? 0));
  const lightTotal = Math.max(0, Number(v.lightsTotal ?? uTotal.light ?? 0));
  const heavyTotal = Math.max(0, Number(v.heaviesTotal ?? uTotal.heavy ?? 0));

  const spearsHome = Math.max(0, Number(v.spearsHome ?? uHome.spear ?? spearsTotal));
  const swordsHome = Math.max(0, Number(v.swordsHome ?? uHome.sword ?? swordsTotal));
  const axesHome = Math.max(0, Number(v.axesHome ?? uHome.axe ?? 0));
  const lightHome = Math.max(0, Number(v.lightsHome ?? uHome.light ?? 0));
  const heavyHome = Math.max(0, Number(v.heaviesHome ?? uHome.heavy ?? 0));

  let haulTotal = 0;
  let haulHome = 0;
  let totalTroops = 0;

  if (Object.keys(uTotal).length > 0) {
    for (const [unit, count] of Object.entries(uTotal)) {
      const c = Math.max(0, Number(count) || 0);
      totalTroops += c;
      const cap = UNIT_CARRY_CAP[unit as UnitKey];
      if (cap) haulTotal += c * cap;
    }
  } else {
    totalTroops = spearsTotal + swordsTotal + axesTotal + lightTotal + heavyTotal;
    haulTotal =
      spearsTotal * UNIT_CARRY_CAP.spear +
      swordsTotal * UNIT_CARRY_CAP.sword +
      axesTotal * UNIT_CARRY_CAP.axe +
      lightTotal * UNIT_CARRY_CAP.light +
      heavyTotal * UNIT_CARRY_CAP.heavy;
  }

  if (Object.keys(uHome).length > 0) {
    for (const [unit, count] of Object.entries(uHome)) {
      const c = Math.max(0, Number(count) || 0);
      const cap = UNIT_CARRY_CAP[unit as UnitKey];
      if (cap) haulHome += c * cap;
    }
  } else {
    haulHome =
      spearsHome * UNIT_CARRY_CAP.spear +
      swordsHome * UNIT_CARRY_CAP.sword +
      axesHome * UNIT_CARRY_CAP.axe +
      lightHome * UNIT_CARRY_CAP.light +
      heavyHome * UNIT_CARRY_CAP.heavy;
  }

  return {
    spearsTotal,
    swordsTotal,
    totalTroops,
    haulTotal,
    haulHome
  };
}

export function computeFirestoreDashboardSummary(params: {
  erpState?: Partial<ErpAppState> | Record<string, any> | null;
  masterMeta?: Record<string, any> | null;
  villageDocs?: Array<Record<string, any>>;
  accountDocs?: Array<Record<string, any>>;
  planDocs?: Array<Record<string, any>>;
  worldDocs?: Array<Record<string, any>>;
  syncStatus?: Record<string, any>;
  nowMs?: number;
} = {}): FirestoreDashboardSummary {
  const {
    erpState = null,
    masterMeta = null,
    villageDocs = [],
    accountDocs = [],
    planDocs = [],
    worldDocs = [],
    syncStatus = {},
    nowMs = Date.now()
  } = params;

  const deletedSet = new Set<string>();
  const delList = Array.isArray(erpState?.deletedVillageIds) ? erpState!.deletedVillageIds : [];
  for (const id of delList) {
    const clean = String(id || '').trim();
    if (clean) deletedSet.add(clean);
  }
  const isVillageDeleted = (v: any) => {
    if (!v || typeof v !== 'object') return true;
    if (v.id && deletedSet.has(String(v.id).trim())) return true;
    if (v.villageId && deletedSet.has(String(v.villageId).trim())) return true;
    if (v.coord && deletedSet.has(String(v.coord).trim())) return true;
    return false;
  };

  const worldsList: any[] =
    Array.isArray(erpState?.worlds) && erpState!.worlds.length > 0
      ? erpState!.worlds
      : Array.isArray(worldDocs)
        ? worldDocs
        : [];
  const worldSpeedById = new Map<string, number>();
  const worldContinentsById = new Map<string, Record<string, any>>();
  worldsList.forEach((w) => {
    if (w && w.id) {
      worldSpeedById.set(String(w.id), Math.max(0.1, Number(w.speed) || 1));
      if (w.continents && typeof w.continents === 'object') {
        worldContinentsById.set(String(w.id), w.continents);
      }
    }
  });

  const accountsList: any[] =
    Array.isArray(erpState?.userAccounts) && erpState!.userAccounts.length > 0
      ? erpState!.userAccounts
      : Array.isArray(accountDocs)
        ? accountDocs
        : [];
  const accountById = new Map<string, any>();
  let totalPP = 0;
  const activeAccountsWithVillages = new Set<string>();
  accountsList.forEach((acc) => {
    if (acc && acc.id) accountById.set(String(acc.id), acc);
    totalPP += Math.max(0, Number(acc?.pp || 0));
  });
  if (accountsList.length === 0 && masterMeta && Number.isFinite(Number(masterMeta.totalPP))) {
    totalPP = Math.max(0, Number(masterMeta.totalPP));
  }

  const mergedVillagesMap = new Map<string, any>();
  const stateVillages: any[] = Array.isArray(erpState?.villages) ? erpState!.villages : [];
  stateVillages.forEach((v) => {
    if (isSyntheticStarterVillage(v) || isVillageDeleted(v)) return;
    const key = String(v.id || v.villageId || v.coord || `v_${mergedVillagesMap.size}`);
    mergedVillagesMap.set(key, v);
  });

  if (Array.isArray(villageDocs) && villageDocs.length > 0) {
    villageDocs.forEach((docVil) => {
      if (isSyntheticStarterVillage(docVil) || isVillageDeleted(docVil)) return;
      const key = String(docVil.id || docVil.villageId || docVil.coord || '');
      if (!key) return;
      const existing = mergedVillagesMap.get(key);
      if (!existing) {
        if (stateVillages.length === 0) mergedVillagesMap.set(key, docVil);
        return;
      }
      const existingTs = Number(existing.lastSyncTime || existing.warehouse?.lastUpdated || 0);
      const docTs = Number(docVil.lastSyncTime || 0);
      if (docTs > existingTs) {
        mergedVillagesMap.set(key, {
          ...existing,
          warehouse: {
            ...(existing.warehouse || {}),
            level: docVil.warehouseLevel ?? existing.warehouse?.level ?? 1,
            woodStock: docVil.woodStock ?? existing.warehouse?.woodStock ?? 0,
            clayStock: docVil.clayStock ?? existing.warehouse?.clayStock ?? 0,
            ironStock: docVil.ironStock ?? existing.warehouse?.ironStock ?? 0,
            lastUpdated: docTs
          },
          lastSyncTime: docTs
        });
      }
    });
  }

  const activeVillages = Array.from(mergedVillagesMap.values());

  const plannedVillageIds = new Set<string>();
  if (Array.isArray(planDocs)) {
    planDocs.forEach((p) => {
      if (!p || String(p.id || '').startsWith('game_')) return;
      if (p.villageId && !deletedSet.has(String(p.villageId))) {
        plannedVillageIds.add(String(p.villageId));
      }
    });
  }
  activeVillages.forEach((v) => {
    if (v.assignedPlan && typeof v.assignedPlan === 'object') {
      plannedVillageIds.add(String(v.id || v.villageId || ''));
    }
  });

  let woodStock = 0;
  let clayStock = 0;
  let ironStock = 0;
  let totalPerResourceCapacity = 0;
  let hourlyWoodProd = 0;
  let hourlyClayProd = 0;
  let hourlyIronProd = 0;
  let totalVillagePoints = 0;
  let totalSpears = 0;
  let totalSwords = 0;
  let totalTroopsCount = 0;
  let totalHaulCapacity = 0;
  let idleHaulCapacity = 0;
  let idleArmyVillagesCount = 0;
  let criticalWhCount = 0;
  let warnWhCount = 0;
  let safeWhCount = 0;
  let syncedLast24hCount = 0;
  let latestVillageSyncAt = 0;
  let estimatedDailyPP = 0;
  let nearestFillHours = 999;
  let nearestFillVillageName = '—';
  let nearestFillResName = '—';
  let bestMarketRate = { rate: 99999, resName: '—', villageName: '—' };
  let topPriorityVillage: FirestoreDashboardSummary['topPriorityVillage'] = null;
  let bestPriorityScore = -1;

  activeVillages.forEach((v) => {
    if (v.accountId) activeAccountsWithVillages.add(String(v.accountId));
    const acc = accountById.get(String(v.accountId || '')) || {};
    const displayAccName = acc.name || v.name || 'قرية';

    const whLvl = Math.max(1, Math.min(30, parseInt(String(v.warehouse?.level ?? v.warehouseLevel ?? 1), 10) || 1));
    const cap = getWarehouseCap(whLvl);
    const wSpeed = worldSpeedById.get(String(v.worldId || '')) || 1;

    const wLvl = v.mines?.wood?.curr ?? v.buildings?.['الخشاب'] ?? 0;
    const cLvl = v.mines?.clay?.curr ?? v.buildings?.['حفرة الطمي'] ?? 0;
    const iLvl = v.mines?.iron?.curr ?? v.buildings?.['منجم الحديد'] ?? 0;

    const wProd = estimateMineHourly(wLvl, Boolean(v.premium), v.flag, v.woodItem, Boolean(v.boost30), wSpeed);
    const cProd = estimateMineHourly(cLvl, Boolean(v.premium), v.flag, v.clayItem, Boolean(v.boost30), wSpeed);
    const iProd = estimateMineHourly(iLvl, Boolean(v.premium), v.flag, v.ironItem, Boolean(v.boost30), wSpeed);

    hourlyWoodProd += wProd;
    hourlyClayProd += cProd;
    hourlyIronProd += iProd;

    const refTs = Number(v.warehouse?.lastUpdated || v.lastSyncTime || 0);
    const elapsedHrs = refTs > 0 ? Math.max(0, Math.min(168, (nowMs - refTs) / 3600000)) : 0;

    const curW = Math.min(cap, Math.round(Math.max(0, Number(v.warehouse?.woodStock ?? v.woodStock ?? 0)) + wProd * elapsedHrs));
    const curC = Math.min(cap, Math.round(Math.max(0, Number(v.warehouse?.clayStock ?? v.clayStock ?? 0)) + cProd * elapsedHrs));
    const curI = Math.min(cap, Math.round(Math.max(0, Number(v.warehouse?.ironStock ?? v.ironStock ?? 0)) + iProd * elapsedHrs));

    woodStock += curW;
    clayStock += curC;
    ironStock += curI;
    totalPerResourceCapacity += cap;

    const wPct = Math.min(100, Math.round((curW / cap) * 100));
    const cPct = Math.min(100, Math.round((curC / cap) * 100));
    const iPct = Math.min(100, Math.round((curI / cap) * 100));
    const maxPct = Math.max(wPct, cPct, iPct);

    if (maxPct >= 90) criticalWhCount++;
    else if (maxPct >= 75) warnWhCount++;
    else safeWhCount++;

    const wHrs = curW >= cap ? 0 : wProd > 0 ? (cap - curW) / wProd : 999;
    const cHrs = curC >= cap ? 0 : cProd > 0 ? (cap - curC) / cProd : 999;
    const iHrs = curI >= cap ? 0 : iProd > 0 ? (cap - curI) / iProd : 999;
    const minVilHrs = Math.min(wHrs, cHrs, iHrs);
    const firstFullRes = minVilHrs === wHrs ? 'الخشب' : minVilHrs === cHrs ? 'الطمي' : 'الحديد';
    if (minVilHrs < nearestFillHours) {
      nearestFillHours = minVilHrs;
      nearestFillVillageName = displayAccName;
      nearestFillResName = firstFullRes;
    }

    const contMap = worldContinentsById.get(String(v.worldId || '')) || {};
    const contRates = contMap[String(v.continent || '44')] || {};
    const contSell = Number(contRates.sellRate || 0);
    const sellW = Math.max(50, Number(v.sellRates?.wood || v.market?.wood || contRates.sellWood || contSell || 1000));
    const sellC = Math.max(50, Number(v.sellRates?.clay || v.market?.clay || contRates.sellClay || contSell || 1000));
    const sellI = Math.max(50, Number(v.sellRates?.iron || v.market?.iron || contRates.sellIron || contSell || 1000));

    const mLevel = Math.max(0, Number(v.marketLevel ?? v.buildings?.['السوق'] ?? 0));
    const isMktClosed = mLevel < 1 || Boolean(contRates.isMarketClosed || (v as any).isMarketClosed);

    const sWood = contRates.stockWood ?? (v as any).marketStock?.wood ?? (v as any).stockWood;
    const sClay = contRates.stockClay ?? (v as any).marketStock?.clay ?? (v as any).stockClay;
    const sIron = contRates.stockIron ?? (v as any).marketStock?.iron ?? (v as any).stockIron;

    const cWood = contRates.capWood ?? (v as any).marketCap?.wood ?? (v as any).capWood;
    const cClay = contRates.capClay ?? (v as any).marketCap?.clay ?? (v as any).capClay;
    const cIron = contRates.capIron ?? (v as any).marketCap?.iron ?? (v as any).capIron;

    const hW = isMktClosed
      ? 0
      : cWood !== undefined && cWood > 0
        ? Math.max(0, cWood - Math.max(0, sWood || 0))
        : (cWood === 0 ? 0 : Infinity);
    const hC = isMktClosed
      ? 0
      : cClay !== undefined && cClay > 0
        ? Math.max(0, cClay - Math.max(0, sClay || 0))
        : (cClay === 0 ? 0 : Infinity);
    const hI = isMktClosed
      ? 0
      : cIron !== undefined && cIron > 0
        ? Math.max(0, cIron - Math.max(0, sIron || 0))
        : (cIron === 0 ? 0 : Infinity);

    const sWoodDay = isMktClosed || hW <= 0 ? 0 : Math.min(wProd * 24, hW);
    const sClayDay = isMktClosed || hC <= 0 ? 0 : Math.min(cProd * 24, hC);
    const sIronDay = isMktClosed || hI <= 0 ? 0 : Math.min(iProd * 24, hI);

    const isAllBlocked = isMktClosed || (hW <= 0 && hC <= 0 && hI <= 0);
    const vilDailyPP = isAllBlocked ? 0 : (sWoodDay / sellW + sClayDay / sellC + sIronDay / sellI);
    estimatedDailyPP += vilDailyPP;

    const openOpts: Array<{ rate: number; name: string }> = [];
    if (!isMktClosed) {
      if (hW > 0) openOpts.push({ rate: sellW, name: 'الخشب' });
      if (hC > 0) openOpts.push({ rate: sellC, name: 'الطمي' });
      if (hI > 0) openOpts.push({ rate: sellI, name: 'الحديد' });
    }
    if (openOpts.length > 0) {
      openOpts.sort((a, b) => a.rate - b.rate);
      const bestOpen = openOpts[0];
      if (bestOpen && bestOpen.rate < bestMarketRate.rate) {
        bestMarketRate = {
          rate: bestOpen.rate,
          resName: bestOpen.name,
          villageName: displayAccName
        };
      }
    }

    const troopStats = computeVillageHaulAndTroops(v);
    totalSpears += troopStats.spearsTotal;
    totalSwords += troopStats.swordsTotal;
    totalTroopsCount += troopStats.totalTroops;
    totalHaulCapacity += troopStats.haulTotal;

    const scavEndTs = Number(v.scavenge?.endTime || v.scavEndTime || v.scavReturnAt || v.scavData?.scavReturnAt || 0);
    const isScavRunning = scavEndTs > nowMs;
    const isIdleArmy = !isScavRunning && troopStats.haulHome >= 250;
    if (isIdleArmy) {
      idleArmyVillagesCount++;
      idleHaulCapacity += troopStats.haulHome;
    }

    totalVillagePoints += Math.max(0, Number(v.villagePoints || 0));

    const vSync = Number(v.lastSyncTime || v.warehouse?.lastUpdated || 0);
    if (vSync > latestVillageSyncAt) latestVillageSyncAt = vSync;
    if (vSync > 0 && nowMs - vSync <= 86400000) syncedLast24hCount++;

    let pScore = 0;
    const reasons: string[] = [];
    if (isIdleArmy) {
      pScore += 100000 + troopStats.haulHome;
      reasons.push(`إغارات متوقفة (حمولة ${troopStats.haulHome.toLocaleString('en-US')})`);
    }
    if (minVilHrs <= 0 || maxPct >= 98) {
      pScore += 80000 + maxPct * 100;
      reasons.push(`مخزن ${firstFullRes} ممتلئ (${maxPct}%)`);
    } else if (maxPct >= 85) {
      pScore += 30000 + maxPct * 100;
      reasons.push(`مخزن ${firstFullRes} عند ${maxPct}%`);
    }
    if (v.assignedPlan && typeof v.assignedPlan === 'object') {
      pScore += 5000;
    }
    if (pScore > bestPriorityScore) {
      bestPriorityScore = pScore;
      topPriorityVillage = {
        id: String(v.id || ''),
        accountId: String(v.accountId || ''),
        accountName: displayAccName,
        villageName: String(v.name || displayAccName),
        coord: String(v.coord || '—'),
        continent: String(v.continent || ''),
        device: String(acc.device || v.device || ''),
        browser: String(v.browser || acc.browser || ''),
        maxFillPct: maxPct,
        haulHome: troopStats.haulHome,
        isIdleArmy,
        isWhCritical: maxPct >= 90,
        hasPlan: Boolean(v.assignedPlan),
        planName: v.assignedPlan?.name || '',
        reasonText: reasons.length > 0 ? reasons.join(' · ') : 'قرية مستقرة وجاهزة للمتابعة'
      };
    }
  });

  const totalResources = woodStock + clayStock + ironStock;
  const totalCombinedCapacity = totalPerResourceCapacity * 3;
  const woodFillPct =
    totalPerResourceCapacity > 0 ? Math.min(100, Math.round((woodStock / totalPerResourceCapacity) * 100)) : 0;
  const clayFillPct =
    totalPerResourceCapacity > 0 ? Math.min(100, Math.round((clayStock / totalPerResourceCapacity) * 100)) : 0;
  const ironFillPct =
    totalPerResourceCapacity > 0 ? Math.min(100, Math.round((ironStock / totalPerResourceCapacity) * 100)) : 0;
  const overallFillPct =
    totalCombinedCapacity > 0 ? Math.min(100, Math.round((totalResources / totalCombinedCapacity) * 100)) : 0;

  let healthState: FirestoreDashboardSummary['healthState'] = 'empty';
  let healthLabel = 'لا توجد قرى محفوظة';
  if (activeVillages.length > 0) {
    if (criticalWhCount > 0) {
      healthState = 'critical';
      healthLabel = `${criticalWhCount} مخزن حرج (>= 90%)`;
    } else if (warnWhCount > 0) {
      healthState = 'warning';
      healthLabel = `${warnWhCount} مخزن قريب الامتلاء`;
    } else {
      healthState = 'safe';
      healthLabel = 'المخازن آمنة ومستقرة';
    }
  }

  const lastSyncAt =
    Number(syncStatus.lastSyncAt || masterMeta?.clientTimestamp || latestVillageSyncAt || 0) || null;
  const status = String(syncStatus.status || (activeVillages.length > 0 ? 'synced' : 'idle'));
  const estimatedHourlyPP = estimatedDailyPP / 24;

  return {
    status,
    online: syncStatus.online !== false,
    errorMessage: syncStatus.errorMessage || null,
    lastSyncAt,
    dataSource: String(masterMeta?.source || syncStatus.source || (erpState ? 'firestore' : 'cache')),
    villagesCount: activeVillages.length,
    syncedLast24hCount,
    accountsCount: accountsList.length || Number(masterMeta?.accountsCount || 0),
    activeAccountsCount: activeAccountsWithVillages.size,
    plansCount: plannedVillageIds.size,
    worldsCount: worldsList.length,
    totalPP,
    totalVillagePoints,
    totalSpears,
    totalSwords,
    totalTroopsCount,
    totalHaulCapacity,
    idleHaulCapacity,
    idleArmyVillagesCount,
    woodStock,
    clayStock,
    ironStock,
    totalResources,
    totalPerResourceCapacity,
    totalCombinedCapacity,
    woodFillPct,
    clayFillPct,
    ironFillPct,
    overallFillPct,
    hourlyWoodProd,
    hourlyClayProd,
    hourlyIronProd,
    totalHourlyProd: hourlyWoodProd + hourlyClayProd + hourlyIronProd,
    estimatedHourlyPP: Math.round(estimatedHourlyPP * 10) / 10,
    estimatedDailyPP: Math.round(estimatedDailyPP * 10) / 10,
    nearestFillHours: nearestFillHours < 999 ? Math.max(0, Math.round(nearestFillHours * 100) / 100) : null,
    nearestFillVillageName,
    nearestFillResName,
    bestMarketRate: bestMarketRate.rate < 99999 ? bestMarketRate : null,
    topPriorityVillage,
    criticalWhCount,
    warnWhCount,
    safeWhCount,
    healthState,
    healthLabel,
    computedAt: nowMs
  };
}
