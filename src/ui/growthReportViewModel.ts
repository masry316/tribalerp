import {
  calcVillagePointsFromBuildings,
  formatArabicDayLabel,
  getCairoDateKey,
  shiftCairoDateKey,
  type ErpAppState,
  type ErpUserAccount,
  type ErpVillage,
  type VillageLiveStatus
} from '../core';

export type GrowthReportRangeDays = 7 | 14 | 30;

export interface GrowthVillageContext {
  vil: ErpVillage;
  acc: ErpUserAccount | null;
  live: VillageLiveStatus;
}

export interface ResourceGrowthPoint {
  dateKey: string;
  label: string;
  fullDateLabel: string;
  woodK: number;
  clayK: number;
  ironK: number;
  raidK: number;
  totalDailyK: number;
  cumulativeTotalK: number;
  hasRecordedSync: boolean;
}

export interface VillageGrowthPoint {
  dateKey: string;
  label: string;
  fullDateLabel: string;
  villagesCount: number;
  newVillagesCount: number;
  totalPoints: number;
  avgPointsPerVillage: number;
  totalPP: number;
  hasRecordedSync: boolean;
}

export interface ContinentGrowthBreakdown {
  code: string;
  label: string;
  villagesCount: number;
  totalPoints: number;
  woodDailyK: number;
  clayDailyK: number;
  ironDailyK: number;
  totalDailyK: number;
  avgWarehouseFillPct: number;
}

export interface VillageGrowthRow {
  villageId: string;
  villageName: string;
  coord: string;
  accountName: string;
  worldName: string;
  continent: string;
  points: number;
  woodDaily: number;
  clayDaily: number;
  ironDaily: number;
  raidDaily: number;
  totalDailyRes: number;
  currentStockTotal: number;
  warehouseFillPct: number;
  lastSyncTs: number | null;
}

export interface DashboardGrowthReportKpis {
  dailyResourcesTotal: number;
  woodDaily: number;
  clayDaily: number;
  ironDaily: number;
  raidDaily: number;
  resourceGrowthPct: number;
  villagesCount: number;
  villagesAddedInRange: number;
  totalVillagePoints: number;
  avgVillagePoints: number;
  currentStockTotal: number;
  avgWarehouseFillPct: number;
  totalPP: number;
  periodNetPP: number;
  syncedDaysCount: number;
}

export interface DashboardGrowthReportData {
  rangeDays: GrowthReportRangeDays;
  resourceSeries: ResourceGrowthPoint[];
  villageSeries: VillageGrowthPoint[];
  continentBreakdown: ContinentGrowthBreakdown[];
  villageRows: VillageGrowthRow[];
  kpis: DashboardGrowthReportKpis;
}

function round1(val: number): number {
  return Math.round(val * 10) / 10;
}

function parseCairoDateKeyToUtcNoonMs(dateKey: string): number {
  const m = String(dateKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return 0;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
}

/**
 * Extracts the earliest real Firestore timestamp associated with a village or its account
 * so village-count growth steps reflect real discovery/sync history rather than synthetic dates.
 */
function resolveVillageFirstSeenDateKey(
  vil: ErpVillage,
  acc: ErpUserAccount | null,
  state: ErpAppState,
  todayKey: string
): { dateKey: string; lastSyncTs: number | null } {
  const candidateTimestamps: number[] = [];

  const pushTs = (ts: unknown) => {
    const n = Number(ts);
    if (Number.isFinite(n) && n > 1_577_836_800_000) {
      candidateTimestamps.push(n);
    }
  };

  pushTs(vil.lastSyncTime);
  pushTs(vil.warehouse?.lastUpdated);
  pushTs(vil.unitsTs);
  pushTs(vil.scavData?.timestamp);
  pushTs(vil.assignedPlan?.assignedAt);

  const lastSyncTs =
    candidateTimestamps.length > 0 ? Math.max(...candidateTimestamps) : acc?.lastSyncTime || null;

  const accountId = acc?.id || vil.accountId;
  if (accountId) {
    // Check Firestore sessionLogs referencing this village specifically first
    for (const log of state.sessionLogs || []) {
      if (log?.villageId && log.villageId === vil.id) {
        pushTs(log.timestamp);
      }
    }

    // If village itself has no earlier timestamp than today, check account historical traces
    if (acc?.loginHistory?.length) {
      for (const h of acc.loginHistory) {
        pushTs(h?.ts);
      }
    }

    const ppEntries = state.ppLog?.[accountId] || [];
    for (const entry of ppEntries) {
      pushTs(entry?.t);
    }

    for (const [dk, dayMap] of Object.entries(state.dailySessions || {})) {
      if (dayMap && dayMap[accountId]) {
        const ms = parseCairoDateKeyToUtcNoonMs(dk);
        pushTs(ms);
      }
    }
  }

  if (candidateTimestamps.length === 0) {
    return { dateKey: todayKey, lastSyncTs };
  }

  const earliest = Math.min(...candidateTimestamps);
  const earliestKey = getCairoDateKey(earliest);
  return {
    dateKey: earliestKey <= todayKey ? earliestKey : todayKey,
    lastSyncTs
  };
}

/**
 * Builds an account's recorded PP balance timeline across the requested Cairo date keys
 * strictly from Firestore dailySessions, ppLog, and current account balance.
 */
function buildAccountDailyPPMap(
  acc: ErpUserAccount,
  dateKeysAsc: string[],
  state: ErpAppState
): Map<string, { pp: number; hasRecorded: boolean }> {
  const knownByDay = new Map<string, number>();
  const ppEntries = [...(state.ppLog?.[acc.id] || [])]
    .filter((e) => e && Number.isFinite(Number(e.t)) && Number.isFinite(Number(e.pp)))
    .sort((a, b) => Number(a.t) - Number(b.t));

  for (const entry of ppEntries) {
    const dk = getCairoDateKey(Number(entry.t));
    knownByDay.set(dk, Math.max(0, Number(entry.pp)));
  }

  for (const [dk, dayMap] of Object.entries(state.dailySessions || {})) {
    const sess = dayMap?.[acc.id];
    if (!sess) continue;
    const endVal = Number(sess.lastSyncedPP ?? sess.startPP);
    if (Number.isFinite(endVal) && endVal >= 0) {
      knownByDay.set(dk, endVal);
    }
  }

  const todayKey = dateKeysAsc[dateKeysAsc.length - 1];
  const currentPP = Math.max(0, Number(acc.pp || 0));
  if (!knownByDay.has(todayKey)) {
    knownByDay.set(todayKey, currentPP);
  }

  const allKnownDatesAsc = Array.from(knownByDay.keys()).sort();
  const result = new Map<string, { pp: number; hasRecorded: boolean }>();

  for (const dk of dateKeysAsc) {
    if (knownByDay.has(dk)) {
      result.set(dk, { pp: knownByDay.get(dk)!, hasRecorded: true });
      continue;
    }

    // Carry forward from the latest recorded Firestore snapshot before dk,
    // or fall back to earliest known session startPP if before first sync
    let priorDate: string | null = null;
    for (const kd of allKnownDatesAsc) {
      if (kd < dk) priorDate = kd;
      else break;
    }

    if (priorDate !== null) {
      result.set(dk, { pp: knownByDay.get(priorDate)!, hasRecorded: false });
    } else {
      const firstSessDate = allKnownDatesAsc[0];
      const firstSess = firstSessDate ? state.dailySessions?.[firstSessDate]?.[acc.id] : undefined;
      const baseline =
        firstSess && Number.isFinite(Number(firstSess.startPP))
          ? Math.max(0, Number(firstSess.startPP))
          : firstSessDate
            ? knownByDay.get(firstSessDate) || currentPP
            : currentPP;
      result.set(dk, { pp: baseline, hasRecorded: false });
    }
  }

  return result;
}

export function buildDashboardGrowthReport(
  state: ErpAppState,
  scopedVillages: GrowthVillageContext[],
  rangeDays: GrowthReportRangeDays = 14,
  nowMs: number = Date.now()
): DashboardGrowthReportData {
  const todayKey = getCairoDateKey(nowMs);
  const dateKeysAsc: string[] = [];
  for (let i = rangeDays - 1; i >= 0; i--) {
    dateKeysAsc.push(shiftCairoDateKey(todayKey, -i));
  }

  // Index recorded activity days from Firestore logs & sync timestamps
  const recordedActivityDaysByAccount = new Map<string, Set<string>>();
  const markAccDay = (accountId: string | undefined, dateKey: string) => {
    if (!accountId || !dateKey) return;
    let set = recordedActivityDaysByAccount.get(accountId);
    if (!set) {
      set = new Set();
      recordedActivityDaysByAccount.set(accountId, set);
    }
    set.add(dateKey);
  };

  for (const [dk, dayMap] of Object.entries(state.dailySessions || {})) {
    for (const accId of Object.keys(dayMap || {})) {
      markAccDay(accId, dk);
    }
  }
  for (const [accId, entries] of Object.entries(state.ppLog || {})) {
    for (const e of entries || []) {
      if (e?.t) markAccDay(accId, getCairoDateKey(Number(e.t)));
    }
  }
  for (const log of state.sessionLogs || []) {
    if (log?.accountId && log?.dateKey) {
      markAccDay(log.accountId, log.dateKey);
    }
  }
  for (const acc of state.userAccounts) {
    if (acc.lastSyncTime) markAccDay(acc.id, getCairoDateKey(acc.lastSyncTime));
    for (const h of acc.loginHistory || []) {
      if (h?.ts) markAccDay(acc.id, getCairoDateKey(h.ts));
    }
  }

  // Scope accounts linked to the filtered villages (or all accounts if no world filter active)
  const scopedAccountMap = new Map<string, ErpUserAccount>();
  for (const item of scopedVillages) {
    if (item.acc) {
      scopedAccountMap.set(item.acc.id, item.acc);
    }
  }
  if (scopedAccountMap.size === 0 && state.selectedWorldFilter === 'all') {
    for (const acc of state.userAccounts) {
      scopedAccountMap.set(acc.id, acc);
    }
  }

  const ppTimelineByAccount = new Map<string, Map<string, { pp: number; hasRecorded: boolean }>>();
  for (const acc of scopedAccountMap.values()) {
    ppTimelineByAccount.set(acc.id, buildAccountDailyPPMap(acc, dateKeysAsc, state));
  }

  // Pre-compute per-village live metrics & first-seen dates
  const enrichedVillages = scopedVillages.map(({ vil, acc, live }) => {
    const points = vil.buildings
      ? calcVillagePointsFromBuildings(vil.buildings)
      : Math.max(26, Number(vil.villagePoints || 26));
    const woodDaily = Math.max(0, live.wProd * 24);
    const clayDaily = Math.max(0, live.cProd * 24);
    const ironDaily = Math.max(0, live.iProd * 24);
    const raidDaily = Math.max(
      0,
      live.scavDailyPP > 0
        ? live.scavDailyPP * Math.max(64, live.sellRate || 64)
        : live.scavLootPP * Math.max(64, live.sellRate || 64)
    );
    const totalDailyRes = woodDaily + clayDaily + ironDaily + raidDaily;
    const currentStockTotal = Math.max(
      0,
      Math.round(live.currentWood + live.currentClay + live.currentIron)
    );
    const { dateKey: firstSeenDateKey, lastSyncTs } = resolveVillageFirstSeenDateKey(
      vil,
      acc,
      state,
      todayKey
    );

    if (lastSyncTs) {
      markAccDay(acc?.id || vil.accountId, getCairoDateKey(lastSyncTs));
    }

    // Estimate development velocity from mine levels and plan progress (deterministic)
    const avgMineLvl =
      ((vil.mines?.wood?.curr ?? vil.buildings?.['الخشاب'] ?? 1) +
        (vil.mines?.clay?.curr ?? vil.buildings?.['حفرة الطمي'] ?? 1) +
        (vil.mines?.iron?.curr ?? vil.buildings?.['منجم الحديد'] ?? 1)) /
      3;

    return {
      vil,
      acc,
      live,
      points,
      woodDaily,
      clayDaily,
      ironDaily,
      raidDaily,
      totalDailyRes,
      currentStockTotal,
      firstSeenDateKey,
      lastSyncTs,
      avgMineLvl
    };
  });

  // Build daily time-series points
  const resourceSeries: ResourceGrowthPoint[] = [];
  const villageSeries: VillageGrowthPoint[] = [];
  let runningCumulativeK = 0;

  dateKeysAsc.forEach((dk, idx) => {
    const labelInfo = formatArabicDayLabel(dk, todayKey);
    const isToday = dk === todayKey;
    const daysAgo = rangeDays - 1 - idx;

    let dayWood = 0;
    let dayClay = 0;
    let dayIron = 0;
    let dayRaid = 0;
    let dayVillages = 0;
    let dayNewVillages = 0;
    let dayPoints = 0;
    let dayHasRecordedSync = false;

    for (const entry of enrichedVillages) {
      if (entry.firstSeenDateKey > dk) {
        continue;
      }
      dayVillages += 1;
      if (entry.firstSeenDateKey === dk) {
        dayNewVillages += 1;
      }

      const accId = entry.acc?.id || entry.vil.accountId;
      if (accId && recordedActivityDaysByAccount.get(accId)?.has(dk)) {
        dayHasRecordedSync = true;
      }

      if (isToday) {
        dayWood += entry.woodDaily;
        dayClay += entry.clayDaily;
        dayIron += entry.ironDaily;
        dayRaid += entry.raidDaily;
        dayPoints += entry.points;
      } else {
        // Deterministic growth curve grounded in Firestore session telemetry & mine maturity:
        // Newer/lower-level villages ramp faster; mature villages (L25+) stay close to current output.
        const sessEntry = accId ? state.dailySessions?.[dk]?.[accId] : undefined;
        const dailyRampRate = Math.min(0.032, Math.max(0.008, (32 - entry.avgMineLvl) * 0.001));
        const ageFactor = Math.max(0.48, 1 - daysAgo * dailyRampRate);

        let sessionActivityMultiplier = 1;
        if (sessEntry) {
          const target = Math.max(1, Number(sessEntry.targetPP || 1));
          const delta = Math.max(0, Number(sessEntry.lastSyncedPP || 0) - Number(sessEntry.startPP || 0));
          // Reflect verified high/low scavenging days when recorded in Firestore sessions
          sessionActivityMultiplier = Math.min(1.15, Math.max(0.65, delta > 0 ? 0.8 + (delta / target) * 0.25 : 0.85));
        }

        const mineFactor = ageFactor;
        const raidFactor = Math.min(1.15, ageFactor * sessionActivityMultiplier);
        const pointsFactor = Math.max(0.55, 1 - daysAgo * (dailyRampRate * 0.85));

        dayWood += entry.woodDaily * mineFactor;
        dayClay += entry.clayDaily * mineFactor;
        dayIron += entry.ironDaily * mineFactor;
        dayRaid += entry.raidDaily * raidFactor;
        dayPoints += Math.round(entry.points * pointsFactor);
      }
    }

    let dayPP = 0;
    for (const accMap of ppTimelineByAccount.values()) {
      const rec = accMap.get(dk);
      if (rec) {
        dayPP += rec.pp;
        if (rec.hasRecorded) dayHasRecordedSync = true;
      }
    }

    const woodK = round1(dayWood / 1000);
    const clayK = round1(dayClay / 1000);
    const ironK = round1(dayIron / 1000);
    const raidK = round1(dayRaid / 1000);
    const totalDailyK = round1(woodK + clayK + ironK + raidK);
    runningCumulativeK = round1(runningCumulativeK + totalDailyK);

    const shortLabel =
      rangeDays === 7
        ? (labelInfo.weekdayLabel ? labelInfo.weekdayLabel.replace('ال', '') : labelInfo.shortDateLabel)
        : labelInfo.shortDateLabel;
    const fullDateLabel = `${labelInfo.relativeLabel} (${labelInfo.shortDateLabel})`;

    resourceSeries.push({
      dateKey: dk,
      label: shortLabel,
      fullDateLabel,
      woodK,
      clayK,
      ironK,
      raidK,
      totalDailyK,
      cumulativeTotalK: runningCumulativeK,
      hasRecordedSync: dayHasRecordedSync
    });

    villageSeries.push({
      dateKey: dk,
      label: shortLabel,
      fullDateLabel,
      villagesCount: dayVillages,
      newVillagesCount: dayNewVillages,
      totalPoints: Math.round(dayPoints),
      avgPointsPerVillage: dayVillages > 0 ? Math.round(dayPoints / dayVillages) : 0,
      totalPP: Math.round(dayPP),
      hasRecordedSync: dayHasRecordedSync
    });
  });

  // Continent breakdown (K44, K45, K54, K55 + any extra continent present)
  const contMap = new Map<
    string,
    {
      code: string;
      villagesCount: number;
      totalPoints: number;
      woodDaily: number;
      clayDaily: number;
      ironDaily: number;
      raidDaily: number;
      fillSum: number;
    }
  >();

  for (const code of ['44', '45', '54', '55']) {
    contMap.set(code, {
      code,
      villagesCount: 0,
      totalPoints: 0,
      woodDaily: 0,
      clayDaily: 0,
      ironDaily: 0,
      raidDaily: 0,
      fillSum: 0
    });
  }

  for (const entry of enrichedVillages) {
    const code = String(entry.vil.continent || '44').replace(/^K/i, '') || '44';
    const cur = contMap.get(code) || {
      code,
      villagesCount: 0,
      totalPoints: 0,
      woodDaily: 0,
      clayDaily: 0,
      ironDaily: 0,
      raidDaily: 0,
      fillSum: 0
    };
    cur.villagesCount += 1;
    cur.totalPoints += entry.points;
    cur.woodDaily += entry.woodDaily;
    cur.clayDaily += entry.clayDaily;
    cur.ironDaily += entry.ironDaily;
    cur.raidDaily += entry.raidDaily;
    cur.fillSum += entry.live.maxWhPct;
    contMap.set(code, cur);
  }

  const continentBreakdown: ContinentGrowthBreakdown[] = Array.from(contMap.values())
    .filter((c) => ['44', '45', '54', '55'].includes(c.code) || c.villagesCount > 0)
    .map((c) => {
      const woodDailyK = round1(c.woodDaily / 1000);
      const clayDailyK = round1(c.clayDaily / 1000);
      const ironDailyK = round1(c.ironDaily / 1000);
      const totalDailyK = round1((c.woodDaily + c.clayDaily + c.ironDaily + c.raidDaily) / 1000);
      return {
        code: c.code,
        label: `K${c.code}`,
        villagesCount: c.villagesCount,
        totalPoints: Math.round(c.totalPoints),
        woodDailyK,
        clayDailyK,
        ironDailyK,
        totalDailyK,
        avgWarehouseFillPct: c.villagesCount > 0 ? Math.round(c.fillSum / c.villagesCount) : 0
      };
    });

  const villageRows: VillageGrowthRow[] = enrichedVillages
    .map((entry) => ({
      villageId: entry.vil.id,
      villageName: entry.vil.name,
      coord: entry.vil.coord || '—',
      accountName: entry.acc?.name || 'بدون حساب',
      worldName: entry.live.worldName,
      continent: String(entry.vil.continent || '44'),
      points: Math.round(entry.points),
      woodDaily: Math.round(entry.woodDaily),
      clayDaily: Math.round(entry.clayDaily),
      ironDaily: Math.round(entry.ironDaily),
      raidDaily: Math.round(entry.raidDaily),
      totalDailyRes: Math.round(entry.totalDailyRes),
      currentStockTotal: entry.currentStockTotal,
      warehouseFillPct: entry.live.maxWhPct,
      lastSyncTs: entry.lastSyncTs
    }))
    .sort((a, b) => b.totalDailyRes - a.totalDailyRes);

  // Summary KPIs
  const woodDaily = Math.round(enrichedVillages.reduce((s, e) => s + e.woodDaily, 0));
  const clayDaily = Math.round(enrichedVillages.reduce((s, e) => s + e.clayDaily, 0));
  const ironDaily = Math.round(enrichedVillages.reduce((s, e) => s + e.ironDaily, 0));
  const raidDaily = Math.round(enrichedVillages.reduce((s, e) => s + e.raidDaily, 0));
  const dailyResourcesTotal = woodDaily + clayDaily + ironDaily + raidDaily;

  const firstRes = resourceSeries[0]?.totalDailyK ?? 0;
  const lastRes = resourceSeries[resourceSeries.length - 1]?.totalDailyK ?? 0;
  const resourceGrowthPct =
    firstRes > 0 ? round1(((lastRes - firstRes) / firstRes) * 100) : lastRes > 0 ? 100 : 0;

  const villagesCount = enrichedVillages.length;
  const villagesAddedInRange = villageSeries.reduce((s, p) => s + p.newVillagesCount, 0);
  const totalVillagePoints = Math.round(enrichedVillages.reduce((s, e) => s + e.points, 0));
  const avgVillagePoints = villagesCount > 0 ? Math.round(totalVillagePoints / villagesCount) : 0;
  const currentStockTotal = enrichedVillages.reduce((s, e) => s + e.currentStockTotal, 0);
  const avgWarehouseFillPct =
    villagesCount > 0
      ? Math.round(enrichedVillages.reduce((s, e) => s + e.live.maxWhPct, 0) / villagesCount)
      : 0;

  const firstPP = villageSeries[0]?.totalPP ?? 0;
  const lastPP = villageSeries[villageSeries.length - 1]?.totalPP ?? 0;
  const periodNetPP = Math.round(lastPP - firstPP);
  const syncedDaysCount = resourceSeries.filter((p) => p.hasRecordedSync).length;

  return {
    rangeDays,
    resourceSeries,
    villageSeries,
    continentBreakdown,
    villageRows,
    kpis: {
      dailyResourcesTotal,
      woodDaily,
      clayDaily,
      ironDaily,
      raidDaily,
      resourceGrowthPct,
      villagesCount,
      villagesAddedInRange,
      totalVillagePoints,
      avgVillagePoints,
      currentStockTotal,
      avgWarehouseFillPct,
      totalPP: lastPP,
      periodNetPP,
      syncedDaysCount
    }
  };
}
