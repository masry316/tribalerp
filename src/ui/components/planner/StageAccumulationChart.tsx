import { formatPPAndCurrency, type ErpFinance } from '../../../core';

export interface StageChartPoint {
  key: string;
  label: string;
  cumulativePP: number;
  stagePP: number;
}

interface StageAccumulationChartProps {
  points: StageChartPoint[];
  totalCumulativePP: number;
  finance: ErpFinance;
}

export function StageAccumulationChart({
  points,
  totalCumulativePP,
  finance
}: StageAccumulationChartProps) {
  const totalFmt = formatPPAndCurrency(totalCumulativePP, finance, { decimals: 0 });
  const maxVal = Math.max(10, ...points.map((p) => p.cumulativePP));

  const svgW = 640;
  const svgH = 175;
  const padL = 56;
  const padR = 56;
  const padT = 34;
  const padB = 34;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const coords = points.map((p, idx) => {
    const ratio = points.length > 1 ? idx / (points.length - 1) : 0;
    // Left-to-right progression matching the live reference chart (البداية -> مرحلة 1 -> مرحلة 4)
    const x = padL + ratio * plotW;
    const y = padT + plotH - (p.cumulativePP / maxVal) * plotH;
    const fmt = formatPPAndCurrency(p.cumulativePP, finance, { decimals: 0 });
    return {
      ...p,
      x,
      y,
      labelTop:
        p.cumulativePP === 0
          ? '0'
          : `${p.cumulativePP.toLocaleString('en-US')} / ${fmt.moneyText}`
    };
  });

  const linePath = coords
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(' ');

  const areaPath =
    coords.length > 0
      ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${(padT + plotH).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(padT + plotH).toFixed(1)} Z`
      : '';

  return (
    <div
      data-testid="stage-accumulation-chart"
      className="rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] p-3.5"
    >
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-[var(--nx-text-secondary)]">
          مسار تراكم نقاط التميز عبر المراحل
        </span>
        <span className="font-mono-num font-bold text-[var(--nx-indigo)]">
          الإجمالي: {totalFmt.combinedText}
        </span>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="h-[168px] w-full min-w-[460px]"
          role="img"
          aria-label="رسم بياني لمسار تراكم نقاط التميز عبر المراحل الأربعة"
        >
          <defs>
            <linearGradient id="nxStageAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--nx-indigo)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--nx-indigo)" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Subtle horizontal baseline */}
          <line
            x1={padL}
            y1={padT + plotH}
            x2={svgW - padR}
            y2={padT + plotH}
            stroke="var(--nx-border)"
            strokeWidth="1"
          />

          {areaPath && <path d={areaPath} fill="url(#nxStageAreaGrad)" />}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="var(--nx-indigo)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {coords.map((pt) => (
            <g key={pt.key}>
              <circle
                cx={pt.x}
                cy={pt.y}
                r="4.5"
                fill="var(--nx-indigo)"
                stroke="var(--nx-bg-surface)"
                strokeWidth="2"
              />
              <text
                x={pt.x}
                y={Math.max(15, pt.y - 11)}
                textAnchor="middle"
                fill="var(--nx-text-primary)"
                fontSize="10.5"
                fontWeight="700"
                className="font-mono-num"
              >
                {pt.labelTop}
              </text>
              <text
                x={pt.x}
                y={svgH - 10}
                textAnchor="middle"
                fill="var(--nx-text-muted)"
                fontSize="10.5"
                fontWeight="500"
              >
                {pt.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
