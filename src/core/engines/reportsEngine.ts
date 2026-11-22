import type { ErpAppState, ErpWorld } from '../types';
import { getCairoDateKey } from './ppFlowEngine';
import { computeVillageLiveStatus } from './resourceEngine';

export interface ReportFilters {
  search?: string;
  worldId?: string;
  continent?: string;
  accountId?: string;
  status?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export function filterAndSortProfitRows<T extends Record<string, any>>(
  rows: T[] = [],
  filters: ReportFilters = {}
): T[] {
  const search = String(filters.search || '').trim().toLowerCase();
  const worldId = String(filters.worldId || 'all');
  const continent = String(filters.continent || 'all');
  const accountId = String(filters.accountId || 'all');
  const status = String(filters.status || 'all');
  const sortBy = String(filters.sortBy || 'realized');
  const sortDir = String(filters.sortDir || 'desc') === 'asc' ? 1 : -1;

  const filtered = (Array.isArray(rows) ? rows : []).filter((r) => {
    if (!r) return false;
    const accId = String(r.accountId ?? r.acc?.id ?? '');
    const accName = String(r.accountName ?? r.acc?.name ?? '');
    const accIp = String(r.ip ?? r.acc?.ip ?? '');
    const worlds = Array.isArray(r.worldIds) ? r.worldIds.map(String) : [];
    const continents = Array.isArray(r.continents) ? r.continents.map(String) : [];

    if (accountId !== 'all' && accId !== accountId) return false;
    if (worldId !== 'all' && worlds.length > 0 && !worlds.includes(worldId)) return false;
    if (continent !== 'all' && continents.length > 0 && !continents.includes(continent)) return false;

    if (status === 'idle_scav' && !(Number(r.idleScavCount || 0) > 0)) return false;
    if (status === 'wh_risk' && !(Number(r.whRiskCount || 0) > 0)) return false;
    if (status === 'has_plan' && !(Number(r.plannedCount || 0) > 0)) return false;
    if (status === 'no_plan' && !(Number(r.unplannedCount || 0) > 0)) return false;
    if (status === 'ip_issue' && !r.hasIpIssue) return false;

    if (search) {
      const villageNames = Array.isArray(r.villageNames) ? r.villageNames.join(' ') : '';
      const hay = `${accName} ${accIp} ${villageNames}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  return filtered.sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'name') {
      const na = String(a.accountName ?? a.acc?.name ?? '');
      const nb = String(b.accountName ?? b.acc?.name ?? '');
      cmp = na.localeCompare(nb, 'ar');
    } else if (sortBy === 'vilsCount') {
      cmp = (Number(a.vilsCount) || 0) - (Number(b.vilsCount) || 0);
    } else if (sortBy === 'startPP') {
      cmp = (Number(a.startPP) || 0) - (Number(b.startPP) || 0);
    } else if (sortBy === 'curPP') {
      cmp = (Number(a.curPP) || 0) - (Number(b.curPP) || 0);
    } else if (sortBy === 'unsoldPP') {
      cmp = (Number(a.unsoldPP) || 0) - (Number(b.unsoldPP) || 0);
    } else if (sortBy === 'targetPP') {
      cmp = (Number(a.targetPP) || 0) - (Number(b.targetPP) || 0);
    } else if (sortBy === 'achievementPct') {
      cmp = (Number(a.achievementPct) || 0) - (Number(b.achievementPct) || 0);
    } else {
      cmp = (Number(a.realized) || 0) - (Number(b.realized) || 0);
    }
    if (cmp === 0) {
      cmp = (Number(a.targetPP) || 0) - (Number(b.targetPP) || 0);
    }
    return cmp * sortDir;
  });
}

export function filterAndSortEfficiencyRows<T extends Record<string, any>>(
  rows: T[] = [],
  filters: ReportFilters = {}
): T[] {
  const search = String(filters.search || '').trim().toLowerCase();
  const worldId = String(filters.worldId || 'all');
  const continent = String(filters.continent || 'all');
  const accountId = String(filters.accountId || 'all');
  const status = String(filters.status || 'all');
  const sortBy = String(filters.sortBy || 'dailyPP');
  const sortDir = String(filters.sortDir || 'desc') === 'asc' ? 1 : -1;

  const filtered = (Array.isArray(rows) ? rows : []).filter((r) => {
    if (!r) return false;
    const v = r.vil || {};
    const vWorld = String(r.worldId ?? v.worldId ?? '');
    const vCont = String(r.continent ?? v.continent ?? '');
    const vAccId = String(r.accountId ?? v.accountId ?? '');

    if (worldId !== 'all' && vWorld !== worldId) return false;
    if (continent !== 'all' && vCont !== continent) return false;
    if (accountId !== 'all' && vAccId !== accountId) return false;

    if (status === 'idle_scav' && !r.scavIdle) return false;
    if (status === 'wh_risk' && !r.whRisk) return false;
    if (status === 'has_plan' && !r.hasPlan) return false;
    if (status === 'no_plan' && r.hasPlan) return false;

    if (search) {
      const hay = `${v.name || ''} ${v.coord || ''} ${r.accName || ''} ${r.worldName || ''} k${vCont} ${r.advice || ''}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  return filtered.sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'name') {
      cmp = String(a.vil?.name || '').localeCompare(String(b.vil?.name || ''), 'ar');
    } else if (sortBy === 'accName') {
      cmp = String(a.accName || '').localeCompare(String(b.accName || ''), 'ar');
    } else if (sortBy === 'totalHourly') {
      cmp = (Number(a.totalHourly) || 0) - (Number(b.totalHourly) || 0);
    } else if (sortBy === 'minHoursLeft') {
      cmp = (Number(a.minHoursLeft) || 0) - (Number(b.minHoursLeft) || 0);
    } else if (sortBy === 'maxWhPct') {
      cmp = (Number(a.maxWhPct) || 0) - (Number(b.maxWhPct) || 0);
    } else if (sortBy === 'haulCap') {
      cmp = (Number(a.haulCap) || 0) - (Number(b.haulCap) || 0);
    } else if (sortBy === 'points') {
      cmp =
        (Number(a.points ?? a.vil?.villagePoints) || 0) -
        (Number(b.points ?? b.vil?.villagePoints) || 0);
    } else {
      cmp = (Number(a.dailyPP) || 0) - (Number(b.dailyPP) || 0);
    }
    if (cmp === 0) {
      cmp = (Number(a.totalHourly) || 0) - (Number(b.totalHourly) || 0);
    }
    return cmp * sortDir;
  });
}

export function filterAndSortSecurityRows<T extends Record<string, any>>(
  rows: T[] = [],
  filters: ReportFilters = {}
): T[] {
  const search = String(filters.search || '').trim().toLowerCase();
  const worldId = String(filters.worldId || 'all');
  const continent = String(filters.continent || 'all');
  const accountId = String(filters.accountId || 'all');
  const status = String(filters.status || 'all');
  const sortBy = String(filters.sortBy || 'riskScore');
  const sortDir = String(filters.sortDir || 'desc') === 'asc' ? 1 : -1;

  const filtered = (Array.isArray(rows) ? rows : []).filter((r) => {
    if (!r) return false;
    const accId = String(r.accountId ?? r.acc?.id ?? '');
    const worlds = Array.isArray(r.worldIds) ? r.worldIds.map(String) : [];
    const continents = Array.isArray(r.continents) ? r.continents.map(String) : [];

    if (accountId !== 'all' && accId !== accountId) return false;
    if (worldId !== 'all' && worlds.length > 0 && !worlds.includes(worldId)) return false;
    if (continent !== 'all' && continents.length > 0 && !continents.includes(continent)) return false;

    if (status === 'ip_issue' && !(r.isCol || !r.hasIp)) return false;
    if (status === 'idle_scav' && !(Number(r.idleScavCount || 0) > 0)) return false;
    if (status === 'wh_risk' && !(Number(r.whRiskCount || 0) > 0)) return false;

    if (search) {
      const hay = `${r.acc?.name || ''} ${r.ip || ''} ${(r.wNames || []).join(' ')}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  return filtered.sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'name') {
      cmp = String(a.acc?.name || '').localeCompare(String(b.acc?.name || ''), 'ar');
    } else if (sortBy === 'ip') {
      cmp = String(a.ip || '').localeCompare(String(b.ip || ''), 'en');
    } else if (sortBy === 'histCount') {
      cmp = (Number(a.histCount) || 0) - (Number(b.histCount) || 0);
    } else if (sortBy === 'lastSyncTime') {
      cmp = (Number(a.lastSyncTime) || 0) - (Number(b.lastSyncTime) || 0);
    } else if (sortBy === 'vilsCount') {
      cmp = (Number(a.vilsCount) || 0) - (Number(b.vilsCount) || 0);
    } else {
      cmp = (Number(a.riskScore) || 0) - (Number(b.riskScore) || 0);
    }
    return cmp * sortDir;
  });
}

export interface WorldComparisonRow {
  worldId: string;
  worldName: string;
  speed: number;
  tradeEnded: boolean;
  tradeEndedAt: number | null;
  accountsCount: number;
  villagesCount: number;
  totalEarnedPP: number;
  estimatedAutoPP: number;
  hasCustomSummaryPP: boolean;
  todayEarnedPP: number;
  liveDailyExpectedPP: number;
  ppPerAccount: number;
  ppPerVillage: number;
  deltaVsPrevPP: number | null;
  deltaVsPrevPct: number | null;
}

/**
 * Estimates total PP earned on a specific world from recorded daily sessions
 * (or account PP balances as fallback), prorating cleanly if an account holds
 * villages across multiple worlds.
 */
export function estimateWorldTotalPP(
  state: ErpAppState,
  worldId: string
): { totalPP: number; todayPP: number; accountsCount: number; villagesCount: number } {
  const worldVillages = (state.villages || []).filter((v) => v.worldId === worldId);
  const villagesCount = worldVillages.length;
  const accountVillageCountInWorld = new Map<string, number>();
  worldVillages.forEach((v) => {
    accountVillageCountInWorld.set(v.accountId, (accountVillageCountInWorld.get(v.accountId) || 0) + 1);
  });

  const accountTotalVillages = new Map<string, number>();
  (state.villages || []).forEach((v) => {
    accountTotalVillages.set(v.accountId, (accountTotalVillages.get(v.accountId) || 0) + 1);
  });

  const accountIds = Array.from(accountVillageCountInWorld.keys());
  const accountsCount = accountIds.length;
  if (accountsCount === 0) {
    return { totalPP: 0, todayPP: 0, accountsCount: 0, villagesCount: 0 };
  }

  const todayKey = getCairoDateKey(Date.now());
  let sessionSumPP = 0;
  let todaySumPP = 0;
  let hasSessionHistory = false;

  const dailySessions = state.dailySessions || {};
  Object.entries(dailySessions).forEach(([dateKey, byAcc]) => {
    if (!byAcc || typeof byAcc !== 'object') return;
    accountIds.forEach((accId) => {
      const entry = byAcc[accId];
      if (!entry) return;
      const inWorld = accountVillageCountInWorld.get(accId) || 0;
      const totalV = Math.max(1, accountTotalVillages.get(accId) || 1);
      const share = inWorld / totalV;
      const delta = (Number(entry.lastSyncedPP) || 0) - (Number(entry.startPP) || 0);
      if (Number.isFinite(delta)) {
        hasSessionHistory = true;
        if (delta > 0) sessionSumPP += delta * share;
        if (dateKey === todayKey) todaySumPP += delta * share;
      }
    });
  });

  let balanceFallbackPP = 0;
  accountIds.forEach((accId) => {
    const acc = (state.userAccounts || []).find((a) => a.id === accId);
    if (!acc) return;
    const inWorld = accountVillageCountInWorld.get(accId) || 0;
    const totalV = Math.max(1, accountTotalVillages.get(accId) || 1);
    balanceFallbackPP += (Number(acc.pp) || 0) * (inWorld / totalV);
  });

  const totalPP = Math.round(hasSessionHistory && sessionSumPP > 0 ? sessionSumPP : balanceFallbackPP);
  return {
    totalPP: Math.max(0, totalPP),
    todayPP: Math.round(todaySumPP),
    accountsCount,
    villagesCount
  };
}

export function buildWorldComparisonReport(
  state: ErpAppState,
  nowMs: number = Date.now()
): WorldComparisonRow[] {
  const worlds: ErpWorld[] = Array.isArray(state.worlds) ? state.worlds : [];
  const rawRows: WorldComparisonRow[] = worlds.map((w) => {
    const est = estimateWorldTotalPP(state, w.id);
    const hasCustomSummaryPP =
      w.tradeSummaryPP !== undefined &&
      w.tradeSummaryPP !== null &&
      Number.isFinite(Number(w.tradeSummaryPP));
    const totalEarnedPP = hasCustomSummaryPP ? Math.max(0, Math.round(Number(w.tradeSummaryPP))) : est.totalPP;

    let liveDailyExpectedPP = 0;
    if (!w.tradeEnded) {
      (state.villages || [])
        .filter((v) => v.worldId === w.id)
        .forEach((vil) => {
          const live = computeVillageLiveStatus(vil, state, nowMs);
          liveDailyExpectedPP += Number(live.dailyPP) || 0;
        });
    }

    return {
      worldId: w.id,
      worldName: w.name,
      speed: Number(w.speed || 1),
      tradeEnded: Boolean(w.tradeEnded),
      tradeEndedAt: w.tradeEndedAt ?? null,
      accountsCount: est.accountsCount,
      villagesCount: est.villagesCount,
      totalEarnedPP,
      estimatedAutoPP: est.totalPP,
      hasCustomSummaryPP,
      todayEarnedPP: est.todayPP,
      liveDailyExpectedPP: Math.round(liveDailyExpectedPP * 10) / 10,
      ppPerAccount: est.accountsCount > 0 ? Math.round((totalEarnedPP / est.accountsCount) * 10) / 10 : 0,
      ppPerVillage: est.villagesCount > 0 ? Math.round((totalEarnedPP / est.villagesCount) * 10) / 10 : 0,
      deltaVsPrevPP: null,
      deltaVsPrevPct: null
    };
  });

  // Compute delta vs previous world in chronological/list order for side-by-side comparison
  for (let i = 1; i < rawRows.length; i++) {
    const prev = rawRows[i - 1];
    const curr = rawRows[i];
    if (prev.totalEarnedPP > 0) {
      curr.deltaVsPrevPP = curr.totalEarnedPP - prev.totalEarnedPP;
      curr.deltaVsPrevPct = Math.round(((curr.totalEarnedPP - prev.totalEarnedPP) / prev.totalEarnedPP) * 1000) / 10;
    }
  }

  return rawRows;
}
