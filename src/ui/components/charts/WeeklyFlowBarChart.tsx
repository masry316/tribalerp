import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, TrendingUp, X } from 'lucide-react';
import { formatPPAndCurrency, type ErpFinance } from '../../../core';
import type { DailyFlowBarPointData } from '../../viewModels';
import { DeltaBadge } from '../StateViews';

export type DailyFlowBarPoint = DailyFlowBarPointData;

interface WeeklyFlowBarChartProps {
  days: DailyFlowBarPointData[];
  periodNetPP: number;
  earnedPeriodNetPP?: number;
  deltaPctText: string;
  earnedDeltaPctText?: string;
  deltaUp: boolean;
  earnedDeltaUp?: boolean;
  hasOnboardingJump?: boolean;
  onboardingJumpPP?: number;
  finance: ErpFinance;
  onSelectRangeDays?: (days: 7 | 14) => void;
  rangeDays: 7 | 14;
  onSelectAccount?: (accountId: string) => void;
}

export function WeeklyFlowBarChart({
  days,
  periodNetPP,
  earnedPeriodNetPP,
  deltaPctText,
  earnedDeltaPctText,
  deltaUp,
  earnedDeltaUp,
  hasOnboardingJump = false,
  onboardingJumpPP = 0,
  finance,
  onSelectRangeDays,
  rangeDays,
  onSelectAccount
}: WeeklyFlowBarChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [pinnedDateKey, setPinnedDateKey] = useState<string | null>(null);
  const [includeOnboarding, setIncludeOnboarding] = useState(false);

  const excludeOnboardingActive = hasOnboardingJump && !includeOnboarding;
  const displayDays = useMemo(() => days.slice(-rangeDays), [days, rangeDays]);
  const recordedDaysCount = useMemo(
    () => displayDays.filter((d) => d.hasRecordedData).length,
    [displayDays]
  );

  useEffect(() => {
    if (!pinnedDateKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPinnedDateKey(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pinnedDateKey]);

  const getDayVal = (d: DailyFlowBarPointData) =>
    excludeOnboardingActive ? d.earnedNetPP : d.netPP;

  const peakIdx = useMemo(() => {
    if (!displayDays.length) return -1;
    let bestI = displayDays.length - 1;
    let bestVal = -Infinity;
    displayDays.forEach((d, idx) => {
      const v = excludeOnboardingActive ? d.earnedNetPP : d.netPP;
      if (v >= bestVal) {
        bestVal = v;
        bestI = idx;
      }
    });
    return bestI;
  }, [displayDays, excludeOnboardingActive]);

  const activeIdx = hoveredIdx !== null ? hoveredIdx : peakIdx;
  const maxAbsVal = useMemo(
    () =>
      Math.max(
        10,
        ...displayDays.map((d) => Math.abs(excludeOnboardingActive ? d.earnedNetPP : d.netPP))
      ),
    [displayDays, excludeOnboardingActive]
  );

  const selectedDay = useMemo(
    () => displayDays.find((d) => d.dateKey === pinnedDateKey) || null,
    [displayDays, pinnedDateKey]
  );

  const shownPeriodNet =
    excludeOnboardingActive && earnedPeriodNetPP !== undefined ? earnedPeriodNetPP : periodNetPP;
  const shownDeltaText =
    excludeOnboardingActive && earnedDeltaPctText ? earnedDeltaPctText : deltaPctText;
  const shownDeltaUp =
    excludeOnboardingActive && earnedDeltaUp !== undefined ? earnedDeltaUp : deltaUp;

  const periodMoney = formatPPAndCurrency(shownPeriodNet, finance, {
    decimals: 0,
    showSign: shownPeriodNet > 0,
    unit: 'نقطة'
  });

  const onboardingFmt = formatPPAndCurrency(onboardingJumpPP, finance, {
    decimals: 0,
    unit: 'نقطة'
  });

  return (
    <section className="nx-card flex h-full flex-col justify-between gap-3.5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--nx-radius-sm)] bg-[var(--nx-bg-subtle)] text-[var(--nx-text-secondary)]">
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h2 className="truncate text-[15px] font-semibold text-[var(--nx-text-primary)]">
              تدفق النقاط اليومي
            </h2>
            <p className="text-[11px] text-[var(--nx-text-muted)]">
              انقر على أي يوم لمعرفة مساهمة كل حساب
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {hasOnboardingJump && (
            <button
              type="button"
              onClick={() => setIncludeOnboarding((v) => !v)}
              title={`تم رصد رصيد استيراد ابتدائي (${onboardingFmt.ppText})`}
              className={`nx-btn nx-btn-outline nx-btn-compact text-[11px] ${
                includeOnboarding
                  ? 'border-[var(--nx-amber)] bg-[var(--nx-amber-bg)] text-[var(--nx-amber)]'
                  : ''
              }`}
            >
              {includeOnboarding ? 'شامل رصيد البدء' : 'صافي الربح فقط'}
            </button>
          )}
          <div className="relative">
            <select
              aria-label="فترة مخطط تدفق النقاط"
              value={rangeDays}
              onChange={(e) => {
                setPinnedDateKey(null);
                onSelectRangeDays?.(Number(e.target.value) === 14 ? 14 : 7);
              }}
              className="nx-select nx-select-compact cursor-pointer appearance-none pe-3 ps-7 font-medium"
            >
              <option value={7}>أسبوعي (7 أيام)</option>
              <option value={14}>آخر 14 يوم</option>
            </select>
            <ChevronDown
              className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--nx-text-muted)]"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="font-mono-num flex flex-wrap items-baseline gap-1.5 text-[24px] leading-none font-bold tracking-tight text-[var(--nx-text-primary)]">
          <span>
            <bdi dir="ltr">{periodMoney.ppText.split(' ')[0]}</bdi>{' '}
            {periodMoney.ppText.split(' ').slice(1).join(' ')}
          </span>
          <span className="text-base font-medium text-[var(--nx-text-subtle)]">/</span>
          <span className="text-lg font-semibold text-[var(--nx-indigo)]">{periodMoney.moneyText}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <DeltaBadge label={shownDeltaText} direction={shownDeltaUp ? 'up' : 'down'} />
          <span className="font-mono-num rounded-[var(--nx-radius-xs)] bg-[var(--nx-bg-subtle)] px-2 py-0.5 text-[11px] font-semibold text-[var(--nx-text-secondary)]">
            {recordedDaysCount}/{displayDays.length} يوم مرصود
          </span>
          <span className="text-xs font-medium text-[var(--nx-text-muted)]">
            {excludeOnboardingActive
              ? `صافي الربح المكتسب (تم استبعاد ${onboardingFmt.ppText} رصيد بدء)`
              : `اليوم مقارنة بمتوسط الأيام المسجلة`}
          </span>
        </div>
      </div>

      <div className="pt-1 overflow-x-auto pb-1">
        <div
          className={`grid h-[186px] items-end ${
            displayDays.length > 7 ? 'min-w-[440px] sm:min-w-0 gap-1 sm:gap-1.5' : 'gap-2'
          }`}
          style={{
            gridTemplateColumns: `repeat(${Math.max(1, displayDays.length)}, minmax(0, 1fr))`
          }}
          dir="ltr"
        >
          {displayDays.map((d, idx) => {
            const val = getDayVal(d);
            const isPinned = d.dateKey === pinnedDateKey;
            const isHighlighted = isPinned || (pinnedDateKey === null && idx === activeIdx);
            const isNegative = val < 0;
            const pct = val !== 0 ? Math.max(14, Math.round((Math.abs(val) / maxAbsVal) * 100)) : 8;
            const barMoney = formatPPAndCurrency(val, finance, {
              decimals: 0,
              showSign: val > 0,
              unit: 'PP'
            });
            return (
              <button
                key={d.dateKey}
                type="button"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() =>
                  setPinnedDateKey((prev) => (prev === d.dateKey ? null : d.dateKey))
                }
                className="group flex h-full cursor-pointer flex-col items-center justify-end gap-1.5 focus:outline-none"
                title={`${d.relativeLabel}: ${barMoney.combinedText}${
                  d.hasOnboardingJump ? ` (شامل رصيد بدء ${Math.round(d.onboardingJumpPP)} PP)` : ''
                }`}
              >
                <div className="flex h-5 items-end justify-center">
                  {isHighlighted && (
                    <span
                      className={`font-mono-num whitespace-nowrap text-[10px] leading-none font-bold ${
                        isNegative ? 'text-[var(--nx-coral)]' : 'text-[var(--nx-text-primary)]'
                      }`}
                    >
                      {val > 0 ? '+' : ''}
                      {Math.round(val).toLocaleString('en-US')}
                    </span>
                  )}
                </div>
                <div className="relative flex w-full flex-1 items-end">
                  {d.hasOnboardingJump && excludeOnboardingActive && (
                    <span
                      title={`يوم تأسيس الأرصدة: +${Math.round(d.onboardingJumpPP).toLocaleString('en-US')} PP`}
                      className="absolute inset-x-1 top-1 h-1 rounded-full bg-[var(--nx-amber)]/65"
                    />
                  )}
                  <div
                    className="w-full rounded-t-[6px] rounded-b-[3px] transition-all duration-200"
                    style={{
                      height: `${pct}%`,
                      background: isNegative
                        ? isHighlighted
                          ? 'var(--nx-coral)'
                          : 'rgba(220, 38, 38, 0.45)'
                        : isHighlighted
                          ? 'linear-gradient(180deg, var(--nx-indigo) 0%, var(--nx-periwinkle) 72%, rgba(124,116,242,0.35) 100%)'
                          : d.hasRecordedData && val !== 0
                            ? 'var(--nx-indigo-soft)'
                            : d.hasRecordedData
                              ? 'var(--nx-bg-muted)'
                              : 'var(--nx-border)',
                      border:
                        !isHighlighted && d.hasRecordedData && val > 0
                          ? '1px solid rgba(79, 70, 229, 0.35)'
                          : undefined
                    }}
                  />
                </div>
                <span
                  className={`font-mono-num whitespace-nowrap leading-none tracking-tighter ${
                    displayDays.length > 7 ? 'text-[9.5px]' : 'text-[10px]'
                  } ${
                    isHighlighted ? 'font-bold text-[var(--nx-indigo)]' : 'font-medium text-[var(--nx-text-muted)]'
                  }`}
                >
                  {d.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Account Attribution Panel */}
      {selectedDay ? (
        <div className="rounded-[var(--nx-radius-md)] border border-[var(--nx-indigo)]/30 bg-[var(--nx-bg-subtle)] p-3 text-xs">
          <div className="mb-2 flex items-center justify-between gap-2 border-b border-[var(--nx-border)] pb-2">
            <div className="font-bold text-[var(--nx-text-primary)]">
              مساهمات {selectedDay.relativeLabel} ·{' '}
              <span className="font-mono-num text-[var(--nx-indigo)]">
                {
                  formatPPAndCurrency(getDayVal(selectedDay), finance, {
                    decimals: 1,
                    showSign: getDayVal(selectedDay) > 0
                  }).combinedText
                }
              </span>
            </div>
            <button
              type="button"
              onClick={() => setPinnedDateKey(null)}
              aria-label="إغلاق تفاصيل اليوم"
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded hover:bg-[var(--nx-bg-hover)]"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          {selectedDay.accountsBreakdown.length === 0 ? (
            <div className="py-2 text-center text-[var(--nx-text-muted)]">لا توجد حسابات مسجلة.</div>
          ) : (
            <div className="max-h-40 divide-y divide-[var(--nx-border)] overflow-y-auto">
              {selectedDay.accountsBreakdown.map((acc) => {
                const f = formatPPAndCurrency(acc.netPP, finance, {
                  decimals: 1,
                  showSign: acc.netPP > 0,
                  unit: 'نقطة'
                });
                return (
                  <div
                    key={acc.accountId}
                    className="flex items-center justify-between gap-2 py-1.5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {onSelectAccount ? (
                          <button
                            type="button"
                            onClick={() => onSelectAccount(acc.accountId)}
                            className="inline-flex cursor-pointer items-center gap-1 font-bold text-[var(--nx-indigo)] hover:underline"
                          >
                            <span>{acc.accountName}</span>
                            <ChevronLeft className="h-3 w-3" aria-hidden="true" />
                          </button>
                        ) : (
                          <span className="font-bold text-[var(--nx-text-primary)]">
                            {acc.accountName}
                          </span>
                        )}
                        {acc.isOnboardingJump && (
                          <span className="text-[10px] font-semibold text-[var(--nx-amber)]">
                            · رصيد بدء
                          </span>
                        )}
                      </div>
                      <div className="font-mono-num text-[10px] text-[var(--nx-text-muted)]" dir="ltr">
                        {acc.hasData
                          ? `${acc.startPP ?? '—'} → ${acc.endPP ?? '—'}`
                          : 'بدون تسجيل لهذا اليوم'}
                      </div>
                    </div>
                    <span
                      className={`font-mono-num text-xs font-bold ${
                        acc.isOnboardingJump
                          ? 'text-[var(--nx-amber)]'
                          : acc.netPP > 0
                            ? 'text-[var(--nx-emerald)]'
                            : acc.netPP < 0
                              ? 'text-[var(--nx-coral)]'
                              : 'text-[var(--nx-text-muted)]'
                      }`}
                    >
                      {acc.hasData ? f.combinedText : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
