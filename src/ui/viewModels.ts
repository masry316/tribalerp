import {
  auditAccountsSecurity,
  buildAccountPPFlow,
  calcVillagePointsFromBuildings,
  computeMissionBriefingForVillage,
  computeVillageLiveResourcesAndArmy,
  computeVillageLiveStatus,
  formatArabicDayLabel,
  formatCurrencyPP,
  formatHoursArabic,
  formatTimeAgo,
  getCairoDateKey,
  getAccountTargetDailyPP,
  SCAV_UNIT_DEFS,
  shiftCairoDateKey,
  type ErpAppState,
  type ErpUserAccount,
  type ErpVillage,
  type UnitKey,
  type VillageLiveStatus,
  type VillageRole
} from '../core';

export interface ProfitReportRow {
  accountId: string;
  accountName: string;
  acc: ErpUserAccount;
  ip: string;
  vilsCount: number;
  plannedCount: number;
  unplannedCount: number;
  worldIds: string[];
  continents: string[];
  villageNames: string[];
  startPP: number;
  curPP: number;
  realized: number;
  realizedMoney: string;
  unsoldPP: number;
  effectivePP: number;
  targetPP: number;
  achievementPct: number;
  idleScavCount: number;
  whRiskCount: number;
  hasIpIssue: boolean;
}

export interface EfficiencyReportRow {
  villageId: string;
  vil: ErpVillage;
  accName: string;
  worldName: string;
  worldId: string;
  continent: string;
  points: number;
  totalHourly: number;
  dailyPP: number;
  dailyMoney: string;
  maxWhPct: number;
  minHoursLeft: number;
  haulCap: number;
  scavIdle: boolean;
  whRisk: boolean;
  hasPlan: boolean;
  advice: string;
}

export interface DashboardAlertItem {
  id: string;
  severity: 'critical' | 'warning';
  category: 'warehouse' | 'scav' | 'security';
  message: string;
  linkPath: string;
  linkLabel: string;
}

export function buildProfitReportRows(
  state: ErpAppState,
  nowMs: number = Date.now()
): ProfitReportRow[] {
  const collisions = auditAccountsSecurity(state);
  const colIds = new Set<string>();
  collisions.forEach((g) => g.accountIds.forEach((id) => colIds.add(id)));

  const todayKey = getCairoDateKey(nowMs);

  return state.userAccounts.map((acc) => {
    const vils = state.villages.filter((v) => v.accountId === acc.id);
    const liveStatuses = vils.map((v) => ({ v, live: computeVillageLiveStatus(v, state, nowMs) }));

    const unsoldPP = liveStatuses.reduce((sum, item) => sum + item.live.unsoldPP, 0);
    const scavLootPP = liveStatuses.reduce((sum, item) => sum + item.live.scavLootPP, 0);
    const targetDailyPP = getAccountTargetDailyPP(acc.id, state);

    const flow = buildAccountPPFlow({
      account: acc,
      villagesCount: vils.length,
      dailySessions: state.dailySessions,
      ppLog: state.ppLog,
      targetDailyPP,
      unsoldPP,
      scavLootPP,
      finance: state.finance,
      daysCount: 7,
      nowMs
    });

    const todayEntry = flow.today;
    const sess = state.dailySessions?.[todayKey]?.[acc.id];
    const startPP = Number(todayEntry?.startPP ?? sess?.startPP ?? acc.pp ?? 0);
    const curPP = Number(acc.pp || 0);
    const realized = Math.round((todayEntry?.netPP ?? curPP - startPP) * 10) / 10;
    const targetPP = Math.max(0, Math.round((todayEntry?.targetPP ?? targetDailyPP) * 10) / 10);
    const achievementPct = todayEntry?.achievementPct ?? (targetPP > 0 ? Math.round((Math.max(0, realized) / targetPP) * 100) : 0);

    const idleScavCount = liveStatuses.filter(
      (i) => i.live.scavState === 'idle_troops' || i.live.scavState === 'returned'
    ).length;
    const whRiskCount = liveStatuses.filter((i) => i.live.status !== 'safe').length;
    const plannedCount = vils.filter((v) => Boolean(v.assignedPlan)).length;
    const ipMissing = !(acc.ip || '').trim();

    return {
      accountId: acc.id,
      accountName: acc.name,
      acc,
      ip: String(acc.ip || ''),
      vilsCount: vils.length,
      plannedCount,
      unplannedCount: Math.max(0, vils.length - plannedCount),
      worldIds: [...new Set(vils.map((v) => v.worldId))],
      continents: [...new Set(vils.map((v) => v.continent))],
      villageNames: vils.map((v) => v.name),
      startPP,
      curPP,
      realized,
      realizedMoney: formatCurrencyPP(realized, state),
      unsoldPP: Math.round(unsoldPP * 10) / 10,
      effectivePP: Math.round((todayEntry?.effectivePP ?? realized + unsoldPP) * 10) / 10,
      targetPP,
      achievementPct,
      idleScavCount,
      whRiskCount,
      hasIpIssue: colIds.has(acc.id) || ipMissing
    };
  });
}

export function buildEfficiencyReportRows(
  state: ErpAppState,
  nowMs: number = Date.now()
): EfficiencyReportRow[] {
  return state.villages.map((vil) => {
    const acc = state.userAccounts.find((a) => a.id === vil.accountId);
    const live = computeVillageLiveStatus(vil, state, nowMs);
    const briefing = computeMissionBriefingForVillage(vil, state, live);
    const points = vil.buildings
      ? calcVillagePointsFromBuildings(vil.buildings)
      : Number(vil.villagePoints || 26);

    const scavIdle = live.scavState === 'idle_troops' || live.scavState === 'returned';
    const whRisk = live.status !== 'safe';
    let advice = 'مستقرة';
    if (whRisk) advice = `تحذير مخزن (${live.maxWhPct}%)`;
    else if (scavIdle) advice = 'إرسال إغارة فوراً';
    else if (briefing.shouldSellMarket) advice = briefing.marketSummary;
    else if (briefing.readyStepsNow.length > 0) advice = `تنفيذ: ${briefing.readyStepsNow[0].bName}`;

    return {
      villageId: vil.id,
      vil,
      accName: acc?.name || 'غير محدد',
      worldName: live.worldName,
      worldId: vil.worldId,
      continent: vil.continent,
      points,
      totalHourly: Math.round(live.totalHourly),
      dailyPP: Math.round(live.dailyPP * 10) / 10,
      dailyMoney: formatCurrencyPP(live.dailyPP, state),
      maxWhPct: live.maxWhPct,
      minHoursLeft: live.minHoursLeft,
      haulCap: live.haulTotal,
      scavIdle,
      whRisk,
      hasPlan: Boolean(vil.assignedPlan),
      advice
    };
  });
}

export function buildDashboardAlerts(
  state: ErpAppState,
  nowMs: number = Date.now()
): DashboardAlertItem[] {
  const alerts: DashboardAlertItem[] = [];

  for (const vil of state.villages) {
    const live = computeVillageLiveStatus(vil, state, nowMs);
    if (live.status === 'critical' && live.maxWhPct >= 90) {
      alerts.push({
        id: `wh_crit_${vil.id}`,
        severity: 'critical',
        category: 'warehouse',
        message: `القرية (${vil.name}) مخزن ${live.firstFullRes} وصل إلى ${live.maxWhPct}% (يمتلئ خلال ${live.minHoursLeft.toFixed(1)} ساعة).`,
        linkPath: `/villages/${encodeURIComponent(vil.id)}`,
        linkLabel: 'فتح القرية'
      });
    } else if (live.status === 'warning') {
      alerts.push({
        id: `wh_warn_${vil.id}`,
        severity: 'warning',
        category: 'warehouse',
        message: `القرية (${vil.name}) مخزن ${live.firstFullRes} عند ${live.maxWhPct}%.`,
        linkPath: `/villages/${encodeURIComponent(vil.id)}`,
        linkLabel: 'عرض القرية'
      });
    }

    if (live.scavState === 'idle_troops' || live.scavState === 'returned') {
      alerts.push({
        id: `scav_idle_${vil.id}`,
        severity: 'critical',
        category: 'scav',
        message: `جيش القرية (${vil.name}) متاح للإغارة (${live.scavStatusText}).`,
        linkPath: `/villages/${encodeURIComponent(vil.id)}`,
        linkLabel: 'إحاطة القرية'
      });
    }
  }

  const collisions = auditAccountsSecurity(state);
  for (const col of collisions) {
    alerts.push({
      id: `ip_col_${col.ip}_${col.worldId}`,
      severity: 'critical',
      category: 'security',
      message: `تضارب عنوان IP (${col.ip}) في ${col.wName} بين الحسابات: ${col.accountNames.join('، ')}.`,
      linkPath: '/reports',
      linkLabel: 'تقرير الأمان'
    });
  }

  return alerts;
}

export interface ContinentSellOpportunityVillage {
  villageId: string;
  villageName: string;
  coord: string;
  accountId: string;
  accountName: string;
  sellableNowPP: number;
  unsoldPP: number;
  freeMerchants: number;
  marketLevel: number;
  bestResName: string;
  bestRate: number;
}

export interface ContinentSellGroup {
  key: string;
  worldId: string;
  worldName: string;
  continent: string;
  continentLabel: string;
  villagesCount: number;
  opportunityCount: number;
  totalSellableNowPP: number;
  totalUnsoldPP: number;
  totalFreeMerchants: number;
  sellWood: number;
  sellClay: number;
  sellIron: number;
  isMarketClosed: boolean;
  isMarketCompletelyBlocked: boolean;
  opportunityVillages: ContinentSellOpportunityVillage[];
}

export function buildContinentSellGroups(
  villages: DashboardVillageContext[],
  state: ErpAppState
): ContinentSellGroup[] {
  if (villages.length === 0) return [];
  const map = new Map<string, ContinentSellGroup>();

  for (const item of villages) {
    const { vil, acc, live } = item;
    const continent = String(vil.continent || '44');
    const key = `${vil.worldId}__K${continent}`;
    const existing = map.get(key) || {
      key,
      worldId: vil.worldId,
      worldName: live.worldName,
      continent,
      continentLabel: `K${continent}`,
      villagesCount: 0,
      opportunityCount: 0,
      totalSellableNowPP: 0,
      totalUnsoldPP: 0,
      totalFreeMerchants: 0,
      sellWood: live.sellWood,
      sellClay: live.sellClay,
      sellIron: live.sellIron,
      isMarketClosed: Boolean(live.isMarketClosed),
      isMarketCompletelyBlocked: Boolean(live.isMarketCompletelyBlocked),
      opportunityVillages: []
    };

    existing.villagesCount += 1;
    if (!live.isMarketClosed) existing.isMarketClosed = false;
    if (!live.isMarketCompletelyBlocked) existing.isMarketCompletelyBlocked = false;

    const briefing = computeMissionBriefingForVillage(vil, state, live);
    const sellableNowPP = Math.max(0, live.sellableNowPP || 0);
    const unsoldPP = Math.max(0, live.unsoldPP || 0);
    const freeMerchants = Math.max(0, briefing.freeMerchants || live.merchants || 0);

    if (!live.isMarketClosed && !live.isMarketCompletelyBlocked && (sellableNowPP >= 0.5 || unsoldPP >= 1)) {
      existing.opportunityCount += 1;
      existing.totalSellableNowPP += sellableNowPP;
      existing.totalUnsoldPP += unsoldPP;
      existing.totalFreeMerchants += freeMerchants;
      existing.opportunityVillages.push({
        villageId: vil.id,
        villageName: vil.name,
        coord: vil.coord || '—',
        accountId: acc?.id || vil.accountId || '',
        accountName: acc?.name || 'بدون حساب',
        sellableNowPP: Math.round(sellableNowPP * 10) / 10,
        unsoldPP: Math.round(unsoldPP * 10) / 10,
        freeMerchants,
        marketLevel: Number(vil.marketLevel ?? vil.buildings?.['السوق'] ?? 0),
        bestResName: briefing.bestSellResName || 'خشب',
        bestRate: briefing.bestSellRate || live.sellRate
      });
    }

    map.set(key, existing);
  }

  return Array.from(map.values())
    .map((g) => ({
      ...g,
      totalSellableNowPP: Math.round(g.totalSellableNowPP * 10) / 10,
      totalUnsoldPP: Math.round(g.totalUnsoldPP * 10) / 10,
      opportunityVillages: g.opportunityVillages.sort((a, b) => {
        if (b.sellableNowPP !== a.sellableNowPP) return b.sellableNowPP - a.sellableNowPP;
        return b.unsoldPP - a.unsoldPP;
      })
    }))
    .sort((a, b) => {
      if (b.totalSellableNowPP !== a.totalSellableNowPP) return b.totalSellableNowPP - a.totalSellableNowPP;
      if (b.totalUnsoldPP !== a.totalUnsoldPP) return b.totalUnsoldPP - a.totalUnsoldPP;
      return a.continentLabel.localeCompare(b.continentLabel, 'en');
    });
}

export interface DashboardVillageContext {
  vil: ErpVillage;
  acc: ErpUserAccount | null;
  live: ReturnType<typeof computeVillageLiveStatus>;
}

export interface OverviewAccountAttribution {
  accountId: string;
  accountName: string;
  villagesCount: number;
  villageNames: string[];
  minesPP: number;
  scavPP: number;
  scavActivePP: number;
  dailyPP: number;
  unsoldPP: number;
  sellableNowPP: number;
  totalPP: number;
  dailyRes: number;
  staleCount: number;
}

export interface OverviewColumnBucketData {
  id: string;
  label: string;
  woodPP: number;
  clayPP: number;
  ironPP: number;
  scavPP: number;
  scavActivePP: number;
  unsoldPP: number;
  sellableNowPP: number;
  dailyPP: number;
  totalValue: number;
  dailyRes: number;
  villagesCount: number;
  accountsBreakdown: OverviewAccountAttribution[];
}

export function buildDashboardOverviewColumns(
  villages: DashboardVillageContext[],
  selectedWorldFilter: string
): OverviewColumnBucketData[] {
  if (villages.length === 0) return [];
  const activeWorldIds = new Set(villages.map((x) => x.vil.worldId));
  const groupByWorld = selectedWorldFilter === 'all' && activeWorldIds.size > 1;

  const byBucket = new Map<
    string,
    {
      id: string;
      label: string;
      woodPP: number;
      clayPP: number;
      ironPP: number;
      scavPP: number;
      scavActivePP: number;
      unsoldPP: number;
      sellableNowPP: number;
      dailyRes: number;
      villagesCount: number;
      accMap: Map<string, OverviewAccountAttribution>;
    }
  >();

  const pushInto = (
    bucketId: string,
    bucketLabel: string,
    item: DashboardVillageContext
  ) => {
    const { vil, acc, live } = item;
    const cur = byBucket.get(bucketId) || {
      id: bucketId,
      label: bucketLabel,
      woodPP: 0,
      clayPP: 0,
      ironPP: 0,
      scavPP: 0,
      scavActivePP: 0,
      unsoldPP: 0,
      sellableNowPP: 0,
      dailyRes: 0,
      villagesCount: 0,
      accMap: new Map()
    };

    const wDailyPP = (live.wProd * 24) / Math.max(64, live.sellWood || 64);
    const cDailyPP = (live.cProd * 24) / Math.max(64, live.sellClay || 64);
    const iDailyPP = (live.iProd * 24) / Math.max(64, live.sellIron || 64);
    const minesPP = wDailyPP + cDailyPP + iDailyPP;
    const scavDaily = Math.max(0, live.dailyPP - live.mineDailyPP);
    const dailyPP = minesPP + scavDaily;

    cur.woodPP += wDailyPP;
    cur.clayPP += cDailyPP;
    cur.ironPP += iDailyPP;
    cur.scavPP += scavDaily;
    cur.scavActivePP += live.scavActiveDailyPP || 0;
    cur.unsoldPP += live.unsoldPP;
    cur.sellableNowPP += live.sellableNowPP || 0;
    cur.dailyRes += live.dailyRes;
    cur.villagesCount += 1;

    const accKey = acc?.id || `unlinked_${vil.id}`;
    const accName = acc?.name || vil.name;
    const prevAcc = cur.accMap.get(accKey) || {
      accountId: acc?.id || '',
      accountName: accName,
      villagesCount: 0,
      villageNames: [],
      minesPP: 0,
      scavPP: 0,
      scavActivePP: 0,
      dailyPP: 0,
      unsoldPP: 0,
      sellableNowPP: 0,
      totalPP: 0,
      dailyRes: 0,
      staleCount: 0
    };
    prevAcc.villagesCount += 1;
    prevAcc.villageNames.push(vil.name);
    prevAcc.minesPP += minesPP;
    prevAcc.scavPP += scavDaily;
    prevAcc.scavActivePP += live.scavActiveDailyPP || 0;
    prevAcc.dailyPP += dailyPP;
    prevAcc.unsoldPP += live.unsoldPP;
    prevAcc.sellableNowPP += live.sellableNowPP || 0;
    prevAcc.totalPP = prevAcc.dailyPP + prevAcc.unsoldPP;
    prevAcc.dailyRes += live.dailyRes;
    if (live.isStaleSync) prevAcc.staleCount += 1;
    cur.accMap.set(accKey, prevAcc);

    byBucket.set(bucketId, cur);
  };

  villages.forEach((item) => {
    const id = groupByWorld ? item.vil.worldId : `K${item.vil.continent}`;
    const label = groupByWorld ? item.live.worldName : `قارة K${item.vil.continent}`;
    pushInto(id, label, item);
  });

  if (byBucket.size === 1 && villages.length > 1) {
    byBucket.clear();
    const uniqueAccounts = new Set(villages.map((v) => v.acc?.id || v.vil.id));
    if (uniqueAccounts.size > 1) {
      villages.forEach((item) => {
        const id = item.acc?.id || item.vil.id;
        const label = item.acc?.name || item.vil.name;
        pushInto(id, label, item);
      });
    } else {
      villages.forEach((item) => {
        pushInto(item.vil.id, item.vil.name, item);
      });
    }
  }

  return Array.from(byBucket.values()).map((b) => {
    const dailyPP = b.woodPP + b.clayPP + b.ironPP + b.scavPP;
    return {
      id: b.id,
      label: b.label,
      woodPP: b.woodPP,
      clayPP: b.clayPP,
      ironPP: b.ironPP,
      scavPP: b.scavPP,
      scavActivePP: b.scavActivePP,
      unsoldPP: b.unsoldPP,
      sellableNowPP: b.sellableNowPP,
      dailyPP,
      totalValue: dailyPP + b.unsoldPP,
      dailyRes: b.dailyRes,
      villagesCount: b.villagesCount,
      accountsBreakdown: Array.from(b.accMap.values()).sort((a, bAcc) => bAcc.totalPP - a.totalPP)
    };
  });
}

export interface DailyFlowAccountContribution {
  accountId: string;
  accountName: string;
  netPP: number;
  startPP: number | null;
  endPP: number | null;
  hasData: boolean;
  source: string;
  isOnboardingJump: boolean;
}

export interface DailyFlowBarPointData {
  dateKey: string;
  label: string;
  relativeLabel: string;
  netPP: number;
  earnedNetPP: number;
  hasOnboardingJump: boolean;
  onboardingJumpPP: number;
  hasRecordedData: boolean;
  accountsBreakdown: DailyFlowAccountContribution[];
}

export interface DashboardDailyFlowSummary {
  dayPoints: DailyFlowBarPointData[];
  periodNetPP: number;
  earnedPeriodNetPP: number;
  todayNetPP: number;
  baselineAvgPP: number;
  earnedBaselineAvgPP: number;
  deltaPct: number;
  earnedDeltaPct: number;
  hasOnboardingJump: boolean;
  onboardingJumpPP: number;
}

export function buildDashboardDailyFlow(
  state: ErpAppState,
  rangeDays: 7 | 14,
  allowedAccountIds?: Set<string>,
  nowMs: number = Date.now()
): DashboardDailyFlowSummary {
  const accounts = allowedAccountIds
    ? state.userAccounts.filter((a) => allowedAccountIds.has(a.id))
    : state.userAccounts;

  const todayKey = getCairoDateKey(nowMs);

  const accountFlows = accounts.map((acc) => {
    const vilsCount = state.villages.filter((v) => v.accountId === acc.id).length;
    const flow = buildAccountPPFlow({
      account: acc,
      villagesCount: vilsCount,
      dailySessions: state.dailySessions,
      ppLog: state.ppLog,
      targetDailyPP: getAccountTargetDailyPP(acc.id, state),
      finance: state.finance,
      daysCount: rangeDays,
      nowMs
    });
    return { acc, flow };
  });

  const dayPoints: DailyFlowBarPointData[] = [];
  for (let i = rangeDays - 1; i >= 0; i--) {
    const dk = shiftCairoDateKey(todayKey, -i);
    const labelInfo = formatArabicDayLabel(dk, todayKey);
    let dayNet = 0;
    let dayEarnedNet = 0;
    let onboardingJumpPP = 0;
    let hasDayOnboardingJump = false;
    let hasAnyRecorded = false;
    const accountsBreakdown: DailyFlowAccountContribution[] = [];

    for (const { acc, flow } of accountFlows) {
      const match = flow.daysAsc.find((d) => d.dateKey === dk);
      const net = match && match.netPP !== null ? Math.round(match.netPP * 10) / 10 : 0;
      const hasData = Boolean(match?.hasData && match.source !== 'none');
      const isJump = Boolean(match?.isOnboardingJump);
      if (hasData) {
        hasAnyRecorded = true;
        dayNet += net;
        if (isJump) {
          hasDayOnboardingJump = true;
          onboardingJumpPP += net;
        } else {
          dayEarnedNet += net;
        }
      }
      accountsBreakdown.push({
        accountId: acc.id,
        accountName: acc.name,
        netPP: net,
        startPP: match?.startPP ?? null,
        endPP: match?.endPP ?? null,
        hasData,
        source: match?.source ?? 'none',
        isOnboardingJump: isJump
      });
    }

    accountsBreakdown.sort((a, b) => {
      if (b.netPP !== a.netPP) return b.netPP - a.netPP;
      return (b.hasData ? 1 : 0) - (a.hasData ? 1 : 0);
    });

    const cleanLabel =
      rangeDays === 14
        ? labelInfo.shortDateLabel
        : labelInfo.weekdayLabel
          ? labelInfo.weekdayLabel.replace('ال', '')
          : labelInfo.shortDateLabel;

    dayPoints.push({
      dateKey: dk,
      label: cleanLabel,
      relativeLabel: `${labelInfo.relativeLabel} (${labelInfo.shortDateLabel})`,
      netPP: Math.round(dayNet * 10) / 10,
      earnedNetPP: Math.round(dayEarnedNet * 10) / 10,
      hasOnboardingJump: hasDayOnboardingJump,
      onboardingJumpPP: Math.round(onboardingJumpPP * 10) / 10,
      hasRecordedData: hasAnyRecorded,
      accountsBreakdown
    });
  }

  const todayNetPP = dayPoints.find((d) => d.dateKey === todayKey)?.netPP ?? 0;
  const periodNetPP = Math.round(dayPoints.reduce((s, d) => s + d.netPP, 0) * 10) / 10;
  const earnedPeriodNetPP = Math.round(dayPoints.reduce((s, d) => s + d.earnedNetPP, 0) * 10) / 10;
  const totalOnboardingJumpPP = Math.round(dayPoints.reduce((s, d) => s + d.onboardingJumpPP, 0) * 10) / 10;
  const hasOnboardingJump = dayPoints.some((d) => d.hasOnboardingJump);

  const priorActiveDays = dayPoints.filter((d) => d.dateKey !== todayKey && (d.hasRecordedData || d.netPP !== 0));
  const baselineAvgPP =
    priorActiveDays.length > 0
      ? Math.round(
          (priorActiveDays.reduce((s, d) => s + d.netPP, 0) / priorActiveDays.length) * 10
        ) / 10
      : 0;

  const priorEarnedDays = dayPoints.filter(
    (d) => d.dateKey !== todayKey && (d.earnedNetPP !== 0 || (d.hasRecordedData && !d.hasOnboardingJump))
  );
  const earnedBaselineAvgPP =
    priorEarnedDays.length > 0
      ? Math.round(
          (priorEarnedDays.reduce((s, d) => s + d.earnedNetPP, 0) / priorEarnedDays.length) * 10
        ) / 10
      : 0;

  const deltaPct =
    baselineAvgPP > 0
      ? Math.round(((todayNetPP - baselineAvgPP) / baselineAvgPP) * 1000) / 10
      : todayNetPP > 0
        ? 100
        : 0;

  const earnedDeltaPct =
    earnedBaselineAvgPP > 0
      ? Math.round(((todayNetPP - earnedBaselineAvgPP) / earnedBaselineAvgPP) * 1000) / 10
      : todayNetPP > 0
        ? 100
        : 0;

  return {
    dayPoints,
    periodNetPP,
    earnedPeriodNetPP,
    todayNetPP,
    baselineAvgPP,
    earnedBaselineAvgPP,
    deltaPct,
    earnedDeltaPct,
    hasOnboardingJump,
    onboardingJumpPP: totalOnboardingJumpPP
  };
}

export interface DistributionAccountItem {
  accountId: string;
  accountName: string;
  pp: number;
  sellableNowPP?: number;
  activeScavPP?: number;
  isStaleSync?: boolean;
  villagesCount: number;
  villageNames: string[];
}

export interface DistributionAttributionResult {
  minesAccounts: DistributionAccountItem[];
  scavAccounts: DistributionAccountItem[];
  unsoldAccounts: DistributionAccountItem[];
}

export function buildDistributionAttribution(
  villages: DashboardVillageContext[]
): DistributionAttributionResult {
  const minesMap = new Map<string, DistributionAccountItem>();
  const scavMap = new Map<string, DistributionAccountItem>();
  const unsoldMap = new Map<string, DistributionAccountItem>();

  const addEntry = (
    map: Map<string, DistributionAccountItem>,
    item: DashboardVillageContext,
    val: number,
    extra: { sellableNowPP?: number; activeScavPP?: number } = {}
  ) => {
    const key = item.acc?.id || `unlinked_${item.vil.id}`;
    const existing = map.get(key) || {
      accountId: item.acc?.id || '',
      accountName: item.acc?.name || item.vil.name,
      pp: 0,
      sellableNowPP: 0,
      activeScavPP: 0,
      isStaleSync: false,
      villagesCount: 0,
      villageNames: []
    };
    existing.pp += Math.max(0, val);
    existing.sellableNowPP = (existing.sellableNowPP || 0) + Math.max(0, extra.sellableNowPP || 0);
    existing.activeScavPP = (existing.activeScavPP || 0) + Math.max(0, extra.activeScavPP || 0);
    existing.isStaleSync = Boolean(existing.isStaleSync || item.live.isStaleSync);
    existing.villagesCount += 1;
    existing.villageNames.push(item.vil.name);
    map.set(key, existing);
  };

  for (const item of villages) {
    const minesPP = item.live.mineDailyPP;
    const scavPP = Math.max(0, item.live.dailyPP - item.live.mineDailyPP);
    const unsoldPP = Math.max(0, item.live.unsoldPP);
    addEntry(minesMap, item, minesPP);
    addEntry(scavMap, item, scavPP, { activeScavPP: item.live.scavActiveDailyPP || 0 });
    addEntry(unsoldMap, item, unsoldPP, { sellableNowPP: item.live.sellableNowPP || 0 });
  }

  const sortDesc = (m: Map<string, DistributionAccountItem>) =>
    Array.from(m.values()).sort((a, b) => b.pp - a.pp);

  return {
    minesAccounts: sortDesc(minesMap),
    scavAccounts: sortDesc(scavMap),
    unsoldAccounts: sortDesc(unsoldMap)
  };
}

export interface DashboardResAttackPoint {
  dateKey: string;
  label: string;
  relativeLabel: string;
  mineResourcesK: number;
  raidResourcesK: number;
  totalResourcesK: number;
  attacksCount: number;
  activeAccountsCount: number;
  hasRecordedActivity: boolean;
}

export interface DashboardResAttackAccountOption {
  id: string;
  name: string;
  villagesCount: number;
}

export interface DashboardResourcesAndAttacksSummary {
  points: DashboardResAttackPoint[];
  totalMineResK: number;
  totalRaidResK: number;
  totalCombinedResK: number;
  totalAttacks: number;
  avgDailyResK: number;
  avgDailyAttacks: number;
  activeDaysCount: number;
  peakDayLabel: string;
  accountOptions: DashboardResAttackAccountOption[];
}

export function buildDashboardResourcesAndAttacksSeries(
  state: ErpAppState,
  villages: DashboardVillageContext[],
  rangeDays: 7 | 14,
  selectedAccountId: string = 'all',
  nowMs: number = Date.now()
): DashboardResourcesAndAttacksSummary {
  const accountMap = new Map<string, DashboardResAttackAccountOption>();
  for (const item of villages) {
    const aid = item.acc?.id || item.vil.accountId;
    if (!aid) continue;
    const prev = accountMap.get(aid) || {
      id: aid,
      name: item.acc?.name || item.vil.name,
      villagesCount: 0
    };
    prev.villagesCount += 1;
    accountMap.set(aid, prev);
  }
  const accountOptions = Array.from(accountMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'ar')
  );

  const scopedVillages =
    selectedAccountId !== 'all'
      ? villages.filter((v) => (v.acc?.id || v.vil.accountId) === selectedAccountId)
      : villages;

  const scopedAccountIds = new Set<string>();
  scopedVillages.forEach((v) => {
    const aid = v.acc?.id || v.vil.accountId;
    if (aid) scopedAccountIds.add(aid);
  });

  // Pre-compute per-account daily production & raid profiles from live villages
  const profileByAccount = new Map<
    string,
    {
      dailyMineRes: number;
      dailyRaidRes: number;
      dailyRaidRuns: number;
      awaySquads: number;
    }
  >();

  for (const item of scopedVillages) {
    const aid = item.acc?.id || item.vil.accountId || item.vil.id;
    const prev = profileByAccount.get(aid) || {
      dailyMineRes: 0,
      dailyRaidRes: 0,
      dailyRaidRuns: 0,
      awaySquads: 0
    };
    const mineDailyRes = Math.max(0, item.live.totalHourly * 24);
    // Estimate daily scavenging / raid resources from active loot or haul cycles
    const liveLootRes = Math.max(
      0,
      Number(item.vil.scavData?.loot?.total || 0),
      item.live.scavLootPP * Math.max(64, item.live.sellRate || 64)
    );
    const activeScavRes =
      item.live.scavActiveDailyPP > 0
        ? item.live.scavActiveDailyPP * Math.max(64, item.live.sellRate || 64)
        : 0;
    const raidDailyRes =
      activeScavRes > 0
        ? activeScavRes
        : item.live.scavState === 'running' || item.live.scavState === 'returned'
          ? Math.max(liveLootRes, item.live.haulTotal * 3)
          : item.live.awayTroops > 0
            ? Math.max(liveLootRes, item.live.awayTroops * 25 * 4)
            : liveLootRes;

    const unlockedTiers = Math.max(
      0,
      Number(
        item.vil.unlockedScavTiers ||
          item.vil.scavData?.unlockedScavTiers ||
          item.vil.scavData?.unlockedTiers ||
          0
      )
    );
    const activeSlots = Number(item.vil.scavActiveCount || item.vil.scavData?.scavActiveCount || 0);
    const scavRuns =
      activeSlots > 0
        ? activeSlots
        : item.live.scavState === 'running'
          ? Math.max(1, unlockedTiers)
          : item.live.scavState === 'returned'
            ? Math.max(1, unlockedTiers)
            : 0;
    const awaySquads =
      item.live.awayTroops > 0 ? Math.max(1, Math.ceil(item.live.awayTroops / 45)) : 0;

    prev.dailyMineRes += mineDailyRes;
    prev.dailyRaidRes += raidDailyRes;
    prev.dailyRaidRuns += scavRuns;
    prev.awaySquads += awaySquads;
    profileByAccount.set(aid, prev);
  }

  // Index sessionLogs, ppLog, and loginHistory by Cairo dateKey
  const sessionCountByDateAcc = new Map<string, number>();
  for (const log of state.sessionLogs || []) {
    if (!log || !log.dateKey || !log.accountId) continue;
    if (scopedAccountIds.size > 0 && !scopedAccountIds.has(log.accountId)) continue;
    const k = `${log.dateKey}__${log.accountId}`;
    sessionCountByDateAcc.set(k, (sessionCountByDateAcc.get(k) || 0) + 1);
  }

  const ppLogDatesByAcc = new Map<string, Set<string>>();
  for (const [aid, entries] of Object.entries(state.ppLog || {})) {
    if (scopedAccountIds.size > 0 && !scopedAccountIds.has(aid)) continue;
    const set = new Set<string>();
    for (const entry of entries || []) {
      if (entry?.t) set.add(getCairoDateKey(entry.t));
    }
    ppLogDatesByAcc.set(aid, set);
  }

  const loginCountByDateAcc = new Map<string, number>();
  for (const acc of state.userAccounts) {
    if (scopedAccountIds.size > 0 && !scopedAccountIds.has(acc.id)) continue;
    for (const h of acc.loginHistory || []) {
      const dk = h.ts ? getCairoDateKey(h.ts) : '';
      if (!dk) continue;
      const k = `${dk}__${acc.id}`;
      loginCountByDateAcc.set(k, (loginCountByDateAcc.get(k) || 0) + 1);
    }
    if (acc.lastSyncTime) {
      const dk = getCairoDateKey(acc.lastSyncTime);
      const k = `${dk}__${acc.id}`;
      if (!loginCountByDateAcc.has(k)) {
        loginCountByDateAcc.set(k, 1);
      }
    }
  }

  const todayKey = getCairoDateKey(nowMs);
  const points: DashboardResAttackPoint[] = [];

  for (let i = rangeDays - 1; i >= 0; i--) {
    const dk = shiftCairoDateKey(todayKey, -i);
    const labelInfo = formatArabicDayLabel(dk, todayKey);
    const isToday = dk === todayKey;

    let mineRes = 0;
    let raidRes = 0;
    let attacks = 0;
    let activeAccounts = 0;
    let hasRecorded = false;

    for (const [aid, prof] of profileByAccount.entries()) {
      const sessEntry = state.dailySessions?.[dk]?.[aid];
      const logHits = sessionCountByDateAcc.get(`${dk}__${aid}`) || 0;
      const loginHits = loginCountByDateAcc.get(`${dk}__${aid}`) || 0;
      const hasPpLog = Boolean(ppLogDatesByAcc.get(aid)?.has(dk));
      const isActiveOnDay =
        isToday || Boolean(sessEntry) || logHits > 0 || loginHits > 0 || hasPpLog;

      if (!isActiveOnDay) continue;
      hasRecorded = true;
      activeAccounts += 1;

      if (isToday) {
        mineRes += prof.dailyMineRes;
        raidRes += prof.dailyRaidRes;
        attacks += prof.dailyRaidRuns + prof.awaySquads + logHits;
      } else {
        // Scale historical day activity based on recorded sessions / PP net / login dispatches
        const ppDelta = sessEntry
          ? Math.max(0, Number(sessEntry.lastSyncedPP || 0) - Number(sessEntry.startPP || 0))
          : 0;
        const targetPP = Math.max(1, Number(sessEntry?.targetPP || 1));
        const activityWeight = sessEntry
          ? Math.min(1.25, Math.max(0.35, ppDelta > 0 ? ppDelta / targetPP : 0.75))
          : logHits > 0
            ? Math.min(1, 0.5 + logHits * 0.25)
            : 0.65;

        mineRes += prof.dailyMineRes * activityWeight;
        raidRes += prof.dailyRaidRes * activityWeight;
        attacks +=
          logHits +
          Math.max(
            loginHits > 0 ? Math.min(4, loginHits) : 0,
            Math.round((prof.dailyRaidRuns + prof.awaySquads) * activityWeight)
          );
      }
    }

    const mineResourcesK = Math.round((mineRes / 1000) * 10) / 10;
    const raidResourcesK = Math.round((raidRes / 1000) * 10) / 10;
    const totalResourcesK = Math.round((mineResourcesK + raidResourcesK) * 10) / 10;
    const cleanLabel =
      rangeDays === 14
        ? labelInfo.shortDateLabel
        : labelInfo.weekdayLabel
          ? labelInfo.weekdayLabel.replace('ال', '')
          : labelInfo.shortDateLabel;

    points.push({
      dateKey: dk,
      label: cleanLabel,
      relativeLabel: `${labelInfo.relativeLabel} (${labelInfo.shortDateLabel})`,
      mineResourcesK,
      raidResourcesK,
      totalResourcesK,
      attacksCount: Math.max(0, Math.round(attacks)),
      activeAccountsCount: activeAccounts,
      hasRecordedActivity: hasRecorded
    });
  }

  const totalMineResK = Math.round(points.reduce((s, p) => s + p.mineResourcesK, 0) * 10) / 10;
  const totalRaidResK = Math.round(points.reduce((s, p) => s + p.raidResourcesK, 0) * 10) / 10;
  const totalCombinedResK = Math.round((totalMineResK + totalRaidResK) * 10) / 10;
  const totalAttacks = points.reduce((s, p) => s + p.attacksCount, 0);
  const activeDays = points.filter((p) => p.hasRecordedActivity);
  const denom = Math.max(1, activeDays.length);
  const avgDailyResK = Math.round((totalCombinedResK / denom) * 10) / 10;
  const avgDailyAttacks = Math.round((totalAttacks / denom) * 10) / 10;

  let peakPoint = points[points.length - 1] || null;
  for (const p of points) {
    if (!peakPoint || p.totalResourcesK + p.attacksCount * 2 > peakPoint.totalResourcesK + peakPoint.attacksCount * 2) {
      peakPoint = p;
    }
  }

  return {
    points,
    totalMineResK,
    totalRaidResK,
    totalCombinedResK,
    totalAttacks,
    avgDailyResK,
    avgDailyAttacks,
    activeDaysCount: activeDays.length,
    peakDayLabel: peakPoint ? peakPoint.relativeLabel : '—',
    accountOptions
  };
}

export type RadarTileTone = 'critical' | 'warning' | 'ready' | 'safe';

export interface VillageRadarTileData {
  villageId: string;
  villageName: string;
  coord: string;
  continent: string;
  accountName: string;
  statusLabel: string;
  tone: RadarTileTone;
  etaText: string;
  maxWhPct: number;
  dailyPPText: string;
  scavBadge: string;
}

export function buildVillageRadarTileData(
  vil: ErpVillage,
  acc: ErpUserAccount | null,
  live: VillageLiveStatus,
  state: ErpAppState
): VillageRadarTileData {
  const briefing = computeMissionBriefingForVillage(vil, state, live);
  const isCriticalWh = live.status === 'critical' && live.maxWhPct >= 85;
  const isWarningWh = live.status === 'warning';
  const isScavReady = live.scavState === 'idle_troops' || live.scavState === 'returned';
  const hasReadyStep = briefing.readyStepsNow.length > 0;

  let statusLabel = 'مستقرة';
  let tone: RadarTileTone = 'safe';
  let etaText = 'آمن';

  if (isCriticalWh) {
    statusLabel = `مخزن ${live.maxWhPct}%`;
    tone = 'critical';
    etaText = formatHoursArabic(live.minHoursLeft);
  } else if (isScavReady) {
    statusLabel = 'إرسال إغارة';
    tone = 'warning';
    etaText = 'فوري';
  } else if (hasReadyStep) {
    statusLabel = 'ترقية جاهزة';
    tone = 'ready';
    etaText = 'الآن';
  } else if (isWarningWh) {
    statusLabel = `مخزن ${live.maxWhPct}%`;
    tone = 'warning';
    etaText = formatHoursArabic(live.minHoursLeft);
  } else if (live.scavState === 'running') {
    statusLabel = 'إغارة جارية';
    tone = 'safe';
    etaText = formatHoursArabic(live.scavRemHours);
  } else if (live.isMarketCompletelyBlocked) {
    statusLabel = 'السوق ممتلئ';
    tone = 'critical';
    etaText = 'مغلق';
  }

  return {
    villageId: vil.id,
    villageName: vil.name,
    coord: vil.coord || '—',
    continent: String(vil.continent || '44'),
    accountName: acc?.name || 'بدون حساب',
    statusLabel,
    tone,
    etaText,
    maxWhPct: live.maxWhPct,
    dailyPPText: `${Math.round(live.dailyPP)} PP/ي`,
    scavBadge:
      isScavReady
        ? 'إغارة جاهزة'
        : live.scavState === 'running'
          ? `تعود ${formatHoursArabic(live.scavRemHours)}`
          : ''
  };
}

export type NotificationCategory = 'all' | 'security' | 'warehouse' | 'scav' | 'other';

export interface HeaderNotificationItem {
  id: string;
  severity: 'critical' | 'warning';
  kind: 'security' | 'warehouse' | 'scav' | 'plan' | 'market';
  title: string;
  subtitle: string;
  detail: string;
  timeText: string;
  targetPath: string;
  priorityRank: number;
}

export function buildHeaderNotifications(
  state: ErpAppState,
  nowMs: number = Date.now()
): HeaderNotificationItem[] {
  const items: HeaderNotificationItem[] = [];
  const collisions = auditAccountsSecurity(state);

  for (const col of collisions) {
    items.push({
      id: `sec_${col.ip}_${col.worldId}`,
      severity: 'critical',
      kind: 'security',
      title: `تضارب IP (${col.ip})`,
      subtitle: col.wName,
      detail: `حسابات متشاركة: ${col.accountNames.join('، ')}`,
      timeText: 'فوري',
      targetPath: '/reports?tab=security',
      priorityRank: 0
    });
  }

  const closedWorldIds = new Set(
    (state.worlds || []).filter((w) => Boolean(w.tradeEnded)).map((w) => w.id)
  );

  for (const vil of state.villages) {
    if (closedWorldIds.has(vil.worldId)) continue;
    const acc = state.userAccounts.find((a) => a.id === vil.accountId) || null;
    const live = computeVillageLiveStatus(vil, state, nowMs);
    if (live.tradeEnded) continue;
    const briefing = computeMissionBriefingForVillage(vil, state, live);
    const subtitle = `${acc?.name || 'بدون حساب'} · K${vil.continent} (${live.worldName})`;
    const syncTimeText = formatTimeAgo(vil.lastSyncTime || acc?.lastSyncTime);
    const targetPath = `/villages/${encodeURIComponent(vil.id)}`;

    if (live.status === 'critical' || live.status === 'warning') {
      const isCrit = live.status === 'critical';
      items.push({
        id: `wh_${vil.id}`,
        severity: isCrit ? 'critical' : 'warning',
        kind: 'warehouse',
        title: `${vil.name} · مخزن ${live.maxWhPct}%`,
        subtitle,
        detail: `مخزن ${live.firstFullRes} يمتلئ خلال ${formatHoursArabic(live.minHoursLeft)}`,
        timeText: syncTimeText,
        targetPath,
        priorityRank: isCrit ? 1 : 3
      });
    }

    if (live.scavState === 'idle_troops' || live.scavState === 'returned') {
      items.push({
        id: `scav_${vil.id}`,
        severity: 'critical',
        kind: 'scav',
        title: `${vil.name} · إرسال إغارات`,
        subtitle,
        detail:
          live.scavState === 'returned'
            ? `القوات عادت وجاهزة للإغارة (حمولة ${live.haulHome.toLocaleString('en-US')})`
            : `جيش متاح للإغارة الآن (حمولة ${live.haulHome.toLocaleString('en-US')})`,
        timeText: syncTimeText,
        targetPath,
        priorityRank: 2
      });
    }

    if (briefing.readyStepsNow.length > 0) {
      const first = briefing.readyStepsNow[0];
      items.push({
        id: `plan_${vil.id}`,
        severity: 'warning',
        kind: 'plan',
        title: `${vil.name} · خطة التطوير`,
        subtitle,
        detail: `جاهز للبناء: ${first.bName} (م${first.targetLvl})${briefing.readyStepsNow.length > 1 ? ` (+${briefing.readyStepsNow.length - 1})` : ''}`,
        timeText: syncTimeText,
        targetPath,
        priorityRank: 4
      });
    } else if (briefing.shouldSellMarket && live.sellableNowPP >= 2) {
      items.push({
        id: `mkt_${vil.id}`,
        severity: 'warning',
        kind: 'market',
        title: `${vil.name} · فرصة بيع`,
        subtitle,
        detail: briefing.marketSummary,
        timeText: syncTimeText,
        targetPath,
        priorityRank: 5
      });
    }
  }

  return items.sort((a, b) => a.priorityRank - b.priorityRank);
}

export function filterNotificationsByCategory(
  items: HeaderNotificationItem[],
  category: NotificationCategory
): HeaderNotificationItem[] {
  if (category === 'all') return items;
  if (category === 'other') {
    return items.filter((i) => i.kind === 'plan' || i.kind === 'market');
  }
  return items.filter((i) => i.kind === category);
}

export function countNotificationsByCategory(
  items: HeaderNotificationItem[]
): Record<NotificationCategory, number> {
  return {
    all: items.length,
    security: items.filter((i) => i.kind === 'security').length,
    warehouse: items.filter((i) => i.kind === 'warehouse').length,
    scav: items.filter((i) => i.kind === 'scav').length,
    other: items.filter((i) => i.kind === 'plan' || i.kind === 'market').length
  };
}

export type WorldMapContinentCode = '44' | '45' | '54' | '55';

export interface WorldMapContinentMeta {
  code: WorldMapContinentCode;
  label: string;
  regionLabel: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  centerX: number;
  centerY: number;
}

export const WORLD_MAP_CONTINENTS: readonly WorldMapContinentMeta[] = [
  {
    code: '44',
    label: 'K44',
    regionLabel: 'شمال غرب',
    minX: 400,
    maxX: 500,
    minY: 400,
    maxY: 500,
    centerX: 450,
    centerY: 450
  },
  {
    code: '45',
    label: 'K45',
    regionLabel: 'شمال شرق',
    minX: 500,
    maxX: 600,
    minY: 400,
    maxY: 500,
    centerX: 550,
    centerY: 450
  },
  {
    code: '54',
    label: 'K54',
    regionLabel: 'جنوب غرب',
    minX: 400,
    maxX: 500,
    minY: 500,
    maxY: 600,
    centerX: 450,
    centerY: 550
  },
  {
    code: '55',
    label: 'K55',
    regionLabel: 'جنوب شرق',
    minX: 500,
    maxX: 600,
    minY: 500,
    maxY: 600,
    centerX: 550,
    centerY: 550
  }
] as const;

const WORLD_MAP_CONTINENT_BY_CODE: Record<WorldMapContinentCode, WorldMapContinentMeta> = {
  '44': WORLD_MAP_CONTINENTS[0],
  '45': WORLD_MAP_CONTINENTS[1],
  '54': WORLD_MAP_CONTINENTS[2],
  '55': WORLD_MAP_CONTINENTS[3]
};

export function parseVillageCoord(coord?: string | null): { x: number; y: number } | null {
  if (!coord) return null;
  const match = String(coord).match(/(\d{1,3})\s*\|\s*(\d{1,3})/);
  if (!match) return null;
  const x = Number.parseInt(match[1], 10);
  const y = Number.parseInt(match[2], 10);
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 999 || y < 0 || y > 999) {
    return null;
  }
  return { x, y };
}

function normalizeMapContinent(
  x: number | null,
  y: number | null,
  fallbackContinent?: string
): WorldMapContinentCode {
  if (x !== null && y !== null) {
    const derived = `${Math.floor(y / 100)}${Math.floor(x / 100)}`;
    if (derived === '44' || derived === '45' || derived === '54' || derived === '55') {
      return derived;
    }
  }
  const cleanFallback = String(fallbackContinent || '').replace(/^K/i, '').trim();
  if (
    cleanFallback === '44' ||
    cleanFallback === '45' ||
    cleanFallback === '54' ||
    cleanFallback === '55'
  ) {
    return cleanFallback;
  }
  if (x !== null && y !== null) {
    if (y < 500) return x < 500 ? '44' : '45';
    return x < 500 ? '54' : '55';
  }
  return '44';
}

export type WorldMapViewMode = 'world' | 'fit' | WorldMapContinentCode;

export interface VillageArmyUnitRow {
  key: UnitKey;
  label: string;
  home: number;
  away: number;
  total: number;
  haulPerUnit: number;
  popPerUnit: number;
}

export interface VillageArmyBreakdown {
  units: VillageArmyUnitRow[];
  totalHome: number;
  totalAway: number;
  totalAll: number;
  totalHaulCap: number;
  totalPop: number;
}

export function buildVillageArmyBreakdown(
  village: ErpVillage,
  live?: Pick<VillageLiveStatus, 'armyMatrix'> | null
): VillageArmyBreakdown {
  const matrix = live?.armyMatrix ?? computeVillageLiveResourcesAndArmy(village).armyMatrix;
  const byKey = new Map(matrix.map((item) => [item.key, item]));

  let totalHome = 0;
  let totalAway = 0;
  let totalAll = 0;
  let totalHaulCap = 0;
  let totalPop = 0;

  const units: VillageArmyUnitRow[] = SCAV_UNIT_DEFS.map((def) => {
    const entry = byKey.get(def.key);
    const home = Math.max(0, Math.round(Number(entry?.home ?? 0)));
    const away = Math.max(0, Math.round(Number(entry?.away ?? 0)));
    const rawTotal = Math.max(0, Math.round(Number(entry?.total ?? 0)));
    const total = Math.max(rawTotal, home + away);
    totalHome += home;
    totalAway += away;
    totalAll += total;
    totalHaulCap += total * def.haul;
    totalPop += total * def.pop;
    return {
      key: def.key,
      label: def.ar,
      home,
      away,
      total,
      haulPerUnit: def.haul,
      popPerUnit: def.pop
    };
  });

  return {
    units,
    totalHome,
    totalAway,
    totalAll,
    totalHaulCap,
    totalPop
  };
}

export function normalizeVillageRole(role?: string | null): VillageRole {
  if (role === 'offense' || role === 'defense') return role;
  return 'unset';
}

export function projectWorldCoordToPct(
  x: number,
  y: number,
  zoomContinent: WorldMapContinentCode | 'all' = 'all',
  customBounds?: { minX: number; maxX: number; minY: number; maxY: number }
): { xPct: number; yPct: number; isOutOfBounds: boolean } {
  const bounds =
    customBounds ??
    (zoomContinent === 'all'
      ? { minX: 400, maxX: 600, minY: 400, maxY: 600 }
      : WORLD_MAP_CONTINENT_BY_CODE[zoomContinent]);

  // Project using cell center (x + 0.5, y + 0.5) so x=499 stays strictly West of 500 and x=500 stays strictly East of 500
  const spanX = Math.max(1, bounds.maxX - bounds.minX);
  const spanY = Math.max(1, bounds.maxY - bounds.minY);
  const rawXPct = ((x + 0.5 - bounds.minX) / spanX) * 100;
  const rawYPct = ((y + 0.5 - bounds.minY) / spanY) * 100;
  const isOutOfBounds = rawXPct < 0 || rawXPct > 100 || rawYPct < 0 || rawYPct > 100;

  return {
    xPct: Math.min(97.4, Math.max(2.6, Math.round(rawXPct * 100) / 100)),
    yPct: Math.min(97.4, Math.max(2.6, Math.round(rawYPct * 100) / 100)),
    isOutOfBounds
  };
}

function getContinentClampBox(
  continent: WorldMapContinentCode,
  axisXPct: number | null,
  axisYPct: number | null
): { minX: number; maxX: number; minY: number; maxY: number } {
  const edgePad = 2.6;
  const borderPad = 1.6;
  let minX = edgePad;
  let maxX = 100 - edgePad;
  let minY = edgePad;
  let maxY = 100 - edgePad;

  if (axisXPct !== null) {
    if (continent === '44' || continent === '54') {
      maxX = Math.max(edgePad, axisXPct - borderPad);
    } else {
      minX = Math.min(100 - edgePad, axisXPct + borderPad);
    }
  }
  if (axisYPct !== null) {
    if (continent === '44' || continent === '45') {
      maxY = Math.max(edgePad, axisYPct - borderPad);
    } else {
      minY = Math.min(100 - edgePad, axisYPct + borderPad);
    }
  }
  return { minX, maxX, minY, maxY };
}

function clampToBox(
  val: number,
  minVal: number,
  maxVal: number
): number {
  return Math.round(Math.min(maxVal, Math.max(minVal, val)) * 100) / 100;
}

function computeAutoFitBounds(
  coords: Array<{ x: number; y: number }>
): { minX: number; maxX: number; minY: number; maxY: number } {
  if (coords.length === 0) {
    return { minX: 400, maxX: 600, minY: 400, maxY: 600 };
  }
  let minX = 600;
  let maxX = 400;
  let minY = 600;
  let maxY = 400;
  for (const c of coords) {
    const cx = Math.min(599, Math.max(400, c.x));
    const cy = Math.min(599, Math.max(400, c.y));
    if (cx < minX) minX = cx;
    if (cx > maxX) maxX = cx;
    if (cy < minY) minY = cy;
    if (cy > maxY) maxY = cy;
  }

  const rawSpan = Math.max(maxX - minX, maxY - minY);
  const targetSpan = Math.min(200, Math.max(60, Math.ceil((rawSpan + 28) / 20) * 20));
  const midX = Math.round((minX + maxX) / 2 / 5) * 5;
  const midY = Math.round((minY + maxY) / 2 / 5) * 5;

  let bMinX = Math.round((midX - targetSpan / 2) / 10) * 10;
  let bMinY = Math.round((midY - targetSpan / 2) / 10) * 10;
  bMinX = Math.max(400, Math.min(600 - targetSpan, bMinX));
  bMinY = Math.max(400, Math.min(600 - targetSpan, bMinY));

  return {
    minX: bMinX,
    maxX: bMinX + targetSpan,
    minY: bMinY,
    maxY: bMinY + targetSpan
  };
}

export interface WorldMapVillagePoint {
  villageId: string;
  villageName: string;
  accountName: string;
  worldName: string;
  coordText: string;
  x: number;
  y: number;
  hasExactCoord: boolean;
  isOutOfBounds: boolean;
  continent: WorldMapContinentCode;
  villageRole: VillageRole;
  xPct: number;
  yPct: number;
  distanceFromCenter: number;
  tone: RadarTileTone;
  statusLabel: string;
  etaText: string;
  maxWhPct: number;
  dailyPP: number;
  unsoldPP: number;
  sellableNowPP: number;
}

export interface WorldMapContinentSummary {
  code: WorldMapContinentCode;
  label: string;
  regionLabel: string;
  villagesCount: number;
  accountsCount: number;
  offenseCount: number;
  defenseCount: number;
  unsetCount: number;
  criticalCount: number;
  warningCount: number;
  dailyPP: number;
  unsoldPP: number;
  sellableNowPP: number;
}

export interface WorldMapData {
  points: WorldMapVillagePoint[];
  visiblePoints: WorldMapVillagePoint[];
  continents: WorldMapContinentSummary[];
  totalVillages: number;
  mappedExactCount: number;
  toneCounts: Record<RadarTileTone, number>;
  roleCounts: Record<VillageRole, number>;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  axisXPct: number | null;
  axisYPct: number | null;
}

export function buildWorldMapData(
  filteredVillages: Array<{
    vil: ErpVillage;
    acc: ErpUserAccount | null;
    live: VillageLiveStatus;
  }>,
  state: ErpAppState,
  zoomMode: WorldMapContinentCode | 'all' | 'fit' = 'all'
): WorldMapData {
  const continentAccSets: Record<WorldMapContinentCode, Set<string>> = {
    '44': new Set(),
    '45': new Set(),
    '54': new Set(),
    '55': new Set()
  };

  const continentSummaryMap: Record<WorldMapContinentCode, WorldMapContinentSummary> = {
    '44': {
      code: '44',
      label: 'K44',
      regionLabel: 'شمال غرب',
      villagesCount: 0,
      accountsCount: 0,
      offenseCount: 0,
      defenseCount: 0,
      unsetCount: 0,
      criticalCount: 0,
      warningCount: 0,
      dailyPP: 0,
      unsoldPP: 0,
      sellableNowPP: 0
    },
    '45': {
      code: '45',
      label: 'K45',
      regionLabel: 'شمال شرق',
      villagesCount: 0,
      accountsCount: 0,
      offenseCount: 0,
      defenseCount: 0,
      unsetCount: 0,
      criticalCount: 0,
      warningCount: 0,
      dailyPP: 0,
      unsoldPP: 0,
      sellableNowPP: 0
    },
    '54': {
      code: '54',
      label: 'K54',
      regionLabel: 'جنوب غرب',
      villagesCount: 0,
      accountsCount: 0,
      offenseCount: 0,
      defenseCount: 0,
      unsetCount: 0,
      criticalCount: 0,
      warningCount: 0,
      dailyPP: 0,
      unsoldPP: 0,
      sellableNowPP: 0
    },
    '55': {
      code: '55',
      label: 'K55',
      regionLabel: 'جنوب شرق',
      villagesCount: 0,
      accountsCount: 0,
      offenseCount: 0,
      defenseCount: 0,
      unsetCount: 0,
      criticalCount: 0,
      warningCount: 0,
      dailyPP: 0,
      unsoldPP: 0,
      sellableNowPP: 0
    }
  };

  const toneCounts: Record<RadarTileTone, number> = {
    critical: 0,
    warning: 0,
    ready: 0,
    safe: 0
  };

  const roleCounts: Record<VillageRole, number> = {
    offense: 0,
    defense: 0,
    unset: 0
  };

  let mappedExactCount = 0;

  // First pass: resolve exact coordinates and continent for every village
  const parsedEntries = filteredVillages.map(({ vil, acc, live }) => {
    const tile = buildVillageRadarTileData(vil, acc, live, state);
    const parsed = parseVillageCoord(vil.coord);
    const continent = normalizeMapContinent(parsed?.x ?? null, parsed?.y ?? null, vil.continent);
    const meta = WORLD_MAP_CONTINENT_BY_CODE[continent];
    const hasExactCoord = parsed !== null;
    const x = parsed ? parsed.x : meta.centerX;
    const y = parsed ? parsed.y : meta.centerY;
    const villageRole = normalizeVillageRole(vil.villageRole);

    if (hasExactCoord) mappedExactCount += 1;

    toneCounts[tile.tone] += 1;
    roleCounts[villageRole] += 1;

    const summary = continentSummaryMap[continent];
    summary.villagesCount += 1;
    summary.dailyPP += live.dailyPP;
    summary.unsoldPP += live.unsoldPP;
    summary.sellableNowPP += live.sellableNowPP;
    if (villageRole === 'offense') summary.offenseCount += 1;
    else if (villageRole === 'defense') summary.defenseCount += 1;
    else summary.unsetCount += 1;
    if (tile.tone === 'critical') summary.criticalCount += 1;
    else if (tile.tone === 'warning') summary.warningCount += 1;
    if (acc?.id) continentAccSets[continent].add(acc.id);

    return { vil, acc, live, tile, continent, hasExactCoord, x, y, villageRole };
  });

  const bounds =
    zoomMode === 'all'
      ? { minX: 400, maxX: 600, minY: 400, maxY: 600 }
      : zoomMode === 'fit'
        ? computeAutoFitBounds(parsedEntries.map((e) => ({ x: e.x, y: e.y })))
        : {
            minX: WORLD_MAP_CONTINENT_BY_CODE[zoomMode].minX,
            maxX: WORLD_MAP_CONTINENT_BY_CODE[zoomMode].maxX,
            minY: WORLD_MAP_CONTINENT_BY_CODE[zoomMode].minY,
            maxY: WORLD_MAP_CONTINENT_BY_CODE[zoomMode].maxY
          };

  const spanX = Math.max(1, bounds.maxX - bounds.minX);
  const spanY = Math.max(1, bounds.maxY - bounds.minY);
  const rawAxisXPct = ((500 - bounds.minX) / spanX) * 100;
  const rawAxisYPct = ((500 - bounds.minY) / spanY) * 100;
  const axisXPct =
    rawAxisXPct > 4 && rawAxisXPct < 96 ? Math.round(rawAxisXPct * 100) / 100 : null;
  const axisYPct =
    rawAxisYPct > 4 && rawAxisYPct < 96 ? Math.round(rawAxisYPct * 100) / 100 : null;

  const isSingleContinentZoom =
    zoomMode === '44' || zoomMode === '45' || zoomMode === '54' || zoomMode === '55';

  const rawPoints: WorldMapVillagePoint[] = parsedEntries.map(
    ({ vil, acc, live, tile, continent, hasExactCoord, x, y, villageRole }) => {
      const proj = projectWorldCoordToPct(
        x,
        y,
        isSingleContinentZoom ? zoomMode : 'all',
        bounds
      );
      const box = isSingleContinentZoom
        ? { minX: 2.6, maxX: 97.4, minY: 2.6, maxY: 97.4 }
        : getContinentClampBox(continent, axisXPct, axisYPct);

      const xPct = clampToBox(proj.xPct, box.minX, box.maxX);
      const yPct = clampToBox(proj.yPct, box.minY, box.maxY);
      const distanceFromCenter = Math.round(Math.hypot(x - 500, y - 500) * 10) / 10;

      return {
        villageId: vil.id,
        villageName: vil.name,
        accountName: acc?.name || 'بدون حساب',
        worldName: live.worldName,
        coordText: hasExactCoord ? `${x}|${y}` : `تقريبي K${continent}`,
        x,
        y,
        hasExactCoord,
        isOutOfBounds: proj.isOutOfBounds,
        continent,
        villageRole,
        xPct,
        yPct,
        distanceFromCenter,
        tone: tile.tone,
        statusLabel: tile.statusLabel,
        etaText: tile.etaText,
        maxWhPct: live.maxWhPct,
        dailyPP: Math.round(live.dailyPP * 10) / 10,
        unsoldPP: Math.round(live.unsoldPP * 10) / 10,
        sellableNowPP: Math.round(live.sellableNowPP * 10) / 10
      };
    }
  );

  // Sort deterministically by role (offense -> defense -> unset), then distance
  const roleOrder: Record<VillageRole, number> = { offense: 0, defense: 1, unset: 2 };
  rawPoints.sort((a, b) => {
    if (roleOrder[a.villageRole] !== roleOrder[b.villageRole]) {
      return roleOrder[a.villageRole] - roleOrder[b.villageRole];
    }
    if (a.distanceFromCenter !== b.distanceFromCenter) {
      return a.distanceFromCenter - b.distanceFromCenter;
    }
    return a.villageId.localeCompare(b.villageId);
  });

  const visibleSource = isSingleContinentZoom
    ? rawPoints.filter((p) => p.continent === zoomMode)
    : rawPoints;

  // Collision separation strictly WITHIN each continent's visual quadrant box so no pin ever crosses X=500 or Y=500
  const byContinent = new Map<WorldMapContinentCode, WorldMapVillagePoint[]>();
  for (const pt of visibleSource) {
    const arr = byContinent.get(pt.continent) || [];
    arr.push(pt);
    byContinent.set(pt.continent, arr);
  }

  const denseMap = visibleSource.length > 35;
  const dupRadius = denseMap ? 1.5 : isSingleContinentZoom ? 2.4 : 1.9;
  const minDist = denseMap ? 2.2 : isSingleContinentZoom ? 3.2 : 2.8;

  for (const [contCode, group] of byContinent.entries()) {
    const box = isSingleContinentZoom
      ? { minX: 2.6, maxX: 97.4, minY: 2.6, maxY: 97.4 }
      : getContinentClampBox(contCode, axisXPct, axisYPct);

    // 1. Spread exact coordinate duplicates cleanly
    const cellBuckets = new Map<string, WorldMapVillagePoint[]>();
    for (const pt of group) {
      const key = `${pt.x}_${pt.y}`;
      const bucket = cellBuckets.get(key) || [];
      bucket.push(pt);
      cellBuckets.set(key, bucket);
    }

    for (const bucket of cellBuckets.values()) {
      if (bucket.length <= 1) continue;
      bucket.forEach((pt, idx) => {
        const angle = (2 * Math.PI * idx) / bucket.length - Math.PI / 2;
        const ringScale = 1 + Math.floor(idx / 8) * 0.65;
        pt.xPct = clampToBox(pt.xPct + Math.cos(angle) * dupRadius * ringScale, box.minX, box.maxX);
        pt.yPct = clampToBox(pt.yPct + Math.sin(angle) * dupRadius * ringScale, box.minY, box.maxY);
      });
    }

    // 2. Gentle pairwise separation clamped strictly inside this continent's quadrant box
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const a = group[i];
          const b = group[j];
          const dx = b.xPct - a.xPct;
          const dy = b.yPct - a.yPct;
          const dist = Math.hypot(dx, dy);
          if (dist < minDist) {
            const ux = dist > 0.001 ? dx / dist : 1;
            const uy = dist > 0.001 ? dy / dist : 0;
            const push = (minDist - dist) / 2 + 0.05;
            a.xPct = clampToBox(a.xPct - ux * push, box.minX, box.maxX);
            a.yPct = clampToBox(a.yPct - uy * push, box.minY, box.maxY);
            b.xPct = clampToBox(b.xPct + ux * push, box.minX, box.maxX);
            b.yPct = clampToBox(b.yPct + uy * push, box.minY, box.maxY);
            moved = true;
          }
        }
      }
      if (!moved) break;
    }
  }

  const continents = WORLD_MAP_CONTINENTS.map((meta) => {
    const entry = continentSummaryMap[meta.code];
    return {
      ...entry,
      accountsCount: continentAccSets[meta.code].size,
      dailyPP: Math.round(entry.dailyPP * 10) / 10,
      unsoldPP: Math.round(entry.unsoldPP * 10) / 10,
      sellableNowPP: Math.round(entry.sellableNowPP * 10) / 10
    };
  });

  return {
    points: rawPoints,
    visiblePoints: visibleSource,
    continents,
    totalVillages: rawPoints.length,
    mappedExactCount,
    toneCounts,
    roleCounts,
    bounds,
    axisXPct,
    axisYPct
  };
}




