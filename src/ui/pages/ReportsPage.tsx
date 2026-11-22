import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownUp,
  BarChart2,
  Check,
  Coins,
  Edit3,
  ExternalLink,
  Globe,
  Lock,
  RotateCcw,
  Search,
  ShieldAlert,
  TrendingUp,
  X
} from 'lucide-react';
import {
  auditAccountsSecurity,
  buildSecurityAuditRows,
  buildWorldComparisonReport,
  computeVillageLiveStatus,
  filterAndSortEfficiencyRows,
  filterAndSortProfitRows,
  filterAndSortSecurityRows,
  FIXED_CONTINENTS,
  formatHoursArabic,
  formatPPAndCurrency,
  formatTimeAgo,
  type ErpAppState,
  type ReportTabId
} from '../../core';
import type { MutationResult } from '../../data';
import type { WorldInput } from '../../validation';
import {
  buildDashboardDailyFlow,
  buildDashboardResourcesAndAttacksSeries,
  buildEfficiencyReportRows,
  buildProfitReportRows
} from '../viewModels';
import { IpCollisionGraphSvg } from '../components/TacticalWidgets';
import { WeeklyFlowBarChart } from '../components/charts/WeeklyFlowBarChart';
import { ResourcesAttacksRechart } from '../components/charts/ResourcesAttacksRechart';

interface ReportsPageProps {
  state: ErpAppState;
  searchUrl: string;
  navigate: (path: string) => void;
  onSaveWorld?: (input: Partial<WorldInput>) => MutationResult;
  onPushToast?: (msg: string, tone?: 'info' | 'success' | 'warn' | 'danger') => void;
  onOpenPPFlowModal: (accountId: string) => void;
  onOpenAccountModal: (accountId: string) => void;
  onOpenVillageModal: (villageId: string) => void;
}

export function ReportsPage({
  state,
  searchUrl,
  navigate,
  onSaveWorld,
  onPushToast,
  onOpenPPFlowModal,
  onOpenAccountModal,
  onOpenVillageModal
}: ReportsPageProps) {
  const urlTab = useMemo(() => {
    const raw = new URLSearchParams(searchUrl).get('tab');
    return raw === 'security' ||
      raw === 'efficiency' ||
      raw === 'profit' ||
      raw === 'analytics' ||
      raw === 'worlds'
      ? raw
      : 'profit';
  }, [searchUrl]);

  const [tab, setTab] = useState<ReportTabId>(urlTab);
  useEffect(() => {
    setTab(urlTab);
  }, [urlTab]);

  const [editingWorldId, setEditingWorldId] = useState<string | null>(null);
  const [editingWorldPP, setEditingWorldPP] = useState('');

  const [search, setSearch] = useState('');
  const [worldId, setWorldId] = useState('all');
  const [continent, setContinent] = useState('all');
  const [accountId, setAccountId] = useState('all');
  const [status, setStatus] = useState('all');
  const [sortBy, setSortBy] = useState<string>('realized');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [analyticsRangeDays, setAnalyticsRangeDays] = useState<7 | 14>(7);
  const [rechartsAccountId, setRechartsAccountId] = useState<string>('all');

  function handleTabSwitch(nextTab: ReportTabId) {
    setTab(nextTab);
    setStatus('all');
    if (nextTab === 'profit') setSortBy('realized');
    else if (nextTab === 'efficiency') setSortBy('dailyPP');
    else setSortBy('riskScore');
    setSortDir('desc');
    navigate(nextTab === 'profit' ? '/reports' : `/reports?tab=${nextTab}`);
  }

  function resetFilters() {
    setSearch('');
    setWorldId('all');
    setContinent('all');
    setAccountId('all');
    setStatus('all');
    setRechartsAccountId('all');
    setSortBy(tab === 'profit' ? 'realized' : tab === 'efficiency' ? 'dailyPP' : 'riskScore');
    setSortDir('desc');
  }

  const collisions = useMemo(() => auditAccountsSecurity(state), [state]);

  const profitRows = useMemo(() => {
    const base = buildProfitReportRows(state);
    return filterAndSortProfitRows(base, {
      search,
      worldId,
      continent,
      accountId,
      status,
      sortBy,
      sortDir
    });
  }, [state, search, worldId, continent, accountId, status, sortBy, sortDir]);

  const efficiencyRows = useMemo(() => {
    const base = buildEfficiencyReportRows(state);
    return filterAndSortEfficiencyRows(base, {
      search,
      worldId,
      continent,
      accountId,
      status,
      sortBy,
      sortDir
    });
  }, [state, search, worldId, continent, accountId, status, sortBy, sortDir]);

  const securityRows = useMemo(() => {
    const base = buildSecurityAuditRows(state);
    return filterAndSortSecurityRows(base, {
      search,
      worldId,
      continent,
      accountId,
      status,
      sortBy,
      sortDir
    });
  }, [state, search, worldId, continent, accountId, status, sortBy, sortDir]);

  const scopedAnalyticsVillages = useMemo(() => {
    const nowMs = Date.now();
    const q = search.trim().toLowerCase();
    return state.villages
      .map((vil) => {
        const acc = state.userAccounts.find((a) => a.id === vil.accountId) || null;
        const live = computeVillageLiveStatus(vil, state, nowMs);
        return { vil, acc, live };
      })
      .filter(({ vil, acc, live }) => {
        if (worldId !== 'all' && vil.worldId !== worldId) return false;
        if (continent !== 'all' && String(vil.continent || '44') !== continent) return false;
        if (accountId !== 'all' && (acc?.id || vil.accountId) !== accountId) return false;
        if (q) {
          const hay = `${vil.name} ${vil.coord || ''} ${acc?.name || ''} ${live.worldName} k${vil.continent}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
  }, [state, search, worldId, continent, accountId]);

  const scopedAnalyticsAccountIds = useMemo(() => {
    const hasFilter =
      worldId !== 'all' || continent !== 'all' || accountId !== 'all' || search.trim() !== '';
    if (!hasFilter && rechartsAccountId === 'all') return undefined;
    const ids = new Set<string>();
    if (accountId !== 'all') {
      ids.add(accountId);
    } else if (rechartsAccountId !== 'all') {
      ids.add(rechartsAccountId);
    } else {
      scopedAnalyticsVillages.forEach((v) => {
        const aid = v.acc?.id || v.vil.accountId;
        if (aid) ids.add(aid);
      });
    }
    return ids;
  }, [worldId, continent, accountId, search, rechartsAccountId, scopedAnalyticsVillages]);

  const dailyFlowSummary = useMemo(
    () => buildDashboardDailyFlow(state, analyticsRangeDays, scopedAnalyticsAccountIds),
    [state, analyticsRangeDays, scopedAnalyticsAccountIds]
  );

  const effectiveResAccountId = accountId !== 'all' ? accountId : rechartsAccountId;
  const resAttacksSummary = useMemo(
    () =>
      buildDashboardResourcesAndAttacksSeries(
        state,
        scopedAnalyticsVillages,
        analyticsRangeDays,
        effectiveResAccountId
      ),
    [state, scopedAnalyticsVillages, analyticsRangeDays, effectiveResAccountId]
  );

  const worldComparisonRows = useMemo(() => buildWorldComparisonReport(state), [state]);

  function handleSaveWorldSummaryPP(worldId: string) {
    if (!onSaveWorld) return;
    const w = state.worlds.find((item) => item.id === worldId);
    if (!w) return;
    const nextPP = Math.max(0, Math.round(Number(editingWorldPP) || 0));
    const res = onSaveWorld({
      id: w.id,
      name: w.name,
      speed: w.speed,
      tradeEnded: w.tradeEnded,
      tradeSummaryPP: nextPP
    });
    if (res.ok) {
      onPushToast?.(`تم تحديث إجمالي نقاط ${w.name} إلى ${nextPP.toLocaleString('en-US')} نقطة`, 'success');
      setEditingWorldId(null);
    } else {
      onPushToast?.('تعذر حفظ إجمالي النقاط', 'danger');
    }
  }

  const totalRealizedPP = useMemo(
    () => profitRows.reduce((s, r) => s + (Number(r.realized) || 0), 0),
    [profitRows]
  );

  const totalRealizedFmt = formatPPAndCurrency(totalRealizedPP, state, {
    decimals: 1,
    unit: 'نقطة',
    showSign: true
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[20px] sm:text-[22px] font-bold tracking-tight text-[var(--nx-text-primary)]">
            التقارير والتحليل والأمان
          </h1>
          <p className="text-xs text-[var(--nx-text-muted)]">
            تقارير أرباح الحسابات، كفاءة القرى والمخازن، وتدقيق الـ IP والارتباط الأمني
          </p>
        </div>

        <div className="font-mono-num rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] bg-[var(--nx-bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--nx-text-secondary)]">
          صافي أرباح اليوم المصفاة:{' '}
          <span className="font-bold text-[var(--nx-indigo)]">{totalRealizedFmt.ppText}</span>
          {' / '}
          <span className="font-bold text-[var(--nx-text-primary)]">{totalRealizedFmt.moneyText}</span>
        </div>
      </div>

      {/* Report Sub-Tabs */}
      <div
        role="tablist"
        aria-label="أقسام التقارير"
        className="flex flex-wrap items-center gap-1.5 border-b border-[var(--nx-border)] pb-2"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'profit'}
          onClick={() => handleTabSwitch('profit')}
          className={`nx-btn min-h-[40px] border px-3.5 py-1.5 text-xs font-bold ${
            tab === 'profit'
              ? 'border-[var(--nx-indigo)] bg-[var(--nx-indigo-soft)] text-[var(--nx-indigo)]'
              : 'border-transparent text-[var(--nx-text-muted)] hover:bg-[var(--nx-bg-hover)] hover:text-[var(--nx-text-primary)]'
          }`}
        >
          <Coins className="h-4 w-4" aria-hidden="true" />
          <span>أرباح الحسابات ({profitRows.length})</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={tab === 'efficiency'}
          onClick={() => handleTabSwitch('efficiency')}
          className={`nx-btn min-h-[40px] border px-3.5 py-1.5 text-xs font-bold ${
            tab === 'efficiency'
              ? 'border-[var(--nx-indigo)] bg-[var(--nx-indigo-soft)] text-[var(--nx-indigo)]'
              : 'border-transparent text-[var(--nx-text-muted)] hover:bg-[var(--nx-bg-hover)] hover:text-[var(--nx-text-primary)]'
          }`}
        >
          <BarChart2 className="h-4 w-4" aria-hidden="true" />
          <span>كفاءة القرى والمخازن ({efficiencyRows.length})</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={tab === 'security'}
          onClick={() => handleTabSwitch('security')}
          className={`nx-btn min-h-[40px] border px-3.5 py-1.5 text-xs font-bold ${
            tab === 'security'
              ? 'border-[var(--nx-indigo)] bg-[var(--nx-indigo-soft)] text-[var(--nx-indigo)]'
              : 'border-transparent text-[var(--nx-text-muted)] hover:bg-[var(--nx-bg-hover)] hover:text-[var(--nx-text-primary)]'
          }`}
        >
          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
          <span>الأمان وعناوين IP ({securityRows.length})</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={tab === 'analytics'}
          onClick={() => handleTabSwitch('analytics')}
          className={`nx-btn min-h-[40px] border px-3.5 py-1.5 text-xs font-bold ${
            tab === 'analytics'
              ? 'border-[var(--nx-indigo)] bg-[var(--nx-indigo-soft)] text-[var(--nx-indigo)]'
              : 'border-transparent text-[var(--nx-text-muted)] hover:bg-[var(--nx-bg-hover)] hover:text-[var(--nx-text-primary)]'
          }`}
        >
          <Activity className="h-4 w-4" aria-hidden="true" />
          <span>التحليل والمنحنيات</span>
        </button>

        <button
          type="button"
          role="tab"
          data-testid="tab-worlds-compare"
          aria-selected={tab === 'worlds'}
          onClick={() => handleTabSwitch('worlds')}
          className={`nx-btn min-h-[40px] border px-3.5 py-1.5 text-xs font-bold ${
            tab === 'worlds'
              ? 'border-[var(--nx-indigo)] bg-[var(--nx-indigo-soft)] text-[var(--nx-indigo)]'
              : 'border-transparent text-[var(--nx-text-muted)] hover:bg-[var(--nx-bg-hover)] hover:text-[var(--nx-text-primary)]'
          }`}
        >
          <Globe className="h-4 w-4" aria-hidden="true" />
          <span>مقارنة العوالم ({state.worlds.length})</span>
        </button>
      </div>

      {/* Filter and Search Bar (hidden in worlds comparison tab) */}
      {tab !== 'worlds' && (
      <div className="flex flex-wrap items-center gap-2 rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] bg-[var(--nx-bg-surface)] p-2.5">
        <div className="relative min-w-[200px] flex-1">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--nx-text-muted)]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو الإحداثية أو IP..."
            className="nx-input nx-input-compact min-h-[38px] w-full ps-9 text-xs"
          />
        </div>

        <select
          aria-label="تصفية بالعالم"
          value={worldId}
          onChange={(e) => setWorldId(e.target.value)}
          className="nx-select nx-select-compact min-h-[38px] !w-full sm:!w-auto sm:min-w-[115px]"
        >
          <option value="all">كل العوالم</option>
          {state.worlds.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>

        <select
          aria-label="تصفية بالقارة"
          value={continent}
          onChange={(e) => setContinent(e.target.value)}
          className="nx-select nx-select-compact min-h-[38px] !w-full sm:!w-auto sm:min-w-[105px]"
        >
          <option value="all">كل القارات</option>
          {FIXED_CONTINENTS.map((c) => (
            <option key={c} value={c}>
              قارة K{c}
            </option>
          ))}
        </select>

        <select
          aria-label="تصفية بالحساب"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="nx-select nx-select-compact min-h-[38px] !w-full sm:!w-auto sm:min-w-[125px]"
        >
          <option value="all">كل الحسابات</option>
          {state.userAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>

        {tab !== 'analytics' && (
          <select
            aria-label="تصفية بالحالة"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="nx-select nx-select-compact min-h-[38px] !w-full sm:!w-auto sm:min-w-[115px]"
          >
            <option value="all">كل الحالات</option>
            <option value="wh_risk">تحذير مخزن</option>
            <option value="idle_scav">إغارة متوقفة</option>
            {tab === 'security' || tab === 'profit' ? (
              <option value="ip_issue">مشكلة أو تضارب IP</option>
            ) : null}
            {tab !== 'security' ? (
              <>
                <option value="has_plan">بخطة تطوير</option>
                <option value="no_plan">بدون خطة</option>
              </>
            ) : null}
          </select>
        )}

        <div className="flex shrink-0 items-center gap-1.5">
          {tab !== 'analytics' && (
            <>
              <select
                aria-label="الترتيب حسب"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="nx-select nx-select-compact min-h-[38px] !w-auto min-w-[115px]"
              >
                {tab === 'profit' ? (
                  <>
                    <option value="realized">صافي اليوم</option>
                    <option value="curPP">الرصيد الحالي</option>
                    <option value="targetPP">الهدف اليومي</option>
                    <option value="achievementPct">نسبة الإنجاز</option>
                    <option value="unsoldPP">غير المباع</option>
                    <option value="vilsCount">عدد القرى</option>
                    <option value="name">الاسم</option>
                  </>
                ) : tab === 'efficiency' ? (
                  <>
                    <option value="dailyPP">العائد اليومي</option>
                    <option value="maxWhPct">امتلاء المخزن</option>
                    <option value="minHoursLeft">أقل ساعات للامتلاء</option>
                    <option value="totalHourly">الإنتاج/س</option>
                    <option value="haulCap">الحمولة</option>
                    <option value="points">النقاط</option>
                    <option value="name">اسم القرية</option>
                  </>
                ) : (
                  <>
                    <option value="riskScore">درجة الخطورة</option>
                    <option value="lastSyncTime">آخر مزامنة</option>
                    <option value="histCount">سجلات الدخول</option>
                    <option value="vilsCount">عدد القرى</option>
                    <option value="ip">عنوان IP</option>
                    <option value="name">الاسم</option>
                  </>
                )}
              </select>

              <button
                type="button"
                onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
                aria-label="عكس اتجاه الترتيب"
                className="nx-btn nx-btn-outline nx-btn-compact min-h-[38px] px-2.5"
              >
                <ArrowDownUp className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={resetFilters}
            aria-label="إعادة ضبط الفلاتر"
            className="nx-btn nx-btn-outline nx-btn-compact min-h-[38px] px-2.5"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
      )}

      {/* Tab 1: Profit Report */}
      {tab === 'profit' && (
        <div className="nx-card overflow-hidden">
          {profitRows.length === 0 ? (
            <div className="p-8 text-center text-sm text-[var(--nx-text-muted)]">
              لا توجد حسابات مطابقة لمعايير التصفية الحالية.
            </div>
          ) : (
            <>
              {/* Mobile View: Clean Touch Cards */}
              <div className="divide-y divide-[var(--nx-border)] md:hidden">
                {profitRows.map((row) => {
                  const curFmt = formatPPAndCurrency(row.curPP, state, { decimals: 0, unit: 'نقطة' });
                  const startFmt = formatPPAndCurrency(row.startPP, state, { decimals: 0, unit: 'نقطة' });
                  const realizedFmt = formatPPAndCurrency(row.realized, state, {
                    decimals: 1,
                    unit: 'نقطة',
                    showSign: true
                  });
                  const unsoldFmt = formatPPAndCurrency(row.unsoldPP, state, {
                    decimals: 1,
                    unit: 'نقطة'
                  });
                  const targetFmt = formatPPAndCurrency(row.targetPP, state, {
                    decimals: 0,
                    unit: 'نقطة'
                  });
                  return (
                    <div key={row.accountId} className="space-y-2.5 p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <button
                            type="button"
                            onClick={() => onOpenPPFlowModal(row.accountId)}
                            className="text-sm font-bold text-[var(--nx-text-primary)] hover:text-[var(--nx-indigo)]"
                          >
                            {row.accountName}
                          </button>
                          <div className="text-[11px] text-[var(--nx-text-muted)]">
                            <span dir="ltr" className="font-mono-num">{row.ip || 'بدون IP'}</span>
                            <span> · {row.vilsCount} قرية</span>
                            {row.hasIpIssue && (
                              <span className="ms-1 font-semibold text-[var(--nx-coral)]">· تعارض IP</span>
                            )}
                          </div>
                        </div>
                        <div className="text-end">
                          <span
                            className={`font-mono-num text-sm font-bold ${
                              row.realized > 0
                                ? 'text-[var(--nx-emerald)]'
                                : row.realized < 0
                                  ? 'text-[var(--nx-coral)]'
                                  : 'text-[var(--nx-text-secondary)]'
                            }`}
                          >
                            {realizedFmt.combinedText}
                          </span>
                          <div className="font-mono-num text-xs text-[var(--nx-text-muted)]">
                            صافي ربح اليوم
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 rounded-[var(--nx-radius-sm)] bg-[var(--nx-bg-subtle)] p-2.5 text-center text-xs">
                        <div>
                          <div className="text-[11px] text-[var(--nx-text-muted)]">الرصيد الحالي</div>
                          <div className="font-mono-num font-bold text-[var(--nx-indigo)]">{curFmt.ppText}</div>
                          <div className="font-mono-num text-[11px] text-[var(--nx-text-muted)]">{curFmt.moneyText}</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-[var(--nx-text-muted)]">بداية اليوم</div>
                          <div className="font-mono-num font-semibold text-[var(--nx-text-secondary)]">{startFmt.ppText}</div>
                          <div className="font-mono-num text-[11px] text-[var(--nx-text-muted)]">{startFmt.moneyText}</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-[var(--nx-text-muted)]">غير مباع</div>
                          <div className="font-mono-num font-semibold text-[var(--nx-text-secondary)]">{unsoldFmt.ppText}</div>
                          <div className="font-mono-num text-[11px] text-[var(--nx-text-muted)]">{unsoldFmt.moneyText}</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between text-[11px] text-[var(--nx-text-muted)]">
                            <span>الإنجاز: {row.achievementPct}%</span>
                            <span>الهدف: {targetFmt.ppText}</span>
                          </div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--nx-bg-muted)]">
                            <div
                              className="h-full rounded-full bg-[var(--nx-indigo)]"
                              style={{ width: `${Math.min(100, row.achievementPct)}%` }}
                            />
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5 ps-2">
                          <button
                            type="button"
                            onClick={() => onOpenPPFlowModal(row.accountId)}
                            className="nx-btn nx-btn-outline min-h-[36px] px-2.5 py-1 text-xs"
                          >
                            <TrendingUp className="h-3.5 w-3.5 text-[var(--nx-indigo)]" aria-hidden="true" />
                            <span>التدفق</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop View: Full Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full border-collapse text-start text-sm">
                  <thead>
                    <tr className="border-b border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] text-[11px] font-semibold text-[var(--nx-text-muted)]">
                      <th className="px-4 py-3 text-start">الحساب</th>
                      <th className="px-3 py-3 text-start">القرى</th>
                      <th className="px-3 py-3 text-start">الرصيد الحالي</th>
                      <th className="px-3 py-3 text-start">بداية اليوم</th>
                      <th className="px-3 py-3 text-start">صافي اليوم</th>
                      <th className="px-3 py-3 text-start">غير مباع</th>
                      <th className="px-3 py-3 text-start">الهدف / الإنجاز (محقق + متاح)</th>
                      <th className="px-4 py-3 text-end">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--nx-border)]">
                    {profitRows.map((row) => {
                      const curFmt = formatPPAndCurrency(row.curPP, state, { decimals: 0, unit: 'نقطة' });
                      const startFmt = formatPPAndCurrency(row.startPP, state, { decimals: 0, unit: 'نقطة' });
                      const realizedFmt = formatPPAndCurrency(row.realized, state, {
                        decimals: 1,
                        unit: 'نقطة',
                        showSign: true
                      });
                      const unsoldFmt = formatPPAndCurrency(row.unsoldPP, state, {
                        decimals: 1,
                        unit: 'نقطة'
                      });
                      const targetFmt = formatPPAndCurrency(row.targetPP, state, {
                        decimals: 0,
                        unit: 'نقطة'
                      });
                      const effectiveFmt = formatPPAndCurrency(row.effectivePP, state, {
                        decimals: 1,
                        unit: 'نقطة'
                      });
                      return (
                        <tr key={row.accountId} className="nx-transition hover:bg-[var(--nx-bg-hover)]">
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => onOpenPPFlowModal(row.accountId)}
                              className="cursor-pointer font-bold text-[var(--nx-text-primary)] hover:text-[var(--nx-indigo)]"
                            >
                              {row.accountName}
                            </button>
                            <div className="text-[11px] text-[var(--nx-text-muted)]">
                              <span dir="ltr" className="font-mono-num">
                                {row.ip || 'بدون IP'}
                              </span>
                              {row.hasIpIssue && (
                                <span className="ms-1.5 font-semibold text-[var(--nx-coral)]">· تنبيه IP</span>
                              )}
                            </div>
                          </td>
                          <td className="font-mono-num px-3 py-3 font-semibold">{row.vilsCount}</td>
                          <td className="px-3 py-3">
                            <div className="font-mono-num font-bold text-[var(--nx-indigo)]">
                              {curFmt.ppText}
                            </div>
                            <div className="font-mono-num text-[11px] text-[var(--nx-text-muted)]">
                              {curFmt.moneyText}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="font-mono-num text-xs font-semibold text-[var(--nx-text-secondary)]">
                              {startFmt.ppText}
                            </div>
                            <div className="font-mono-num text-[11px] text-[var(--nx-text-muted)]">
                              {startFmt.moneyText}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={`font-mono-num font-bold ${
                                row.realized > 0
                                  ? 'text-[var(--nx-emerald)]'
                                  : row.realized < 0
                                    ? 'text-[var(--nx-coral)]'
                                    : 'text-[var(--nx-text-secondary)]'
                              }`}
                            >
                              {realizedFmt.ppText}
                            </span>
                            <div className="font-mono-num text-[11px] text-[var(--nx-text-muted)]">
                              {realizedFmt.moneyText}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="font-mono-num text-xs font-semibold text-[var(--nx-text-secondary)]">
                              {unsoldFmt.ppText}
                            </div>
                            <div className="font-mono-num text-[11px] text-[var(--nx-text-muted)]">
                              {unsoldFmt.moneyText}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="font-mono-num text-xs font-semibold">
                              {row.achievementPct}% من {targetFmt.combinedText}
                            </div>
                            {row.effectivePP > 0 && Math.abs(row.effectivePP - row.realized) >= 0.1 && (
                              <div className="font-mono-num mt-0.5 text-[10px] text-[var(--nx-text-muted)]">
                                محقق + متاح: {effectiveFmt.combinedText}
                              </div>
                            )}
                            <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-[var(--nx-bg-muted)]">
                              <div
                                className="h-full rounded-full bg-[var(--nx-indigo)]"
                                style={{ width: `${Math.min(100, row.achievementPct)}%` }}
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3 text-end">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => onOpenPPFlowModal(row.accountId)}
                                className="nx-btn nx-btn-outline nx-btn-compact"
                              >
                                <TrendingUp className="h-3.5 w-3.5 text-[var(--nx-indigo)]" aria-hidden="true" />
                                <span>التدفق</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => navigate(`/accounts/${encodeURIComponent(row.accountId)}`)}
                                aria-label={`فتح صفحة تدفق ${row.accountName}`}
                                className="nx-btn nx-btn-outline nx-btn-compact !px-2"
                              >
                                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab 2: Efficiency Report */}
      {tab === 'efficiency' && (
        <div className="nx-card overflow-hidden">
          {efficiencyRows.length === 0 ? (
            <div className="p-8 text-center text-sm text-[var(--nx-text-muted)]">
              لا توجد قرى مطابقة لمعايير التصفية الحالية.
            </div>
          ) : (
            <>
              {/* Mobile View: Clean Touch Cards */}
              <div className="divide-y divide-[var(--nx-border)] md:hidden">
                {efficiencyRows.map((row) => {
                  const dFmt = formatPPAndCurrency(row.dailyPP, state, {
                    decimals: 1,
                    unit: 'نقطة',
                    perDay: true
                  });
                  return (
                    <div key={row.villageId} className="space-y-2.5 p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <button
                            type="button"
                            onClick={() => navigate(`/villages/${encodeURIComponent(row.villageId)}`)}
                            className="text-sm font-bold text-[var(--nx-text-primary)] hover:text-[var(--nx-indigo)]"
                          >
                            {row.vil.name}
                          </button>
                          <div className="text-[11px] text-[var(--nx-text-muted)]">
                            <span dir="ltr" className="font-mono-num">{row.vil.coord || '—'}</span>
                            <span> · {row.accName}</span>
                            <span> · K{row.continent}</span>
                          </div>
                        </div>

                        <div className="text-end">
                          <div className="font-mono-num font-bold text-[var(--nx-indigo)]">{dFmt.ppText}</div>
                          <div className="font-mono-num text-xs text-[var(--nx-text-muted)]">{dFmt.moneyText}</div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--nx-radius-sm)] bg-[var(--nx-bg-subtle)] p-2.5 text-xs">
                        <div>
                          <span className="text-[var(--nx-text-muted)]">المخزن: </span>
                          <span className={`font-mono-num font-bold ${row.whRisk ? 'text-[var(--nx-coral)]' : 'text-[var(--nx-text-primary)]'}`}>
                            {row.maxWhPct}%
                          </span>
                          <span className="text-[var(--nx-text-muted)]"> ({formatHoursArabic(row.minHoursLeft)})</span>
                        </div>

                        <div className="font-mono-num font-semibold text-[var(--nx-text-secondary)]">
                          +{row.totalHourly.toLocaleString('en-US')}/س
                        </div>

                        <span
                          className={`rounded-[var(--nx-radius-xs)] px-2 py-0.5 text-xs font-semibold ${
                            row.whRisk
                              ? 'bg-[var(--nx-coral-bg)] text-[var(--nx-coral)]'
                              : row.scavIdle
                                ? 'bg-[var(--nx-amber-bg)] text-[var(--nx-amber)]'
                                : 'bg-[var(--nx-emerald-bg)] text-[var(--nx-emerald)]'
                          }`}
                        >
                          {row.advice}
                        </span>
                      </div>

                      <div className="flex items-center justify-end gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => onOpenVillageModal(row.villageId)}
                          className="nx-btn nx-btn-outline min-h-[36px] px-2.5 py-1 text-xs"
                        >
                          <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>تعديل</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop View: Full Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full border-collapse text-start text-sm">
                  <thead>
                    <tr className="border-b border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] text-[11px] font-semibold text-[var(--nx-text-muted)]">
                      <th className="px-4 py-3 text-start">القرية</th>
                      <th className="px-3 py-3 text-start">الحساب / العالم</th>
                      <th className="px-3 py-3 text-start">المخزن</th>
                      <th className="px-3 py-3 text-start">الإنتاج/س</th>
                      <th className="px-3 py-3 text-start">العائد اليومي</th>
                      <th className="px-3 py-3 text-start">التوصية</th>
                      <th className="px-4 py-3 text-end">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--nx-border)]">
                    {efficiencyRows.map((row) => (
                      <tr key={row.villageId} className="nx-transition hover:bg-[var(--nx-bg-hover)]">
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => navigate(`/villages/${encodeURIComponent(row.villageId)}`)}
                            className="cursor-pointer font-bold text-[var(--nx-text-primary)] hover:text-[var(--nx-indigo)]"
                          >
                            {row.vil.name}
                          </button>
                          <div className="text-[11px] text-[var(--nx-text-muted)]">
                            <span dir="ltr" className="font-mono-num">
                              {row.vil.coord || '—'}
                            </span>{' '}
                            · {row.points.toLocaleString('en-US')} نقطة
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-medium">{row.accName}</div>
                          <div className="text-[11px] text-[var(--nx-text-muted)]">
                            {row.worldName} · K{row.continent}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`font-mono-num font-bold ${
                              row.whRisk ? 'text-[var(--nx-coral)]' : 'text-[var(--nx-text-primary)]'
                            }`}
                          >
                            {row.maxWhPct}%
                          </span>{' '}
                          <span className="text-xs text-[var(--nx-text-muted)]">
                            ({formatHoursArabic(row.minHoursLeft)})
                          </span>
                        </td>
                        <td className="font-mono-num px-3 py-3 font-semibold">
                          +{row.totalHourly.toLocaleString('en-US')}/س
                        </td>
                        <td className="px-3 py-3">
                          {(() => {
                            const dFmt = formatPPAndCurrency(row.dailyPP, state, {
                              decimals: 1,
                              unit: 'نقطة',
                              perDay: true
                            });
                            return (
                              <>
                                <div className="font-mono-num font-bold text-[var(--nx-indigo)]">
                                  {dFmt.ppText}
                                </div>
                                <div className="font-mono-num text-[11px] text-[var(--nx-text-muted)]">
                                  {dFmt.moneyText}
                                </div>
                              </>
                            );
                          })()}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex rounded-[var(--nx-radius-xs)] px-2 py-0.5 text-xs font-semibold ${
                              row.whRisk
                                ? 'bg-[var(--nx-coral-bg)] text-[var(--nx-coral)]'
                                : row.scavIdle
                                  ? 'bg-[var(--nx-amber-bg)] text-[var(--nx-amber)]'
                                  : 'bg-[var(--nx-emerald-bg)] text-[var(--nx-emerald)]'
                            }`}
                          >
                            {row.advice}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-end">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onOpenVillageModal(row.villageId)}
                              aria-label={`تعديل ${row.vil.name}`}
                              className="nx-btn nx-btn-outline nx-btn-compact !px-2"
                            >
                              <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab 3: Security & IP Audit */}
      {tab === 'security' && (
        <div className="space-y-4">
          {collisions.length > 0 && (
            <IpCollisionGraphSvg
              collisions={collisions}
              onSelectAccount={(accId) => onOpenPPFlowModal(accId)}
            />
          )}

          <div className="nx-card overflow-hidden">
            {securityRows.length === 0 ? (
              <div className="p-8 text-center text-sm text-[var(--nx-text-muted)]">
                لا توجد حسابات مطابقة لمعايير التصفية الحالية.
              </div>
            ) : (
              <>
                {/* Mobile View: Clean Security Cards */}
                <div className="divide-y divide-[var(--nx-border)] md:hidden">
                  {securityRows.map((row) => (
                    <div key={row.accountId} className="space-y-2.5 p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <button
                            type="button"
                            onClick={() => onOpenPPFlowModal(row.accountId)}
                            className="text-sm font-bold text-[var(--nx-text-primary)] hover:text-[var(--nx-indigo)]"
                          >
                            {row.acc.name}
                          </button>
                          <div className="text-[11px] text-[var(--nx-text-muted)]">
                            {row.acc.device || 'غير محدد'} · {formatTimeAgo(row.lastSyncTime)}
                          </div>
                        </div>

                        <span
                          className={`rounded-[var(--nx-radius-xs)] px-2 py-0.5 text-[10px] font-semibold ${
                            row.riskScore === 2
                              ? 'bg-[var(--nx-coral-bg)] text-[var(--nx-coral)]'
                              : row.riskScore === 1
                                ? 'bg-[var(--nx-amber-bg)] text-[var(--nx-amber)]'
                                : 'bg-[var(--nx-emerald-bg)] text-[var(--nx-emerald)]'
                          }`}
                        >
                          {row.riskScore === 2
                            ? 'تعارض IP'
                            : row.riskScore === 1
                              ? 'IP غير مسجل'
                              : 'آمن ومعزول'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--nx-radius-sm)] bg-[var(--nx-bg-subtle)] p-2 text-xs">
                        <div>
                          <span className="text-[10px] text-[var(--nx-text-muted)]">IP: </span>
                          <span dir="ltr" className="font-mono-num font-bold text-[var(--nx-text-primary)]">
                            {row.ip || 'غير مسجل'}
                          </span>
                        </div>
                        <div className="text-[11px] text-[var(--nx-text-secondary)]">
                          {row.vilsCount} قرية · {row.histCount} سجل دخول
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => onOpenAccountModal(row.accountId)}
                          className="nx-btn nx-btn-outline min-h-[36px] px-3 py-1 text-xs"
                        >
                          <span>تعديل بيانات الحساب والـ IP</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop View: Full Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full border-collapse text-start text-sm">
                    <thead>
                      <tr className="border-b border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] text-[11px] font-semibold text-[var(--nx-text-muted)]">
                        <th className="px-4 py-3 text-start">الحساب</th>
                        <th className="px-3 py-3 text-start">عنوان الـ IP</th>
                        <th className="px-3 py-3 text-start">العوالم والقرى</th>
                        <th className="px-3 py-3 text-start">سجل الدخول</th>
                        <th className="px-3 py-3 text-start">حالة الأمان</th>
                        <th className="px-4 py-3 text-end">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--nx-border)]">
                      {securityRows.map((row) => (
                        <tr key={row.accountId} className="nx-transition hover:bg-[var(--nx-bg-hover)]">
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => onOpenPPFlowModal(row.accountId)}
                              className="cursor-pointer font-bold text-[var(--nx-text-primary)] hover:text-[var(--nx-indigo)]"
                            >
                              {row.acc.name}
                            </button>
                            <div className="text-[11px] text-[var(--nx-text-muted)]">
                              {row.acc.device || 'غير محدد'} · {formatTimeAgo(row.lastSyncTime)}
                            </div>
                          </td>

                          <td className="px-3 py-3">
                            <span dir="ltr" className="font-mono-num text-xs font-bold">
                              {row.ip || 'غير مسجل'}
                            </span>
                          </td>

                          <td className="px-3 py-3 text-xs text-[var(--nx-text-secondary)]">
                            {row.vilsCount} قرية · {row.wNames.join('، ') || '—'}
                          </td>

                          <td className="font-mono-num px-3 py-3 text-xs font-semibold">
                            {row.histCount} سجل
                          </td>

                          <td className="px-3 py-3">
                            <span
                              className={`inline-flex rounded-[var(--nx-radius-xs)] px-2 py-0.5 text-xs font-semibold ${
                                row.riskScore === 2
                                  ? 'bg-[var(--nx-coral-bg)] text-[var(--nx-coral)]'
                                  : row.riskScore === 1
                                    ? 'bg-[var(--nx-amber-bg)] text-[var(--nx-amber)]'
                                    : 'bg-[var(--nx-emerald-bg)] text-[var(--nx-emerald)]'
                              }`}
                            >
                              {row.riskScore === 2
                                ? 'تعارض IP في نفس العالم'
                                : row.riskScore === 1
                                  ? 'IP غير مسجل'
                                  : 'آمن ومعزول'}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-end">
                            <button
                              type="button"
                              onClick={() => onOpenAccountModal(row.accountId)}
                              className="nx-btn nx-btn-outline nx-btn-compact"
                            >
                              تعديل الـ IP
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Analytics & Historical Charts */}
      {tab === 'analytics' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] bg-[var(--nx-bg-surface)] px-3.5 py-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2 text-[var(--nx-text-secondary)]">
              <span className="font-semibold text-[var(--nx-text-primary)]">نطاق التحليل:</span>
              <span className="font-mono-num rounded-[var(--nx-radius-xs)] bg-[var(--nx-bg-subtle)] px-2 py-0.5 font-semibold">
                {scopedAnalyticsVillages.length} قرية
              </span>
              <span className="font-mono-num rounded-[var(--nx-radius-xs)] bg-[var(--nx-bg-subtle)] px-2 py-0.5 font-semibold">
                {resAttacksSummary.activeDaysCount}/{analyticsRangeDays} أيام بنشاط مسجل
              </span>
            </div>
            <div className="text-[11px] text-[var(--nx-text-muted)]">
              الأيام السابقة تعتمد على سجلات المزامنة والجلسات المحفوظة؛ الأيام بدون مزامنة لا تُحسب
            </div>
          </div>

          <WeeklyFlowBarChart
            days={dailyFlowSummary.dayPoints}
            periodNetPP={dailyFlowSummary.periodNetPP}
            earnedPeriodNetPP={dailyFlowSummary.earnedPeriodNetPP}
            deltaPctText={`${dailyFlowSummary.deltaPct >= 0 ? '+' : ''}${dailyFlowSummary.deltaPct}%`}
            earnedDeltaPctText={`${dailyFlowSummary.earnedDeltaPct >= 0 ? '+' : ''}${dailyFlowSummary.earnedDeltaPct}%`}
            deltaUp={dailyFlowSummary.deltaPct >= 0}
            earnedDeltaUp={dailyFlowSummary.earnedDeltaPct >= 0}
            hasOnboardingJump={dailyFlowSummary.hasOnboardingJump}
            onboardingJumpPP={dailyFlowSummary.onboardingJumpPP}
            finance={state.finance}
            rangeDays={analyticsRangeDays}
            onSelectRangeDays={setAnalyticsRangeDays}
            onSelectAccount={onOpenPPFlowModal}
          />

          <ResourcesAttacksRechart
            data={resAttacksSummary}
            rangeDays={analyticsRangeDays}
            selectedAccountId={effectiveResAccountId}
            onSelectRangeDays={setAnalyticsRangeDays}
            onSelectAccountId={(id) => {
              if (accountId !== 'all') setAccountId('all');
              setRechartsAccountId(id);
            }}
            onOpenAccountFlow={onOpenPPFlowModal}
          />
        </div>
      )}

      {/* Tab 5: Cross-World Performance Comparison */}
      {tab === 'worlds' && (() => {
        const totalAllWorldsPP = worldComparisonRows.reduce((s, r) => s + r.totalEarnedPP, 0);
        const totalAllFmt = formatPPAndCurrency(totalAllWorldsPP, state, { decimals: 0, unit: 'نقطة' });
        const closedWorldsCount = worldComparisonRows.filter((r) => r.tradeEnded).length;
        const activeWorldsCount = worldComparisonRows.length - closedWorldsCount;
        const bestWorld = [...worldComparisonRows].sort((a, b) => b.totalEarnedPP - a.totalEarnedPP)[0] || null;
        const avgPerWorldPP =
          worldComparisonRows.length > 0 ? Math.round(totalAllWorldsPP / worldComparisonRows.length) : 0;
        const avgWorldFmt = formatPPAndCurrency(avgPerWorldPP, state, { decimals: 0, unit: 'نقطة' });

        return (
          <div className="space-y-4" data-testid="worlds-comparison-panel">
            {/* Summary Strip */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="nx-card p-3.5">
                <div className="text-[11px] font-semibold text-[var(--nx-text-muted)]">إجمالي العوالم</div>
                <div className="font-mono-num mt-1 text-xl font-bold text-[var(--nx-text-primary)]">
                  {worldComparisonRows.length}
                </div>
                <div className="mt-0.5 text-[11px] text-[var(--nx-text-muted)]">
                  {activeWorldsCount} نشط · {closedWorldsCount} منتهي التجارة
                </div>
              </div>

              <div className="nx-card p-3.5">
                <div className="text-[11px] font-semibold text-[var(--nx-text-muted)]">إجمالي أرباح العوالم</div>
                <div className="font-mono-num mt-1 text-xl font-bold text-[var(--nx-indigo)]">
                  {totalAllFmt.ppText}
                </div>
                <div className="font-mono-num mt-0.5 text-[11px] text-[var(--nx-text-muted)]">
                  {totalAllFmt.moneyText}
                </div>
              </div>

              <div className="nx-card p-3.5">
                <div className="text-[11px] font-semibold text-[var(--nx-text-muted)]">أفضل عالم أداءً</div>
                <div className="mt-1 truncate text-base font-bold text-[var(--nx-emerald)]">
                  {bestWorld ? bestWorld.worldName : '—'}
                </div>
                <div className="font-mono-num mt-0.5 text-[11px] text-[var(--nx-text-muted)]">
                  {bestWorld ? `${bestWorld.totalEarnedPP.toLocaleString('en-US')} نقطة (${bestWorld.speed}x)` : '—'}
                </div>
              </div>

              <div className="nx-card p-3.5">
                <div className="text-[11px] font-semibold text-[var(--nx-text-muted)]">متوسط العائد لكل عالم</div>
                <div className="font-mono-num mt-1 text-xl font-bold text-[var(--nx-text-primary)]">
                  {avgWorldFmt.ppText}
                </div>
                <div className="font-mono-num mt-0.5 text-[11px] text-[var(--nx-text-muted)]">
                  {avgWorldFmt.moneyText}
                </div>
              </div>
            </div>

            <div className="nx-card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] px-4 py-3">
                <div>
                  <h2 className="text-sm font-bold text-[var(--nx-text-primary)]">
                    مقارنة أداء العوالم (النقاط المحققة والتطور بين العوالم)
                  </h2>
                  <p className="text-[11px] text-[var(--nx-text-muted)]">
                    عند تفعيل «انتهت التجارة» من الإعدادات يتم تثبيت حصيلة العالم هنا للمقارنة المباشرة مع العالم التالي — ويمكنك تعديل الإجمالي يدوياً في أي وقت
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/settings')}
                  className="nx-btn nx-btn-outline nx-btn-compact"
                >
                  إدارة العوالم في الإعدادات
                </button>
              </div>

              {worldComparisonRows.length === 0 ? (
                <div className="p-8 text-center text-sm text-[var(--nx-text-muted)]">
                  لا توجد عوالم مسجلة بعد.
                </div>
              ) : (
                <>
                  {/* Mobile Cards */}
                  <div className="divide-y divide-[var(--nx-border)] md:hidden">
                    {worldComparisonRows.map((row) => {
                      const totalFmt = formatPPAndCurrency(row.totalEarnedPP, state, { decimals: 0, unit: 'نقطة' });
                      const dailyFmt = formatPPAndCurrency(row.liveDailyExpectedPP, state, {
                        decimals: 1,
                        unit: 'نقطة',
                        perDay: true
                      });
                      const isEditing = editingWorldId === row.worldId;
                      return (
                        <div key={row.worldId} className="space-y-2.5 p-3.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-bold text-[var(--nx-text-primary)]">{row.worldName}</span>
                                <span className="font-mono-num rounded-[var(--nx-radius-xs)] bg-[var(--nx-bg-subtle)] px-1.5 py-0.5 text-[10.5px] font-bold text-[var(--nx-indigo)]">
                                  {row.speed}x
                                </span>
                              </div>
                              <div className="mt-0.5 text-[11px] text-[var(--nx-text-muted)]">
                                {row.accountsCount} حساب · {row.villagesCount} قرية
                              </div>
                            </div>
                            <span
                              className={`inline-flex items-center gap-1 rounded-[var(--nx-radius-xs)] px-2 py-0.5 text-[10.5px] font-bold ${
                                row.tradeEnded
                                  ? 'bg-[var(--nx-coral-bg)] text-[var(--nx-coral)]'
                                  : 'bg-[var(--nx-emerald-bg)] text-[var(--nx-emerald)]'
                              }`}
                            >
                              {row.tradeEnded && <Lock className="h-3 w-3" aria-hidden="true" />}
                              <span>{row.tradeEnded ? 'انتهت التجارة' : 'تجارة نشطة'}</span>
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 rounded-[var(--nx-radius-sm)] bg-[var(--nx-bg-subtle)] p-2.5 text-center text-xs">
                            <div>
                              <div className="text-[10.5px] text-[var(--nx-text-muted)]">إجمالي النقاط</div>
                              <div className="font-mono-num font-bold text-[var(--nx-indigo)]">{totalFmt.ppText}</div>
                              <div className="font-mono-num text-[10.5px] text-[var(--nx-text-muted)]">{totalFmt.moneyText}</div>
                            </div>
                            <div>
                              <div className="text-[10.5px] text-[var(--nx-text-muted)]">لكل حساب</div>
                              <div className="font-mono-num font-semibold text-[var(--nx-text-primary)]">
                                {row.ppPerAccount.toLocaleString('en-US')}
                              </div>
                              <div className="text-[10.5px] text-[var(--nx-text-muted)]">قرية: {row.ppPerVillage}</div>
                            </div>
                            <div>
                              <div className="text-[10.5px] text-[var(--nx-text-muted)]">المتوقع/يوم</div>
                              <div className="font-mono-num font-semibold text-[var(--nx-text-secondary)]">
                                {row.tradeEnded ? '0 نقطة' : dailyFmt.ppText}
                              </div>
                              {row.deltaVsPrevPct !== null && (
                                <div
                                  className={`font-mono-num text-[10.5px] font-bold ${
                                    row.deltaVsPrevPct >= 0 ? 'text-[var(--nx-emerald)]' : 'text-[var(--nx-coral)]'
                                  }`}
                                >
                                  {row.deltaVsPrevPct >= 0 ? '+' : ''}{row.deltaVsPrevPct}%
                                </div>
                              )}
                            </div>
                          </div>

                          {onSaveWorld && (
                            <div className="flex items-center justify-end gap-1.5">
                              {isEditing ? (
                                <>
                                  <input
                                    type="text"
                                      inputMode="numeric"
                                      dir="ltr"
                                    min="0"
                                    aria-label={`إجمالي نقاط ${row.worldName}`}
                                    value={editingWorldPP}
                                    onChange={(e) => setEditingWorldPP(e.target.value)}
                                    className="nx-input nx-input-compact font-mono-num w-28"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSaveWorldSummaryPP(row.worldId)}
                                    className="nx-btn nx-btn-primary nx-btn-compact !px-2.5"
                                  >
                                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingWorldId(null)}
                                    className="nx-btn nx-btn-outline nx-btn-compact !px-2.5"
                                  >
                                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingWorldId(row.worldId);
                                    setEditingWorldPP(String(row.totalEarnedPP));
                                  }}
                                  className="nx-btn nx-btn-outline nx-btn-compact"
                                >
                                  <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                                  <span>تعديل الحصيلة</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop Comparison Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full border-collapse text-start text-sm">
                      <thead>
                        <tr className="border-b border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] text-[11px] font-semibold text-[var(--nx-text-muted)]">
                          <th className="px-4 py-3 text-start">العالم والسرعة</th>
                          <th className="px-3 py-3 text-start">حالة التجارة</th>
                          <th className="px-3 py-3 text-start">الحسابات / القرى</th>
                          <th className="px-3 py-3 text-start">إجمالي النقاط المحققة</th>
                          <th className="px-3 py-3 text-start">متوسط / حساب</th>
                          <th className="px-3 py-3 text-start">متوسط / قرية</th>
                          <th className="px-3 py-3 text-start">المتوقع اليومي الحي</th>
                          <th className="px-4 py-3 text-end">المقارنة بالعالم السابق</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--nx-border)]">
                        {worldComparisonRows.map((row) => {
                          const totalFmt = formatPPAndCurrency(row.totalEarnedPP, state, {
                            decimals: 0,
                            unit: 'نقطة'
                          });
                          const dailyFmt = formatPPAndCurrency(row.liveDailyExpectedPP, state, {
                            decimals: 1,
                            unit: 'نقطة',
                            perDay: true
                          });
                          const isEditing = editingWorldId === row.worldId;
                          return (
                            <tr key={row.worldId} className="nx-transition hover:bg-[var(--nx-bg-hover)]">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-[var(--nx-text-primary)]">{row.worldName}</span>
                                  <span className="font-mono-num rounded-[var(--nx-radius-xs)] bg-[var(--nx-bg-subtle)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--nx-indigo)]">
                                    {row.speed}x
                                  </span>
                                </div>
                              </td>

                              <td className="px-3 py-3">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-[var(--nx-radius-xs)] px-2 py-0.5 text-xs font-semibold ${
                                    row.tradeEnded
                                      ? 'bg-[var(--nx-coral-bg)] text-[var(--nx-coral)]'
                                      : 'bg-[var(--nx-emerald-bg)] text-[var(--nx-emerald)]'
                                  }`}
                                >
                                  {row.tradeEnded && <Lock className="h-3 w-3" aria-hidden="true" />}
                                  <span>{row.tradeEnded ? 'انتهت التجارة' : 'تجارة نشطة'}</span>
                                </span>
                              </td>

                              <td className="font-mono-num px-3 py-3 text-xs font-semibold text-[var(--nx-text-secondary)]">
                                {row.accountsCount} حساب · {row.villagesCount} قرية
                              </td>

                              <td className="px-3 py-3">
                                {isEditing ? (
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      dir="ltr"
                                      min="0"
                                      aria-label={`تعديل إجمالي نقاط ${row.worldName}`}
                                      value={editingWorldPP}
                                      onChange={(e) => setEditingWorldPP(e.target.value)}
                                      className="nx-input nx-input-compact font-mono-num w-28"
                                    />
                                    <button
                                      type="button"
                                      aria-label="حفظ"
                                      onClick={() => handleSaveWorldSummaryPP(row.worldId)}
                                      className="nx-btn nx-btn-primary nx-btn-compact !px-2"
                                    >
                                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                    </button>
                                    <button
                                      type="button"
                                      aria-label="إلغاء"
                                      onClick={() => setEditingWorldId(null)}
                                      className="nx-btn nx-btn-outline nx-btn-compact !px-2"
                                    >
                                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <div>
                                      <div className="font-mono-num font-bold text-[var(--nx-indigo)]">
                                        {totalFmt.ppText}
                                      </div>
                                      <div className="font-mono-num text-[11px] text-[var(--nx-text-muted)]">
                                        {totalFmt.moneyText}
                                        {row.hasCustomSummaryPP ? ' · مسجل' : ' · تقديري'}
                                      </div>
                                    </div>
                                    {onSaveWorld && (
                                      <button
                                        type="button"
                                        aria-label={`تعديل حصيلة ${row.worldName}`}
                                        onClick={() => {
                                          setEditingWorldId(row.worldId);
                                          setEditingWorldPP(String(row.totalEarnedPP));
                                        }}
                                        className="nx-btn nx-btn-outline nx-btn-compact !min-h-[28px] !px-2"
                                      >
                                        <Edit3 className="h-3 w-3" aria-hidden="true" />
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>

                              <td className="font-mono-num px-3 py-3 text-xs font-semibold text-[var(--nx-text-primary)]">
                                {row.ppPerAccount.toLocaleString('en-US')} نقطة
                              </td>

                              <td className="font-mono-num px-3 py-3 text-xs font-semibold text-[var(--nx-text-secondary)]">
                                {row.ppPerVillage.toLocaleString('en-US')} نقطة
                              </td>

                              <td className="px-3 py-3">
                                {row.tradeEnded ? (
                                  <span className="font-mono-num text-xs font-semibold text-[var(--nx-text-muted)]">
                                    0 نقطة (مغلق)
                                  </span>
                                ) : (
                                  <div>
                                    <div className="font-mono-num text-xs font-bold text-[var(--nx-emerald)]">
                                      {dailyFmt.ppText}
                                    </div>
                                    <div className="font-mono-num text-[11px] text-[var(--nx-text-muted)]">
                                      {dailyFmt.moneyText}
                                    </div>
                                  </div>
                                )}
                              </td>

                              <td className="px-4 py-3 text-end">
                                {row.deltaVsPrevPP !== null && row.deltaVsPrevPct !== null ? (
                                  <span
                                    className={row.deltaVsPrevPP >= 0 ? 'nx-delta-pos' : 'nx-delta-neg'}
                                  >
                                    {row.deltaVsPrevPP >= 0 ? '+' : ''}
                                    {row.deltaVsPrevPct}% ({row.deltaVsPrevPP >= 0 ? '+' : ''}
                                    {row.deltaVsPrevPP.toLocaleString('en-US')})
                                  </span>
                                ) : (
                                  <span className="text-xs text-[var(--nx-text-muted)]">خط الأساس</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
