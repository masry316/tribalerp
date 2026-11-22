import {
  CheckCircle2,
  Clock,
  Edit3,
  ExternalLink,
  Hammer,
  Shield,
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
  type VillageLiveStatus,
  type VillageRole
} from '../../../core';
import { buildVillageArmyBreakdown, normalizeVillageRole } from '../../viewModels';
import { BaseModal } from './BaseModal';

interface VillageRadarModalProps {
  village: ErpVillage | null;
  account: ErpUserAccount | null;
  live: VillageLiveStatus | null;
  state: ErpAppState;
  isActive: boolean;
  onClose: () => void;
  onSelectActive: (villageId: string) => void;
  onSetVillageRole?: (villageId: string, role: VillageRole) => void;
  onOpenMissionModal: (villageId: string) => void;
  onOpenVillageModal: (villageId: string) => void;
  onOpenAccountFlow: (accountId: string) => void;
  onOpenVillageDetail: (villageId: string) => void;
}

const ROLE_OPTIONS: ReadonlyArray<{
  role: VillageRole;
  label: string;
  dotClass: string;
  activeClass: string;
}> = [
  {
    role: 'offense',
    label: 'هجوم',
    dotClass: 'bg-red-500',
    activeClass: 'border-red-500/70 bg-red-500/12 text-red-600 dark:text-red-400'
  },
  {
    role: 'defense',
    label: 'دفاع',
    dotClass: 'bg-blue-500',
    activeClass: 'border-blue-500/70 bg-blue-500/12 text-blue-600 dark:text-blue-400'
  },
  {
    role: 'unset',
    label: 'غير محددة',
    dotClass: 'bg-yellow-400',
    activeClass: 'border-yellow-500/70 bg-yellow-400/15 text-amber-700 dark:text-yellow-300'
  }
];

export function VillageRadarModal({
  village,
  account,
  live,
  state,
  isActive,
  onClose,
  onSelectActive,
  onSetVillageRole,
  onOpenMissionModal,
  onOpenVillageModal,
  onOpenAccountFlow,
  onOpenVillageDetail
}: VillageRadarModalProps) {
  if (!village || !live) return null;

  const briefing = computeMissionBriefingForVillage(village, state, live);
  const army = buildVillageArmyBreakdown(village, live);
  const currentRole = normalizeVillageRole(village.villageRole);

  const points = village.buildings
    ? calcVillagePointsFromBuildings(village.buildings)
    : Number(village.villagePoints || 26);

  const dailyPPFormatted = formatPPAndCurrency(live.dailyPP, state, {
    decimals: 1,
    unit: 'نقطة',
    perDay: true
  });

  const isScavReady = live.scavState === 'idle_troops' || live.scavState === 'returned';
  const hasReadyStep = briefing.readyStepsNow.length > 0;
  const isCriticalWh = live.status === 'critical' && live.maxWhPct >= 85;
  const isWarningWh = live.status === 'warning';

  let actionHeadline = 'القرية مستقرة';
  let actionToneClass = 'bg-[var(--nx-bg-subtle)] text-[var(--nx-text-secondary)]';
  if (isCriticalWh) {
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
  }

  const planPct =
    briefing.totalSteps > 0
      ? Math.round((briefing.completedStepsCount / briefing.totalSteps) * 100)
      : 0;

  const whColor = (pct: number) =>
    pct >= 90 ? 'var(--nx-coral)' : pct >= 75 ? 'var(--nx-amber)' : 'var(--nx-emerald)';

  return (
    <BaseModal
      open={Boolean(village)}
      onClose={onClose}
      ariaLabel={`تفاصيل قرية ${village.name}`}
      closeButtonLabel="إغلاق نافذة القرية"
      bodyClassName="flex-1 space-y-3.5 overflow-y-auto p-4 sm:p-5"
      headerContent={
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-bold text-[var(--nx-text-primary)]">
              {village.name}
            </h2>
            <span dir="ltr" className="font-mono-num text-xs text-[var(--nx-text-muted)]">
              {village.coord || '—'}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-[var(--nx-text-muted)]">
            {account ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAccountFlow(account.id);
                }}
                className="cursor-pointer font-semibold text-[var(--nx-indigo)] hover:underline"
              >
                {account.name}
              </button>
            ) : (
              <span>بدون حساب</span>
            )}
            <span>·</span>
            <span>
              {live.worldName} (K{village.continent})
            </span>
            <span>·</span>
            <span className="font-mono-num">{points.toLocaleString('en-US')} ن.ق</span>
            <span>·</span>
            <span className={live.isStaleSync ? 'font-semibold text-[var(--nx-amber)]' : ''}>
              {formatTimeAgo(village.lastSyncTime || live.syncRefTs)}
            </span>
          </div>
        </div>
      }
      footer={
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="nx-btn nx-btn-outline nx-btn-compact px-5">
            إغلاق
          </button>
        </div>
      }
    >
      {/* Village Tactical Role Selector (Map Color: Red = Offense, Blue = Defense, Yellow = Unset) */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--nx-text-secondary)]">
          <Shield className="h-3.5 w-3.5 text-[var(--nx-text-muted)]" aria-hidden="true" />
          <span>نوع القرية (على الخريطة)</span>
        </div>
        <div className="flex items-center gap-1.5" role="group" aria-label="تحديد نوع القرية">
          {ROLE_OPTIONS.map((opt) => {
            const active = currentRole === opt.role;
            return (
              <button
                key={opt.role}
                type="button"
                data-testid={`village-role-btn-${opt.role}`}
                aria-pressed={active}
                onClick={() => onSetVillageRole?.(village.id, opt.role)}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-[var(--nx-radius-sm)] border px-2.5 py-1 text-xs font-bold transition-colors ${
                  active
                    ? opt.activeClass
                    : 'border-[var(--nx-border)] bg-[var(--nx-bg-surface)] text-[var(--nx-text-muted)] hover:border-[var(--nx-border-strong)] hover:text-[var(--nx-text-primary)]'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${opt.dotClass}`} aria-hidden="true" />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Status Banner */}
      <div className={`flex items-center gap-2 rounded-[var(--nx-radius-md)] px-3.5 py-2.5 text-xs font-semibold ${actionToneClass}`}>
        {isCriticalWh || isWarningWh ? (
          <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
        ) : isScavReady ? (
          <Swords className="h-4 w-4 shrink-0" aria-hidden="true" />
        ) : hasReadyStep ? (
          <Hammer className="h-4 w-4 shrink-0" aria-hidden="true" />
        ) : (
          <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
        )}
        <span>{actionHeadline}</span>
      </div>

      {/* Warehouse Progress */}
      <div className="space-y-2.5 rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] p-3.5">
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

        <div className="grid grid-cols-3 gap-3">
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
              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--nx-bg-muted)]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${res.pct}%`, backgroundColor: whColor(res.pct) }}
                />
              </div>
              <div className="font-mono-num text-xs text-[var(--nx-text-muted)]">
                {res.stock.toLocaleString('en-US')}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Economy KPIs */}
      <div className="grid grid-cols-2 gap-2.5 text-xs">
        <div className="rounded-[var(--nx-radius-sm)] border border-[var(--nx-border)] p-3">
          <div className="text-[11px] text-[var(--nx-text-muted)]">العائد اليومي</div>
          <div className="font-mono-num mt-0.5 text-sm font-bold text-[var(--nx-indigo)]">
            {dailyPPFormatted.ppText}
          </div>
          <div className="font-mono-num text-[11px] text-[var(--nx-text-muted)]">
            {dailyPPFormatted.moneyText}
          </div>
        </div>

        <div className="rounded-[var(--nx-radius-sm)] border border-[var(--nx-border)] p-3">
          <div className="text-[11px] text-[var(--nx-text-muted)]">الإنتاج بالساعة</div>
          <div className="font-mono-num mt-0.5 text-sm font-bold text-[var(--nx-text-primary)]">
            +{Math.round(live.totalHourly).toLocaleString('en-US')}/س
          </div>
          <div className="font-mono-num text-[11px] text-[var(--nx-text-muted)]">
            تجار: {briefing.freeMerchants} · {live.sellableNowPP.toFixed(1)} PP
          </div>
        </div>
      </div>

      {/* Detailed Army Breakdown & Development Plan */}
      <div
        data-testid="village-army-details"
        className="space-y-2.5 rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] p-3.5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--nx-text-secondary)]">
            <Swords className="h-3.5 w-3.5 text-[var(--nx-text-muted)]" aria-hidden="true" />
            <span>الجيش والخطة</span>
          </span>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="font-mono-num font-bold text-[var(--nx-text-primary)]">
              {army.totalHome.toLocaleString('en-US')}/{army.totalAll.toLocaleString('en-US')} بالقرية
            </span>
            <span className="text-[var(--nx-text-muted)]">·</span>
            <span className="font-mono-num text-[var(--nx-text-muted)]">
              حمولة {army.totalHaulCap.toLocaleString('en-US')}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
          {army.units.map((u) => {
            const hasUnits = u.total > 0;
            const hasAway = u.away > 0;
            return (
              <div
                key={u.key}
                data-testid={`army-unit-${u.key}`}
                className={`rounded-[var(--nx-radius-sm)] border px-2.5 py-1.5 ${
                  hasUnits
                    ? 'border-[var(--nx-border-strong)] bg-[var(--nx-bg-surface)]'
                    : 'border-[var(--nx-border)]/70 bg-[var(--nx-bg-canvas)]/45 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate text-[11px] font-medium text-[var(--nx-text-muted)]">
                    {u.label}
                  </span>
                  {hasAway && (
                    <span className="font-mono-num text-[10px] font-semibold text-[var(--nx-amber)]">
                      -{u.away.toLocaleString('en-US')}
                    </span>
                  )}
                </div>
                <div className="font-mono-num mt-0.5 text-xs font-bold text-[var(--nx-text-primary)]">
                  {hasAway ? (
                    <>
                      <span>{u.home.toLocaleString('en-US')}</span>
                      <span className="text-[10px] font-normal text-[var(--nx-text-muted)]">
                        /{u.total.toLocaleString('en-US')}
                      </span>
                    </>
                  ) : (
                    u.total.toLocaleString('en-US')
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--nx-border)] pt-2 text-[11px]">
          <span className="text-[var(--nx-text-muted)]">
            سكان الجيش: <strong className="font-mono-num text-[var(--nx-text-secondary)]">{army.totalPop.toLocaleString('en-US')}</strong>
          </span>
          <span className="truncate font-semibold text-[var(--nx-text-secondary)]">
            {briefing.hasPlan ? `الخطة: ${briefing.planName} (${planPct}%)` : 'بدون خطة مسندة'}
          </span>
        </div>
      </div>

      {/* Action Shortcuts */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button
          type="button"
          onClick={() => onSelectActive(village.id)}
          aria-pressed={isActive}
          className={`nx-btn nx-btn-compact w-full ${
            isActive
              ? 'border-[var(--nx-indigo)] bg-[var(--nx-indigo-soft)] text-[var(--nx-indigo)]'
              : 'nx-btn-outline'
          }`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{isActive ? 'قرية نشطة' : 'تحديد كنشطة'}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            const id = village.id;
            onClose();
            onOpenMissionModal(id);
          }}
          className="nx-btn nx-btn-outline nx-btn-compact w-full text-[var(--nx-indigo)]"
        >
          <Target className="h-3.5 w-3.5" aria-hidden="true" />
          <span>توجيه المهمة</span>
        </button>

        <button
          type="button"
          onClick={() => {
            const id = village.id;
            onClose();
            onOpenVillageModal(id);
          }}
          className="nx-btn nx-btn-outline nx-btn-compact w-full"
        >
          <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
          <span>تعديل البيانات</span>
        </button>

        <button
          type="button"
          onClick={() => {
            const id = village.id;
            onClose();
            onOpenVillageDetail(id);
          }}
          className="nx-btn nx-btn-primary nx-btn-compact w-full"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          <span>غرفة القرية</span>
        </button>
      </div>
    </BaseModal>
  );
}
