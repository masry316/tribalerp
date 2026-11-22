import type { MouseEvent } from 'react';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Compass,
  Hammer,
  Swords,
  Trash2,
  Zap
} from 'lucide-react';
import {
  calcScavDispatch,
  calcVillagePointsFromBuildings,
  computeMissionBriefingForVillage,
  computeVillageLiveStatus,
  formatHoursArabic,
  formatPPAndCurrency,
  formatSecondsArabic,
  formatTimeAgo,
  type AssignedPlan,
  type ErpAppState
} from '../../core';
import type { MutationResult } from '../../data';
import { ResourceRadialGauge, useLiveClock } from '../components/TacticalWidgets';
import { SectionHeader } from '../components/UiPrimitives';

interface VillageDetailPageProps {
  villageId: string;
  state: ErpAppState;
  navigate: (path: string) => void;
  onAssignPlan: (villageId: string, plan: AssignedPlan | null) => MutationResult;
}

export function VillageDetailPage({
  villageId,
  state,
  navigate,
  onAssignPlan
}: VillageDetailPageProps) {
  const nowTs = useLiveClock(1000);
  const vil = state.villages.find((v) => v.id === villageId);

  function handleLinkClick(e: MouseEvent<HTMLAnchorElement>, path: string) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    navigate(path);
  }

  if (!vil) {
    return (
      <main className="nx-card p-10 text-center">
        <h2 className="text-xl font-bold text-[var(--nx-text-primary)]">
          القرية غير موجودة
        </h2>
        <p className="mt-2 text-sm text-[var(--nx-text-secondary)]">
          لم يتم العثور على قرية بالمعرّف المطلوب.
        </p>
        <div className="mt-6">
          <a
            href="/dashboard"
            onClick={(e) => handleLinkClick(e, '/dashboard')}
            className="nx-btn nx-btn-primary"
          >
            العودة إلى المرصد الميداني
          </a>
        </div>
      </main>
    );
  }

  const acc = state.userAccounts.find((a) => a.id === vil.accountId);
  const live = computeVillageLiveStatus(vil, state, nowTs);
  const briefing = computeMissionBriefingForVillage(vil, state, live);
  const points = vil.buildings
    ? calcVillagePointsFromBuildings(vil.buildings)
    : Number(vil.villagePoints || 26);
  const planSteps = vil.assignedPlan?.steps || [];
  const buildingsEntries = Object.entries(vil.buildings || {});

  const homeByKey: Record<string, number> = {};
  live.armyMatrix.forEach((m) => {
    homeByKey[m.key] = m.home;
  });
  const detectedScavTiers = Number(
    vil.unlockedScavTiers ||
      vil.scavData?.unlockedScavTiers ||
      vil.scavData?.unlockedTiers ||
      0
  );
  const effectiveScavTiers = detectedScavTiers > 0 ? detectedScavTiers : 4;
  const scavDispatch =
    live.haulHome > 0
      ? calcScavDispatch(
          homeByKey.spear || 0,
          homeByKey.sword || 0,
          effectiveScavTiers,
          state.asimConfig?.sessionHrs ?? 2,
          12,
          live.worldSpeed,
          state.asimConfig?.scavMode ?? 'max_profit',
          state.asimConfig?.unitSpeed ?? 1.0,
          homeByKey.axe || 0,
          homeByKey.spy || 0,
          homeByKey.light || 0,
          homeByKey.heavy || 0,
          homeByKey.archer || 0,
          homeByKey.marcher || 0,
          homeByKey.knight || 0
        )
      : null;

  // Active Construction Calculation
  const isBuildingActive = Boolean(vil.buildEndAt && vil.buildEndAt > nowTs);
  const buildRemSec = isBuildingActive ? Math.max(0, Math.round((vil.buildEndAt! - nowTs) / 1000)) : 0;

  return (
    <main className="space-y-5">
      {/* Command Header */}
      <section className="nx-card p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--nx-text-muted)]">
              <a
                href="/dashboard"
                onClick={(e) => handleLinkClick(e, '/dashboard')}
                className="inline-flex items-center gap-1 hover:text-[var(--nx-text-primary)]"
              >
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                <span>المرصد الميداني</span>
              </a>
              <span aria-hidden="true">/</span>
              <span>
                {live.worldName} ({live.worldSpeed}x)
              </span>
              <span aria-hidden="true">/</span>
              <span className="font-mono">K{vil.continent}</span>
            </div>

            <h1 className="mt-2 flex flex-wrap items-baseline gap-3 text-2xl font-extrabold text-[var(--nx-text-primary)] sm:text-3xl">
              <span>{vil.name}</span>
              <span
                dir="ltr"
                className="font-mono text-lg font-bold text-[var(--nx-amber)]"
              >
                {vil.coord || '—'}
              </span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <a
              href={`/planner?villageId=${encodeURIComponent(vil.id)}`}
              onClick={(e) => handleLinkClick(e, `/planner?villageId=${encodeURIComponent(vil.id)}`)}
              className="nx-btn nx-btn-primary"
            >
              <Compass className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>توليد خطة ذكية للقرية</span>
            </a>
            {acc ? (
              <a
                href={`/accounts/${encodeURIComponent(acc.id)}`}
                onClick={(e) => handleLinkClick(e, `/accounts/${encodeURIComponent(acc.id)}`)}
                className="nx-btn nx-btn-outline"
              >
                <span>الحساب: {acc.name}</span>
              </a>
            ) : null}
          </div>
        </div>

        {/* Live Active Building Construction Status Banner */}
        {isBuildingActive && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--nx-radius-md)] border border-[var(--nx-indigo)]/35 bg-[var(--nx-indigo-soft)] p-3 text-xs">
            <div className="flex items-center gap-2 text-[var(--nx-indigo)]">
              <Hammer className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="font-semibold">
                طابور البناء نشط حالياً في القرية · يكتمل خلال {formatSecondsArabic(buildRemSec)}
              </span>
            </div>
          </div>
        )}

        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-[var(--nx-border)] pt-4 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-[var(--nx-text-muted)]">النقاط التقديرية</dt>
            <dd className="mt-1 text-lg font-bold tabular-nums text-[var(--nx-text-primary)]">
              <span className="font-mono">{points.toLocaleString('en-US')}</span>{' '}
              <span className="text-xs font-medium text-[var(--nx-text-muted)]">نقطة</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--nx-text-muted)]">سعة المخزن</dt>
            <dd className="mt-1 font-mono text-lg font-bold tabular-nums text-[var(--nx-text-primary)]">
              {live.cap.toLocaleString('en-US')}
            </dd>
            <dd className="text-xs text-[var(--nx-text-muted)]">
              {live.firstFullRes} يمتلئ خلال {formatHoursArabic(live.minHoursLeft)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--nx-text-muted)]">العائد اليومي المقدر</dt>
            {(() => {
              const dailyFmt = formatPPAndCurrency(live.dailyPP, state, {
                decimals: 1,
                unit: 'نقطة',
                perDay: true
              });
              const unsoldFmt = formatPPAndCurrency(live.unsoldPP, state, {
                decimals: 1,
                unit: 'نقطة'
              });
              return (
                <>
                  <dd className="mt-1 font-mono text-lg font-bold tabular-nums text-[var(--nx-emerald)]">
                    {dailyFmt.ppText}{' '}
                    <span className="text-sm text-[var(--nx-text-secondary)]">/ {dailyFmt.moneyText}</span>
                  </dd>
                  <dd className="font-mono text-xs tabular-nums text-[var(--nx-text-muted)]">
                    متاح بالمخزن: {unsoldFmt.combinedText}
                  </dd>
                </>
              );
            })()}
          </div>
          <div>
            <dt className="text-xs text-[var(--nx-text-muted)]">أسعار الصرف والسعة</dt>
            <dd className="mt-1 font-mono text-xs tabular-nums text-[var(--nx-text-primary)]">
              خ {live.sellWood} / ط {live.sellClay} / ح {live.sellIron} · شراء {live.buyRate}
            </dd>
            <dd className="mt-0.5 text-xs text-[var(--nx-text-muted)]">
              {live.isMarketCompletelyBlocked
                ? '⚠️ السوق ممتلئ 100%'
                : `المزامنة: ${formatTimeAgo(vil.lastSyncTime || live.syncRefTs)}`}
            </dd>
          </div>
        </dl>
      </section>

      {/* Live 1s Radial Telemetry + Mission Briefing */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <section aria-labelledby="vil-meta-heading" className="nx-card p-5 lg:col-span-5">
          <SectionHeader
            headingId="vil-meta-heading"
            title="المخزون والإنتاج الحي"
            subtitle={`إجمالي الإنتاج: ${Math.round(live.totalHourly).toLocaleString('en-US')} مورد/ساعة`}
          />
          <div className="grid grid-cols-3 gap-3">
            <ResourceRadialGauge
              label="الخشب"
              value={live.currentWood}
              capacity={live.cap}
              pct={live.wPct}
              hourlyRate={live.wProd}
              accentHex="#10b981"
            />
            <ResourceRadialGauge
              label="الطمي"
              value={live.currentClay}
              capacity={live.cap}
              pct={live.cPct}
              hourlyRate={live.cProd}
              accentHex="#d97706"
            />
            <ResourceRadialGauge
              label="الحديد"
              value={live.currentIron}
              capacity={live.cap}
              pct={live.iPct}
              hourlyRate={live.iProd}
              accentHex="#0ea5e9"
            />
          </div>
        </section>

        <section aria-labelledby="vil-mission-heading" className="nx-card p-5 lg:col-span-7">
          <SectionHeader
            headingId="vil-mission-heading"
            title="إحاطة المهام المباشرة"
            subtitle={
              briefing.hasAnyImmediateAction
                ? 'يوجد إجراءات مطلوبة الآن في هذه القرية'
                : briefing.closeAndReopenMessage
            }
          />
          <dl className="divide-y divide-[var(--nx-border)] text-sm">
            <div className="grid grid-cols-1 gap-1 py-3 first:pt-0 sm:grid-cols-3">
              <dt className="font-medium text-[var(--nx-text-muted)]">الإغارات والجيش</dt>
              <dd className="font-semibold text-[var(--nx-text-primary)] sm:col-span-2">
                {briefing.scavengeSummary}
              </dd>
            </div>
            <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3">
              <dt className="font-medium text-[var(--nx-text-muted)]">
                السوق (<span className="font-mono">{briefing.freeMerchants}</span> تاجر)
              </dt>
              <dd className="text-[var(--nx-text-secondary)] sm:col-span-2">
                {briefing.shouldSellMarket ? briefing.marketSummary : 'لا توجد توصية بيع فوري الآن.'}
              </dd>
            </div>
            <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3">
              <dt className="font-medium text-[var(--nx-text-muted)]">الخطوات الجاهزة</dt>
              <dd className="sm:col-span-2">
                {briefing.readyStepsNow.length > 0 ? (
                  <ul className="list-inside list-disc space-y-1 font-medium text-[var(--nx-emerald)]">
                    {briefing.readyStepsNow.map((step, i) => (
                      <li key={`${step.bName}_${i}`}>
                        {step.bName} (مستوى {step.targetLvl})
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-[var(--nx-text-muted)]">
                    لا توجد خطوات جاهزة بالمخزون الحالي.
                  </span>
                )}
              </dd>
            </div>
            {briefing.nextWaitingStep ? (
              <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3">
                <dt className="font-medium text-[var(--nx-text-muted)]">الخطوة التالية</dt>
                <dd className="font-medium text-[var(--nx-text-secondary)] sm:col-span-2">
                  {briefing.nextWaitingStep.bName} (جاهزة خلال {briefing.nextStepReadyText})
                </dd>
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-1 py-3 last:pb-0 sm:grid-cols-3">
              <dt className="font-medium text-[var(--nx-text-muted)]">خلاصة القرار</dt>
              <dd
                className={`font-bold sm:col-span-2 ${
                  briefing.hasAnyImmediateAction
                    ? 'text-[var(--nx-amber)]'
                    : 'text-[var(--nx-emerald)]'
                }`}
              >
                {briefing.hasAnyImmediateAction
                  ? 'يوجد إجراءات مطلوبة الآن في هذه القرية.'
                  : briefing.closeAndReopenMessage}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      {/* Live Scavenging Dispatch Recommendation (shown when home haul capacity exists) */}
      {scavDispatch && scavDispatch.allocs.some((a) => a.cap > 0) ? (
        <section aria-labelledby="vil-scav-split-heading" className="nx-card space-y-4 p-5">
          <SectionHeader
            headingId="vil-scav-split-heading"
            title="تقسيم الإغارات المثالي للجيش الموجود بالقرية"
            subtitle={`على أساس ${effectiveScavTiers} مستويات إغارة · الغنيمة/جولة: ${scavDispatch.lootPerRun.toLocaleString('en-US')} مورد · العائد اليومي: ${scavDispatch.dailyLoot.toLocaleString('en-US')} (${scavDispatch.runsPerDay} جولة/يوم)`}
          />

          {/* Mobile Card-Based Scavenge Allocations */}
          <div className="grid grid-cols-1 gap-2.5 md:hidden">
            {scavDispatch.allocs
              .filter((a) => a.cap > 0)
              .map((a) => {
                const unitParts: string[] = [];
                if (a.kn > 0) unitParts.push(`${a.kn} قائد`);
                if (a.lc > 0) unitParts.push(`${a.lc} خفيف`);
                if (a.ma > 0) unitParts.push(`${a.ma} قوس خيل`);
                if (a.hc > 0) unitParts.push(`${a.hc} ثقيل`);
                if (a.sp > 0) unitParts.push(`${a.sp} رمح`);
                if (a.sw > 0) unitParts.push(`${a.sw} سيف`);
                if (a.ax > 0) unitParts.push(`${a.ax} فأس`);
                if (a.ar > 0) unitParts.push(`${a.ar} قوس`);
                return (
                  <div
                    key={a.tier}
                    className="rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] p-3"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-[var(--nx-text-primary)]">{a.name}</span>
                      <span className="font-mono text-[var(--nx-emerald)]">+{a.loot.toLocaleString('en-US')} مورد</span>
                    </div>
                    <div className="mt-1 text-xs text-[var(--nx-text-secondary)]">
                      {unitParts.join(' + ') || '—'}
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-[var(--nx-border)] pt-1.5 text-[11px] text-[var(--nx-text-muted)] font-mono">
                      <span>حمولة: {a.cap.toLocaleString('en-US')}</span>
                      <span>{formatSecondsArabic(a.durSec)}</span>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full border-collapse text-start">
              <thead>
                <tr>
                  <th className="border-b border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] px-3 py-2 text-start text-xs font-semibold text-[var(--nx-text-muted)]">الفئة</th>
                  <th className="border-b border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] px-3 py-2 text-start text-xs font-semibold text-[var(--nx-text-muted)]">الوحدات المرسلة</th>
                  <th className="border-b border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] px-3 py-2 text-start text-xs font-semibold text-[var(--nx-text-muted)]">الحمولة</th>
                  <th className="border-b border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] px-3 py-2 text-start text-xs font-semibold text-[var(--nx-text-muted)]">الغنيمة المتوقعة</th>
                  <th className="border-b border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] px-3 py-2 text-start text-xs font-semibold text-[var(--nx-text-muted)]">مدة الإغارة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--nx-border)] text-sm">
                {scavDispatch.allocs
                  .filter((a) => a.cap > 0)
                  .map((a) => {
                    const unitParts: string[] = [];
                    if (a.kn > 0) unitParts.push(`${a.kn} قائد`);
                    if (a.lc > 0) unitParts.push(`${a.lc} خفيف`);
                    if (a.ma > 0) unitParts.push(`${a.ma} قوس خيل`);
                    if (a.hc > 0) unitParts.push(`${a.hc} ثقيل`);
                    if (a.sp > 0) unitParts.push(`${a.sp} رمح`);
                    if (a.sw > 0) unitParts.push(`${a.sw} سيف`);
                    if (a.ax > 0) unitParts.push(`${a.ax} فأس`);
                    if (a.ar > 0) unitParts.push(`${a.ar} قوس`);
                    return (
                      <tr key={a.tier} className="hover:bg-[var(--nx-bg-hover)]">
                        <td className="px-3 py-2 font-semibold text-[var(--nx-text-primary)]">{a.name}</td>
                        <td className="px-3 py-2 font-mono text-xs tabular-nums text-[var(--nx-text-secondary)]">
                          {unitParts.join(' + ')}
                        </td>
                        <td className="px-3 py-2 font-mono tabular-nums text-[var(--nx-text-primary)]">
                          {a.cap.toLocaleString('en-US')}
                        </td>
                        <td className="px-3 py-2 font-mono font-bold tabular-nums text-[var(--nx-emerald)]">
                          +{a.loot.toLocaleString('en-US')}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap font-mono text-xs tabular-nums text-[var(--nx-text-muted)]">
                          {formatSecondsArabic(a.durSec)}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* Army Matrix + Visual Building Skyline Levels */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <section aria-labelledby="vil-army-heading" className="nx-card space-y-4 p-5 lg:col-span-7">
          <SectionHeader
            headingId="vil-army-heading"
            title="مصفوفة الجيش (12 وحدة)"
            subtitle={`الإجمالي: ${live.totalTroops.toLocaleString('en-US')} جندي · بالقرية: ${live.homeTroops.toLocaleString('en-US')} (حمولة ${live.haulHome.toLocaleString('en-US')}) · بالخارج: ${live.awayTroops.toLocaleString('en-US')}`}
            action={<Swords className="h-5 w-5 text-[var(--nx-text-muted)]" aria-hidden="true" />}
          />

          {live.armyMatrix.length === 0 ? (
            <div className="rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] p-6 text-center text-sm text-[var(--nx-text-muted)]">
              لا توجد قوات مسجلة في القرية.
            </div>
          ) : (
            <>
              {/* Mobile Army Cards */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:hidden">
                {live.armyMatrix
                  .filter((u) => u.total > 0)
                  .map((unit) => {
                    return (
                      <div
                        key={unit.key}
                        className="rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] p-2.5 text-center"
                      >
                        <div className="text-xs font-semibold text-[var(--nx-text-primary)]">{unit.ar}</div>
                        <div className="mt-1 font-mono text-base font-bold text-[var(--nx-text-primary)]">
                          {unit.total.toLocaleString('en-US')}
                        </div>
                        <div className="mt-1 flex items-center justify-around text-[10px] font-mono">
                          <span className="text-[var(--nx-emerald)]">مقر: {unit.home}</span>
                          <span className="text-[var(--nx-amber)]">خارج: {unit.away}</span>
                        </div>
                        <div className="mt-1 text-[10px] text-[var(--nx-text-muted)] font-mono">
                          حمولة: {unit.haul.toLocaleString('en-US')}
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Desktop Full Army Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full border-collapse text-start">
                  <thead>
                    <tr>
                      <th className="border-b border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] px-3 py-2 text-start text-xs font-semibold text-[var(--nx-text-muted)]">الوحدة</th>
                      <th className="border-b border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] px-3 py-2 text-start text-xs font-semibold text-[var(--nx-text-muted)]">الإجمالي</th>
                      <th className="border-b border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] px-3 py-2 text-start text-xs font-semibold text-[var(--nx-text-muted)]">داخل القرية</th>
                      <th className="border-b border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] px-3 py-2 text-start text-xs font-semibold text-[var(--nx-text-muted)]">بالخارج</th>
                      <th className="border-b border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] px-3 py-2 text-start text-xs font-semibold text-[var(--nx-text-muted)]">التوزيع</th>
                      <th className="border-b border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] px-3 py-2 text-start text-xs font-semibold text-[var(--nx-text-muted)]">سعة الحمولة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--nx-border)] text-sm">
                    {live.armyMatrix.map((unit) => {
                      const homePct = unit.total > 0 ? Math.round((unit.home / unit.total) * 100) : 0;
                      return (
                        <tr key={unit.key} className="hover:bg-[var(--nx-bg-hover)]">
                          <td className="px-3 py-2 font-semibold text-[var(--nx-text-primary)]">{unit.ar}</td>
                          <td className="px-3 py-2 font-mono font-bold tabular-nums text-[var(--nx-text-primary)]">
                            {unit.total.toLocaleString('en-US')}
                          </td>
                          <td className="px-3 py-2 font-mono tabular-nums text-[var(--nx-emerald)]">
                            {unit.home.toLocaleString('en-US')}
                          </td>
                          <td className="px-3 py-2 font-mono tabular-nums text-[var(--nx-amber)]">
                            {unit.away.toLocaleString('en-US')}
                          </td>
                          <td className="px-3 py-2 min-w-24">
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--nx-bg-muted)]">
                              <div className="h-full bg-[var(--nx-emerald)]" style={{ width: `${homePct}%` }} />
                            </div>
                          </td>
                          <td className="px-3 py-2 font-mono tabular-nums text-[var(--nx-text-muted)]">
                            {unit.haul.toLocaleString('en-US')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        {/* Visual Skyline Grid for Buildings */}
        <section aria-labelledby="vil-bldgs-heading" className="nx-card p-5 lg:col-span-5">
          <SectionHeader
            headingId="vil-bldgs-heading"
            title="مستويات المباني الحالية"
            subtitle={`${buildingsEntries.length} مبنى مسجل`}
            action={<Building2 className="h-5 w-5 text-[var(--nx-text-muted)]" aria-hidden="true" />}
          />
          <div className="grid grid-cols-2 gap-2.5">
            {buildingsEntries.map(([bName, lvl]) => {
              const pct = Math.min(100, Math.round((Number(lvl) / 30) * 100));
              return (
                <div
                  key={bName}
                  className="rounded-[var(--nx-radius-sm)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] p-2.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate font-semibold text-[var(--nx-text-primary)]">
                      {bName}
                    </span>
                    <span className="font-mono font-bold tabular-nums text-[var(--nx-amber)]">
                      {lvl}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--nx-bg-muted)]">
                    <div
                      className="h-full bg-[var(--nx-amber)]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Assigned Plan Timeline */}
      <section aria-labelledby="vil-plan-heading" className="nx-card space-y-4 p-5">
        <SectionHeader
          headingId="vil-plan-heading"
          title="الخطة المسندة للقرية"
          subtitle={
            vil.assignedPlan
              ? `${vil.assignedPlan.name} · التقدم: ${briefing.completedStepsCount} من ${briefing.totalSteps} خطوة`
              : 'لا توجد خطة تطوير مسندة حالياً'
          }
          action={
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`/planner?villageId=${encodeURIComponent(vil.id)}`}
                onClick={(e) => handleLinkClick(e, `/planner?villageId=${encodeURIComponent(vil.id)}`)}
                className="nx-btn nx-btn-outline nx-btn-compact"
              >
                <Compass className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{vil.assignedPlan ? 'تحديث بالمحاكي الذكي' : 'فتح المحاكي الذكي'}</span>
              </a>
              {vil.assignedPlan ? (
                <button
                  type="button"
                  onClick={() => onAssignPlan(vil.id, null)}
                  className="nx-btn nx-btn-compact border border-[var(--nx-coral-border)] bg-[var(--nx-coral-bg)] text-[var(--nx-coral)] hover:opacity-90"
                >
                  <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>إلغاء إسناد الخطة</span>
                </button>
              ) : null}
            </div>
          }
        />

        {vil.assignedPlan ? (
          <>
            {/* Live Sync Guidance Banner */}
            {(briefing.readyStepsNow.length > 0 || briefing.nextWaitingStep) && (
              <div
                className={`flex flex-wrap items-center justify-between gap-2 rounded-[var(--nx-radius-md)] border px-3.5 py-2.5 text-xs ${
                  briefing.readyStepsNow.length > 0
                    ? 'border-[var(--nx-indigo)]/35 bg-[var(--nx-indigo-soft)] text-[var(--nx-indigo)]'
                    : 'border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] text-[var(--nx-text-secondary)]'
                }`}
              >
                <div className="flex items-center gap-2 font-bold">
                  {briefing.readyStepsNow.length > 0 ? (
                    <>
                      <Zap className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>
                        الخطوة المطلوب تنفيذها الآن:{' '}
                        {briefing.readyStepsNow
                          .map((s) => `${s.bName}${s.targetLvl ? ` (مستوى ${s.targetLvl})` : ''}`)
                          .join(' + ')}
                      </span>
                    </>
                  ) : (
                    <>
                      <Clock className="h-4 w-4 shrink-0 text-[var(--nx-amber)]" aria-hidden="true" />
                      <span>
                        الخطوة القادمة: {briefing.nextWaitingStep?.bName}
                        {briefing.nextWaitingStep?.targetLvl ? ` (مستوى ${briefing.nextWaitingStep.targetLvl})` : ''}{' '}
                        — جاهزة خلال {briefing.nextStepReadyText}
                      </span>
                    </>
                  )}
                </div>
                <span className="font-mono-num text-[11px] font-semibold">
                  مكتمل {briefing.completedStepsCount} / {briefing.totalSteps}
                </span>
              </div>
            )}

            {/* Mobile Plan Steps List */}
            <div className="grid grid-cols-1 gap-2 md:hidden">
              {planSteps.map((step, idx) => {
                const isRemaining = briefing.remainingSteps.includes(step);
                const isReadyNow = isRemaining && briefing.readyStepsNow.includes(step);
                return (
                  <div
                    key={`${step.bName}_${idx}`}
                    className={`rounded-[var(--nx-radius-md)] border p-3 ${
                      isReadyNow
                        ? 'border-[var(--nx-indigo)] bg-[var(--nx-indigo-soft)]/50'
                        : isRemaining
                          ? 'border-[var(--nx-border)] bg-[var(--nx-bg-subtle)]'
                          : 'border-[var(--nx-emerald-border)] bg-[var(--nx-emerald-bg)]/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-[var(--nx-text-primary)]">
                        #{step.stepNum ?? idx + 1} {step.bName} (مستوى {step.targetLvl})
                      </span>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1 font-semibold ${
                          isReadyNow
                            ? 'text-[var(--nx-indigo)]'
                            : isRemaining
                              ? 'text-[var(--nx-amber)]'
                              : 'text-[var(--nx-emerald)]'
                        }`}
                      >
                        {isReadyNow ? (
                          <Zap className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        ) : isRemaining ? (
                          <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        )}
                        <span>
                          {isReadyNow ? 'جاهزة الآن' : isRemaining ? 'بانتظار الموارد' : 'مكتملة'}
                        </span>
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-[var(--nx-border)] pt-1.5 text-[11px] font-mono text-[var(--nx-text-muted)]">
                      <span>تكلفة: {step.cost ? `${step.cost.w}/${step.cost.c}/${step.cost.i}` : '—'}</span>
                      <span>{step.tStart !== undefined ? formatSecondsArabic(step.tStart) : '—'}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Plan Steps Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse text-start">
                <thead>
                  <tr>
                    <th className="border-b border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] px-3 py-2 text-start text-xs font-semibold text-[var(--nx-text-muted)]">#</th>
                    <th className="border-b border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] px-3 py-2 text-start text-xs font-semibold text-[var(--nx-text-muted)]">الخطوة</th>
                    <th className="border-b border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] px-3 py-2 text-start text-xs font-semibold text-[var(--nx-text-muted)]">المستوى الهدف</th>
                    <th className="border-b border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] px-3 py-2 text-start text-xs font-semibold text-[var(--nx-text-muted)]">التكلفة (خ/ط/ح)</th>
                    <th className="border-b border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] px-3 py-2 text-start text-xs font-semibold text-[var(--nx-text-muted)]">الوقت</th>
                    <th className="border-b border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] px-3 py-2 text-start text-xs font-semibold text-[var(--nx-text-muted)]">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--nx-border)] text-sm">
                  {planSteps.map((step, idx) => {
                    const isRemaining = briefing.remainingSteps.includes(step);
                    const isReadyNow = isRemaining && briefing.readyStepsNow.includes(step);
                    return (
                      <tr
                        key={`${step.bName}_${idx}`}
                        className={
                          isReadyNow
                            ? 'bg-[var(--nx-indigo-soft)]/50 hover:bg-[var(--nx-indigo-soft)]/70'
                            : 'hover:bg-[var(--nx-bg-hover)]'
                        }
                      >
                        <td className="px-3 py-2 font-mono tabular-nums text-[var(--nx-text-muted)]">
                          {step.stepNum ?? idx + 1}
                        </td>
                        <td className="px-3 py-2 font-medium text-[var(--nx-text-primary)]">{step.bName}</td>
                        <td className="px-3 py-2 font-mono tabular-nums text-[var(--nx-text-primary)]">{step.targetLvl}</td>
                        <td className="px-3 py-2 font-mono text-xs tabular-nums text-[var(--nx-text-secondary)]">
                          {step.cost ? `${step.cost.w} / ${step.cost.c} / ${step.cost.i}` : '—'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap font-mono text-xs tabular-nums text-[var(--nx-text-muted)]">
                          {step.tStart !== undefined ? formatSecondsArabic(step.tStart) : '—'}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-[var(--nx-radius-xs)] px-2 py-0.5 text-xs font-semibold ${
                              isReadyNow
                                ? 'bg-[var(--nx-indigo-soft)] text-[var(--nx-indigo)]'
                                : isRemaining
                                  ? 'bg-[var(--nx-amber-bg)] text-[var(--nx-amber)]'
                                  : 'bg-[var(--nx-emerald-bg)] text-[var(--nx-emerald)]'
                            }`}
                          >
                            {isReadyNow ? (
                              <Zap className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            ) : isRemaining ? (
                              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            )}
                            <span>
                              {isReadyNow ? 'جاهزة للتنفيذ الآن' : isRemaining ? 'بانتظار الموارد' : 'مكتملة'}
                            </span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-between gap-3 rounded-[var(--nx-radius-md)] border border-dashed border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] p-5 text-center sm:flex-row sm:text-start">
            <div className="text-xs text-[var(--nx-text-secondary)]">
              لم يتم إسناد خطة تطوير لهذه القرية بعد. يمكنك توليد خطة مثالية مبنية على مستويات مبانيها وجيشها الحاليين وإسنادها مباشرة من المحاكي الذكي.
            </div>
            <a
              href={`/planner?villageId=${encodeURIComponent(vil.id)}`}
              onClick={(e) => handleLinkClick(e, `/planner?villageId=${encodeURIComponent(vil.id)}`)}
              className="nx-btn nx-btn-primary nx-btn-compact shrink-0"
            >
              <Compass className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>توليد وإسناد خطة الآن</span>
            </a>
          </div>
        )}
      </section>
    </main>
  );
}
