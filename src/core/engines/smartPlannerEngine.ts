import {
  BASE_BUILD_TIME,
  BUILDINGS_DATA,
  LEVEL_TIME_FACTORS,
  MINE_BASE_PROD,
  SCAV_UNLOCK_DATA
} from '../constants/gameData';
import type {
  AssignedPlan,
  AssignedPlanStep,
  ErpAppState,
  ErpVillage
} from '../types';
import {
  calcVillagePointsFromBuildings,
  computeVillageLiveStatus,
  getBuildingTotalPop,
  getFarmCap,
  getMerchantsCount,
  getWarehouseCap,
  makeStarter26Buildings,
  normalizeBuildingsMap
} from './resourceEngine';
import { getScavDurationSec } from './scavengingEngine';

export type PlannerGoal = 'max_net_pp' | 'max_end_daily_pp';
export type PlannerSourceMode = 'virtual26' | 'real';

export interface SmartPlannerInput {
  sourceMode: PlannerSourceMode;
  villageId?: string;
  villageName?: string;
  /** Optimization horizon in days (e.g., 5, 7, 14, 30) */
  horizonDays: number;
  /** World speed multiplier (e.g., 1, 1.2, 1.5, 2) */
  worldSpeed: number;
  /** Active play hours per 24h day (0..24, e.g., 12) */
  activeHoursPerDay: number;
  /** Soft preference for max daytime scavenging cycle hours (optimizer can still use full overnight blast) */
  maxSessionHours: number;
  /** Resources per 1 PP for Wood, Clay, Iron */
  sellWood: number;
  sellClay: number;
  sellIron: number;
  /** Optimization goal */
  goal: PlannerGoal;
  /** New Quest System building completion rewards (10% min 150/150/100) */
  enableQuestRewards: boolean;
  rewardPct: number;
  minRewardW: number;
  minRewardC: number;
  minRewardI: number;
  /** Free instant build completion threshold in seconds (default 180s = 3m) */
  enableFreeFinish: boolean;
  freeFinishSec: number;
  /** Optional hint (kept for compatibility; unconstrained optimizer freely explores higher HQ/Barracks if better!) */
  maxOpeningHQ: number;
  /** Optional hint (optimizer automatically tests with and without bundle) */
  enableBarracksWallBundle: boolean;
  /** Enforce Market merchant carrying capacity when selling resources */
  enforceMarketMerchants: boolean;
  /** Production boosts */
  premium: boolean;
  boost30: boolean;
  flagPct: number;
  woodItemPct: number;
  clayItemPct: number;
  ironItemPct: number;
  /** Initial village state (populated from 26-pt defaults or selected real village) */
  startBuildings: Record<string, number>;
  startStock: { w: number; c: number; i: number };
  startSpears: number;
  startSwords?: number;
  startLights?: number;
  startPaladins?: number;
  /** Extra carry capacity from non-modeled existing troops (axes, archers, heavies, etc.) */
  otherUnitsCarryCap: number;
  /** Population already used by non-modeled existing troops */
  otherUnitsPop: number;
  startUnlockedScavTiers: number;
}

export type SmartStepPhase = 'opening' | 'launch_24h' | 'growth' | 'harvest';

export type SmartStepActionType =
  | 'bldg'
  | 'train_spear'
  | 'train_paladin'
  | 'train_sword'
  | 'train_light'
  | 'scav_unlock';

export interface SmartPlanStep extends AssignedPlanStep {
  stepNum: number;
  atype: SmartStepActionType;
  bName: string;
  baseName?: string;
  targetLvl: number;
  countDelta?: number;
  tStart: number;
  tEnd: number;
  durSec: number;
  cost: { w: number; c: number; i: number };
  reward: { w: number; c: number; i: number };
  netCostRes: number;
  phase: SmartStepPhase;
  reason: string;
}

export interface DayTrajectoryPoint {
  day: number;
  label: string;
  hour: number;
  cumNetPP: number;
  cumSoldPP: number;
  dailyMinesPP: number;
  dailyScavPP: number;
  dailyTotalPP: number;
  spears: number;
  scavTiers: number;
  avgMineLvl: number;
  minesLabel: string;
  warehouseCap: number;
}

export interface Checkpoint24hSummary {
  dailyMinesPP: number;
  dailyScavPP: number;
  dailyTotalPP: number;
  dailyMinesRes: number;
  dailyScavRes: number;
  spears: number;
  paladins: number;
  swords: number;
  lights: number;
  totalCarry: number;
  scavTiers: number;
  woodLvl: number;
  clayLvl: number;
  ironLvl: number;
  hqLvl: number;
  warehouseLvl: number;
  barracksLvl: number;
  cumNetPP: number;
}

export interface OpeningSummary {
  stepsCount: number;
  durationSec: number;
  netProfitRes: number;
  overflowRes: number;
  endStock: { w: number; c: number; i: number };
  endBuildings: Record<string, number>;
  endPoints: number;
  usedBarracksWallBundle: boolean;
  philosophyLabel: string;
}

export interface OptimalScavSlotPlan {
  tier: number;
  name: string;
  lootFactor: number;
  carry: number;
  loot: number;
  durSec: number;
}

export interface OptimalScavAllocation {
  slots: OptimalScavSlotPlan[];
  totalLoot: number;
  hourlyLoot: number;
  maxDurSec: number;
}

export interface SmartStrategyResult {
  id: string;
  key: 'pure_mines' | 'hybrid_t2' | 'hybrid_t3' | 'deep_t4' | 'global_opt';
  name: string;
  tagline: string;
  isWinner: boolean;
  /** Primary objective score */
  score: number;
  /** Total net PP over horizon (sold + end warehouse value) */
  totalNetPP: number;
  /** Strictly sold PP via market during horizon */
  soldPP: number;
  /** Unsold warehouse PP at end of horizon */
  endingStockPP: number;
  /** Daily PP rate at end of horizon */
  endDailyMinesPP: number;
  endDailyScavPP: number;
  endDailyTotalPP: number;
  /** 24-hour checkpoint */
  checkpoint24h: Checkpoint24hSummary;
  /** Opening phase summary */
  openingSummary: OpeningSummary;
  /** Resource ledger */
  totalMineRes: number;
  totalScavRes: number;
  totalQuestRewardRes: number;
  totalSpentRes: number;
  totalOverflowRes: number;
  /** Army & Scavenging intelligence */
  finalSpears: number;
  finalPaladins: number;
  finalSwords: number;
  finalLights: number;
  totalArmyCarry: number;
  spearsTrained: number;
  finalScavTiers: number;
  scavRunsCount: number;
  lastSpearTrainHour: number | null;
  lastMineUpgradeHour: number | null;
  spearCutoffReason: string;
  /** Recommended exact scavenging splits for the final army */
  recommendedOnlineSplit: OptimalScavAllocation;
  recommendedOvernightSplit: OptimalScavAllocation;
  /** Executive Arabic explanations of why the optimizer picked this exact plan */
  keyDecisions: string[];
  /** Final village buildings & points */
  finalBuildings: Record<string, number>;
  finalPoints: number;
  /** Full timeline & charts */
  steps: SmartPlanStep[];
  dayTrajectory: DayTrajectoryPoint[];
}

export interface SmartPlannerOutput {
  input: SmartPlannerInput;
  winner: SmartStrategyResult;
  /** Internal evaluated strategies (winner + reference baselines) */
  strategies: SmartStrategyResult[];
  /** Net PP gain of winner over Pure Mines baseline */
  gainOverPureMinesPP: number;
  gainOverPureMinesPct: number;
  /** How many candidate strategy genomes were searched */
  evaluatedGenomesCount: number;
  computeMs: number;
}

type OpeningStyle = 'instant_barracks_paladin' | 'instant_barracks' | 'quest_harvest_first';

interface StrategyGenome {
  id: string;
  key: SmartStrategyResult['key'];
  name: string;
  tagline: string;
  openingStyle: OpeningStyle;
  maxScavTier: number;
  maxSpearsCap: number;
  /** Use Statue L1 + Paladin (+100 carry in parallel with Barracks!) */
  usePaladin: boolean;
  /** Allow training Swords when Iron overflows Wood */
  useSwords: boolean;
  /** Allow Stable + Light Cavalry parallel training on longer/faster worlds */
  useLightCav: boolean;
  /** Multiplier favoring army vs mines (0 = no army, 1 = balanced, >1.5 = army-heavy) */
  spearBias: number;
  /** Multiplier on mine ROI vs army ROI */
  mineWeight: number;
  /** Shadow-price boost on scarce Wood (and Clay) when training Spears */
  woodShadowBoost: number;
  /** Stop training army when payback > remHrs * spearCutoffRatio */
  spearCutoffRatio: number;
  /** Stop upgrading mines when payback > remHrs * mineCutoffRatio */
  mineCutoffRatio: number;
  /** Max HQ level allowed */
  maxHQ: number;
  /** Max Barracks level allowed */
  maxBarracks: number;
  /** Barracks urgency factor (0.5 = conservative, 2.0 = rush Barracks for 24/7 troop output) */
  barracksAggression: number;
  /** Minimum spears before unlocking T3 / T4 */
  t3MinSpears: number;
  t4MinSpears: number;
  /** Target spear batch size */
  spearBatchSize: number;
  /** Max daytime scavenging cycle cap in hours (0 = unconstrained max hourly rate!) */
  onlineRunCapHrs: number;
  /** Whether to execute Barracks L1 + Wall L1-4 quest harvest */
  useBarracksWallBundle: boolean;
}

const SPEAR_COST = { w: 50, c: 30, i: 10, total: 90, carry: 25, pop: 1 } as const;
const SWORD_COST = { w: 30, c: 30, i: 70, total: 130, carry: 15, pop: 1 } as const;
const LIGHT_COST = { w: 125, c: 100, i: 250, total: 475, carry: 80, pop: 4 } as const;
const PALADIN_COST = { w: 20, c: 20, i: 40, total: 80, carry: 100, pop: 10 } as const;
const MINES_LIST = ['الخشاب', 'حفرة الطمي', 'منجم الحديد'] as const;
const TIER_LFS = [0.1, 0.25, 0.5, 0.75] as const;
const TIER_NAMES = [
  'الفئة 1 (الضعيفة · 10%)',
  'الفئة 2 (المتوسطة · 25%)',
  'الفئة 3 (الذكية · 50%)',
  'الفئة 4 (الكبرى · 75%)'
] as const;

export function createDefaultSmartPlannerInput(
  state?: ErpAppState,
  village?: ErpVillage | null
): SmartPlannerInput {
  const rules = state?.gameRules;
  const rewardPct = Number(rules?.rewPct ?? 10) / 100;
  const minRewardW = Number(rules?.minRewW ?? 150);
  const minRewardC = Number(rules?.minRewC ?? 150);
  const minRewardI = Number(rules?.minRewI ?? 100);
  const freeFinishSec = Number(rules?.freeFinishSec ?? 180);

  if (village && state) {
    const live = computeVillageLiveStatus(village, state);
    const bldgs = normalizeBuildingsMap(village.buildings, village);
    const spearsTotal = Number(
      village.unitsTotal?.spear ??
        village.spearsTotal ??
        village.scavData?.spearsTotal ??
        live.armyMatrix.find((u) => u.key === 'spear')?.total ??
        0
    );
    const swordsTotal = Number(
      village.unitsTotal?.sword ??
        village.swordsTotal ??
        live.armyMatrix.find((u) => u.key === 'sword')?.total ??
        0
    );
    const lightsTotal = Number(
      village.unitsTotal?.light ??
        live.armyMatrix.find((u) => u.key === 'light')?.total ??
        0
    );
    const paladinsTotal = Number(
      village.unitsTotal?.knight ??
        live.armyMatrix.find((u) => u.key === 'knight')?.total ??
        0
    );
    const modeledCarry =
      spearsTotal * SPEAR_COST.carry +
      swordsTotal * SWORD_COST.carry +
      lightsTotal * LIGHT_COST.carry +
      paladinsTotal * PALADIN_COST.carry;
    const otherCarryCap = Math.max(0, live.haulTotal - modeledCarry);
    let otherPop = 0;
    for (const u of live.armyMatrix) {
      if (u.key === 'spear' || u.key === 'sword' || u.key === 'light' || u.key === 'knight') {
        continue;
      }
      const popPerUnit =
        u.key === 'marcher'
          ? 5
          : u.key === 'heavy'
            ? 6
            : u.key === 'spy'
              ? 2
              : u.key === 'ram'
                ? 5
                : u.key === 'catapult'
                  ? 8
                  : u.key === 'snob'
                    ? 100
                    : 1;
      otherPop += u.total * popPerUnit;
    }
    const unlockedTiers = Math.max(
      0,
      Math.min(
        4,
        Number(
          village.unlockedScavTiers ||
            village.scavData?.unlockedScavTiers ||
            village.scavData?.unlockedTiers ||
            0
        )
      )
    );

    return {
      sourceMode: 'real',
      villageId: village.id,
      villageName: village.name,
      horizonDays: 5,
      worldSpeed: Math.max(0.5, Number(live.worldSpeed || 1)),
      activeHoursPerDay: 12,
      maxSessionHours: 4,
      sellWood: Math.max(64, Number(live.sellWood || 64)),
      sellClay: Math.max(64, Number(live.sellClay || 64)),
      sellIron: Math.max(64, Number(live.sellIron || 64)),
      goal: 'max_net_pp',
      enableQuestRewards: true,
      rewardPct: Number.isFinite(rewardPct) && rewardPct > 0 ? rewardPct : 0.1,
      minRewardW,
      minRewardC,
      minRewardI,
      enableFreeFinish: true,
      freeFinishSec,
      maxOpeningHQ: 10,
      enableBarracksWallBundle: true,
      enforceMarketMerchants: false,
      premium: Boolean(village.premium),
      boost30: Boolean(village.boost30),
      flagPct: Number(village.flag || 0),
      woodItemPct: Number(village.woodItem || 0),
      clayItemPct: Number(village.clayItem || 0),
      ironItemPct: Number(village.ironItem || 0),
      startBuildings: bldgs,
      startStock: {
        w: Math.round(live.currentWood),
        c: Math.round(live.currentClay),
        i: Math.round(live.currentIron)
      },
      startSpears: Math.max(0, Math.round(spearsTotal)),
      startSwords: Math.max(0, Math.round(swordsTotal)),
      startLights: Math.max(0, Math.round(lightsTotal)),
      startPaladins: Math.max(0, Math.round(paladinsTotal)),
      otherUnitsCarryCap: Math.max(0, Math.round(otherCarryCap)),
      otherUnitsPop: Math.max(0, Math.round(otherPop)),
      startUnlockedScavTiers: unlockedTiers
    };
  }

  // Fresh 26-point starter village
  const activeWorld =
    state?.worlds?.find((w) => w.id === state.selectedWorldFilter) || state?.worlds?.[0];
  const worldSpeed = Math.max(0.5, Number(activeWorld?.speed || 1));

  return {
    sourceMode: 'virtual26',
    horizonDays: 5,
    worldSpeed,
    activeHoursPerDay: 12,
    maxSessionHours: 4,
    sellWood: 64,
    sellClay: 64,
    sellIron: 64,
    goal: 'max_net_pp',
    enableQuestRewards: true,
    rewardPct: Number.isFinite(rewardPct) && rewardPct > 0 ? rewardPct : 0.1,
    minRewardW,
    minRewardC,
    minRewardI,
    enableFreeFinish: true,
    freeFinishSec,
    maxOpeningHQ: 10,
    enableBarracksWallBundle: true,
    enforceMarketMerchants: false,
    premium: false,
    boost30: false,
    flagPct: 0,
    woodItemPct: 0,
    clayItemPct: 0,
    ironItemPct: 0,
    startBuildings: makeStarter26Buildings(),
    startStock: { w: 500, c: 500, i: 400 },
    startSpears: 0,
    startSwords: 0,
    startLights: 0,
    startPaladins: 0,
    otherUnitsCarryCap: 0,
    otherUnitsPop: 0,
    startUnlockedScavTiers: 0
  };
}

/**
 * Official Tribal Wars unit training duration in seconds.
 * Verified against live server XML (`spear=1020`, `sword=1500`, `light=1800`, `paladin=21600`).
 * Formula: round(baseSec * (2/3) * 1.06^(-bldgLvl) / worldSpeed)
 */
export function getOfficialUnitTrainSec(
  unit: 'spear' | 'sword' | 'light' | 'paladin',
  bldgLvl: number,
  worldSpeed: number
): number {
  const ws = Math.max(0.1, Number(worldSpeed) || 1);
  if (unit === 'paladin') {
    return Math.max(60, Math.round(21600 / ws));
  }
  const baseSec = unit === 'spear' ? 1020 : unit === 'sword' ? 1500 : 1800;
  const maxLvl = unit === 'light' ? 20 : 25;
  const bl = Math.max(1, Math.min(maxLvl, Math.floor(bldgLvl || 1)));
  return Math.max(1, Math.round((baseSec * (2 / 3) * Math.pow(1.06, -bl)) / ws));
}

export function getOfficialSpearTrainSec(barracksLvl: number, worldSpeed: number): number {
  return getOfficialUnitTrainSec('spear', barracksLvl, worldSpeed);
}

/**
 * Official Tribal Wars building construction duration in seconds (`buildtime_formula = 2`),
 * optionally subtracting the free instant-completion threshold (<= 180s).
 */
export function getOfficialBuildSec(
  bName: string,
  targetLvl: number,
  hqLvl: number,
  worldSpeed: number,
  enableFreeFinish: boolean,
  freeFinishSec: number
): number {
  const basePair = BASE_BUILD_TIME[bName];
  if (!basePair || targetLvl < 1) return 0;
  const [baseSec, minSec] = basePair;
  const factor = LEVEL_TIME_FACTORS[Math.min(LEVEL_TIME_FACTORS.length, targetLvl) - 1] ?? 1;
  const ws = Math.max(0.1, Number(worldSpeed) || 1);
  const hq = Math.max(1, Math.min(30, Math.floor(hqLvl || 1)));
  const raw = Math.max(minSec, Math.round((baseSec * factor * Math.pow(1.05, -hq)) / ws));
  if (enableFreeFinish && freeFinishSec > 0) {
    return Math.max(0, raw - freeFinishSec);
  }
  return raw;
}

export function getBuildingUpgradeCost(
  bName: string,
  targetLvl: number
): { w: number; c: number; i: number; total: number } | null {
  const def = BUILDINGS_DATA[bName];
  if (!def || targetLvl < 1 || targetLvl > def.max_lvl) return null;
  const row = def.levels[targetLvl - 1];
  if (!row) return null;
  return {
    w: row.wood,
    c: row.clay,
    i: row.iron,
    total: row.wood + row.clay + row.iron
  };
}

export function getBuildingCompletionReward(
  cost: { w: number; c: number; i: number },
  input: SmartPlannerInput
): { w: number; c: number; i: number; total: number } {
  if (!input.enableQuestRewards) return { w: 0, c: 0, i: 0, total: 0 };
  const pct = Math.max(0, input.rewardPct);
  const w = Math.max(input.minRewardW, Math.round(cost.w * pct));
  const c = Math.max(input.minRewardC, Math.round(cost.c * pct));
  const i = Math.max(input.minRewardI, Math.round(cost.i * pct));
  return { w, c, i, total: w + c + i };
}

const BUILDING_POP_CACHE: Record<string, number[]> = (() => {
  const map: Record<string, number[]> = {};
  for (const bName of Object.keys(BUILDINGS_DATA)) {
    const def = BUILDINGS_DATA[bName];
    const arr: number[] = [0];
    for (let l = 1; l <= def.max_lvl; l++) {
      arr.push(getBuildingTotalPop(bName, l));
    }
    map[bName] = arr;
  }
  return map;
})();

function getFastBuildingPop(bName: string, lvl: number): number {
  if (!lvl || lvl <= 0) return 0;
  const arr = BUILDING_POP_CACHE[bName];
  if (!arr) return 0;
  return arr[Math.min(arr.length - 1, lvl)] || 0;
}

function getBuildingPopDelta(bName: string, curLvl: number, targetLvl: number): number {
  return Math.max(0, getFastBuildingPop(bName, targetLvl) - getFastBuildingPop(bName, curLvl));
}

function meetsBuildingPrereqs(bName: string, lvls: Record<string, number>): boolean {
  const hq = lvls['المبنى الرئيسي'] || 0;
  const wh = lvls['المخازن'] || 0;
  const bar = lvls['الثكنات'] || 0;
  const smith = lvls['الحداد'] || 0;
  if (bName === 'الثكنات') return hq >= 3;
  if (bName === 'السوق') return hq >= 3 && wh >= 2;
  if (bName === 'الحائط') return bar >= 1;
  if (bName === 'الحداد') return hq >= 5 && bar >= 1;
  if (bName === 'الإسطبل') return hq >= 10 && bar >= 5 && smith >= 5;
  return true;
}

function getMineHourlyForInput(
  res: 'w' | 'c' | 'i',
  lvl: number,
  input: SmartPlannerInput
): number {
  const base = MINE_BASE_PROD[Math.max(0, Math.min(30, Math.floor(lvl)))] ?? 5;
  const itemPct =
    res === 'w' ? input.woodItemPct : res === 'c' ? input.clayItemPct : input.ironItemPct;
  const mult =
    1 +
    (input.premium ? 0.2 : 0) +
    (input.boost30 ? 0.3 : 0) +
    Math.max(0, input.flagPct) / 100 +
    Math.max(0, itemPct) / 100;
  return base * input.worldSpeed * mult;
}

function resToPP(w: number, c: number, i: number, input: SmartPlannerInput): number {
  return (
    w / Math.max(1, input.sellWood) +
    c / Math.max(1, input.sellClay) +
    i / Math.max(1, input.sellIron)
  );
}

function avgSellRate(input: SmartPlannerInput): number {
  const invAvg =
    (1 / Math.max(1, input.sellWood) +
      1 / Math.max(1, input.sellClay) +
      1 / Math.max(1, input.sellIron)) /
    3;
  return invAvg > 0 ? 1 / invAvg : 64;
}

function maxCapForDurSec(durLimSec: number, lf: number, worldSpeed: number): number {
  const df = Math.pow(Math.max(0.1, worldSpeed), -0.55);
  const target = durLimSec / df - 1800;
  if (target <= 0) return 0;
  return Math.sqrt(Math.pow(target, 1 / 0.45) / 100) / lf;
}

/**
 * Solves the mathematically optimal carry allocation across ANY set of free scavenging tiers.
 *
 * - `'max_rate'`: Maximizes total hourly loot rate sum(c_k * f_k / D(c_k * f_k)) across free tiers
 *   using all 2^K-1 subset seeds + bounded non-negative coordinate ascent (strictly beats naive T1-T3 equal splits!).
 * - `'overnight_max_loot'`: Packs 100% of available army into the HIGHEST loot-factor tiers first (T4 -> T3 -> T2 -> T1)
 *   up to `maxDurSec` so the army farms at maximum efficiency throughout the offline sleep window!
 */
export function solveOptimalScavAllocation(
  totalCarry: number,
  freeTierIndices: number[], // 0-based indices (0=T1, 1=T2, 2=T3, 3=T4)
  worldSpeed: number,
  mode: 'max_rate' | 'overnight_max_loot',
  maxDurSec: number
): OptimalScavAllocation {
  const K = freeTierIndices.length;
  if (totalCarry < 50 || K === 0 || maxDurSec < 600) {
    return { slots: [], totalLoot: 0, hourlyLoot: 0, maxDurSec: 0 };
  }

  const ws = Math.max(0.1, worldSpeed);

  if (mode === 'overnight_max_loot') {
    const sortedDesc = [...freeTierIndices].sort((a, b) => b - a);
    let rem = totalCarry;
    const slots: OptimalScavSlotPlan[] = [];
    let totalLoot = 0;
    let hourlyLoot = 0;
    let maxD = 0;

    for (const idx of sortedDesc) {
      if (rem < 50) break;
      const lf = TIER_LFS[idx];
      const lim = maxCapForDurSec(maxDurSec, lf, ws);
      const take = Math.min(rem, lim);
      if (take < 50) continue;
      const dur = getScavDurationSec(take, lf, ws);
      if (dur > maxDurSec + 10) continue;
      const loot = take * lf;
      rem -= take;
      totalLoot += loot;
      hourlyLoot += loot / (dur / 3600);
      if (dur > maxD) maxD = dur;
      slots.push({
        tier: idx + 1,
        name: TIER_NAMES[idx],
        lootFactor: lf,
        carry: Math.round(take),
        loot: Math.round(loot),
        durSec: dur
      });
    }
    slots.sort((a, b) => a.tier - b.tier);
    return { slots, totalLoot, hourlyLoot, maxDurSec: maxD };
  }

  // Mode: 'max_rate' (maximize continuous hourly loot across independent parallel slots)
  const capsMax = freeTierIndices.map((idx) => maxCapForDurSec(maxDurSec, TIER_LFS[idx], ws));
  const lfs = freeTierIndices.map((idx) => TIER_LFS[idx]);

  const slotRate = (cap: number, lf: number) => {
    if (cap < 50) return 0;
    const dur = getScavDurationSec(cap, lf, ws);
    return (cap * lf) / (dur / 3600);
  };

  let bestAlloc = new Array<number>(K).fill(0);
  let bestRate = 0;

  // Try all non-empty subsets as equal-return-time seeds
  const maskLim = 1 << K;
  for (let mask = 1; mask < maskLim; mask++) {
    const alloc = new Array<number>(K).fill(0);
    let invSum = 0;
    for (let b = 0; b < K; b++) {
      if (mask & (1 << b)) invSum += 1 / lfs[b];
    }
    let leftover = totalCarry;
    for (let b = 0; b < K; b++) {
      if (!(mask & (1 << b))) continue;
      const target = Math.min(capsMax[b], (totalCarry * (1 / lfs[b])) / invSum);
      alloc[b] = target;
      leftover -= target;
    }
    // Spill leftover into highest-tier slots in the subset if any hit capsMax
    if (leftover >= 50) {
      for (let b = K - 1; b >= 0 && leftover >= 50; b--) {
        if (!(mask & (1 << b))) continue;
        const room = Math.max(0, capsMax[b] - alloc[b]);
        const add = Math.min(leftover, room);
        alloc[b] += add;
        leftover -= add;
      }
    }

    let rate = 0;
    for (let b = 0; b < K; b++) rate += slotRate(alloc[b], lfs[b]);
    if (rate > bestRate) {
      bestRate = rate;
      bestAlloc = alloc;
    }
  }

  // Fast non-negative coordinate ascent around best subset seed (converges to Lagrange optimum!)
  if (K >= 2 && bestRate > 0) {
    const cur = [...bestAlloc];
    let curRate = bestRate;
    const steps = [totalCarry * 0.12, totalCarry * 0.04, totalCarry * 0.015];
    for (const step of steps) {
      if (step < 25) continue;
      for (let pass = 0; pass < 4; pass++) {
        let improved = false;
        for (let i = 0; i < K; i++) {
          if (cur[i] < step) continue;
          const nextI = cur[i] - step;
          if (nextI > 0 && nextI < 50) continue;
          const rIOld = slotRate(cur[i], lfs[i]);
          const rINew = slotRate(nextI, lfs[i]);
          for (let j = 0; j < K; j++) {
            if (i === j) continue;
            const nextJ = cur[j] + step;
            if (nextJ > capsMax[j] || nextJ < 50) continue;
            const rJOld = slotRate(cur[j], lfs[j]);
            const rJNew = slotRate(nextJ, lfs[j]);
            const delta = rINew + rJNew - rIOld - rJOld;
            if (delta > 1e-4) {
              cur[i] = nextI;
              cur[j] = nextJ;
              curRate += delta;
              improved = true;
              break;
            }
          }
        }
        if (!improved) break;
      }
    }
    if (curRate > bestRate) {
      bestRate = curRate;
      bestAlloc = cur;
    }
  }

  const slots: OptimalScavSlotPlan[] = [];
  let totalLoot = 0;
  let maxD = 0;
  for (let b = 0; b < K; b++) {
    const c = bestAlloc[b];
    if (c < 50) continue;
    const idx = freeTierIndices[b];
    const lf = lfs[b];
    const dur = getScavDurationSec(c, lf, ws);
    const loot = c * lf;
    totalLoot += loot;
    if (dur > maxD) maxD = dur;
    slots.push({
      tier: idx + 1,
      name: TIER_NAMES[idx],
      lootFactor: lf,
      carry: Math.round(c),
      loot: Math.round(loot),
      durSec: dur
    });
  }
  slots.sort((a, b) => a.tier - b.tier);
  return { slots, totalLoot, hourlyLoot: bestRate, maxDurSec: maxD };
}

const GLOBAL_SCAV_ALLOC_CACHE = new Map<string, OptimalScavAllocation>();
const GLOBAL_SMOOTH_SCAV_CACHE = new Map<string, { dailyLoot: number; lootPerRun: number; cycleSec: number }>();

function solveOptimalScavAllocationCached(
  totalCarry: number,
  freeTierIndices: number[],
  worldSpeed: number,
  mode: 'max_rate' | 'overnight_max_loot',
  maxDurSec: number
): OptimalScavAllocation {
  const qCarry = totalCarry < 50 ? 0 : Math.round(totalCarry / 25) * 25;
  const qDur = Math.round(maxDurSec / 900) * 900;
  const qWs = Math.round(worldSpeed * 100);
  const key = `${qWs}|${qCarry}|${freeTierIndices.join('')}|${mode === 'max_rate' ? 'r' : 'n'}|${qDur}`;
  const hit = GLOBAL_SCAV_ALLOC_CACHE.get(key);
  if (hit) return hit;
  const res = solveOptimalScavAllocation(qCarry, freeTierIndices, worldSpeed, mode, qDur);
  if (GLOBAL_SCAV_ALLOC_CACHE.size > 12000) GLOBAL_SCAV_ALLOC_CACHE.clear();
  GLOBAL_SCAV_ALLOC_CACHE.set(key, res);
  return res;
}

/**
 * Smooth continuous daily scavenging loot expectation combining optimal daytime hourly rate
 * across independent slots PLUS the overnight max-tier blast while sleeping.
 */
export function calcSmoothDailyScavLoot(
  totalCarryCap: number,
  unlockedTiers: number,
  activeHoursPerDay: number,
  maxSessionHours: number,
  worldSpeed: number
): { dailyLoot: number; lootPerRun: number; cycleSec: number } {
  if (totalCarryCap < 50 || unlockedTiers <= 0 || activeHoursPerDay <= 0) {
    return { dailyLoot: 0, lootPerRun: 0, cycleSec: 0 };
  }
  const k = Math.min(4, Math.max(1, Math.floor(unlockedTiers)));
  const actH = Math.min(24, Math.max(0, activeHoursPerDay));
  const qCarry = Math.round(totalCarryCap / 25) * 25;
  const qWs = Math.round(worldSpeed * 100);
  const qSess = Math.round(maxSessionHours * 10);
  const cacheKey = `${qWs}|${qCarry}|${k}|${Math.round(actH * 10)}|${qSess}`;
  const hit = GLOBAL_SMOOTH_SCAV_CACHE.get(cacheKey);
  if (hit) return hit;

  const tiers = [0, 1, 2, 3].slice(0, k);
  const offlineH = Math.max(0, 24 - actH);
  const maxDayDur = maxSessionHours > 0 ? Math.max(3600, maxSessionHours * 3600) : Math.max(4, actH) * 3600;

  const dayAlloc = solveOptimalScavAllocationCached(qCarry, tiers, worldSpeed, 'max_rate', maxDayDur);
  if (actH >= 24) {
    const out = {
      dailyLoot: dayAlloc.hourlyLoot * 24,
      lootPerRun: dayAlloc.totalLoot,
      cycleSec: dayAlloc.maxDurSec
    };
    if (GLOBAL_SMOOTH_SCAV_CACHE.size > 12000) GLOBAL_SMOOTH_SCAV_CACHE.clear();
    GLOBAL_SMOOTH_SCAV_CACHE.set(cacheKey, out);
    return out;
  }

  const nightAlloc = solveOptimalScavAllocationCached(
    qCarry,
    tiers,
    worldSpeed,
    'overnight_max_loot',
    Math.max(3600, (offlineH + 1.5) * 3600)
  );
  // Active hours produce hourlyLoot * actH (accounting for pre-sleep wind-down) + 1 full 100%-army overnight blast!
  const dailyLoot = dayAlloc.hourlyLoot * Math.max(0, actH - 0.35) + nightAlloc.totalLoot;
  const out = {
    dailyLoot,
    lootPerRun: dayAlloc.totalLoot,
    cycleSec: dayAlloc.maxDurSec
  };
  if (GLOBAL_SMOOTH_SCAV_CACHE.size > 12000) GLOBAL_SMOOTH_SCAV_CACHE.clear();
  GLOBAL_SMOOTH_SCAV_CACHE.set(cacheKey, out);
  return out;
}

function isOnlineAt(tSec: number, activeHoursPerDay: number): boolean {
  if (activeHoursPerDay >= 24) return true;
  if (activeHoursPerDay <= 0) return false;
  const secOfDay = ((tSec % 86400) + 86400) % 86400;
  return secOfDay < activeHoursPerDay * 3600;
}

function nextOnlineTime(tSec: number, activeHoursPerDay: number): number {
  if (isOnlineAt(tSec, activeHoursPerDay)) return tSec;
  const dayIdx = Math.floor(tSec / 86400);
  return (dayIdx + 1) * 86400;
}

function remainingOfflineHoursTonight(activeHoursPerDay: number): number {
  if (activeHoursPerDay >= 24) return 0;
  return Math.max(0, 24 - activeHoursPerDay);
}

interface ScavSlotState {
  returnAt: number;
  capUsed: number;
  lootW: number;
  lootC: number;
  lootI: number;
}

/**
 * Exact discrete-event simulator for an unconstrained StrategyGenome.
 * Models:
 *  - Construction Queue (parallel with all military & scavenging queues)
 *  - Barracks Queue (Spears & Swords)
 *  - Statue Queue (Paladin: +100 carry for 80 res, parallel with Barracks!)
 *  - Stable Queue (Light Cavalry: +80 carry Iron-sink, parallel with Barracks!)
 *  - Scavenging Tier Unlock Queue (T1..T4, parallel with Construction & Barracks!)
 *  - 4 INDEPENDENT Scavenging Slots (T1, T2, T3, T4) with Optimal Rate + Overnight Max-Tier Blast!
 *  - Dynamic Wood/Clay/Iron Shadow Pricing & Zero-Overflow Pre-Sleep Surplus Selling!
 */
function simulateGenome(
  input: SmartPlannerInput,
  genome: StrategyGenome,
  scavMemo: Map<string, OptimalScavAllocation>
): SmartStrategyResult {
  const horizonSec = Math.max(1, Math.round(input.horizonDays * 86400));
  const lvls: Record<string, number> = { ...normalizeBuildingsMap(input.startBuildings) };
  let w = Math.max(0, Number(input.startStock.w || 0));
  let c = Math.max(0, Number(input.startStock.c || 0));
  let i = Math.max(0, Number(input.startStock.i || 0));

  let spearsReady = Math.max(0, Math.round(input.startSpears || 0));
  let spearsInQueue = 0;
  let spearsTrained = 0;

  let swordsReady = Math.max(0, Math.round(input.startSwords || 0));
  let swordsInQueue = 0;

  let lightsReady = Math.max(0, Math.round(input.startLights || 0));
  let lightsInQueue = 0;
  let lightResearched = (lvls['الإسطبل'] || 0) >= 3 && lightsReady > 0;

  let paladinsReady = Math.max(0, Math.round(input.startPaladins || 0));
  let paladinFinishAt = Infinity;
  let paladinInQueue = false;

  let scavTiers = Math.max(0, Math.min(4, Math.round(input.startUnlockedScavTiers || 0)));

  let totalMineRes = 0;
  let totalScavRes = 0;
  let totalQuestRewardRes = 0;
  let totalSpentRes = 0;
  let totalOverflowRes = 0;
  let soldW = 0;
  let soldC = 0;
  let soldI = 0;
  let scavRunsCount = 0;

  let lastSpearTrainHour: number | null = null;
  let lastMineUpgradeHour: number | null = null;
  const readLastSpearTrainHour = (): number | null => lastSpearTrainHour;
  const readLastMineUpgradeHour = (): number | null => lastMineUpgradeHour;

  // Parallel queues
  let activeBuild: {
    bName: string;
    targetLvl: number;
    reward: { w: number; c: number; i: number };
    finishAt: number;
  } | null = null;
  const readActiveBuild = () => activeBuild;

  // Barracks queue stores ordered unit types ('spear' | 'sword') via simple counters + next unit
  let barracksQueueUnits: Array<'spear' | 'sword'> = [];
  let barracksNextFinishAt = Infinity;

  let stableNextFinishAt = Infinity;

  let activeScavUnlock: { targetTier: number; finishAt: number } | null = null;
  const readActiveScavUnlock = () => activeScavUnlock;

  // 4 INDEPENDENT SCAVENGING SLOTS (0=T1, 1=T2, 2=T3, 3=T4)
  const scavSlots: ScavSlotState[] = [0, 1, 2, 3].map(() => ({
    returnAt: Infinity,
    capUsed: 0,
    lootW: 0,
    lootC: 0,
    lootI: 0
  }));
  let overnightBlastDay = -1;
  let lastMarketSellSec = 0;

  const steps: SmartPlanStep[] = [];
  let stepCounter = 0;
  let t = 0;

  const getCap = () => getWarehouseCap(lvls['المخازن'] || 1);
  const bldgKeys = Object.keys(lvls);
  const getUsedPop = () => {
    let pop =
      input.otherUnitsPop +
      (spearsReady + spearsInQueue) * SPEAR_COST.pop +
      (swordsReady + swordsInQueue) * SWORD_COST.pop +
      (lightsReady + lightsInQueue) * LIGHT_COST.pop +
      (paladinsReady + (paladinInQueue ? 1 : 0)) * PALADIN_COST.pop;
    for (let k = 0; k < bldgKeys.length; k++) {
      const bn = bldgKeys[k];
      pop += getFastBuildingPop(bn, lvls[bn]);
    }
    return pop;
  };
  const getFreePop = () => Math.max(0, getFarmCap(lvls['المزارع'] || 1) - getUsedPop());

  const getTotalReadyCarry = () =>
    spearsReady * SPEAR_COST.carry +
    swordsReady * SWORD_COST.carry +
    lightsReady * LIGHT_COST.carry +
    paladinsReady * PALADIN_COST.carry +
    input.otherUnitsCarryCap;

  const getTotalPlannedCarry = () =>
    (spearsReady + spearsInQueue) * SPEAR_COST.carry +
    (swordsReady + swordsInQueue) * SWORD_COST.carry +
    (lightsReady + lightsInQueue) * LIGHT_COST.carry +
    (paladinsReady + (paladinInQueue ? 1 : 0)) * PALADIN_COST.carry +
    input.otherUnitsCarryCap;

  const getCarryAway = () =>
    scavSlots[0].capUsed + scavSlots[1].capUsed + scavSlots[2].capUsed + scavSlots[3].capUsed;

  const cachedSolveScav = (
    carry: number,
    freeTiers: number[],
    mode: 'max_rate' | 'overnight_max_loot',
    maxDurSec: number
  ): OptimalScavAllocation => {
    void scavMemo;
    return solveOptimalScavAllocationCached(carry, freeTiers, input.worldSpeed, mode, maxDurSec);
  };

  const addRes = (dw: number, dc: number, di: number, source: 'mine' | 'scav' | 'reward') => {
    const cap = getCap();
    const nw = Math.min(cap, w + dw);
    const nc = Math.min(cap, c + dc);
    const ni = Math.min(cap, i + di);
    const ov = Math.max(0, w + dw - cap) + Math.max(0, c + dc - cap) + Math.max(0, i + di - cap);
    const added = nw - w + (nc - c) + (ni - i);
    w = nw;
    c = nc;
    i = ni;
    totalOverflowRes += ov;
    if (source === 'mine') totalMineRes += added;
    else if (source === 'scav') totalScavRes += added;
    else totalQuestRewardRes += added;
  };

  const advanceTimeTo = (targetSec: number) => {
    const nextT = Math.min(horizonSec, Math.max(t, targetSec));
    const dt = nextT - t;
    if (dt <= 0) return;

    const wHr = getMineHourlyForInput('w', lvls['الخشاب'] || 0, input);
    const cHr = getMineHourlyForInput('c', lvls['حفرة الطمي'] || 0, input);
    const iHr = getMineHourlyForInput('i', lvls['منجم الحديد'] || 0, input);
    const dtHrs = dt / 3600;
    addRes(wHr * dtHrs, cHr * dtHrs, iHr * dtHrs, 'mine');
    t = nextT;
  };

  const completeEventsUpToNow = () => {
    // 1. Active building completion
    if (activeBuild && t >= activeBuild.finishAt - 1e-6) {
      lvls[activeBuild.bName] = activeBuild.targetLvl;
      addRes(activeBuild.reward.w, activeBuild.reward.c, activeBuild.reward.i, 'reward');
      activeBuild = null;
    }

    // 2. Scavenging tier unlock completion
    if (activeScavUnlock && t >= activeScavUnlock.finishAt - 1e-6) {
      scavTiers = Math.max(scavTiers, activeScavUnlock.targetTier);
      activeScavUnlock = null;
    }

    // 3. Paladin graduation
    if (paladinInQueue && t >= paladinFinishAt - 1e-6) {
      paladinsReady += 1;
      paladinInQueue = false;
      paladinFinishAt = Infinity;
    }

    // 4. Barracks queue graduations
    while (barracksQueueUnits.length > 0 && t >= barracksNextFinishAt - 1e-6) {
      const doneUnit = barracksQueueUnits.shift()!;
      if (doneUnit === 'spear') {
        spearsReady += 1;
        spearsInQueue = Math.max(0, spearsInQueue - 1);
      } else {
        swordsReady += 1;
        swordsInQueue = Math.max(0, swordsInQueue - 1);
      }
      if (barracksQueueUnits.length > 0) {
        const nextU = barracksQueueUnits[0];
        barracksNextFinishAt += getOfficialUnitTrainSec(
          nextU,
          lvls['الثكنات'] || 1,
          input.worldSpeed
        );
      } else {
        barracksNextFinishAt = Infinity;
      }
    }

    // 5. Stable Light Cavalry graduations
    while (lightsInQueue > 0 && t >= stableNextFinishAt - 1e-6) {
      lightsReady += 1;
      lightsInQueue -= 1;
      if (lightsInQueue > 0) {
        stableNextFinishAt += getOfficialUnitTrainSec(
          'light',
          lvls['الإسطبل'] || 3,
          input.worldSpeed
        );
      } else {
        stableNextFinishAt = Infinity;
      }
    }

    // 6. Independent 4-Slot Scavenging Returns
    for (let s = 0; s < 4; s++) {
      if (scavSlots[s].returnAt <= t + 1e-6) {
        addRes(scavSlots[s].lootW, scavSlots[s].lootC, scavSlots[s].lootI, 'scav');
        scavSlots[s].returnAt = Infinity;
        scavSlots[s].capUsed = 0;
        scavSlots[s].lootW = 0;
        scavSlots[s].lootC = 0;
        scavSlots[s].lootI = 0;
      }
    }
  };

  const tryDispatchScavenging = (isOvernightBlast: boolean, secsUntilSleep = Infinity) => {
    if (scavTiers <= 0) return;
    if (t >= horizonSec - 900) return;

    const freeTiers: number[] = [];
    for (let s = 0; s < scavTiers; s++) {
      if (scavSlots[s].returnAt === Infinity) freeTiers.push(s);
    }
    if (freeTiers.length === 0) return;

    const carryHome = Math.max(0, getTotalReadyCarry() - getCarryAway());
    if (carryHome < 75) return;

    // Pre-sleep synchronization: in the final 10 minutes before sleep, hold returning troops
    // so 100% of the army launches together into the highest tiers right at sleepStart!
    if (!isOvernightBlast && input.activeHoursPerDay < 24 && secsUntilSleep > 0 && secsUntilSleep <= 600) {
      return;
    }

    const remToHorizonSec = horizonSec - t;
    const offlineHrs = remainingOfflineHoursTonight(input.activeHoursPerDay);

    let maxDurSec: number;
    if (isOvernightBlast) {
      maxDurSec = Math.min(remToHorizonSec, Math.max(3600, (offlineHrs + 1.5) * 3600));
    } else {
      const baseDayCap =
        genome.onlineRunCapHrs > 0
          ? Math.max(2400, genome.onlineRunCapHrs * 3600)
          : Math.max(3600, Math.min(8, input.activeHoursPerDay) * 3600);
      // Gentle wind-down in the final 90 minutes before sleep so slots finish right at sleepStart
      if (input.activeHoursPerDay < 24 && secsUntilSleep > 600 && secsUntilSleep <= 5400) {
        maxDurSec = Math.min(remToHorizonSec, baseDayCap, secsUntilSleep);
      } else {
        maxDurSec = Math.min(remToHorizonSec, baseDayCap);
      }
    }

    if (maxDurSec < 1200) return;

    const mode: 'max_rate' | 'overnight_max_loot' = isOvernightBlast
      ? 'overnight_max_loot'
      : 'max_rate';

    const alloc = cachedSolveScav(carryHome, freeTiers, mode, maxDurSec);
    if (alloc.slots.length === 0) return;

    let dispatchedAny = false;
    for (const sp of alloc.slots) {
      const idx = sp.tier - 1;
      if (scavSlots[idx].returnAt !== Infinity) continue;
      if (t + sp.durSec > horizonSec) continue;
      const lootInt = Math.round(sp.loot);
      if (lootInt <= 0) continue;
      const wL = Math.floor(lootInt / 3);
      const cL = Math.floor(lootInt / 3);
      const iL = lootInt - wL - cL;
      scavSlots[idx].returnAt = t + sp.durSec;
      scavSlots[idx].capUsed = sp.carry;
      scavSlots[idx].lootW = wL;
      scavSlots[idx].lootC = cL;
      scavSlots[idx].lootI = iL;
      scavRunsCount += 1;
      dispatchedAny = true;
    }

    if (dispatchedAny && isOvernightBlast && getCarryAway() >= getTotalReadyCarry() * 0.92) {
      overnightBlastDay = Math.floor(t / 86400);
    }
  };

  const trySellSurplus = (keepBuffer: { w: number; c: number; i: number }, forceFlush = false) => {
    const mktLvl = lvls['السوق'] || 0;
    if (input.enforceMarketMerchants && mktLvl < 1) return;

    const availW = Math.max(0, w - keepBuffer.w);
    const availC = Math.max(0, c - keepBuffer.c);
    const availI = Math.max(0, i - keepBuffer.i);
    const totalAvail = availW + availC + availI;
    if (totalAvail < 64) return;

    if (!input.enforceMarketMerchants) {
      w -= availW;
      c -= availC;
      i -= availI;
      soldW += availW;
      soldC += availC;
      soldI += availI;
      return;
    }

    const merchants = getMerchantsCount(mktLvl);
    const elapsedSinceSellHrs = forceFlush
      ? 1
      : Math.max(0, Math.min(2, (t - lastMarketSellSec) / 3600));
    const maxTransfer = Math.floor(merchants * 1000 * Math.max(0.25, elapsedSinceSellHrs));
    if (maxTransfer < 64) return;

    const buckets: Array<{ key: 'w' | 'c' | 'i'; avail: number; rate: number }> = [
      { key: 'w' as const, avail: availW, rate: input.sellWood },
      { key: 'c' as const, avail: availC, rate: input.sellClay },
      { key: 'i' as const, avail: availI, rate: input.sellIron }
    ].sort((a, b) => a.rate - b.rate);

    let remCap = maxTransfer;
    let soldAny = false;
    for (const b of buckets) {
      if (remCap <= 0 || b.avail <= 0) continue;
      const take = Math.min(remCap, b.avail);
      if (b.key === 'w') {
        w -= take;
        soldW += take;
      } else if (b.key === 'c') {
        c -= take;
        soldC += take;
      } else {
        i -= take;
        soldI += take;
      }
      remCap -= take;
      soldAny = true;
    }
    if (soldAny) lastMarketSellSec = t;
  };

  const startBuildingUpgrade = (
    bName: string,
    phase: SmartStepPhase,
    reason: string
  ): boolean => {
    if (activeBuild) return false;
    const curLvl = lvls[bName] || 0;
    const targetLvl = curLvl + 1;
    const cost = getBuildingUpgradeCost(bName, targetLvl);
    if (!cost) return false;
    if (!meetsBuildingPrereqs(bName, lvls)) return false;
    const popNeed = getBuildingPopDelta(bName, curLvl, targetLvl);
    if (popNeed > getFreePop()) return false;
    if (w < cost.w - 1e-6 || c < cost.c - 1e-6 || i < cost.i - 1e-6) return false;

    const durSec = getOfficialBuildSec(
      bName,
      targetLvl,
      lvls['المبنى الرئيسي'] || 1,
      input.worldSpeed,
      input.enableFreeFinish,
      input.freeFinishSec
    );
    const reward = getBuildingCompletionReward(cost, input);

    w = Math.max(0, w - cost.w);
    c = Math.max(0, c - cost.c);
    i = Math.max(0, i - cost.i);
    totalSpentRes += cost.total;

    const tStart = Math.round(t);
    const tEnd = Math.round(t + durSec);

    stepCounter += 1;
    steps.push({
      stepNum: stepCounter,
      atype: 'bldg',
      bName,
      baseName: bName,
      targetLvl,
      lvl: targetLvl,
      tStart,
      tEnd,
      durSec,
      cost: { w: cost.w, c: cost.c, i: cost.i },
      reward: { w: reward.w, c: reward.c, i: reward.i },
      netCostRes: cost.total - reward.total,
      phase,
      reason
    });

    if (MINES_LIST.includes(bName as (typeof MINES_LIST)[number]) && phase !== 'opening') {
      lastMineUpgradeHour = tStart / 3600;
    }

    if (durSec <= 0) {
      lvls[bName] = targetLvl;
      addRes(reward.w, reward.c, reward.i, 'reward');
    } else {
      activeBuild = { bName, targetLvl, reward, finishAt: t + durSec };
    }
    return true;
  };

  const startScavUnlock = (
    targetTier: number,
    phase: SmartStepPhase,
    reason: string
  ): boolean => {
    if (activeScavUnlock) return false;
    if (targetTier !== scavTiers + 1 || targetTier < 1 || targetTier > 4) return false;
    const def = SCAV_UNLOCK_DATA[String(targetTier)];
    if (!def) return false;
    if (w < def.wood || c < def.clay || i < def.iron) return false;

    w -= def.wood;
    c -= def.clay;
    i -= def.iron;
    const totalCost = def.wood + def.clay + def.iron;
    totalSpentRes += totalCost;

    const tStart = Math.round(t);
    const tEnd = Math.round(t + def.sec);
    stepCounter += 1;
    steps.push({
      stepNum: stepCounter,
      atype: 'scav_unlock',
      bName: def.name,
      targetLvl: targetTier,
      lvl: targetTier,
      tStart,
      tEnd,
      durSec: def.sec,
      cost: { w: def.wood, c: def.clay, i: def.iron },
      reward: { w: 0, c: 0, i: 0 },
      netCostRes: totalCost,
      phase,
      reason
    });

    activeScavUnlock = { targetTier, finishAt: t + def.sec };
    return true;
  };

  const startPaladinRecruit = (phase: SmartStepPhase, reason: string): boolean => {
    if (paladinsReady > 0 || paladinInQueue) return false;
    if ((lvls['النصب التذكاري'] || 0) < 1) return false;
    if (getFreePop() < PALADIN_COST.pop) return false;
    if (w < PALADIN_COST.w || c < PALADIN_COST.c || i < PALADIN_COST.i) return false;

    w -= PALADIN_COST.w;
    c -= PALADIN_COST.c;
    i -= PALADIN_COST.i;
    totalSpentRes += PALADIN_COST.total;

    const durSec = getOfficialUnitTrainSec('paladin', 1, input.worldSpeed);
    paladinInQueue = true;
    paladinFinishAt = t + durSec;

    stepCounter += 1;
    steps.push({
      stepNum: stepCounter,
      atype: 'train_paladin',
      bName: 'تعيين قائد الفرسان (+100 حمولة)',
      targetLvl: 1,
      lvl: 1,
      countDelta: 1,
      tStart: Math.round(t),
      tEnd: Math.round(t + durSec),
      durSec,
      cost: { w: PALADIN_COST.w, c: PALADIN_COST.c, i: PALADIN_COST.i },
      reward: { w: 0, c: 0, i: 0 },
      netCostRes: PALADIN_COST.total,
      phase,
      reason
    });
    return true;
  };

  const startSpearBatch = (
    count: number,
    phase: SmartStepPhase,
    reason: string
  ): boolean => {
    const qty = Math.max(1, Math.floor(count));
    if ((lvls['الثكنات'] || 0) < 1) return false;
    if (qty > getFreePop()) return false;
    const cw = qty * SPEAR_COST.w;
    const cc = qty * SPEAR_COST.c;
    const ci = qty * SPEAR_COST.i;
    if (w < cw || c < cc || i < ci) return false;

    w -= cw;
    c -= cc;
    i -= ci;
    totalSpentRes += cw + cc + ci;

    const trainSec = getOfficialUnitTrainSec('spear', lvls['الثكنات'] || 1, input.worldSpeed);
    if (barracksQueueUnits.length === 0) {
      barracksNextFinishAt = t + trainSec;
    }
    for (let k = 0; k < qty; k++) barracksQueueUnits.push('spear');
    spearsInQueue += qty;
    spearsTrained += qty;

    const cumTarget = spearsReady + spearsInQueue;
    const tStart = Math.round(t);
    const durSec = qty * trainSec;
    const tEnd = Math.round(
      barracksNextFinishAt + Math.max(0, barracksQueueUnits.length - 1) * trainSec
    );

    lastSpearTrainHour = tStart / 3600;
    stepCounter += 1;
    steps.push({
      stepNum: stepCounter,
      atype: 'train_spear',
      bName: `تدريب رمح (+${qty} ← الإجمالي ${cumTarget})`,
      targetLvl: cumTarget,
      lvl: cumTarget,
      countDelta: qty,
      tStart,
      tEnd,
      durSec,
      cost: { w: cw, c: cc, i: ci },
      reward: { w: 0, c: 0, i: 0 },
      netCostRes: cw + cc + ci,
      phase,
      reason
    });
    return true;
  };

  const startSwordBatch = (
    count: number,
    phase: SmartStepPhase,
    reason: string
  ): boolean => {
    const qty = Math.max(1, Math.floor(count));
    if ((lvls['الثكنات'] || 0) < 1 || (lvls['الحداد'] || 0) < 1) return false;
    if (qty > getFreePop()) return false;
    const cw = qty * SWORD_COST.w;
    const cc = qty * SWORD_COST.c;
    const ci = qty * SWORD_COST.i;
    if (w < cw || c < cc || i < ci) return false;

    w -= cw;
    c -= cc;
    i -= ci;
    totalSpentRes += cw + cc + ci;

    const trainSec = getOfficialUnitTrainSec('sword', lvls['الثكنات'] || 1, input.worldSpeed);
    if (barracksQueueUnits.length === 0) {
      barracksNextFinishAt = t + trainSec;
    }
    for (let k = 0; k < qty; k++) barracksQueueUnits.push('sword');
    swordsInQueue += qty;

    const cumTarget = swordsReady + swordsInQueue;
    stepCounter += 1;
    steps.push({
      stepNum: stepCounter,
      atype: 'train_sword',
      bName: `تدريب سيف (+${qty} ← الإجمالي ${cumTarget})`,
      targetLvl: cumTarget,
      lvl: cumTarget,
      countDelta: qty,
      tStart: Math.round(t),
      tEnd: Math.round(t + qty * trainSec),
      durSec: qty * trainSec,
      cost: { w: cw, c: cc, i: ci },
      reward: { w: 0, c: 0, i: 0 },
      netCostRes: cw + cc + ci,
      phase,
      reason
    });
    return true;
  };

  const startLightBatch = (
    count: number,
    phase: SmartStepPhase,
    reason: string
  ): boolean => {
    const qty = Math.max(1, Math.floor(count));
    if ((lvls['الإسطبل'] || 0) < 3 || !lightResearched) return false;
    if (qty * LIGHT_COST.pop > getFreePop()) return false;
    const cw = qty * LIGHT_COST.w;
    const cc = qty * LIGHT_COST.c;
    const ci = qty * LIGHT_COST.i;
    if (w < cw || c < cc || i < ci) return false;

    w -= cw;
    c -= cc;
    i -= ci;
    totalSpentRes += cw + cc + ci;

    const trainSec = getOfficialUnitTrainSec('light', lvls['الإسطبل'] || 3, input.worldSpeed);
    if (lightsInQueue === 0) {
      stableNextFinishAt = t + trainSec;
    }
    lightsInQueue += qty;

    const cumTarget = lightsReady + lightsInQueue;
    stepCounter += 1;
    steps.push({
      stepNum: stepCounter,
      atype: 'train_light',
      bName: `تدريب فارس خفيف (+${qty} ← الإجمالي ${cumTarget})`,
      targetLvl: cumTarget,
      lvl: cumTarget,
      countDelta: qty,
      tStart: Math.round(t),
      tEnd: Math.round(t + qty * trainSec),
      durSec: qty * trainSec,
      cost: { w: cw, c: cc, i: ci },
      reward: { w: 0, c: 0, i: 0 },
      netCostRes: cw + cc + ci,
      phase,
      reason
    });
    return true;
  };

  // =========================================================================
  // HELPER: Check if ANY profitable quest building is safely available (zero overflow!)
  // =========================================================================
  const findProfitableQuestBuilding = (maxHQCap: number): { name: string; netProfit: number; isWarehouse: boolean } | null => {
    if (!input.enableQuestRewards) return null;
    const whLvl = lvls['المخازن'] || 1;
    const whCost = getBuildingUpgradeCost('المخازن', whLvl + 1);
    const whRew = whCost ? getBuildingCompletionReward(whCost, input) : null;
    if (
      whCost &&
      whRew &&
      whRew.total >= whCost.total &&
      w >= whCost.w &&
      c >= whCost.c &&
      i >= whCost.i
    ) {
      return { name: 'المخازن', netProfit: whRew.total - whCost.total, isWarehouse: true };
    }

    const candidates = [
      'الخشاب',
      'حفرة الطمي',
      'منجم الحديد',
      'المبنى الرئيسي',
      'المزارع',
      'السوق',
      'المخابئ',
      'الحائط'
    ];
    const cap = getCap();
    let best: { name: string; netProfit: number; isMine: boolean } | null = null;
    for (const bName of candidates) {
      const curL = lvls[bName] || 0;
      if (bName === 'المبنى الرئيسي' && curL >= maxHQCap) continue;
      if (!meetsBuildingPrereqs(bName, lvls)) continue;
      const cost = getBuildingUpgradeCost(bName, curL + 1);
      if (!cost) continue;
      const popNeed = getBuildingPopDelta(bName, curL, curL + 1);
      if (popNeed > getFreePop()) continue;
      const rew = getBuildingCompletionReward(cost, input);
      const netProfit = rew.total - cost.total;
      if (netProfit < 0) continue;
      if (w < cost.w || c < cost.c || i < cost.i) continue;

      const durSec = getOfficialBuildSec(
        bName,
        curL + 1,
        lvls['المبنى الرئيسي'] || 1,
        input.worldSpeed,
        input.enableFreeFinish,
        input.freeFinishSec
      );
      const prodW = (getMineHourlyForInput('w', lvls['الخشاب'] || 0, input) * durSec) / 3600;
      const prodC = (getMineHourlyForInput('c', lvls['حفرة الطمي'] || 0, input) * durSec) / 3600;
      const prodI = (getMineHourlyForInput('i', lvls['منجم الحديد'] || 0, input) * durSec) / 3600;
      if (w - cost.w + prodW + rew.w > cap) continue;
      if (c - cost.c + prodC + rew.c > cap) continue;
      if (i - cost.i + prodI + rew.i > cap) continue;

      const isMine = MINES_LIST.includes(bName as (typeof MINES_LIST)[number]);
      if (
        !best ||
        (isMine && !best.isMine) ||
        (isMine === best.isMine && netProfit > best.netProfit)
      ) {
        best = { name: bName, netProfit, isMine };
      }
    }
    return best ? { name: best.name, netProfit: best.netProfit, isWarehouse: false } : null;
  };

  // =========================================================================
  // STAGE A: SMART OPENING (3 Competing Opening Philosophies — Zero Overflow!)
  // =========================================================================
  const openingStartRes = w + c + i;
  const openingOverflowBefore = totalOverflowRes;
  let openingUsedBundle = false;
  const isInstantRush =
    genome.openingStyle !== 'quest_harvest_first' &&
    genome.maxScavTier > 0 &&
    input.activeHoursPerDay > 0;

  if (input.enableQuestRewards && !isInstantRush) {
    // Classic zero-overflow Quest Harvest first (ideal for Pure Mines or 0 active hours)
    let safety = 0;
    while (safety++ < 80 && t < horizonSec) {
      completeEventsUpToNow();
      const curB = readActiveBuild();
      if (curB) {
        advanceTimeTo(curB.finishAt);
        completeEventsUpToNow();
        continue;
      }

      const nextQ = findProfitableQuestBuilding(Math.max(3, genome.maxHQ));
      if (nextQ) {
        startBuildingUpgrade(
          nextQ.name,
          'opening',
          nextQ.isWarehouse
            ? `رفع المخزن أولاً لمنع فيضان المكافآت (+${nextQ.netProfit} مورد صافي)`
            : `تطوير مربح بالمكافأة (+${nextQ.netProfit} مورد صافي)`
        );
        continue;
      }

      if (
        genome.useBarracksWallBundle &&
        (lvls['الثكنات'] || 0) === 0 &&
        (lvls['المبنى الرئيسي'] || 0) >= 3
      ) {
        const barCost = getBuildingUpgradeCost('الثكنات', 1);
        if (barCost && w >= barCost.w && c >= barCost.c && i >= barCost.i && getFreePop() >= 7) {
          if (
            startBuildingUpgrade(
              'الثكنات',
              'opening',
              'حزمة الثكنات + الحائط (م1-4): صافي ربح +533 مورد + فتح تدريب الرمح'
            )
          ) {
            openingUsedBundle = true;
            continue;
          }
        }
      }
      break;
    }
    const remOpen = readActiveBuild();
    if (remOpen && remOpen.finishAt < horizonSec) {
      advanceTimeTo(remOpen.finishAt);
      completeEventsUpToNow();
    }
  } else if (isInstantRush) {
    // PRO OPENING: Rush HQ 2->3 -> Barracks 1 -> Start Spears & T1 & Statue+Paladin in Minute 1-3,
    // while harvesting ALL profitable quest buildings in parallel with ZERO overflow!
    let safety = 0;
    while (safety++ < 95 && t < Math.min(horizonSec, 5400)) {
      completeEventsUpToNow();

      // Immediately unlock T1 as soon as affordable (30s parallel!)
      if (scavTiers === 0 && !activeScavUnlock && w >= 25 && c >= 30 && i >= 25) {
        startScavUnlock(1, 'opening', 'فتح الفئة 1 فوراً (30ث) لبدء الغنائم منذ الدقائق الأولى');
      }

      // Immediately start Paladin as soon as Statue L1 finishes!
      if (
        genome.usePaladin &&
        (lvls['النصب التذكاري'] || 0) >= 1 &&
        paladinsReady === 0 &&
        !paladinInQueue &&
        w >= PALADIN_COST.w &&
        c >= PALADIN_COST.c &&
        i >= PALADIN_COST.i &&
        getFreePop() >= PALADIN_COST.pop
      ) {
        startPaladinRecruit(
          'opening',
          'تعيين قائد الفرسان (+100 حمولة بتكلفة 80 مورد فقط وبالتوازي مع الثكنات)'
        );
      }

      // Immediately start Barracks training spears the SECOND Barracks L1 finishes!
      if ((lvls['الثكنات'] || 0) >= 1 && barracksQueueUnits.length < 4) {
        const aff = Math.min(
          6,
          getFreePop(),
          Math.floor(w / SPEAR_COST.w),
          Math.floor(c / SPEAR_COST.c),
          Math.floor(i / SPEAR_COST.i)
        );
        if (aff >= 2) {
          startSpearBatch(
            aff,
            'opening',
            'تشغيل الثكنات من الدقيقة الأولى لبدء تراكم الإغارات بالتوازي مع البناء'
          );
        }
      }

      // Dispatch scavenging if ready!
      if (scavTiers > 0 && getTotalReadyCarry() - getCarryAway() >= 75) {
        tryDispatchScavenging(false);
      }

      const curB = readActiveBuild();
      if (curB) {
        advanceTimeTo(curB.finishAt);
        completeEventsUpToNow();
        continue;
      }

      // Guard warehouse capacity before reward quests so overflow stays 0
      const whLvl = lvls['المخازن'] || 1;
      const cap = getCap();
      if (
        whLvl < 5 &&
        (w > cap - 260 || c > cap - 260 || i > cap - 200) &&
        input.enableQuestRewards
      ) {
        const whCost = getBuildingUpgradeCost('المخازن', whLvl + 1);
        if (whCost && w >= whCost.w && c >= whCost.c && i >= whCost.i) {
          startBuildingUpgrade(
            'المخازن',
            'opening',
            'توسعة سريعة للمخزن قبل المكافآت لمنع أي فيضان'
          );
          continue;
        }
      }

      // Priority 1: Statue L1 + Paladin (if instant_barracks_paladin and not built yet!)
      if (
        genome.openingStyle === 'instant_barracks_paladin' &&
        genome.usePaladin &&
        (lvls['النصب التذكاري'] || 0) === 0 &&
        paladinsReady === 0 &&
        horizonSec >= 43200
      ) {
        const stCost = getBuildingUpgradeCost('النصب التذكاري', 1);
        if (stCost && w >= stCost.w && c >= stCost.c && i >= stCost.i && getFreePop() >= 10) {
          startBuildingUpgrade(
            'النصب التذكاري',
            'opening',
            'بناء النصب التذكاري مبكراً لإطلاق قائد الفرسان (+100 حمولة بالتوازي)'
          );
          continue;
        }
      }

      // Priority 2: HQ 2 -> HQ 3 -> Barracks L1 immediately!
      if ((lvls['المبنى الرئيسي'] || 1) < 3) {
        const hqCost = getBuildingUpgradeCost('المبنى الرئيسي', (lvls['المبنى الرئيسي'] || 1) + 1);
        if (hqCost && w >= hqCost.w && c >= hqCost.c && i >= hqCost.i) {
          startBuildingUpgrade(
            'المبنى الرئيسي',
            'opening',
            'رفع المبنى الرئيسي للمستوى 3 فوراً لفتح الثكنات وتشغيل التدريب مبكراً'
          );
          continue;
        }
      } else if ((lvls['الثكنات'] || 0) === 0) {
        const barCost = getBuildingUpgradeCost('الثكنات', 1);
        if (barCost && w >= barCost.w && c >= barCost.c && i >= barCost.i && getFreePop() >= 7) {
          if (
            startBuildingUpgrade(
              'الثكنات',
              'opening',
              'بناء الثكنات مبكراً لتشغيل تدريب الرمح بالتوازي + فتح حائط المكافآت'
            )
          ) {
            openingUsedBundle = true;
            continue;
          }
        }
      }

      // Priority 3: Harvest all profitable quest buildings while Barracks & Paladin run!
      const nextQ = findProfitableQuestBuilding(Math.max(3, genome.maxHQ));
      if (nextQ) {
        startBuildingUpgrade(
          nextQ.name,
          'opening',
          nextQ.isWarehouse
            ? `رفع المخزن لمنع فيضان المكافآت (+${nextQ.netProfit} مورد صافي)`
            : `تطوير مربح بالمكافأة بالتوازي مع الثكنات (+${nextQ.netProfit} مورد صافي)`
        );
        continue;
      }

      break;
    }
  }

  let openingBldgSpent = 0;
  let openingBldgRewards = 0;
  for (const st of steps) {
    if (st.atype === 'bldg') {
      openingBldgSpent += st.cost.w + st.cost.c + st.cost.i;
      openingBldgRewards += st.reward.w + st.reward.c + st.reward.i;
    }
  }
  const openingNetProfitRes = Math.round(
    isInstantRush ? openingBldgRewards - openingBldgSpent : w + c + i - openingStartRes
  );

  const openingSummary: OpeningSummary = {
    stepsCount: steps.length,
    durationSec: Math.round(t),
    netProfitRes: openingNetProfitRes,
    overflowRes: Math.round(totalOverflowRes - openingOverflowBefore),
    endStock: { w: Math.round(w), c: Math.round(c), i: Math.round(i) },
    endBuildings: { ...lvls },
    endPoints: calcVillagePointsFromBuildings(lvls),
    usedBarracksWallBundle: openingUsedBundle,
    philosophyLabel:
      genome.openingStyle === 'instant_barracks_paladin'
        ? 'انطلاقة ثكنات فورية + قائد الفرسان بالتوازي مع حصد مكافآت البناء'
        : genome.openingStyle === 'instant_barracks'
          ? 'انطلاقة ثكنات فورية بالتوازي مع حصد مكافآت البناء'
          : 'حصد مكافآت البناء وتوسعة المخازن والحقول أولاً بدون فيضان'
  };

  // =========================================================================
  // STAGE B: DAY-BY-DAY TRAJECTORY & 24H CHECKPOINT TRACKING
  // =========================================================================
  const dayTrajectory: DayTrajectoryPoint[] = [];
  let checkpoint24h: Checkpoint24hSummary | null = null;
  let nextTrajectoryDay = 0;

  const computeCurrentDailyBreakdown = () => {
    const wHr = getMineHourlyForInput('w', lvls['الخشاب'] || 0, input);
    const cHr = getMineHourlyForInput('c', lvls['حفرة الطمي'] || 0, input);
    const iHr = getMineHourlyForInput('i', lvls['منجم الحديد'] || 0, input);
    const dailyMinesRes = (wHr + cHr + iHr) * 24;
    const dailyMinesPP = resToPP(wHr * 24, cHr * 24, iHr * 24, input);

    const totalCarry = getTotalPlannedCarry();
    const scavEst =
      scavTiers > 0 && totalCarry >= 75 && input.activeHoursPerDay > 0
        ? calcSmoothDailyScavLoot(
            totalCarry,
            scavTiers,
            input.activeHoursPerDay,
            genome.onlineRunCapHrs,
            input.worldSpeed
          )
        : null;
    const dailyScavRes = scavEst ? scavEst.dailyLoot : 0;
    const dailyScavPP =
      dailyScavRes > 0
        ? resToPP(dailyScavRes / 3, dailyScavRes / 3, dailyScavRes / 3, input)
        : 0;
    return {
      dailyMinesRes,
      dailyScavRes,
      dailyMinesPP,
      dailyScavPP,
      dailyTotalPP: dailyMinesPP + dailyScavPP
    };
  };

  const recordTrajectoryUpTo = (curSec: number) => {
    while (
      nextTrajectoryDay * 86400 <= curSec + 1e-6 &&
      nextTrajectoryDay <= Math.ceil(input.horizonDays)
    ) {
      const d = nextTrajectoryDay;
      const brk = computeCurrentDailyBreakdown();
      const cumSold = resToPP(soldW, soldC, soldI, input);
      const stockVal = resToPP(w, c, i, input);
      const wL = lvls['الخشاب'] || 0;
      const cL = lvls['حفرة الطمي'] || 0;
      const iL = lvls['منجم الحديد'] || 0;
      dayTrajectory.push({
        day: d,
        label: d === 0 ? 'البداية' : `يوم ${d}`,
        hour: d * 24,
        cumNetPP: Number((cumSold + stockVal).toFixed(1)),
        cumSoldPP: Number(cumSold.toFixed(1)),
        dailyMinesPP: Number(brk.dailyMinesPP.toFixed(1)),
        dailyScavPP: Number(brk.dailyScavPP.toFixed(1)),
        dailyTotalPP: Number(brk.dailyTotalPP.toFixed(1)),
        spears: spearsReady + spearsInQueue,
        scavTiers,
        avgMineLvl: Number(((wL + cL + iL) / 3).toFixed(1)),
        minesLabel: `${wL}/${cL}/${iL}`,
        warehouseCap: getCap()
      });

      if (d === 1 && !checkpoint24h) {
        checkpoint24h = {
          dailyMinesPP: Number(brk.dailyMinesPP.toFixed(1)),
          dailyScavPP: Number(brk.dailyScavPP.toFixed(1)),
          dailyTotalPP: Number(brk.dailyTotalPP.toFixed(1)),
          dailyMinesRes: Math.round(brk.dailyMinesRes),
          dailyScavRes: Math.round(brk.dailyScavRes),
          spears: spearsReady + spearsInQueue,
          paladins: paladinsReady + (paladinInQueue ? 1 : 0),
          swords: swordsReady + swordsInQueue,
          lights: lightsReady + lightsInQueue,
          totalCarry: getTotalPlannedCarry(),
          scavTiers,
          woodLvl: wL,
          clayLvl: cL,
          ironLvl: iL,
          hqLvl: lvls['المبنى الرئيسي'] || 1,
          warehouseLvl: lvls['المخازن'] || 1,
          barracksLvl: lvls['الثكنات'] || 0,
          cumNetPP: Number((cumSold + stockVal).toFixed(1))
        };
      }

      nextTrajectoryDay += 1;
    }
  };

  recordTrajectoryUpTo(0);

  // =========================================================================
  // STAGE C: UNCONSTRAINED MARGINAL ROI + SHADOW-PRICING DECISION LOOP
  // =========================================================================
  const evaluateBestBuildAction = (
    remHrs: number
  ): {
    bName: string;
    cost: { w: number; c: number; i: number; total: number };
    netGainPP: number;
    score: number;
    waitSec: number;
    reason: string;
  } | null => {
    const wHr = getMineHourlyForInput('w', lvls['الخشاب'] || 0, input);
    const cHr = getMineHourlyForInput('c', lvls['حفرة الطمي'] || 0, input);
    const iHr = getMineHourlyForInput('i', lvls['منجم الحديد'] || 0, input);
    const cap = getCap();
    const isEndDailyGoal = input.goal === 'max_end_daily_pp';

    const totalCarry = getTotalPlannedCarry();
    const smoothScav = calcSmoothDailyScavLoot(
      totalCarry,
      scavTiers,
      input.activeHoursPerDay,
      genome.onlineRunCapHrs,
      input.worldSpeed
    );
    const scavEachHr = smoothScav.dailyLoot / 72;

    const calcWaitSec = (cost: { w: number; c: number; i: number }) => {
      const mw = Math.max(0, cost.w - w);
      const mc = Math.max(0, cost.c - c);
      const mi = Math.max(0, cost.i - i);
      const hw = mw > 0 ? mw / Math.max(1, wHr + scavEachHr) : 0;
      const hc = mc > 0 ? mc / Math.max(1, cHr + scavEachHr) : 0;
      const hi = mi > 0 ? mi / Math.max(1, iHr + scavEachHr) : 0;
      return Math.max(hw, hc, hi) * 3600;
    };

    type BuildCand = {
      bName: string;
      cost: { w: number; c: number; i: number; total: number };
      netGainPP: number;
      score: number;
      waitSec: number;
      reason: string;
    };

    const candidates: BuildCand[] = [];

    // 0. Always harvest any remaining FREE profitable quest building (zero overflow!)
    const freeQuest = findProfitableQuestBuilding(Math.max(3, genome.maxHQ));
    if (freeQuest && remHrs > 2) {
      const qCost = getBuildingUpgradeCost(freeQuest.name, (lvls[freeQuest.name] || 0) + 1);
      if (qCost) {
        candidates.push({
          bName: freeQuest.name,
          cost: qCost,
          netGainPP: Math.max(1, freeQuest.netProfit / avgSellRate(input)),
          score: 600 + freeQuest.netProfit,
          waitSec: 0,
          reason: `حصد مكافأة بناء مجانية (+${freeQuest.netProfit} مورد ربح صافي)`
        });
      }
    }

    // Dynamic Wood/Clay/Iron Shadow Pricing (when actively training Spears, Wood is 2x scarcer than Iron!)
    const isTrainingSpears =
      genome.maxScavTier > 0 &&
      genome.maxSpearsCap > spearsReady + spearsInQueue &&
      remHrs > 14 &&
      input.activeHoursPerDay > 0;
    const woodShadow = isTrainingSpears ? genome.woodShadowBoost : 1.0;
    const clayShadow = isTrainingSpears ? 1.0 + (genome.woodShadowBoost - 1.0) * 0.45 : 1.0;
    const ironShadow = isTrainingSpears && !genome.useLightCav && !genome.useSwords ? 0.72 : 1.0;

    // 1. Mine Upgrades (Wood / Clay / Iron) with Shadow Pricing
    for (const mName of MINES_LIST) {
      const curL = lvls[mName] || 0;
      if (curL >= 30) continue;
      const cost = getBuildingUpgradeCost(mName, curL + 1);
      if (!cost) continue;
      const rew = getBuildingCompletionReward(cost, input);
      const durSec = getOfficialBuildSec(
        mName,
        curL + 1,
        lvls['المبنى الرئيسي'] || 1,
        input.worldSpeed,
        input.enableFreeFinish,
        input.freeFinishSec
      );
      const resKey = mName === 'الخشاب' ? 'w' : mName === 'حفرة الطمي' ? 'c' : 'i';
      const resRate =
        resKey === 'w' ? input.sellWood : resKey === 'c' ? input.sellClay : input.sellIron;
      const shadowMult = resKey === 'w' ? woodShadow : resKey === 'c' ? clayShadow : ironShadow;

      const deltaProdHr =
        getMineHourlyForInput(resKey, curL + 1, input) -
        getMineHourlyForInput(resKey, curL, input);
      const deltaPPhr = deltaProdHr / Math.max(1, resRate);

      const waitSec = calcWaitSec(cost);
      const effRemHrs = Math.max(0, remHrs - (waitSec + durSec) / 3600);
      const netCostPP = Math.max(
        0.01,
        resToPP(
          Math.max(0, cost.w - rew.w),
          Math.max(0, cost.c - rew.c),
          Math.max(0, cost.i - rew.i),
          input
        )
      );

      const paybackHrs = deltaPPhr > 0 ? netCostPP / deltaPPhr : Infinity;
      const horizonGainPP = deltaPPhr * effRemHrs;
      const netGainPP = horizonGainPP - netCostPP;

      if (isEndDailyGoal) {
        if (effRemHrs <= 0.25) continue;
        const score =
          ((deltaPPhr * 24 * shadowMult * genome.mineWeight) /
            Math.max(0.25, netCostPP * (1 + waitSec / 14400)));
        candidates.push({
          bName: mName,
          cost,
          netGainPP: Math.max(0.1, deltaPPhr * 24),
          score,
          waitSec,
          reason: `رفع الإنتاج اليومي +${(deltaPPhr * 24).toFixed(1)} نقطة/يوم (استرداد ${Math.round(paybackHrs)}س)`
        });
      } else {
        if (paybackHrs > effRemHrs * genome.mineCutoffRatio || netGainPP <= 0.15) continue;
        const roi = (netGainPP / netCostPP) * shadowMult * genome.mineWeight;
        const score = (roi * (1 + deltaPPhr * 6)) / Math.max(0.35, waitSec / 3600 + durSec / 7200 + 0.35);
        candidates.push({
          bName: mName,
          cost,
          netGainPP,
          score,
          waitSec,
          reason: `استثمار منجم مربح (استرداد ${Math.round(paybackHrs)}س < المتبقي ${Math.round(effRemHrs)}س · صافي +${netGainPP.toFixed(1)} نقطة)`
        });
      }
    }

    // 2. Statue L1 for Paladin (+100 carry for 340 net res!)
    if (
      genome.usePaladin &&
      genome.maxScavTier > 0 &&
      (lvls['النصب التذكاري'] || 0) === 0 &&
      paladinsReady === 0 &&
      !paladinInQueue &&
      remHrs > Math.max(12, 21600 / input.worldSpeed / 3600 + 6)
    ) {
      const stCost = getBuildingUpgradeCost('النصب التذكاري', 1);
      if (stCost) {
        candidates.push({
          bName: 'النصب التذكاري',
          cost: stCost,
          netGainPP: 25,
          score: 750,
          waitSec: calcWaitSec(stCost),
          reason: 'بناء النصب التذكاري لتعيين قائد الفرسان (+100 حمولة بالتوازي مع الثكنات)'
        });
      }
    }

    // 3. Barracks L1 Prerequisite if not built yet
    if (
      genome.maxScavTier > 0 &&
      genome.maxSpearsCap > 0 &&
      (lvls['الثكنات'] || 0) === 0 &&
      remHrs > 14
    ) {
      if ((lvls['المبنى الرئيسي'] || 0) < 3) {
        const hqL = lvls['المبنى الرئيسي'] || 1;
        const hqCost = getBuildingUpgradeCost('المبنى الرئيسي', hqL + 1);
        if (hqCost) {
          candidates.push({
            bName: 'المبنى الرئيسي',
            cost: hqCost,
            netGainPP: 60,
            score: 850,
            waitSec: calcWaitSec(hqCost),
            reason: 'متطلب أساسي لفتح الثكنات وتدريب جيش الإغارات'
          });
        }
      } else {
        const barCost = getBuildingUpgradeCost('الثكنات', 1);
        if (barCost) {
          candidates.push({
            bName: 'الثكنات',
            cost: barCost,
            netGainPP: 90,
            score: 950,
            waitSec: calcWaitSec(barCost),
            reason: 'بناء الثكنات لبدء تدريب الرمح وتشغيل الإغارات بالتوازي'
          });
        }
      }
    }

    // 4. Aggressive Barracks Scaling (crucial for pumping 250–900+ spears fast!)
    const curBar = lvls['الثكنات'] || 0;
    if (
      curBar >= 1 &&
      curBar < genome.maxBarracks &&
      genome.maxScavTier > 0 &&
      spearsReady + spearsInQueue < genome.maxSpearsCap * 0.85 &&
      remHrs > 22
    ) {
      const barCost = getBuildingUpgradeCost('الثكنات', curBar + 1);
      if (barCost) {
        const rew = getBuildingCompletionReward(barCost, input);
        const netCostPP = Math.max(
          0.1,
          resToPP(
            Math.max(0, barCost.w - rew.w),
            Math.max(0, barCost.c - rew.c),
            Math.max(0, barCost.i - rew.i),
            input
          )
        );
        const oldTrain = getOfficialUnitTrainSec('spear', curBar, input.worldSpeed);
        const newTrain = getOfficialUnitTrainSec('spear', curBar + 1, input.worldSpeed);
        const oldRateHr = 3600 / oldTrain;
        const newRateHr = 3600 / newTrain;
        const extraSpearsPerDay = (newRateHr - oldRateHr) * 24;
        const trainDaysLeft = Math.min(
          (remHrs / 24) * 0.7,
          (genome.maxSpearsCap - (spearsReady + spearsInQueue)) / Math.max(1, newRateHr * 24)
        );
        const extraSpearsTotal = extraSpearsPerDay * trainDaysLeft;
        const marginalDailyPerSpear = Math.max(
          18,
          (calcSmoothDailyScavLoot(
            totalCarry + 250,
            Math.max(1, scavTiers, Math.min(genome.maxScavTier, 3)),
            input.activeHoursPerDay,
            genome.onlineRunCapHrs,
            input.worldSpeed
          ).dailyLoot -
            smoothScav.dailyLoot) /
            10
        );
        const extraLootPP =
          (extraSpearsTotal * marginalDailyPerSpear * Math.max(0.6, remHrs / 42)) /
          Math.max(1, avgSellRate(input));

        if (
          extraLootPP * genome.barracksAggression > netCostPP ||
          (isEndDailyGoal && curBar < genome.maxBarracks && extraSpearsPerDay >= 3)
        ) {
          const netG = Math.max(0.5, extraLootPP - netCostPP);
          const barRoi = (extraLootPP * genome.barracksAggression) / netCostPP;
          candidates.push({
            bName: 'الثكنات',
            cost: barCost,
            netGainPP: netG,
            score: barRoi * 3.0,
            waitSec: calcWaitSec(barCost),
            reason: `تسريع الثكنات (${oldTrain}ث ← ${newTrain}ث للرمح · +${Math.round(extraSpearsPerDay)} رمح/يوم إضافي)`
          });
        }
      }
    }

    // 5. Optional Smithy L1 (for Iron-sink Swords) or Stable L3 Path (for Parallel Light Cavalry)
    if (genome.useSwords && (lvls['الحداد'] || 0) === 0 && remHrs > 36 && i > w * 1.6 && i > 400) {
      if ((lvls['المبنى الرئيسي'] || 1) < 5) {
        const hqCost = getBuildingUpgradeCost('المبنى الرئيسي', (lvls['المبنى الرئيسي'] || 1) + 1);
        if (hqCost) {
          candidates.push({
            bName: 'المبنى الرئيسي',
            cost: hqCost,
            netGainPP: 10,
            score: 8,
            waitSec: calcWaitSec(hqCost),
            reason: 'فتح الحداد لتوظيف فائض الحديد في تدريب السيوف'
          });
        }
      } else if ((lvls['الثكنات'] || 0) >= 1) {
        const smCost = getBuildingUpgradeCost('الحداد', 1);
        if (smCost) {
          candidates.push({
            bName: 'الحداد',
            cost: smCost,
            netGainPP: 12,
            score: 14,
            waitSec: calcWaitSec(smCost),
            reason: 'بناء الحداد م1 لتدريب السيوف وتصريف فائض الحديد في الإغارات'
          });
        }
      }
    }

    if (genome.useLightCav && (lvls['الإسطبل'] || 0) < 3 && remHrs > 96) {
      let prereqTarget: string | null = null;
      if ((lvls['المبنى الرئيسي'] || 1) < 10) prereqTarget = 'المبنى الرئيسي';
      else if ((lvls['الثكنات'] || 0) < 5) prereqTarget = 'الثكنات';
      else if ((lvls['الحداد'] || 0) < 5) prereqTarget = 'الحداد';
      else prereqTarget = 'الإسطبل';

      if (prereqTarget) {
        const pCost = getBuildingUpgradeCost(prereqTarget, (lvls[prereqTarget] || 0) + 1);
        if (pCost) {
          candidates.push({
            bName: prereqTarget,
            cost: pCost,
            netGainPP: 40,
            score: 22,
            waitSec: calcWaitSec(pCost),
            reason: 'فتح الإسطبل م3 لتدريب الفرسان الخفيفة بالتوازي مع الثكنات (+80 حمولة)'
          });
        }
      }
    }

    // 6. HQ Upgrade (unconstrained up to genome.maxHQ when build queue times justify faster builds)
    const curHQ = lvls['المبنى الرئيسي'] || 1;
    const avgMine =
      ((lvls['الخشاب'] || 0) + (lvls['حفرة الطمي'] || 0) + (lvls['منجم الحديد'] || 0)) / 3;
    if (curHQ < genome.maxHQ && avgMine >= curHQ * 1.9 && remHrs > 36) {
      const hqCost = getBuildingUpgradeCost('المبنى الرئيسي', curHQ + 1);
      if (hqCost) {
        const rew = getBuildingCompletionReward(hqCost, input);
        const netCostPP = Math.max(
          0.1,
          resToPP(
            Math.max(0, hqCost.w - rew.w),
            Math.max(0, hqCost.c - rew.c),
            Math.max(0, hqCost.i - rew.i),
            input
          )
        );
        const nextMineBuildSec = getOfficialBuildSec(
          'الخشاب',
          Math.min(30, Math.round(avgMine) + 1),
          curHQ,
          input.worldSpeed,
          input.enableFreeFinish,
          input.freeFinishSec
        );
        const estFutureBuilds = Math.min(20, Math.max(4, Math.floor(remHrs / 6)));
        const savedHrs = (nextMineBuildSec * 0.048 * estFutureBuilds) / 3600;
        const avgDeltaPPhr = ((wHr + cHr + iHr) * 0.05) / Math.max(1, avgSellRate(input));
        const valPP = savedHrs * avgDeltaPPhr * 2.4;
        if (valPP > netCostPP * 1.05 || (isEndDailyGoal && nextMineBuildSec > 3000)) {
          candidates.push({
            bName: 'المبنى الرئيسي',
            cost: hqCost,
            netGainPP: Math.max(0.2, valPP - netCostPP),
            score: Math.max(0.2, (valPP - netCostPP) / netCostPP),
            waitSec: calcWaitSec(hqCost),
            reason: 'تقليل زمن البناء 5% لتسريع تطوير المناجم والمباني'
          });
        }
      }
    }

    // 7. Market Upgrade (if merchant cap is enforced)
    if (input.enforceMarketMerchants && remHrs > 18) {
      const curMkt = lvls['السوق'] || 0;
      const curMerchants = getMerchantsCount(curMkt);
      const dailyThroughput = curMerchants * 1000 * Math.max(2, Math.min(12, input.activeHoursPerDay));
      const dailyResOut = (wHr + cHr + iHr) * 24 + smoothScav.dailyLoot;
      if (curMkt < 20 && dailyResOut > dailyThroughput * 0.9 && meetsBuildingPrereqs('السوق', lvls)) {
        const mktCost = getBuildingUpgradeCost('السوق', curMkt + 1);
        if (mktCost) {
          candidates.push({
            bName: 'السوق',
            cost: mktCost,
            netGainPP: 25,
            score: 140,
            waitSec: calcWaitSec(mktCost),
            reason: 'رفع عدد التجار لبيع فائض الإنتاج والإغارات دون تكدس بالمخزن'
          });
        }
      }
    }

    // 8. Proactive Overnight Warehouse Overflow Protection (accounting for overnight max-tier blast!)
    const offlineHrs = remainingOfflineHoursTonight(input.activeHoursPerDay);
    const maxResHr = Math.max(wHr, cHr, iHr);
    const overnightLootEst =
      scavTiers > 0
        ? cachedSolveScav(
            totalCarry,
            [0, 1, 2, 3].slice(0, scavTiers),
            'overnight_max_loot',
            Math.max(3600, (offlineHrs + 1.5) * 3600)
          ).totalLoot / 3
        : 0;
    const overnightFillEst = maxResHr * offlineHrs + overnightLootEst;
    const whLvl = lvls['المخازن'] || 1;
    if (whLvl < 30 && offlineHrs > 0 && overnightFillEst > cap * 1.02 && remHrs > 20) {
      const whCost = getBuildingUpgradeCost('المخازن', whLvl + 1);
      if (whCost) {
        const rew = getBuildingCompletionReward(whCost, input);
        const netCostRes = Math.max(0, whCost.total - rew.total);
        const nightsLeft = Math.max(1, Math.floor(remHrs / 24));
        const savedPerNight =
          Math.min(getWarehouseCap(whLvl + 1) - cap, Math.max(0, overnightFillEst - cap)) * 2.5;
        if (savedPerNight * nightsLeft > netCostRes * 1.1) {
          candidates.push({
            bName: 'المخازن',
            cost: whCost,
            netGainPP: (savedPerNight * nightsLeft - netCostRes) / avgSellRate(input),
            score: 210,
            waitSec: calcWaitSec(whCost),
            reason: `توسعة المخزن (${cap.toLocaleString('en-US')} ← ${getWarehouseCap(whLvl + 1).toLocaleString('en-US')}) لاستيعاب غنيمة الإغارة الليلية دون فيضان`
          });
        }
      }
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];

    // Prerequisite Guard: Warehouse cap
    if (Math.max(best.cost.w, best.cost.c, best.cost.i) > cap && whLvl < 30) {
      const whCost = getBuildingUpgradeCost('المخازن', whLvl + 1);
      if (whCost) {
        return {
          bName: 'المخازن',
          cost: whCost,
          netGainPP: best.netGainPP,
          score: best.score + 50,
          waitSec: calcWaitSec(whCost),
          reason: `توسعة المخزن لاستيعاب تكلفة ${best.bName}`
        };
      }
    }

    // Prerequisite Guard: Farm population
    const popNeed = getBuildingPopDelta(
      best.bName,
      lvls[best.bName] || 0,
      (lvls[best.bName] || 0) + 1
    );
    if (popNeed > getFreePop() && (lvls['المزارع'] || 1) < 30) {
      const farmCost = getBuildingUpgradeCost('المزارع', (lvls['المزارع'] || 1) + 1);
      if (farmCost) {
        return {
          bName: 'المزارع',
          cost: farmCost,
          netGainPP: best.netGainPP,
          score: best.score + 60,
          waitSec: calcWaitSec(farmCost),
          reason: `توسعة المزارع لتوفير السكان اللازمين لبناء ${best.bName}`
        };
      }
    }

    return best;
  };

  const evaluateScavUnlockNeed = (
    remHrs: number
  ): {
    targetTier: number;
    cost: { w: number; c: number; i: number; total: number };
    netGainPP: number;
    reason: string;
  } | null => {
    if (activeScavUnlock) return null;
    if (scavTiers >= genome.maxScavTier) return null;
    if ((lvls['الثكنات'] || 0) < 1 && getTotalPlannedCarry() < 100) return null;

    const targetTier = scavTiers + 1;
    const def = SCAV_UNLOCK_DATA[String(targetTier)];
    if (!def) return null;
    if (remHrs * 3600 <= def.sec + 7200) return null;

    const curSpearsEq = Math.round(getTotalPlannedCarry() / 25);
    if (targetTier === 3 && curSpearsEq < genome.t3MinSpears) return null;
    if (targetTier === 4 && curSpearsEq < genome.t4MinSpears) return null;

    const lookaheadCarry = Math.max(
      getTotalPlannedCarry(),
      Math.min(genome.maxSpearsCap * 25, getTotalPlannedCarry() + 1000)
    );
    if (lookaheadCarry < 150) return null;

    const before = calcSmoothDailyScavLoot(
      lookaheadCarry,
      scavTiers,
      input.activeHoursPerDay,
      genome.onlineRunCapHrs,
      input.worldSpeed
    );
    const after = calcSmoothDailyScavLoot(
      lookaheadCarry,
      targetTier,
      input.activeHoursPerDay,
      genome.onlineRunCapHrs,
      input.worldSpeed
    );
    const deltaDailyRes = Math.max(0, after.dailyLoot - before.dailyLoot);
    const deltaDailyPP = resToPP(deltaDailyRes / 3, deltaDailyRes / 3, deltaDailyRes / 3, input);
    const effRemDays = Math.max(0, (remHrs - def.sec / 3600) / 24);
    const unlockCostPP = resToPP(def.wood, def.clay, def.iron, input);
    const netGainPP = deltaDailyPP * effRemDays - unlockCostPP;

    if (input.goal === 'max_end_daily_pp') {
      if (deltaDailyPP <= 0.5 || effRemDays < 0.2) return null;
    } else {
      if (netGainPP <= 0) return null;
    }

    return {
      targetTier,
      cost: { w: def.wood, c: def.clay, i: def.iron, total: def.wood + def.clay + def.iron },
      netGainPP,
      reason: `فتح الفئة ${targetTier} يزيد غنيمة الإغارات +${Math.round(deltaDailyRes).toLocaleString('en-US')} مورد/يوم (+${deltaDailyPP.toFixed(1)} نقطة/يوم)`
    };
  };

  const evaluateSpearTrainingNeed = (
    remHrs: number,
    allowOvernightTopUp: boolean
  ): {
    batchQty: number;
    netGainPP: number;
    paybackHrs: number;
    roiPerRes: number;
    reason: string;
  } | null => {
    if (genome.maxScavTier <= 0 || genome.maxSpearsCap <= 0) return null;
    if ((lvls['الثكنات'] || 0) < 1) return null;
    const totalSpears = spearsReady + spearsInQueue;
    if (totalSpears >= genome.maxSpearsCap) return null;
    if (remHrs < 6) return null;

    const trainSec = getOfficialUnitTrainSec('spear', lvls['الثكنات'] || 1, input.worldSpeed);
    const offlineHrs = remainingOfflineHoursTonight(input.activeHoursPerDay);
    const overnightQueueCap = allowOvernightTopUp
      ? Math.ceil((offlineHrs * 3600) / Math.max(1, trainSec)) + 6
      : Math.max(10, genome.spearBatchSize * 2);

    if (barracksQueueUnits.length >= overnightQueueCap) return null;

    const effTiers = Math.max(
      1,
      scavTiers,
      activeScavUnlock ? activeScavUnlock.targetTier : 0,
      Math.min(genome.maxScavTier, totalSpears >= genome.t3MinSpears * 0.7 ? 3 : 2)
    );
    const maxBatchAllowed = allowOvernightTopUp
      ? Math.min(
          genome.maxSpearsCap - totalSpears,
          Math.max(genome.spearBatchSize, overnightQueueCap - barracksQueueUnits.length)
        )
      : Math.min(genome.spearBatchSize, genome.maxSpearsCap - totalSpears);
    const batch = Math.max(1, maxBatchAllowed);

    const capBefore = getTotalPlannedCarry();
    const capAfter = capBefore + batch * SPEAR_COST.carry;

    const lootBefore = calcSmoothDailyScavLoot(
      capBefore,
      effTiers,
      input.activeHoursPerDay,
      genome.onlineRunCapHrs,
      input.worldSpeed
    );
    const lootAfter = calcSmoothDailyScavLoot(
      capAfter,
      effTiers,
      input.activeHoursPerDay,
      genome.onlineRunCapHrs,
      input.worldSpeed
    );

    const deltaDailyRes = Math.max(0, lootAfter.dailyLoot - lootBefore.dailyLoot);
    const deltaPPhr =
      resToPP(deltaDailyRes / 3, deltaDailyRes / 3, deltaDailyRes / 3, input) / 24;
    const batchCostPP = resToPP(
      batch * SPEAR_COST.w,
      batch * SPEAR_COST.c,
      batch * SPEAR_COST.i,
      input
    );

    const queueDelayHrs = ((barracksQueueUnits.length + batch * 0.5) * trainSec) / 3600 + 0.5;
    const effRemHrs = Math.max(0, remHrs - queueDelayHrs);

    if (deltaPPhr <= 0 || effRemHrs <= 1) return null;
    const paybackHrs = batchCostPP / deltaPPhr;
    const netGainPP = deltaPPhr * effRemHrs * genome.spearBias - batchCostPP;

    if (input.goal === 'max_net_pp') {
      if (paybackHrs > effRemHrs * genome.spearCutoffRatio || netGainPP <= 0) return null;
    } else {
      if (effRemHrs <= 0.5 || deltaDailyRes / batch < 5) return null;
    }

    return {
      batchQty: batch,
      netGainPP,
      paybackHrs,
      roiPerRes: netGainPP / Math.max(0.01, batchCostPP),
      reason: `إغارة مربحة: +${batch} رمح يضيف +${Math.round(deltaDailyRes)} مورد/يوم (استرداد ${Math.round(paybackHrs)}س < المتبقي ${Math.round(effRemHrs)}س)`
    };
  };

  let iterGuard = 0;
  const MAX_ITERS = 3800;

  while (t < horizonSec && iterGuard++ < MAX_ITERS) {
    completeEventsUpToNow();
    recordTrajectoryUpTo(t);

    const remHrs = (horizonSec - t) / 3600;
    const online = isOnlineAt(t, input.activeHoursPerDay);
    const curPhase: SmartStepPhase =
      t < 86400 ? 'launch_24h' : remHrs > 18 ? 'growth' : 'harvest';

    if (online) {
      const dayStart = Math.floor(t / 86400) * 86400;
      const sleepStart = dayStart + input.activeHoursPerDay * 3600;
      const secsUntilSleep = sleepStart - t;
      const isBeforeSleep = input.activeHoursPerDay < 24 && secsUntilSleep <= 3600;
      const isLaunchOvernightWindow = input.activeHoursPerDay < 24 && secsUntilSleep <= 120;

      // 1. Dispatch scavenging across ANY free slots (wind-down before sleep -> 100%-army overnight blast at sleepStart!)
      if (scavTiers > 0) {
        tryDispatchScavenging(isLaunchOvernightWindow, secsUntilSleep);
      }

      // 2. Recruit Paladin immediately when Statue L1 exists
      if (
        genome.usePaladin &&
        (lvls['النصب التذكاري'] || 0) >= 1 &&
        paladinsReady === 0 &&
        !paladinInQueue &&
        remHrs > 12 &&
        w >= PALADIN_COST.w &&
        c >= PALADIN_COST.c &&
        i >= PALADIN_COST.i &&
        getFreePop() >= PALADIN_COST.pop
      ) {
        startPaladinRecruit(
          curPhase,
          'تعيين قائد الفرسان (+100 حمولة بالتوازي مع الثكنات)'
        );
      }

      // 3. Research & Train Light Cavalry in Stable IN PARALLEL with Barracks (if genome enables LC)
      if (genome.useLightCav && (lvls['الإسطبل'] || 0) >= 3 && remHrs > 36) {
        if (!lightResearched && w >= 2200 && c >= 2400 && i >= 2000) {
          w -= 2200;
          c -= 2400;
          i -= 2000;
          totalSpentRes += 6600;
          lightResearched = true;
          stepCounter += 1;
          steps.push({
            stepNum: stepCounter,
            atype: 'bldg',
            bName: 'بحث الفارس الخفيف',
            baseName: 'الإسطبل',
            targetLvl: 3,
            lvl: 3,
            tStart: Math.round(t),
            tEnd: Math.round(t + 3600 / input.worldSpeed),
            durSec: Math.round(3600 / input.worldSpeed),
            cost: { w: 2200, c: 2400, i: 2000 },
            reward: { w: 0, c: 0, i: 0 },
            netCostRes: 6600,
            phase: curPhase,
            reason: 'تفعيل تدريب الفرسان الخفيفة في الإسطبل بالتوازي مع الثكنات'
          });
        } else if (lightResearched && lightsInQueue < 10) {
          const maxLc = Math.min(
            6,
            Math.floor(getFreePop() / LIGHT_COST.pop),
            Math.floor(w / LIGHT_COST.w),
            Math.floor(c / LIGHT_COST.c),
            Math.floor(i / LIGHT_COST.i)
          );
          if (maxLc >= 1 && remHrs > 30) {
            startLightBatch(
              maxLc,
              curPhase,
              'تدريب خفيف بالتوازي في الإسطبل (+80 حمولة وتصريف فائض الحديد)'
            );
          }
        }
      }

      // 4. Evaluate Scavenging Tier Unlock (parallel with building!)
      const unlockNeed = evaluateScavUnlockNeed(remHrs);
      if (unlockNeed) {
        const cap = getCap();
        if (
          Math.max(unlockNeed.cost.w, unlockNeed.cost.c, unlockNeed.cost.i) <= cap &&
          w >= unlockNeed.cost.w &&
          c >= unlockNeed.cost.c &&
          i >= unlockNeed.cost.i
        ) {
          startScavUnlock(unlockNeed.targetTier, curPhase, unlockNeed.reason);
          continue;
        }
      }

      // 5. Evaluate Spear Training AND Best Building Action
      const spearNeed = evaluateSpearTrainingNeed(remHrs, isBeforeSleep);
      let bestBldg = !activeBuild ? evaluateBestBuildAction(remHrs) : null;

      const reserveForUnlock =
        unlockNeed &&
        (unlockNeed.targetTier <= 2 ||
          (w >= unlockNeed.cost.w * 0.65 && c >= unlockNeed.cost.c * 0.65 && i >= unlockNeed.cost.i * 0.65));

      const bldgRoi = bestBldg
        ? bestBldg.netGainPP /
          Math.max(0.05, resToPP(bestBldg.cost.w, bestBldg.cost.c, bestBldg.cost.i, input))
        : -1;
      const preferSpearsFirst = Boolean(
        spearNeed &&
          !reserveForUnlock &&
          (barracksQueueUnits.length < 4 || isBeforeSleep || spearNeed.roiPerRes >= bldgRoi * 0.75)
      );

      if (spearNeed && !reserveForUnlock && preferSpearsFirst) {
        const maxAff = Math.min(
          spearNeed.batchQty,
          getFreePop(),
          Math.floor(w / SPEAR_COST.w),
          Math.floor(c / SPEAR_COST.c),
          Math.floor(i / SPEAR_COST.i)
        );
        if (getFreePop() < Math.min(spearNeed.batchQty, 4)) {
          if (!activeBuild && (lvls['المزارع'] || 1) < 30) {
            const farmCost = getBuildingUpgradeCost('المزارع', (lvls['المزارع'] || 1) + 1);
            if (farmCost && w >= farmCost.w && c >= farmCost.c && i >= farmCost.i) {
              startBuildingUpgrade(
                'المزارع',
                curPhase,
                'توسعة المزارع لاستكمال تدريب جيش الإغارات'
              );
              continue;
            }
          }
        }
        const minBatch = barracksQueueUnits.length < 2 || isBeforeSleep ? 1 : Math.min(3, spearNeed.batchQty);
        if (maxAff >= minBatch) {
          startSpearBatch(maxAff, curPhase, spearNeed.reason);
          continue;
        }
      }

      // Optional Iron-sink Swords if Wood is starved and Iron is piled up
      if (
        genome.useSwords &&
        (lvls['الحداد'] || 0) >= 1 &&
        barracksQueueUnits.length < 3 &&
        remHrs > 30 &&
        i > w * 2.2 &&
        i >= SWORD_COST.i * 4 &&
        w >= SWORD_COST.w * 2 &&
        c >= SWORD_COST.c * 2
      ) {
        const swAff = Math.min(
          6,
          getFreePop(),
          Math.floor(w / SWORD_COST.w),
          Math.floor(c / SWORD_COST.c),
          Math.floor(i / SWORD_COST.i)
        );
        if (swAff >= 2) {
          startSwordBatch(
            swAff,
            curPhase,
            'تدريب سيوف لتصريف فائض الحديد وزيادة حمولة الإغارات'
          );
          continue;
        }
      }

      // 6. Execute Building Action (prioritize Warehouse if blocking a profitable Scav Tier unlock!)
      if (
        !activeBuild &&
        unlockNeed &&
        Math.max(unlockNeed.cost.w, unlockNeed.cost.c, unlockNeed.cost.i) > getCap() &&
        (lvls['المخازن'] || 1) < 30
      ) {
        const whCost = getBuildingUpgradeCost('المخازن', (lvls['المخازن'] || 1) + 1);
        if (whCost) {
          bestBldg = {
            bName: 'المخازن',
            cost: whCost,
            netGainPP: unlockNeed.netGainPP,
            score: 500,
            waitSec: 0,
            reason: `توسعة المخزن لاستيعاب تكلفة ${SCAV_UNLOCK_DATA[String(unlockNeed.targetTier)]?.name}`
          };
        }
      }

      if (bestBldg && !activeBuild) {
        const canAffordNow =
          w >= bestBldg.cost.w && c >= bestBldg.cost.c && i >= bestBldg.cost.i;
        const saveForBarracks =
          spearNeed &&
          barracksQueueUnits.length === 0 &&
          spearNeed.roiPerRes > bldgRoi * 1.1 &&
          !reserveForUnlock;
        if (canAffordNow && !reserveForUnlock && !saveForBarracks) {
          startBuildingUpgrade(bestBldg.bName, curPhase, bestBldg.reason);
          continue;
        }
      }

      // Secondary spear top-up if building couldn't start yet
      if (spearNeed && !reserveForUnlock && !preferSpearsFirst) {
        const maxAff = Math.min(
          spearNeed.batchQty,
          getFreePop(),
          Math.floor(w / SPEAR_COST.w),
          Math.floor(c / SPEAR_COST.c),
          Math.floor(i / SPEAR_COST.i)
        );
        if (maxAff >= Math.min(3, spearNeed.batchQty)) {
          startSpearBatch(maxAff, curPhase, spearNeed.reason);
          continue;
        }
      }

      // 7. Zero-Overflow Smart Selling (Harvest Mode OR Pre-Sleep Overnight Headroom OR Warehouse > 84%)
      const hasAnyPlannedInvestment = Boolean(bestBldg || spearNeed || unlockNeed);
      const cap = getCap();
      if (!hasAnyPlannedInvestment) {
        trySellSurplus({ w: 0, c: 0, i: 0 });
      } else if (isBeforeSleep) {
        // Pre-sleep sell excess that would otherwise overflow overnight (mines + returning overnight scavenging blast!)
        const offlineHrs = remainingOfflineHoursTonight(input.activeHoursPerDay);
        const wHr = getMineHourlyForInput('w', lvls['الخشاب'] || 0, input);
        const cHr = getMineHourlyForInput('c', lvls['حفرة الطمي'] || 0, input);
        const iHr = getMineHourlyForInput('i', lvls['منجم الحديد'] || 0, input);
        const nightScavEach =
          scavTiers > 0
            ? cachedSolveScav(
                getTotalReadyCarry(),
                [0, 1, 2, 3].slice(0, scavTiers),
                'overnight_max_loot',
                Math.max(3600, (offlineHrs + 1.5) * 3600)
              ).totalLoot / 3
            : 0;
        const keepW = Math.max(0, cap - wHr * offlineHrs * 1.05 - nightScavEach);
        const keepC = Math.max(0, cap - cHr * offlineHrs * 1.05 - nightScavEach);
        const keepI = Math.max(0, cap - iHr * offlineHrs * 1.05 - nightScavEach);
        trySellSurplus({ w: keepW, c: keepC, i: keepI });
      } else if (w > cap * 0.84 || c > cap * 0.84 || i > cap * 0.84) {
        const keepW = Math.min(cap * 0.78, Math.max(bestBldg?.cost.w ?? 0, unlockNeed?.cost.w ?? 0));
        const keepC = Math.min(cap * 0.78, Math.max(bestBldg?.cost.c ?? 0, unlockNeed?.cost.c ?? 0));
        const keepI = Math.min(cap * 0.78, Math.max(bestBldg?.cost.i ?? 0, unlockNeed?.cost.i ?? 0));
        trySellSurplus({ w: keepW, c: keepC, i: keepI });
      }
    } else {
      // Sleep entry: guarantee 100%-army overnight max-tier blast fires right at sleepStart!
      const dayIdx = Math.floor(t / 86400);
      if (overnightBlastDay !== dayIdx && scavTiers > 0) {
        tryDispatchScavenging(true, 0);
      }
    }

    // Jump to next discrete event (avoid waking up on every single troop graduation when scav slots are busy!)
    const nextEvents: number[] = [horizonSec];
    const curBuildEv = readActiveBuild();
    const curScavUnlockEv = readActiveScavUnlock();
    if (curBuildEv) nextEvents.push(curBuildEv.finishAt);
    if (curScavUnlockEv) nextEvents.push(curScavUnlockEv.finishAt);
    if (paladinInQueue && paladinFinishAt < Infinity) nextEvents.push(paladinFinishAt);

    let hasFreeScavSlot = false;
    for (let s = 0; s < scavTiers; s++) {
      if (scavSlots[s].returnAt === Infinity) hasFreeScavSlot = true;
    }
    if (barracksQueueUnits.length > 0 && barracksNextFinishAt < Infinity) {
      if (barracksQueueUnits.length <= 2 || hasFreeScavSlot) {
        nextEvents.push(barracksNextFinishAt);
      } else {
        // Wake up right before queue runs low (2 units left) instead of every single spear!
        const unitSec = getOfficialUnitTrainSec(
          barracksQueueUnits[0],
          lvls['الثكنات'] || 1,
          input.worldSpeed
        );
        const lowQueueAt = barracksNextFinishAt + Math.max(0, barracksQueueUnits.length - 2) * unitSec;
        nextEvents.push(lowQueueAt);
      }
    }
    if (lightsInQueue > 0 && stableNextFinishAt < Infinity) {
      if (lightsInQueue <= 2 || hasFreeScavSlot) {
        nextEvents.push(stableNextFinishAt);
      }
    }
    for (let s = 0; s < 4; s++) {
      if (scavSlots[s].returnAt < Infinity) nextEvents.push(scavSlots[s].returnAt);
    }

    const nextDaySec = nextTrajectoryDay * 86400;
    if (nextDaySec > t + 1) nextEvents.push(nextDaySec);

    if (online) {
      if (input.activeHoursPerDay < 24) {
        const sleepAt = Math.floor(t / 86400) * 86400 + input.activeHoursPerDay * 3600;
        const preSleepTopUpAt = sleepAt - 1800;
        const launchAt = sleepAt - 60;
        if (preSleepTopUpAt > t + 1) nextEvents.push(preSleepTopUpAt);
        if (launchAt > t + 1) nextEvents.push(launchAt);
        if (sleepAt > t + 1) nextEvents.push(sleepAt);
      }
      nextEvents.push(t + 1800);
    } else {
      const wakeAt = nextOnlineTime(t, input.activeHoursPerDay);
      if (wakeAt > t + 1) nextEvents.push(wakeAt);
    }

    const nextT = Math.min(...nextEvents.filter((x) => x > t + 0.5));
    if (!Number.isFinite(nextT) || nextT <= t) {
      advanceTimeTo(horizonSec);
      break;
    }
    advanceTimeTo(nextT);
  }

  // Final flush at horizon
  completeEventsUpToNow();
  trySellSurplus({ w: 0, c: 0, i: 0 }, true);
  recordTrajectoryUpTo(horizonSec);

  const endDaily = computeCurrentDailyBreakdown();
  const soldPP = resToPP(soldW, soldC, soldI, input);
  const endingStockPP = resToPP(w, c, i, input);
  const totalNetPP = soldPP + endingStockPP;

  const finalSpearsTotal = spearsReady + spearsInQueue;
  const finalPaladinsTotal = paladinsReady + (paladinInQueue ? 1 : 0);
  const finalSwordsTotal = swordsReady + swordsInQueue;
  const finalLightsTotal = lightsReady + lightsInQueue;
  const totalArmyCarry = getTotalPlannedCarry();

  const fallback24h: Checkpoint24hSummary = checkpoint24h ?? {
    dailyMinesPP: Number(endDaily.dailyMinesPP.toFixed(1)),
    dailyScavPP: Number(endDaily.dailyScavPP.toFixed(1)),
    dailyTotalPP: Number(endDaily.dailyTotalPP.toFixed(1)),
    dailyMinesRes: Math.round(endDaily.dailyMinesRes),
    dailyScavRes: Math.round(endDaily.dailyScavRes),
    spears: finalSpearsTotal,
    paladins: finalPaladinsTotal,
    swords: finalSwordsTotal,
    lights: finalLightsTotal,
    totalCarry: totalArmyCarry,
    scavTiers,
    woodLvl: lvls['الخشاب'] || 0,
    clayLvl: lvls['حفرة الطمي'] || 0,
    ironLvl: lvls['منجم الحديد'] || 0,
    hqLvl: lvls['المبنى الرئيسي'] || 1,
    warehouseLvl: lvls['المخازن'] || 1,
    barracksLvl: lvls['الثكنات'] || 0,
    cumNetPP: Number(totalNetPP.toFixed(1))
  };

  const finalLastSpearHour = readLastSpearTrainHour();
  const finalLastMineHour = readLastMineUpgradeHour();
  let spearCutoffReason = 'لم يتم تدريب جيش في هذه الخطة (التركيز الكامل على الحقول أعلى عائداً لإعداداتك الحالية).';
  if (spearsTrained > 0 && finalLastSpearHour !== null) {
    const remAtStop = Math.max(0, input.horizonDays * 24 - finalLastSpearHour);
    spearCutoffReason =
      input.goal === 'max_net_pp'
        ? `توقف تدريب الرمح تلقائياً عند الساعة ${Math.round(finalLastSpearHour)} (المتبقي ${Math.round(remAtStop)}س) للتحول لمرحلة الحصاد والبيع الصافي.`
        : `استمر تدريب الجيش حتى الساعة ${Math.round(finalLastSpearHour)} لتعظيم الإنتاج اليومي بنهاية المدة.`;
  }

  // Compute recommended final online & overnight scavenging splits for the user to copy!
  const tierIdxs = [0, 1, 2, 3].slice(0, scavTiers);
  const recommendedOnlineSplit =
    scavTiers > 0 && totalArmyCarry >= 75 && input.activeHoursPerDay > 0
      ? solveOptimalScavAllocation(
          totalArmyCarry,
          tierIdxs,
          input.worldSpeed,
          'max_rate',
          genome.onlineRunCapHrs > 0
            ? Math.max(3600, genome.onlineRunCapHrs * 3600)
            : Math.max(3600, Math.min(8, input.activeHoursPerDay) * 3600)
        )
      : { slots: [], totalLoot: 0, hourlyLoot: 0, maxDurSec: 0 };

  const offlineH = remainingOfflineHoursTonight(input.activeHoursPerDay);
  const recommendedOvernightSplit =
    scavTiers > 0 && totalArmyCarry >= 75 && input.activeHoursPerDay < 24 && input.activeHoursPerDay > 0
      ? solveOptimalScavAllocation(
          totalArmyCarry,
          tierIdxs,
          input.worldSpeed,
          'overnight_max_loot',
          Math.max(3600, (offlineH + 1.5) * 3600)
        )
      : { slots: [], totalLoot: 0, hourlyLoot: 0, maxDurSec: 0 };

  // Build concise, transparent Arabic strategic insights for the discovered optimum
  const keyDecisions: string[] = [];
  keyDecisions.push(`استراتيجية الافتتاح المختارة: ${openingSummary.philosophyLabel}.`);
  if (finalPaladinsTotal > (input.startPaladins || 0)) {
    keyDecisions.push(
      'تم بناء النصب التذكاري وتعيين قائد الفرسان (+100 حمولة بتكلفة 80 مورد فقط وبالتوازي مع الثكنات دون تعطيلها).'
    );
  }
  if ((lvls['الثكنات'] || 0) > 1) {
    const tSec = getOfficialUnitTrainSec('spear', lvls['الثكنات'] || 1, input.worldSpeed);
    keyDecisions.push(
      `تم رفع الثكنات إلى المستوى ${lvls['الثكنات']} لتسريع تدريب الرمح إلى ${tSec} ثانية وتشغيل الطابور 24 ساعة.`
    );
  }
  if (scavTiers > 0) {
    const splitSummary = recommendedOnlineSplit.slots
      .map((s) => `ف${s.tier}: ${Math.round(s.carry / 25)} رمح`)
      .join(' · ');
    keyDecisions.push(
      `الإغارات المستقلة (${scavRunsCount} جولة حتى ف${scavTiers}): تقسيم النهار الأمثل (${splitSummary}) + ضربة نوم ليلية بأعلى فئة (+${Math.round(recommendedOvernightSplit.totalLoot).toLocaleString('en-US')} مورد/ليلة).`
    );
  }
  const wL = lvls['الخشاب'] || 0;
  const cL = lvls['حفرة الطمي'] || 0;
  const iL = lvls['منجم الحديد'] || 0;
  if (wL > iL) {
    keyDecisions.push(
      `تسعير ذكي لندرة الموارد: تم تقديم الخشاب (م${wL}) والطمي (م${cL}) على الحديد (م${iL}) لتغذية الرمح وبيع فائض الحديد.`
    );
  }
  if (finalSwordsTotal > (input.startSwords || 0)) {
    keyDecisions.push(`تم تدريب ${finalSwordsTotal - (input.startSwords || 0)} سيف لتصريف فائض الحديد ورفع الحمولة.`);
  }
  if (finalLightsTotal > (input.startLights || 0)) {
    keyDecisions.push(`تم فتح الإسطبل وتدريب ${finalLightsTotal - (input.startLights || 0)} فارس خفيف بالتوازي مع الثكنات.`);
  }

  const score =
    input.goal === 'max_end_daily_pp'
      ? endDaily.dailyTotalPP + totalNetPP * 0.001
      : input.enforceMarketMerchants
        ? soldPP + endingStockPP * 0.6
        : totalNetPP;

  return {
    id: genome.id,
    key: genome.key,
    name: genome.name,
    tagline: genome.tagline,
    isWinner: false,
    score: Number(score.toFixed(2)),
    totalNetPP: Number(totalNetPP.toFixed(1)),
    soldPP: Number(soldPP.toFixed(1)),
    endingStockPP: Number(endingStockPP.toFixed(1)),
    endDailyMinesPP: Number(endDaily.dailyMinesPP.toFixed(1)),
    endDailyScavPP: Number(endDaily.dailyScavPP.toFixed(1)),
    endDailyTotalPP: Number(endDaily.dailyTotalPP.toFixed(1)),
    checkpoint24h: fallback24h,
    openingSummary,
    totalMineRes: Math.round(totalMineRes),
    totalScavRes: Math.round(totalScavRes),
    totalQuestRewardRes: Math.round(totalQuestRewardRes),
    totalSpentRes: Math.round(totalSpentRes),
    totalOverflowRes: Math.round(totalOverflowRes),
    finalSpears: finalSpearsTotal,
    finalPaladins: finalPaladinsTotal,
    finalSwords: finalSwordsTotal,
    finalLights: finalLightsTotal,
    totalArmyCarry,
    spearsTrained,
    finalScavTiers: scavTiers,
    scavRunsCount,
    lastSpearTrainHour: finalLastSpearHour !== null ? Number(finalLastSpearHour.toFixed(1)) : null,
    lastMineUpgradeHour: finalLastMineHour !== null ? Number(finalLastMineHour.toFixed(1)) : null,
    spearCutoffReason,
    recommendedOnlineSplit,
    recommendedOvernightSplit,
    keyDecisions,
    finalBuildings: { ...lvls },
    finalPoints: calcVillagePointsFromBuildings(lvls),
    steps,
    dayTrajectory
  };
}

/**
 * Unconstrained 3-Stage Global Optimizer (Exploration + Evolutionary Crossover + Coordinate Hill-Climbing).
 * Evaluates 120–180+ diverse strategies silently across ALL building paths, unit compositions
 * (Paladin, Spears, Swords, Light Cavalry), 4-slot independent scavenging + overnight blasts,
 * and dynamic Wood/Clay/Iron shadow pricing to discover the single mathematically highest-PP plan.
 */
export function runSmartDevelopmentOptimizer(rawInput: SmartPlannerInput): SmartPlannerOutput {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();

  const rawActive = Number(rawInput.activeHoursPerDay);
  const input: SmartPlannerInput = {
    ...rawInput,
    horizonDays: Math.max(1, Math.min(60, Number(rawInput.horizonDays) || 5)),
    worldSpeed: Math.max(0.25, Math.min(10, Number(rawInput.worldSpeed) || 1)),
    activeHoursPerDay: Number.isFinite(rawActive) ? Math.max(0, Math.min(24, rawActive)) : 12,
    maxSessionHours: Math.max(0.5, Math.min(12, Number(rawInput.maxSessionHours) || 4)),
    sellWood: Math.max(1, Number(rawInput.sellWood) || 64),
    sellClay: Math.max(1, Number(rawInput.sellClay) || 64),
    sellIron: Math.max(1, Number(rawInput.sellIron) || 64),
    maxOpeningHQ: Math.max(1, Math.min(20, Math.round(Number(rawInput.maxOpeningHQ) || 10)))
  };

  const scavMemo = new Map<string, OptimalScavAllocation>();
  const startCarryEq = Math.round(
    (input.startSpears * 25 +
      (input.startSwords || 0) * 15 +
      (input.startLights || 0) * 80 +
      (input.startPaladins || 0) * 100 +
      input.otherUnitsCarryCap) /
      25
  );
  // Generous unconstrained army ceiling (scaled by horizon & speed — never artificially tight!)
  const maxSpearsUpper = Math.min(
    4500,
    Math.max(400, Math.round(startCarryEq + input.horizonDays * 180 * input.worldSpeed))
  );

  // Pure Mines reference baseline (internal benchmark for unit tests & % improvement metric)
  const pureMinesGenome: StrategyGenome = {
    id: 'strat_pure_mines',
    key: 'pure_mines',
    name: 'مناجم فقط (مرجعي)',
    tagline: 'تطوير الحقول فقط بدون تدريب جيش أو إغارات',
    openingStyle: 'quest_harvest_first',
    maxScavTier: 0,
    maxSpearsCap: input.startSpears,
    usePaladin: false,
    useSwords: false,
    useLightCav: false,
    spearBias: 0,
    mineWeight: 1.0,
    woodShadowBoost: 1.0,
    spearCutoffRatio: 0,
    mineCutoffRatio: 0.96,
    maxHQ: 10,
    maxBarracks: 1,
    barracksAggression: 0,
    t3MinSpears: 9999,
    t4MinSpears: 9999,
    spearBatchSize: 10,
    onlineRunCapHrs: 0,
    useBarracksWallBundle: input.enableBarracksWallBundle
  };

  const pureMinesResult = simulateGenome(input, pureMinesGenome, scavMemo);
  const candidatePool: Array<{ genome: StrategyGenome; result: SmartStrategyResult }> = [
    { genome: pureMinesGenome, result: pureMinesResult }
  ];
  let evaluatedCount = 1;

  const evalAndRecord = (g: StrategyGenome) => {
    const res = simulateGenome(input, g, scavMemo);
    evaluatedCount += 1;
    candidatePool.push({ genome: g, result: res });
    return res;
  };

  if (input.activeHoursPerDay > 0) {
    // =========================================================================
    // STAGE 1: BROAD UNCONSTRAINED EXPLORATION (diverse archetypes & policies)
    // =========================================================================
    const openingStyles: OpeningStyle[] = [
      'instant_barracks_paladin',
      'instant_barracks',
      'quest_harvest_first'
    ];
    const tierOptions = [2, 3, 4].filter((tr) => tr >= input.startUnlockedScavTiers);
    const mineWeights = [0.25, 0.75, 1.35, 2.2];
    const barCaps = [1, 4, 10];
    const cutoffs = [0.82, 0.94, 1.0];

    let idx = 0;
    for (const openingStyle of openingStyles) {
      for (const maxScavTier of tierOptions) {
        for (const mineWeight of mineWeights) {
          const barCap = barCaps[idx % barCaps.length];
          const cutoff = cutoffs[Math.floor(idx / 2) % cutoffs.length];
          idx += 1;
          const usePal = openingStyle === 'instant_barracks_paladin' || idx % 2 === 0;
          const useSw = idx % 5 === 0;
          const useLc = input.horizonDays >= 7 && maxScavTier >= 3 && idx % 6 === 0;

          evalAndRecord({
            id: `exp_${idx}`,
            key: 'global_opt',
            name: 'الخطة المثلى الشاملة',
            tagline: '',
            openingStyle,
            maxScavTier,
            maxSpearsCap: maxSpearsUpper,
            usePaladin: usePal,
            useSwords: useSw,
            useLightCav: useLc,
            spearBias: mineWeight < 0.5 ? 1.85 : mineWeight < 1.0 ? 1.35 : 1.05,
            mineWeight,
            woodShadowBoost: mineWeight < 0.8 ? 2.0 : 1.45,
            spearCutoffRatio: cutoff,
            mineCutoffRatio: Math.min(1.0, cutoff + 0.03),
            maxHQ: useLc ? 12 : 10,
            maxBarracks: barCap,
            barracksAggression: mineWeight < 0.8 ? 1.8 : 1.1,
            t3MinSpears: maxScavTier >= 3 ? (mineWeight < 0.8 ? 28 : 42) : 999,
            t4MinSpears: maxScavTier >= 4 ? (input.horizonDays <= 6 ? 120 : 160) : 9999,
            spearBatchSize: 12,
            onlineRunCapHrs: 0,
            useBarracksWallBundle: true
          });
        }
      }
    }

    // Add dedicated extreme specialist probes (Pure Scav Rush + Hyper-Barracks T3/T4 + Balanced Speedrunners)
    const specialistSeeds: Array<Partial<StrategyGenome>> = [
      // Hyper-Barracks T3 Scav Rush (minimal mines, maximum barracks & spears!)
      {
        openingStyle: 'instant_barracks_paladin',
        maxScavTier: 3,
        usePaladin: true,
        mineWeight: 0.12,
        spearBias: 2.5,
        woodShadowBoost: 2.6,
        maxBarracks: 15,
        barracksAggression: 2.6,
        spearCutoffRatio: 0.96,
        mineCutoffRatio: 0.85,
        t3MinSpears: 22
      },
      // Hyper-Barracks T4 Rush (for 5-14d or high speed!)
      {
        openingStyle: 'instant_barracks_paladin',
        maxScavTier: 4,
        usePaladin: true,
        mineWeight: 0.15,
        spearBias: 2.5,
        woodShadowBoost: 2.4,
        maxBarracks: 16,
        barracksAggression: 2.5,
        spearCutoffRatio: 0.98,
        mineCutoffRatio: 0.88,
        t3MinSpears: 24,
        t4MinSpears: 105
      },
      // Balanced Barracks L8 + Wood-Heavy Mines + Paladin + T3
      {
        openingStyle: 'instant_barracks_paladin',
        maxScavTier: 3,
        usePaladin: true,
        mineWeight: 0.9,
        spearBias: 1.5,
        woodShadowBoost: 2.2,
        maxBarracks: 9,
        barracksAggression: 1.8,
        spearCutoffRatio: 0.92,
        mineCutoffRatio: 0.96,
        t3MinSpears: 30
      },
      // Balanced Barracks L10 + T4 + Paladin + Swords
      {
        openingStyle: 'instant_barracks_paladin',
        maxScavTier: 4,
        usePaladin: true,
        useSwords: true,
        mineWeight: 0.8,
        spearBias: 1.7,
        woodShadowBoost: 2.0,
        maxBarracks: 11,
        barracksAggression: 1.9,
        spearCutoffRatio: 0.95,
        mineCutoffRatio: 0.95,
        t3MinSpears: 30,
        t4MinSpears: 130
      },
      // Instant Barracks (Skip Statue/Paladin) + Pure Spear T3
      {
        openingStyle: 'instant_barracks',
        maxScavTier: 3,
        usePaladin: false,
        mineWeight: 0.35,
        spearBias: 2.0,
        woodShadowBoost: 2.2,
        maxBarracks: 12,
        barracksAggression: 2.2,
        spearCutoffRatio: 0.92,
        mineCutoffRatio: 0.92,
        t3MinSpears: 26
      },
      // Parallel Barracks + Stable Light Cavalry (for longer/faster worlds)
      {
        openingStyle: 'instant_barracks_paladin',
        maxScavTier: 4,
        usePaladin: true,
        useLightCav: true,
        mineWeight: 0.7,
        spearBias: 1.6,
        woodShadowBoost: 1.6,
        maxHQ: 14,
        maxBarracks: 12,
        barracksAggression: 1.8,
        spearCutoffRatio: 0.95,
        mineCutoffRatio: 0.95,
        t3MinSpears: 30,
        t4MinSpears: 140
      },
      // Conservative Early-Cutoff Cash-Out (short 1-3 day horizons!)
      {
        openingStyle: 'instant_barracks',
        maxScavTier: 2,
        usePaladin: false,
        mineWeight: 0.6,
        spearBias: 1.4,
        woodShadowBoost: 1.8,
        maxBarracks: 4,
        barracksAggression: 1.0,
        spearCutoffRatio: 0.72,
        mineCutoffRatio: 0.78,
        t3MinSpears: 999
      }
    ];

    specialistSeeds.forEach((patch, sIdx) => {
      evalAndRecord({
        ...pureMinesGenome,
        id: `spec_${sIdx}`,
        key: 'global_opt',
        name: 'الخطة المثلى الشاملة',
        maxSpearsCap: maxSpearsUpper,
        spearBatchSize: 12,
        onlineRunCapHrs: 0,
        ...patch
      });
    });

    // =========================================================================
    // STAGE 2: EVOLUTIONARY CROSSOVER & MUTATION ON TOP-6 GENOMES
    // =========================================================================
    candidatePool.sort((a, b) => b.result.score - a.result.score);
    const parents = candidatePool.slice(0, 6);
    for (let a = 0; a < Math.min(4, parents.length); a++) {
      for (let b = a + 1; b < Math.min(6, parents.length); b++) {
        const pa = parents[a].genome;
        const pb = parents[b].genome;
        evalAndRecord({
          ...pa,
          id: `cross_${a}_${b}`,
          key: 'global_opt',
          maxScavTier: (a + b) % 2 === 0 ? pa.maxScavTier : pb.maxScavTier,
          mineWeight: Number(((pa.mineWeight + pb.mineWeight) / 2).toFixed(2)),
          spearBias: Number(((pa.spearBias + pb.spearBias) / 2).toFixed(2)),
          woodShadowBoost: Number(((pa.woodShadowBoost + pb.woodShadowBoost) / 2).toFixed(2)),
          maxBarracks: Math.round((pa.maxBarracks + pb.maxBarracks) / 2),
          barracksAggression: Number(((pa.barracksAggression + pb.barracksAggression) / 2).toFixed(2)),
          spearCutoffRatio: Number(((pa.spearCutoffRatio + pb.spearCutoffRatio) / 2).toFixed(2)),
          mineCutoffRatio: Number(((pa.mineCutoffRatio + pb.mineCutoffRatio) / 2).toFixed(2)),
          usePaladin: pa.usePaladin || pb.usePaladin,
          t3MinSpears: Math.round((pa.t3MinSpears + pb.t3MinSpears) / 2),
          t4MinSpears: Math.round((pa.t4MinSpears + pb.t4MinSpears) / 2)
        });
      }
    }

    // =========================================================================
    // STAGE 3: COORDINATE HILL-CLIMBING ON TOP-2 DISTINCT CHAMPIONS
    // =========================================================================
    candidatePool.sort((a, b) => b.result.score - a.result.score);
    let bestGlobal = candidatePool[0];
    const climbSeeds = candidatePool.slice(0, 2);

    for (const seed of climbSeeds) {
      let cur = seed;
      const base = cur.genome;
      const tweaks: Array<Partial<StrategyGenome>> = [
        { usePaladin: !base.usePaladin },
        { openingStyle: base.openingStyle === 'instant_barracks_paladin' ? 'instant_barracks' : 'instant_barracks_paladin' },
        { openingStyle: 'quest_harvest_first' },
        { maxScavTier: Math.min(4, Math.max(input.startUnlockedScavTiers, base.maxScavTier + 1)) },
        { maxScavTier: Math.max(input.startUnlockedScavTiers, base.maxScavTier - 1) },
        { mineWeight: Math.max(0.05, Number((base.mineWeight * 0.55).toFixed(2))) },
        { mineWeight: Number((base.mineWeight * 1.45).toFixed(2)) },
        { spearBias: Math.max(0.5, Number((base.spearBias * 0.78).toFixed(2))) },
        { spearBias: Number((base.spearBias * 1.28).toFixed(2)) },
        { woodShadowBoost: Math.max(1.0, Number((base.woodShadowBoost - 0.5).toFixed(2))) },
        { woodShadowBoost: Math.min(3.5, Number((base.woodShadowBoost + 0.6).toFixed(2))) },
        { maxBarracks: Math.max(1, base.maxBarracks - 3) },
        { maxBarracks: Math.min(20, base.maxBarracks + 4) },
        { barracksAggression: Number((base.barracksAggression * 1.4).toFixed(2)) },
        { spearCutoffRatio: Math.max(0.6, Number((base.spearCutoffRatio - 0.08).toFixed(2))) },
        { spearCutoffRatio: Math.min(1.0, Number((base.spearCutoffRatio + 0.05).toFixed(2))) },
        { mineCutoffRatio: Math.max(0.65, Number((base.mineCutoffRatio - 0.08).toFixed(2))) },
        { mineCutoffRatio: Math.min(1.0, Number((base.mineCutoffRatio + 0.05).toFixed(2))) },
        { t3MinSpears: Math.max(15, base.t3MinSpears - 10) },
        { t4MinSpears: Math.max(80, base.t4MinSpears - 35) },
        { onlineRunCapHrs: base.onlineRunCapHrs === 0 ? 2.5 : 0 },
        { maxSpearsCap: Math.max(input.startSpears + 60, Math.round(cur.result.finalSpears * 0.85)) },
        { maxSpearsCap: Math.max(input.startSpears + 80, Math.round(cur.result.finalSpears * 1.25)) }
      ];

      for (const patch of tweaks) {
        const g: StrategyGenome = {
          ...cur.genome,
          ...patch,
          id: 'strat_global_opt',
          key: 'global_opt',
          name: 'الخطة المثلى الشاملة'
        };
        const res = evalAndRecord(g);
        if (res.score > cur.result.score + 0.01) {
          cur = { genome: g, result: res };
          if (res.score > bestGlobal.result.score + 0.01) {
            bestGlobal = cur;
          }
        }
      }
    }
  } else {
    // 0 active hours: refine Pure Mines HQ / mine cutoff parameters
    for (const hq of [3, 5, 8, 12, 16]) {
      for (const cut of [0.85, 0.92, 0.98]) {
        evalAndRecord({
          ...pureMinesGenome,
          id: `pm_hq${hq}_c${cut}`,
          key: 'global_opt',
          name: 'الخطة المثلى الشاملة',
          maxHQ: hq,
          mineCutoffRatio: cut
        });
      }
    }
  }

  candidatePool.sort((a, b) => b.result.score - a.result.score);
  const champion = candidatePool[0].result;

  const armyParts: string[] = [];
  if (champion.finalPaladins > 0) armyParts.push(`${champion.finalPaladins} قائد فرسان`);
  if (champion.finalSpears > 0) armyParts.push(`${champion.finalSpears} رمح`);
  if (champion.finalSwords > 0) armyParts.push(`${champion.finalSwords} سيف`);
  if (champion.finalLights > 0) armyParts.push(`${champion.finalLights} خفيف`);

  const globalOptResult: SmartStrategyResult = {
    ...champion,
    id: 'strat_global_opt',
    key: 'global_opt',
    name: 'الخطة المثلى الشاملة',
    tagline:
      champion.finalScavTiers > 0
        ? `أعلى خطة مكتشفة (${armyParts.join(' + ')} · إغارات T1–T${champion.finalScavTiers} · حقول ${champion.finalBuildings['الخشاب'] || 0}/${champion.finalBuildings['حفرة الطمي'] || 0}/${champion.finalBuildings['منجم الحديد'] || 0}) بعد محاكاة ${evaluatedCount} سيناريو`
        : `أعلى خطة مكتشفة (تطوير حقول ${champion.finalBuildings['الخشاب'] || 0}/${champion.finalBuildings['حفرة الطمي'] || 0}/${champion.finalBuildings['منجم الحديد'] || 0}) بعد محاكاة ${evaluatedCount} سيناريو`,
    isWinner: true
  };

  const strategies: SmartStrategyResult[] = [
    globalOptResult,
    { ...pureMinesResult, isWinner: false }
  ];

  const gainOverPureMinesPP = Number(
    (globalOptResult.totalNetPP - pureMinesResult.totalNetPP).toFixed(1)
  );
  const gainOverPureMinesPct =
    pureMinesResult.totalNetPP > 0
      ? Number(((gainOverPureMinesPP / pureMinesResult.totalNetPP) * 100).toFixed(1))
      : 0;

  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();

  return {
    input,
    winner: globalOptResult,
    strategies,
    gainOverPureMinesPP,
    gainOverPureMinesPct,
    evaluatedGenomesCount: evaluatedCount,
    computeMs: Math.max(1, Math.round(t1 - t0))
  };
}

/**
 * Converts the discovered optimal strategy into an AssignedPlan directly
 * compatible with `missionEngine.ts` and `assignVillagePlan(...)` in Firestore.
 */
export function buildAssignedPlanFromStrategy(
  strategy: SmartStrategyResult,
  input: SmartPlannerInput,
  nowMs: number = Date.now()
): AssignedPlan {
  const cleanSteps: AssignedPlanStep[] = strategy.steps.map((s, idx) => ({
    stepNum: idx + 1,
    atype: s.atype,
    bName: s.bName,
    baseName: s.baseName,
    targetLvl: s.targetLvl,
    lvl: s.targetLvl,
    tStart: s.tStart,
    tEnd: s.tEnd,
    cost: { w: s.cost.w, c: s.cost.c, i: s.cost.i },
    reason: s.reason
  }));

  const goalTag = input.goal === 'max_net_pp' ? 'صافي PP' : 'أعلى يومي';
  return {
    id: `smart_plan_${strategy.key}_${nowMs}`,
    name: `${strategy.name} (${input.horizonDays}ي · ${input.activeHoursPerDay}س · ${goalTag} · ~${Math.round(strategy.totalNetPP)} PP)`,
    isRealVillageBased: input.sourceMode === 'real',
    assignedAt: nowMs,
    steps: cleanSteps
  };
}
