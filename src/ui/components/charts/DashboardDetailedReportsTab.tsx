import { useMemo, useState } from 'react';
import {
  BarChart3,
  Castle,
  Coins,
  Database,
  ExternalLink,
  RefreshCw,
  TrendingUp,
  Warehouse
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {
  formatPPAndCurrency,
  formatTimeAgo,
  type ErpAppState,
  type SyncStatusState
} from '../../../core';
import {
  buildDashboardGrowthReport,
  type ContinentGrowthBreakdown,
  type GrowthReportRangeDays,
  type GrowthVillageContext,
  type ResourceGrowthPoint,
  type VillageGrowthPoint
} from '../../growthReportViewModel';
import { DeltaBadge, ScreenEmptyState } from '../StateViews';

interface DashboardDetailedReportsTabProps {
  state: ErpAppState;
  filteredVillages: GrowthVillageContext[];
  syncStatus?: SyncStatusState;
  onRefreshData?: () => Promise<void> | void;
  onOpenVillage: (villageId: string) => void;
  onOpenFullReports: () => void;
  onOpenSyncModal: () => void;
}

interface ResourceTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: ResourceGrowthPoint }>;
  mode: 'daily' | 'cumulative';
}

function ResourceGrowthTooltip({ active, payload, mode }: ResourceTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const pt = payload[0]?.payload;
  if (!pt) return null;

  return (
    <div
      dir="rtl"
      className="min-w-[215px] rounded-[var(--nx-radius-md)] border border-[var(--nx-border-strong)] bg-[var(--nx-bg-surface)] p-3 text-xs shadow-lg"
    >
      <div className="mb-2 flex items-center justify-between gap-2 border-b border-[var(--nx-border)] pb-1.5">
        <span className="font-bold text-[var(--nx-text-primary)]">{pt.fullDateLabel}</span>
        {pt.hasRecordedSync && (
          <span className="text-[10px] font-semibold text-[var(--nx-emerald)]">مزامنة موثقة</span>
        )}
      </div>
      <dl className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-[var(--nx-text-secondary)]">الخشب:</dt>
          <dd className="font-mono-num font-bold text-[#6366f1]">
            <bdi dir="ltr">{pt.woodK.toLocaleString('en-US')} K</bdi>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-[var(--nx-text-secondary)]">الطمي:</dt>
          <dd className="font-mono-num font-bold text-[#f59e0b]">
            <bdi dir="ltr">{pt.clayK.toLocaleString('en-US')} K</bdi>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-[var(--nx-text-secondary)]">الحديد:</dt>
          <dd className="font-mono-num font-bold text-[#3b82f6]">
            <bdi dir="ltr">{pt.ironK.toLocaleString('en-US')} K</bdi>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-[var(--nx-text-secondary)]">غنائم الإغارات:</dt>
          <dd className="font-mono-num font-bold text-[#14b8a6]">
            <bdi dir="ltr">{pt.raidK.toLocaleString('en-US')} K</bdi>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-[var(--nx-border)] pt-1.5 font-bold">
          <dt className="text-[var(--nx-text-primary)]">
            {mode === 'cumulative' ? 'الإجمالي التراكمي:' : 'الإجمالي اليومي:'}
          </dt>
          <dd className="font-mono-num text-[var(--nx-text-primary)]">
            <bdi dir="ltr">
              {(mode === 'cumulative' ? pt.cumulativeTotalK : pt.totalDailyK).toLocaleString('en-US')} K
            </bdi>
          </dd>
        </div>
      </dl>
    </div>
  );
}

interface VillageTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: VillageGrowthPoint }>;
}

function VillageGrowthTooltip({ active, payload }: VillageTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const pt = payload[0]?.payload;
  if (!pt) return null;

  return (
    <div
      dir="rtl"
      className="min-w-[215px] rounded-[var(--nx-radius-md)] border border-[var(--nx-border-strong)] bg-[var(--nx-bg-surface)] p-3 text-xs shadow-lg"
    >
      <div className="mb-2 border-b border-[var(--nx-border)] pb-1.5 font-bold text-[var(--nx-text-primary)]">
        {pt.fullDateLabel}
      </div>
      <dl className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-[var(--nx-text-secondary)]">عدد القرى النشطة:</dt>
          <dd className="font-mono-num font-bold text-[var(--nx-indigo)]">
            {pt.villagesCount.toLocaleString('en-US')}
            {pt.newVillagesCount > 0 ? ` (+${pt.newVillagesCount})` : ''}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-[var(--nx-text-secondary)]">إجمالي نقاط القرى:</dt>
          <dd className="font-mono-num font-bold text-[var(--nx-emerald)]">
            {pt.totalPoints.toLocaleString('en-US')} ن.ق
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-[var(--nx-text-secondary)]">متوسط النقاط / قرية:</dt>
          <dd className="font-mono-num font-semibold text-[var(--nx-text-primary)]">
            {pt.avgPointsPerVillage.toLocaleString('en-US')} ن.ق
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-[var(--nx-border)] pt-1.5">
          <dt className="text-[var(--nx-text-secondary)]">رصيد التميز المسجل:</dt>
          <dd className="font-mono-num font-bold text-[var(--nx-amber)]">
            {pt.totalPP.toLocaleString('en-US')} PP
          </dd>
        </div>
      </dl>
    </div>
  );
}

interface ContinentTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: ContinentGrowthBreakdown }>;
}

function ContinentBreakdownTooltip({ active, payload }: ContinentTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div
      dir="rtl"
      className="min-w-[200px] rounded-[var(--nx-radius-md)] border border-[var(--nx-border-strong)] bg-[var(--nx-bg-surface)] p-3 text-xs shadow-lg"
    >
      <div className="mb-2 flex items-center justify-between gap-2 border-b border-[var(--nx-border)] pb-1.5 font-bold text-[var(--nx-text-primary)]">
        <span>قارة {row.label}</span>
        <span className="font-mono-num text-[var(--nx-indigo)]">{row.villagesCount} قرية</span>
      </div>
      <dl className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-[var(--nx-text-secondary)]">خشب يومي:</dt>
          <dd className="font-mono-num font-bold text-[#6366f1]">
            <bdi dir="ltr">{row.woodDailyK.toLocaleString('en-US')} K</bdi>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-[var(--nx-text-secondary)]">طمي يومي:</dt>
          <dd className="font-mono-num font-bold text-[#f59e0b]">
            <bdi dir="ltr">{row.clayDailyK.toLocaleString('en-US')} K</bdi>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-[var(--nx-text-secondary)]">حديد يومي:</dt>
          <dd className="font-mono-num font-bold text-[#3b82f6]">
            <bdi dir="ltr">{row.ironDailyK.toLocaleString('en-US')} K</bdi>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-[var(--nx-border)] pt-1">
          <dt className="text-[var(--nx-text-secondary)]">إجمالي النقاط:</dt>
          <dd className="font-mono-num font-bold text-[var(--nx-text-primary)]">
            {row.totalPoints.toLocaleString('en-US')} ن.ق
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function DashboardDetailedReportsTab({
  state,
  filteredVillages,
  syncStatus,
  onRefreshData,
  onOpenVillage,
  onOpenFullReports,
  onOpenSyncModal
}: DashboardDetailedReportsTabProps) {
  const [rangeDays, setRangeDays] = useState<GrowthReportRangeDays>(14);
  const [resourceViewMode, setResourceViewMode] = useState<'daily' | 'cumulative'>('daily');
  const [villageMetricMode, setVillageMetricMode] = useState<'points' | 'pp'>('points');
  const [showWood, setShowWood] = useState(true);
  const [showClay, setShowClay] = useState(true);
  const [showIron, setShowIron] = useState(true);
  const [showRaid, setShowRaid] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const report = useMemo(
    () => buildDashboardGrowthReport(state, filteredVillages, rangeDays),
    [state, filteredVillages, rangeDays]
  );

  const ppFormatted = formatPPAndCurrency(report.kpis.totalPP, state, {
    decimals: 0,
    unit: 'نقطة'
  });

  async function handleRefreshClick() {
    if (!onRefreshData || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefreshData();
    } finally {
      setIsRefreshing(false);
    }
  }

  if (filteredVillages.length === 0) {
    return (
      <ScreenEmptyState
        title="لا توجد بيانات قرى في النطاق المحدد"
        description="قم بمزامنة قراك من اللعبة أو أزل تصفية العالم لعرض تقارير نمو الموارد والقرى بمرور الوقت من Firestore."
        actionLabel="فتح مركز المزامنة"
        onAction={onOpenSyncModal}
      />
    );
  }

  return (
    <div data-testid="dashboard-detailed-reports-tab" className="space-y-4">
      {/* Toolbar: Time Range & Firestore Source Controls */}
      <div className="nx-card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-[var(--nx-text-primary)]">
            التقارير التفصيلية لنمو الموارد والقرى
          </h2>
          <p className="mt-0.5 text-xs text-[var(--nx-text-muted)]">
            <span>مصدر البيانات: Firestore</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span className="font-mono-num">{report.kpis.villagesCount} قرية</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span>
              آخر تحديث:{' '}
              {syncStatus?.lastSyncAt ? formatTimeAgo(syncStatus.lastSyncAt) : 'محفوظ محلياً'}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="الفترة الزمنية للتقارير التفصيلية"
            className="inline-flex items-center rounded-[var(--nx-radius-sm)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] p-0.5"
          >
            {([7, 14, 30] as const).map((days) => (
              <button
                key={days}
                type="button"
                data-testid={`growth-range-${days}`}
                aria-pressed={rangeDays === days}
                onClick={() => setRangeDays(days)}
                className={`min-h-[34px] shrink-0 cursor-pointer whitespace-nowrap rounded-[var(--nx-radius-xs)] px-3 text-xs font-semibold transition-colors ${
                  rangeDays === days
                    ? 'bg-[var(--nx-bg-surface)] text-[var(--nx-indigo)] shadow-xs'
                    : 'text-[var(--nx-text-muted)] hover:text-[var(--nx-text-primary)]'
                }`}
              >
                {days === 30 ? '30 يوماً' : `${days} أيام`}
              </button>
            ))}
          </div>

          {onRefreshData && (
            <button
              type="button"
              data-testid="growth-refresh-firestore"
              onClick={() => void handleRefreshClick()}
              disabled={isRefreshing}
              className="nx-btn nx-btn-outline nx-btn-compact whitespace-nowrap shrink-0"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>{isRefreshing ? 'جاري التحديث...' : 'تحديث Firestore'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenFullReports}
            className="nx-btn nx-btn-outline nx-btn-compact whitespace-nowrap shrink-0"
          >
            <span>صفحة التقارير الكاملة</span>
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* 4 Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="nx-card space-y-1.5 p-4">
          <div className="flex items-center justify-between text-xs text-[var(--nx-text-muted)]">
            <span>إنتاج الموارد اليومي</span>
            <TrendingUp className="h-4 w-4 text-[var(--nx-indigo)]" aria-hidden="true" />
          </div>
          <div className="font-mono-num text-xl font-bold text-[var(--nx-text-primary)]">
            <bdi dir="ltr">{(report.kpis.dailyResourcesTotal / 1000).toFixed(1)}K</bdi>
            <span className="ms-1 text-xs font-medium text-[var(--nx-text-muted)]">مورد/يوم</span>
          </div>
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <DeltaBadge
              label={`${report.kpis.resourceGrowthPct >= 0 ? '+' : ''}${report.kpis.resourceGrowthPct}% خلال ${rangeDays}ي`}
              direction={report.kpis.resourceGrowthPct >= 0 ? 'up' : 'down'}
            />
            <span className="font-mono-num text-[var(--nx-text-muted)]">
              إغارة {(report.kpis.raidDaily / 1000).toFixed(1)}K
            </span>
          </div>
        </article>

        <article className="nx-card space-y-1.5 p-4">
          <div className="flex items-center justify-between text-xs text-[var(--nx-text-muted)]">
            <span>نمو القرى والنقاط</span>
            <Castle className="h-4 w-4 text-[var(--nx-emerald)]" aria-hidden="true" />
          </div>
          <div className="font-mono-num flex items-baseline gap-2 text-xl font-bold text-[var(--nx-text-primary)]">
            <span>{report.kpis.villagesCount}</span>
            <span className="text-xs font-medium text-[var(--nx-text-muted)]">قرية</span>
            <span className="text-sm font-bold text-[var(--nx-emerald)]">
              · {report.kpis.totalVillagePoints.toLocaleString('en-US')} ن.ق
            </span>
          </div>
          <div className="text-[11px] text-[var(--nx-text-muted)]">
            متوسط القرية:{' '}
            <span className="font-mono-num font-semibold text-[var(--nx-text-secondary)]">
              {report.kpis.avgVillagePoints.toLocaleString('en-US')} ن.ق
            </span>
            {report.kpis.villagesAddedInRange > 0 && (
              <>
                <span className="mx-1" aria-hidden="true">·</span>
                <span className="font-mono-num font-semibold text-[var(--nx-emerald)]">
                  +{report.kpis.villagesAddedInRange} بالفترة
                </span>
              </>
            )}
          </div>
        </article>

        <article className="nx-card space-y-1.5 p-4">
          <div className="flex items-center justify-between text-xs text-[var(--nx-text-muted)]">
            <span>إجمالي المخزون الحالي</span>
            <Warehouse className="h-4 w-4 text-[var(--nx-amber)]" aria-hidden="true" />
          </div>
          <div className="font-mono-num text-xl font-bold text-[var(--nx-text-primary)]">
            <bdi dir="ltr">{(report.kpis.currentStockTotal / 1000).toFixed(1)}K</bdi>
            <span className="ms-1 text-xs font-medium text-[var(--nx-text-muted)]">مورد</span>
          </div>
          <div className="text-[11px] text-[var(--nx-text-muted)]">
            متوسط امتلاء المخازن:{' '}
            <span className="font-mono-num font-semibold text-[var(--nx-text-secondary)]">
              {report.kpis.avgWarehouseFillPct}%
            </span>
          </div>
        </article>

        <article className="nx-card space-y-1.5 p-4">
          <div className="flex items-center justify-between text-xs text-[var(--nx-text-muted)]">
            <span>رصيد التميز (Firestore)</span>
            <Coins className="h-4 w-4 text-[var(--nx-teal)]" aria-hidden="true" />
          </div>
          <div className="font-mono-num flex flex-wrap items-baseline gap-1.5 text-xl font-bold text-[var(--nx-text-primary)]">
            <span>{ppFormatted.ppText}</span>
            <span className="text-xs font-semibold text-[var(--nx-indigo)]">
              / {ppFormatted.moneyText}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <DeltaBadge
              label={`${report.kpis.periodNetPP >= 0 ? '+' : ''}${report.kpis.periodNetPP} PP (${rangeDays}ي)`}
              direction={report.kpis.periodNetPP >= 0 ? 'up' : 'down'}
            />
            <span className="font-mono-num text-[var(--nx-text-muted)]">
              {report.kpis.syncedDaysCount} يوم موثق
            </span>
          </div>
        </article>
      </div>

      {/* Primary Charts Grid: Resource Growth + Village Growth */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* Chart 1: Resource Growth Over Time (Recharts AreaChart) */}
        <section
          aria-labelledby="resource-growth-chart-heading"
          className="nx-card space-y-4 p-4 sm:p-5 xl:col-span-7"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--nx-border)] pb-3">
            <div className="min-w-0">
              <h3
                id="resource-growth-chart-heading"
                className="text-[15px] font-bold text-[var(--nx-text-primary)]"
              >
                نمو الموارد بمرور الوقت (خشب · طمي · حديد · إغارات)
              </h3>
              <p className="mt-0.5 text-xs text-[var(--nx-text-muted)]">
                تطور الإنتاج اليومي والتراكمي بالآلاف (K) بناءً على مستويات المناجم وجلسات Firestore
              </p>
            </div>

            <div
              role="group"
              aria-label="نمط عرض مخطط نمو الموارد"
              className="inline-flex items-center rounded-[var(--nx-radius-sm)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] p-0.5"
            >
              <button
                type="button"
                data-testid="resource-mode-daily"
                aria-pressed={resourceViewMode === 'daily'}
                onClick={() => setResourceViewMode('daily')}
                className={`min-h-[30px] shrink-0 cursor-pointer whitespace-nowrap rounded-[var(--nx-radius-xs)] px-2.5 text-xs font-semibold transition-colors ${
                  resourceViewMode === 'daily'
                    ? 'bg-[var(--nx-bg-surface)] text-[var(--nx-indigo)] shadow-xs'
                    : 'text-[var(--nx-text-muted)] hover:text-[var(--nx-text-primary)]'
                }`}
              >
                الإنتاج اليومي
              </button>
              <button
                type="button"
                data-testid="resource-mode-cumulative"
                aria-pressed={resourceViewMode === 'cumulative'}
                onClick={() => setResourceViewMode('cumulative')}
                className={`min-h-[30px] shrink-0 cursor-pointer whitespace-nowrap rounded-[var(--nx-radius-xs)] px-2.5 text-xs font-semibold transition-colors ${
                  resourceViewMode === 'cumulative'
                    ? 'bg-[var(--nx-bg-surface)] text-[var(--nx-indigo)] shadow-xs'
                    : 'text-[var(--nx-text-muted)] hover:text-[var(--nx-text-primary)]'
                }`}
              >
                النمو التراكمي
              </button>
            </div>
          </div>

          {/* Series Filter Toggles (Daily Breakdown mode) */}
          {resourceViewMode === 'daily' && (
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="إظهار وإخفاء الموارد">
              {(
                [
                  { key: 'wood', label: 'الخشب', active: showWood, toggle: () => setShowWood((v) => !v), color: '#6366f1' },
                  { key: 'clay', label: 'الطمي', active: showClay, toggle: () => setShowClay((v) => !v), color: '#f59e0b' },
                  { key: 'iron', label: 'الحديد', active: showIron, toggle: () => setShowIron((v) => !v), color: '#3b82f6' },
                  { key: 'raid', label: 'الإغارات', active: showRaid, toggle: () => setShowRaid((v) => !v), color: '#14b8a6' }
                ] as const
              ).map((s) => (
                <button
                  key={s.key}
                  type="button"
                  aria-pressed={s.active}
                  onClick={s.toggle}
                  className={`inline-flex min-h-[32px] shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[var(--nx-radius-xs)] border px-2.5 text-xs font-semibold transition-colors ${
                    s.active
                      ? 'border-[var(--nx-border-strong)] bg-[var(--nx-bg-surface)] text-[var(--nx-text-primary)]'
                      : 'border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] text-[var(--nx-text-muted)] opacity-60'
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-xs"
                    style={{ backgroundColor: s.color }}
                    aria-hidden="true"
                  />
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          )}

          <div data-testid="recharts-resource-growth" dir="ltr" className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={report.resourceSeries}
                margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="gradWood" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.04} />
                  </linearGradient>
                  <linearGradient id="gradClay" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.04} />
                  </linearGradient>
                  <linearGradient id="gradIron" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.04} />
                  </linearGradient>
                  <linearGradient id="gradRaid" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.04} />
                  </linearGradient>
                  <linearGradient id="gradCumulative" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.42} />
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--nx-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'var(--nx-text-muted)', fontSize: 11 }}
                  axisLine={{ stroke: 'var(--nx-border)' }}
                  tickLine={false}
                  minTickGap={16}
                />
                <YAxis
                  tick={{ fill: 'var(--nx-text-muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `${v}K`}
                  width={48}
                />
                <Tooltip content={<ResourceGrowthTooltip mode={resourceViewMode} />} />

                {resourceViewMode === 'cumulative' ? (
                  <Area
                    type="monotone"
                    dataKey="cumulativeTotalK"
                    name="الإجمالي التراكمي (K)"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    fill="url(#gradCumulative)"
                  />
                ) : (
                  <>
                    {showWood && (
                      <Area
                        type="monotone"
                        dataKey="woodK"
                        name="الخشب (K)"
                        stackId="res"
                        stroke="#6366f1"
                        strokeWidth={1.8}
                        fill="url(#gradWood)"
                      />
                    )}
                    {showClay && (
                      <Area
                        type="monotone"
                        dataKey="clayK"
                        name="الطمي (K)"
                        stackId="res"
                        stroke="#f59e0b"
                        strokeWidth={1.8}
                        fill="url(#gradClay)"
                      />
                    )}
                    {showIron && (
                      <Area
                        type="monotone"
                        dataKey="ironK"
                        name="الحديد (K)"
                        stackId="res"
                        stroke="#3b82f6"
                        strokeWidth={1.8}
                        fill="url(#gradIron)"
                      />
                    )}
                    {showRaid && (
                      <Area
                        type="monotone"
                        dataKey="raidK"
                        name="الإغارات (K)"
                        stackId="res"
                        stroke="#14b8a6"
                        strokeWidth={1.8}
                        fill="url(#gradRaid)"
                      />
                    )}
                  </>
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Chart 2: Villages & Points/PP Growth Over Time (Recharts ComposedChart) */}
        <section
          aria-labelledby="village-growth-chart-heading"
          className="nx-card space-y-4 p-4 sm:p-5 xl:col-span-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--nx-border)] pb-3">
            <div className="min-w-0">
              <h3
                id="village-growth-chart-heading"
                className="text-[15px] font-bold text-[var(--nx-text-primary)]"
              >
                نمو القرى وتطور القوة
              </h3>
              <p className="mt-0.5 text-xs text-[var(--nx-text-muted)]">
                عدد القرى النشطة مقابل {villageMetricMode === 'points' ? 'نقاط القرى (ن.ق)' : 'رصيد التميز (PP)'}
              </p>
            </div>

            <div
              role="group"
              aria-label="المقياس المقارن لنمو القرى"
              className="inline-flex items-center rounded-[var(--nx-radius-sm)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] p-0.5"
            >
              <button
                type="button"
                data-testid="village-metric-points"
                aria-pressed={villageMetricMode === 'points'}
                onClick={() => setVillageMetricMode('points')}
                className={`min-h-[30px] shrink-0 cursor-pointer whitespace-nowrap rounded-[var(--nx-radius-xs)] px-2.5 text-xs font-semibold transition-colors ${
                  villageMetricMode === 'points'
                    ? 'bg-[var(--nx-bg-surface)] text-[var(--nx-emerald)] shadow-xs'
                    : 'text-[var(--nx-text-muted)] hover:text-[var(--nx-text-primary)]'
                }`}
              >
                نقاط القرى
              </button>
              <button
                type="button"
                data-testid="village-metric-pp"
                aria-pressed={villageMetricMode === 'pp'}
                onClick={() => setVillageMetricMode('pp')}
                className={`min-h-[30px] shrink-0 cursor-pointer whitespace-nowrap rounded-[var(--nx-radius-xs)] px-2.5 text-xs font-semibold transition-colors ${
                  villageMetricMode === 'pp'
                    ? 'bg-[var(--nx-bg-surface)] text-[var(--nx-amber)] shadow-xs'
                    : 'text-[var(--nx-text-muted)] hover:text-[var(--nx-text-primary)]'
                }`}
              >
                نقاط التميز
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--nx-text-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-[#6366f1]" aria-hidden="true" />
              <span>عدد القرى النشطة</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-xs"
                style={{ backgroundColor: villageMetricMode === 'points' ? '#10b981' : '#f59e0b' }}
                aria-hidden="true"
              />
              <span>{villageMetricMode === 'points' ? 'إجمالي النقاط (ن.ق)' : 'رصيد التميز (PP)'}</span>
            </span>
          </div>

          <div data-testid="recharts-village-growth" dir="ltr" className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={report.villageSeries}
                margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid stroke="var(--nx-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'var(--nx-text-muted)', fontSize: 11 }}
                  axisLine={{ stroke: 'var(--nx-border)' }}
                  tickLine={false}
                  minTickGap={16}
                />
                <YAxis
                  yAxisId="vils"
                  allowDecimals={false}
                  tick={{ fill: 'var(--nx-text-muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={34}
                />
                <YAxis
                  yAxisId="metric"
                  orientation="right"
                  tick={{
                    fill: villageMetricMode === 'points' ? '#10b981' : '#f59e0b',
                    fontSize: 11
                  }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}K` : `${v}`)}
                  width={48}
                />
                <Tooltip content={<VillageGrowthTooltip />} />
                <Bar
                  yAxisId="vils"
                  dataKey="villagesCount"
                  name="عدد القرى"
                  fill="#6366f1"
                  fillOpacity={0.78}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={26}
                />
                <Line
                  yAxisId="metric"
                  type="monotone"
                  dataKey={villageMetricMode === 'points' ? 'totalPoints' : 'totalPP'}
                  name={villageMetricMode === 'points' ? 'نقاط القرى' : 'نقاط التميز'}
                  stroke={villageMetricMode === 'points' ? '#10b981' : '#f59e0b'}
                  strokeWidth={2.5}
                  dot={{ r: 3, strokeWidth: 0, fill: villageMetricMode === 'points' ? '#10b981' : '#f59e0b' }}
                  activeDot={{ r: 5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Bottom Split: Continent Production Comparison (Recharts BarChart) + Village Growth Table */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* Chart 3: Continent Resource Production Breakdown */}
        <section
          aria-labelledby="continent-growth-chart-heading"
          className="nx-card space-y-4 p-4 sm:p-5 xl:col-span-5"
        >
          <div className="flex items-center justify-between gap-2 border-b border-[var(--nx-border)] pb-3">
            <div>
              <h3
                id="continent-growth-chart-heading"
                className="text-[15px] font-bold text-[var(--nx-text-primary)]"
              >
                إنتاج الموارد حسب القارات
              </h3>
              <p className="mt-0.5 text-xs text-[var(--nx-text-muted)]">
                مقارنة الخشب والطمي والحديد اليومي (K) بين K44 – K55
              </p>
            </div>
            <BarChart3 className="h-4 w-4 text-[var(--nx-indigo)]" aria-hidden="true" />
          </div>

          <div data-testid="recharts-continent-growth" dir="ltr" className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={report.continentBreakdown}
                margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid stroke="var(--nx-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'var(--nx-text-muted)', fontSize: 11 }}
                  axisLine={{ stroke: 'var(--nx-border)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'var(--nx-text-muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `${v}K`}
                  width={44}
                />
                <Tooltip content={<ContinentBreakdownTooltip />} />
                <Bar dataKey="woodDailyK" name="خشب (K)" stackId="c" fill="#6366f1" maxBarSize={38} />
                <Bar dataKey="clayDailyK" name="طمي (K)" stackId="c" fill="#f59e0b" maxBarSize={38} />
                <Bar
                  dataKey="ironDailyK"
                  name="حديد (K)"
                  stackId="c"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={38}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Detailed Villages Performance & Growth Ledger */}
        <section
          aria-labelledby="villages-growth-table-heading"
          className="nx-card overflow-hidden p-4 sm:p-5 xl:col-span-7"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--nx-border)] pb-3">
            <div>
              <h3
                id="villages-growth-table-heading"
                className="text-[15px] font-bold text-[var(--nx-text-primary)]"
              >
                تفاصيل إنتاج ونمو القرى ({report.villageRows.length})
              </h3>
              <p className="mt-0.5 text-xs text-[var(--nx-text-muted)]">
                مرتبة حسب أعلى إنتاج يومي من الموارد · اضغط على أي قرية لفتح نافذتها التفصيلية
              </p>
            </div>
            <Database className="h-4 w-4 text-[var(--nx-text-muted)]" aria-hidden="true" />
          </div>

          <div className="max-h-[260px] overflow-auto">
            <table className="w-full min-w-[540px] border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-[var(--nx-bg-surface)] text-[11px] text-[var(--nx-text-muted)]">
                <tr className="border-b border-[var(--nx-border)]">
                  <th className="py-2 pe-2 text-start font-semibold">القرية</th>
                  <th className="px-2 py-2 text-start font-semibold">القارة</th>
                  <th className="px-2 py-2 text-end font-semibold">النقاط</th>
                  <th className="px-2 py-2 text-end font-semibold">موارد/يوم</th>
                  <th className="px-2 py-2 text-end font-semibold">المخزون</th>
                  <th className="py-2 ps-2 text-end font-semibold">آخر مزامنة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--nx-border)]">
                {report.villageRows.map((row) => (
                  <tr
                    key={row.villageId}
                    className="transition-colors hover:bg-[var(--nx-bg-subtle)]"
                  >
                    <td className="py-2.5 pe-2">
                      <button
                        type="button"
                        onClick={() => onOpenVillage(row.villageId)}
                        className="cursor-pointer text-start font-bold text-[var(--nx-indigo)] hover:underline"
                      >
                        {row.villageName}
                      </button>
                      <div className="text-[11px] text-[var(--nx-text-muted)]">
                        {row.accountName} · <span dir="ltr" className="font-mono-num">{row.coord}</span>
                      </div>
                    </td>
                    <td className="font-mono-num px-2 py-2.5 font-semibold text-[var(--nx-text-secondary)]">
                      K{row.continent}
                    </td>
                    <td className="font-mono-num px-2 py-2.5 text-end font-semibold text-[var(--nx-text-primary)]">
                      {row.points.toLocaleString('en-US')}
                    </td>
                    <td className="font-mono-num px-2 py-2.5 text-end font-bold text-[var(--nx-text-primary)]">
                      <bdi dir="ltr">{(row.totalDailyRes / 1000).toFixed(1)}K</bdi>
                    </td>
                    <td className="font-mono-num px-2 py-2.5 text-end">
                      <span className="font-semibold text-[var(--nx-text-secondary)]">
                        <bdi dir="ltr">{(row.currentStockTotal / 1000).toFixed(1)}K</bdi>
                      </span>
                      <span className="ms-1 text-[10px] text-[var(--nx-text-muted)]">
                        ({row.warehouseFillPct}%)
                      </span>
                    </td>
                    <td className="py-2.5 ps-2 text-end text-[11px] text-[var(--nx-text-muted)]">
                      {row.lastSyncTs ? formatTimeAgo(row.lastSyncTs) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
