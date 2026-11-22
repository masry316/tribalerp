import { useMemo, useState } from 'react';
import { ChevronDown, Swords } from 'lucide-react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import type {
  DashboardResAttackPoint,
  DashboardResourcesAndAttacksSummary
} from '../../viewModels';

interface ResourcesAttacksRechartProps {
  data: DashboardResourcesAndAttacksSummary;
  rangeDays: 7 | 14;
  selectedAccountId: string;
  onSelectRangeDays: (days: 7 | 14) => void;
  onSelectAccountId: (accountId: string) => void;
  onOpenAccountFlow?: (accountId: string) => void;
}

interface CustomTooltipPayloadItem {
  dataKey?: string;
  name?: string;
  value?: number;
  payload?: DashboardResAttackPoint;
}

function ResourcesAttacksTooltip({
  active,
  payload
}: {
  active?: boolean;
  payload?: CustomTooltipPayloadItem[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const pt = payload[0]?.payload;
  if (!pt) return null;

  return (
    <div
      dir="rtl"
      className="min-w-[210px] rounded-[var(--nx-radius-md)] border border-[var(--nx-border-strong)] bg-[var(--nx-bg-surface)] p-3 text-xs shadow-lg"
    >
      <div className="mb-2 border-b border-[var(--nx-border)] pb-1.5 font-bold text-[var(--nx-text-primary)]">
        {pt.relativeLabel}
      </div>
      <dl className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-[var(--nx-text-secondary)]">موارد المناجم:</dt>
          <dd className="font-mono-num font-bold text-[var(--nx-indigo)]">
            <bdi dir="ltr">{pt.mineResourcesK.toLocaleString('en-US')} K</bdi>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-[var(--nx-text-secondary)]">غنائم الهجمات والإغارات:</dt>
          <dd className="font-mono-num font-bold text-[var(--nx-teal)]">
            <bdi dir="ltr">{pt.raidResourcesK.toLocaleString('en-US')} K</bdi>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-[var(--nx-text-secondary)]">عدد الهجمات / الجولات:</dt>
          <dd className="font-mono-num font-bold text-[var(--nx-amber)]">
            {pt.attacksCount}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-[var(--nx-border)] pt-1 text-[11px] text-[var(--nx-text-muted)]">
          <dt>الحسابات النشطة:</dt>
          <dd className="font-mono-num font-semibold">{pt.activeAccountsCount}</dd>
        </div>
      </dl>
    </div>
  );
}

export function ResourcesAttacksRechart({
  data,
  rangeDays,
  selectedAccountId,
  onSelectRangeDays,
  onSelectAccountId,
  onOpenAccountFlow
}: ResourcesAttacksRechartProps) {
  const [showMines, setShowMines] = useState(true);
  const [showRaids, setShowRaids] = useState(true);
  const [showAttacks, setShowAttacks] = useState(true);

  const activeAccountObj = useMemo(
    () => data.accountOptions.find((a) => a.id === selectedAccountId) || null,
    [data.accountOptions, selectedAccountId]
  );

  return (
    <section
      aria-labelledby="recharts-res-attacks-heading"
      className="nx-card space-y-4 p-5"
    >
      {/* Header & Interactive Controls */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--nx-radius-sm)] bg-[var(--nx-bg-subtle)] text-[var(--nx-indigo)]">
            <Swords className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2
              id="recharts-res-attacks-heading"
              className="truncate text-[15px] font-bold text-[var(--nx-text-primary)]"
            >
              تحليلات الموارد والهجمات عبر الأيام
            </h2>
            <p className="text-[11px] text-[var(--nx-text-muted)]">
              {activeAccountObj
                ? `نطاق التحليل: ${activeAccountObj.name} (${activeAccountObj.villagesCount} قرية) · ذروة النشاط: ${data.peakDayLabel}`
                : `مقارنة الموارد المنتجة والمنهوبة مع وتيرة الهجمات والإغارات · ذروة النشاط: ${data.peakDayLabel}`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Account Scope Select */}
          <div className="relative">
            <select
              aria-label="تصفية تحليلات الموارد والهجمات حسب الحساب"
              value={selectedAccountId}
              onChange={(e) => onSelectAccountId(e.target.value)}
              className="nx-select nx-select-compact min-w-[140px] cursor-pointer appearance-none pe-3 ps-7 text-xs font-medium"
            >
              <option value="all">كل الحسابات ({data.accountOptions.length})</option>
              {data.accountOptions.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.villagesCount})
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--nx-text-muted)]"
              aria-hidden="true"
            />
          </div>

          {/* Range Segmented Control */}
          <div
            role="group"
            aria-label="نطاق الأيام لتحليل الموارد والهجمات"
            className="flex items-center rounded-[var(--nx-radius-sm)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] p-0.5"
          >
            {([7, 14] as const).map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => onSelectRangeDays(days)}
                className={`min-h-[32px] cursor-pointer whitespace-nowrap rounded-[var(--nx-radius-xs)] px-2.5 text-xs font-semibold transition-colors ${
                  rangeDays === days
                    ? 'bg-[var(--nx-bg-surface)] text-[var(--nx-indigo)] shadow-sm'
                    : 'text-[var(--nx-text-muted)] hover:text-[var(--nx-text-primary)]'
                }`}
              >
                {days} أيام
              </button>
            ))}
          </div>

          {activeAccountObj && onOpenAccountFlow && (
            <button
              type="button"
              onClick={() => onOpenAccountFlow(activeAccountObj.id)}
              className="nx-btn nx-btn-outline nx-btn-compact whitespace-nowrap"
            >
              تفاصيل {activeAccountObj.name}
            </button>
          )}
        </div>
      </div>

      {/* Summary KPIs Strip + Series Toggles */}
      <div className="flex flex-col gap-3 border-y border-[var(--nx-border)] py-3 lg:flex-row lg:items-center lg:justify-between">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
          <div>
            <dt className="text-[11px] text-[var(--nx-text-muted)]">إنتاج المناجم ({rangeDays} ي)</dt>
            <dd className="font-mono-num mt-0.5 text-base font-bold text-[var(--nx-indigo)]">
              <bdi dir="ltr">{data.totalMineResK.toLocaleString('en-US')} K</bdi>
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-[var(--nx-text-muted)]">غنائم الهجمات ({rangeDays} ي)</dt>
            <dd className="font-mono-num mt-0.5 text-base font-bold text-[var(--nx-teal)]">
              <bdi dir="ltr">{data.totalRaidResK.toLocaleString('en-US')} K</bdi>
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-[var(--nx-text-muted)]">إجمالي الهجمات / الجولات</dt>
            <dd className="font-mono-num mt-0.5 text-base font-bold text-[var(--nx-amber)]">
              {data.totalAttacks.toLocaleString('en-US')}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-[var(--nx-text-muted)]">المتوسط اليومي</dt>
            <dd className="font-mono-num mt-0.5 text-base font-bold text-[var(--nx-text-primary)]">
              <bdi dir="ltr">{data.avgDailyResK.toLocaleString('en-US')}K</bdi> · {data.avgDailyAttacks} هجمة
            </dd>
          </div>
        </dl>

        {/* Interactive Legend Toggles */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            aria-pressed={showMines}
            onClick={() => setShowMines((v) => !v)}
            className={`min-h-[34px] cursor-pointer whitespace-nowrap rounded-[var(--nx-radius-sm)] border px-2.5 text-xs font-semibold transition-colors ${
              showMines
                ? 'border-[var(--nx-indigo)] bg-[var(--nx-indigo-soft)] text-[var(--nx-indigo)]'
                : 'border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] text-[var(--nx-text-muted)]'
            }`}
          >
            موارد المناجم
          </button>
          <button
            type="button"
            aria-pressed={showRaids}
            onClick={() => setShowRaids((v) => !v)}
            className={`min-h-[34px] cursor-pointer whitespace-nowrap rounded-[var(--nx-radius-sm)] border px-2.5 text-xs font-semibold transition-colors ${
              showRaids
                ? 'border-[var(--nx-teal)] bg-[var(--nx-bg-surface)] text-[var(--nx-teal)]'
                : 'border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] text-[var(--nx-text-muted)]'
            }`}
          >
            غنائم الهجمات
          </button>
          <button
            type="button"
            aria-pressed={showAttacks}
            onClick={() => setShowAttacks((v) => !v)}
            className={`min-h-[34px] cursor-pointer whitespace-nowrap rounded-[var(--nx-radius-sm)] border px-2.5 text-xs font-semibold transition-colors ${
              showAttacks
                ? 'border-[var(--nx-amber)] bg-[var(--nx-amber-bg)] text-[var(--nx-amber)]'
                : 'border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] text-[var(--nx-text-muted)]'
            }`}
          >
            وتيرة الهجمات
          </button>
        </div>
      </div>

      {/* Recharts Composed Chart */}
      {data.points.length === 0 ? (
        <div className="py-10 text-center text-xs text-[var(--nx-text-muted)]">
          لا توجد بيانات موارد أو هجمات مسجلة في النطاق المحدد.
        </div>
      ) : (
        <div dir="ltr" className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data.points}
              margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                stroke="var(--nx-border)"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fill: 'var(--nx-text-muted)', fontSize: 11 }}
                axisLine={{ stroke: 'var(--nx-border)' }}
                tickLine={false}
              />
              <YAxis
                yAxisId="res"
                tick={{ fill: 'var(--nx-text-muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${v}K`}
                width={46}
              />
              <YAxis
                yAxisId="atk"
                orientation="right"
                allowDecimals={false}
                tick={{ fill: 'var(--nx-amber)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={34}
              />
              <Tooltip
                cursor={{ fill: 'var(--nx-bg-subtle)', opacity: 0.45 }}
                content={<ResourcesAttacksTooltip />}
              />
              {showMines && (
                <Bar
                  yAxisId="res"
                  dataKey="mineResourcesK"
                  name="موارد المناجم (K)"
                  stackId="resources"
                  fill="var(--nx-indigo)"
                  radius={showRaids ? [0, 0, 0, 0] : [4, 4, 0, 0]}
                  maxBarSize={32}
                />
              )}
              {showRaids && (
                <Bar
                  yAxisId="res"
                  dataKey="raidResourcesK"
                  name="غنائم الهجمات (K)"
                  stackId="resources"
                  fill="var(--nx-teal)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
              )}
              {showAttacks && (
                <Line
                  yAxisId="atk"
                  type="monotone"
                  dataKey="attacksCount"
                  name="عدد الهجمات / الإغارات"
                  stroke="var(--nx-amber)"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: 'var(--nx-amber)', strokeWidth: 0 }}
                  activeDot={{ r: 5.5, fill: 'var(--nx-amber)' }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
