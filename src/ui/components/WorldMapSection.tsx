import { useMemo, useState } from 'react';
import { Crosshair, Focus, Globe2, MapPin, Maximize2, RotateCcw, Search } from 'lucide-react';
import type {
  ErpAppState,
  ErpUserAccount,
  ErpVillage,
  VillageLiveStatus,
  VillageRole
} from '../../core';
import {
  buildWorldMapData,
  type WorldMapContinentCode,
  type WorldMapVillagePoint
} from '../viewModels';

interface WorldMapSectionProps {
  filteredVillages: Array<{
    vil: ErpVillage;
    acc: ErpUserAccount | null;
    live: VillageLiveStatus;
  }>;
  state: ErpAppState;
  activeVillageId: string | null;
  onOpenVillage: (villageId: string) => void;
}

const ROLE_PIN_CLASS: Record<VillageRole, string> = {
  offense: 'bg-red-500 border-white dark:border-slate-950',
  defense: 'bg-blue-500 border-white dark:border-slate-950',
  unset: 'bg-yellow-400 border-slate-900/75 dark:border-slate-950'
};

const ROLE_DOT_CLASS: Record<VillageRole, string> = {
  offense: 'bg-red-500',
  defense: 'bg-blue-500',
  unset: 'bg-yellow-400 ring-1 ring-amber-600/40'
};

const ROLE_TEXT_CLASS: Record<VillageRole, string> = {
  offense: 'text-red-600 dark:text-red-400',
  defense: 'text-blue-600 dark:text-blue-400',
  unset: 'text-amber-700 dark:text-yellow-300'
};

const ROLE_LABEL: Record<VillageRole, string> = {
  offense: 'هجوم',
  defense: 'دفاع',
  unset: 'غير محددة'
};

export function WorldMapSection({
  filteredVillages,
  state,
  activeVillageId,
  onOpenVillage
}: WorldMapSectionProps) {
  const [selectedContinent, setSelectedContinent] = useState<WorldMapContinentCode | 'all'>('all');
  const [roleFilter, setRoleFilter] = useState<VillageRole | 'all'>('all');
  const [viewMode, setViewMode] = useState<'all' | 'fit' | 'continent'>('all');
  const [hoveredVillageId, setHoveredVillageId] = useState<string | null>(null);
  const [listQuery, setListQuery] = useState('');

  const effectiveZoom: WorldMapContinentCode | 'all' | 'fit' =
    viewMode === 'continent' && selectedContinent !== 'all'
      ? selectedContinent
      : viewMode === 'fit'
        ? 'fit'
        : 'all';

  const mapData = useMemo(
    () => buildWorldMapData(filteredVillages, state, effectiveZoom),
    [filteredVillages, state, effectiveZoom]
  );

  const visiblePins = useMemo(() => {
    if (roleFilter === 'all') return mapData.visiblePoints;
    return mapData.visiblePoints.filter((p) => p.villageRole === roleFilter);
  }, [mapData.visiblePoints, roleFilter]);

  const scopeVillages = useMemo(() => {
    const q = listQuery.trim().toLowerCase();
    return mapData.points.filter((p) => {
      if (selectedContinent !== 'all' && p.continent !== selectedContinent) return false;
      if (roleFilter !== 'all' && p.villageRole !== roleFilter) return false;
      if (q) {
        const hay = `${p.villageName} ${p.accountName} ${p.coordText} k${p.continent}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [mapData.points, selectedContinent, roleFilter, listQuery]);

  const focusedPoint: WorldMapVillagePoint | null = useMemo(() => {
    if (!hoveredVillageId) return null;
    return visiblePins.find((p) => p.villageId === hoveredVillageId) || null;
  }, [hoveredVillageId, visiblePins]);

  const handleSelectContinent = (code: WorldMapContinentCode) => {
    if (selectedContinent === code) {
      setSelectedContinent('all');
      if (viewMode === 'continent') setViewMode('all');
    } else {
      setSelectedContinent(code);
      if (viewMode === 'continent') setViewMode('continent');
    }
  };

  const handleResetView = () => {
    setSelectedContinent('all');
    setRoleFilter('all');
    setViewMode('all');
    setHoveredVillageId(null);
    setListQuery('');
  };

  const spanX = mapData.bounds.maxX - mapData.bounds.minX;
  const spanY = mapData.bounds.maxY - mapData.bounds.minY;
  const xTicks = [
    mapData.bounds.minX,
    Math.round(mapData.bounds.minX + spanX * 0.25),
    Math.round(mapData.bounds.minX + spanX * 0.5),
    Math.round(mapData.bounds.minX + spanX * 0.75),
    mapData.bounds.maxX - 1
  ];
  const yTicks = [
    mapData.bounds.minY,
    Math.round(mapData.bounds.minY + spanY * 0.5),
    mapData.bounds.maxY - 1
  ];

  const isSingleContinent =
    effectiveZoom === '44' ||
    effectiveZoom === '45' ||
    effectiveZoom === '54' ||
    effectiveZoom === '55';

  const axisXSvg = mapData.axisXPct !== null ? mapData.axisXPct * 2 : null;
  const axisYSvg = mapData.axisYPct !== null ? mapData.axisYPct * 2 : null;

  const isDense = visiblePins.length > 35;
  const selectedContinentMeta =
    selectedContinent === 'all'
      ? null
      : mapData.continents.find((c) => c.code === selectedContinent) || null;

  const hasActiveFilters =
    selectedContinent !== 'all' || roleFilter !== 'all' || viewMode !== 'all';

  return (
    <section
      aria-labelledby="world-map-heading"
      className="nx-card overflow-hidden p-3.5 sm:p-5"
    >
      {/* Header Row */}
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5 border-b border-[var(--nx-border)] pb-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              id="world-map-heading"
              className="text-base font-bold text-[var(--nx-text-primary)]"
            >
              خريطة العالم
            </h2>
            <span dir="ltr" className="font-mono-num text-xs font-semibold text-[var(--nx-text-muted)]">
              400–599 · K44/K45/K54/K55
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[var(--nx-text-muted)]">
            {mapData.totalVillages} قرية موزعة على 4 قارات — اضغط على أي قرية لتفاصيل الجيش وتحديد نوعها (هجوم / دفاع)
          </p>
        </div>

        {/* Clean View Mode Switcher */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div
            className="inline-flex rounded-[var(--nx-radius-sm)] border border-[var(--nx-border)] bg-[var(--nx-bg-canvas)] p-0.5"
            role="group"
            aria-label="وضع عرض الخريطة"
          >
            <button
              type="button"
              data-testid="map-view-all"
              onClick={() => setViewMode('all')}
              aria-pressed={viewMode === 'all'}
              className={`inline-flex cursor-pointer items-center gap-1 rounded-[var(--nx-radius-xs)] px-2.5 py-1 text-[11px] font-bold transition-colors ${
                viewMode === 'all'
                  ? 'bg-[var(--nx-bg-surface)] text-[var(--nx-indigo)] shadow-xs'
                  : 'text-[var(--nx-text-muted)] hover:text-[var(--nx-text-primary)]'
              }`}
            >
              <Globe2 className="h-3 w-3" aria-hidden="true" />
              <span>4 قارات</span>
            </button>
            <button
              type="button"
              data-testid="map-view-fit"
              onClick={() => setViewMode('fit')}
              aria-pressed={viewMode === 'fit'}
              className={`inline-flex cursor-pointer items-center gap-1 rounded-[var(--nx-radius-xs)] px-2.5 py-1 text-[11px] font-bold transition-colors ${
                viewMode === 'fit'
                  ? 'bg-[var(--nx-bg-surface)] text-[var(--nx-indigo)] shadow-xs'
                  : 'text-[var(--nx-text-muted)] hover:text-[var(--nx-text-primary)]'
              }`}
            >
              <Focus className="h-3 w-3" aria-hidden="true" />
              <span>تركيز القرى</span>
            </button>
            {selectedContinent !== 'all' && (
              <button
                type="button"
                data-testid="map-view-continent"
                onClick={() => setViewMode('continent')}
                aria-pressed={viewMode === 'continent'}
                className={`inline-flex cursor-pointer items-center gap-1 rounded-[var(--nx-radius-xs)] px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  viewMode === 'continent'
                    ? 'bg-[var(--nx-bg-surface)] text-[var(--nx-indigo)] shadow-xs'
                    : 'text-[var(--nx-text-muted)] hover:text-[var(--nx-text-primary)]'
                }`}
              >
                <Maximize2 className="h-3 w-3" aria-hidden="true" />
                <span>تكبير K{selectedContinent}</span>
              </button>
            )}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetView}
              className="nx-btn nx-btn-ghost nx-btn-compact"
              aria-label="إعادة ضبط خريطة العالم"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">إعادة ضبط</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Responsive Split */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start lg:gap-5">
        {/* Square Tactical Map Column */}
        <div className="lg:col-span-5">
          <div className="mx-auto w-full max-w-[360px] sm:max-w-[408px] lg:max-w-[436px]">
            {/* Compass North + X-Axis Scale */}
            <div
              dir="ltr"
              className="mb-1 flex items-center justify-between pl-7 pr-0.5 text-[10px] font-semibold text-[var(--nx-text-muted)]"
            >
              <span>غرب</span>
              <span className="font-bold text-[var(--nx-text-secondary)]">شمال</span>
              <span>شرق</span>
            </div>
            <div
              dir="ltr"
              className="font-mono-num mb-1 flex items-center justify-between ps-7 pe-0.5 text-[10px] font-semibold text-[var(--nx-text-muted)]"
              aria-hidden="true"
            >
              {xTicks.map((tick) => (
                <span key={tick}>{tick}</span>
              ))}
            </div>

            {/* Y-Axis + Square Map Frame */}
            <div dir="ltr" className="flex items-stretch gap-1.5">
              <div
                className="font-mono-num flex w-5 shrink-0 flex-col justify-between py-0.5 text-right text-[10px] font-semibold text-[var(--nx-text-muted)]"
                aria-hidden="true"
              >
                {yTicks.map((tick) => (
                  <span key={tick}>{tick}</span>
                ))}
              </div>

              <div
                data-testid="world-map-canvas"
                className="relative aspect-square w-full overflow-hidden rounded-[var(--nx-radius-md)] border border-[var(--nx-border-strong)] bg-[var(--nx-bg-canvas)] select-none"
              >
                {/* SVG Vector Tactical Grid */}
                <svg
                  viewBox="0 0 200 200"
                  className="pointer-events-none absolute inset-0 h-full w-full"
                  aria-hidden="true"
                >
                  {/* Selected continent tint when showing multiple continents */}
                  {!isSingleContinent &&
                    selectedContinent !== 'all' &&
                    axisXSvg !== null &&
                    axisYSvg !== null && (
                      <rect
                        x={selectedContinent === '44' || selectedContinent === '54' ? 0 : axisXSvg}
                        y={selectedContinent === '44' || selectedContinent === '45' ? 0 : axisYSvg}
                        width={
                          selectedContinent === '44' || selectedContinent === '54'
                            ? axisXSvg
                            : 200 - axisXSvg
                        }
                        height={
                          selectedContinent === '44' || selectedContinent === '45'
                            ? axisYSvg
                            : 200 - axisYSvg
                        }
                        fill="var(--nx-indigo)"
                        fillOpacity={0.08}
                      />
                    )}

                  {/* Fine Sub-grid */}
                  {[25, 50, 75, 100, 125, 150, 175].map((pos) => (
                    <g key={pos}>
                      <line
                        x1={pos}
                        y1={0}
                        x2={pos}
                        y2={200}
                        stroke="var(--nx-border)"
                        strokeOpacity={0.85}
                        strokeWidth={0.55}
                      />
                      <line
                        x1={0}
                        y1={pos}
                        x2={200}
                        y2={pos}
                        stroke="var(--nx-border)"
                        strokeOpacity={0.85}
                        strokeWidth={0.55}
                      />
                    </g>
                  ))}

                  {/* Core & Mid-Rim rings around 500|500 in full 4-continent mode */}
                  {effectiveZoom === 'all' && (
                    <>
                      <circle
                        cx={100}
                        cy={100}
                        r={40}
                        fill="var(--nx-indigo)"
                        fillOpacity={0.035}
                        stroke="var(--nx-border-strong)"
                        strokeOpacity={0.65}
                        strokeWidth={0.65}
                        strokeDasharray="2.5 2.5"
                      />
                      <circle
                        cx={100}
                        cy={100}
                        r={80}
                        fill="none"
                        stroke="var(--nx-border-strong)"
                        strokeOpacity={0.5}
                        strokeWidth={0.6}
                        strokeDasharray="2.5 3"
                      />
                    </>
                  )}

                  {/* True Geographic Continent Dividers (X=500 & Y=500) */}
                  {!isSingleContinent && axisXSvg !== null && (
                    <line
                      x1={axisXSvg}
                      y1={0}
                      x2={axisXSvg}
                      y2={200}
                      stroke="var(--nx-border-strong)"
                      strokeWidth={1.35}
                    />
                  )}
                  {!isSingleContinent && axisYSvg !== null && (
                    <line
                      x1={0}
                      y1={axisYSvg}
                      x2={200}
                      y2={axisYSvg}
                      stroke="var(--nx-border-strong)"
                      strokeWidth={1.35}
                    />
                  )}

                  {/* World Center 500|500 Reticle when visible */}
                  {!isSingleContinent && axisXSvg !== null && axisYSvg !== null && (
                    <>
                      <circle
                        cx={axisXSvg}
                        cy={axisYSvg}
                        r={3}
                        fill="var(--nx-bg-surface)"
                        stroke="var(--nx-indigo)"
                        strokeWidth={1}
                      />
                      <circle cx={axisXSvg} cy={axisYSvg} r={0.95} fill="var(--nx-indigo)" />
                    </>
                  )}
                </svg>

                {/* Quadrant Corner Labels (explicitly labeled K44..K55 + Arabic direction) */}
                {!isSingleContinent ? (
                  <>
                    <div className="pointer-events-none absolute top-1.5 left-2 flex items-center gap-1 rounded bg-[var(--nx-bg-surface)]/80 px-1.5 py-0.5 text-[10px]">
                      <span className="font-mono-num font-extrabold text-[var(--nx-text-primary)]/85">
                        K44
                      </span>
                      <span className="hidden text-[9px] text-[var(--nx-text-muted)] sm:inline">
                        ش.غرب
                      </span>
                    </div>
                    <div className="pointer-events-none absolute top-1.5 right-2 flex items-center gap-1 rounded bg-[var(--nx-bg-surface)]/80 px-1.5 py-0.5 text-[10px]">
                      <span className="hidden text-[9px] text-[var(--nx-text-muted)] sm:inline">
                        ش.شرق
                      </span>
                      <span className="font-mono-num font-extrabold text-[var(--nx-text-primary)]/85">
                        K45
                      </span>
                    </div>
                    <div className="pointer-events-none absolute bottom-1.5 left-2 flex items-center gap-1 rounded bg-[var(--nx-bg-surface)]/80 px-1.5 py-0.5 text-[10px]">
                      <span className="font-mono-num font-extrabold text-[var(--nx-text-primary)]/85">
                        K54
                      </span>
                      <span className="hidden text-[9px] text-[var(--nx-text-muted)] sm:inline">
                        ج.غرب
                      </span>
                    </div>
                    <div className="pointer-events-none absolute right-2 bottom-1.5 flex items-center gap-1 rounded bg-[var(--nx-bg-surface)]/80 px-1.5 py-0.5 text-[10px]">
                      <span className="hidden text-[9px] text-[var(--nx-text-muted)] sm:inline">
                        ج.شرق
                      </span>
                      <span className="font-mono-num font-extrabold text-[var(--nx-text-primary)]/85">
                        K55
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="pointer-events-none absolute top-2 left-2 flex items-center gap-1.5 rounded-[var(--nx-radius-xs)] border border-[var(--nx-border)] bg-[var(--nx-bg-surface)]/90 px-2 py-0.5">
                    <span className="font-mono-num text-xs font-extrabold text-[var(--nx-indigo)]">
                      K{effectiveZoom}
                    </span>
                    <span className="text-[10px] font-semibold text-[var(--nx-text-muted)]">
                      {selectedContinentMeta?.regionLabel}
                    </span>
                  </div>
                )}

                {/* Village Markers (Color-Coded: Red = Offense, Blue = Defense, Yellow = Unset) */}
                {visiblePins.map((pt) => {
                  const isDimmed =
                    !isSingleContinent &&
                    selectedContinent !== 'all' &&
                    pt.continent !== selectedContinent;
                  const isFocused = hoveredVillageId === pt.villageId;
                  const isActive = activeVillageId === pt.villageId;

                  return (
                    <button
                      key={pt.villageId}
                      type="button"
                      data-testid={`map-pin-${pt.villageId}`}
                      data-continent={pt.continent}
                      data-role={pt.villageRole}
                      onMouseEnter={() => setHoveredVillageId(pt.villageId)}
                      onMouseLeave={() =>
                        setHoveredVillageId((prev) => (prev === pt.villageId ? null : prev))
                      }
                      onFocus={() => setHoveredVillageId(pt.villageId)}
                      onBlur={() =>
                        setHoveredVillageId((prev) => (prev === pt.villageId ? null : prev))
                      }
                      onClick={() => onOpenVillage(pt.villageId)}
                      aria-label={`${pt.villageName} (${pt.coordText}) · قارة K${pt.continent} · ${ROLE_LABEL[pt.villageRole]}`}
                      style={{ left: `${pt.xPct}%`, top: `${pt.yPct}%` }}
                      className={`group absolute -translate-x-1/2 -translate-y-1/2 flex cursor-pointer items-center justify-center rounded-full focus:outline-none ${
                        isDense ? 'h-3.5 w-3.5' : 'h-4 w-4'
                      } ${isFocused ? 'z-30' : isActive ? 'z-20' : 'z-10'} ${
                        isDimmed ? 'opacity-20' : 'opacity-100'
                      }`}
                    >
                      <span
                        className={`block rounded-full border-[1.5px] shadow-xs transition-transform duration-150 ${
                          ROLE_PIN_CLASS[pt.villageRole]
                        } ${
                          isFocused
                            ? 'h-3.5 w-3.5 scale-125 ring-2 ring-[var(--nx-indigo)] ring-offset-1 ring-offset-[var(--nx-bg-canvas)]'
                            : isActive
                              ? 'h-3 w-3 ring-2 ring-[var(--nx-indigo)]/80 ring-offset-1 ring-offset-[var(--nx-bg-canvas)]'
                              : isDense
                                ? 'h-2.5 w-2.5 group-hover:scale-125'
                                : 'h-3 w-3 group-hover:scale-125'
                        }`}
                      />
                    </button>
                  );
                })}

                {/* Compact Hover/Focus Tooltip */}
                {focusedPoint && (
                  <div
                    dir="rtl"
                    style={{
                      left: `${Math.min(76, Math.max(24, focusedPoint.xPct))}%`,
                      top:
                        focusedPoint.yPct > 22
                          ? `${focusedPoint.yPct - 5.5}%`
                          : `${focusedPoint.yPct + 7.5}%`
                    }}
                    className={`pointer-events-none absolute z-40 -translate-x-1/2 whitespace-nowrap rounded-[var(--nx-radius-sm)] border border-[var(--nx-border-strong)] bg-[var(--nx-bg-surface)]/95 px-2.5 py-1.5 text-right shadow-md ${
                      focusedPoint.yPct > 22 ? '-translate-y-full' : 'translate-y-0'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--nx-text-primary)]">
                      <span
                        className={`h-2 w-2 rounded-full ${ROLE_DOT_CLASS[focusedPoint.villageRole]}`}
                        aria-hidden="true"
                      />
                      <span>{focusedPoint.villageName}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--nx-text-muted)]">
                      <span dir="ltr" className="font-mono-num font-semibold text-[var(--nx-text-secondary)]">
                        {focusedPoint.coordText} K{focusedPoint.continent}
                      </span>
                      <span>·</span>
                      <span className={`font-bold ${ROLE_TEXT_CLASS[focusedPoint.villageRole]}`}>
                        {ROLE_LABEL[focusedPoint.villageRole]}
                      </span>
                    </div>
                  </div>
                )}

                {/* Empty overlay */}
                {visiblePins.length === 0 && (
                  <div
                    dir="rtl"
                    className="pointer-events-none absolute inset-0 flex items-center justify-center p-4 text-center"
                  >
                    <div className="rounded-[var(--nx-radius-sm)] border border-[var(--nx-border)] bg-[var(--nx-bg-surface)]/90 px-3 py-2 text-xs text-[var(--nx-text-muted)]">
                      لا توجد قرى مطابقة للتصفية الحالية
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Interactive Role Filter Legend Bar (Red = Offense, Blue = Defense, Yellow = Unset) */}
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 ps-6">
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="تصفية الخريطة حسب نوع القرية">
                {(
                  [
                    { id: 'all', label: 'الكل', count: mapData.totalVillages, dot: null },
                    { id: 'offense', label: 'هجوم', count: mapData.roleCounts.offense, dot: ROLE_DOT_CLASS.offense },
                    { id: 'defense', label: 'دفاع', count: mapData.roleCounts.defense, dot: ROLE_DOT_CLASS.defense },
                    { id: 'unset', label: 'غير محددة', count: mapData.roleCounts.unset, dot: ROLE_DOT_CLASS.unset }
                  ] as const
                ).map((item) => {
                  const active = roleFilter === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-testid={`map-role-filter-${item.id}`}
                      aria-pressed={active}
                      onClick={() => setRoleFilter(item.id)}
                      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-[var(--nx-radius-xs)] border px-2 py-1 text-[11px] font-semibold transition-colors ${
                        active
                          ? 'border-[var(--nx-indigo)] bg-[var(--nx-indigo-soft)]/50 text-[var(--nx-text-primary)]'
                          : 'border-[var(--nx-border)] bg-[var(--nx-bg-surface)] text-[var(--nx-text-muted)] hover:border-[var(--nx-border-strong)]'
                      }`}
                    >
                      {item.dot && <span className={`h-2 w-2 rounded-full ${item.dot}`} aria-hidden="true" />}
                      <span>{item.label}</span>
                      <span className="font-mono-num font-bold text-[var(--nx-text-primary)]">
                        {item.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <span dir="ltr" className="font-mono-num inline-flex items-center gap-1 text-[10px] text-[var(--nx-text-muted)]">
                <Crosshair className="h-3 w-3 text-[var(--nx-indigo)]" aria-hidden="true" />
                {effectiveZoom === 'all'
                  ? '500|500'
                  : `${mapData.bounds.minX}–${mapData.bounds.maxX - 1}`}
              </span>
            </div>
          </div>
        </div>

        {/* Continent Breakdown & Compact Village Directory */}
        <div className="flex flex-col gap-3.5 lg:col-span-7">
          {/* 2x2 Geographic Continent Cards (K44 TL, K45 TR, K54 BL, K55 BR) */}
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2 text-xs text-[var(--nx-text-muted)]">
              <span className="font-semibold text-[var(--nx-text-secondary)]">
                القارات الأربع (مطابقة لاتجاه الخريطة)
              </span>
              <span className="hidden sm:inline">اضغط على القارة للتركيز أو التكبير</span>
            </div>

            <div dir="ltr" className="grid grid-cols-2 gap-2">
              {mapData.continents.map((cont) => {
                const isSelected = selectedContinent === cont.code;
                return (
                  <button
                    key={cont.code}
                    type="button"
                    data-testid={`world-map-continent-${cont.code}`}
                    onClick={() => handleSelectContinent(cont.code)}
                    aria-pressed={isSelected}
                    dir="rtl"
                    className={`cursor-pointer rounded-[var(--nx-radius-md)] border p-2.5 text-right transition-colors sm:p-3 ${
                      isSelected
                        ? 'border-[var(--nx-indigo)] bg-[var(--nx-indigo-soft)]/50'
                        : 'border-[var(--nx-border)] bg-[var(--nx-bg-canvas)]/60 hover:border-[var(--nx-border-strong)] hover:bg-[var(--nx-bg-subtle)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-mono-num text-sm font-extrabold text-[var(--nx-text-primary)]">
                          {cont.label}
                        </span>
                        <span className="text-[11px] text-[var(--nx-text-muted)]">
                          {cont.regionLabel}
                        </span>
                      </div>
                      <span className="font-mono-num text-xs font-bold text-[var(--nx-text-primary)]">
                        {cont.villagesCount}
                        <span className="ms-0.5 text-[10px] font-normal text-[var(--nx-text-muted)]">
                          قرية
                        </span>
                      </span>
                    </div>

                    {/* Offense / Defense / Unset breakdown per continent */}
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                      <div className="flex items-center gap-2 font-mono-num">
                        <span className="inline-flex items-center gap-1 font-bold text-red-600 dark:text-red-400" title="قرى هجوم">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden="true" />
                          {cont.offenseCount}
                        </span>
                        <span className="inline-flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400" title="قرى دفاع">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" aria-hidden="true" />
                          {cont.defenseCount}
                        </span>
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-yellow-300" title="غير محددة">
                          <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" aria-hidden="true" />
                          {cont.unsetCount}
                        </span>
                      </div>
                      <span className="font-mono-num text-[10px] font-semibold text-[var(--nx-text-muted)]">
                        {Math.round(cont.dailyPP)} PP/ي
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Compact Searchable Villages Directory (scales cleanly to 50+ villages on mobile & laptop) */}
          <div className="overflow-hidden rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] bg-[var(--nx-bg-canvas)]/50">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--nx-border)] bg-[var(--nx-bg-surface)] px-3 py-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--nx-text-primary)]">
                <MapPin className="h-3.5 w-3.5 text-[var(--nx-indigo)]" aria-hidden="true" />
                <span>
                  {selectedContinent === 'all'
                    ? 'قرى الخريطة'
                    : `قرى القارة K${selectedContinent}`}
                </span>
                <span className="font-mono-num text-[11px] font-semibold text-[var(--nx-text-muted)]">
                  ({scopeVillages.length})
                </span>
              </div>

              {mapData.totalVillages > 8 ? (
                <div className="relative w-full sm:w-48">
                  <Search
                    className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--nx-text-muted)]"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={listQuery}
                    onChange={(e) => setListQuery(e.target.value)}
                    placeholder="بحث بالاسم أو الإحداثيات..."
                    aria-label="بحث في قرى الخريطة"
                    className="nx-input !h-7 w-full !ps-8 !pe-2 !text-xs"
                  />
                </div>
              ) : (
                <span className="text-[11px] text-[var(--nx-text-muted)]">
                  إحداثيات دقيقة: {mapData.mappedExactCount}/{mapData.totalVillages}
                </span>
              )}
            </div>

            {scopeVillages.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-[var(--nx-text-muted)]">
                لا توجد قرى مطابقة في هذا النطاق.
              </div>
            ) : (
              <div className="max-h-[208px] divide-y divide-[var(--nx-border)] overflow-y-auto sm:max-h-[224px]">
                {scopeVillages.map((pt) => {
                  const isHovered = hoveredVillageId === pt.villageId;
                  return (
                    <button
                      key={pt.villageId}
                      type="button"
                      onMouseEnter={() => setHoveredVillageId(pt.villageId)}
                      onMouseLeave={() =>
                        setHoveredVillageId((prev) => (prev === pt.villageId ? null : prev))
                      }
                      onClick={() => onOpenVillage(pt.villageId)}
                      className={`flex w-full cursor-pointer items-center justify-between gap-2.5 px-3 py-2 text-right transition-colors ${
                        isHovered
                          ? 'bg-[var(--nx-indigo-soft)]/45'
                          : 'hover:bg-[var(--nx-bg-subtle)]'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 shrink-0 rounded-full ${ROLE_DOT_CLASS[pt.villageRole]}`}
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <div className="truncate text-xs font-bold text-[var(--nx-text-primary)]">
                            {pt.villageName}
                          </div>
                          <div className="truncate text-[11px] text-[var(--nx-text-muted)]">
                            {pt.accountName} · {pt.statusLabel}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-left">
                        <div
                          dir="ltr"
                          className="font-mono-num inline-flex items-center gap-1.5 text-xs font-bold text-[var(--nx-text-primary)]"
                        >
                          <span>{pt.coordText}</span>
                          <span className="text-[10px] font-semibold text-[var(--nx-text-muted)]">
                            K{pt.continent}
                          </span>
                        </div>
                        <div className={`text-[11px] font-bold ${ROLE_TEXT_CLASS[pt.villageRole]}`}>
                          {ROLE_LABEL[pt.villageRole]}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
