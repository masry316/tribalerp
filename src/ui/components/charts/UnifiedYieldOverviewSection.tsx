import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ExternalLink,
  PieChart,
  X
} from 'lucide-react';
import { formatPPAndCurrency, type ErpFinance } from '../../../core';
import type { DistributionAccountItem, OverviewColumnBucketData } from '../../viewModels';
import { DeltaBadge } from '../StateViews';

type YieldCategoryKey = 'mines' | 'scav' | 'unsold';

interface UnifiedYieldOverviewSectionProps {
  columns: OverviewColumnBucketData[];
  heroValueText: string;
  estDailyPP: number;
  minesPP: number;
  scavPP: number;
  scavActivePP?: number;
  unsoldPP: number;
  sellableNowPP?: number;
  villagesCount: number;
  finance: ErpFinance;
  minesAccounts: DistributionAccountItem[];
  scavAccounts: DistributionAccountItem[];
  unsoldAccounts: DistributionAccountItem[];
  onOpenReports: () => void;
  onSelectAccount?: (accountId: string) => void;
}

const SEGMENTS = [
  { key: 'woodPP', label: 'الخشب', color: 'var(--nx-indigo)' },
  { key: 'clayPP', label: 'الطمي', color: 'var(--nx-periwinkle)' },
  { key: 'ironPP', label: 'الحديد', color: 'var(--nx-blue)' },
  { key: 'scavPP', label: 'الإغارات', color: 'var(--nx-cyan)' },
  { key: 'unsoldPP', label: 'غير مباع', color: 'var(--nx-emerald)' }
] as const;

export function UnifiedYieldOverviewSection({
  columns,
  heroValueText,
  estDailyPP,
  minesPP,
  scavPP,
  scavActivePP,
  unsoldPP,
  sellableNowPP,
  villagesCount,
  finance,
  minesAccounts,
  scavAccounts,
  unsoldAccounts,
  onOpenReports,
  onSelectAccount
}: UnifiedYieldOverviewSectionProps) {
  const [mode, setMode] = useState<'all' | 'daily'>('all');
  const [stockBasis, setStockBasis] = useState<'warehouse' | 'sellable'>('warehouse');
  const [sortDesc, setSortDesc] = useState(true);
  const [selectedCat, setSelectedCat] = useState<YieldCategoryKey | null>(null);
  const [hoveredCat, setHoveredCat] = useState<YieldCategoryKey | null>(null);
  const [selectedColId, setSelectedColId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedCat && !selectedColId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedCat(null);
        setSelectedColId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedCat, selectedColId]);

  const hideUnsold = mode === 'daily';
  const effectiveUnsoldVal =
    stockBasis === 'sellable' && sellableNowPP !== undefined ? sellableNowPP : unsoldPP;

  // 1) Semi-gauge calculations
  const v1 = Math.max(0, minesPP);
  const v2 = Math.max(0, scavPP);
  const v3 = hideUnsold ? 0 : Math.max(0, effectiveUnsoldVal);
  const gaugeSum = v1 + v2 + v3;
  const dailyTotal = v1 + v2;

  const cx = 140;
  const cy = 132;
  const r = 92;
  const circumference = Math.PI * r;
  const strokeW = 20;

  const arcs = useMemo(() => {
    const raw = [
      { key: 'mines' as const, label: 'عائد المناجم', val: v1, color: 'var(--nx-indigo)' },
      { key: 'scav' as const, label: 'عائد الإغارات', val: v2, color: 'var(--nx-cyan)' },
      { key: 'unsold' as const, label: 'مخزون متاح', val: v3, color: 'var(--nx-emerald)' }
    ].filter((s) => s.val > 0.01);

    if (raw.length === 0 || gaugeSum <= 0) return [];
    const gapLen = raw.length > 1 ? 4 : 0;
    const usableLen = Math.max(10, circumference - gapLen * (raw.length - 1));

    let cursor = 0;
    return raw.map((seg, idx) => {
      const share = seg.val / gaugeSum;
      const len = Math.max(2, share * usableLen);
      const offset = cursor;
      cursor += len + (idx < raw.length - 1 ? gapLen : 0);
      return { ...seg, share, len, offset };
    });
  }, [v1, v2, v3, gaugeSum, circumference]);

  const minesFormatted = formatPPAndCurrency(v1, finance, { decimals: 1, unit: 'نقطة' });
  const scavFormatted = formatPPAndCurrency(v2, finance, { decimals: 1, unit: 'نقطة' });
  const unsoldFormatted = formatPPAndCurrency(Math.max(0, effectiveUnsoldVal), finance, {
    decimals: 1,
    unit: 'نقطة'
  });

  const centerVal = hideUnsold ? dailyTotal : gaugeSum;
  const centerFormatted = formatPPAndCurrency(centerVal, finance, { decimals: 0, unit: 'نقطة' });
  const dailyPPCurrency = formatPPAndCurrency(estDailyPP, finance, {
    decimals: 0,
    unit: 'نقطة',
    perDay: true
  });

  // 2) Continent columns calculations synchronized with mode & stockBasis
  const visibleCols = useMemo(() => {
    const mapped = columns.map((c) => {
      const colUnsold =
        stockBasis === 'sellable' ? c.sellableNowPP : c.unsoldPP;
      const effectiveTotal =
        c.woodPP + c.clayPP + c.ironPP + c.scavPP + (hideUnsold ? 0 : colUnsold);
      return { ...c, effectiveUnsold: colUnsold, effectiveTotal };
    });
    return [...mapped]
      .sort((a, b) =>
        sortDesc ? b.effectiveTotal - a.effectiveTotal : a.effectiveTotal - b.effectiveTotal
      )
      .slice(0, 4);
  }, [columns, sortDesc, hideUnsold, stockBasis]);

  const maxColTotal = useMemo(
    () => Math.max(1, ...visibleCols.map((c) => c.effectiveTotal)),
    [visibleCols]
  );

  const selectedCol = useMemo(
    () => visibleCols.find((c) => c.id === selectedColId) || null,
    [visibleCols, selectedColId]
  );

  const svgW = 500;
  const svgH = 200;
  const topPad = 28;
  const bottomPad = 26;
  const plotH = svgH - topPad - bottomPad;
  const barW = visibleCols.length >= 4 ? 66 : 78;
  const gapPx = 3;

  const colPositions = useMemo(() => {
    const count = Math.max(1, visibleCols.length);
    if (count === 1) return [svgW / 2 - barW / 2];
    if (count === 2) return [105, svgW - 105 - barW];
    if (count === 3) return [40, svgW / 2 - barW / 2, svgW - 40 - barW];
    const span = svgW - 48 - barW;
    return [24, 24 + span / 3, 24 + (span * 2) / 3, svgW - 24 - barW];
  }, [visibleCols.length, barW]);

  const computedBars = useMemo(() => {
    return visibleCols.map((col, idx) => {
      const x = colPositions[idx] ?? 40;
      const activeSegs = SEGMENTS.filter((s) => !(hideUnsold && s.key === 'unsoldPP')).map((s) => ({
        ...s,
        val: Math.max(
          0,
          s.key === 'unsoldPP' ? col.effectiveUnsold : Number(col[s.key] || 0)
        )
      }));
      const nonEmptySegs = activeSegs.filter((s) => s.val > 0);
      const targetStackH = Math.min(
        plotH,
        Math.max(16, (col.effectiveTotal / maxColTotal) * plotH)
      );
      const totalGaps = Math.max(0, nonEmptySegs.length - 1) * gapPx;
      const availForRects = Math.max(8, targetStackH - totalGaps);

      // Initial proportional heights with 6px floor per active segment
      const rawHeights = nonEmptySegs.map((seg) => {
        const share = col.effectiveTotal > 0 ? seg.val / col.effectiveTotal : 0;
        return Math.max(6, share * availForRects);
      });

      // Shrink largest segments if floors pushed total beyond available stack budget
      let sumH = rawHeights.reduce((a, b) => a + b, 0);
      if (sumH > availForRects && rawHeights.length > 0) {
        let excess = sumH - availForRects;
        const order = rawHeights
          .map((h, i) => ({ h, i }))
          .sort((a, b) => b.h - a.h);
        for (const item of order) {
          if (excess <= 0) break;
          const reducible = Math.max(0, item.h - 6);
          const take = Math.min(reducible, excess);
          rawHeights[item.i] -= take;
          excess -= take;
        }
        sumH = rawHeights.reduce((a, b) => a + b, 0);
        if (sumH > availForRects && sumH > 0) {
          const factor = availForRects / sumH;
          for (let i = 0; i < rawHeights.length; i++) rawHeights[i] *= factor;
        }
      }

      let cursorY = svgH - bottomPad;
      const segRects: Array<{
        key: string;
        label: string;
        color: string;
        val: number;
        y: number;
        h: number;
      }> = [];

      nonEmptySegs.forEach((seg, sIdx) => {
        const h = Math.max(2, rawHeights[sIdx] || 0);
        cursorY -= h;
        segRects.push({
          key: seg.key,
          label: seg.label,
          color: seg.color,
          val: seg.val,
          y: cursorY,
          h
        });
        cursorY -= gapPx;
      });

      const topY = segRects.length > 0 ? segRects[segRects.length - 1].y : svgH - bottomPad;
      return { col, x, topY, segRects };
    });
  }, [visibleCols, colPositions, hideUnsold, maxColTotal, plotH]);

  const activeCategoryData = useMemo(() => {
    if (!selectedCat) return null;
    if (selectedCat === 'mines') {
      const nonZero = minesAccounts.filter((a) => a.pp > 0.05);
      return {
        key: 'mines' as const,
        label: 'عائد المناجم',
        totalPP: v1,
        accounts: nonZero,
        hiddenZeroCount: Math.max(0, minesAccounts.length - nonZero.length)
      };
    }
    if (selectedCat === 'scav') {
      const nonZero = scavAccounts.filter((a) => a.pp > 0.05);
      return {
        key: 'scav' as const,
        label: 'عائد الإغارات',
        totalPP: v2,
        accounts: nonZero,
        hiddenZeroCount: Math.max(0, scavAccounts.length - nonZero.length)
      };
    }
    const sortedUnsold = [...unsoldAccounts]
      .map((a) => ({
        ...a,
        displayPP:
          stockBasis === 'sellable' && a.sellableNowPP !== undefined ? a.sellableNowPP : a.pp
      }))
      .filter((a) => a.displayPP > 0.05)
      .sort((a, b) => b.displayPP - a.displayPP);
    return {
      key: 'unsold' as const,
      label: stockBasis === 'sellable' ? 'مخزون قابل للبيع بالتجار' : 'مخزون متاح',
      totalPP: Math.max(0, effectiveUnsoldVal),
      accounts: sortedUnsold,
      hiddenZeroCount: Math.max(0, unsoldAccounts.length - sortedUnsold.length)
    };
  }, [
    selectedCat,
    v1,
    v2,
    effectiveUnsoldVal,
    stockBasis,
    minesAccounts,
    scavAccounts,
    unsoldAccounts
  ]);

  const toggleCat = (cat: YieldCategoryKey) => {
    if (hideUnsold && cat === 'unsold') return;
    setSelectedColId(null);
    setSelectedCat((prev) => (prev === cat ? null : cat));
  };

  const toggleCol = (colId: string) => {
    setSelectedCat(null);
    setSelectedColId((prev) => (prev === colId ? null : colId));
  };

  const handleModeChange = (nextMode: 'all' | 'daily') => {
    setMode(nextMode);
    if (nextMode === 'daily' && selectedCat === 'unsold') {
      setSelectedCat(null);
    }
  };

  const activeHighlight = hoveredCat || selectedCat;

  const sourceCards = [
    {
      key: 'mines' as const,
      label: 'المناجم',
      dotClass: 'bg-[var(--nx-indigo)]',
      fmt: minesFormatted,
      sharePct: gaugeSum > 0 ? Math.round((v1 / gaugeSum) * 100) : 0,
      disabled: false,
      subNote: null as string | null
    },
    {
      key: 'scav' as const,
      label: 'الإغارات',
      dotClass: 'bg-[var(--nx-cyan)]',
      fmt: scavFormatted,
      sharePct: gaugeSum > 0 ? Math.round((v2 / gaugeSum) * 100) : 0,
      disabled: false,
      subNote:
        scavActivePP !== undefined && v2 > 0
          ? scavActivePP > 0.1
            ? `نشط: ${scavActivePP.toFixed(1)}`
            : 'متوقفة حالياً'
          : null
    },
    {
      key: 'unsold' as const,
      label: stockBasis === 'sellable' ? 'بالتجار' : 'المخزون',
      dotClass: 'bg-[var(--nx-emerald)]',
      fmt: unsoldFormatted,
      sharePct: hideUnsold || gaugeSum <= 0 ? 0 : Math.round((v3 / gaugeSum) * 100),
      disabled: hideUnsold,
      subNote: hideUnsold ? 'مستبعد' : null
    }
  ];

  return (
    <section aria-labelledby="unified-yield-heading" className="nx-card space-y-4 p-4 sm:p-5">
      {/* Unified Header & Shared Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--nx-border)] pb-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--nx-radius-sm)] bg-[var(--nx-indigo-soft)] text-[var(--nx-indigo)]">
            <PieChart className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 id="unified-yield-heading" className="text-[15px] font-bold text-[var(--nx-text-primary)]">
              مصادر العائد وتوزيع القارات والمخزون
            </h2>
            <p className="text-[11px] text-[var(--nx-text-muted)]">
              مقارنة مباشرة بين إنتاج المناجم والإغارات وتوزيع القارات — انقر على أي مصدر أو عمود للتفصيل
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {mode === 'all' && sellableNowPP !== undefined && (
            <button
              type="button"
              onClick={() =>
                setStockBasis((prev) => (prev === 'warehouse' ? 'sellable' : 'warehouse'))
              }
              title="التبديل بين إجمالي المخزون والكمية القابلة للبيع بالتجار الحاليين"
              className={`nx-btn nx-btn-outline nx-btn-compact text-[11px] ${
                stockBasis === 'sellable'
                  ? 'border-[var(--nx-emerald)] bg-[var(--nx-emerald-bg)] text-[var(--nx-emerald)]'
                  : ''
              }`}
            >
              {stockBasis === 'sellable' ? 'بالتجار فقط' : 'كل المخزون'}
            </button>
          )}

          <div className="relative">
            <select
              aria-label="نطاق العرض"
              value={mode}
              onChange={(e) => handleModeChange(e.target.value === 'daily' ? 'daily' : 'all')}
              className="nx-select nx-select-compact cursor-pointer appearance-none pe-3 ps-7 font-medium"
            >
              <option value="all">الإنتاج + المخزون</option>
              <option value="daily">الإنتاج اليومي</option>
            </select>
            <ChevronDown
              className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--nx-text-muted)]"
              aria-hidden="true"
            />
          </div>

          <button
            type="button"
            onClick={() => setSortDesc((v) => !v)}
            className="nx-btn nx-btn-outline nx-btn-compact"
            title="عكس ترتيب القارات"
          >
            <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
            <span>ترتيب</span>
          </button>

          <button
            type="button"
            onClick={onOpenReports}
            className="nx-btn nx-btn-outline nx-btn-compact"
          >
            <span>التقارير</span>
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Unified Split Content: Yield Sources (Left 5 cols) + Continent Distribution (Right 7 cols) */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        {/* Part A: Revenue Sources & Semi-Gauge */}
        <div className="space-y-3 lg:col-span-5 lg:border-e lg:border-[var(--nx-border)] lg:pe-5">
          <div className="grid grid-cols-3 gap-2">
            {sourceCards.map((item) => {
              const isSelected = selectedCat === item.key && !item.disabled;
              return (
                <button
                  key={item.key}
                  type="button"
                  disabled={item.disabled}
                  onMouseEnter={() => !item.disabled && setHoveredCat(item.key)}
                  onMouseLeave={() => setHoveredCat(null)}
                  onClick={() => toggleCat(item.key)}
                  className={`space-y-0.5 rounded-[var(--nx-radius-sm)] border p-2 text-start transition-colors ${
                    item.disabled
                      ? 'cursor-not-allowed border-transparent bg-[var(--nx-bg-subtle)]/50 opacity-45'
                      : isSelected
                        ? 'cursor-pointer border-[var(--nx-indigo)] bg-[var(--nx-indigo-soft)]/50'
                        : 'cursor-pointer border-[var(--nx-border)]/70 hover:border-[var(--nx-border-strong)] hover:bg-[var(--nx-bg-subtle)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 text-[11px] font-medium text-[var(--nx-text-muted)]">
                    <span className="flex min-w-0 items-center gap-1">
                      <span className={`h-2.5 w-1 shrink-0 rounded-full ${item.dotClass}`} />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {!item.disabled && (
                      <span className="font-mono-num shrink-0 text-[10px] font-bold text-[var(--nx-text-secondary)]">
                        {item.sharePct}%
                      </span>
                    )}
                  </div>
                  <div className="font-mono-num text-sm font-bold text-[var(--nx-text-primary)]">
                    {item.fmt.ppText}
                  </div>
                  <div className="font-mono-num truncate text-[11px] font-semibold text-[var(--nx-indigo)]">
                    {item.fmt.moneyText}
                  </div>
                  {item.subNote && (
                    <div className="truncate text-[10px] text-[var(--nx-text-muted)]">
                      {item.subNote}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col items-center justify-center" dir="ltr">
            <svg
              viewBox="0 0 280 156"
              className="h-[152px] w-full max-w-[290px]"
              role="img"
              aria-label="توزيع مصادر النقاط والمخزون"
            >
              <path
                d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
                fill="none"
                stroke="var(--nx-bg-muted)"
                strokeWidth={strokeW}
                strokeDasharray={arcs.length === 0 ? '3 5' : undefined}
              />
              {arcs.map((arc) => {
                const isDimmed = activeHighlight !== null && activeHighlight !== arc.key;
                const isActive = activeHighlight === arc.key;
                const arcFmt = formatPPAndCurrency(arc.val, finance, { decimals: 1, unit: 'نقطة' });
                return (
                  <path
                    key={arc.key}
                    d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
                    fill="none"
                    stroke={arc.color}
                    strokeWidth={isActive ? strokeW + 3 : strokeW}
                    strokeOpacity={isDimmed ? 0.3 : 1}
                    strokeDasharray={`${arc.len} ${circumference * 2}`}
                    strokeDashoffset={-arc.offset}
                    className="cursor-pointer transition-all duration-150"
                    onMouseEnter={() => setHoveredCat(arc.key)}
                    onMouseLeave={() => setHoveredCat(null)}
                    onClick={() => toggleCat(arc.key)}
                  >
                    <title>{`${arc.label}: ${arcFmt.combinedText} (${Math.round(arc.share * 100)}%)`}</title>
                  </path>
                );
              })}
              <text
                x={cx}
                y={cy - 24}
                textAnchor="middle"
                fill="var(--nx-text-primary)"
                fontSize="16"
                fontWeight="700"
                className="font-mono-num"
              >
                {centerFormatted.ppText}
              </text>
              <text
                x={cx}
                y={cy - 7}
                textAnchor="middle"
                fill="var(--nx-indigo)"
                fontSize="12"
                fontWeight="700"
                className="font-mono-num"
              >
                {centerFormatted.moneyText}
              </text>
              <text
                x={cx}
                y={cy + 9}
                textAnchor="middle"
                fill="var(--nx-text-muted)"
                fontSize="9.5"
                fontWeight="600"
              >
                {hideUnsold ? 'العائد اليومي الصافي' : 'إجمالي اليومي + المتاح'}
              </text>
            </svg>
          </div>
        </div>

        {/* Part B: Production & Continent Breakdown */}
        <div className="space-y-3 lg:col-span-7">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <div className="font-mono-num text-xl font-bold tracking-tight text-[var(--nx-text-primary)] sm:text-[22px]">
                {heroValueText}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <DeltaBadge label={dailyPPCurrency.combinedText} direction="up" />
                <span className="text-xs font-medium text-[var(--nx-text-muted)]">
                  {villagesCount} قرية نشطة
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px] text-[var(--nx-text-muted)]">
              {SEGMENTS.filter((s) => !(hideUnsold && s.key === 'unsoldPP')).map((s) => (
                <div key={s.key} className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {visibleCols.length === 0 ? (
            <div className="flex h-[178px] items-center justify-center rounded-[var(--nx-radius-md)] bg-[var(--nx-bg-subtle)] text-xs text-[var(--nx-text-muted)]">
              أضف قرى أو زامن من اللعبة لعرض مقارنة القارات.
            </div>
          ) : (
            <div className="w-full" dir="ltr">
              <svg
                viewBox={`0 0 ${svgW} ${svgH}`}
                className="h-[185px] w-full select-none overflow-visible"
                role="img"
                aria-label="مخطط توزيع الإنتاج والمخزون حسب القارات"
              >
                {computedBars.map((bar, idx) => {
                  const next = computedBars[idx + 1];
                  if (!next) return null;
                  return bar.segRects.map((seg) => {
                    const match = next.segRects.find((ns) => ns.key === seg.key);
                    if (!match) return null;
                    const x1 = bar.x + barW;
                    const x2 = next.x;
                    const pts = `${x1},${seg.y + 1} ${x2},${match.y + 1} ${x2},${match.y + match.h - 1} ${x1},${seg.y + seg.h - 1}`;
                    return (
                      <polygon
                        key={`${bar.col.id}-${seg.key}`}
                        points={pts}
                        fill={seg.color}
                        fillOpacity={0.11}
                      />
                    );
                  });
                })}

                {computedBars.map((bar) => {
                  const isSelected = bar.col.id === selectedColId;
                  const colMoney = formatPPAndCurrency(bar.col.effectiveTotal, finance, {
                    decimals: 0,
                    unit: 'PP'
                  });
                  return (
                    <g
                      key={bar.col.id}
                      className="cursor-pointer"
                      onClick={() => toggleCol(bar.col.id)}
                    >
                      <text
                        x={bar.x + barW / 2}
                        y={Math.max(13, bar.topY - 7)}
                        textAnchor="middle"
                        fill={isSelected ? 'var(--nx-indigo)' : 'var(--nx-text-primary)'}
                        fontSize="10"
                        fontWeight="700"
                        className="font-mono-num"
                      >
                        {colMoney.combinedText}
                      </text>

                      {bar.segRects.map((seg) => (
                        <rect
                          key={seg.key}
                          x={bar.x}
                          y={seg.y}
                          width={barW}
                          height={seg.h}
                          rx={5}
                          ry={5}
                          fill={seg.color}
                          fillOpacity={selectedColId && !isSelected ? 0.45 : 1}
                        >
                          <title>{`${bar.col.label} · ${seg.label}: ${formatPPAndCurrency(seg.val, finance, { decimals: 1 }).combinedText}`}</title>
                        </rect>
                      ))}

                      <text
                        x={bar.x + barW / 2}
                        y={svgH - 6}
                        textAnchor="middle"
                        fill={isSelected ? 'var(--nx-indigo)' : 'var(--nx-text-muted)'}
                        fontSize="11"
                        fontWeight={isSelected ? '700' : '500'}
                      >
                        {bar.col.label.length > 14 ? `${bar.col.label.slice(0, 13)}…` : bar.col.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Inline Drilldown Drawer (for either selected Yield Category OR selected Continent Column) */}
      {(activeCategoryData || selectedCol) && (
        <div className="rounded-[var(--nx-radius-md)] border border-[var(--nx-indigo)]/35 bg-[var(--nx-bg-subtle)] p-3 text-xs">
          <div className="mb-2 flex items-center justify-between gap-2 border-b border-[var(--nx-border)] pb-2">
            {activeCategoryData ? (
              <div className="font-bold text-[var(--nx-text-primary)]">
                حسابات ({activeCategoryData.label}) ·{' '}
                <span className="font-mono-num text-[var(--nx-indigo)]">
                  {formatPPAndCurrency(activeCategoryData.totalPP, finance, { decimals: 1 }).combinedText}
                </span>
              </div>
            ) : selectedCol ? (
              <div className="font-bold text-[var(--nx-text-primary)]">
                تفاصيل {selectedCol.label} ({selectedCol.villagesCount} قرية ·{' '}
                <span className="font-mono-num text-[var(--nx-indigo)]">
                  {formatPPAndCurrency(selectedCol.effectiveTotal, finance, { decimals: 1 }).combinedText}
                </span>
                {!hideUnsold && selectedCol.sellableNowPP > 0 && (
                  <span className="font-mono-num text-[11px] font-medium text-[var(--nx-emerald)]">
                    {' '}· بالتجار: {selectedCol.sellableNowPP.toFixed(1)}
                  </span>
                )}
                )
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => {
                setSelectedCat(null);
                setSelectedColId(null);
              }}
              aria-label="إغلاق التفاصيل"
              className="nx-btn nx-btn-outline nx-btn-compact !min-h-[28px] !px-2.5"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              <span>إغلاق</span>
            </button>
          </div>

          {activeCategoryData && (
            activeCategoryData.accounts.length === 0 ? (
              <div className="flex items-center justify-center gap-1.5 py-3 text-[var(--nx-text-muted)]">
                <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                <span>لا توجد حسابات برصيد فعّال لهذا المصدر حالياً.</span>
              </div>
            ) : (
              <div className="max-h-44 divide-y divide-[var(--nx-border)] overflow-y-auto">
                {activeCategoryData.accounts.map((acc) => {
                  const displayPP = 'displayPP' in acc ? acc.displayPP : acc.pp;
                  const fmt = formatPPAndCurrency(displayPP, finance, {
                    decimals: 1,
                    unit: 'نقطة'
                  });
                  const share =
                    activeCategoryData.totalPP > 0
                      ? Math.round((displayPP / activeCategoryData.totalPP) * 100)
                      : 0;
                  return (
                    <div
                      key={`${acc.accountId}_${acc.accountName}`}
                      className="flex items-center justify-between gap-2 py-1.5"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {acc.accountId && onSelectAccount ? (
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
                          {acc.isStaleSync && (
                            <span className="text-[10px] font-medium text-[var(--nx-amber)]">
                              · مزامنة قديمة
                            </span>
                          )}
                        </div>
                        <div className="truncate text-[10px] text-[var(--nx-text-muted)]">
                          {acc.villagesCount} قرية ({acc.villageNames.join('، ')})
                        </div>
                      </div>
                      <div className="shrink-0 text-end">
                        <div className="font-mono-num font-bold text-[var(--nx-text-primary)]">
                          {fmt.combinedText}
                        </div>
                        <div className="font-mono-num text-[10px] text-[var(--nx-text-muted)]">
                          {share}% من المصدر
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {selectedCol && (
            <div className="max-h-44 divide-y divide-[var(--nx-border)] overflow-y-auto">
              {selectedCol.accountsBreakdown.map((accItem) => {
                const displayPP = hideUnsold
                  ? accItem.dailyPP
                  : stockBasis === 'sellable'
                    ? accItem.dailyPP + accItem.sellableNowPP
                    : accItem.totalPP;
                const formatted = formatPPAndCurrency(displayPP, finance, {
                  decimals: 1,
                  unit: 'نقطة'
                });
                return (
                  <div
                    key={`${accItem.accountId}_${accItem.accountName}`}
                    className="flex flex-wrap items-center justify-between gap-2 py-1.5"
                  >
                    <div className="min-w-0">
                      {accItem.accountId && onSelectAccount ? (
                        <button
                          type="button"
                          onClick={() => onSelectAccount(accItem.accountId)}
                          className="inline-flex cursor-pointer items-center gap-1 font-bold text-[var(--nx-indigo)] hover:underline"
                        >
                          <span>{accItem.accountName}</span>
                          <ChevronLeft className="h-3 w-3" aria-hidden="true" />
                        </button>
                      ) : (
                        <span className="font-bold text-[var(--nx-text-primary)]">
                          {accItem.accountName}
                        </span>
                      )}
                      <div className="truncate text-[10px] text-[var(--nx-text-muted)]">
                        {accItem.villagesCount} قرية ({accItem.villageNames.join('، ')})
                      </div>
                    </div>
                    <div className="text-end">
                      <div className="font-mono-num font-bold text-[var(--nx-text-primary)]">
                        {formatted.combinedText}
                      </div>
                      <div className="font-mono-num text-[10px] text-[var(--nx-text-muted)]">
                        مناجم {accItem.minesPP.toFixed(1)} · إغارة {accItem.scavPP.toFixed(1)}
                        {!hideUnsold ? ` · متاح ${accItem.unsoldPP.toFixed(1)}` : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
