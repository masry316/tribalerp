import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  ChevronDown,
  ClipboardPaste,
  Coins,
  Download,
  ExternalLink,
  Layers,
  LayoutGrid,
  ShieldAlert,
  Sparkles,
  TrendingUp
} from 'lucide-react';
import {
  buildAccountLoginQueue,
  computeVillageLiveStatus,
  formatHoursArabic,
  formatPPAndCurrency,
  getAccountCleanDevice,
  type ErpAppState,
  type FirestoreDashboardSummary,
  type SessionLogEntry,
  type SyncStatusState,
  type VillageRole
} from '../../core';
import {
  buildContinentSellGroups,
  buildDashboardAlerts,
  buildDashboardDailyFlow,
  buildDashboardOverviewColumns,
  buildDistributionAttribution,
  buildVillageRadarTileData
} from '../viewModels';
import { ContinentSellGroups } from '../components/ContinentSellGroups';
import { DeltaBadge, ScreenEmptyState } from '../components/StateViews';
import { WorldMapSection } from '../components/WorldMapSection';
import { DashboardDetailedReportsTab } from '../components/charts/DashboardDetailedReportsTab';
import { UnifiedYieldOverviewSection } from '../components/charts/UnifiedYieldOverviewSection';
import { VillageRadarModal } from '../components/modals/VillageRadarModal';

interface DashboardPageProps {
  state: ErpAppState;
  summary: FirestoreDashboardSummary;
  syncStatus?: SyncStatusState;
  searchQuery: string;
  searchUrl: string;
  navigate: (path: string) => void;
  onFilterChange: (worldId: string, device: string) => void;
  onRefreshData?: () => Promise<void> | void;
  onSelectActiveVillage: (villageId: string) => void;
  onSetVillageRole?: (villageId: string, role: VillageRole) => void;
  onOpenAccountModal: (accountId: string) => void;
  onOpenVillageModal: (villageId: string) => void;
  onOpenCreateVillage: () => void;
  onOpenMissionModal: (villageId: string) => void;
  onOpenPPFlowModal: (accountId: string) => void;
  onOpenSyncModal: () => void;
  onExportBackup: () => void;
  onPushToast: (msg: string, tone?: 'info' | 'success' | 'warn' | 'danger') => void;
  onLogSession?: (entry: SessionLogEntry) => void;
}

export function DashboardPage({
  state,
  summary,
  syncStatus,
  searchQuery,
  searchUrl,
  navigate,
  onFilterChange,
  onRefreshData,
  onSelectActiveVillage,
  onSetVillageRole,
  onOpenVillageModal,
  onOpenCreateVillage,
  onOpenMissionModal,
  onOpenPPFlowModal,
  onOpenSyncModal,
  onExportBackup
}: DashboardPageProps) {
  const [villageSort, setVillageSort] = useState<'urgency' | 'dailyPP' | 'unsoldPP'>('urgency');
  const [radarVillageId, setRadarVillageId] = useState<string | null>(null);

  const urlDashboardTab = useMemo(() => {
    const raw = new URLSearchParams(searchUrl).get('view');
    return raw === 'reports' ? 'reports' : 'overview';
  }, [searchUrl]);

  const [activeDashboardTab, setActiveDashboardTab] = useState<'overview' | 'reports'>(
    urlDashboardTab
  );

  useEffect(() => {
    setActiveDashboardTab(urlDashboardTab);
  }, [urlDashboardTab]);

  const handleSelectDashboardTab = (nextTab: 'overview' | 'reports') => {
    setActiveDashboardTab(nextTab);
    navigate(nextTab === 'reports' ? '/dashboard?view=reports' : '/dashboard');
  };

  const urgentOnly = useMemo(
    () => new URLSearchParams(searchUrl).get('urgent') === '1',
    [searchUrl]
  );

  const devicesList = useMemo(
    () =>
      [...new Set(state.userAccounts.map((a) => getAccountCleanDevice(a)))].filter(
        (d) => d && d !== 'غير محدد'
      ),
    [state.userAccounts]
  );

  const filteredVillages = useMemo(() => {
    const nowMs = Date.now();
    const q = searchQuery.trim().toLowerCase();
    return state.villages
      .map((v) => {
        const acc = state.userAccounts.find((a) => a.id === v.accountId) || null;
        const dev = acc ? getAccountCleanDevice(acc) : v.device || 'غير محدد';
        const live = computeVillageLiveStatus(v, state, nowMs);
        return { vil: v, acc, dev, live };
      })
      .filter(({ vil, acc, dev, live }) => {
        if (state.selectedWorldFilter !== 'all' && vil.worldId !== state.selectedWorldFilter) {
          return false;
        }
        if (state.selectedDeviceFilter !== 'all' && dev !== state.selectedDeviceFilter) {
          return false;
        }
        if (
          urgentOnly &&
          live.status === 'safe' &&
          live.scavState !== 'idle_troops' &&
          live.scavState !== 'returned'
        ) {
          return false;
        }
        if (q) {
          const hay = `${vil.name} ${vil.coord || ''} ${acc?.name || ''} ${live.worldName} k${vil.continent}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (villageSort === 'dailyPP') return b.live.dailyPP - a.live.dailyPP;
        if (villageSort === 'unsoldPP') return b.live.unsoldPP - a.live.unsoldPP;
        const rank = (s: string, scavState: string) =>
          s === 'critical' || scavState === 'returned' || scavState === 'idle_troops'
            ? 0
            : s === 'warning'
              ? 1
              : 2;
        const rDiff = rank(a.live.status, a.live.scavState) - rank(b.live.status, b.live.scavState);
        if (rDiff !== 0) return rDiff;
        return a.live.minHoursLeft - b.live.minHoursLeft;
      });
  }, [state, searchQuery, urgentOnly, villageSort]);

  const radarSelectedContext = useMemo(() => {
    if (!radarVillageId) return null;
    const found = filteredVillages.find((x) => x.vil.id === radarVillageId);
    if (found) return found;
    const vil = state.villages.find((v) => v.id === radarVillageId);
    if (!vil) return null;
    const acc = state.userAccounts.find((a) => a.id === vil.accountId) || null;
    const live = computeVillageLiveStatus(vil, state, Date.now());
    return { vil, acc, dev: acc ? getAccountCleanDevice(acc) : 'غير محدد', live };
  }, [radarVillageId, filteredVillages, state]);

  const urgentAlerts = useMemo(() => buildDashboardAlerts(state), [state]);

  const loginQueueItems = useMemo(
    () =>
      buildAccountLoginQueue(state, {
        worldFilter: state.selectedWorldFilter,
        deviceFilter: state.selectedDeviceFilter,
        searchQuery
      }),
    [state, searchQuery]
  );

  const globalDailyFlow = useMemo(
    () => buildDashboardDailyFlow(state, 7),
    [state]
  );

  const overviewColumns = useMemo(
    () => buildDashboardOverviewColumns(filteredVillages, state.selectedWorldFilter),
    [filteredVillages, state.selectedWorldFilter]
  );

  const distributionAttr = useMemo(
    () => buildDistributionAttribution(filteredVillages),
    [filteredVillages]
  );

  const continentSellGroups = useMemo(
    () => buildContinentSellGroups(filteredVillages, state),
    [filteredVillages, state]
  );

  const kpiMetrics = useMemo(() => {
    // PP balance belongs globally to accounts regardless of selected world filter
    const totalPP = state.userAccounts.reduce((s, a) => s + (Number(a.pp) || 0), 0);
    const totalResHr = filteredVillages.reduce((s, x) => s + x.live.totalHourly, 0);
    const estMinesPP = filteredVillages.reduce((s, x) => s + x.live.mineDailyPP, 0);
    const estDailyPP = filteredVillages.reduce((s, x) => s + x.live.dailyPP, 0);
    const estScavActivePP = filteredVillages.reduce((s, x) => s + x.live.scavActiveDailyPP, 0);
    const estScavPP = Math.max(0, estDailyPP - estMinesPP);
    const totalUnsoldPP = filteredVillages.reduce((s, x) => s + x.live.unsoldPP, 0);
    const totalSellableNowPP = filteredVillages.reduce((s, x) => s + x.live.sellableNowPP, 0);
    const activeScavCount = filteredVillages.filter((x) => x.live.scavState === 'running').length;
    const criticalWhCount = filteredVillages.filter((x) => x.live.status === 'critical').length;
    const idleTroopsCount = filteredVillages.filter(
      (x) => x.live.scavState === 'idle_troops' || x.live.scavState === 'returned'
    ).length;

    return {
      totalPP,
      totalResHr,
      estDailyPP,
      estMinesPP,
      estScavPP,
      estScavActivePP,
      totalUnsoldPP,
      totalSellableNowPP,
      activeScavCount,
      criticalWhCount,
      idleTroopsCount
    };
  }, [filteredVillages, state.userAccounts]);

  const urgentBadgeCount = useMemo(
    () => loginQueueItems.filter((item) => item.urgencyTier === 'now').length,
    [loginQueueItems]
  );

  const totalPPFmt = formatPPAndCurrency(kpiMetrics.totalPP, state, { decimals: 0, unit: 'نقطة' });
  const todayDeltaFmt = formatPPAndCurrency(globalDailyFlow.todayNetPP, state, {
    decimals: 1,
    showSign: true,
    unit: 'نقطة'
  });
  const estDailyFmt = formatPPAndCurrency(kpiMetrics.estDailyPP, state, {
    decimals: 0,
    unit: 'نقطة',
    perDay: true
  });
  const estMinesFmt = formatPPAndCurrency(kpiMetrics.estMinesPP, state, {
    decimals: 1,
    unit: 'نقطة'
  });
  const estScavFmt = formatPPAndCurrency(kpiMetrics.estScavPP, state, {
    decimals: 1,
    unit: 'نقطة'
  });

  const radarToneStyle = (tone: 'critical' | 'warning' | 'ready' | 'safe', isActive: boolean) => {
    const activeRing = isActive ? 'ring-1 ring-[var(--nx-indigo)] border-[var(--nx-indigo)]' : '';
    if (tone === 'critical') {
      return `border-[var(--nx-coral-border)] bg-[var(--nx-coral-bg)]/35 hover:bg-[var(--nx-coral-bg)]/55 ${activeRing}`;
    }
    if (tone === 'warning') {
      return `border-[var(--nx-amber-border)] bg-[var(--nx-amber-bg)]/35 hover:bg-[var(--nx-amber-bg)]/55 ${activeRing}`;
    }
    if (tone === 'ready') {
      return `border-[var(--nx-indigo)]/40 bg-[var(--nx-indigo-soft)]/45 hover:bg-[var(--nx-indigo-soft)]/70 ${activeRing}`;
    }
    return `border-[var(--nx-border)] bg-[var(--nx-bg-surface)] hover:bg-[var(--nx-bg-hover)] ${activeRing}`;
  };

  return (
    <div className="space-y-4">
      {/* Header Title & Filter Control Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-[var(--nx-text-primary)]">
            {urgentOnly ? 'التنبيهات الحرجة والمهام الفورية' : 'لوحة القيادة'}
          </h1>
          <p className="text-xs text-[var(--nx-text-muted)]">
            متابعة حية لإنتاج القرى، مصادر العائد والقارات، ورادار القرى النشطة
            {summary.nearestFillHours !== null
              ? ` · أقرب امتلاء: ${summary.nearestFillVillageName} (${formatHoursArabic(summary.nearestFillHours)})`
              : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <select
              aria-label="تصفية حسب العالم"
              value={state.selectedWorldFilter}
              onChange={(e) => onFilterChange(e.target.value, state.selectedDeviceFilter)}
              className="nx-select nx-select-compact min-w-[120px] appearance-none pe-7"
            >
              <option value="all">كل العوالم</option>
              {state.worlds.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute end-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--nx-text-muted)]"
              aria-hidden="true"
            />
          </div>

          <div className="relative hidden sm:block">
            <select
              aria-label="تصفية حسب الجهاز"
              value={state.selectedDeviceFilter}
              onChange={(e) => onFilterChange(state.selectedWorldFilter, e.target.value)}
              className="nx-select nx-select-compact min-w-[115px] appearance-none pe-7"
            >
              <option value="all">كل الأجهزة</option>
              {devicesList.map((dev) => (
                <option key={dev} value={dev}>
                  {dev}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute end-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--nx-text-muted)]"
              aria-hidden="true"
            />
          </div>

          <button
            type="button"
            onClick={() => navigate(urgentOnly ? '/dashboard' : '/dashboard?urgent=1')}
            className={`nx-btn nx-btn-compact ${
              urgentOnly
                ? 'border-[var(--nx-coral-border)] bg-[var(--nx-coral-bg)] text-[var(--nx-coral)]'
                : 'nx-btn-outline'
            }`}
          >
            <Bell className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{urgentOnly ? 'عرض كل القرى' : 'العاجل فقط'}</span>
            {urgentBadgeCount > 0 && (
              <span className="font-mono-num rounded bg-[var(--nx-coral)] px-1.5 text-[10px] font-bold text-white">
                {urgentBadgeCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onExportBackup}
            className="nx-btn nx-btn-outline nx-btn-compact hidden md:inline-flex"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>تصدير</span>
          </button>

          <button
            type="button"
            onClick={onOpenSyncModal}
            aria-label="مزامنة سريعة (نسخ ولصق)"
            title="مزامنة سريعة (نسخ ولصق)"
            className="nx-btn nx-btn-primary nx-btn-compact"
          >
            <ClipboardPaste className="h-3.5 w-3.5" aria-hidden="true" />
            <span>مزامنة سريعة</span>
          </button>
        </div>
      </div>

      {/* Dashboard View Switcher Tabs (Overview vs Detailed Growth Reports) */}
      <div
        role="tablist"
        aria-label="أقسام لوحة القيادة"
        className="flex flex-wrap items-center gap-1.5 border-b border-[var(--nx-border)] pb-2"
      >
        <button
          type="button"
          role="tab"
          data-testid="dashboard-tab-overview"
          aria-selected={activeDashboardTab === 'overview'}
          onClick={() => handleSelectDashboardTab('overview')}
          className={`nx-btn min-h-[38px] shrink-0 whitespace-nowrap border px-3.5 py-1.5 text-xs font-bold ${
            activeDashboardTab === 'overview'
              ? 'border-[var(--nx-indigo)] bg-[var(--nx-indigo-soft)] text-[var(--nx-indigo)]'
              : 'border-transparent text-[var(--nx-text-muted)] hover:bg-[var(--nx-bg-hover)] hover:text-[var(--nx-text-primary)]'
          }`}
        >
          <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
          <span>نظرة عامة</span>
        </button>

        <button
          type="button"
          role="tab"
          data-testid="dashboard-tab-reports"
          aria-selected={activeDashboardTab === 'reports'}
          onClick={() => handleSelectDashboardTab('reports')}
          className={`nx-btn min-h-[38px] shrink-0 whitespace-nowrap border px-3.5 py-1.5 text-xs font-bold ${
            activeDashboardTab === 'reports'
              ? 'border-[var(--nx-indigo)] bg-[var(--nx-indigo-soft)] text-[var(--nx-indigo)]'
              : 'border-transparent text-[var(--nx-text-muted)] hover:bg-[var(--nx-bg-hover)] hover:text-[var(--nx-text-primary)]'
          }`}
        >
          <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
          <span>التقارير التفصيلية</span>
        </button>
      </div>

      {activeDashboardTab === 'reports' ? (
        <DashboardDetailedReportsTab
          state={state}
          filteredVillages={filteredVillages}
          syncStatus={syncStatus}
          onRefreshData={onRefreshData}
          onOpenVillage={(vid) => setRadarVillageId(vid)}
          onOpenFullReports={() => navigate('/reports?tab=analytics')}
          onOpenSyncModal={onOpenSyncModal}
        />
      ) : (
        <>
      {/* Urgent Alerts Banner when Urgent Filter is Active */}
      {urgentOnly && (
        <section
          aria-labelledby="urgent-alerts-heading"
          className="nx-card border-[var(--nx-coral-border)] bg-[var(--nx-coral-bg)]/40 p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-[var(--nx-radius-sm)] bg-[var(--nx-coral-bg)] text-[var(--nx-coral)]">
                <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <h2 id="urgent-alerts-heading" className="text-sm font-bold text-[var(--nx-text-primary)]">
                  التنبيهات الحرجة ({urgentAlerts.length})
                </h2>
                <p className="text-[11px] text-[var(--nx-text-muted)]">
                  المخازن القريبة من الامتلاء، الجيوش المتوقفة عن الإغارة، وتضاربات الـ IP
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="nx-btn nx-btn-outline nx-btn-compact"
            >
              العودة للعرض الكامل
            </button>
          </div>

          {urgentAlerts.length === 0 ? (
            <p className="mt-3 text-xs font-medium text-[var(--nx-emerald)]">
              لا توجد تنبيهات حرجة حالياً — كافة القرى والحسابات في وضع مستقر.
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
              {urgentAlerts.map((al) => (
                <div
                  key={al.id}
                  className="flex items-center justify-between gap-2 rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] bg-[var(--nx-bg-surface)] px-3 py-2 text-xs"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <AlertTriangle
                      className={`h-3.5 w-3.5 shrink-0 ${
                        al.severity === 'critical' ? 'text-[var(--nx-coral)]' : 'text-[var(--nx-amber)]'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="truncate font-medium text-[var(--nx-text-primary)]">
                      {al.message}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(al.category === 'security' ? '/reports?tab=security' : al.linkPath)}
                    className="shrink-0 cursor-pointer font-semibold text-[var(--nx-indigo)] hover:underline"
                  >
                    {al.linkLabel}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Row 1: Top 3 KPI Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <article className="nx-card flex items-center justify-between gap-3 p-4">
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--nx-text-muted)]">
              <Coins className="h-3.5 w-3.5 text-[var(--nx-indigo)]" aria-hidden="true" />
              <span>إجمالي نقاط التميز</span>
            </div>
            <div className="font-mono-num flex flex-wrap items-baseline gap-1.5 text-[22px] font-bold leading-tight text-[var(--nx-text-primary)]">
              <span>{totalPPFmt.ppText}</span>
              <span className="text-sm font-medium text-[var(--nx-text-subtle)]">/</span>
              <span className="text-lg font-bold text-[var(--nx-indigo)]">{totalPPFmt.moneyText}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DeltaBadge
                label={`${todayDeltaFmt.combinedText} اليوم`}
                direction={globalDailyFlow.todayNetPP >= 0 ? 'up' : 'down'}
              />
              <span className="text-[11px] text-[var(--nx-text-muted)]">
                رصيد عام ({state.userAccounts.length} حساب)
              </span>
            </div>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--nx-radius-md)] bg-[var(--nx-indigo-soft)] text-[var(--nx-indigo)]">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </div>
        </article>

        <article className="nx-card flex items-center justify-between gap-3 p-4">
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--nx-text-muted)]">
              <TrendingUp className="h-3.5 w-3.5 text-[var(--nx-teal)]" aria-hidden="true" />
              <span>الإنتاج اليومي المتوقع</span>
            </div>
            <div className="font-mono-num flex flex-wrap items-baseline gap-1.5 text-[22px] font-bold leading-tight text-[var(--nx-text-primary)]">
              <span>{estDailyFmt.ppText}</span>
              <span className="text-sm font-medium text-[var(--nx-text-subtle)]">/</span>
              <span className="text-lg font-bold text-[var(--nx-teal)]">{estDailyFmt.moneyText}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--nx-text-muted)]">
              <span>
                مناجم (24س):{' '}
                <span className="font-mono-num font-semibold text-[var(--nx-indigo)]">
                  {estMinesFmt.ppText}
                </span>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                إغارات (12س):{' '}
                <span className="font-mono-num font-semibold text-[var(--nx-teal)]">
                  {estScavFmt.ppText}
                </span>
              </span>
            </div>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--nx-radius-md)] bg-[var(--nx-bg-subtle)] text-[var(--nx-teal)]">
            <Activity className="h-5 w-5" aria-hidden="true" />
          </div>
        </article>

        <article className="nx-card flex items-center justify-between gap-3 p-4">
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--nx-text-muted)]">
              <Layers className="h-3.5 w-3.5 text-[var(--nx-text-muted)]" aria-hidden="true" />
              <span>أولوية الدخول والجاهزية</span>
            </div>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-mono-num text-[24px] font-bold leading-none text-[var(--nx-text-primary)]">
                {urgentBadgeCount}/{loginQueueItems.length}
              </span>
              <span className="text-xs font-semibold text-[var(--nx-text-muted)]">حساب يحتاج إجراء</span>
              <DeltaBadge
                label={
                  kpiMetrics.criticalWhCount > 0
                    ? `${kpiMetrics.criticalWhCount} مخزن حرج`
                    : `${kpiMetrics.activeScavCount}/${filteredVillages.length} تغار`
                }
                direction={kpiMetrics.criticalWhCount > 0 || kpiMetrics.idleTroopsCount > 0 ? 'down' : 'up'}
              />
            </div>
            <div className="text-[11px] text-[var(--nx-text-muted)]">
              {kpiMetrics.idleTroopsCount > 0
                ? `${kpiMetrics.idleTroopsCount} قرية بجيش منتظر الإغارة · ${state.worlds.length} عوالم`
                : `${filteredVillages.length} قرية نشطة · ${state.worlds.length} عوالم`}
            </div>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--nx-radius-md)] bg-[var(--nx-bg-subtle)] text-[var(--nx-text-secondary)]">
            <Layers className="h-5 w-5" aria-hidden="true" />
          </div>
        </article>
      </div>

      {/* Empty State or Unified Overview + Compact Sell Strip + Compact Radar Grid */}
      {state.villages.length === 0 ? (
        <ScreenEmptyState
          title="لا توجد قرى مضافة بعد"
          description="استخدم مركز المزامنة السحابية لسحب بيانات قريتك تلقائياً من اللعبة، أو أضف قريتك الأولى يدوياً."
          actionLabel="فتح مركز المزامنة"
          onAction={onOpenSyncModal}
          secondaryLabel="إضافة قرية يدوياً"
          onSecondary={onOpenCreateVillage}
        />
      ) : (
        <>
          {/* Merged Yield Sources + Continents/Production Section */}
          <UnifiedYieldOverviewSection
            columns={overviewColumns}
            heroValueText={`${Math.round(kpiMetrics.totalResHr * 24).toLocaleString('en-US')} مورد/يوم`}
            estDailyPP={kpiMetrics.estDailyPP}
            minesPP={kpiMetrics.estMinesPP}
            scavPP={kpiMetrics.estScavPP}
            scavActivePP={kpiMetrics.estScavActivePP}
            unsoldPP={kpiMetrics.totalUnsoldPP}
            sellableNowPP={kpiMetrics.totalSellableNowPP}
            villagesCount={filteredVillages.length}
            finance={state.finance}
            minesAccounts={distributionAttr.minesAccounts}
            scavAccounts={distributionAttr.scavAccounts}
            unsoldAccounts={distributionAttr.unsoldAccounts}
            onOpenReports={() => navigate('/reports?tab=analytics')}
            onSelectAccount={onOpenPPFlowModal}
          />

          {/* Compact Sell Opportunities Strip */}
          <ContinentSellGroups
            groups={continentSellGroups}
            finance={state.finance}
            onOpenVillageDetail={(vid) => navigate(`/villages/${encodeURIComponent(vid)}`)}
          />

          {/* 4-Continent Interactive World Map (K44 · K45 · K54 · K55) */}
          <WorldMapSection
            filteredVillages={filteredVillages}
            state={state}
            activeVillageId={state.activeVillageId}
            onOpenVillage={(vid) => setRadarVillageId(vid)}
          />

          {/* Compact Radar Grid of Active Villages */}
          <section aria-labelledby="radar-villages-heading" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 id="radar-villages-heading" className="text-base font-bold text-[var(--nx-text-primary)]">
                  رادار القرى النشطة
                </h2>
                <span className="font-mono-num rounded-[var(--nx-radius-xs)] bg-[var(--nx-bg-surface)] px-2 py-0.5 text-xs font-bold text-[var(--nx-text-muted)]">
                  {filteredVillages.length}
                </span>
                <span className="hidden text-xs text-[var(--nx-text-muted)] sm:inline">
                  · اضغط على أي قرية لفتح نافذة التفاصيل
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <select
                    aria-label="ترتيب رادار القرى"
                    value={villageSort}
                    onChange={(e) =>
                      setVillageSort(e.target.value as 'urgency' | 'dailyPP' | 'unsoldPP')
                    }
                    className="nx-select nx-select-compact !w-auto min-w-[140px] cursor-pointer appearance-none pe-7"
                  >
                    <option value="urgency">ترتيب بالأولوية</option>
                    <option value="dailyPP">الأعلى عائداً يومياً</option>
                    <option value="unsoldPP">الأعلى مخزوناً متاحاً</option>
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute end-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--nx-text-muted)]"
                    aria-hidden="true"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/accounts')}
                  className="nx-btn nx-btn-outline nx-btn-compact"
                >
                  <span>إدارة كل القرى</span>
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
            </div>

            {filteredVillages.length === 0 ? (
              <div className="nx-card p-8 text-center text-sm text-[var(--nx-text-muted)]">
                لا توجد قرى مطابقة للتصفية أو البحث الحالي.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {filteredVillages.map(({ vil, acc, live }) => {
                  const tile = buildVillageRadarTileData(vil, acc, live, state);
                  const isActive = state.activeVillageId === vil.id;
                  const statusTextColor =
                    tile.tone === 'critical'
                      ? 'text-[var(--nx-coral)]'
                      : tile.tone === 'warning'
                        ? 'text-[var(--nx-amber)]'
                        : tile.tone === 'ready'
                          ? 'text-[var(--nx-indigo)]'
                          : 'text-[var(--nx-emerald)]';

                  return (
                    <button
                      key={vil.id}
                      type="button"
                      onClick={() => setRadarVillageId(vil.id)}
                      aria-label={`تفاصيل ${tile.villageName} · ${tile.statusLabel}`}
                      className={`nx-transition flex min-h-[86px] cursor-pointer flex-col justify-between gap-1.5 rounded-[var(--nx-radius-md)] border p-2.5 text-start ${radarToneStyle(tile.tone, isActive)}`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <span className="truncate text-xs font-bold text-[var(--nx-text-primary)]">
                          {tile.villageName}
                        </span>
                        <span className={`font-mono-num shrink-0 text-[11px] font-bold ${statusTextColor}`}>
                          {tile.etaText}
                        </span>
                      </div>

                      <div className="truncate text-[11px] text-[var(--nx-text-muted)]">
                        K{tile.continent} · {tile.accountName}
                      </div>

                      <div className="flex items-center justify-between gap-1 border-t border-[var(--nx-border)]/70 pt-1 text-[11px]">
                        <span className={`truncate font-semibold ${statusTextColor}`}>
                          {tile.statusLabel}
                        </span>
                        <span className="font-mono-num shrink-0 font-bold text-[var(--nx-text-secondary)]">
                          {tile.dailyPPText}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
        </>
      )}

      {/* Radar Village Detail Popup */}
      <VillageRadarModal
        village={radarSelectedContext?.vil || null}
        account={radarSelectedContext?.acc || null}
        live={radarSelectedContext?.live || null}
        state={state}
        isActive={radarSelectedContext ? state.activeVillageId === radarSelectedContext.vil.id : false}
        onClose={() => setRadarVillageId(null)}
        onSelectActive={onSelectActiveVillage}
        onSetVillageRole={onSetVillageRole}
        onOpenMissionModal={onOpenMissionModal}
        onOpenVillageModal={onOpenVillageModal}
        onOpenAccountFlow={onOpenPPFlowModal}
        onOpenVillageDetail={(vid) => navigate(`/villages/${encodeURIComponent(vid)}`)}
      />
    </div>
  );
}
