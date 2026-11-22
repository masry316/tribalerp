import type { ScavAllocItem, ScavDispatchResult } from '../types';

/**
 * Official Tribal Wars scavenging duration_factor = world_speed^(-0.55).
 * Verified against live server ScavengeScreen configs (e.g. 1x -> 1.0, 2x -> 0.6830201284).
 * Unit speed (both global unit_speed and individual troop speed) does NOT affect scavenging.
 */
export function getScavDurationFactor(worldSpeed: number): number {
  const ws = Math.max(0.1, Number(worldSpeed) || 1.0);
  return Math.pow(ws, -0.55);
}

export function getScavDurationSec(
  cap: number,
  lootFactor: number,
  worldSpeed: number,
  _unitSpeed: number = 1.0
): number {
  if (cap <= 0) return 0;
  const df = getScavDurationFactor(worldSpeed);
  const inner = Math.pow(cap * lootFactor, 2) * 100.0;
  return Math.round((Math.pow(inner, 0.45) + 1800.0) * df);
}

export function getMaxCapForDuration(
  maxSec: number,
  lootFactor: number,
  worldSpeed: number,
  _unitSpeed: number = 1.0
): number {
  const df = getScavDurationFactor(worldSpeed);
  const target = maxSec / df - 1800.0;
  if (target <= 0) return 0;
  const val = Math.pow(target, 1.0 / 0.45) / 100.0;
  return Math.floor(Math.sqrt(val) / lootFactor);
}

const SCAV_TIERS_CFG = [
  { tier: 4, lf: 0.75, name: 'الإغارة 4 — العظام (75%)' },
  { tier: 3, lf: 0.5, name: 'الإغارة 3 — الأذكياء (50%)' },
  { tier: 2, lf: 0.25, name: 'الإغارة 2 — المتواضعون (25%)' },
  { tier: 1, lf: 0.1, name: 'الإغارة 1 — الكسالى (10%)' }
] as const;

interface UnitPool {
  kn: number;
  lc: number;
  ma: number;
  hc: number;
  sp: number;
  sw: number;
  ax: number;
  ar: number;
}

function packUnitsUpToCap(rem: UnitPool, capLim: number) {
  let curTierCap = 0;

  const useKn = Math.min(rem.kn, Math.floor((capLim - curTierCap) / 100));
  curTierCap += useKn * 100;
  rem.kn -= useKn;

  const useLc = Math.min(rem.lc, Math.floor((capLim - curTierCap) / 80));
  curTierCap += useLc * 80;
  rem.lc -= useLc;

  const useMa = Math.min(rem.ma, Math.floor((capLim - curTierCap) / 50));
  curTierCap += useMa * 50;
  rem.ma -= useMa;

  const useHc = Math.min(rem.hc, Math.floor((capLim - curTierCap) / 50));
  curTierCap += useHc * 50;
  rem.hc -= useHc;

  const useSp = Math.min(rem.sp, Math.floor((capLim - curTierCap) / 25));
  curTierCap += useSp * 25;
  rem.sp -= useSp;

  const useSw = Math.min(rem.sw, Math.floor((capLim - curTierCap) / 15));
  curTierCap += useSw * 15;
  rem.sw -= useSw;

  const useAx = Math.min(rem.ax, Math.floor((capLim - curTierCap) / 10));
  curTierCap += useAx * 10;
  rem.ax -= useAx;

  const useAr = Math.min(rem.ar, Math.floor((capLim - curTierCap) / 10));
  curTierCap += useAr * 10;
  rem.ar -= useAr;

  return {
    curTierCap,
    kn: useKn,
    lc: useLc,
    ma: useMa,
    hc: useHc,
    sp: useSp,
    sw: useSw,
    ax: useAx,
    ar: useAr
  };
}

function buildPlanForTargetCycleSec(
  pool: UnitPool,
  totalCap: number,
  unlockedTiers: number,
  targetCycleSec: number,
  worldSpeed: number,
  unitSpeed: number,
  preferEqualRatioOnSmallCap: boolean
): { allocs: ScavAllocItem[]; lootPerRun: number; maxRunSec: number } {
  const activeTiers = SCAV_TIERS_CFG.filter((t) => t.tier <= unlockedTiers);
  const tierCapTargets: Record<number, number> = {};

  if (preferEqualRatioOnSmallCap && activeTiers.length > 0) {
    // Inverse loot factor (1 / lf) keeps all active slots returning at the same second.
    const invSum = activeTiers.reduce((s, t) => s + 1 / t.lf, 0);
    for (const tc of activeTiers) {
      const equalShare = Math.round((totalCap * (1 / tc.lf)) / invSum);
      const durCap = getMaxCapForDuration(targetCycleSec, tc.lf, worldSpeed, unitSpeed);
      tierCapTargets[tc.tier] = Math.min(equalShare, durCap);
    }
  } else {
    // Under any cycle duration limit T, greedy packing T4 -> T3 -> T2 -> T1 up to X(T)/lf
    // is the exact mathematical optimum for loot per cycle.
    let unallocatedCap = totalCap;
    for (const tc of activeTiers) {
      const durCap = getMaxCapForDuration(targetCycleSec, tc.lf, worldSpeed, unitSpeed);
      const take = Math.min(unallocatedCap, durCap);
      tierCapTargets[tc.tier] = take;
      unallocatedCap = Math.max(0, unallocatedCap - take);
    }
  }

  const rem: UnitPool = { ...pool };
  const allocs: ScavAllocItem[] = [];
  let maxRunSec = 0;
  let lootPerRun = 0;

  for (const tc of activeTiers) {
    const capLim = Math.max(0, tierCapTargets[tc.tier] || 0);
    const packed = packUnitsUpToCap(rem, capLim);
    const useCap = packed.curTierCap;
    const durSec = getScavDurationSec(useCap, tc.lf, worldSpeed, unitSpeed);
    const loot = Math.round(useCap * tc.lf);
    maxRunSec = Math.max(maxRunSec, durSec);
    lootPerRun += loot;

    allocs.push({
      ...tc,
      cap: useCap,
      sp: packed.sp,
      sw: packed.sw,
      ax: packed.ax,
      ar: packed.ar,
      spy: 0,
      lc: packed.lc,
      ma: packed.ma,
      hc: packed.hc,
      kn: packed.kn,
      loot,
      durSec
    });
  }

  return { allocs, lootPerRun, maxRunSec };
}

export interface ScavSlotPlanItem {
  tier: 1 | 2 | 3 | 4;
  lf: number;
  name: string;
  cap: number;
  sp: number;
  sw: number;
  ax: number;
  ar: number;
  lc: number;
  ma: number;
  hc: number;
  kn: number;
  loot: number;
  durSec: number;
}

/**
 * Plans exact per-slot scavenging dispatches for a subset of currently FREE tiers (1..4)
 * using only the currently HOME units, respecting targetCycleSec and stretching symmetrically
 * if home troops exceed the capacity of the free tiers at targetCycleSec.
 */
export function planScavSlotAllocations(
  homeUnits: {
    sp: number;
    sw: number;
    kn: number;
    ax?: number;
    ar?: number;
    lc?: number;
    ma?: number;
    hc?: number;
  },
  freeTiers: ReadonlyArray<1 | 2 | 3 | 4>,
  targetCycleSec: number,
  worldSpeed: number
): ScavSlotPlanItem[] {
  if (freeTiers.length === 0) return [];
  const pool: UnitPool = {
    kn: Math.max(0, Math.floor(homeUnits.kn || 0)),
    lc: Math.max(0, Math.floor(homeUnits.lc || 0)),
    ma: Math.max(0, Math.floor(homeUnits.ma || 0)),
    hc: Math.max(0, Math.floor(homeUnits.hc || 0)),
    sp: Math.max(0, Math.floor(homeUnits.sp || 0)),
    sw: Math.max(0, Math.floor(homeUnits.sw || 0)),
    ax: Math.max(0, Math.floor(homeUnits.ax || 0)),
    ar: Math.max(0, Math.floor(homeUnits.ar || 0))
  };
  const totalCap =
    pool.kn * 100 +
    pool.lc * 80 +
    pool.ma * 50 +
    pool.hc * 50 +
    pool.sp * 25 +
    pool.sw * 15 +
    pool.ax * 10 +
    pool.ar * 10;
  if (totalCap <= 0) return [];

  const ws = Math.max(0.1, Number(worldSpeed) || 1.0);
  const df = getScavDurationFactor(ws);
  const minBaseSec = Math.round(1800 * df) + 120;
  const freeSet = new Set<number>(freeTiers);
  const activeTiers = SCAV_TIERS_CFG.filter((t) => freeSet.has(t.tier));
  if (activeTiers.length === 0) return [];

  let effTargetSec = Math.max(minBaseSec, Math.round(targetCycleSec));
  const maxFitAtTarget = activeTiers.reduce(
    (sum, tc) => sum + getMaxCapForDuration(effTargetSec, tc.lf, ws, 1),
    0
  );
  if (totalCap > maxFitAtTarget) {
    let lo = effTargetSec;
    let hi = Math.max(effTargetSec * 2, 86400);
    for (let step = 0; step < 20; step++) {
      const mid = Math.round((lo + hi) / 2);
      const fit = activeTiers.reduce(
        (sum, tc) => sum + getMaxCapForDuration(mid, tc.lf, ws, 1),
        0
      );
      if (fit >= totalCap) hi = mid;
      else lo = mid + 1;
    }
    effTargetSec = hi;
  }

  let unallocatedCap = totalCap;
  const rem: UnitPool = { ...pool };
  const results: ScavSlotPlanItem[] = [];

  for (const tc of activeTiers) {
    const durCap = getMaxCapForDuration(effTargetSec, tc.lf, ws, 1);
    const take = Math.min(unallocatedCap, durCap);
    unallocatedCap = Math.max(0, unallocatedCap - take);
    if (take <= 0) continue;

    const packed = packUnitsUpToCap(rem, take);
    if (packed.curTierCap <= 0) continue;
    const durSec = getScavDurationSec(packed.curTierCap, tc.lf, ws, 1);
    const loot = Math.round(packed.curTierCap * tc.lf);
    if (loot <= 0 || durSec <= 0) continue;

    results.push({
      tier: tc.tier,
      lf: tc.lf,
      name: tc.name,
      cap: packed.curTierCap,
      sp: packed.sp,
      sw: packed.sw,
      ax: packed.ax,
      ar: packed.ar,
      lc: packed.lc,
      ma: packed.ma,
      hc: packed.hc,
      kn: packed.kn,
      loot,
      durSec
    });
  }

  return results;
}

export function calcScavDispatch(
  spearsTotal: number,
  swordsTotal: number,
  unlockedTiers: number,
  maxSessionHrs: number,
  activeHrs: number,
  worldSpeed: number,
  scavMode: 'max_profit' | 'min_logins' = 'max_profit',
  unitSpeed: number = 1.0,
  axesTotal: number = 0,
  spiesTotal: number = 0,
  lightsTotal: number = 0,
  heaviesTotal: number = 0,
  archersTotal: number = 0,
  marchersTotal: number = 0,
  knightsTotal: number = 0,
  minProfitCycleHrs: number = 2
): ScavDispatchResult {
  const sp = Math.max(0, Math.round(spearsTotal));
  const sw = Math.max(0, Math.round(swordsTotal));
  const ax = Math.max(0, Math.round(axesTotal));
  const ar = Math.max(0, Math.round(archersTotal));
  const spy = Math.max(0, Math.round(spiesTotal));
  const lc = Math.max(0, Math.round(lightsTotal));
  const ma = Math.max(0, Math.round(marchersTotal));
  const hc = Math.max(0, Math.round(heaviesTotal));
  const kn = Math.max(0, Math.round(knightsTotal));

  // Official Tribal Wars carry capacities:
  // Knight: 100, Light: 80, Marcher: 50, Heavy: 50, Spear: 25, Sword: 15, Axe: 10, Archer: 10
  const totalCap =
    kn * 100 + lc * 80 + ma * 50 + hc * 50 + sp * 25 + sw * 15 + ax * 10 + ar * 10;

  if (unlockedTiers <= 0 || totalCap <= 0 || activeHrs <= 0) {
    return {
      totalCap,
      spearsTotal: sp,
      swordsTotal: sw,
      axesTotal: ax,
      archersTotal: ar,
      spiesTotal: spy,
      lightsTotal: lc,
      marchersTotal: ma,
      heaviesTotal: hc,
      knightsTotal: kn,
      unlockedTiers,
      lootPerRun: 0,
      wLoot: 0,
      cLoot: 0,
      iLoot: 0,
      maxRunSec: 0,
      effCycleSec: 0,
      avgIntervalSec: 86400,
      runsPerDay: 0,
      dailyLoot: 0,
      effHourly: 0,
      eachHr: 0,
      allocs: []
    };
  }

  const ws = Math.max(0.1, Number(worldSpeed) || 1.0);
  const us = Math.max(0.1, Number(unitSpeed) || 1.0);
  const df = getScavDurationFactor(ws);
  const minBaseSec = Math.round(1800 * df) + 120;
  const userMaxSec = Math.max(minBaseSec, Math.round(Math.max(0.5, maxSessionHrs) * 3600));
  const profitFloorSec = Math.max(
    minBaseSec,
    Math.round(Math.max(0.5, Number(minProfitCycleHrs) || 2) * 3600)
  );
  const actH = Math.min(24.0, Math.max(0.0, Number(activeHrs) || 0));

  const pool: UnitPool = { kn, lc, ma, hc, sp, sw, ax, ar };

  // Mode 1 (max_profit): User-configurable minimum cycle floor (default 2h = 7,200s) with greedy T4 -> T3 -> T2 -> T1 packing.
  // Mode 2 (min_logins): Exact user-configured cycle duration (maxSessionHrs) with greedy T4 -> T3 -> T2 -> T1 packing.
  const targetCycleSec = scavMode === 'max_profit' ? profitFloorSec : userMaxSec;

  // Compute max carry capacity that fits across all unlocked tiers within targetCycleSec.
  // If totalCap exceeds it (very large army), smoothly stretch targetCycleSec so NO troops sit idle at home.
  const activeTiers = SCAV_TIERS_CFG.filter((t) => t.tier <= unlockedTiers);
  const maxFitCapAtTarget = activeTiers.reduce(
    (sum, tc) => sum + getMaxCapForDuration(targetCycleSec, tc.lf, ws, us),
    0
  );

  let effTargetCycleSec = targetCycleSec;
  if (totalCap > maxFitCapAtTarget && activeTiers.length > 0) {
    let lo = targetCycleSec;
    let hi = Math.max(targetCycleSec * 2, 86400);
    for (let step = 0; step < 22; step++) {
      const mid = Math.round((lo + hi) / 2);
      const fit = activeTiers.reduce(
        (sum, tc) => sum + getMaxCapForDuration(mid, tc.lf, ws, us),
        0
      );
      if (fit >= totalCap) {
        hi = mid;
      } else {
        lo = mid + 1;
      }
    }
    effTargetCycleSec = hi;
  }

  let bestPlan = buildPlanForTargetCycleSec(
    pool,
    totalCap,
    unlockedTiers,
    effTargetCycleSec,
    ws,
    us,
    false
  );

  // Fallback for ultra-tiny carry capacities so the highest unlocked tier still packs cleanly
  if (bestPlan.lootPerRun === 0) {
    bestPlan = buildPlanForTargetCycleSec(
      pool,
      totalCap,
      unlockedTiers,
      Math.max(effTargetCycleSec, minBaseSec + 1800),
      ws,
      us,
      false
    );
  }

  const { allocs, lootPerRun, maxRunSec } = bestPlan;

  // Smooth, physically accurate expected daily runs (eliminates artificial Math.floor cliffs!).
  // During `actH` active hours, you dispatch at t=0 and continuously every `maxRunSec`,
  // with the final dispatch sent before sleep still returning while offline:
  // expectedRuns = min(86400 / maxRunSec, (actH * 3600) / maxRunSec + 1).
  const maxRuns24 = maxRunSec > 0 ? 86400 / maxRunSec : 0;
  const expectedRunsPerDay =
    maxRunSec > 0 && actH > 0
      ? actH >= 24
        ? maxRuns24
        : Math.min(maxRuns24, (actH * 3600) / maxRunSec + 1)
      : 0;

  const dailyLoot = Math.round(lootPerRun * expectedRunsPerDay);
  const runsPerDay =
    expectedRunsPerDay > 0 ? Math.max(1, Math.round(expectedRunsPerDay)) : 0;
  const effCycleSec = maxRunSec;
  const avgIntervalSec =
    expectedRunsPerDay > 0 ? Math.round(86400 / expectedRunsPerDay) : 86400;
  const effHourly = dailyLoot / 24.0;
  const wLoot = Math.floor(lootPerRun / 3);
  const cLoot = Math.floor(lootPerRun / 3);
  const iLoot = lootPerRun - wLoot - cLoot;

  return {
    totalCap,
    spearsTotal: sp,
    swordsTotal: sw,
    axesTotal: ax,
    archersTotal: ar,
    spiesTotal: spy,
    lightsTotal: lc,
    marchersTotal: ma,
    heaviesTotal: hc,
    knightsTotal: kn,
    unlockedTiers,
    lootPerRun,
    wLoot,
    cLoot,
    iLoot,
    maxRunSec,
    effCycleSec,
    avgIntervalSec,
    runsPerDay,
    dailyLoot,
    effHourly,
    eachHr: effHourly / 3.0,
    allocs
  };
}
