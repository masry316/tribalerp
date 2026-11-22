import {
  BASE_BUILD_TIME,
  BUILDINGS_DATA,
  LEVEL_TIME_FACTORS,
  MARKET_MERCHANTS,
  SCAV_UNLOCK_DATA
} from '../constants/gameData';
import type {
  AssignedPlan,
  AssignedPlanStep,
  ErpAppState,
  ErpGameRules,
  ErpVillage,
  OptMode,
  PhaseConfigInput,
  ScavDispatchResult,
  SimDiscountMode
} from '../types';
import {
  calcVillagePointsFromBuildings,
  computeVillageLiveStatus,
  getBuildingTotalPop,
  getFarmCap,
  getMineHourlyProd,
  getSpearUnitTrainSec,
  getVillageUsedPop,
  getWarehouseCap,
  makeStarter26Buildings,
  normalizeBuildingsMap
} from './resourceEngine';
import { calcScavDispatch, planScavSlotAllocations } from './scavengingEngine';

export interface TacticalStudioInput {
  simMode: 'virtual26' | 'real';
  realVillageId: string;
  optMode: OptMode;
  scavMode: 'max_profit' | 'min_logins';
  s1Days: number;
  devHours: number;
  activeHrs: number;
  scavCycleHrs: number;
  minScavCycleHrs?: number;
  sellRate: number;
  sellWood?: number;
  sellClay?: number;
  sellIron?: number;
  buyRate: number;
  startWoodStock?: number;
  startClayStock?: number;
  startIronStock?: number;
  worldSpeed: number;
  unitSpeed: number;
  boostBudgetPP: number;
  extraSpears: number;
  freeFinish: boolean;
  sideQuests: boolean;
  buildingQuests?: boolean;
  requireSwordResearch?: boolean;
  boost30: boolean;
  flagPct: number;
  premPct: number;
  woodBonusPct: number;
  clayBonusPct: number;
  ironBonusPct: number;
  marketTargetLvl: number;
  boostTiming: 'after_dev' | 'during_dev';
  phases: {
    p2: PhaseConfigInput;
    p3: PhaseConfigInput;
    p4: PhaseConfigInput;
  };
}

export type TacticalStepActionType =
  | 'bldg'
  | 'train_spear'
  | 'train_sword'
  | 'train_paladin'
  | 'research_sword'
  | 'scav_unlock'
  | 'scav_return'
  | 'boost30_activate'
  | 'sell_surplus';

export type StrategyArchetype =
  | 'scav_rush'
  | 'balanced_hybrid'
  | 'mines_economy'
  | 'paladin_blitz'
  | 'ultra_scav_army';

export type ArbitrageMode = 'full_harvest' | 'mines_only' | 'none';
export type OpeningStyle = 'quest_blitz' | 'arbitrage_max' | 'hq_first' | 'mines_first';
export type ResourceBias =
  | 'wood_spear_focus'
  | 'clay_wood_push'
  | 'iron_defer_heavy'
  | 'balanced_mines';

export interface TacticalStrategyPolicy {
  id: string;
  archetype: StrategyArchetype;
  arbitrageMode: ArbitrageMode;
  openingStyle: OpeningStyle;
  resourceBias: ResourceBias;
  arbitrageMinRate: number;
  spearTarget: number;
  scavTierCap: 0 | 1 | 2 | 3 | 4;
  hqCap: number;
  barracksCap: number;
  usePaladin: boolean;
  useIronSwords: boolean;
  scavWeight: number;
  devStopRatio: number;
  label: string;
  summary: string;
}

export interface StrategyCandidateSummary {
  id: string;
  policy: TacticalStrategyPolicy;
  label: string;
  archetype: StrategyArchetype;
  archetypeLabel: string;
  s1NetPP: number;
  totalCumulativePP: number;
  gainVsBaselinePP: number;
  finalHourlyMineProd: number;
  finalHourlyScavProd: number;
  finalSpears: number;
  finalSwords: number;
  finalPaladins: number;
  finalScavTier: number;
  woodLvl: number;
  clayLvl: number;
  ironLvl: number;
  hqLvl: number;
  barracksLvl: number;
  whLvl: number;
  farmLvl: number;
  actualSummary: string;
  effectiveDevHours: number;
  arbitrageBonusRes: number;
}

export interface TacticalTimelineStep {
  stepNum: number;
  atype: TacticalStepActionType;
  bName: string;
  baseName: string;
  lvl: number;
  tStart: number;
  tEnd: number;
  buildDur: number;
  cost: { w: number; c: number; i: number };
  rew: { w: number; c: number; i: number };
  reason: string;
}

export interface TacticalSnapshot {
  tSec: number;
  wStock: number;
  cStock: number;
  iStock: number;
  mineHourly: number;
  scavHourly: number;
  spears: number;
  note: string;
}

export interface TacticalStageResult {
  stageNum: 2 | 3 | 4;
  label: string;
  enabled: boolean;
  days: number;
  startRate: number;
  endRate: number;
  avgRate: number;
  sellOnlyPP: number;
  upgradesDesc: string;
  upgradesCount: number;
  paybackDays: number | null;
  netStagePP: number;
  ppPerDay: number;
  endingHourlyProd: number;
  overflowLossRes?: number;
  merchantBottleneckRes?: number;
}

export interface TacticalSimulationResult {
  input: TacticalStudioInput;
  s1NetPP: number;
  s1GrossPP: number;
  totalCumulativePP: number;
  usedBoostPP: number;
  unspentBoostPP: number;
  minePP: number;
  scavPP: number;
  mineSharePct: number;
  scavSharePct: number;
  scavRunsTotal: number;
  scavLootTotal: number;
  startPoints: number;
  endPoints: number;
  gainedPoints: number;
  finalHourlyMineProd: number;
  steadyHourlyMineProd: number;
  finalHourlyScavProd: number;
  finalHourlyTotal: number;
  finalSpears: number;
  finalSwords: number;
  finalPaladins: number;
  finalScavTier: number;
  startBuildings: Record<string, number>;
  finalBuildings: Record<string, number>;
  stages: TacticalStageResult[];
  chartPoints: Array<{
    key: string;
    label: string;
    cumulativePP: number;
    stagePP: number;
  }>;
  steps: TacticalTimelineStep[];
  snapshots: TacticalSnapshot[];
  finalScavDispatch: ScavDispatchResult;
  // Executive summary, separated steady vs temporary 48h boost30, and real merchant telemetry
  dailyMinePP: number;
  dailyScavPP: number;
  dailyTotalPP: number;
  steadyDailyMinePP: number;
  steadyDailyScavPP: number;
  steadyDailyTotalPP: number;
  boost30ExtraPP: number;
  devSoldPP: number;
  loginIntervalSec: number;
  boost30ActiveStartSec: number | null;
  boost30ActiveEndSec: number | null;
  boost30ExtraRes: number;
  offlineOverflowLossRes: number;
  devOverflowLossRes: number;
  dailyMerchantCapRes: number;
  dailySellableRes: number;
  merchantBottleneckRes: number;
  dayScavRunsDev: number;
  overnightScavRunsDev: number;
  // Multi-scenario optimization telemetry
  scenariosTested: number;
  winningPolicy: TacticalStrategyPolicy;
  actualSummary: string;
  baselineTotalPP: number;
  gainVsBaselinePP: number;
  arbitrageBonusRes: number;
  effectiveDevHours: number;
  topStrategies: StrategyCandidateSummary[];
}

export interface TacticalAutoSearchResult {
  bestInput: TacticalStudioInput;
  bestResult: TacticalSimulationResult;
  testedCount: number;
}

export interface MineBudgetInput {
  startWood: number;
  startClay: number;
  startIron: number;
  budgetPP: number;
  buyRate: number;
  discountMode: SimDiscountMode;
  worldSpeed?: number;
  premPct?: number;
  flagPct?: number;
  boost30?: boolean;
}

export interface MineBudgetStep {
  mineKey: 'wood' | 'clay' | 'iron';
  buildingName: string;
  toLvl: number;
  resCost: number;
  ppCost: number;
  usedDiscount: boolean;
  addedProd: number;
}

export interface MineBudgetResult {
  woodLvl: number;
  clayLvl: number;
  ironLvl: number;
  spentPP: number;
  remainingPP: number;
  addedHourlyProd: number;
  discountsUsed: number;
  steps: MineBudgetStep[];
}

export interface BuildingCalcRow {
  lvl: number;
  wood: number;
  clay: number;
  iron: number;
  totalRes: number;
  savedRes: number;
  usedDiscount: boolean;
  prop: string;
  durSec: number;
}

export interface BuildingCalcResult {
  buildingName: string;
  fromLvl: number;
  toLvl: number;
  hqLvl: number;
  worldSpeed: number;
  buyRate: number;
  discountMode: SimDiscountMode;
  totalWood: number;
  totalClay: number;
  totalIron: number;
  totalRes: number;
  savedRes: number;
  discountLevelsCount: number;
  discountPP: number;
  resPP: number;
  totalPP: number;
  totalBuildSec: number;
  rows: BuildingCalcRow[];
}

const MINE_NAMES = ['الخشاب', 'حفرة الطمي', 'منجم الحديد'] as const;

const ARBITRAGE_BUILDINGS = [
  'المزارع',
  'المخابئ',
  'المخازن',
  'الخشاب',
  'حفرة الطمي',
  'منجم الحديد',
  'المبنى الرئيسي',
  'السوق',
  'الحائط'
] as const;

export const ARCHETYPE_LABELS: Record<StrategyArchetype, string> = {
  scav_rush: 'اندفاع الإغارات المبكر',
  balanced_hybrid: 'التوازن الذكي (مناجم + إغارات)',
  mines_economy: 'اقتصاد المناجم المتقدم',
  paladin_blitz: 'افتتاح قائد الفرسان والإغارة',
  ultra_scav_army: 'جيش إغارات مكثف (رماح + سيوف)'
};

export function createDefaultTacticalStudioInput(
  state?: Partial<ErpAppState>
): TacticalStudioInput {
  const cfg = state?.asimConfig;
  const firstVil = state?.villages?.[0];
  const baseSell = Math.max(1, Number(cfg?.ppRate || 64));
  return {
    simMode: cfg?.simType === 'real' && firstVil ? 'real' : 'virtual26',
    realVillageId: cfg?.realVilId || firstVil?.id || '',
    optMode: cfg?.optMode === 'cumulative' ? 'cumulative' : 'per_phase',
    scavMode: cfg?.scavMode === 'min_logins' ? 'min_logins' : 'max_profit',
    s1Days: Math.max(1, Number(cfg?.windowDays || 5)),
    devHours: Math.max(1, Number(cfg?.hours || 36)),
    activeHrs: Math.max(1, Math.min(24, Number(cfg?.activeHrs || 12))),
    scavCycleHrs: Math.max(0.5, Number(cfg?.sessionHrs || 2)),
    minScavCycleHrs: Math.max(0.5, Math.min(6, Number(cfg?.minScavCycleHrs ?? 2))),
    sellRate: baseSell,
    sellWood: Math.max(1, Number(cfg?.sellWood ?? baseSell)),
    sellClay: Math.max(1, Number(cfg?.sellClay ?? baseSell)),
    sellIron: Math.max(1, Number(cfg?.sellIron ?? baseSell)),
    buyRate: Math.max(1, Number(cfg?.buyRate || 64)),
    startWoodStock: Math.max(0, Math.min(1000, Number(cfg?.wStart ?? 500))),
    startClayStock: Math.max(0, Math.min(1000, Number(cfg?.cStart ?? 500))),
    startIronStock: Math.max(0, Math.min(1000, Number(cfg?.iStart ?? 400))),
    worldSpeed: Math.max(0.1, Number(cfg?.worldSpeed || 1)),
    unitSpeed: 1,
    boostBudgetPP: 0,
    extraSpears: Math.max(0, Number(cfg?.extraSpears || 0)),
    freeFinish: Boolean(cfg?.freeFinish ?? false),
    sideQuests: Boolean(cfg?.harvestSide ?? true),
    buildingQuests: Boolean(cfg?.buildingQuests ?? true),
    requireSwordResearch: Boolean(cfg?.requireSwordResearch ?? true),
    boost30: Boolean(cfg?.marketBoost ?? true),
    flagPct: Math.max(0, Number(cfg?.flagPct || 0)),
    premPct: Math.max(0, Number(cfg?.premPct || 0)),
    woodBonusPct: Math.max(0, Number(cfg?.wBon || 0)),
    clayBonusPct: Math.max(0, Number(cfg?.cBon || 0)),
    ironBonusPct: Math.max(0, Number(cfg?.iBon || 0)),
    marketTargetLvl: Math.max(0, Math.min(25, Number(cfg?.activePol?.mk ?? 5))),
    boostTiming:
      cfg?.activePol?.boostTiming === 'during_dev' ? 'during_dev' : 'after_dev',
    phases: {
      p2: {
        enabled: Boolean(cfg?.phases?.p2?.enabled ?? false),
        days: Math.max(1, Number(cfg?.phases?.p2?.days || 4)),
        startRate: Math.max(1, Number(cfg?.phases?.p2?.startRate || 120)),
        endRate: Math.max(1, Number(cfg?.phases?.p2?.endRate || 150))
      },
      p3: {
        enabled: Boolean(cfg?.phases?.p3?.enabled ?? false),
        days: Math.max(1, Number(cfg?.phases?.p3?.days || 5)),
        startRate: Math.max(1, Number(cfg?.phases?.p3?.startRate || 150)),
        endRate: Math.max(1, Number(cfg?.phases?.p3?.endRate || 200))
      },
      p4: {
        enabled: Boolean(cfg?.phases?.p4?.enabled ?? false),
        days: Math.max(1, Number(cfg?.phases?.p4?.days || 7)),
        startRate: Math.max(1, Number(cfg?.phases?.p4?.startRate || 200)),
        endRate: Math.max(1, Number(cfg?.phases?.p4?.endRate || 260))
      }
    }
  };
}

/**
 * Official Tribal Wars build duration formula calibrated against live server data:
 * raw = round(baseSec * LEVEL_TIME_FACTORS[lvl - 1] * 1.05^(-hqLvl) / worldSpeed)
 */
export function calcBuildDurationSec(
  buildingName: string,
  lvl: number,
  hqLvl: number,
  worldSpeed: number,
  freeFinish: boolean = false,
  freeFinishSec: number = 180
): number {
  const cfg = BASE_BUILD_TIME[buildingName];
  if (!cfg || lvl <= 0) return 0;
  const [baseSec, minSec] = cfg;
  const ws = Math.max(0.1, Number(worldSpeed) || 1);
  const hq = Math.max(1, Math.min(30, Math.round(hqLvl || 1)));
  const factor =
    LEVEL_TIME_FACTORS[Math.min(LEVEL_TIME_FACTORS.length, Math.max(1, lvl)) - 1] ?? 1;
  const raw = Math.round((baseSec * factor * Math.pow(1.05, -hq)) / ws);
  const minScaled = Math.max(1, Math.round(minSec / ws));
  const dur = Math.max(minScaled, raw);
  if (!freeFinish || freeFinishSec <= 0) return dur;
  return Math.max(0, dur - freeFinishSec);
}

export function getBuildingLevelCost(
  buildingName: string,
  lvl: number
): { w: number; c: number; i: number; total: number; prop: string; prod: number } {
  const def = BUILDINGS_DATA[buildingName];
  if (!def || lvl <= 0 || lvl > def.levels.length) {
    return { w: 0, c: 0, i: 0, total: 0, prop: '—', prod: 0 };
  }
  const row = def.levels[lvl - 1];
  return {
    w: row.wood,
    c: row.clay,
    i: row.iron,
    total: row.wood + row.clay + row.iron,
    prop: row.prop,
    prod: row.prod
  };
}

/**
 * Official Tribal Wars building prerequisite check so every generated plan is 100% legal in-game.
 */
export function checkBuildingPrerequisites(
  buildingName: string,
  lvls: Record<string, number>
): boolean {
  const hq = lvls['المبنى الرئيسي'] || 0;
  const barracks = lvls['الثكنات'] || 0;
  const wh = lvls['المخازن'] || 0;
  const smith = lvls['الحداد'] || 0;

  if (buildingName === 'الثكنات') return hq >= 3;
  if (buildingName === 'الحائط') return barracks >= 1;
  if (buildingName === 'السوق') return hq >= 3 && wh >= 2;
  if (buildingName === 'الحداد') return hq >= 5 && barracks >= 1;
  if (buildingName === 'الإسطبل') return hq >= 10 && barracks >= 5 && smith >= 5;
  if (buildingName === 'الورشة') return hq >= 10 && smith >= 10;
  if (buildingName === 'الأكاديمية') return hq >= 20 && smith >= 20 && (lvls['السوق'] || 0) >= 10;
  return true;
}

/**
 * Minimum Warehouse level whose per-resource capacity can hold all 3 resource costs.
 * Example: Scavenging Tier 3 (1,200 clay) -> WH 2 (1,229); Scavenging Tier 4 (12,000 clay) -> WH 14 (14,670).
 */
export function getMinWarehouseLevelForCost(cost: { w: number; c: number; i: number }): number {
  const maxNeed = Math.max(0, cost.w, cost.c, cost.i);
  for (let lvl = 1; lvl <= 30; lvl++) {
    if (getWarehouseCap(lvl) >= maxNeed) return lvl;
  }
  return 30;
}

/**
 * Minimum Farm level whose population capacity can hold requiredPop.
 */
export function getMinFarmLevelForPop(requiredPop: number): number {
  for (let lvl = 1; lvl <= 30; lvl++) {
    if (getFarmCap(lvl) >= requiredPop) return lvl;
  }
  return 30;
}

/**
 * Exact incremental population consumed when upgrading a building from (nextLvl - 1) to nextLvl.
 */
export function getBuildingPopDelta(bName: string, nextLvl: number): number {
  if (nextLvl <= 0) return 0;
  return Math.max(0, getBuildingTotalPop(bName, nextLvl) - getBuildingTotalPop(bName, nextLvl - 1));
}

function getWarehouseUpgradeChainStats(
  curWhLvl: number,
  reqWhLvl: number,
  hqLvl: number,
  worldSpeed: number,
  freeFinish: boolean,
  freeFinishSec: number,
  rules?: Partial<ErpGameRules>,
  buildingQuests: boolean = true
): { levelsNeeded: number; netResCost: number; grossResCost: number; totalDurSec: number } {
  if (reqWhLvl <= curWhLvl) {
    return { levelsNeeded: 0, netResCost: 0, grossResCost: 0, totalDurSec: 0 };
  }
  let netResCost = 0;
  let grossResCost = 0;
  let totalDurSec = 0;
  for (let l = curWhLvl + 1; l <= reqWhLvl; l++) {
    const c = getBuildingLevelCost('المخازن', l);
    const rew = calcBuildReward(c, rules, buildingQuests);
    grossResCost += c.total;
    netResCost += Math.max(0, c.total - (rew.w + rew.c + rew.i));
    totalDurSec += calcBuildDurationSec('المخازن', l, hqLvl, worldSpeed, freeFinish, freeFinishSec);
  }
  return {
    levelsNeeded: reqWhLvl - curWhLvl,
    netResCost,
    grossResCost,
    totalDurSec
  };
}

function buildExecutedSummary(
  lvls: Record<string, number>,
  finalScavTier: number,
  finalSpears: number,
  finalSwords: number,
  finalPaladins: number
): string {
  const hq = lvls['المبنى الرئيسي'] || 1;
  const bar = lvls['الثكنات'] || 0;
  const wh = lvls['المخازن'] || 1;
  const parts = [`رئيسي م${hq}`, `ثكنات م${bar}`, `مخزن م${wh}`, `إغارة م${finalScavTier}`];
  if (finalSpears > 0) parts.push(`${finalSpears} رمح`);
  if (finalSwords > 0) parts.push(`${finalSwords} سيف`);
  if (finalPaladins > 0) parts.push('قائد');
  return parts.join(' · ');
}

function calcBuildReward(
  cost: { w: number; c: number; i: number },
  rules?: Partial<ErpGameRules>,
  enabled: boolean = true
): { w: number; c: number; i: number } {
  if (!enabled) return { w: 0, c: 0, i: 0 };
  const pct = Math.max(0, Number(rules?.rewPct ?? 10)) / 100;
  const minW = Math.max(0, Number(rules?.minRewW ?? 150));
  const minC = Math.max(0, Number(rules?.minRewC ?? 150));
  const minI = Math.max(0, Number(rules?.minRewI ?? 100));
  return {
    w: Math.max(minW, Math.round(cost.w * pct)),
    c: Math.max(minC, Math.round(cost.c * pct)),
    i: Math.max(minI, Math.round(cost.i * pct))
  };
}

const BOOST30_DURATION_SEC = 48 * 3600;
const SWORD_RESEARCH_COST = { w: 900, c: 800, i: 700, total: 2400 };
const SWORD_RESEARCH_BASE_SEC = 3000; // ~50m at 1x speed in Smithy Lv1

interface SellRatesTriple {
  w: number;
  c: number;
  i: number;
  avg: number;
  invAvg: number;
}

function getEffectiveSellRates(input: TacticalStudioInput): SellRatesTriple {
  const base = Math.max(1, Number(input.sellRate) || 64);
  const w = Math.max(1, Number(input.sellWood ?? base) || base);
  const c = Math.max(1, Number(input.sellClay ?? base) || base);
  const i = Math.max(1, Number(input.sellIron ?? base) || base);
  const avg = (w + c + i) / 3;
  const invAvg = (1 / w + 1 / c + 1 / i) / 3;
  return { w, c, i, avg, invAvg };
}

function calcSplitResourcesPP(
  wRes: number,
  cRes: number,
  iRes: number,
  rates: SellRatesTriple
): number {
  return Math.max(0, wRes) / rates.w + Math.max(0, cRes) / rates.c + Math.max(0, iRes) / rates.i;
}

/**
 * Real Tribal Wars merchant daily selling capacity (1,000 res/merchant per round-trip).
 * Replaces invented marketEfficiency percentages with true merchant throughput.
 */
export function calcDailyMerchantCapacityRes(
  marketLvl: number,
  activeHrs: number,
  worldSpeed: number,
  loginIntervalSec: number = 7200
): number {
  const mLvl = Math.max(0, Math.min(25, Math.round(marketLvl || 0)));
  const merchants = MARKET_MERCHANTS[mLvl] || 0;
  if (merchants <= 0) return 0;
  const ws = Math.max(0.1, Number(worldSpeed) || 1);
  const actH = Math.max(1, Math.min(24, Number(activeHrs) || 12));
  // Average round-trip to continent Premium Exchange (~1h at 1x speed, scales with worldSpeed, min 0.45h)
  const tripHrs = Math.max(0.45, 1.0 / Math.max(0.5, ws));
  const loginCadenceHrs =
    loginIntervalSec > 0 ? Math.min(2.5, Math.max(tripHrs, loginIntervalSec / 3600)) : Math.max(tripHrs, 1.5);
  const tripsPerDay =
    actH >= 24 ? 24 / loginCadenceHrs : Math.min(24 / tripHrs, actH / loginCadenceHrs + 1);
  return Math.round(merchants * 1000 * tripsPerDay);
}

function computeMineRates(
  lvls: Record<string, number>,
  input: TacticalStudioInput,
  rules?: Partial<ErpGameRules>,
  boost30Active: boolean = false
): { wHr: number; cHr: number; iHr: number; totalHr: number } {
  const premRules = { ...rules, premPct: input.premPct };
  const isPrem = input.premPct > 0;
  const wHr = getMineHourlyProd(
    lvls['الخشاب'] || 0,
    isPrem,
    input.flagPct,
    input.woodBonusPct,
    boost30Active,
    input.worldSpeed,
    premRules
  );
  const cHr = getMineHourlyProd(
    lvls['حفرة الطمي'] || 0,
    isPrem,
    input.flagPct,
    input.clayBonusPct,
    boost30Active,
    input.worldSpeed,
    premRules
  );
  const iHr = getMineHourlyProd(
    lvls['منجم الحديد'] || 0,
    isPrem,
    input.flagPct,
    input.ironBonusPct,
    boost30Active,
    input.worldSpeed,
    premRules
  );
  return { wHr, cHr, iHr, totalHr: wHr + cHr + iHr };
}

function getEffectiveDiscountDecision(
  resCost: number,
  buyRate: number,
  discountMode: SimDiscountMode
): { useDiscount: boolean; savedRes: number; effectiveRes: number; ppFee: number } {
  if (discountMode === 'none' || resCost <= 0) {
    return { useDiscount: false, savedRes: 0, effectiveRes: resCost, ppFee: 0 };
  }
  const savedRes = Math.round(resCost * 0.2);
  const savedPP = savedRes / Math.max(1, buyRate);
  const useDiscount = discountMode === 'all' || savedPP > 30;
  if (!useDiscount) {
    return { useDiscount: false, savedRes: 0, effectiveRes: resCost, ppFee: 0 };
  }
  return {
    useDiscount: true,
    savedRes,
    effectiveRes: resCost - savedRes,
    ppFee: 30
  };
}

/**
 * Tab 4: Mine Budget Optimizer (Exact global optimum over Wood/Clay/Iron levels within budgetPP)
 */
export function optimizeMineBudget(params: MineBudgetInput): MineBudgetResult {
  const budgetPP = Math.max(0, Number(params.budgetPP) || 0);
  const buyRate = Math.max(1, Number(params.buyRate) || 64);
  const ws = Math.max(0.1, Number(params.worldSpeed) || 1);
  const premPct = Math.max(0, Number(params.premPct) || 0);
  const flagPct = Math.max(0, Number(params.flagPct) || 0);
  const boost30 = Boolean(params.boost30);
  const discountMode: SimDiscountMode = params.discountMode || 'smart';

  const startW = Math.max(0, Math.min(30, Math.round(params.startWood || 0)));
  const startC = Math.max(0, Math.min(30, Math.round(params.startClay || 0)));
  const startI = Math.max(0, Math.min(30, Math.round(params.startIron || 0)));

  type MineCurvePoint = {
    lvl: number;
    cumPP: number;
    cumAddedProd: number;
    cumDiscounts: number;
    step?: MineBudgetStep;
  };

  const buildCurve = (
    mineKey: 'wood' | 'clay' | 'iron',
    bName: string,
    startLvl: number
  ): MineCurvePoint[] => {
    const startProd = getMineHourlyProd(startLvl, premPct > 0, flagPct, 0, boost30, ws, {
      premPct
    });
    const curve: MineCurvePoint[] = [
      { lvl: startLvl, cumPP: 0, cumAddedProd: 0, cumDiscounts: 0 }
    ];
    let cumPP = 0;
    let cumDiscounts = 0;
    for (let lvl = startLvl + 1; lvl <= 30; lvl++) {
      const cost = getBuildingLevelCost(bName, lvl);
      const disc = getEffectiveDiscountDecision(cost.total, buyRate, discountMode);
      const ppCost = disc.effectiveRes / buyRate + disc.ppFee;
      cumPP += ppCost;
      if (disc.useDiscount) cumDiscounts++;
      if (cumPP > budgetPP + 1e-6) break;
      const lvlProd = getMineHourlyProd(lvl, premPct > 0, flagPct, 0, boost30, ws, {
        premPct
      });
      const prevProd = getMineHourlyProd(lvl - 1, premPct > 0, flagPct, 0, boost30, ws, {
        premPct
      });
      curve.push({
        lvl,
        cumPP,
        cumAddedProd: Math.max(0, lvlProd - startProd),
        cumDiscounts,
        step: {
          mineKey,
          buildingName: bName,
          toLvl: lvl,
          resCost: disc.effectiveRes,
          ppCost,
          usedDiscount: disc.useDiscount,
          addedProd: Math.max(0, lvlProd - prevProd)
        }
      });
    }
    return curve;
  };

  const wCurve = buildCurve('wood', 'الخشاب', startW);
  const cCurve = buildCurve('clay', 'حفرة الطمي', startC);
  const iCurve = buildCurve('iron', 'منجم الحديد', startI);

  let bestW = 0;
  let bestC = 0;
  let bestI = 0;
  let bestProd = -1;
  let bestPP = Infinity;

  for (let wi = 0; wi < wCurve.length; wi++) {
    const wp = wCurve[wi];
    for (let ci = 0; ci < cCurve.length; ci++) {
      const cp = cCurve[ci];
      const wcPP = wp.cumPP + cp.cumPP;
      if (wcPP > budgetPP + 1e-6) break;
      for (let ii = 0; ii < iCurve.length; ii++) {
        const ip = iCurve[ii];
        const totalPP = wcPP + ip.cumPP;
        if (totalPP > budgetPP + 1e-6) break;
        const totalProd = wp.cumAddedProd + cp.cumAddedProd + ip.cumAddedProd;
        if (
          totalProd > bestProd + 1e-6 ||
          (Math.abs(totalProd - bestProd) <= 1e-6 && totalPP < bestPP)
        ) {
          bestProd = totalProd;
          bestPP = totalPP;
          bestW = wi;
          bestC = ci;
          bestI = ii;
        }
      }
    }
  }

  const steps: MineBudgetStep[] = [];
  for (let idx = 1; idx <= bestW; idx++) {
    if (wCurve[idx].step) steps.push(wCurve[idx].step!);
  }
  for (let idx = 1; idx <= bestC; idx++) {
    if (cCurve[idx].step) steps.push(cCurve[idx].step!);
  }
  for (let idx = 1; idx <= bestI; idx++) {
    if (iCurve[idx].step) steps.push(iCurve[idx].step!);
  }
  steps.sort(
    (a, b) => a.ppCost / Math.max(0.1, a.addedProd) - b.ppCost / Math.max(0.1, b.addedProd)
  );

  const finalW = wCurve[bestW];
  const finalC = cCurve[bestC];
  const finalI = iCurve[bestI];
  const spentPP = finalW.cumPP + finalC.cumPP + finalI.cumPP;

  return {
    woodLvl: finalW.lvl,
    clayLvl: finalC.lvl,
    ironLvl: finalI.lvl,
    spentPP: Math.round(spentPP * 10) / 10,
    remainingPP: Math.round(Math.max(0, budgetPP - spentPP) * 10) / 10,
    addedHourlyProd: Math.round(finalW.cumAddedProd + finalC.cumAddedProd + finalI.cumAddedProd),
    discountsUsed: finalW.cumDiscounts + finalC.cumDiscounts + finalI.cumDiscounts,
    steps
  };
}

/**
 * Tab 4: Building Cost & Time Calculator across level range [fromLvl -> toLvl]
 */
export function calcBuildingRange(params: {
  buildingName: string;
  fromLvl: number;
  toLvl: number;
  hqLvl: number;
  worldSpeed: number;
  buyRate: number;
  discountMode: SimDiscountMode;
  freeFinish?: boolean;
}): BuildingCalcResult {
  const def = BUILDINGS_DATA[params.buildingName] || BUILDINGS_DATA['الخشاب'];
  const buildingName = def.name;
  const maxL = def.max_lvl;
  const fromLvl = Math.max(0, Math.min(maxL - 1, Math.round(params.fromLvl || 0)));
  const toLvl = Math.max(fromLvl, Math.min(maxL, Math.round(params.toLvl || fromLvl)));
  const hqLvl = Math.max(1, Math.min(30, Math.round(params.hqLvl || 1)));
  const worldSpeed = Math.max(0.1, Number(params.worldSpeed) || 1);
  const buyRate = Math.max(1, Number(params.buyRate) || 64);
  const discountMode: SimDiscountMode = params.discountMode || 'smart';

  const rows: BuildingCalcRow[] = [];
  let totalWood = 0;
  let totalClay = 0;
  let totalIron = 0;
  let savedRes = 0;
  let discountLevelsCount = 0;
  let totalBuildSec = 0;

  for (let lvl = fromLvl + 1; lvl <= toLvl; lvl++) {
    const raw = getBuildingLevelCost(buildingName, lvl);
    const disc = getEffectiveDiscountDecision(raw.total, buyRate, discountMode);
    const mult = disc.useDiscount ? 0.8 : 1;
    const w = Math.round(raw.w * mult);
    const c = Math.round(raw.c * mult);
    const i = Math.round(raw.i * mult);
    const lvlSaved = raw.total - (w + c + i);
    const durSec = calcBuildDurationSec(
      buildingName,
      lvl,
      hqLvl,
      worldSpeed,
      Boolean(params.freeFinish),
      180
    );

    totalWood += w;
    totalClay += c;
    totalIron += i;
    savedRes += lvlSaved;
    if (disc.useDiscount) discountLevelsCount++;
    totalBuildSec += durSec;

    rows.push({
      lvl,
      wood: w,
      clay: c,
      iron: i,
      totalRes: w + c + i,
      savedRes: lvlSaved,
      usedDiscount: disc.useDiscount,
      prop: raw.prop,
      durSec
    });
  }

  const totalRes = totalWood + totalClay + totalIron;
  const discountPP = discountLevelsCount * 30;
  const resPP = totalRes / buyRate;
  const totalPP = resPP + discountPP;

  return {
    buildingName,
    fromLvl,
    toLvl,
    hqLvl,
    worldSpeed,
    buyRate,
    discountMode,
    totalWood,
    totalClay,
    totalIron,
    totalRes,
    savedRes,
    discountLevelsCount,
    discountPP,
    resPP: Math.round(resPP * 10) / 10,
    totalPP: Math.round(totalPP * 10) / 10,
    totalBuildSec,
    rows
  };
}

interface ResolvedStartState {
  buildings: Record<string, number>;
  wStock: number;
  cStock: number;
  iStock: number;
  spears: number;
  swords: number;
  axes: number;
  archers: number;
  lights: number;
  marchers: number;
  heavies: number;
  knights: number;
  scavUnlocked: number;
  startBoost30: boolean;
}

function resolveStartState(input: TacticalStudioInput, state?: ErpAppState): ResolvedStartState {
  if (input.simMode === 'real' && state) {
    const vil: ErpVillage | undefined =
      state.villages.find((v) => v.id === input.realVillageId) || state.villages[0];
    if (vil) {
      const live = computeVillageLiveStatus(vil, state);
      const buildings = normalizeBuildingsMap(vil.buildings, vil);
      const uTot = vil.unitsTotal || vil.scavData?.unitsTotal || {};
      return {
        buildings,
        wStock: Math.max(0, Math.round(live.currentWood)),
        cStock: Math.max(0, Math.round(live.currentClay)),
        iStock: Math.max(0, Math.round(live.currentIron)),
        spears: Math.max(0, Math.round(Number(uTot.spear ?? vil.spearsTotal ?? 0))),
        swords: Math.max(0, Math.round(Number(uTot.sword ?? vil.swordsTotal ?? 0))),
        axes: Math.max(0, Math.round(Number(uTot.axe ?? vil.axesTotal ?? 0))),
        archers: Math.max(0, Math.round(Number(uTot.archer ?? 0))),
        lights: Math.max(0, Math.round(Number(uTot.light ?? vil.lightsTotal ?? 0))),
        marchers: Math.max(0, Math.round(Number(uTot.marcher ?? 0))),
        heavies: Math.max(0, Math.round(Number(uTot.heavy ?? vil.heaviesTotal ?? 0))),
        knights: Math.max(0, Math.round(Number(uTot.knight ?? 0))),
        scavUnlocked: Math.max(
          0,
          Math.min(4, Number(vil.unlockedScavTiers || vil.scavData?.unlockedScavTiers || 0))
        ),
        startBoost30: Boolean(vil.boost30)
      };
    }
  }

  const startCap = getWarehouseCap(1);
  return {
    buildings: makeStarter26Buildings(),
    wStock: Math.max(0, Math.min(startCap, Math.round(Number(input.startWoodStock ?? 500)))),
    cStock: Math.max(0, Math.min(startCap, Math.round(Number(input.startClayStock ?? 500)))),
    iStock: Math.max(0, Math.min(startCap, Math.round(Number(input.startIronStock ?? 400)))),
    spears: 0,
    swords: 0,
    axes: 0,
    archers: 0,
    lights: 0,
    marchers: 0,
    heavies: 0,
    knights: 0,
    scavUnlocked: 0,
    startBoost30: false
  };
}

function normalizeInput(rawInput: TacticalStudioInput): TacticalStudioInput {
  const baseSell = Math.max(1, Number(rawInput.sellRate) || 64);
  const sellWood = Math.max(1, Number(rawInput.sellWood ?? baseSell) || baseSell);
  const sellClay = Math.max(1, Number(rawInput.sellClay ?? baseSell) || baseSell);
  const sellIron = Math.max(1, Number(rawInput.sellIron ?? baseSell) || baseSell);
  const avgSell = Math.round(((sellWood + sellClay + sellIron) / 3) * 10) / 10;
  return {
    ...rawInput,
    s1Days: Math.max(1, Math.min(60, Number(rawInput.s1Days) || 5)),
    devHours: Math.max(1, Math.min(240, Number(rawInput.devHours) || 36)),
    activeHrs: Math.max(1, Math.min(24, Number(rawInput.activeHrs) || 12)),
    scavCycleHrs: Math.max(0.5, Math.min(12, Number(rawInput.scavCycleHrs) || 3)),
    minScavCycleHrs: Math.max(0.5, Math.min(6, Number(rawInput.minScavCycleHrs ?? 2))),
    sellRate: avgSell,
    sellWood,
    sellClay,
    sellIron,
    buyRate: Math.max(1, Number(rawInput.buyRate) || 64),
    startWoodStock: Math.max(0, Math.min(1000, Math.round(Number(rawInput.startWoodStock ?? 500)))),
    startClayStock: Math.max(0, Math.min(1000, Math.round(Number(rawInput.startClayStock ?? 500)))),
    startIronStock: Math.max(0, Math.min(1000, Math.round(Number(rawInput.startIronStock ?? 400)))),
    worldSpeed: Math.max(0.1, Number(rawInput.worldSpeed) || 1),
    unitSpeed: Math.max(0.1, Number(rawInput.unitSpeed) || 1),
    boostBudgetPP: Math.max(0, Number(rawInput.boostBudgetPP) || 0),
    extraSpears: Math.max(0, Math.min(2000, Math.round(Number(rawInput.extraSpears) || 0))),
    buildingQuests: rawInput.buildingQuests !== false,
    requireSwordResearch: rawInput.requireSwordResearch !== false,
    flagPct: Math.max(0, Number(rawInput.flagPct) || 0),
    premPct: Math.max(0, Number(rawInput.premPct) || 0),
    woodBonusPct: Math.max(0, Number(rawInput.woodBonusPct) || 0),
    clayBonusPct: Math.max(0, Number(rawInput.clayBonusPct) || 0),
    ironBonusPct: Math.max(0, Number(rawInput.ironBonusPct) || 0),
    marketTargetLvl: Math.max(0, Math.min(25, Math.round(Number(rawInput.marketTargetLvl) || 0))),
    phases: {
      p2: {
        enabled: Boolean(rawInput.phases?.p2?.enabled),
        days: Math.max(1, Number(rawInput.phases?.p2?.days || 4)),
        startRate: Math.max(1, Number(rawInput.phases?.p2?.startRate || 120)),
        endRate: Math.max(1, Number(rawInput.phases?.p2?.endRate || 150))
      },
      p3: {
        enabled: Boolean(rawInput.phases?.p3?.enabled),
        days: Math.max(1, Number(rawInput.phases?.p3?.days || 5)),
        startRate: Math.max(1, Number(rawInput.phases?.p3?.startRate || 150)),
        endRate: Math.max(1, Number(rawInput.phases?.p3?.endRate || 200))
      },
      p4: {
        enabled: Boolean(rawInput.phases?.p4?.enabled),
        days: Math.max(1, Number(rawInput.phases?.p4?.days || 7)),
        startRate: Math.max(1, Number(rawInput.phases?.p4?.startRate || 200)),
        endRate: Math.max(1, Number(rawInput.phases?.p4?.endRate || 260))
      }
    }
  };
}

function buildPolicyLabel(p: Omit<TacticalStrategyPolicy, 'id' | 'label' | 'summary'>): {
  label: string;
  summary: string;
} {
  const parts: string[] = [ARCHETYPE_LABELS[p.archetype]];
  if (p.openingStyle === 'hq_first') parts.push('افتتاح رئيسي م3 أولاً');
  else if (p.openingStyle === 'quest_blitz') parts.push('اندفاع ثكنات م3 والحائط');
  else if (p.arbitrageMode === 'full_harvest') parts.push('حصاد المخابئ والحائط');
  else if (p.arbitrageMode === 'mines_only') parts.push('مناجم افتتاحية');

  if (p.resourceBias === 'iron_defer_heavy') parts.push('تأجيل حديد قوي');
  else if (p.resourceBias === 'wood_spear_focus') parts.push('أولوية خشب وتأجيل حديد');
  else if (p.resourceBias === 'clay_wood_push') parts.push('دفع خشب وطمي');

  if (p.usePaladin && p.archetype !== 'paladin_blitz' && parts.length < 3) {
    parts.push('قائد الفرسان');
  }

  const summary = `رئيسي≤${p.hqCap} · ثكنات≤${p.barracksCap} · إغارة م${p.scavTierCap} · هدف رماح ${p.spearTarget}`;
  return {
    label: parts.slice(0, 3).join(' + '),
    summary
  };
}

function buildHonestExecutedLabel(
  pol: TacticalStrategyPolicy,
  core: Pick<SingleSimCoreOutput, 'finalBuildings' | 'finalSpears' | 'finalSwords' | 'finalPaladins'>
): string {
  const barLvl = core.finalBuildings['الثكنات'] || 0;
  const parts: string[] = [];
  if (pol.archetype === 'paladin_blitz' && core.finalPaladins <= 0) {
    parts.push(ARCHETYPE_LABELS.balanced_hybrid);
  } else if (pol.archetype === 'ultra_scav_army' && core.finalSwords <= 0) {
    parts.push('جيش إغارات مكثف (رماح)');
  } else {
    parts.push(ARCHETYPE_LABELS[pol.archetype]);
  }

  if (pol.openingStyle === 'hq_first') parts.push('افتتاح رئيسي م3 أولاً');
  else if (pol.openingStyle === 'quest_blitz') {
    parts.push(barLvl >= 3 ? 'اندفاع ثكنات م3 والحائط' : 'حصاد المخابئ والحائط');
  } else if (pol.arbitrageMode === 'full_harvest') parts.push('حصاد المخابئ والحائط');
  else if (pol.arbitrageMode === 'mines_only') parts.push('مناجم افتتاحية');

  if (pol.resourceBias === 'iron_defer_heavy') parts.push('تأجيل حديد قوي');
  else if (pol.resourceBias === 'wood_spear_focus') parts.push('أولوية خشب وتأجيل حديد');
  else if (pol.resourceBias === 'clay_wood_push') parts.push('دفع خشب وطمي');

  if (core.finalPaladins > 0 && pol.archetype !== 'paladin_blitz' && parts.length < 3) {
    parts.push('قائد الفرسان');
  }
  return parts.slice(0, 3).join(' + ');
}

export function createBaselinePolicy(input: TacticalStudioInput): TacticalStrategyPolicy {
  const base: Omit<TacticalStrategyPolicy, 'id' | 'label' | 'summary'> = {
    archetype: 'balanced_hybrid',
    arbitrageMode: 'mines_only',
    openingStyle: 'mines_first',
    resourceBias: 'balanced_mines',
    arbitrageMinRate: 999,
    spearTarget: 60 + input.extraSpears,
    scavTierCap: 3,
    hqCap: 3,
    barracksCap: 2,
    usePaladin: false,
    useIronSwords: false,
    scavWeight: 1.0,
    devStopRatio: 1.0
  };
  return {
    ...base,
    id: 'baseline_classic',
    label: 'المسار التقليدي (المرجعي)',
    summary: 'افتتاح مناجم تقليدي بدون حصاد المخابئ/الحائط أو مهمة ثكنات م3 أو قائد الفرسان'
  };
}

/**
 * Generates 600+ genuinely distinct strategic scenario genomes covering:
 * - 5 strategy archetypes (Scav Rush, Balanced Hybrid, Mines Economy, Paladin Blitz, Ultra Scav Army)
 * - 3 opening philosophies (Quest Blitz Barracks L3 + Wall, Full Arbitrage Max w/ Hiding Place L4, Mines First)
 * - 3 dynamic resource shadow-price biases (Wood+Spear w/ Iron Deferral, Clay+Wood Push, Balanced)
 * - Arbitrage builder-time efficiency thresholds (testing Hiding Place L3 vs L4 vs Wall L2 vs L3!)
 * - Paladin & Iron-to-Swords toggles, HQ/Barracks ceilings, Scav tier caps, Spear targets, and cutoffs
 */
export function generateScenarioMatrix(
  input: TacticalStudioInput,
  options: { sweepDevStopRatio?: boolean; start?: ResolvedStartState } = {}
): TacticalStrategyPolicy[] {
  const policies: TacticalStrategyPolicy[] = [];
  const seen = new Set<string>();

  const startWh = options.start?.buildings?.['المخازن'] || 1;
  const startScav = options.start?.scavUnlocked || 0;
  // Scavenging Tier 4 costs 32,000 res (10k/12k/10k) and REQUIRES Warehouse 14 (14,670 cap).
  const allowTier4 =
    startScav >= 3 ||
    startWh >= 11 ||
    input.s1Days >= 10 ||
    input.worldSpeed >= 2 ||
    input.boostBudgetPP >= 400;

  const activeScavCaps: ReadonlyArray<1 | 2 | 3 | 4> = allowTier4 ? [2, 3, 4] : [1, 2, 3];

  const addPolicy = (raw: Omit<TacticalStrategyPolicy, 'id' | 'label' | 'summary'>) => {
    const spearTarget =
      input.extraSpears > 0
        ? Math.max(85 + input.extraSpears, raw.spearTarget + input.extraSpears)
        : raw.spearTarget;
    const scavTierCap =
      input.extraSpears > 0 && raw.scavTierCap === 0 ? (2 as const) : raw.scavTierCap;
    const barracksCap =
      spearTarget > 0 && raw.barracksCap === 0
        ? input.sideQuests
          ? 3
          : 2
        : raw.barracksCap;
    const key = [
      raw.archetype,
      raw.arbitrageMode,
      raw.openingStyle,
      raw.resourceBias,
      raw.arbitrageMinRate,
      spearTarget,
      scavTierCap,
      raw.hqCap,
      barracksCap,
      raw.usePaladin ? 1 : 0,
      raw.useIronSwords ? 1 : 0,
      raw.scavWeight,
      raw.devStopRatio
    ].join('|');
    if (seen.has(key)) return;
    seen.add(key);
    const built = { ...raw, spearTarget, scavTierCap, barracksCap };
    const { label, summary } = buildPolicyLabel(built);
    policies.push({
      ...built,
      id: `sc_${policies.length + 1}`,
      label,
      summary
    });
  };

  const stopRatios = options.sweepDevStopRatio ? [0.5, 0.72, 0.9, 1.0] : [0.8, 1.0];
  const isFastWorld = input.worldSpeed >= 1.5;
  const fam1Spears = isFastWorld ? [70, 140, 230] : [45, 95, 155];
  const fam2Spears = isFastWorld ? [160, 260, 380, 520] : [110, 185, 280, 400];
  const fam3HqCaps = isFastWorld ? [3, 5, 7] : [3, 5, 8];

  // Family 1: Quest Blitz, HQ3-First & Arbitrage Max across Resource Biases & Archetypes
  for (const archetype of ['scav_rush', 'balanced_hybrid', 'paladin_blitz'] as const) {
    for (const openingStyle of ['quest_blitz', 'hq_first', 'arbitrage_max'] as const) {
      for (const resourceBias of [
        'wood_spear_focus',
        'iron_defer_heavy',
        'clay_wood_push',
        'balanced_mines'
      ] as const) {
        for (const spearTarget of fam1Spears) {
          for (const scavTierCap of activeScavCaps) {
            const hqCap =
              archetype === 'balanced_hybrid'
                ? isFastWorld
                  ? 5
                  : 4
                : isFastWorld
                  ? 4
                  : 3;
            const barracksCap = spearTarget >= 150 ? (isFastWorld ? 6 : 5) : 3;
            const scavWeight =
              archetype === 'scav_rush'
                ? 1.75
                : archetype === 'paladin_blitz'
                  ? 1.45
                  : 1.05;
            addPolicy({
              archetype,
              arbitrageMode: 'full_harvest',
              openingStyle,
              resourceBias,
              arbitrageMinRate: openingStyle === 'arbitrage_max' ? 4 : 9,
              spearTarget,
              scavTierCap,
              hqCap,
              barracksCap,
              usePaladin: true,
              useIronSwords: archetype === 'balanced_hybrid' && spearTarget >= 140,
              scavWeight,
              devStopRatio: 1.0
            });
          }
        }
      }
    }
  }

  // Family 2: Ultra Scav Army + Barracks 3/5/7 + Strong Iron Deferral vs Swords
  for (const openingStyle of ['quest_blitz', 'hq_first', 'arbitrage_max'] as const) {
    for (const resourceBias of ['wood_spear_focus', 'iron_defer_heavy', 'clay_wood_push'] as const) {
      for (const spearTarget of fam2Spears) {
        for (const scavTierCap of activeScavCaps) {
          for (const barracksCap of isFastWorld ? [3, 5, 7] : [3, 5]) {
            addPolicy({
              archetype: 'ultra_scav_army',
              arbitrageMode: 'full_harvest',
              openingStyle,
              resourceBias,
              arbitrageMinRate: 5,
              spearTarget,
              scavTierCap,
              hqCap: isFastWorld ? 5 : 3,
              barracksCap,
              usePaladin: true,
              useIronSwords: true,
              scavWeight: 2.05,
              devStopRatio: 1.0
            });
          }
        }
      }
    }
  }

  // Family 3: Mines Economy (Pure mines & Hybrid-Mines w/ Hiding Place/Wall arbitrage & HQ 3/5/7)
  for (const openingStyle of ['hq_first', 'quest_blitz', 'arbitrage_max', 'mines_first'] as const) {
    for (const resourceBias of ['iron_defer_heavy', 'wood_spear_focus', 'clay_wood_push', 'balanced_mines'] as const) {
      for (const hqCap of fam3HqCaps) {
        for (const spearTarget of isFastWorld ? [0, 60, 120, 180] : [0, 40, 80, 120]) {
          const scavTierCap = spearTarget === 0 ? (0 as const) : (3 as const);
          addPolicy({
            archetype: 'mines_economy',
            arbitrageMode: openingStyle === 'mines_first' ? 'mines_only' : 'full_harvest',
            openingStyle,
            resourceBias,
            arbitrageMinRate: openingStyle === 'mines_first' ? 18 : 5,
            spearTarget,
            scavTierCap,
            hqCap,
            barracksCap: spearTarget > 0 ? 3 : 0,
            usePaladin: spearTarget > 0,
            useIronSwords: false,
            scavWeight: 0.72,
            devStopRatio: 1.0
          });
        }
      }
    }
  }

  // Family 4: Fine-Grained Arbitrage Rate, Scav Weight & Dynamic Cutoff Exploration
  for (const scavWeight of [0.85, 1.25, 1.65, 2.25]) {
    for (const arbitrageMinRate of [4, 9, 16]) {
      for (const resourceBias of ['wood_spear_focus', 'iron_defer_heavy'] as const) {
        for (const spearTarget of isFastWorld ? [90, 165, 270] : [60, 115, 195]) {
          for (const devStopRatio of stopRatios) {
            addPolicy({
              archetype: 'balanced_hybrid',
              arbitrageMode: 'full_harvest',
              openingStyle: scavWeight >= 1.5 ? 'hq_first' : 'arbitrage_max',
              resourceBias,
              arbitrageMinRate,
              spearTarget,
              scavTierCap: allowTier4 && spearTarget >= 190 ? 4 : 3,
              hqCap: isFastWorld ? 5 : 3,
              barracksCap: spearTarget >= 160 ? 5 : 3,
              usePaladin: true,
              useIronSwords: false,
              scavWeight,
              devStopRatio
            });
          }
        }
      }
    }
  }

  return policies;
}

interface SingleSimCoreOutput {
  s1NetPP: number;
  s1GrossPP: number;
  totalCumulativePP: number;
  usedBoostPP: number;
  unspentBoostPP: number;
  minePP: number;
  scavPP: number;
  mineSharePct: number;
  scavSharePct: number;
  scavRunsTotal: number;
  scavLootTotal: number;
  startPoints: number;
  endPoints: number;
  gainedPoints: number;
  finalHourlyMineProd: number;
  steadyHourlyMineProd: number;
  finalHourlyScavProd: number;
  finalHourlyTotal: number;
  finalSpears: number;
  finalSwords: number;
  finalPaladins: number;
  finalScavTier: number;
  startBuildings: Record<string, number>;
  finalBuildings: Record<string, number>;
  stages: TacticalStageResult[];
  chartPoints: TacticalSimulationResult['chartPoints'];
  steps: TacticalTimelineStep[];
  snapshots: TacticalSnapshot[];
  finalScavDispatch: ScavDispatchResult;
  dailyMinePP: number;
  dailyScavPP: number;
  dailyTotalPP: number;
  steadyDailyMinePP: number;
  steadyDailyScavPP: number;
  steadyDailyTotalPP: number;
  boost30ExtraPP: number;
  devSoldPP: number;
  loginIntervalSec: number;
  boost30ActiveStartSec: number | null;
  boost30ActiveEndSec: number | null;
  boost30ExtraRes: number;
  offlineOverflowLossRes: number;
  devOverflowLossRes: number;
  dailyMerchantCapRes: number;
  dailySellableRes: number;
  merchantBottleneckRes: number;
  dayScavRunsDev: number;
  overnightScavRunsDev: number;
  arbitrageBonusRes: number;
  effectiveDevHours: number;
  actualSummary: string;
}

interface TroopQueueItem {
  unit: 'spear' | 'sword' | 'knight';
  total: number;
  delivered: number;
  startSec: number;
  unitSec: number;
}

interface HqQueueItem {
  bName: string;
  nextLvl: number;
  startSec: number;
  finishSec: number;
  durSec: number;
  cost: { w: number; c: number; i: number; total: number };
  popDelta: number;
  triggersBarracks3Quest: boolean;
  reason: string;
}

interface ActiveScavSlot {
  tier: 1 | 2 | 3 | 4;
  returnSec: number;
  isOvernight: boolean;
  units: {
    spear: number;
    sword: number;
    knight: number;
    axe: number;
    archer: number;
    light: number;
    marcher: number;
    heavy: number;
  };
  loot: { w: number; c: number; i: number; total: number };
  sentLabel: string;
}

function evaluateSingleScenario(
  input: TacticalStudioInput,
  policy: TacticalStrategyPolicy,
  start: ResolvedStartState,
  rules: Partial<ErpGameRules> | undefined,
  scavCache: Map<string, ScavDispatchResult>,
  recordTrace: boolean
): SingleSimCoreOutput {
  const freeFinishSec = Math.max(0, Number(rules?.freeFinishSec ?? 180));
  const buildingQuestsEnabled = input.buildingQuests !== false;
  const requireSwordResearch = input.requireSwordResearch !== false;
  const sellRates = getEffectiveSellRates(input);
  const startBuildings = { ...start.buildings };
  const lvls = { ...start.buildings };
  const startPoints = calcVillagePointsFromBuildings(startBuildings);

  const s1TotalSec = Math.round(input.s1Days * 86400);
  const effectiveDevHours = Math.max(
    1,
    Math.round(input.devHours * policy.devStopRatio * 10) / 10
  );
  const devLimitSec = Math.min(s1TotalSec, Math.round(effectiveDevHours * 3600));

  let futureWeightedHours = Math.max(12, (s1TotalSec - devLimitSec) / 3600);
  if (input.optMode === 'cumulative') {
    const enabledList = [input.phases.p2, input.phases.p3, input.phases.p4].filter(
      (p) => p.enabled
    );
    for (const p of enabledList) {
      const avgR = Math.max(1, (p.startRate + p.endRate) / 2);
      futureWeightedHours += p.days * 24 * (sellRates.avg / avgR);
    }
  }

  // Daily active vs sleep schedule: active [0, activeSecPerDay) each 24h cycle; sleep [activeSecPerDay, 86400)
  const activeSecPerDay = Math.max(3600, Math.min(86400, Math.round(input.activeHrs * 3600)));
  const offlineSecPerDay = Math.max(0, 86400 - activeSecPerDay);
  const offlineHrs = offlineSecPerDay / 3600;

  const isOnlineAt = (sec: number): boolean => {
    if (offlineSecPerDay <= 0) return true;
    const mod = ((sec % 86400) + 86400) % 86400;
    return mod < activeSecPerDay - 1e-6;
  };

  const getNextWakeSec = (sec: number): number => {
    if (offlineSecPerDay <= 0 || isOnlineAt(sec)) return sec;
    const dayIdx = Math.floor(sec / 86400);
    return (dayIdx + 1) * 86400;
  };

  const getNextSleepSec = (sec: number): number | null => {
    if (offlineSecPerDay <= 0) return null;
    const dayIdx = Math.floor(sec / 86400);
    const mod = ((sec % 86400) + 86400) % 86400;
    if (mod < activeSecPerDay) {
      return dayIdx * 86400 + activeSecPerDay;
    }
    return (dayIdx + 1) * 86400 + activeSecPerDay;
  };

  const calcBuildDurWithSleep = (
    bName: string,
    nextLvl: number,
    hqLvl: number,
    startSec: number
  ): number => {
    const rawDur = calcBuildDurationSec(bName, nextLvl, hqLvl, input.worldSpeed, false, 0);
    if (!input.freeFinish || freeFinishSec <= 0) return rawDur;
    // Free finish button (-3m) can ONLY be clicked if the player is awake when <= 3m remain!
    const clickWindowSec = Math.max(startSec, startSec + rawDur - freeFinishSec);
    if (!isOnlineAt(clickWindowSec)) return rawDur;
    return Math.max(0, rawDur - freeFinishSec);
  };

  let tSec = 0;
  let barracksBusyUntilSec = 0;
  let wStock = start.wStock;
  let cStock = start.cStock;
  let iStock = start.iStock;

  // Separate READY troops (finished training), HOME troops (available in village for scavenging),
  // and TOTAL troops (ready + currently in training queue for Farm pop & targets).
  let spearsReady = start.spears;
  let swordsReady = start.swords;
  let knightsReady = start.knights;
  let spearsTotal = start.spears;
  let swordsTotal = start.swords;
  let knightsTotal = start.knights;

  let homeSpears = start.spears;
  let homeSwords = start.swords;
  let homeKnights = start.knights;
  let homeAxes = start.axes;
  let homeArchers = start.archers;
  let homeLights = start.lights;
  let homeMarchers = start.marchers;
  let homeHeavies = start.heavies;

  const axes = start.axes;
  const archers = start.archers;
  const lights = start.lights;
  const marchers = start.marchers;
  const heavies = start.heavies;
  let scavUnlocked = start.scavUnlocked;

  const hqQueue: HqQueueItem[] = [];
  const troopQueues: TroopQueueItem[] = [];
  const scavSlots: ActiveScavSlot[] = [];
  let pendingScavUnlock: { tier: 1 | 2 | 3 | 4; finishSec: number } | null = null;

  // Authentic Smithy Lv1 Sword research state
  let swordResearched =
    !requireSwordResearch ||
    start.swords > 0 ||
    (start.buildings['الحداد'] || 0) >= 2;
  let pendingSwordResearch: { finishSec: number } | null = null;

  const remBoostPP = 0;
  const usedBoostPP = 0;

  // Real 48-hour +30% Market Boost tracking (requires Market Lv 5)
  const effectiveMarketTarget = input.boost30
    ? Math.max(input.marketTargetLvl, 5)
    : input.marketTargetLvl;
  let boost30StartSec: number | null =
    input.boost30 && start.startBoost30 ? 0 : null;
  let boost30EndSec: number | null =
    boost30StartSec !== null ? boost30StartSec + BOOST30_DURATION_SEC : null;
  let cumBoost30ExtraRes = 0;
  let cumBoost30ExtraW = 0;
  let cumBoost30ExtraC = 0;
  let cumBoost30ExtraI = 0;

  // Early surplus selling during development (online-only, real merchant round-trip cooldown)
  let devSoldPP = 0;
  let devSoldRes = 0;
  const merchantTripSec = Math.max(600, Math.round(1440 / Math.max(0.5, input.worldSpeed)));
  let lastSurplusSellSec = -merchantTripSec;

  let cumMineResDev = 0;
  let cumScavResDev = 0;
  let devOverflowLossRes = 0;
  let scavRunsDev = 0;
  let dayScavRunsDev = 0;
  let overnightScavRunsDev = 0;
  let arbitrageBonusRes = 0;

  const sideQuestClaimed = new Set<string>();
  const steps: TacticalTimelineStep[] = [];
  const snapshots: TacticalSnapshot[] = [];

  const giftSpearsAmt = Math.max(0, Math.round(Number(rules?.giftSpears ?? 30)));
  const giftSwordsAmt = Math.max(0, Math.round(Number(rules?.giftSwords ?? 30)));

  const hasQueuedBarracks3Quest = () =>
    hqQueue.some((q) => q.triggersBarracks3Quest);

  const canClaimBarracks3Quest = () =>
    input.sideQuests &&
    !sideQuestClaimed.has('barracks_3') &&
    !hasQueuedBarracks3Quest() &&
    (start.buildings['الثكنات'] || 0) < 3 &&
    (giftSpearsAmt > 0 || giftSwordsAmt > 0);

  const getPlannedLevel = (bName: string): number => {
    let lvl = lvls[bName] || 0;
    for (const q of hqQueue) {
      if (q.bName === bName && q.nextLvl > lvl) lvl = q.nextLvl;
    }
    return lvl;
  };

  const getEffectiveHqAt = (sec: number): number => {
    let hq = lvls['المبنى الرئيسي'] || 1;
    for (const q of hqQueue) {
      if (q.bName === 'المبنى الرئيسي' && q.finishSec <= sec + 1e-6 && q.nextLvl > hq) {
        hq = q.nextLvl;
      }
    }
    return hq;
  };

  const isBoost30ActiveAt = (sec: number): boolean =>
    input.boost30 &&
    boost30StartSec !== null &&
    boost30EndSec !== null &&
    sec >= boost30StartSec &&
    sec < boost30EndSec;

  const getMineRatesNow = () =>
    computeMineRates(lvls, input, rules, isBoost30ActiveAt(tSec));

  const getCurrentUsedPop = () => {
    const basePop = getVillageUsedPop(lvls, {
      spear: spearsTotal,
      sword: swordsTotal,
      axe: axes,
      archer: archers,
      light: lights,
      marcher: marchers,
      heavy: heavies,
      knight: knightsTotal
    });
    let queuedPop = 0;
    for (const q of hqQueue) {
      queuedPop += q.popDelta;
      if (q.triggersBarracks3Quest) queuedPop += giftSpearsAmt + giftSwordsAmt;
    }
    return basePop + queuedPop;
  };

  const minCycleHrs = Math.max(0.5, Math.min(6, input.minScavCycleHrs ?? 2));
  const getScavCached = (sp: number, sw: number, kn: number, tiers: number): ScavDispatchResult => {
    const key = `${sp}|${sw}|${kn}|${tiers}|${minCycleHrs}`;
    const hit = scavCache.get(key);
    if (hit) return hit;
    const computed = calcScavDispatch(
      sp,
      sw,
      tiers,
      input.scavCycleHrs,
      input.activeHrs,
      input.worldSpeed,
      input.scavMode,
      1,
      axes,
      0,
      lights,
      heavies,
      archers,
      marchers,
      kn,
      minCycleHrs
    );
    scavCache.set(key, computed);
    return computed;
  };

  const getScavReadyNow = () => getScavCached(spearsReady, swordsReady, knightsReady, scavUnlocked);

  const recordSnapshot = (note: string) => {
    if (!recordTrace) return;
    const rates = getMineRatesNow();
    const sc = getScavReadyNow();
    snapshots.push({
      tSec: Math.round(tSec),
      wStock: Math.round(wStock),
      cStock: Math.round(cStock),
      iStock: Math.round(iStock),
      mineHourly: Math.round(rates.totalHr),
      scavHourly: Math.round(sc.effHourly),
      spears: spearsReady,
      note
    });
  };

  const tryActivateBoost30 = (reason: string): boolean => {
    if (!input.boost30 || boost30StartSec !== null) return false;
    if ((lvls['السوق'] || 0) < 5) return false;
    boost30StartSec = Math.round(tSec);
    boost30EndSec = boost30StartSec + BOOST30_DURATION_SEC;
    if (recordTrace) {
      steps.push({
        stepNum: steps.length + 1,
        atype: 'boost30_activate',
        bName: 'تفعيل معزز الموارد +30% (48 ساعة)',
        baseName: 'معزز +30%',
        lvl: 1,
        tStart: boost30StartSec,
        tEnd: boost30EndSec,
        buildDur: 0,
        cost: { w: 0, c: 0, i: 0 },
        rew: { w: 0, c: 0, i: 0 },
        reason
      });
      recordSnapshot('تفعيل معزز الموارد +30% (48 ساعة)');
    }
    return true;
  };

  recordSnapshot('بداية المحاكاة');

  // If starting a real village with Market >= 5 and user chose during_dev boost30, activate right away
  if (
    input.boost30 &&
    input.boostTiming === 'during_dev' &&
    boost30StartSec === null &&
    (lvls['السوق'] || 0) >= 5
  ) {
    tryActivateBoost30('تفعيل معزز +30% فوراً (السوق م5 جاهز — مدة 48 ساعة)');
  }

  // 4-independent-slot Scavenging Dispatcher (online-only + overnight wave right before sleep!)
  const scheduleScavIfIdle = () => {
    if (scavUnlocked <= 0 || tSec >= devLimitSec - 60) return;
    // Pause new dispatches strictly during sleep hours (troops returning during sleep wait at home until wake-up)
    if (!isOnlineAt(tSec)) return;

    const totalHomeUnits =
      homeSpears +
      homeSwords +
      homeKnights +
      homeAxes +
      homeArchers +
      homeLights +
      homeMarchers +
      homeHeavies;
    if (totalHomeUnits <= 0) return;

    const busyTiers = new Set<number>(scavSlots.map((s) => s.tier));
    const freeTiers: Array<1 | 2 | 3 | 4> = [];
    for (let t = 1 as 1 | 2 | 3 | 4; t <= scavUnlocked; t = (t + 1) as 1 | 2 | 3 | 4) {
      if (!busyTiers.has(t)) freeTiers.push(t);
    }
    if (freeTiers.length === 0) return;

    const dayCycleSec = Math.max(
      1800,
      Math.round((input.scavMode === 'min_logins' ? input.scavCycleHrs : minCycleHrs) * 3600)
    );
    const nextSleepSec = getNextSleepSec(tSec);
    const timeUntilSleep = nextSleepSec !== null ? nextSleepSec - tSec : Infinity;
    const isOvernightWindow =
      offlineSecPerDay > 0 &&
      timeUntilSleep > 0 &&
      timeUntilSleep <= Math.min(dayCycleSec * 0.75, 5400);

    const targetCycleSec = isOvernightWindow
      ? Math.max(dayCycleSec, Math.min(offlineSecPerDay + 3600, Math.max(dayCycleSec, offlineSecPerDay)))
      : dayCycleSec;

    const planned = planScavSlotAllocations(
      {
        sp: homeSpears,
        sw: homeSwords,
        kn: homeKnights,
        ax: homeAxes,
        ar: homeArchers,
        lc: homeLights,
        ma: homeMarchers,
        hc: homeHeavies
      },
      freeTiers,
      targetCycleSec,
      input.worldSpeed
    );

    for (const item of planned) {
      if (item.loot <= 0 || item.durSec <= 0) continue;
      const returnSec = Math.round(tSec + item.durSec);
      // Do not launch daytime runs that extend past s1TotalSec; allow overnight runs finishing after devLimitSec to credit S1 harvest
      if (returnSec > s1TotalSec) continue;
      const crossesIntoSleep = nextSleepSec !== null && returnSec > nextSleepSec + 60;
      if (!crossesIntoSleep && returnSec > devLimitSec + 7200) continue;

      homeSpears = Math.max(0, homeSpears - item.sp);
      homeSwords = Math.max(0, homeSwords - item.sw);
      homeKnights = Math.max(0, homeKnights - item.kn);
      homeAxes = Math.max(0, homeAxes - item.ax);
      homeArchers = Math.max(0, homeArchers - item.ar);
      homeLights = Math.max(0, homeLights - item.lc);
      homeMarchers = Math.max(0, homeMarchers - item.ma);
      homeHeavies = Math.max(0, homeHeavies - item.hc);

      const lootW = Math.floor(item.loot / 3);
      const lootC = Math.floor(item.loot / 3);
      const lootI = Math.max(0, item.loot - lootW - lootC);

      const labelParts: string[] = [];
      if (item.sp > 0) labelParts.push(`${item.sp} رمح`);
      if (item.sw > 0) labelParts.push(`${item.sw} سيف`);
      if (item.kn > 0) labelParts.push('قائد');
      if (item.ax + item.ar + item.lc + item.ma + item.hc > 0) {
        labelParts.push(`${item.ax + item.ar + item.lc + item.ma + item.hc} أخرى`);
      }

      scavSlots.push({
        tier: item.tier,
        returnSec,
        isOvernight: crossesIntoSleep,
        units: {
          spear: item.sp,
          sword: item.sw,
          knight: item.kn,
          axe: item.ax,
          archer: item.ar,
          light: item.lc,
          marcher: item.ma,
          heavy: item.hc
        },
        loot: {
          w: lootW,
          c: lootC,
          i: lootI,
          total: item.loot
        },
        sentLabel: `${labelParts.join(' · ')} [م${item.tier}${crossesIntoSleep ? ' ليلي' : ''}]`
      });
    }
  };

  const getEarliestScavReturnSec = (): number | null => {
    let earliest: number | null = null;
    for (const slot of scavSlots) {
      if (earliest === null || slot.returnSec < earliest) earliest = slot.returnSec;
    }
    return earliest;
  };

  const deliverCompletedTroopsUpTo = (nowSec: number): boolean => {
    let anyDelivered = false;
    for (let idx = troopQueues.length - 1; idx >= 0; idx--) {
      const q = troopQueues[idx];
      if (nowSec < q.startSec + q.unitSec) continue;
      const shouldDeliver = Math.min(
        q.total,
        Math.floor((nowSec - q.startSec + 1e-6) / Math.max(1, q.unitSec))
      );
      const delta = shouldDeliver - q.delivered;
      if (delta > 0) {
        q.delivered = shouldDeliver;
        if (q.unit === 'spear') {
          spearsReady += delta;
          homeSpears += delta;
        } else if (q.unit === 'sword') {
          swordsReady += delta;
          homeSwords += delta;
        } else if (q.unit === 'knight') {
          knightsReady += delta;
          homeKnights += delta;
        }
        anyDelivered = true;
      }
      if (q.delivered >= q.total) {
        troopQueues.splice(idx, 1);
      }
    }
    return anyDelivered;
  };

  const getNextTroopDeliverySec = (): number | null => {
    let earliest: number | null = null;
    for (const q of troopQueues) {
      if (q.delivered >= q.total) continue;
      const nextCount = q.unit === 'knight' ? q.total : Math.min(q.total, q.delivered + 5);
      const nextSec = q.startSec + nextCount * q.unitSec;
      if (earliest === null || nextSec < earliest) earliest = nextSec;
    }
    return earliest;
  };

  const completeHqItem = (item: HqQueueItem) => {
    lvls[item.bName] = item.nextLvl;
    const rew = calcBuildReward(item.cost, rules, buildingQuestsEnabled);
    const newCap = getWarehouseCap(lvls['المخازن'] || 1);
    const oldW = wStock;
    const oldC = cStock;
    const oldI = iStock;
    wStock = Math.min(newCap, wStock + rew.w);
    cStock = Math.min(newCap, cStock + rew.c);
    iStock = Math.min(newCap, iStock + rew.i);
    const rewOverflow =
      Math.max(0, oldW + rew.w - newCap) +
      Math.max(0, oldC + rew.c - newCap) +
      Math.max(0, oldI + rew.i - newCap);
    devOverflowLossRes += rewOverflow;
    const actualRewTotal = (wStock - oldW) + (cStock - oldC) + (iStock - oldI);
    const actualNetGain = actualRewTotal - item.cost.total;
    if (actualNetGain > 0) arbitrageBonusRes += actualNetGain;

    if (recordTrace) {
      recordSnapshot(`اكتمال ${item.bName} م${item.nextLvl}`);
    }

    // Authentic Barracks Lv3 Quest ONLY (+30 Spears +30 Swords, NO fabricated extra resources!)
    if (item.triggersBarracks3Quest && !sideQuestClaimed.has('barracks_3')) {
      sideQuestClaimed.add('barracks_3');
      spearsReady += giftSpearsAmt;
      spearsTotal += giftSpearsAmt;
      homeSpears += giftSpearsAmt;
      swordsReady += giftSwordsAmt;
      swordsTotal += giftSwordsAmt;
      homeSwords += giftSwordsAmt;
      if (recordTrace) {
        recordSnapshot(`مكافأة مهمة الثكنات م3: +${giftSpearsAmt} رمح +${giftSwordsAmt} سيف مجاني!`);
      }
      scheduleScavIfIdle();
    }

    if (
      item.bName === 'السوق' &&
      item.nextLvl >= 5 &&
      input.boost30 &&
      input.boostTiming === 'during_dev' &&
      boost30StartSec === null
    ) {
      tryActivateBoost30('تفعيل معزز +30% فور بلوغ السوق م5 أثناء التطوير (مدة 48 ساعة)');
    }
  };

  const advanceTimeTo = (targetSec: number) => {
    if (targetSec <= tSec) {
      while (hqQueue.length > 0 && tSec + 1e-6 >= hqQueue[0].finishSec) {
        const done = hqQueue.shift()!;
        completeHqItem(done);
      }
      deliverCompletedTroopsUpTo(tSec);
      if (pendingScavUnlock !== null && tSec + 1e-6 >= pendingScavUnlock.finishSec) {
        scavUnlocked = pendingScavUnlock.tier;
        pendingScavUnlock = null;
        if (recordTrace) {
          recordSnapshot(`اكتمل فتح الإغارة م${scavUnlocked}`);
        }
        scheduleScavIfIdle();
      }
      if (pendingSwordResearch !== null && tSec + 1e-6 >= pendingSwordResearch.finishSec) {
        swordResearched = true;
        pendingSwordResearch = null;
        if (recordTrace) {
          recordSnapshot('اكتمل بحث مقاتل السيف في الحداد');
        }
      }
      return;
    }

    for (let guard = 0; guard < 360 && tSec < targetSec; guard++) {
      let nextEv = targetSec;

      if (hqQueue.length > 0 && hqQueue[0].finishSec <= nextEv && hqQueue[0].finishSec <= devLimitSec) {
        nextEv = hqQueue[0].finishSec;
      }

      if (
        pendingScavUnlock !== null &&
        pendingScavUnlock.finishSec <= nextEv &&
        pendingScavUnlock.finishSec <= devLimitSec
      ) {
        nextEv = pendingScavUnlock.finishSec;
      }

      if (
        pendingSwordResearch !== null &&
        pendingSwordResearch.finishSec <= nextEv &&
        pendingSwordResearch.finishSec <= devLimitSec
      ) {
        nextEv = pendingSwordResearch.finishSec;
      }

      const nextTroopSec = getNextTroopDeliverySec();
      if (nextTroopSec !== null && nextTroopSec <= nextEv && nextTroopSec <= devLimitSec) {
        nextEv = nextTroopSec;
      }

      const nextScavRet = getEarliestScavReturnSec();
      if (nextScavRet !== null && nextScavRet <= nextEv && nextScavRet <= devLimitSec) {
        nextEv = nextScavRet;
      }

      // If asleep and troops are waiting at home (or scav unlocked), wake up cleanly at day start to dispatch!
      if (!isOnlineAt(tSec) && scavUnlocked > 0) {
        const wakeSec = getNextWakeSec(tSec);
        if (wakeSec > tSec && wakeSec < nextEv && wakeSec <= devLimitSec) {
          nextEv = wakeSec;
        }
      }

      if (
        boost30EndSec !== null &&
        boost30EndSec > tSec &&
        boost30EndSec < nextEv &&
        boost30EndSec <= devLimitSec
      ) {
        nextEv = boost30EndSec;
      }

      if (nextEv > tSec) {
        const dtHrs = (nextEv - tSec) / 3600;
        const boostNow = isBoost30ActiveAt(tSec + 1e-3);
        const rates = computeMineRates(lvls, input, rules, boostNow);
        const baseRates = boostNow ? computeMineRates(lvls, input, rules, false) : rates;
        const cap = getWarehouseCap(lvls['المخازن'] || 1);
        const oldW = wStock;
        const oldC = cStock;
        const oldI = iStock;
        const rawAddW = rates.wHr * dtHrs;
        const rawAddC = rates.cHr * dtHrs;
        const rawAddI = rates.iHr * dtHrs;
        wStock = Math.min(cap, wStock + rawAddW);
        cStock = Math.min(cap, cStock + rawAddC);
        iStock = Math.min(cap, iStock + rawAddI);
        const actualAddW = wStock - oldW;
        const actualAddC = cStock - oldC;
        const actualAddI = iStock - oldI;
        const actualAdded = actualAddW + actualAddC + actualAddI;
        devOverflowLossRes += Math.max(0, rawAddW + rawAddC + rawAddI - actualAdded);
        cumMineResDev += actualAdded;
        if (boostNow) {
          const exW = Math.max(0, actualAddW - Math.min(actualAddW, baseRates.wHr * dtHrs));
          const exC = Math.max(0, actualAddC - Math.min(actualAddC, baseRates.cHr * dtHrs));
          const exI = Math.max(0, actualAddI - Math.min(actualAddI, baseRates.iHr * dtHrs));
          cumBoost30ExtraW += exW;
          cumBoost30ExtraC += exC;
          cumBoost30ExtraI += exI;
          cumBoost30ExtraRes += exW + exC + exI;
        }
        tSec = nextEv;
      }

      // 1. Flush completed HQ items at tSec
      while (hqQueue.length > 0 && tSec + 1e-6 >= hqQueue[0].finishSec) {
        const done = hqQueue.shift()!;
        completeHqItem(done);
      }

      // 2. Flush completed troop deliveries
      const deliveredNow = deliverCompletedTroopsUpTo(tSec);

      // 3. Flush completed Scav unlock
      if (pendingScavUnlock !== null && tSec + 1e-6 >= pendingScavUnlock.finishSec) {
        scavUnlocked = pendingScavUnlock.tier;
        pendingScavUnlock = null;
        if (recordTrace) {
          recordSnapshot(`اكتمل فتح الإغارة م${scavUnlocked}`);
        }
        scheduleScavIfIdle();
      }

      // 4. Flush completed Smithy Sword research
      if (pendingSwordResearch !== null && tSec + 1e-6 >= pendingSwordResearch.finishSec) {
        swordResearched = true;
        pendingSwordResearch = null;
        if (recordTrace) {
          recordSnapshot('اكتمل بحث مقاتل السيف في الحداد');
        }
      }

      // 5. Flush all returning scavenging slots at tSec
      let anyScavReturned = false;
      for (let si = scavSlots.length - 1; si >= 0; si--) {
        if (tSec + 1e-6 >= scavSlots[si].returnSec) {
          const slot = scavSlots.splice(si, 1)[0];
          homeSpears += slot.units.spear;
          homeSwords += slot.units.sword;
          homeKnights += slot.units.knight;
          homeAxes += slot.units.axe;
          homeArchers += slot.units.archer;
          homeLights += slot.units.light;
          homeMarchers += slot.units.marcher;
          homeHeavies += slot.units.heavy;

          const cap = getWarehouseCap(lvls['المخازن'] || 1);
          const oldW = wStock;
          const oldC = cStock;
          const oldI = iStock;
          wStock = Math.min(cap, wStock + slot.loot.w);
          cStock = Math.min(cap, cStock + slot.loot.c);
          iStock = Math.min(cap, iStock + slot.loot.i);
          const actualLoot = (wStock - oldW) + (cStock - oldC) + (iStock - oldI);
          devOverflowLossRes += Math.max(0, slot.loot.total - actualLoot);
          cumScavResDev += actualLoot;
          scavRunsDev += 1;
          if (slot.isOvernight) overnightScavRunsDev += 1;
          else dayScavRunsDev += 1;
          anyScavReturned = true;

          if (recordTrace) {
            steps.push({
              stepNum: steps.length + 1,
              atype: 'scav_return',
              bName: `عودة إرسالية الإغارة #${scavRunsDev}`,
              baseName: 'الإغارة',
              lvl: slot.tier,
              tStart: Math.round(tSec),
              tEnd: Math.round(tSec),
              buildDur: 0,
              cost: { w: 0, c: 0, i: 0 },
              rew: {
                w: Math.round(wStock - oldW),
                c: Math.round(cStock - oldC),
                i: Math.round(iStock - oldI)
              },
              reason: `غنيمة إغارة (${Math.round(actualLoot).toLocaleString('en-US')} مورد · ${slot.sentLabel})`
            });
            recordSnapshot(`عودة إغارة #${scavRunsDev}`);
          }
        }
      }

      if (deliveredNow || anyScavReturned || isOnlineAt(tSec)) {
        scheduleScavIfIdle();
      }

      if (tSec + 1e-6 >= targetSec) break;
    }
  };

  const trySellDevSurplus = (reserve?: { w: number; c: number; i: number }) => {
    const mkt = lvls['السوق'] || 0;
    if (tSec <= 0 || mkt < 1 || !isOnlineAt(tSec) || tSec - lastSurplusSellSec < merchantTripSec) return;
    const cap = getWarehouseCap(lvls['المخازن'] || 1);
    const merchants = MARKET_MERCHANTS[Math.min(25, mkt)] || 0;
    if (merchants <= 0) return;
    let remMerchantCap = merchants * 1000;
    const sellThreshold = cap * 0.88;
    const keepFloorBase = cap * 0.55;

    // Prioritize resources by best PP/resource (lowest sell rate), protecting any planned reserve
    const order: Array<{ key: 'w' | 'c' | 'i'; rate: number }> = (
      [
        { key: 'i', rate: sellRates.i },
        { key: 'c', rate: sellRates.c },
        { key: 'w', rate: sellRates.w }
      ] as Array<{ key: 'w' | 'c' | 'i'; rate: number }>
    ).sort((a, b) => a.rate - b.rate);

    let soldW = 0;
    let soldC = 0;
    let soldI = 0;
    let earnedPP = 0;

    for (const entry of order) {
      if (remMerchantCap < entry.rate) continue;
      const curStock = entry.key === 'w' ? wStock : entry.key === 'c' ? cStock : iStock;
      const resKeep = Math.max(
        keepFloorBase,
        reserve ? (entry.key === 'w' ? reserve.w : entry.key === 'c' ? reserve.c : reserve.i) : 0
      );
      if (curStock < sellThreshold) continue;
      const avail = Math.min(remMerchantCap, Math.max(0, curStock - resKeep));
      const ppChunks = Math.floor(avail / entry.rate);
      if (ppChunks >= 1) {
        const soldAmt = ppChunks * entry.rate;
        if (entry.key === 'w') {
          soldW = soldAmt;
          wStock -= soldAmt;
        } else if (entry.key === 'c') {
          soldC = soldAmt;
          cStock -= soldAmt;
        } else {
          soldI = soldAmt;
          iStock -= soldAmt;
        }
        remMerchantCap -= soldAmt;
        earnedPP += ppChunks;
      }
    }

    const totalSold = soldW + soldC + soldI;
    if (earnedPP >= 1 && totalSold > 0) {
      devSoldRes += totalSold;
      devSoldPP += earnedPP;
      lastSurplusSellSec = tSec;
      if (recordTrace) {
        steps.push({
          stepNum: steps.length + 1,
          atype: 'sell_surplus',
          bName: `بيع فائض مبكر (+${Math.round(earnedPP)} نقطة)`,
          baseName: 'السوق',
          lvl: mkt,
          tStart: Math.round(tSec),
          tEnd: Math.round(tSec),
          buildDur: 0,
          cost: { w: Math.round(soldW), c: Math.round(soldC), i: Math.round(soldI) },
          rew: { w: 0, c: 0, i: 0 },
          reason: `تصريف فائض قبل امتلاء المخزن (${Math.round(totalSold).toLocaleString('en-US')} مورد)`
        });
      }
    }
  };

  const waitUntilAffordable = (cost: { w: number; c: number; i: number }): boolean => {
    const cap = getWarehouseCap(lvls['المخازن'] || 1);
    if (cost.w > cap || cost.c > cap || cost.i > cap) return false;

    for (let retry = 0; retry < 18; retry++) {
      if (wStock + 1e-6 >= cost.w && cStock + 1e-6 >= cost.c && iStock + 1e-6 >= cost.i) {
        return true;
      }
      const rates = getMineRatesNow();
      const waitW = wStock >= cost.w ? 0 : (cost.w - wStock) / Math.max(1, rates.wHr);
      const waitC = cStock >= cost.c ? 0 : (cost.c - cStock) / Math.max(1, rates.cHr);
      const waitI = iStock >= cost.i ? 0 : (cost.i - iStock) / Math.max(1, rates.iHr);
      const waitSec = Math.ceil(Math.max(waitW, waitC, waitI) * 3600);

      const earliestScav = getEarliestScavReturnSec();
      const earliestHq = hqQueue.length > 0 ? hqQueue[0].finishSec : null;
      const earliestEvent = Math.min(
        earliestScav !== null && earliestScav > tSec ? earliestScav : Infinity,
        earliestHq !== null && earliestHq > tSec ? earliestHq : Infinity
      );

      if (tSec + waitSec > devLimitSec) {
        if (Number.isFinite(earliestEvent) && earliestEvent <= devLimitSec) {
          advanceTimeTo(earliestEvent);
          continue;
        }
        return false;
      }

      const target =
        Number.isFinite(earliestEvent) && earliestEvent < tSec + waitSec
          ? earliestEvent
          : tSec + waitSec;
      advanceTimeTo(target);
    }
    return wStock + 1e-6 >= cost.w && cStock + 1e-6 >= cost.c && iStock + 1e-6 >= cost.i;
  };

  const flushHqUntilSlotFree = (): boolean => {
    if (hqQueue.length < 2) return true;
    const nextFinish = hqQueue[0].finishSec;
    if (nextFinish > devLimitSec) return false;
    advanceTimeTo(nextFinish);
    return hqQueue.length < 2;
  };

  const flushHqWhileBuildingInQueue = (bName: string): boolean => {
    while (hqQueue.some((q) => q.bName === bName)) {
      const nextFinish = hqQueue[0].finishSec;
      if (nextFinish > devLimitSec) return false;
      advanceTimeTo(nextFinish);
    }
    return true;
  };

  const executeBuild = (
    bName: string,
    reason: string,
    depth: number = 0,
    waitForCompletion: boolean = false
  ): boolean => {
    if (depth > 8) return false;
    const def = BUILDINGS_DATA[bName];
    if (!def) return false;

    // Wait if HQ already has 2 queued items
    if (!flushHqUntilSlotFree()) return false;

    // If a prerequisite building is currently in HQ queue, wait for it to finish cleanly
    if (!checkBuildingPrerequisites(bName, lvls)) {
      if (hqQueue.length > 0) {
        const nextFin = hqQueue[0].finishSec;
        if (nextFin <= devLimitSec) {
          advanceTimeTo(nextFin);
        }
      }
      if (!checkBuildingPrerequisites(bName, lvls)) return false;
    }

    const nextLvl = getPlannedLevel(bName) + 1;
    if (nextLvl > def.max_lvl) return false;

    const cost = getBuildingLevelCost(bName, nextLvl);
    const estQueueStart = hqQueue.length > 0 ? Math.max(tSec, hqQueue[hqQueue.length - 1].finishSec) : tSec;
    const estHqAtStart = getEffectiveHqAt(estQueueStart);
    const targetDurSec = calcBuildDurWithSleep(bName, nextLvl, estHqAtStart, estQueueStart);

    // 1. Pre-flight check: Warehouse capacity chain (avoid partial wasted WH upgrades!)
    const curWhCompleted = lvls['المخازن'] || 1;
    const reqWh = getMinWarehouseLevelForCost(cost);
    if (reqWh > curWhCompleted) {
      if (bName === 'المخازن') return false;
      // First flush any Warehouse already building in HQ queue
      if (!flushHqWhileBuildingInQueue('المخازن')) return false;
      const whNow = lvls['المخازن'] || 1;
      if (reqWh > whNow) {
        const whChain = getWarehouseUpgradeChainStats(
          whNow,
          reqWh,
          lvls['المبنى الرئيسي'] || 1,
          input.worldSpeed,
          input.freeFinish,
          freeFinishSec,
          rules,
          buildingQuestsEnabled
        );
        if (tSec + whChain.totalDurSec + targetDurSec > devLimitSec) return false;
        while ((lvls['المخازن'] || 1) < reqWh) {
          const nxtWh = (lvls['المخازن'] || 1) + 1;
          const ok = executeBuild(
            'المخازن',
            `توسيع المخزن م${nxtWh} (${getWarehouseCap(nxtWh).toLocaleString('en-US')} مورد) لـ ${bName} م${nextLvl}`,
            depth + 1,
            true
          );
          if (!ok) return false;
        }
      }
    }

    // 2. Pre-flight check: Exact Farm population delta (including Barracks L3 quest +30sp/+30sw!)
    const popDelta = getBuildingPopDelta(bName, nextLvl);
    const willTriggerBarracks3 = bName === 'الثكنات' && nextLvl === 3 && canClaimBarracks3Quest();
    if (bName !== 'المزارع') {
      const questPopExtra = willTriggerBarracks3 ? giftSpearsAmt + giftSwordsAmt : 0;
      const usedPop = getCurrentUsedPop();
      const reqFarm = getMinFarmLevelForPop(usedPop + popDelta + questPopExtra);
      if (reqFarm > (lvls['المزارع'] || 1)) {
        if (!flushHqWhileBuildingInQueue('المزارع')) return false;
        const farmNow = lvls['المزارع'] || 1;
        if (reqFarm > farmNow) {
          let farmDur = 0;
          for (let fl = farmNow + 1; fl <= reqFarm; fl++) {
            farmDur += calcBuildDurationSec(
              'المزارع',
              fl,
              lvls['المبنى الرئيسي'] || 1,
              input.worldSpeed,
              input.freeFinish,
              freeFinishSec
            );
          }
          if (tSec + farmDur + targetDurSec > devLimitSec) return false;
          while ((lvls['المزارع'] || 1) < reqFarm) {
            const nxtFarm = (lvls['المزارع'] || 1) + 1;
            const ok = executeBuild(
              'المزارع',
              `توسيع المزارع م${nxtFarm} لتوفير السكان (+${popDelta + questPopExtra} لـ ${bName} م${nextLvl})`,
              depth + 1,
              true
            );
            if (!ok) return false;
          }
        }
      }
    }

    // Re-check HQ slot & nextLvl after any recursive WH/Farm completions
    if (!flushHqUntilSlotFree()) return false;
    if (!checkBuildingPrerequisites(bName, lvls)) return false;
    const finalNextLvl = getPlannedLevel(bName) + 1;
    if (finalNextLvl !== nextLvl) return false;

    if (!waitUntilAffordable(cost)) return false;

    // Re-check HQ slot after waiting for resources (earlier queued items may have finished!)
    if (!flushHqUntilSlotFree()) return false;
    if (getPlannedLevel(bName) + 1 !== nextLvl) return false;

    const queueStart =
      hqQueue.length > 0 ? Math.max(tSec, hqQueue[hqQueue.length - 1].finishSec) : tSec;
    const hqAtStart = getEffectiveHqAt(queueStart);
    const durSec = calcBuildDurWithSleep(bName, nextLvl, hqAtStart, queueStart);
    const finishSec = queueStart + durSec;
    if (finishSec > devLimitSec) return false;

    const tStart = Math.round(queueStart);
    wStock = Math.max(0, wStock - cost.w);
    cStock = Math.max(0, cStock - cost.c);
    iStock = Math.max(0, iStock - cost.i);

    const rew = calcBuildReward(cost, rules, buildingQuestsEnabled);
    const triggeredBarracks3 = bName === 'الثكنات' && nextLvl === 3 && canClaimBarracks3Quest();
    const displayReason = triggeredBarracks3
      ? `${reason} (+${giftSpearsAmt} رمح +${giftSwordsAmt} سيف من مكافأة المهمة!)`
      : reason;

    const item: HqQueueItem = {
      bName,
      nextLvl,
      startSec: tStart,
      finishSec: Math.round(finishSec),
      durSec,
      cost,
      popDelta,
      triggersBarracks3Quest: triggeredBarracks3,
      reason: displayReason
    };
    hqQueue.push(item);

    if (recordTrace) {
      steps.push({
        stepNum: steps.length + 1,
        atype: 'bldg',
        bName: `${bName} (م${nextLvl})`,
        baseName: bName,
        lvl: nextLvl,
        tStart,
        tEnd: Math.round(finishSec),
        buildDur: durSec,
        cost: { w: cost.w, c: cost.c, i: cost.i },
        rew,
        reason: displayReason
      });
    }

    // Instant free-finish builds (durSec === 0) or explicitly blocking prereqs complete immediately;
    // otherwise return WITHOUT advancing tSec so Barracks / Statue / Smithy / Scav / HQ Slot 2 run in PARALLEL!
    if (waitForCompletion || (hqQueue.length === 1 && durSec <= 0)) {
      advanceTimeTo(finishSec);
    }

    return true;
  };

  /**
   * Checks strict mechanical + economic viability of unlocking Scavenging Tier `tier`:
   * - Requires Rally Point >= 1, sequential unlock (scavUnlocked === tier - 1), and no unlock already running
   * - Computes FULL Warehouse upgrade chain cost & build time (e.g., Tier 4 requires WH 14 = 14,670 cap!)
   * - Uses REAL parallel research duration (30s / 1h / 3h / 6h scaled by worldSpeed)
   * - Never wastes a single Warehouse upgrade if full chain + unlock cannot fit or pay back!
   */
  const executeScavUnlock = (tier: 1 | 2 | 3 | 4, requirePositiveRoi: boolean = false): boolean => {
    if (scavUnlocked >= tier) return true;
    if (pendingScavUnlock !== null) return false;
    if (tier !== scavUnlocked + 1) return false;
    if ((lvls['نقطة التجمع'] || 0) < 1) return false;

    const cfg = SCAV_UNLOCK_DATA[String(tier)];
    if (!cfg) return false;
    const cost = { w: cfg.wood, c: cfg.clay, i: cfg.iron };
    const unlockDur = Math.max(10, Math.round(cfg.sec / Math.max(0.1, input.worldSpeed)));
    const curWh = lvls['المخازن'] || 1;
    const reqWh = getMinWarehouseLevelForCost(cost);
    const whChain = getWarehouseUpgradeChainStats(
      curWh,
      reqWh,
      lvls['المبنى الرئيسي'] || 1,
      input.worldSpeed,
      input.freeFinish,
      freeFinishSec,
      rules,
      buildingQuestsEnabled
    );

    // Must be able to finish required WH upgrades AND complete research before devLimitSec
    if (tSec + whChain.totalDurSec + unlockDur > devLimitSec) return false;

    // Estimate realistic time to gather resources for WH chain + unlock
    const curRates = getMineRatesNow();
    const curScav = getScavReadyNow();
    const totalIncomeHr = Math.max(30, curRates.totalHr + curScav.effHourly);
    const totalCostRes = cfg.wood + cfg.clay + cfg.iron + whChain.netResCost;
    const estGatherSec = Math.max(
      0,
      ((totalCostRes - (wStock + cStock + iStock) - remBoostPP * input.buyRate) / totalIncomeHr) * 3600
    );
    if (tSec + whChain.totalDurSec + estGatherSec + unlockDur > devLimitSec) return false;

    const armyHaulNowCheck =
      spearsTotal * 25 +
      swordsTotal * 15 +
      knightsTotal * 100 +
      axes * 10 +
      archers * 10 +
      lights * 80 +
      marchers * 50 +
      heavies * 50;
    const minHaulForTier = tier === 4 ? 3200 : tier === 3 ? 1150 : tier === 2 ? 450 : 0;
    if (tier >= 2 && armyHaulNowCheck < minHaulForTier) return false;

    if (requirePositiveRoi) {
      const curAtArmy = getScavCached(spearsTotal, swordsTotal, knightsTotal, scavUnlocked);
      const nextAtArmy = getScavCached(spearsTotal, swordsTotal, knightsTotal, tier);
      const deltaScavHr = Math.max(0, nextAtArmy.effHourly - curAtArmy.effHourly);
      const remDevHrs = Math.max(0, (devLimitSec - tSec) / 3600);
      const earningHrsAfterUnlock = Math.max(
        0,
        remDevHrs + futureWeightedHours - (whChain.totalDurSec + unlockDur) / 3600
      );
      if (deltaScavHr <= 0 || earningHrsAfterUnlock <= 4) return false;
      const roi = (deltaScavHr * earningHrsAfterUnlock * policy.scavWeight - totalCostRes) / Math.max(1, totalCostRes);
      if (roi <= 0.18) return false;
    }

    // Upgrade Warehouse sequentially up to reqWh (blocking wait so WH cap covers unlock cost)
    if ((lvls['المخازن'] || 1) < reqWh) {
      if (!flushHqWhileBuildingInQueue('المخازن')) return false;
      while ((lvls['المخازن'] || 1) < reqWh) {
        const nxtWh = (lvls['المخازن'] || 1) + 1;
        const whOk = executeBuild(
          'المخازن',
          `توسيع المخزن م${nxtWh} (${getWarehouseCap(nxtWh).toLocaleString('en-US')} مورد) لفتح الإغارة ${tier}`,
          0,
          true
        );
        if (!whOk) return false;
      }
    }

    // Hard safety guard: Warehouse cap MUST cover every resource cost
    const finalCap = getWarehouseCap(lvls['المخازن'] || 1);
    if (cost.w > finalCap || cost.c > finalCap || cost.i > finalCap) return false;

    if (!waitUntilAffordable(cost)) return false;
    if (tSec + unlockDur > devLimitSec) return false;

    const tStart = Math.round(tSec);
    wStock = Math.max(0, wStock - cost.w);
    cStock = Math.max(0, cStock - cost.c);
    iStock = Math.max(0, iStock - cost.i);

    // Parallel scavenging unlock: does NOT freeze HQ building! Completes at tStart + unlockDur.
    const finishSec = tStart + unlockDur;
    pendingScavUnlock = { tier, finishSec };

    if (recordTrace) {
      steps.push({
        stepNum: steps.length + 1,
        atype: 'scav_unlock',
        bName: cfg.name,
        baseName: `إغارة ${tier}`,
        lvl: tier,
        tStart,
        tEnd: finishSec,
        buildDur: unlockDur,
        cost,
        rew: { w: 0, c: 0, i: 0 },
        reason: `رفع كفاءة الإغارة إلى ${Math.round(cfg.lf * 100)}% (بحث متوازٍ ${Math.round(unlockDur / 60)} د · مخزن م${lvls['المخازن'] || 1})`
      });
      recordSnapshot(`بدء فتح إغارة م${tier}`);
    }

    if (unlockDur <= 60) {
      advanceTimeTo(finishSec);
    }
    return true;
  };

  const executeTrainPaladin = (): boolean => {
    if (knightsTotal >= 1) return true;
    if ((lvls['النصب التذكاري'] || 0) < 1) {
      if (!flushHqWhileBuildingInQueue('النصب التذكاري')) return false;
      if ((lvls['النصب التذكاري'] || 0) < 1) {
        if (
          !executeBuild(
            'النصب التذكاري',
            'بناء النصب التذكاري لتعيين قائد الفرسان (+100 حمولة)',
            0,
            true
          )
        ) {
          return false;
        }
      }
    }
    const usedPop = getCurrentUsedPop();
    const reqFarm = getMinFarmLevelForPop(usedPop + 10);
    if ((lvls['المزارع'] || 1) < reqFarm) {
      if (!flushHqWhileBuildingInQueue('المزارع')) return false;
      while ((lvls['المزارع'] || 1) < reqFarm) {
        if (
          !executeBuild(
            'المزارع',
            `توسيع المزارع م${(lvls['المزارع'] || 1) + 1} لتعيين قائد الفرسان`,
            0,
            true
          )
        ) {
          return false;
        }
      }
    }

    const cost = { w: 20, c: 20, i: 40 };
    if (!waitUntilAffordable(cost)) return false;

    // First Paladin takes 10 minutes on modern skill worlds (scales by worldSpeed), trained in parallel at Statue
    const trainDur = Math.max(60, Math.round(600 / Math.max(0.1, input.worldSpeed)));
    const tStart = Math.round(tSec);
    if (tStart + trainDur > devLimitSec) return false;

    wStock = Math.max(0, wStock - cost.w);
    cStock = Math.max(0, cStock - cost.c);
    iStock = Math.max(0, iStock - cost.i);

    knightsTotal = 1;
    troopQueues.push({
      unit: 'knight',
      total: 1,
      delivered: 0,
      startSec: tStart,
      unitSec: trainDur
    });

    if (recordTrace) {
      steps.push({
        stepNum: steps.length + 1,
        atype: 'train_paladin',
        bName: 'تعيين قائد الفرسان (حمولة 100)',
        baseName: 'قائد الفرسان',
        lvl: 1,
        tStart,
        tEnd: tStart + trainDur,
        buildDur: trainDur,
        cost,
        rew: { w: 0, c: 0, i: 0 },
        reason: 'أرخص 100 حمولة إغارة في اللعبة (تكلفة 80 مورد فقط = يعادل 4 رماح)'
      });
      recordSnapshot('بدء تعيين قائد الفرسان (+100 حمولة)');
    }
    return true;
  };

  const executeResearchSword = (): boolean => {
    if (swordResearched) return true;
    if (pendingSwordResearch !== null) return false;
    if ((lvls['الحداد'] || 0) < 1) return false;

    const cost = { w: SWORD_RESEARCH_COST.w, c: SWORD_RESEARCH_COST.c, i: SWORD_RESEARCH_COST.i };
    const reqWh = getMinWarehouseLevelForCost(cost);
    if ((lvls['المخازن'] || 1) < reqWh) {
      if (!flushHqWhileBuildingInQueue('المخازن')) return false;
      while ((lvls['المخازن'] || 1) < reqWh) {
        const nxtWh = (lvls['المخازن'] || 1) + 1;
        if (
          !executeBuild(
            'المخازن',
            `توسيع المخزن م${nxtWh} لبحث مقاتل السيف في الحداد`,
            0,
            true
          )
        ) {
          return false;
        }
      }
    }

    const researchDur = Math.max(60, Math.round(SWORD_RESEARCH_BASE_SEC / Math.max(0.1, input.worldSpeed)));
    if (!waitUntilAffordable(cost)) return false;
    if (tSec + researchDur > devLimitSec) return false;

    const tStart = Math.round(tSec);
    wStock = Math.max(0, wStock - cost.w);
    cStock = Math.max(0, cStock - cost.c);
    iStock = Math.max(0, iStock - cost.i);

    const finishSec = tStart + researchDur;
    pendingSwordResearch = { finishSec };

    if (recordTrace) {
      steps.push({
        stepNum: steps.length + 1,
        atype: 'research_sword',
        bName: 'بحث مقاتل السيف (الحداد م1)',
        baseName: 'مقاتل السيف',
        lvl: 1,
        tStart,
        tEnd: finishSec,
        buildDur: researchDur,
        cost,
        rew: { w: 0, c: 0, i: 0 },
        reason: 'فتح تدريب مقاتلي السيف في الثكنات لاستثمار فائض الحديد (بحث متوازٍ في الحداد)'
      });
      recordSnapshot('بدء بحث مقاتل السيف في الحداد');
    }
    return true;
  };

  const executeTrainSpears = (batchCount: number, reason: string): boolean => {
    if (batchCount <= 0 || (lvls['الثكنات'] || 0) < 1) return false;

    const unitSec = getSpearUnitTrainSec(lvls['الثكنات'] || 1, input.worldSpeed);
    const queueStartEst = Math.max(tSec, barracksBusyUntilSec);
    const maxFittable = Math.floor((devLimitSec - queueStartEst) / Math.max(1, unitSec));
    const effBatch = Math.min(batchCount, maxFittable);
    if (effBatch <= 0) return false;

    const usedPop = getCurrentUsedPop();
    const reqFarm = getMinFarmLevelForPop(usedPop + effBatch);
    if ((lvls['المزارع'] || 1) < reqFarm) {
      if (!flushHqWhileBuildingInQueue('المزارع')) return false;
      while ((lvls['المزارع'] || 1) < reqFarm) {
        if (
          !executeBuild(
            'المزارع',
            `توسيع المزارع م${(lvls['المزارع'] || 1) + 1} لتدريب الرماح`,
            0,
            true
          )
        ) {
          return false;
        }
      }
    }

    const cost = { w: effBatch * 50, c: effBatch * 30, i: effBatch * 10 };
    if (getMinWarehouseLevelForCost(cost) > (lvls['المخازن'] || 1)) return false;
    if (!waitUntilAffordable(cost)) return false;

    const queueStart = Math.max(tSec, barracksBusyUntilSec);
    const trainDur = effBatch * unitSec;
    if (queueStart + trainDur > devLimitSec) return false;

    wStock = Math.max(0, wStock - cost.w);
    cStock = Math.max(0, cStock - cost.c);
    iStock = Math.max(0, iStock - cost.i);

    barracksBusyUntilSec = queueStart + trainDur;
    spearsTotal += effBatch;
    troopQueues.push({
      unit: 'spear',
      total: effBatch,
      delivered: 0,
      startSec: queueStart,
      unitSec
    });

    if (recordTrace) {
      steps.push({
        stepNum: steps.length + 1,
        atype: 'train_spear',
        bName: `تدريب ${effBatch} رمح (الإجمالي ${spearsTotal})`,
        baseName: 'رمح',
        lvl: spearsTotal,
        tStart: Math.round(queueStart),
        tEnd: Math.round(barracksBusyUntilSec),
        buildDur: trainDur,
        cost,
        rew: { w: 0, c: 0, i: 0 },
        reason
      });
      recordSnapshot(`تدريب +${effBatch} رمح (بالطابور ${spearsTotal})`);
    }
    return true;
  };

  const executeTrainSwords = (batchCount: number, reason: string): boolean => {
    if (
      batchCount <= 0 ||
      (lvls['الثكنات'] || 0) < 1 ||
      (lvls['الحداد'] || 0) < 1 ||
      !swordResearched
    ) {
      return false;
    }

    const unitSec = Math.round(getSpearUnitTrainSec(lvls['الثكنات'] || 1, input.worldSpeed) * 1.47);
    const queueStartEst = Math.max(tSec, barracksBusyUntilSec);
    const maxFittable = Math.floor((devLimitSec - queueStartEst) / Math.max(1, unitSec));
    const effBatch = Math.min(batchCount, maxFittable);
    if (effBatch <= 0) return false;

    const usedPop = getCurrentUsedPop();
    const reqFarm = getMinFarmLevelForPop(usedPop + effBatch);
    if ((lvls['المزارع'] || 1) < reqFarm) {
      if (!flushHqWhileBuildingInQueue('المزارع')) return false;
      while ((lvls['المزارع'] || 1) < reqFarm) {
        if (
          !executeBuild(
            'المزارع',
            `توسيع المزارع م${(lvls['المزارع'] || 1) + 1} لتدريب السيوف`,
            0,
            true
          )
        ) {
          return false;
        }
      }
    }

    // Sword costs 30W / 30C / 70I (turns surplus Iron into 15 haul)
    const cost = { w: effBatch * 30, c: effBatch * 30, i: effBatch * 70 };
    if (getMinWarehouseLevelForCost(cost) > (lvls['المخازن'] || 1)) return false;
    if (!waitUntilAffordable(cost)) return false;

    const queueStart = Math.max(tSec, barracksBusyUntilSec);
    const trainDur = effBatch * unitSec;
    if (queueStart + trainDur > devLimitSec) return false;

    wStock = Math.max(0, wStock - cost.w);
    cStock = Math.max(0, cStock - cost.c);
    iStock = Math.max(0, iStock - cost.i);

    barracksBusyUntilSec = queueStart + trainDur;
    swordsTotal += effBatch;
    troopQueues.push({
      unit: 'sword',
      total: effBatch,
      delivered: 0,
      startSec: queueStart,
      unitSec
    });

    if (recordTrace) {
      steps.push({
        stepNum: steps.length + 1,
        atype: 'train_sword',
        bName: `تدريب ${effBatch} سيف (الإجمالي ${swordsTotal})`,
        baseName: 'سيف',
        lvl: swordsTotal,
        tStart: Math.round(queueStart),
        tEnd: Math.round(barracksBusyUntilSec),
        buildDur: trainDur,
        cost,
        rew: { w: 0, c: 0, i: 0 },
        reason
      });
      recordSnapshot(`تدريب +${effBatch} سيف (بالطابور ${swordsTotal})`);
    }
    return true;
  };

  // --- UNIFIED DYNAMIC ECONOMIC BRAIN (True Parallel Multi-Queue Engine) ---
  // HQ (2-slot queue), Barracks, Statue, Smithy, Scavenging Unlocks, and 4 Scav Slots all run in parallel!
  const hvW = (1 / sellRates.w) / sellRates.invAvg;
  const hvC = (1 / sellRates.c) / sellRates.invAvg;
  const hvI = (1 / sellRates.i) / sellRates.invAvg;

  const computeShadowPrices = (
    remDevHrs: number,
    rates: { wHr: number; cHr: number; iHr: number }
  ): { lw: number; lc: number; li: number } => {
    const devProgress = Math.min(1, tSec / Math.max(1, devLimitSec));
    const devWeight = (1 - devProgress) * (remDevHrs / (remDevHrs + 8));

    let baseW = 1.15;
    let baseC = 1.06;
    let baseI = 0.78;
    if (policy.resourceBias === 'iron_defer_heavy') {
      baseW = 1.48;
      baseC = 1.12;
      baseI = 0.42;
    } else if (policy.resourceBias === 'wood_spear_focus') {
      baseW = 1.42;
      baseC = 1.04;
      baseI = 0.56;
    } else if (policy.resourceBias === 'clay_wood_push') {
      baseW = 1.32;
      baseC = 1.24;
      baseI = 0.52;
    }

    const spearDemandBoost =
      policy.spearTarget > spearsTotal && policy.scavTierCap > 0 ? 0.14 : 0;

    const avgStock = Math.max(120, (wStock + cStock + iStock) / 3);
    const avgRate = Math.max(20, (rates.wHr + rates.cHr + rates.iHr) / 3);
    const scarW = Math.max(0.7, Math.min(1.5, (avgStock / Math.max(60, wStock)) * 0.6 + (avgRate / Math.max(15, rates.wHr)) * 0.4));
    const scarC = Math.max(0.7, Math.min(1.45, (avgStock / Math.max(60, cStock)) * 0.6 + (avgRate / Math.max(15, rates.cHr)) * 0.4));
    const scarI = Math.max(0.65, Math.min(1.35, (avgStock / Math.max(60, iStock)) * 0.6 + (avgRate / Math.max(15, rates.iHr)) * 0.4));

    const targetW = (baseW + spearDemandBoost) * (0.68 + 0.32 * scarW);
    const targetC = baseC * (0.68 + 0.32 * scarC);
    const targetI = baseI * (0.68 + 0.32 * scarI);

    return {
      lw: hvW + (targetW - hvW) * devWeight,
      lc: hvC + (targetC - hvC) * devWeight,
      li: hvI + (targetI - hvI) * devWeight
    };
  };

  const estimateWaitSec = (
    cost: { w: number; c: number; i: number },
    rates: { wHr: number; cHr: number; iHr: number },
    scavHr: number
  ): number => {
    const missW = Math.max(0, cost.w - wStock);
    const missC = Math.max(0, cost.c - cStock);
    const missI = Math.max(0, cost.i - iStock);
    if (missW <= 0 && missC <= 0 && missI <= 0) return 0;
    const scavEach = scavHr / 3;
    const wWait = missW / Math.max(5, rates.wHr + scavEach);
    const cWait = missC / Math.max(5, rates.cHr + scavEach);
    const iWait = missI / Math.max(5, rates.iHr + scavEach);
    return Math.ceil(Math.max(wWait, cWait, iWait) * 3600);
  };

  const allowedArbitrageList: readonly string[] =
    !buildingQuestsEnabled
      ? []
      : policy.arbitrageMode === 'full_harvest'
        ? ARBITRAGE_BUILDINGS
        : policy.arbitrageMode === 'mines_only'
          ? ['الخشاب', 'حفرة الطمي', 'منجم الحديد', 'المخازن']
          : [];

  const baseTargetWithoutExtra = Math.max(0, policy.spearTarget - input.extraSpears);

  type UnifiedCandidate =
    | { kind: 'arbitrage'; bName: string; nextLvl: number; netProfit: number; score: number }
    | { kind: 'quest_hq'; nextLvl: number; score: number }
    | { kind: 'quest_barracks'; nextLvl: number; score: number }
    | { kind: 'paladin'; score: number }
    | { kind: 'scav_unlock'; tier: 1 | 2 | 3 | 4; score: number }
    | { kind: 'mine'; bName: string; nextLvl: number; score: number; reasonTag: string }
    | { kind: 'hq'; nextLvl: number; score: number }
    | { kind: 'barracks'; nextLvl: number; score: number }
    | { kind: 'spear'; batch: number; score: number }
    | { kind: 'research_sword'; score: number }
    | { kind: 'sword'; batch: number; score: number }
    | { kind: 'smithy_unlock'; bName: string; nextLvl: number; score: number }
    | { kind: 'market_jit'; nextLvl: number; score: number }
    | { kind: 'market_boost30'; nextLvl: number; score: number }
    | { kind: 'wh_offline'; nextLvl: number; score: number; reason: string };

  const isHqCandidate = (c: UnifiedCandidate): boolean => {
    if (
      c.kind === 'spear' ||
      c.kind === 'sword' ||
      c.kind === 'research_sword' ||
      c.kind === 'scav_unlock'
    ) {
      return false;
    }
    if (c.kind === 'paladin' && (lvls['النصب التذكاري'] || 0) >= 1) return false;
    return true;
  };

  for (let iter = 0; iter < 460 && tSec < devLimitSec; iter++) {
    scheduleScavIfIdle();
    const remDevSec = Math.max(0, devLimitSec - tSec);
    const remDevHrs = remDevSec / 3600;
    if (remDevSec < 10) break;

    const effectiveEvalHrs = remDevHrs + futureWeightedHours;
    const beforeRates = getMineRatesNow();
    const curScav = getScavReadyNow();
    const totalIncomeHr = Math.max(30, beforeRates.totalHr + curScav.effHourly);
    const sp = computeShadowPrices(remDevHrs, beforeRates);
    const cap = getWarehouseCap(lvls['المخازن'] || 1);
    const curHq = lvls['المبنى الرئيسي'] || 1;
    const plannedHq = getPlannedLevel('المبنى الرئيسي');
    const curBar = lvls['الثكنات'] || 0;
    const plannedBar = getPlannedLevel('الثكنات');
    const curWhLvl = lvls['المخازن'] || 1;
    const plannedWhLvl = getPlannedLevel('المخازن');
    const curMkt = lvls['السوق'] || 0;
    const plannedMkt = getPlannedLevel('السوق');
    const pendingUnlockNow = pendingScavUnlock as { tier: number; finishSec: number } | null;
    const effectiveScavForEval = Math.max(
      scavUnlocked,
      pendingUnlockNow ? pendingUnlockNow.tier : 0
    );

    const hqQueueStart =
      hqQueue.length > 0 ? Math.max(tSec, hqQueue[hqQueue.length - 1].finishSec) : tSec;
    const hqAtNextSlot = getEffectiveHqAt(hqQueueStart);

    const candidates: UnifiedCandidate[] = [];
    const pushCand = (c: UnifiedCandidate) => {
      if (Number.isFinite(c.score) && c.score > 0) candidates.push(c);
    };

    // 1. Just-In-Time Market Expansion (ensures Market Lv 5 for boost30 or user marketTargetLvl before Harvest!)
    if (plannedMkt < effectiveMarketTarget && checkBuildingPrerequisites('السوق', lvls)) {
      let remMarketDurSec = 0;
      let remMarketCostRes = 0;
      for (let ml = plannedMkt + 1; ml <= effectiveMarketTarget; ml++) {
        remMarketDurSec += calcBuildDurWithSleep('السوق', ml, hqAtNextSlot, hqQueueStart + remMarketDurSec);
        const mc = getBuildingLevelCost('السوق', ml);
        const mr = calcBuildReward(mc, rules, buildingQuestsEnabled);
        remMarketCostRes += Math.max(0, mc.total - (mr.w + mr.c + mr.i));
      }
      const gatherBufSec = Math.min(
        5400,
        Math.max(1200, (remMarketCostRes / Math.max(120, totalIncomeHr)) * 3600)
      );
      if (devLimitSec - hqQueueStart <= remMarketDurSec + gatherBufSec) {
        pushCand({ kind: 'market_jit', nextLvl: plannedMkt + 1, score: 260 });
      } else if (
        input.boost30 &&
        input.boostTiming === 'during_dev' &&
        boost30StartSec === null &&
        plannedMkt < 5
      ) {
        let m5CostRes = 0;
        let m5DurSec = 0;
        for (let ml = plannedMkt + 1; ml <= 5; ml++) {
          const mc = getBuildingLevelCost('السوق', ml);
          const mr = calcBuildReward(mc, rules, buildingQuestsEnabled);
          m5CostRes += Math.max(0, mc.total - (mr.w + mr.c + mr.i));
          m5DurSec += calcBuildDurWithSleep('السوق', ml, hqAtNextSlot, hqQueueStart + m5DurSec);
        }
        const baseNow = computeMineRates(lvls, input, rules, false);
        const boostedNow = computeMineRates(lvls, input, rules, true);
        const boostDeltaHr = Math.max(0, boostedNow.totalHr - baseNow.totalHr);
        const activeBoostHrs = Math.min(48, remDevHrs + Math.max(0, (s1TotalSec - devLimitSec) / 3600));
        const estExtraRes = boostDeltaHr * activeBoostHrs;
        // Calibrate threshold by worldSpeed (70 on 1x, 140 on 2x, 35 on 0.5x)
        const minBoostDeltaHr = 70 * Math.max(0.5, input.worldSpeed);
        if (
          boostDeltaHr >= minBoostDeltaHr &&
          estExtraRes > m5CostRes * 1.45 &&
          hqQueueStart + m5DurSec < devLimitSec
        ) {
          const nextMCost = getBuildingLevelCost('السوق', plannedMkt + 1);
          const waitSec = estimateWaitSec(nextMCost, beforeRates, curScav.effHourly);
          const roi = (estExtraRes - m5CostRes) / Math.max(150, m5CostRes);
          pushCand({
            kind: 'market_boost30',
            nextLvl: plannedMkt + 1,
            score: (roi * 1.35) / (1 + waitSec / 2400)
          });
        }
      }
    } else if (plannedMkt < 25 && checkBuildingPrerequisites('السوق', lvls)) {
      // Proactive merchant-bottleneck Market upgrade when daily production + scavenging exceeds merchant capacity
      const baseNow = computeMineRates(lvls, input, rules, false);
      const projScav = getScavCached(spearsTotal, swordsTotal, knightsTotal, effectiveScavForEval);
      const projDailyRes = baseNow.totalHr * 24 + projScav.dailyLoot;
      const curMktCap = calcDailyMerchantCapacityRes(plannedMkt, input.activeHrs, input.worldSpeed);
      if (projDailyRes > curMktCap * 1.01) {
        const nextMkt = plannedMkt + 1;
        const nextMktCap = calcDailyMerchantCapacityRes(nextMkt, input.activeHrs, input.worldSpeed);
        const gainedDailyRes = Math.max(0, Math.min(projDailyRes, nextMktCap) - curMktCap);
        const mCost = getBuildingLevelCost('السوق', nextMkt);
        const mRew = calcBuildReward(mCost, rules, buildingQuestsEnabled);
        const mNetCost = Math.max(50, mCost.total - (mRew.w + mRew.c + mRew.i));
        const mDur = calcBuildDurWithSleep('السوق', nextMkt, hqAtNextSlot, hqQueueStart);
        const harvestDaysEst = Math.max(1, futureWeightedHours / 24);
        const totalSaved = gainedDailyRes * harvestDaysEst;
        if (totalSaved > mNetCost * 1.15 && hqQueueStart + mDur <= devLimitSec) {
          const waitSec = estimateWaitSec(mCost, beforeRates, curScav.effHourly);
          const roi = (totalSaved - mNetCost) / mNetCost;
          pushCand({
            kind: 'market_jit',
            nextLvl: nextMkt,
            score: (roi * 1.35) / (1 + waitSec / 2400)
          });
        }
      }
    }

    // 1b. Proactive Offline-Window Warehouse Sizing & Overflow Prevention (24 - activeHrs)
    if (plannedWhLvl < 20) {
      const nextWh = plannedWhLvl + 1;
      const whCost = getBuildingLevelCost('المخازن', nextWh);
      const whRew = calcBuildReward(whCost, rules, buildingQuestsEnabled);
      const whNetCost = Math.max(30, whCost.total - (whRew.w + whRew.c + whRew.i));
      const whDur = calcBuildDurWithSleep('المخازن', nextWh, hqAtNextSlot, hqQueueStart);
      const maxStockNow = Math.max(wStock, cStock, iStock);
      const baseMineRates = computeMineRates(lvls, input, rules, false);
      const maxRateOffline = Math.max(baseMineRates.wHr, baseMineRates.cHr, baseMineRates.iHr);
      const offlineNeedCap = offlineHrs > 0 ? maxRateOffline * offlineHrs : 0;
      const plannedCap = getWarehouseCap(plannedWhLvl);

      if (
        hqQueueStart + whDur <= devLimitSec &&
        curMkt < 1 &&
        maxStockNow >= cap * 0.98 &&
        plannedWhLvl < 12 &&
        (beforeRates.totalHr >= 180 || plannedWhLvl < 4)
      ) {
        const waitSec = estimateWaitSec(whCost, beforeRates, curScav.effHourly);
        if (Math.max(hqQueueStart, tSec + waitSec) + whDur <= devLimitSec) {
          pushCand({
            kind: 'wh_offline',
            nextLvl: nextWh,
            score: 18 / (1 + waitSec / 1800),
            reason: `توسيع المخزن م${nextWh} لمنع فيض المخزون (سعة ${getWarehouseCap(nextWh).toLocaleString('en-US')})`
          });
        }
      } else if (
        offlineHrs > 0 &&
        offlineNeedCap > plannedCap * 1.05 &&
        remDevHrs <= Math.max(10, effectiveDevHours * 0.45)
      ) {
        const nextCap = getWarehouseCap(nextWh);
        const dailySaved =
          Math.max(0, Math.min(nextCap, baseMineRates.wHr * offlineHrs) - Math.min(plannedCap, baseMineRates.wHr * offlineHrs)) +
          Math.max(0, Math.min(nextCap, baseMineRates.cHr * offlineHrs) - Math.min(plannedCap, baseMineRates.cHr * offlineHrs)) +
          Math.max(0, Math.min(nextCap, baseMineRates.iHr * offlineHrs) - Math.min(plannedCap, baseMineRates.iHr * offlineHrs));
        const harvestDaysEst = Math.max(0.5, futureWeightedHours / 24);
        const totalSaved = dailySaved * harvestDaysEst;
        if (totalSaved > whNetCost * 1.15) {
          const waitSec = estimateWaitSec(whCost, beforeRates, curScav.effHourly);
          if (Math.max(hqQueueStart, tSec + waitSec) + whDur <= devLimitSec) {
            pushCand({
              kind: 'wh_offline',
              nextLvl: nextWh,
              score: ((totalSaved - whNetCost) / whNetCost) * 1.15 / (1 + waitSec / 2400),
              reason: `توسيع المخزن م${nextWh} ليستوعب ${offlineHrs}س عدم تواجد (${nextCap.toLocaleString('en-US')})`
            });
          }
        }
      }
    }

    // 2. Profitable Free-Resource Arbitrage Builds (only when buildingQuests enabled)
    if (allowedArbitrageList.length > 0) {
      const nearFull = Math.max(wStock, cStock, iStock) > cap * 0.9;
      for (const bName of allowedArbitrageList) {
        if (!checkBuildingPrerequisites(bName, lvls)) continue;
        const def = BUILDINGS_DATA[bName];
        if (!def) continue;
        const nextLvl = getPlannedLevel(bName) + 1;
        if (nextLvl > def.max_lvl) continue;
        const cost = getBuildingLevelCost(bName, nextLvl);
        if (cost.w > cap || cost.c > cap || cost.i > cap) continue;
        const rew = calcBuildReward(cost, rules, buildingQuestsEnabled);

        const effW =
          bName === 'المخازن'
            ? rew.w
            : Math.min(cap, Math.max(0, wStock - cost.w) + rew.w) - Math.max(0, wStock - cost.w);
        const effC =
          bName === 'المخازن'
            ? rew.c
            : Math.min(cap, Math.max(0, cStock - cost.c) + rew.c) - Math.max(0, cStock - cost.c);
        const effI =
          bName === 'المخازن'
            ? rew.i
            : Math.min(cap, Math.max(0, iStock - cost.i) + rew.i) - Math.max(0, iStock - cost.i);

        const rawProfit = effW + effC + effI - cost.total;
        if (rawProfit <= 0) continue;

        const durSec = calcBuildDurWithSleep(bName, nextLvl, hqAtNextSlot, hqQueueStart);
        if (hqQueueStart + durSec > devLimitSec) continue;

        const waitSec = estimateWaitSec(cost, beforeRates, curScav.effHourly);
        const totalSec = Math.max(10, durSec + waitSec);
        const resPerMin = rawProfit / (totalSec / 60);

        const isProductiveMine =
          bName === 'الخشاب' ||
          bName === 'حفرة الطمي' ||
          bName === 'منجم الحديد';

        if (!isProductiveMine && resPerMin < policy.arbitrageMinRate) continue;

        const shadowNet =
          (effW - cost.w) * sp.lw + (effC - cost.c) * sp.lc + (effI - cost.i) * sp.li;
        if (shadowNet <= 0) continue;

        let arbScore = 0;
        if (durSec <= 25 && waitSec === 0) {
          arbScore = 120 + shadowNet * 0.25;
        } else {
          const hoursOfIncomeGained = shadowNet / Math.max(40, totalIncomeHr);
          const timeFactor = 600 / Math.max(60, totalSec);
          arbScore = hoursOfIncomeGained * timeFactor * 6.5;
          if (policy.openingStyle === 'arbitrage_max') arbScore *= 1.45;
          if (bName === 'الحائط' && nextLvl <= 3) arbScore *= 1.25;
          if (bName === 'المخابئ' && nextLvl <= 4) arbScore *= 1.12;
        }

        if (nearFull && bName === 'المخازن') arbScore = Math.max(arbScore, 190);
        if (bName === 'الخشاب' || bName === 'حفرة الطمي') arbScore *= 1.25;

        pushCand({
          kind: 'arbitrage',
          bName,
          nextLvl,
          netProfit: Math.round(rawProfit),
          score: arbScore
        });
      }
    }

    // 3. Early HQ 2-3 & Barracks 1-3 Unlock Chain (Unlocks Wall 1-3 + Market 1-2 + Barracks L3 30+30 Quest!)
    const wantsBarracks =
      policy.spearTarget > 0 ||
      policy.scavTierCap > 0 ||
      effectiveMarketTarget > 0 ||
      canClaimBarracks3Quest();

    if (wantsBarracks && plannedHq < 3) {
      const hqNext = plannedHq + 1;
      const hqCost = getBuildingLevelCost('المبنى الرئيسي', hqNext);
      const waitSec = estimateWaitSec(hqCost, beforeRates, curScav.effHourly);
      const questBonusMult = canClaimBarracks3Quest() ? 2.4 : 1.0;
      const styleMult =
        policy.openingStyle === 'hq_first'
          ? 4.5
          : policy.openingStyle === 'quest_blitz'
            ? 2.2
            : policy.openingStyle === 'arbitrage_max'
              ? 1.35
              : 0.9;
      const hqScore = (24 * questBonusMult * styleMult) / (1 + waitSec / 900);
      pushCand({ kind: 'quest_hq', nextLvl: hqNext, score: hqScore });
    }

    if (curHq >= 3 && plannedBar < 3 && (policy.spearTarget > 0 || canClaimBarracks3Quest())) {
      const nextBar = plannedBar + 1;
      const bCost = getBuildingLevelCost('الثكنات', nextBar);
      const waitSec = estimateWaitSec(bCost, beforeRates, curScav.effHourly);
      if (canClaimBarracks3Quest()) {
        let chainNetCost = 0;
        for (let bl = nextBar; bl <= 3; bl++) {
          const bc = getBuildingLevelCost('الثكنات', bl);
          const br = calcBuildReward(bc, rules, buildingQuestsEnabled);
          chainNetCost += Math.max(20, bc.total - (br.w + br.c + br.i));
        }
        const evalTier = Math.max(1, Math.min(2, policy.scavTierCap || 2));
        const scBefore = getScavCached(spearsTotal, swordsTotal, knightsTotal, evalTier);
        const scAfter = getScavCached(
          spearsTotal + giftSpearsAmt,
          swordsTotal + giftSwordsAmt,
          knightsTotal,
          evalTier
        );
        const deltaHr = Math.max(20, scAfter.effHourly - scBefore.effHourly);
        const questRoi = ((deltaHr * effectiveEvalHrs - chainNetCost) / Math.max(100, chainNetCost)) * policy.scavWeight;
        const blitzMult =
          policy.openingStyle === 'quest_blitz' || policy.openingStyle === 'hq_first' ? 2.6 : 1.75;
        pushCand({
          kind: 'quest_barracks',
          nextLvl: nextBar,
          score: (questRoi * blitzMult) / (1 + waitSec / 1800)
        });
      } else if (plannedBar === 0 && policy.spearTarget > 0) {
        const styleMult =
          policy.openingStyle === 'quest_blitz' || policy.openingStyle === 'hq_first' ? 3.0 : 1.5;
        pushCand({
          kind: 'quest_barracks',
          nextLvl: 1,
          score: (18 * styleMult * policy.scavWeight) / (1 + waitSec / 1200)
        });
      }
    }

    // 4. Statue + Paladin (+100 haul for ~340 net resources, parallel Statue queue!)
    if (policy.usePaladin && knightsTotal < 1 && policy.scavTierCap >= 1) {
      const statueNeeded = (lvls['النصب التذكاري'] || 0) < 1;
      const palCost = statueNeeded
        ? { w: 240, c: 240, i: 260 }
        : { w: 20, c: 20, i: 40 };
      const statueRew = buildingQuestsEnabled
        ? 150 * sp.lw + 150 * sp.lc + 100 * sp.li
        : 0;
      const palNetCost = statueNeeded
        ? Math.max(80, 220 * sp.lw + 220 * sp.lc + 220 * sp.li - statueRew + (20 * sp.lw + 20 * sp.lc + 40 * sp.li))
        : 20 * sp.lw + 20 * sp.lc + 40 * sp.li;
      const evalTier = Math.max(1, effectiveScavForEval);
      const scBefore = getScavCached(spearsTotal, swordsTotal, 0, evalTier);
      const scAfter = getScavCached(spearsTotal, swordsTotal, 1, evalTier);
      const deltaHr = Math.max(0, scAfter.effHourly - scBefore.effHourly);
      const waitSec = estimateWaitSec(palCost, beforeRates, curScav.effHourly);
      if (deltaHr > 0) {
        let roi = ((deltaHr * effectiveEvalHrs - palNetCost) / Math.max(60, palNetCost)) * policy.scavWeight;
        if (policy.archetype === 'paladin_blitz') roi *= 2.2;
        const parallelMult = !statueNeeded && waitSec === 0 ? 1.55 : 1.0;
        pushCand({ kind: 'paladin', score: (roi * parallelMult) / (1 + waitSec / 1800) });
      }
    }

    // 5. Scavenging Tier Unlocks (1 -> 2 -> 3 -> 4) — DIRECTLY BALANCED WITH ACTUAL ARMY SIZE!
    if (
      pendingScavUnlock === null &&
      scavUnlocked < policy.scavTierCap &&
      scavUnlocked < 4 &&
      (lvls['نقطة التجمع'] || 0) >= 1
    ) {
      const nextTier = (scavUnlocked + 1) as 1 | 2 | 3 | 4;
      const cfg = SCAV_UNLOCK_DATA[String(nextTier)];
      if (cfg) {
        const tierCost = { w: cfg.wood, c: cfg.clay, i: cfg.iron };
        const unlockDur = Math.max(10, Math.round(cfg.sec / Math.max(0.1, input.worldSpeed)));
        const reqWh = getMinWarehouseLevelForCost(tierCost);
        const whChain = getWarehouseUpgradeChainStats(
          curWhLvl,
          reqWh,
          curHq,
          input.worldSpeed,
          input.freeFinish,
          freeFinishSec,
          rules,
          buildingQuestsEnabled
        );

        const totalResCost = cfg.wood + cfg.clay + cfg.iron + whChain.netResCost;
        const shadowCost =
          cfg.wood * sp.lw + cfg.clay * sp.lc + cfg.iron * sp.li + whChain.netResCost;
        const waitSec = estimateWaitSec(tierCost, beforeRates, curScav.effHourly);

        if (tSec + whChain.totalDurSec + waitSec + unlockDur <= devLimitSec) {
          const armyHaulNow =
            spearsTotal * 25 +
            swordsTotal * 15 +
            knightsTotal * 100 +
            axes * 10 +
            archers * 10 +
            lights * 80 +
            marchers * 50 +
            heavies * 50;
          const minHaulForTier = nextTier === 4 ? 3200 : nextTier === 3 ? 1150 : nextTier === 2 ? 450 : 0;

          if (nextTier === 1 || armyHaulNow >= minHaulForTier) {
            const evalSp =
              nextTier === 1 && armyHaulNow === 0 && (curBar >= 1 || policy.usePaladin)
                ? Math.min(10, Math.max(4, policy.spearTarget))
                : spearsTotal;
            const curTierScav = getScavCached(evalSp, swordsTotal, knightsTotal, scavUnlocked);
            const nextTierScav = getScavCached(evalSp, swordsTotal, knightsTotal, nextTier);
            const deltaScavHr = Math.max(0, nextTierScav.effHourly - curTierScav.effHourly);
            const earningHrs = Math.max(
              0,
              effectiveEvalHrs - (whChain.totalDurSec + waitSec + unlockDur) / 3600
            );

            if (deltaScavHr > 0 && earningHrs > 4) {
              const rawRoi = (deltaScavHr * earningHrs - totalResCost) / Math.max(1, totalResCost);
              const shadowRoi =
                ((deltaScavHr * earningHrs - shadowCost) / Math.max(1, shadowCost)) *
                policy.scavWeight;
              const minRoiGate = nextTier === 4 ? 0.28 : nextTier === 3 ? 0.22 : nextTier === 2 ? 0.14 : 0.0;
              if (rawRoi > minRoiGate && shadowRoi > 0) {
                const parallelBoost =
                  waitSec === 0 && whChain.totalDurSec === 0
                    ? 1.55
                    : rawRoi > 0.35
                      ? 1.28
                      : 1.0;
                const tierScore =
                  (shadowRoi / (1 + (waitSec + whChain.totalDurSec) / 7200)) *
                  (nextTier === 1 ? 1.6 : 1.0) *
                  parallelBoost;
                pushCand({ kind: 'scav_unlock', tier: nextTier, score: tierScore });
              }
            }
          }
        }
      }
    }

    // 6. Shadow-Priced & Market-Valued Mines (Wood vs Clay vs Iron — respects per-resource sell prices!)
    for (const mName of MINE_NAMES) {
      const curPlanned = getPlannedLevel(mName);
      if (curPlanned >= 30) continue;
      const nextLvl = curPlanned + 1;
      const cost = getBuildingLevelCost(mName, nextLvl);
      const rew = calcBuildReward(cost, rules, buildingQuestsEnabled);
      const rawNetCost = Math.max(40, cost.total - (rew.w + rew.c + rew.i));

      let whNetCost = 0;
      let whDurSec = 0;
      const reqWh = getMinWarehouseLevelForCost(cost);
      if (reqWh > curWhLvl) {
        const whStats = getWarehouseUpgradeChainStats(
          curWhLvl,
          reqWh,
          curHq,
          input.worldSpeed,
          input.freeFinish,
          freeFinishSec,
          rules,
          buildingQuestsEnabled
        );
        whNetCost = whStats.netResCost;
        whDurSec = whStats.totalDurSec;
      }

      const mineDur = calcBuildDurWithSleep(mName, nextLvl, hqAtNextSlot, hqQueueStart + whDurSec);
      const waitSec = estimateWaitSec(cost, beforeRates, curScav.effHourly);
      if (Math.max(hqQueueStart, tSec + waitSec) + whDurSec + mineDur > devLimitSec) continue;

      const prevLv = lvls[mName] || 0;
      lvls[mName] = nextLvl;
      const afterRates = computeMineRates(lvls, input, rules, isBoost30ActiveAt(tSec));
      lvls[mName] = curPlanned;
      const baseAtPlanned = computeMineRates(lvls, input, rules, isBoost30ActiveAt(tSec));
      lvls[mName] = prevLv;
      const deltaHr = Math.max(0.1, afterRates.totalHr - baseAtPlanned.totalHr);

      const resShadow =
        mName === 'الخشاب' ? sp.lw : mName === 'حفرة الطمي' ? sp.lc : sp.li;
      const harvestVal =
        mName === 'الخشاب' ? hvW : mName === 'حفرة الطمي' ? hvC : hvI;
      const shadowCost = Math.max(
        40,
        (cost.w - rew.w) * sp.lw +
          (cost.c - rew.c) * sp.lc +
          (cost.i - rew.i) * sp.li +
          whNetCost
      );
      const totalRawCost = rawNetCost + whNetCost;
      const paybackHrs = totalRawCost / Math.max(0.1, deltaHr * harvestVal);

      if (paybackHrs < effectiveEvalHrs * 0.96) {
        const activeDevHrs = Math.max(0, remDevHrs - (whDurSec + waitSec + mineDur) / 3600);
        // Dev-phase output weighted by resource shadow price; Harvest-phase output weighted by per-resource market value!
        const weightedReturn = deltaHr * activeDevHrs * resShadow + deltaHr * futureWeightedHours * harvestVal;
        const mineMult = policy.archetype === 'mines_economy' ? 1.22 : 1.0;
        const roi = ((weightedReturn - shadowCost) / shadowCost) * mineMult;
        const score = roi / (1 + (waitSec + whDurSec) / 5400);
        const reasonTag =
          harvestVal > 1.15
            ? `أولوية سعر البيع المرتفع (${mName})`
            : mName === 'الخشاب' && sp.lw > 1.15
              ? 'أولوية الخشب للرماح والتطوير'
              : mName === 'منجم الحديد' && remDevHrs < effectiveDevHours * 0.45
                ? 'استدراك منجم الحديد قبل الحصاد'
                : 'أعلى عائد ROI للمناجم';
        pushCand({ kind: 'mine', bName: mName, nextLvl, score, reasonTag });
      }
    }

    // 7. Small Cash-Flow Spear Batches (runs in parallel with HQ!)
    const spearsRemaining = Math.max(0, policy.spearTarget - spearsTotal);
    if (spearsRemaining > 0 && effectiveScavForEval >= 1 && curBar >= 1) {
      const unitSec = getSpearUnitTrainSec(curBar, input.worldSpeed);
      const queueStart = Math.max(tSec, barracksBusyUntilSec);
      const queueBufferSec = Math.max(0, barracksBusyUntilSec - tSec);
      const maxFitTime = Math.floor((devLimitSec - queueStart) / Math.max(1, unitSec));

      const affordNow = Math.floor(Math.min(wStock / 50, cStock / 30, iStock / 10));
      let spearBatch: number;
      if (spearsTotal < 60 || queueBufferSec < 1800) {
        if (affordNow >= 2) {
          spearBatch = Math.min(5, affordNow, spearsRemaining, maxFitTime);
        } else {
          spearBatch = Math.min(4, spearsRemaining, maxFitTime);
        }
      } else if (wStock >= 850 && affordNow >= 8) {
        spearBatch = Math.min(10, affordNow, spearsRemaining, maxFitTime);
      } else {
        spearBatch = Math.min(5, Math.max(2, affordNow || 4), spearsRemaining, maxFitTime);
      }

      if (spearBatch >= 1) {
        const batchDur = spearBatch * unitSec;
        const batchCostObj = { w: spearBatch * 50, c: spearBatch * 30, i: spearBatch * 10 };
        const waitSec = estimateWaitSec(batchCostObj, beforeRates, curScav.effHourly);
        if (queueStart + batchDur <= devLimitSec && tSec + waitSec <= devLimitSec) {
          const scBefore = getScavCached(
            spearsTotal,
            swordsTotal,
            knightsTotal,
            effectiveScavForEval
          );
          const scAfter = getScavCached(
            spearsTotal + spearBatch,
            swordsTotal,
            knightsTotal,
            effectiveScavForEval
          );
          const deltaScavHr = Math.max(0, scAfter.effHourly - scBefore.effHourly);
          const shadowBatchCost =
            batchCostObj.w * sp.lw + batchCostObj.c * sp.lc + batchCostObj.i * sp.li;
          const trainLagHrs = Math.max(0, (queueStart + batchDur * 0.5 - tSec) / 3600);
          const earnHrs = Math.max(0, effectiveEvalHrs - trainLagHrs - waitSec / 3600);
          let roi =
            deltaScavHr > 0
              ? ((deltaScavHr * earnHrs - shadowBatchCost) / Math.max(50, shadowBatchCost)) *
                policy.scavWeight
              : -1;
          const minExtraFloor =
            input.extraSpears > 0 ? Math.min(policy.spearTarget, 85 + input.extraSpears) : 0;
          if (input.extraSpears > 0 && spearsTotal < minExtraFloor && (lvls['الخشاب'] || 0) >= 5) {
            roi = Math.max(roi, 9.0);
          }
          if (roi > 0) {
            const parallelMult = queueBufferSec <= 600 && waitSec === 0 ? 1.75 : queueBufferSec <= 1800 ? 1.3 : 1.0;
            pushCand({
              kind: 'spear',
              batch: spearBatch,
              score: (roi * parallelMult) / (1 + waitSec / 2400)
            });
          }
        }
      }
    }

    // 8. Iron-Surplus Swords (Requires Barracks L1 + Smithy L1 + authentic Sword Research!)
    if (
      policy.useIronSwords &&
      effectiveScavForEval >= 1 &&
      curBar >= 1 &&
      swordsTotal < Math.round(policy.spearTarget * 0.6 + 40) &&
      iStock > wStock + 350 &&
      iStock >= 700
    ) {
      if ((lvls['الحداد'] || 0) >= 1) {
        if (!swordResearched) {
          if (pendingSwordResearch === null && remDevHrs > 6) {
            const researchDur = Math.max(60, Math.round(SWORD_RESEARCH_BASE_SEC / Math.max(0.1, input.worldSpeed)));
            const waitSec = estimateWaitSec(SWORD_RESEARCH_COST, beforeRates, curScav.effHourly);
            if (tSec + waitSec + researchDur < devLimitSec) {
              const scBefore = getScavCached(spearsTotal, swordsTotal, knightsTotal, effectiveScavForEval);
              const scAfter = getScavCached(spearsTotal, swordsTotal + 20, knightsTotal, effectiveScavForEval);
              const deltaHr = Math.max(0, scAfter.effHourly - scBefore.effHourly);
              const totalShadowCost =
                SWORD_RESEARCH_COST.w * sp.lw +
                SWORD_RESEARCH_COST.c * sp.lc +
                SWORD_RESEARCH_COST.i * sp.li +
                20 * (30 * sp.lw + 30 * sp.lc + 70 * sp.li);
              if (deltaHr * effectiveEvalHrs > totalShadowCost * 1.1) {
                pushCand({
                  kind: 'research_sword',
                  score: ((deltaHr * effectiveEvalHrs - totalShadowCost) / Math.max(200, totalShadowCost)) * policy.scavWeight / (1 + waitSec / 2400)
                });
              }
            }
          }
        } else {
          const swBatch = 10;
          const unitSec = Math.round(getSpearUnitTrainSec(curBar, input.worldSpeed) * 1.47);
          const queueStart = Math.max(tSec, barracksBusyUntilSec);
          if (queueStart + swBatch * unitSec <= devLimitSec) {
            const scBefore = getScavCached(
              spearsTotal,
              swordsTotal,
              knightsTotal,
              effectiveScavForEval
            );
            const scAfter = getScavCached(
              spearsTotal,
              swordsTotal + swBatch,
              knightsTotal,
              effectiveScavForEval
            );
            const deltaScavHr = Math.max(0, scAfter.effHourly - scBefore.effHourly);
            const shadowCost = swBatch * (30 * sp.lw + 30 * sp.lc + 70 * sp.li);
            if (deltaScavHr > 0) {
              const roi =
                ((deltaScavHr * effectiveEvalHrs - shadowCost) / Math.max(80, shadowCost)) *
                policy.scavWeight *
                1.15;
              pushCand({ kind: 'sword', batch: swBatch, score: roi });
            }
          }
        }
      } else if (iStock >= 1200 && remDevHrs > 12 && policy.hqCap >= 5) {
        const nextUnlockBldg = plannedHq < 5 ? 'المبنى الرئيسي' : 'الحداد';
        const nextUnlockLvl = getPlannedLevel(nextUnlockBldg) + 1;
        if (nextUnlockBldg === 'المبنى الرئيسي' || curHq >= 5) {
          pushCand({ kind: 'smithy_unlock', bName: nextUnlockBldg, nextLvl: nextUnlockLvl, score: 0.65 });
        }
      }
    }

    // 9. HQ Speedup (beyond L3)
    if (plannedHq >= 3 && plannedHq < policy.hqCap && (lvls['الخشاب'] || 0) >= 6 && remDevHrs > 8) {
      const hqCost = getBuildingLevelCost('المبنى الرئيسي', plannedHq + 1);
      const hqRew = calcBuildReward(hqCost, rules, buildingQuestsEnabled);
      const netHqCost = Math.max(50, hqCost.total - (hqRew.w + hqRew.c + hqRew.i));
      const estBenefit = beforeRates.totalHr * remDevHrs * 0.045;
      if (estBenefit > netHqCost * 0.7) {
        pushCand({
          kind: 'hq',
          nextLvl: plannedHq + 1,
          score: (estBenefit / netHqCost) * 0.85
        });
      }
    }

    // 10. Barracks Speedup (beyond L3, or L2/L3 when sideQuests is off)
    if (
      curBar >= 1 &&
      plannedBar < policy.barracksCap &&
      !canClaimBarracks3Quest() &&
      policy.spearTarget - spearsTotal >= 25 &&
      remDevHrs > 4
    ) {
      const bCost = getBuildingLevelCost('الثكنات', plannedBar + 1);
      const bRew = calcBuildReward(bCost, rules, buildingQuestsEnabled);
      const netBCost = Math.max(50, bCost.total - (bRew.w + bRew.c + bRew.i));
      const queueLagHrs = Math.max(0, (barracksBusyUntilSec - tSec) / 3600);
      if (queueLagHrs > 1.5 || spearsTotal >= 20) {
        pushCand({
          kind: 'barracks',
          nextLvl: plannedBar + 1,
          score: (1.2 + queueLagHrs * 0.2) * (400 / Math.max(200, netBCost))
        });
      }
    }

    candidates.sort((a, b) => b.score - a.score);

    // Protect top planned candidate's cost before selling early surplus so we never starve next upgrade!
    let topReserve: { w: number; c: number; i: number } | undefined;
    if (candidates.length > 0) {
      const top = candidates[0];
      if (top.kind === 'mine' || top.kind === 'arbitrage' || top.kind === 'smithy_unlock') {
        const c = getBuildingLevelCost(top.bName, top.nextLvl);
        topReserve = { w: c.w, c: c.c, i: c.i };
      } else if (top.kind === 'market_jit' || top.kind === 'market_boost30') {
        const c = getBuildingLevelCost('السوق', top.nextLvl);
        topReserve = { w: c.w, c: c.c, i: c.i };
      } else if (top.kind === 'wh_offline') {
        const c = getBuildingLevelCost('المخازن', top.nextLvl);
        topReserve = { w: c.w, c: c.c, i: c.i };
      } else if (top.kind === 'scav_unlock') {
        const cfg = SCAV_UNLOCK_DATA[String(top.tier)];
        if (cfg) topReserve = { w: cfg.wood, c: cfg.clay, i: cfg.iron };
      }
    }
    trySellDevSurplus(topReserve);

    // Parallel Execution Pass:
    // If HQ queue already has 2 slots filled, try non-HQ parallel candidates (Barracks/Smithy/Statue/Scav) first
    // so they launch IMMEDIATELY at tSec without blocking HQ!
    const orderedCandidates =
      hqQueue.length >= 2
        ? [
            ...candidates.filter((c) => !isHqCandidate(c)),
            ...candidates.filter((c) => isHqCandidate(c))
          ]
        : candidates;

    let executed = false;
    const maxTries = Math.min(10, orderedCandidates.length);
    for (let ci = 0; ci < maxTries; ci++) {
      const picked = orderedCandidates[ci];
      // Do not block on an HQ candidate while HQ already has 2 slots and parallel actions might still appear on next event
      if (hqQueue.length >= 2 && isHqCandidate(picked)) continue;

      if (picked.kind === 'market_jit') {
        executed = executeBuild(
          'السوق',
          `رفع السوق م${picked.nextLvl} في التوقيت الأمثل قبيل الحصاد (هدف م${effectiveMarketTarget})`
        );
      } else if (picked.kind === 'market_boost30') {
        executed = executeBuild(
          'السوق',
          `رفع السوق م${picked.nextLvl}/5 لتفعيل معزز الموارد +30% (48 ساعة)`
        );
      } else if (picked.kind === 'wh_offline') {
        executed = executeBuild('المخازن', picked.reason);
      } else if (picked.kind === 'arbitrage') {
        executed = executeBuild(
          picked.bName,
          `حصاد مكافأة صافية (+${picked.netProfit} مورد مجاني · ${picked.bName} م${picked.nextLvl})`
        );
      } else if (picked.kind === 'quest_hq') {
        executed = executeBuild(
          'المبنى الرئيسي',
          `فتح متطلب الثكنات والحائط والسوق وتسريع البناء (رئيسي م${picked.nextLvl})`
        );
      } else if (picked.kind === 'quest_barracks') {
        executed = executeBuild(
          'الثكنات',
          canClaimBarracks3Quest()
            ? `اندفاع الثكنات م${picked.nextLvl}/3 لاقتناص مكافأة 30 رمح + 30 سيف`
            : `بناء الثكنات م${picked.nextLvl} لفتح الحائط وتدريب جيش الإغارة`
        );
      } else if (picked.kind === 'paladin') {
        executed = executeTrainPaladin();
      } else if (picked.kind === 'scav_unlock') {
        executed = executeScavUnlock(picked.tier, false);
      } else if (picked.kind === 'mine') {
        executed = executeBuild(
          picked.bName,
          `${picked.reasonTag} (${picked.bName} م${picked.nextLvl})`
        );
      } else if (picked.kind === 'hq') {
        executed = executeBuild(
          'المبنى الرئيسي',
          `تسريع زمن بناء المناجم العالية (رئيسي م${picked.nextLvl})`
        );
      } else if (picked.kind === 'barracks') {
        executed = executeBuild(
          'الثكنات',
          `تسريع طابور تدريب جيش الإغارة (ثكنات م${picked.nextLvl})`
        );
      } else if (picked.kind === 'spear') {
        executed = executeTrainSpears(
          picked.batch,
          spearsTotal >= baseTargetWithoutExtra && input.extraSpears > 0
            ? `تدريب رماح إضافية مطلوبة (${spearsTotal + picked.batch}/${policy.spearTarget})`
            : `دفعة تدريب سريعة (+${picked.batch} رمح · حفظ سيولة الخشب)`
        );
      } else if (picked.kind === 'research_sword') {
        executed = executeResearchSword();
      } else if (picked.kind === 'sword') {
        executed = executeTrainSwords(
          picked.batch,
          `استثمار فائض الحديد في السيوف (+${picked.batch * 15} حمولة إغارة)`
        );
      } else if (picked.kind === 'smithy_unlock') {
        executed = executeBuild(
          picked.bName,
          `فتح متطلب الحداد م1 لتحويل فائض الحديد إلى سيوف (${picked.bName} م${picked.nextLvl})`
        );
      }
      if (executed) break;
    }

    if (!executed) {
      // Fallback: complete remaining Market target if HQ has a free slot
      if (hqQueue.length < 2 && plannedMkt < effectiveMarketTarget && checkBuildingPrerequisites('السوق', lvls)) {
        const mNext = plannedMkt + 1;
        if (executeBuild('السوق', `استكمال هدف السوق م${mNext}`)) continue;
      }

      // Advance cleanly to the earliest pending discrete event (HQ completion, scav return, unlock, research, troop ready, wake-up)
      const earliestScav = getEarliestScavReturnSec();
      const earliestTroop = getNextTroopDeliverySec();
      const wakeSec = !isOnlineAt(tSec) && scavUnlocked > 0 ? getNextWakeSec(tSec) : Infinity;
      const pendingResearchNow = pendingSwordResearch as { finishSec: number } | null;
      const nextEventSec = Math.min(
        hqQueue.length > 0 && hqQueue[0].finishSec > tSec ? hqQueue[0].finishSec : Infinity,
        earliestScav !== null && earliestScav > tSec ? earliestScav : Infinity,
        pendingUnlockNow !== null && pendingUnlockNow.finishSec > tSec ? pendingUnlockNow.finishSec : Infinity,
        pendingResearchNow !== null && pendingResearchNow.finishSec > tSec ? pendingResearchNow.finishSec : Infinity,
        earliestTroop !== null && earliestTroop > tSec ? earliestTroop : Infinity,
        wakeSec > tSec ? wakeSec : Infinity
      );
      if (Number.isFinite(nextEventSec) && nextEventSec < devLimitSec) {
        advanceTimeTo(nextEventSec);
        continue;
      }
      break;
    }
  }

  advanceTimeTo(devLimitSec);
  trySellDevSurplus();

  // If user chose 'after_dev' for +30% boost (48h) and Market reached Lv 5, activate right at Harvest start!
  if (
    input.boost30 &&
    input.boostTiming === 'after_dev' &&
    boost30StartSec === null &&
    (lvls['السوق'] || 0) >= 5
  ) {
    tryActivateBoost30('تفعيل معزز الموارد +30% بعد انتهاء التطوير على أقصى مستوى للمناجم (مدة 48 ساعة)');
  }

  // Credit any in-flight scavenging slots (e.g., overnight wave) returning during S1 Harvest
  let inFlightScavW = 0;
  let inFlightScavC = 0;
  let inFlightScavI = 0;
  let inFlightScavRuns = 0;
  for (const slot of scavSlots) {
    if (slot.returnSec <= s1TotalSec) {
      inFlightScavW += slot.loot.w;
      inFlightScavC += slot.loot.c;
      inFlightScavI += slot.loot.i;
      inFlightScavRuns += 1;
    }
  }

  // --- STAGE D: S1 Harvest Window (devLimitSec -> s1TotalSec) ---
  const baseFinalRates = computeMineRates(lvls, input, rules, false);
  const boostedFinalRates = computeMineRates(lvls, input, rules, true);
  const finalScav = getScavReadyNow();
  const harvestSec = Math.max(0, s1TotalSec - devLimitSec);
  const harvestHrs = harvestSec / 3600;
  const harvestDays = harvestHrs / 24;

  // Exact overlap of the 48-hour +30% boost window with S1 Harvest [devLimitSec, s1TotalSec]
  const calcOverlapSec = (winStart: number, winEnd: number): number => {
    if (!input.boost30 || boost30StartSec === null || boost30EndSec === null) return 0;
    const s = Math.max(winStart, boost30StartSec);
    const e = Math.min(winEnd, boost30EndSec);
    return Math.max(0, e - s);
  };

  const harvestBoostedSec = calcOverlapSec(devLimitSec, s1TotalSec);
  const harvestBaseSec = Math.max(0, harvestSec - harvestBoostedSec);
  const harvestBoostedHrs = harvestBoostedSec / 3600;
  const harvestBaseHrs = harvestBaseSec / 3600;

  // Extra resources strictly generated by +30% boost during S1 Harvest
  const harvestBoostExtraW = Math.max(0, boostedFinalRates.wHr - baseFinalRates.wHr) * harvestBoostedHrs;
  const harvestBoostExtraC = Math.max(0, boostedFinalRates.cHr - baseFinalRates.cHr) * harvestBoostedHrs;
  const harvestBoostExtraI = Math.max(0, boostedFinalRates.iHr - baseFinalRates.iHr) * harvestBoostedHrs;
  cumBoost30ExtraW += harvestBoostExtraW;
  cumBoost30ExtraC += harvestBoostExtraC;
  cumBoost30ExtraI += harvestBoostExtraI;
  cumBoost30ExtraRes += harvestBoostExtraW + harvestBoostExtraC + harvestBoostExtraI;

  // Realistic offline Warehouse overflow accounting per resource (24 - activeHrs)
  const finalWhCap = getWarehouseCap(lvls['المخازن'] || 1);
  const calcOfflineOverflowSplit = (
    ratesObj: { wHr: number; cHr: number; iHr: number },
    whCap: number
  ): { w: number; c: number; i: number; total: number } => {
    if (offlineHrs <= 0) return { w: 0, c: 0, i: 0, total: 0 };
    const w = Math.max(0, ratesObj.wHr * offlineHrs - whCap);
    const c = Math.max(0, ratesObj.cHr * offlineHrs - whCap);
    const i = Math.max(0, ratesObj.iHr * offlineHrs - whCap);
    return { w, c, i, total: w + c + i };
  };

  const ovBoost = calcOfflineOverflowSplit(boostedFinalRates, finalWhCap);
  const ovBase = calcOfflineOverflowSplit(baseFinalRates, finalWhCap);
  const harvestOvW = ovBoost.w * (harvestBoostedHrs / 24) + ovBase.w * (harvestBaseHrs / 24);
  const harvestOvC = ovBoost.c * (harvestBoostedHrs / 24) + ovBase.c * (harvestBaseHrs / 24);
  const harvestOvI = ovBoost.i * (harvestBoostedHrs / 24) + ovBase.i * (harvestBaseHrs / 24);
  const offlineOverflowLossRes = harvestOvW + harvestOvC + harvestOvI;

  // Real merchant throughput (1,000 res/merchant per round-trip) — NO fabricated marketEfficiency penalty!
  const loginIntervalSec = finalScav.effCycleSec > 0 ? finalScav.effCycleSec : 0;
  const dailyMerchantCapRes = calcDailyMerchantCapacityRes(
    lvls['السوق'] || 0,
    input.activeHrs,
    input.worldSpeed,
    loginIntervalSec
  );

  const harvestMineW =
    Math.max(0, boostedFinalRates.wHr * harvestBoostedHrs + baseFinalRates.wHr * harvestBaseHrs - harvestOvW) +
    wStock;
  const harvestMineC =
    Math.max(0, boostedFinalRates.cHr * harvestBoostedHrs + baseFinalRates.cHr * harvestBaseHrs - harvestOvC) +
    cStock;
  const harvestMineI =
    Math.max(0, boostedFinalRates.iHr * harvestBoostedHrs + baseFinalRates.iHr * harvestBaseHrs - harvestOvI) +
    iStock;
  const harvestMineRes = harvestMineW + harvestMineC + harvestMineI;

  const harvestScavRecurring = finalScav.dailyLoot * harvestDays;
  const harvestScavW = harvestScavRecurring / 3 + inFlightScavW;
  const harvestScavC = harvestScavRecurring / 3 + inFlightScavC;
  const harvestScavI = harvestScavRecurring / 3 + inFlightScavI;
  const harvestScavRes = harvestScavW + harvestScavC + harvestScavI;
  const harvestScavRuns = Math.round(finalScav.runsPerDay * harvestDays) + inFlightScavRuns;

  const totalHarvestAvailRes = harvestMineRes + harvestScavRes;
  const maxHarvestSellableRes =
    dailyMerchantCapRes > 0 ? dailyMerchantCapRes * Math.max(0.25, harvestDays) : 0;
  const harvestSellRatio =
    totalHarvestAvailRes > 0 ? Math.min(1, maxHarvestSellableRes / totalHarvestAvailRes) : 0;

  const sellableMineW = harvestMineW * harvestSellRatio;
  const sellableMineC = harvestMineC * harvestSellRatio;
  const sellableMineI = harvestMineI * harvestSellRatio;
  const sellableMineRes = sellableMineW + sellableMineC + sellableMineI;

  const sellableScavW = harvestScavW * harvestSellRatio;
  const sellableScavC = harvestScavC * harvestSellRatio;
  const sellableScavI = harvestScavI * harvestSellRatio;
  const sellableScavRes = sellableScavW + sellableScavC + sellableScavI;

  const minePP = calcSplitResourcesPP(sellableMineW, sellableMineC, sellableMineI, sellRates) + devSoldPP;
  const scavPP = calcSplitResourcesPP(sellableScavW, sellableScavC, sellableScavI, sellRates);
  const s1GrossPP = minePP + scavPP;
  const s1NetPP = Math.max(0, s1GrossPP - usedBoostPP);

  // STRICT Steady Daily PP (Base production ONLY — NEVER inflated by temporary 48h +30% boost!)
  const steadyOv = calcOfflineOverflowSplit(baseFinalRates, finalWhCap);
  const steadyMineDailyW = Math.max(0, baseFinalRates.wHr * 24 - steadyOv.w);
  const steadyMineDailyC = Math.max(0, baseFinalRates.cHr * 24 - steadyOv.c);
  const steadyMineDailyI = Math.max(0, baseFinalRates.iHr * 24 - steadyOv.i);
  const steadyScavDailyEach = finalScav.dailyLoot / 3;
  const steadyDailyRawRes =
    steadyMineDailyW + steadyMineDailyC + steadyMineDailyI + finalScav.dailyLoot;
  const dailySellableRes = Math.min(steadyDailyRawRes, dailyMerchantCapRes);
  const merchantBottleneckRes = Math.max(0, steadyDailyRawRes - dailyMerchantCapRes);
  const steadySellRatio =
    steadyDailyRawRes > 0 ? dailySellableRes / steadyDailyRawRes : 0;

  const steadyDailyMinePP = calcSplitResourcesPP(
    steadyMineDailyW * steadySellRatio,
    steadyMineDailyC * steadySellRatio,
    steadyMineDailyI * steadySellRatio,
    sellRates
  );
  const steadyDailyScavPP = calcSplitResourcesPP(
    steadyScavDailyEach * steadySellRatio,
    steadyScavDailyEach * steadySellRatio,
    steadyScavDailyEach * steadySellRatio,
    sellRates
  );
  const steadyDailyTotalPP = steadyDailyMinePP + steadyDailyScavPP;

  const dailyMinePP = steadyDailyMinePP;
  const dailyScavPP = steadyDailyScavPP;
  const dailyTotalPP = steadyDailyTotalPP;

  const displayFinalRates = isBoost30ActiveAt(devLimitSec + 1) ? boostedFinalRates : baseFinalRates;

  const totalResYield = Math.max(1, sellableMineRes + devSoldRes + sellableScavRes);
  const mineSharePct = Math.round(((sellableMineRes + devSoldRes) / totalResYield) * 100);
  const scavSharePct = Math.max(0, 100 - mineSharePct);
  const endPoints = calcVillagePointsFromBuildings(lvls);

  // --- STAGE E: Stages 2, 3, 4 Market Trajectory Matrix (Mines + Warehouse + Market + Scav Tier 4) ---
  const stageConfigs: Array<{ stageNum: 2 | 3 | 4; label: string; cfg: PhaseConfigInput }> = [
    { stageNum: 2, label: 'مرحلة 2', cfg: input.phases.p2 },
    { stageNum: 3, label: 'مرحلة 3', cfg: input.phases.p3 },
    { stageNum: 4, label: 'مرحلة 4', cfg: input.phases.p4 }
  ];

  const stageLvls = { ...lvls };
  let stageScavTier = scavUnlocked;
  let stageSpears = spearsReady;
  let stageScavObj = finalScav;
  const stages: TacticalStageResult[] = [];
  let runningCumPP = s1NetPP;
  let stageCursorSec = s1TotalSec;
  let boost30ExtraPP = calcSplitResourcesPP(
    cumBoost30ExtraW * (harvestSellRatio || 1),
    cumBoost30ExtraC * (harvestSellRatio || 1),
    cumBoost30ExtraI * (harvestSellRatio || 1),
    sellRates
  );

  const chartPoints: TacticalSimulationResult['chartPoints'] = [
    { key: 'start', label: 'البداية', cumulativePP: 0, stagePP: 0 },
    {
      key: 's1',
      label: 'مرحلة 1 (S1)',
      cumulativePP: Math.round(s1NetPP),
      stagePP: Math.round(s1NetPP)
    }
  ];

  for (let idx = 0; idx < stageConfigs.length; idx++) {
    const { stageNum, label, cfg } = stageConfigs[idx];
    const avgRate = Math.max(1, (cfg.startRate + cfg.endRate) / 2);
    const rateScale = avgRate / Math.max(1, sellRates.avg);
    const stageRatesObj = {
      w: Math.max(1, sellRates.w * rateScale),
      c: Math.max(1, sellRates.c * rateScale),
      i: Math.max(1, sellRates.i * rateScale),
      avg: avgRate,
      invAvg: (1 / Math.max(1, sellRates.w * rateScale) + 1 / Math.max(1, sellRates.c * rateScale) + 1 / Math.max(1, sellRates.i * rateScale)) / 3
    };

    if (!cfg.enabled) {
      const curRates = computeMineRates(stageLvls, input, rules, false);
      stages.push({
        stageNum,
        label,
        enabled: false,
        days: cfg.days,
        startRate: cfg.startRate,
        endRate: cfg.endRate,
        avgRate,
        sellOnlyPP: 0,
        upgradesDesc: 'بدون ترقية',
        upgradesCount: 0,
        paybackDays: null,
        netStagePP: 0,
        ppPerDay: 0,
        endingHourlyProd: Math.round(curRates.totalHr + stageScavObj.effHourly),
        overflowLossRes: 0,
        merchantBottleneckRes: 0
      });
      chartPoints.push({
        key: `s${stageNum}`,
        label,
        cumulativePP: Math.round(runningCumPP),
        stagePP: 0
      });
      continue;
    }

    const stageDurSec = Math.round(cfg.days * 86400);
    const stageBoostSec = calcOverlapSec(stageCursorSec, stageCursorSec + stageDurSec);
    const stageBaseSec = Math.max(0, stageDurSec - stageBoostSec);
    stageCursorSec += stageDurSec;

    const evalStageDailyPP = (
      lvlsSnap: Record<string, number>,
      scavSnap: ScavDispatchResult
    ): { dailyPP: number; dailyOverflow: number; dailyBottleneck: number; dailyRawRes: number } => {
      const r = computeMineRates(lvlsSnap, input, rules, false);
      const whC = getWarehouseCap(lvlsSnap['المخازن'] || 1);
      const ov = calcOfflineOverflowSplit(r, whC);
      const mW = Math.max(0, r.wHr * 24 - ov.w);
      const mC = Math.max(0, r.cHr * 24 - ov.c);
      const mI = Math.max(0, r.iHr * 24 - ov.i);
      const scEach = scavSnap.dailyLoot / 3;
      const rawTotal = mW + mC + mI + scavSnap.dailyLoot;
      const mktCap = calcDailyMerchantCapacityRes(
        lvlsSnap['السوق'] || 0,
        input.activeHrs,
        input.worldSpeed,
        scavSnap.effCycleSec || 0
      );
      const sellable = Math.min(rawTotal, mktCap);
      const ratio = rawTotal > 0 ? sellable / rawTotal : 0;
      const pp = calcSplitResourcesPP(
        (mW + scEach) * ratio,
        (mC + scEach) * ratio,
        (mI + scEach) * ratio,
        stageRatesObj
      );
      return {
        dailyPP: pp,
        dailyOverflow: ov.total,
        dailyBottleneck: Math.max(0, rawTotal - mktCap),
        dailyRawRes: rawTotal
      };
    };

    const baseRates = computeMineRates(stageLvls, input, rules, false);
    const boostedRates = computeMineRates(stageLvls, input, rules, true);
    const stageBoostExtraW = Math.max(0, boostedRates.wHr - baseRates.wHr) * (stageBoostSec / 3600);
    const stageBoostExtraC = Math.max(0, boostedRates.cHr - baseRates.cHr) * (stageBoostSec / 3600);
    const stageBoostExtraI = Math.max(0, boostedRates.iHr - baseRates.iHr) * (stageBoostSec / 3600);
    cumBoost30ExtraRes += stageBoostExtraW + stageBoostExtraC + stageBoostExtraI;
    const stageBoostExtraPP =
      (stageLvls['السوق'] || 0) >= 1
        ? calcSplitResourcesPP(stageBoostExtraW, stageBoostExtraC, stageBoostExtraI, stageRatesObj)
        : 0;
    boost30ExtraPP += stageBoostExtraPP;

    const baselineDay = evalStageDailyPP(stageLvls, stageScavObj);
    const sellOnlyPP = baselineDay.dailyPP * cfg.days + stageBoostExtraPP;
    const sellOnlyRes = baselineDay.dailyRawRes * cfg.days;

    let futureStagesWeightedDays = 0;
    if (input.optMode === 'cumulative') {
      for (let j = idx + 1; j < stageConfigs.length; j++) {
        const nxt = stageConfigs[j].cfg;
        if (!nxt.enabled) continue;
        const nxtAvg = Math.max(1, (nxt.startRate + nxt.endRate) / 2);
        futureStagesWeightedDays += nxt.days * (avgRate / nxtAvg);
      }
    }

    let stageCostPP = 0;
    let stageCostRes = 0;
    let addedDailyPP = 0;
    let addedHourlyTotal = 0;
    const upCounts: Record<string, number> = {
      الخشاب: 0,
      'حفرة الطمي': 0,
      'منجم الحديد': 0,
      المخازن: 0,
      السوق: 0,
      إغارة4: 0
    };
    const totalHorizonDays = cfg.days * 0.72 + futureStagesWeightedDays;

    for (let stepIdx = 0; stepIdx < 20; stepIdx++) {
      const beforeEval = evalStageDailyPP(stageLvls, stageScavObj);
      const beforeR = computeMineRates(stageLvls, input, rules, false);
      let bestAction: {
        kind: 'bldg' | 'scav4';
        key: string;
        costPP: number;
        costRes: number;
        deltaDailyPP: number;
        deltaHr: number;
        paybackDays: number;
        apply: () => void;
      } | null = null;

      // A. Candidate building upgrades: Mines + Warehouse (if overflowing) + Market (if merchant-bottlenecked)
      const bldgCandidates: string[] = [...MINE_NAMES];
      if (beforeEval.dailyOverflow > 100 && (stageLvls['المخازن'] || 1) < 25) {
        bldgCandidates.push('المخازن');
      }
      if (
        (beforeEval.dailyBottleneck > 100 || (stageLvls['السوق'] || 0) < 1) &&
        (stageLvls['السوق'] || 0) < 20 &&
        checkBuildingPrerequisites('السوق', stageLvls)
      ) {
        bldgCandidates.push('السوق');
      }

      for (const bName of bldgCandidates) {
        const cur = stageLvls[bName] || 0;
        const maxLvl = BUILDINGS_DATA[bName]?.max_lvl ?? 30;
        if (cur >= maxLvl) continue;
        const cost = getBuildingLevelCost(bName, cur + 1);
        const rew = calcBuildReward(cost, rules, buildingQuestsEnabled);
        const netW = Math.max(0, cost.w - rew.w);
        const netC = Math.max(0, cost.c - rew.c);
        const netI = Math.max(0, cost.i - rew.i);
        const netRes = Math.max(40, netW + netC + netI);
        const costPP = Math.max(0.2, calcSplitResourcesPP(netW, netC, netI, stageRatesObj));

        stageLvls[bName] = cur + 1;
        const afterEval = evalStageDailyPP(stageLvls, stageScavObj);
        const afterR = computeMineRates(stageLvls, input, rules, false);
        stageLvls[bName] = cur;

        const deltaDailyPP = afterEval.dailyPP - beforeEval.dailyPP;
        if (deltaDailyPP <= 0.05) continue;
        const paybackDays = costPP / deltaDailyPP;
        if (paybackDays < totalHorizonDays) {
          if (!bestAction || paybackDays < bestAction.paybackDays) {
            const deltaHr = Math.max(0, afterR.totalHr - beforeR.totalHr);
            bestAction = {
              kind: 'bldg',
              key: bName,
              costPP,
              costRes: netRes,
              deltaDailyPP,
              deltaHr,
              paybackDays,
              apply: () => {
                stageLvls[bName] = cur + 1;
                upCounts[bName] = (upCounts[bName] || 0) + 1;
              }
            };
          }
        }
      }

      // B. Candidate Scavenging Tier 4 upgrade (if unlocked < 4 and Rally Point >= 1)
      if (
        stageScavTier === 3 &&
        (stageLvls['نقطة التجمع'] || 0) >= 1 &&
        (stageLvls['الثكنات'] || 0) >= 1
      ) {
        const t4Cfg = SCAV_UNLOCK_DATA['4'];
        if (t4Cfg) {
          const reqWh = getMinWarehouseLevelForCost({ w: t4Cfg.wood, c: t4Cfg.clay, i: t4Cfg.iron });
          const curWh = stageLvls['المخازن'] || 1;
          const whStats = getWarehouseUpgradeChainStats(
            curWh,
            reqWh,
            stageLvls['المبنى الرئيسي'] || 1,
            input.worldSpeed,
            input.freeFinish,
            freeFinishSec,
            rules,
            buildingQuestsEnabled
          );
          const curHaul = stageSpears * 25 + swordsReady * 15 + knightsReady * 100;
          const extraSp = Math.max(0, Math.ceil((3400 - curHaul) / 25));
          const totalW = t4Cfg.wood + extraSp * 50 + whStats.netResCost / 3;
          const totalC = t4Cfg.clay + extraSp * 30 + whStats.netResCost / 3;
          const totalI = t4Cfg.iron + extraSp * 10 + whStats.netResCost / 3;
          const costPP = Math.max(1, calcSplitResourcesPP(totalW, totalC, totalI, stageRatesObj));
          const costRes = totalW + totalC + totalI;

          const nextScav = getScavCached(stageSpears + extraSp, swordsReady, knightsReady, 4);
          const savedWh = stageLvls['المخازن'] || 1;
          if (reqWh > savedWh) stageLvls['المخازن'] = reqWh;
          const afterEval = evalStageDailyPP(stageLvls, nextScav);
          stageLvls['المخازن'] = savedWh;

          const deltaDailyPP = afterEval.dailyPP - beforeEval.dailyPP;
          if (deltaDailyPP > 0.5) {
            const paybackDays = costPP / deltaDailyPP;
            if (paybackDays < totalHorizonDays * 0.85) {
              if (!bestAction || paybackDays < bestAction.paybackDays) {
                const deltaHr = Math.max(0, nextScav.effHourly - stageScavObj.effHourly);
                bestAction = {
                  kind: 'scav4',
                  key: 'إغارة4',
                  costPP,
                  costRes,
                  deltaDailyPP,
                  deltaHr,
                  paybackDays,
                  apply: () => {
                    if (reqWh > (stageLvls['المخازن'] || 1)) {
                      upCounts['المخازن'] += reqWh - (stageLvls['المخازن'] || 1);
                      stageLvls['المخازن'] = reqWh;
                    }
                    stageSpears += extraSp;
                    stageScavTier = 4;
                    stageScavObj = nextScav;
                    upCounts['إغارة4'] = 1;
                  }
                };
              }
            }
          }
        }
      }

      if (!bestAction) break;
      if (stageCostPP + bestAction.costPP > sellOnlyPP * 0.45) break;

      bestAction.apply();
      stageCostPP += bestAction.costPP;
      stageCostRes += bestAction.costRes;
      addedDailyPP += bestAction.deltaDailyPP;
      addedHourlyTotal += bestAction.deltaHr;
    }

    const totalUpgrades =
      upCounts['الخشاب'] +
      upCounts['حفرة الطمي'] +
      upCounts['منجم الحديد'] +
      upCounts['المخازن'] +
      upCounts['السوق'] +
      upCounts['إغارة4'];
    const upParts: string[] = [];
    if (upCounts['الخشاب'] > 0) upParts.push(`خشب +${upCounts['الخشاب']}`);
    if (upCounts['حفرة الطمي'] > 0) upParts.push(`طمي +${upCounts['حفرة الطمي']}`);
    if (upCounts['منجم الحديد'] > 0) upParts.push(`حديد +${upCounts['منجم الحديد']}`);
    if (upCounts['المخازن'] > 0) upParts.push(`مخزن +${upCounts['المخازن']}`);
    if (upCounts['السوق'] > 0) upParts.push(`سوق +${upCounts['السوق']}`);
    if (upCounts['إغارة4'] > 0) upParts.push('فتح إغارة م4');

    const endingEval = evalStageDailyPP(stageLvls, stageScavObj);
    const endingRates = computeMineRates(stageLvls, input, rules, false);
    const extraStagePP = addedDailyPP * cfg.days * 0.72;
    const netStagePP = Math.max(0, sellOnlyPP + extraStagePP - stageCostPP);
    const paybackDays =
      addedDailyPP > 0 ? Math.round((stageCostPP / addedDailyPP) * 10) / 10 : null;

    runningCumPP += netStagePP;

    stages.push({
      stageNum,
      label,
      enabled: true,
      days: cfg.days,
      startRate: cfg.startRate,
      endRate: cfg.endRate,
      avgRate,
      sellOnlyPP: Math.round(sellOnlyPP),
      upgradesDesc: upParts.length > 0 ? upParts.join(' · ') : 'بدون ترقية',
      upgradesCount: totalUpgrades,
      paybackDays,
      netStagePP: Math.round(netStagePP),
      ppPerDay: Math.round((netStagePP / Math.max(1, cfg.days)) * 10) / 10,
      endingHourlyProd: Math.round(endingRates.totalHr + stageScavObj.effHourly),
      overflowLossRes: Math.round(endingEval.dailyOverflow * cfg.days),
      merchantBottleneckRes: Math.round(endingEval.dailyBottleneck * cfg.days)
    });

    chartPoints.push({
      key: `s${stageNum}`,
      label,
      cumulativePP: Math.round(runningCumPP),
      stagePP: Math.round(netStagePP)
    });
  }

  // Ensure chronological order across parallel HQ/Barracks/Smithy/Statue/Scav queues
  if (recordTrace && steps.length > 1) {
    const indexed = steps.map((s, idx) => ({ s, idx }));
    indexed.sort((a, b) => a.s.tStart - b.s.tStart || a.idx - b.idx);
    for (let i = 0; i < indexed.length; i++) {
      steps[i] = { ...indexed[i].s, stepNum: i + 1 };
    }
  }

  const actualSummary = buildExecutedSummary(
    lvls,
    scavUnlocked,
    spearsReady,
    swordsReady,
    knightsReady
  );

  return {
    s1NetPP: Math.round(s1NetPP),
    s1GrossPP: Math.round(s1GrossPP),
    totalCumulativePP: Math.round(runningCumPP),
    usedBoostPP: Math.round(usedBoostPP * 10) / 10,
    unspentBoostPP: Math.round(remBoostPP * 10) / 10,
    minePP: Math.round(minePP),
    scavPP: Math.round(scavPP),
    mineSharePct,
    scavSharePct,
    scavRunsTotal: scavRunsDev + harvestScavRuns,
    scavLootTotal: Math.round(cumScavResDev + harvestScavRes),
    startPoints,
    endPoints,
    gainedPoints: Math.max(0, endPoints - startPoints),
    finalHourlyMineProd: Math.round(displayFinalRates.totalHr),
    steadyHourlyMineProd: Math.round(baseFinalRates.totalHr),
    finalHourlyScavProd: Math.round(finalScav.effHourly),
    finalHourlyTotal: Math.round(displayFinalRates.totalHr + finalScav.effHourly),
    finalSpears: spearsReady,
    finalSwords: swordsReady,
    finalPaladins: knightsReady,
    finalScavTier: scavUnlocked,
    startBuildings,
    finalBuildings: lvls,
    stages,
    chartPoints,
    steps,
    snapshots,
    finalScavDispatch: finalScav,
    dailyMinePP: Math.round(dailyMinePP * 10) / 10,
    dailyScavPP: Math.round(dailyScavPP * 10) / 10,
    dailyTotalPP: Math.round(dailyTotalPP * 10) / 10,
    steadyDailyMinePP: Math.round(steadyDailyMinePP * 10) / 10,
    steadyDailyScavPP: Math.round(steadyDailyScavPP * 10) / 10,
    steadyDailyTotalPP: Math.round(steadyDailyTotalPP * 10) / 10,
    boost30ExtraPP: Math.round(boost30ExtraPP * 10) / 10,
    devSoldPP: Math.round(devSoldPP * 10) / 10,
    loginIntervalSec,
    boost30ActiveStartSec: boost30StartSec,
    boost30ActiveEndSec: boost30EndSec,
    boost30ExtraRes: Math.round(cumBoost30ExtraRes),
    offlineOverflowLossRes: Math.round(offlineOverflowLossRes),
    devOverflowLossRes: Math.round(devOverflowLossRes),
    dailyMerchantCapRes: Math.round(dailyMerchantCapRes),
    dailySellableRes: Math.round(dailySellableRes),
    merchantBottleneckRes: Math.round(merchantBottleneckRes),
    dayScavRunsDev,
    overnightScavRunsDev,
    arbitrageBonusRes: Math.round(arbitrageBonusRes),
    effectiveDevHours,
    actualSummary
  };
}

/**
 * Intelligent 500+ Scenario Tactical Simulator:
 * Evaluates 600+ genuinely distinct strategic genomes with strict Tribal Wars rules
 * (Warehouse & Farm capacity chains, official prerequisites, real parallel research & troop queues),
 * ranks the top 5 distinct strategies, and returns the full step-by-step trace for the winning
 * (or user-selected) strategy!
 */
export function runTacticalSimulation(
  rawInput: TacticalStudioInput,
  state?: ErpAppState,
  forcedPolicy?: TacticalStrategyPolicy | null
): TacticalSimulationResult {
  const input = normalizeInput(rawInput);
  const rules = state?.gameRules;
  const start = resolveStartState(input, state);
  const scavCache = new Map<string, ScavDispatchResult>();

  // 1. Evaluate classic baseline for transparent gain comparison
  const baselinePolicy = createBaselinePolicy(input);
  const baselineCore = evaluateSingleScenario(
    input,
    baselinePolicy,
    start,
    rules,
    scavCache,
    false
  );

  // 2. Sweep 600+ genuinely distinct scenarios in fast numeric mode
  const policies = generateScenarioMatrix(input, { sweepDevStopRatio: false, start });
  const evaluated: Array<{
    policy: TacticalStrategyPolicy;
    core: SingleSimCoreOutput;
  }> = [];

  for (const pol of policies) {
    const core = evaluateSingleScenario(input, pol, start, rules, scavCache, false);
    evaluated.push({ policy: pol, core });
  }

  // Sort strictly by Total Cumulative PP (tie-break by S1 Net PP, then hourly output)
  evaluated.sort((a, b) => {
    if (b.core.totalCumulativePP !== a.core.totalCumulativePP) {
      return b.core.totalCumulativePP - a.core.totalCumulativePP;
    }
    if (b.core.s1NetPP !== a.core.s1NetPP) {
      return b.core.s1NetPP - a.core.s1NetPP;
    }
    return b.core.finalHourlyTotal - a.core.finalHourlyTotal;
  });

  // Pick top 5 genuinely distinct strategies
  const topStrategies: StrategyCandidateSummary[] = [];
  const seenSignatures = new Set<string>();

  const pushCandidate = (pol: TacticalStrategyPolicy, core: SingleSimCoreOutput) => {
    const sig = `${pol.archetype}|${pol.arbitrageMode}|${pol.usePaladin ? 1 : 0}|${pol.useIronSwords ? 1 : 0}|${core.finalScavTier}|${core.finalBuildings['الخشاب'] || 0}|${Math.round(core.finalSpears / 15)}`;
    if (seenSignatures.has(sig)) return;
    seenSignatures.add(sig);
    const honestLabel = buildHonestExecutedLabel(pol, core);
    topStrategies.push({
      id: pol.id,
      policy: { ...pol, label: honestLabel },
      label: honestLabel,
      archetype: pol.archetype,
      archetypeLabel: ARCHETYPE_LABELS[pol.archetype],
      s1NetPP: core.s1NetPP,
      totalCumulativePP: core.totalCumulativePP,
      gainVsBaselinePP: core.totalCumulativePP - baselineCore.totalCumulativePP,
      finalHourlyMineProd: core.finalHourlyMineProd,
      finalHourlyScavProd: core.finalHourlyScavProd,
      finalSpears: core.finalSpears,
      finalSwords: core.finalSwords,
      finalPaladins: core.finalPaladins,
      finalScavTier: core.finalScavTier,
      woodLvl: core.finalBuildings['الخشاب'] || 0,
      clayLvl: core.finalBuildings['حفرة الطمي'] || 0,
      ironLvl: core.finalBuildings['منجم الحديد'] || 0,
      hqLvl: core.finalBuildings['المبنى الرئيسي'] || 1,
      barracksLvl: core.finalBuildings['الثكنات'] || 0,
      whLvl: core.finalBuildings['المخازن'] || 1,
      farmLvl: core.finalBuildings['المزارع'] || 1,
      actualSummary: core.actualSummary,
      effectiveDevHours: core.effectiveDevHours,
      arbitrageBonusRes: core.arbitrageBonusRes
    });
  };

  if (evaluated.length > 0) {
    pushCandidate(evaluated[0].policy, evaluated[0].core);
  }
  const archetypesSeen = new Set<StrategyArchetype>(
    evaluated.length > 0 ? [evaluated[0].policy.archetype] : []
  );
  for (const item of evaluated) {
    if (topStrategies.length >= 5) break;
    if (!archetypesSeen.has(item.policy.archetype)) {
      archetypesSeen.add(item.policy.archetype);
      pushCandidate(item.policy, item.core);
    }
  }
  for (const item of evaluated) {
    if (topStrategies.length >= 5) break;
    pushCandidate(item.policy, item.core);
  }
  topStrategies.sort((a, b) => b.totalCumulativePP - a.totalCumulativePP);

  // 3. Re-run the winning (or user-selected rival) policy in FULL trace mode
  const activePolicy = forcedPolicy || evaluated[0]?.policy || baselinePolicy;
  const fullCore = evaluateSingleScenario(
    input,
    activePolicy,
    start,
    rules,
    scavCache,
    true
  );
  const honestActivePolicy: TacticalStrategyPolicy = {
    ...activePolicy,
    label: buildHonestExecutedLabel(activePolicy, fullCore)
  };

  return {
    input,
    ...fullCore,
    scenariosTested: policies.length,
    winningPolicy: honestActivePolicy,
    baselineTotalPP: baselineCore.totalCumulativePP,
    gainVsBaselinePP: fullCore.totalCumulativePP - baselineCore.totalCumulativePP,
    topStrategies
  };
}

/**
 * Deep Global Auto-Search ("بحث تلقائي"):
 * Sweeps BOTH optimal development horizon (`devHours`) AND 600+ strategic genomes (800+ total scenarios)
 * to discover the absolute mathematical maximum PP path!
 */
export function runTacticalAutoSearch(
  rawBaseInput: TacticalStudioInput,
  state?: ErpAppState
): TacticalAutoSearchResult {
  const baseInput = normalizeInput(rawBaseInput);
  const rules = state?.gameRules;
  const start = resolveStartState(baseInput, state);
  const scavCache = new Map<string, ScavDispatchResult>();

  const maxDev = Math.max(18, Math.min(120, Math.round(baseInput.s1Days * 24 * 0.78)));
  const devCandidates = Array.from(
    new Set(
      [18, 24, 30, 36, 42, 48, 54, 60, 72, baseInput.devHours].filter((h) => h >= 6 && h <= maxDev)
    )
  ).sort((a, b) => a - b);

  const policyPool = generateScenarioMatrix(baseInput, { sweepDevStopRatio: false, start });
  let bestInput = baseInput;
  let bestPolicy = policyPool[0];
  let bestPP = -1;
  let testedCount = 0;

  // Stage 1: Full scenario sweep at baseInput.devHours to score every policy
  const scoredAtBase: Array<{ policy: TacticalStrategyPolicy; pp: number }> = [];
  for (const pol of policyPool) {
    const res = evaluateSingleScenario(baseInput, pol, start, rules, scavCache, false);
    testedCount++;
    scoredAtBase.push({ policy: pol, pp: res.totalCumulativePP });
    if (res.totalCumulativePP > bestPP) {
      bestPP = res.totalCumulativePP;
      bestInput = baseInput;
      bestPolicy = pol;
    }
  }
  scoredAtBase.sort((a, b) => b.pp - a.pp);

  // Stratified diverse elite pool: top 12 from EACH of the 5 archetypes (up to 60 diverse policies)
  const archetypeCounts = new Map<StrategyArchetype, number>();
  const topElite: TacticalStrategyPolicy[] = [];
  const eliteIds = new Set<string>();
  for (const item of scoredAtBase) {
    const cnt = archetypeCounts.get(item.policy.archetype) || 0;
    if (cnt < 12) {
      archetypeCounts.set(item.policy.archetype, cnt + 1);
      topElite.push(item.policy);
      eliteIds.add(item.policy.id);
    }
  }
  for (const item of scoredAtBase) {
    if (topElite.length >= 60) break;
    if (!eliteIds.has(item.policy.id)) {
      topElite.push(item.policy);
      eliteIds.add(item.policy.id);
    }
  }

  // Stage 2: Cross-test stratified elite pool across all devHours candidates
  for (const devHours of devCandidates) {
    if (devHours === baseInput.devHours) continue;
    const candInput: TacticalStudioInput = { ...baseInput, devHours };
    for (const pol of topElite) {
      const res = evaluateSingleScenario(candInput, pol, start, rules, scavCache, false);
      testedCount++;
      if (res.totalCumulativePP > bestPP + 0.5) {
        bestPP = res.totalCumulativePP;
        bestInput = candInput;
        bestPolicy = pol;
      }
    }
  }

  const finalResult = runTacticalSimulation(bestInput, state, bestPolicy);
  return {
    bestInput,
    bestResult: {
      ...finalResult,
      scenariosTested: testedCount
    },
    testedCount
  };
}

/**
 * Convert TacticalSimulationResult into AssignedPlan compatible with VillageDetailPage & missionEngine
 */
export function buildAssignedPlanFromTacticalResult(
  result: TacticalSimulationResult,
  customName?: string
): AssignedPlan {
  const actionable = result.steps.filter(
    (s) => s.atype !== 'scav_return' && s.atype !== 'sell_surplus'
  );
  const planSteps: AssignedPlanStep[] = actionable.map((s, idx) => ({
    stepNum: idx + 1,
    atype: s.atype,
    bName: s.bName,
    baseName: s.baseName,
    targetLvl: s.lvl,
    lvl: s.lvl,
    tStart: s.tStart,
    tEnd: s.tEnd,
    cost: { ...s.cost },
    reason: s.reason
  }));

  const defaultName = `${result.winningPolicy.label} (${result.input.s1Days} أيام · ${result.totalCumulativePP.toLocaleString('en-US')} نقطة)`;

  return {
    id: `plan_${Date.now()}`,
    name: customName?.trim() ? customName.trim() : defaultName,
    isRealVillageBased: result.input.simMode === 'real',
    assignedAt: Date.now(),
    steps: planSteps
  };
}
