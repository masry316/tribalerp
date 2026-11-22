import { useEffect, useMemo, useState } from 'react';
import {
  formatPPAndCurrency,
  type AccountFlowDayEntry,
  type ErpFinance,
  type IpCollisionGroup
} from '../../core';

export function useLiveClock(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function ResourceRadialGauge({
  label,
  value,
  capacity,
  pct,
  hourlyRate,
  accentHex
}: {
  label: string;
  value: number;
  capacity: number;
  pct: number;
  hourlyRate: number;
  accentHex: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (clamped / 100) * circumference;
  const strokeColor = clamped >= 90 ? '#ef4444' : clamped >= 75 ? '#f59e0b' : accentHex;

  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] p-3 text-center">
      <div className="relative h-20 w-20">
        <svg viewBox="0 0 84 84" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle
            cx="42"
            cy="42"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            className="text-[var(--nx-bg-muted)]"
          />
          <circle
            cx="42"
            cy="42"
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="transition-[stroke-dashoffset] duration-300 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`font-mono-num text-sm font-bold ${
              clamped >= 90
                ? 'text-[var(--nx-coral)]'
                : clamped >= 75
                  ? 'text-[var(--nx-amber)]'
                  : 'text-[var(--nx-text-primary)]'
            }`}
          >
            {clamped}%
          </span>
        </div>
      </div>

      <span className="mt-1.5 text-xs font-bold text-[var(--nx-text-primary)]">{label}</span>
      <span className="font-mono-num mt-0.5 text-xs font-semibold text-[var(--nx-text-primary)]">
        {value.toLocaleString('en-US')}
      </span>
      <span className="font-mono-num text-[11px] text-[var(--nx-text-muted)]">
        +{Math.round(hourlyRate)}/س · {capacity.toLocaleString('en-US')}
      </span>
    </div>
  );
}

export function DailyFlowTrajectorySvg({
  rows,
  targetDailyPP,
  finance
}: {
  rows: AccountFlowDayEntry[];
  targetDailyPP: number;
  finance?: Partial<ErpFinance>;
}) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const ordered = useMemo(() => [...rows].reverse(), [rows]); // chronological left->right or start->end
  const maxVal = useMemo(() => {
    const vals = ordered.map((r) => Math.max(0, r.netPP ?? 0));
    return Math.max(targetDailyPP * 1.25, ...vals, 10);
  }, [ordered, targetDailyPP]);

  const width = 680;
  const height = 230;
  const padX = 28;
  const padY = 24;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;

  const targetY = padY + chartH - (Math.min(targetDailyPP, maxVal) / maxVal) * chartH;
  const activeRow =
    activeIdx !== null && ordered[activeIdx]
      ? ordered[activeIdx]
      : ordered[ordered.length - 1] || null;

  return (
    <div className="space-y-3">
      {/* Live Crosshair Readout */}
      {activeRow ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] px-3.5 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-[var(--nx-text-primary)]">
              {activeRow.relativeLabel}
            </span>
            <span className="font-mono-num text-[var(--nx-text-muted)]">
              ({activeRow.dateKey})
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4 tabular-nums">
            <span>
              الصافي:{' '}
              <strong
                className={`font-mono-num ${
                  (activeRow.netPP ?? 0) < 0
                    ? 'text-[var(--nx-coral)]'
                    : (activeRow.netPP ?? 0) >= activeRow.targetPP
                      ? 'text-[var(--nx-emerald)]'
                      : 'text-[var(--nx-indigo)]'
                }`}
              >
                {activeRow.netPP !== null
                  ? formatPPAndCurrency(activeRow.netPP, finance, {
                      decimals: 1,
                      unit: 'نقطة',
                      showSign: true
                    }).combinedText
                  : '—'}
              </strong>
            </span>
            <span className="text-[var(--nx-text-muted)]">
              الهدف:{' '}
              <span className="font-mono-num">
                {formatPPAndCurrency(activeRow.targetPP, finance, { decimals: 0, unit: 'نقطة' }).combinedText}
              </span>
            </span>
            <span className="text-[var(--nx-text-muted)]">
              الإنجاز:{' '}
              <span className="font-mono-num font-semibold text-[var(--nx-text-primary)]">
                {activeRow.achievementPct !== null ? `${activeRow.achievementPct}%` : '—'}
              </span>
            </span>
          </div>
        </div>
      ) : null}

      <div className="w-full overflow-hidden rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] p-2">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full" role="img" aria-label="منحنى الأرباح اليومية">
          <line
            x1={padX}
            y1={padY + chartH}
            x2={width - padX}
            y2={padY + chartH}
            stroke="var(--nx-border-strong)"
            strokeWidth="1"
          />
          <line
            x1={padX}
            y1={padY + chartH / 2}
            x2={width - padX}
            y2={padY + chartH / 2}
            stroke="var(--nx-border)"
            strokeDasharray="3 3"
            strokeWidth="1"
          />

          <line
            x1={padX}
            y1={targetY}
            x2={width - padX}
            y2={targetY}
            stroke="#4F46E5"
            strokeDasharray="5 3"
            strokeWidth="1.25"
          />

          {ordered.map((row, idx) => {
            const slotW = chartW / Math.max(1, ordered.length);
            const barW = Math.max(8, Math.min(28, slotW * 0.56));
            const cx = padX + slotW * idx + slotW / 2;
            const rawVal = row.netPP ?? 0;
            const barH = Math.max(3, (Math.max(0, rawVal) / maxVal) * chartH);
            const yTop = padY + chartH - barH;
            const isHovered = activeIdx === idx;
            const barColor =
              row.netPP === null
                ? '#94A3B8'
                : rawVal < 0
                  ? '#EF4444'
                  : rawVal >= row.targetPP
                    ? '#10B981'
                    : '#4F46E5';

            return (
              <g
                key={row.dateKey}
                className="cursor-pointer"
                onMouseEnter={() => setActiveIdx(idx)}
                onClick={() => setActiveIdx(idx)}
              >
                {isHovered ? (
                  <line
                    x1={cx}
                    y1={padY}
                    x2={cx}
                    y2={padY + chartH}
                    stroke="var(--nx-text-subtle)"
                    strokeDasharray="2 2"
                    strokeWidth="1"
                  />
                ) : null}
                <rect
                  x={cx - barW / 2}
                  y={yTop}
                  width={barW}
                  height={barH}
                  rx="4"
                  fill={barColor}
                  fillOpacity={row.netPP === null ? 0.28 : isHovered ? 1 : 0.85}
                />
                <rect
                  x={padX + slotW * idx}
                  y={padY}
                  width={slotW}
                  height={chartH}
                  fill="transparent"
                />
              </g>
            );
          })}
        </svg>

        <div className="font-mono-num flex justify-between px-4 pb-1 text-[11px] text-[var(--nx-text-muted)]">
          <span>{ordered[0]?.dateKey || ''}</span>
          <span>{ordered[ordered.length - 1]?.dateKey || ''}</span>
        </div>
      </div>
    </div>
  );
}

export function IpCollisionGraphSvg({
  collisions,
  onSelectAccount
}: {
  collisions: IpCollisionGroup[];
  onSelectAccount: (accountId: string) => void;
}) {
  if (collisions.length === 0) return null;

  const shown = collisions.slice(0, 4);

  return (
    <div className="nx-card border-[var(--nx-coral-border)] bg-[var(--nx-coral-bg)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-bold text-[var(--nx-coral)]">
            خريطة ارتباط عناوين IP المتصادمة
          </h4>
          <p className="text-xs text-[var(--nx-text-secondary)]">
            انقر على أي حساب لفحص تدفق نقاطه ومراجعة فصله عن بقية الحسابات
          </p>
        </div>
        <span className="font-mono-num rounded bg-[var(--nx-coral)] px-2 py-0.5 text-xs font-bold text-white">
          {collisions.length} تضارب مكتشف
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {shown.map((col) => (
          <div
            key={`${col.ip}_${col.worldId}`}
            className="rounded-[var(--nx-radius-md)] border border-[var(--nx-coral-border)] bg-[var(--nx-bg-surface)] p-3"
          >
            <div className="mb-2 flex items-center justify-between border-b border-[var(--nx-border)] pb-2">
              <span dir="ltr" className="font-mono-num text-xs font-bold text-[var(--nx-coral)]">
                {col.ip} · {col.wName}
              </span>
              <span className="text-xs font-semibold text-[var(--nx-text-muted)]">
                {col.accounts.length} حسابات مرتبطة
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {col.accounts.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => onSelectAccount(acc.id)}
                  className="nx-btn nx-btn-outline nx-btn-compact cursor-pointer hover:border-[var(--nx-coral)] hover:text-[var(--nx-coral)]"
                >
                  {acc.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
