import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Calendar, Coins, Edit3, ExternalLink, Save, TrendingUp } from 'lucide-react';
import {
  buildAccountPPFlow,
  computeVillageLiveStatus,
  formatPPAndCurrency,
  formatTimeAgo,
  getAccountTargetDailyPP,
  type ErpAppState
} from '../../../core';
import type { MutationResult } from '../../../data';
import { DeltaBadge } from '../StateViews';
import { BaseModal } from './BaseModal';

interface AccountPPFlowModalProps {
  accountId: string | null;
  state: ErpAppState;
  onClose: () => void;
  onOpenAccountModal: (accountId: string) => void;
  onOpenVillageModal: (villageId: string) => void;
  onOpenAccountFlowPage: (accountId: string) => void;
  onOverrideDailySession: (
    accountId: string,
    dateKey: string,
    startPP: number,
    endPP: number,
    targetPP?: number
  ) => MutationResult;
  onPushToast: (msg: string, tone?: 'info' | 'success' | 'warn' | 'danger') => void;
}

export function AccountPPFlowModal({
  accountId,
  state,
  onClose,
  onOpenAccountModal,
  onOpenVillageModal,
  onOpenAccountFlowPage,
  onOverrideDailySession,
  onPushToast
}: AccountPPFlowModalProps) {
  const [daysCount, setDaysCount] = useState<7 | 14 | 30>(14);
  const [editingBaseline, setEditingBaseline] = useState(false);
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');

  const account = useMemo(
    () => state.userAccounts.find((a) => a.id === accountId) || null,
    [state.userAccounts, accountId]
  );

  const flow = useMemo(() => {
    if (!account) return null;
    const nowMs = Date.now();
    const vils = state.villages.filter((v) => v.accountId === account.id);
    const liveStatuses = vils.map((v) => computeVillageLiveStatus(v, state, nowMs));
    const targetDailyPP = getAccountTargetDailyPP(account.id, state);
    const unsoldPP = liveStatuses.reduce((s, l) => s + l.unsoldPP, 0);
    const scavLootPP = liveStatuses.reduce((s, l) => s + l.scavLootPP, 0);
    const report = buildAccountPPFlow({
      account,
      villagesCount: vils.length,
      dailySessions: state.dailySessions,
      ppLog: state.ppLog,
      targetDailyPP,
      unsoldPP,
      scavLootPP,
      finance: state.finance,
      daysCount,
      nowMs
    });
    return { vils, report };
  }, [account, state, daysCount]);

  useEffect(() => {
    if (flow?.report) {
      setStartInput(String(flow.report.today?.startPP ?? account?.pp ?? 0));
      setEndInput(String(account?.pp ?? 0));
      setEditingBaseline(false);
    }
  }, [accountId, flow?.report?.today?.startPP, account?.pp]);

  if (!accountId || !account || !flow) return null;

  const { report, vils } = flow;

  function handleSaveBaseline(e: FormEvent) {
    e.preventDefault();
    if (!account) return;
    const s = Math.max(0, Math.round(Number(startInput) || 0));
    const end =
      endInput.trim() !== '' ? Math.max(0, Math.round(Number(endInput) || 0)) : account.pp;
    const dateKey = report.today?.dateKey || new Date().toISOString().slice(0, 10);
    const res = onOverrideDailySession(account.id, dateKey, s, end, report.targetDailyPP);
    if (!res.ok) {
      onPushToast('تعذر حفظ تعديل رصيد بداية اليوم', 'danger');
      return;
    }
    onPushToast('تم تحديث رصيد بداية اليوم بنجاح', 'success');
    setEditingBaseline(false);
  }

  const todayNet = report.today?.netPP ?? 0;
  const yestNet = report.yesterday?.netPP;
  const dayBeforeNet = report.dayBefore?.netPP;
  const yestDelta = report.today?.deltaVsPrevDay ?? null;

  return (
    <BaseModal
      open={Boolean(accountId)}
      onClose={onClose}
      ariaLabel={`تدفق نقاط ${account.name}`}
      maxWidthClass="max-w-3xl"
      bodyClassName="flex-1 space-y-4 overflow-y-auto p-5"
      headerContent={
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--nx-radius-md)] bg-[var(--nx-indigo)] font-bold text-white">
            <Coins className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-[var(--nx-text-primary)]">
              تدفق النقاط · {account.name}
            </h2>
            <div className="text-xs text-[var(--nx-text-muted)]">
              الرصيد:{' '}
              <strong className="font-mono-num text-[var(--nx-indigo)]">
                {formatPPAndCurrency(account.pp, state, { decimals: 0, unit: 'نقطة' }).combinedText}
              </strong>{' '}
              · {formatTimeAgo(account.lastSyncTime)}
            </div>
          </div>
        </div>
      }
      headerActions={
        <>
          {([7, 14, 30] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDaysCount(d)}
              className={`min-h-[34px] cursor-pointer rounded-[var(--nx-radius-sm)] px-2.5 text-xs font-semibold ${
                daysCount === d
                  ? 'bg-[var(--nx-indigo)] text-white'
                  : 'border border-[var(--nx-border)] text-[var(--nx-text-secondary)] hover:bg-[var(--nx-bg-hover)]'
              }`}
            >
              {d}ي
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenAccountFlowPage(account.id);
            }}
            title="فتح الصفحة الكاملة"
            className="nx-btn nx-btn-outline nx-btn-compact !px-2.5"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            <span>تفاصيل</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenAccountModal(account.id)}
            title="تعديل الحساب"
            aria-label="تعديل الحساب"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[var(--nx-radius-sm)] border border-[var(--nx-border)] hover:bg-[var(--nx-bg-hover)]"
          >
            <Edit3 className="h-4 w-4" aria-hidden="true" />
          </button>
        </>
      }
      footer={
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="nx-btn nx-btn-outline nx-btn-compact px-5">
            إغلاق
          </button>
        </div>
      }
    >
      {(() => {
            const todayFmt = formatPPAndCurrency(todayNet, state, {
              decimals: 1,
              unit: 'نقطة',
              showSign: true
            });
            const yestFmt =
              yestNet !== null && yestNet !== undefined
                ? formatPPAndCurrency(yestNet, state, { decimals: 1, unit: 'نقطة', showSign: true })
                : null;
            const dayBeforeFmt =
              dayBeforeNet !== null && dayBeforeNet !== undefined
                ? formatPPAndCurrency(dayBeforeNet, state, { decimals: 1, unit: 'نقطة', showSign: true })
                : null;
            const periodFmt = formatPPAndCurrency(report.periodNetPP, state, {
              decimals: 1,
              unit: 'نقطة',
              showSign: true
            });
            const avgFmt = formatPPAndCurrency(report.avgDailyPP, state, {
              decimals: 0,
              unit: 'نقطة',
              perDay: true
            });
            const baselineFmt = formatPPAndCurrency(report.today?.startPP ?? account.pp, state, {
              decimals: 0,
              unit: 'نقطة'
            });

            return (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="space-y-1 rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] p-3">
                    <div className="text-[11px] font-medium text-[var(--nx-text-muted)]">اليوم</div>
                    <div className="font-mono-num text-base font-bold text-[var(--nx-text-primary)]">
                      {todayFmt.ppText}
                    </div>
                    <div className="font-mono-num text-[11px] font-semibold text-[var(--nx-indigo)]">
                      {todayFmt.moneyText}
                    </div>
                    {yestDelta !== null && (
                      <DeltaBadge
                        label={`${yestDelta >= 0 ? '+' : ''}${yestDelta} عن أمس`}
                        direction={yestDelta >= 0 ? 'up' : 'down'}
                      />
                    )}
                  </div>

                  <div className="space-y-1 rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] p-3">
                    <div className="text-[11px] font-medium text-[var(--nx-text-muted)]">أمس</div>
                    <div className="font-mono-num text-base font-bold text-[var(--nx-text-primary)]">
                      {yestFmt ? yestFmt.ppText : '—'}
                    </div>
                    <div className="font-mono-num text-[11px] text-[var(--nx-text-muted)]">
                      {yestFmt ? yestFmt.moneyText : 'غير مسجل'}
                    </div>
                  </div>

                  <div className="space-y-1 rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] p-3">
                    <div className="text-[11px] font-medium text-[var(--nx-text-muted)]">أول أمس</div>
                    <div className="font-mono-num text-base font-bold text-[var(--nx-text-primary)]">
                      {dayBeforeFmt ? dayBeforeFmt.ppText : '—'}
                    </div>
                    <div className="font-mono-num text-[11px] text-[var(--nx-text-muted)]">
                      {dayBeforeFmt ? dayBeforeFmt.moneyText : 'غير مسجل'}
                    </div>
                  </div>

                  <div className="space-y-1 rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] p-3">
                    <div className="text-[11px] font-medium text-[var(--nx-text-muted)]">صافي {daysCount} يوم</div>
                    <div className="font-mono-num text-base font-bold text-[var(--nx-indigo)]">
                      {periodFmt.ppText}
                    </div>
                    <div className="font-mono-num text-[11px] font-semibold text-[var(--nx-text-secondary)]">
                      {periodFmt.moneyText} · متوسط {avgFmt.combinedText}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] p-3.5">
                  <div className="text-xs">
                    <span className="font-semibold text-[var(--nx-text-primary)]">رصيد بداية اليوم (00:00): </span>
                    <span className="font-mono-num font-bold text-[var(--nx-indigo)]">
                      {baselineFmt.combinedText}
                    </span>
                  </div>
            {!editingBaseline ? (
              <button
                type="button"
                onClick={() => setEditingBaseline(true)}
                className="nx-btn nx-btn-outline nx-btn-compact"
              >
                تعديل رصيد 00:00 يدوياً
              </button>
            ) : (
              <form onSubmit={handleSaveBaseline} className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  value={startInput}
                  onChange={(e) => setStartInput(e.target.value)}
                  placeholder="رصيد 00:00"
                  className="nx-input nx-input-compact font-mono-num w-28"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  value={endInput}
                  onChange={(e) => setEndInput(e.target.value)}
                  placeholder="الرصيد الحالي"
                  className="nx-input nx-input-compact font-mono-num w-28"
                />
                <button type="submit" className="nx-btn nx-btn-primary nx-btn-compact">
                  <Save className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>حفظ</span>
                </button>
              </form>
            )}
          </div>
              </>
            );
          })()}

          <div className="space-y-3 rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] p-4">
            <div className="flex items-center justify-between text-xs font-semibold text-[var(--nx-text-secondary)]">
              <span className="inline-flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-[var(--nx-indigo)]" aria-hidden="true" />
                <span>منحنى التدفق اليومي</span>
              </span>
              <span className="text-[var(--nx-text-muted)]">
                الهدف اليومي:{' '}
                {
                  formatPPAndCurrency(Math.round(report.targetDailyPP), state, {
                    decimals: 0,
                    unit: 'نقطة'
                  }).combinedText
                }
              </span>
            </div>

            <div className="flex h-36 items-end gap-1.5 pt-4" dir="ltr">
              {report.daysAsc.map((d) => {
                const maxVal = Math.max(10, report.maxChartVal);
                const val = d.hasData && d.netPP !== null ? Math.max(0, d.netPP) : 0;
                const hPct = d.hasData ? Math.max(10, Math.round((val / maxVal) * 100)) : 6;
                const tipFmt = formatPPAndCurrency(d.netPP ?? 0, state, {
                  decimals: 1,
                  unit: 'نقطة'
                });
                return (
                  <div
                    key={d.dateKey}
                    className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                    title={`${d.relativeLabel} (${d.dateKey}): ${tipFmt.combinedText}`}
                  >
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="nx-transition w-full rounded-t-[6px]"
                        style={{
                          height: `${hPct}%`,
                          background: d.isToday
                            ? 'linear-gradient(180deg, var(--nx-indigo), var(--nx-periwinkle))'
                            : d.hasData && val > 0
                              ? 'var(--nx-indigo-soft)'
                              : 'var(--nx-bg-muted)',
                          border: d.isToday ? 'none' : d.hasData ? '1px solid var(--nx-indigo)' : 'none'
                        }}
                      />
                    </div>
                    <span className="font-mono-num max-w-full truncate text-[10px] text-[var(--nx-text-muted)]">
                      {d.dateKey.slice(8)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="overflow-hidden rounded-[var(--nx-radius-md)] border border-[var(--nx-border)]">
            <div className="flex items-center gap-1.5 border-b border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] px-4 py-2.5 text-xs font-bold">
              <Calendar className="h-3.5 w-3.5 text-[var(--nx-indigo)]" aria-hidden="true" />
              <span>السجل اليومي التفصيلي</span>
            </div>
            <div className="max-h-64 divide-y divide-[var(--nx-border)] overflow-y-auto text-xs">
              {report.daysDesc.map((d) => {
                const startFmt =
                  d.startPP !== null
                    ? formatPPAndCurrency(d.startPP, state, { decimals: 0, unit: 'نقطة' })
                    : null;
                const endFmt =
                  d.endPP !== null
                    ? formatPPAndCurrency(d.endPP, state, { decimals: 0, unit: 'نقطة' })
                    : null;
                const rowNetFmt =
                  d.netPP !== null
                    ? formatPPAndCurrency(d.netPP, state, { decimals: 1, unit: 'نقطة', showSign: true })
                    : null;
                return (
                  <div key={d.dateKey} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="font-bold text-[var(--nx-text-primary)]">{d.relativeLabel}</span>
                      <span className="font-mono-num text-[var(--nx-text-muted)]">{d.dateKey}</span>
                      {d.manualAdjusted && (
                        <span className="rounded bg-[var(--nx-indigo-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--nx-indigo)]">
                          معدّل يدوياً
                        </span>
                      )}
                    </div>
                    <div className="font-mono-num flex flex-wrap items-center gap-3">
                      <span className="text-[var(--nx-text-muted)]">
                        {startFmt ? startFmt.combinedText : '—'} ← {endFmt ? endFmt.combinedText : '—'}
                      </span>
                      <span
                        className={`font-bold ${
                          d.netPP !== null && d.netPP > 0
                            ? 'text-[var(--nx-emerald)]'
                            : d.netPP !== null && d.netPP < 0
                              ? 'text-[var(--nx-coral)]'
                              : 'text-[var(--nx-text-muted)]'
                        }`}
                      >
                        {rowNetFmt ? rowNetFmt.combinedText : 'لا يوجد تسجيل'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {vils.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-[var(--nx-text-muted)]">
                القرى المرتبطة بالحساب ({vils.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {vils.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenVillageModal(v.id);
                    }}
                    className="nx-btn nx-btn-outline nx-btn-compact text-xs"
                  >
                    <span>{v.name}</span>
                    <span className="font-mono-num text-[var(--nx-text-muted)]">K{v.continent}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
    </BaseModal>
  );
}
