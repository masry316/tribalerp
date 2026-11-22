import {
  CheckCircle2,
  Clock,
  Edit3,
  ExternalLink,
  Hammer,
  ShieldAlert,
  Swords,
  Target,
  Warehouse
} from 'lucide-react';
import {
  calcVillagePointsFromBuildings,
  computeMissionBriefingForVillage,
  formatHoursArabic,
  formatPPAndCurrency,
  formatTimeAgo,
  type ErpAppState,
  type ErpUserAccount,
  type ErpVillage,
  type VillageLiveStatus
} from '../../core';

interface VillageOperationalCardProps {
  vil: ErpVillage;
  acc: ErpUserAccount | null;
  live: VillageLiveStatus;
  state: ErpAppState;
  isActive?: boolean;
  onSelectActive?: (villageId: string) => void;
  onOpenVillageDetail: (villageId: string) => void;
  onOpenAccountFlow: (accountId: string) => void;
  onOpenMissionModal: (villageId: string) => void;
  onOpenVillageModal: (villageId: string) => void;
}

export function VillageOperationalCard({
  vil,
  acc,
  live,
  state,
  isActive = false,
  onSelectActive,
  onOpenVillageDetail,
  onOpenAccountFlow,
  onOpenMissionModal,
  onOpenVillageModal
}: VillageOperationalCardProps) {
  const briefing = computeMissionBriefingForVillage(vil, state, live);
  const points = vil.buildings
    ? calcVillagePointsFromBuildings(vil.buildings)
    : Number(vil.villagePoints || 26);

  const dailyPPFormatted = formatPPAndCurrency(live.dailyPP, state, {
    decimals: 1,
    unit: 'نقطة',
    perDay: true
  });

  const isScavReady = live.scavState === 'idle_troops' || live.scavState === 'returned';
  const hasReadyStep = briefing.readyStepsNow.length > 0;
  const isCriticalWh = live.status === 'critical' && live.maxWhPct >= 85;
  const isWarningWh = live.status === 'warning';

  let actionHeadline = '';
  let actionToneClass = 'bg-[var(--nx-bg-subtle)] text-[var(--nx-text-secondary)]';
  if (vil.isVirtual) {
    actionHeadline = hasReadyStep
      ? `قرية افتراضية جاهزة للخطة · بانتظار المزامنة عند فتح العالم`
      : 'قرية افتراضية · بانتظار أول مزامنة من اللعبة';
    actionToneClass = 'bg-[var(--nx-indigo-soft)] text-[var(--nx-indigo)]';
  } else if (isCriticalWh) {
    actionHeadline = `مخزن ${live.firstFullRes} ${live.maxWhPct}% · يمتلئ خلال ${formatHoursArabic(live.minHoursLeft)}`;
    actionToneClass = 'bg-[var(--nx-coral-bg)] text-[var(--nx-coral)]';
  } else if (isScavReady) {
    actionHeadline =
      live.scavState === 'returned'
        ? `الجيش عاد للإغارة · حمولة ${live.haulHome.toLocaleString('en-US')}`
        : `جيش متوقف للإغارة · حمولة ${live.haulHome.toLocaleString('en-US')}`;
    actionToneClass = 'bg-[var(--nx-amber-bg)] text-[var(--nx-amber)]';
  } else if (hasReadyStep) {
    const first = briefing.readyStepsNow[0];
    actionHeadline = `جاهز بالخطة: ${first.bName} (م${first.targetLvl})`;
    actionToneClass = 'bg-[var(--nx-emerald-bg)] text-[var(--nx-emerald)]';
  } else if (isWarningWh) {
    actionHeadline = `مخزن ${live.firstFullRes} ${live.maxWhPct}% · خلال ${formatHoursArabic(live.minHoursLeft)}`;
    actionToneClass = 'bg-[var(--nx-amber-bg)] text-[var(--nx-amber)]';
  } else if (live.scavState === 'running') {
    actionHeadline = `إغارة جارية · تعود بعد ${formatHoursArabic(live.scavRemHours)}`;
  } else if (live.isMarketCompletelyBlocked) {
    actionHeadline = 'السوق ممتلئ 100% في هذه القارة';
    actionToneClass = 'bg-[var(--nx-coral-bg)] text-[var(--nx-coral)]';
  } else {
    actionHeadline = 'القرية مستقرة';
  }

  const planPct =
    briefing.totalSteps > 0
      ? Math.round((briefing.completedStepsCount / briefing.totalSteps) * 100)
      : 0;

  const whColors = (pct: number) =>
    pct >= 90 ? 'var(--nx-coral)' : pct >= 75 ? 'var(--nx-amber)' : 'var(--nx-emerald)';

  return (
    <article
      className={`nx-card nx-transition flex flex-col justify-between gap-3.5 p-4 ${
        isActive ? 'ring-1 ring-[var(--nx-indigo)] border-[var(--nx-indigo)]' : ''
      }`}
    >
      {/* Header: Village Identity + Actions */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <button
              type="button"
              onClick={() => onOpenVillageDetail(vil.id)}
              className="cursor-pointer truncate text-sm font-bold text-[var(--nx-text-primary)] hover:text-[var(--nx-indigo)]"
            >
              {vil.name}
            </button>
            <span dir="ltr" className="font-mono-num shrink-0 text-xs text-[var(--nx-text-muted)]">
              {vil.coord || '—'}
            </span>
            {vil.isVirtual && (
              <span className="shrink-0 rounded-[var(--nx-radius-xs)] bg-[var(--nx-indigo-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--nx-indigo)]">
                افتراضية
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-[var(--nx-text-muted)]">
            {acc ? (
              <button
                type="button"
                onClick={() => onOpenAccountFlow(acc.id)}
                className="cursor-pointer font-semibold text-[var(--nx-indigo)] hover:underline"
              >
                {acc.name}
              </button>
            ) : (
              <span>بدون حساب</span>
            )}
            <span>·</span>
            <span>
              {live.worldName} (K{vil.continent})
            </span>
            <span>·</span>
            <span className="font-mono-num">{points.toLocaleString('en-US')} ن.ق</span>
            <span>·</span>
            <span className={!vil.isVirtual && live.isStaleSync ? 'font-semibold text-[var(--nx-amber)]' : ''}>
              {vil.isVirtual ? 'بانتظار المزامنة' : formatTimeAgo(vil.lastSyncTime || live.syncRefTs)}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {onSelectActive && (
            <button
              type="button"
              onClick={() => onSelectActive(vil.id)}
              aria-pressed={isActive}
              title={isActive ? 'القرية النشطة حالياً' : 'تحديد كقرية نشطة'}
              aria-label={`تحديد ${vil.name} كقرية نشطة`}
              className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--nx-radius-sm)] border ${
                isActive
                  ? 'border-[var(--nx-indigo)] bg-[var(--nx-indigo-soft)] text-[var(--nx-indigo)]'
                  : 'border-[var(--nx-border)] text-[var(--nx-text-muted)] hover:bg-[var(--nx-bg-hover)]'
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpenMissionModal(vil.id)}
            title="إحاطة المهام"
            aria-label={`إحاطة مهام ${vil.name}`}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--nx-radius-sm)] border border-[var(--nx-border)] text-[var(--nx-indigo)] hover:bg-[var(--nx-bg-hover)]"
          >
            <Target className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onOpenVillageModal(vil.id)}
            title="تعديل بيانات القرية"
            aria-label={`تعديل ${vil.name}`}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--nx-radius-sm)] border border-[var(--nx-border)] text-[var(--nx-text-secondary)] hover:bg-[var(--nx-bg-hover)]"
          >
            <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Single Concise Operational Status */}
      <div className={`flex items-center gap-2 rounded-[var(--nx-radius-sm)] px-3 py-2 text-xs font-semibold ${actionToneClass}`}>
        {isCriticalWh || isWarningWh ? (
          <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
        ) : isScavReady ? (
          <Swords className="h-4 w-4 shrink-0" aria-hidden="true" />
        ) : hasReadyStep ? (
          <Hammer className="h-4 w-4 shrink-0" aria-hidden="true" />
        ) : (
          <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
        )}
        <span className="leading-snug">{actionHeadline}</span>
      </div>

      {/* Simplified Warehouse Levels */}
      <div className="space-y-2 border-t border-[var(--nx-border)] pt-3">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--nx-text-secondary)]">
            <Warehouse className="h-3.5 w-3.5 text-[var(--nx-text-muted)]" aria-hidden="true" />
            <span>المخزن ({live.cap.toLocaleString('en-US')})</span>
          </span>
          <span
            className={`font-mono-num font-bold ${
              isCriticalWh
                ? 'text-[var(--nx-coral)]'
                : isWarningWh
                  ? 'text-[var(--nx-amber)]'
                  : 'text-[var(--nx-text-muted)]'
            }`}
          >
            {live.firstFullRes}: {formatHoursArabic(live.minHoursLeft)}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {[
            { label: 'خشب', pct: live.wPct, stock: live.currentWood },
            { label: 'طمي', pct: live.cPct, stock: live.currentClay },
            { label: 'حديد', pct: live.iPct, stock: live.currentIron }
          ].map((res) => (
            <div key={res.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--nx-text-muted)]">{res.label}</span>
                <span className="font-mono-num font-bold text-[var(--nx-text-primary)]">{res.pct}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--nx-bg-muted)]">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${res.pct}%`, backgroundColor: whColors(res.pct) }}
                />
              </div>
              <div className="font-mono-num text-xs text-[var(--nx-text-muted)]">
                {res.stock.toLocaleString('en-US')}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Compact Footer: Production & Daily Return + Room Link */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--nx-border)] pt-3 text-xs">
        <div className="min-w-0 space-y-0.5">
          <div className="font-mono-num font-bold text-[var(--nx-text-primary)]">
            +{Math.round(live.totalHourly).toLocaleString('en-US')}/س ·{' '}
            <span className={live.dailyPP <= 0 ? 'text-[var(--nx-coral)]' : 'text-[var(--nx-indigo)]'}>
              {dailyPPFormatted.ppText}
            </span>
            {!live.isMarketClosed && !live.isMarketCompletelyBlocked && (
              <span className="ms-1 font-normal text-[var(--nx-text-muted)]">
                ({dailyPPFormatted.moneyText})
              </span>
            )}
          </div>
          <div className="text-xs text-[var(--nx-text-muted)]">
            {briefing.hasPlan ? (
              <span>
                {briefing.planName} ({planPct}%)
              </span>
            ) : (
              <span>
                جيش: {live.homeTroops}/{live.totalTroops}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onOpenVillageDetail(vil.id)}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1 font-semibold text-[var(--nx-indigo)] hover:underline"
        >
          <span>غرفة القرية</span>
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}
