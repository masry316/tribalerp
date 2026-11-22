import { useEffect, useState, type FormEvent, type MouseEvent } from 'react';
import { ArrowRight, CalendarClock, Edit3, Network, TrendingUp } from 'lucide-react';
import {
  buildAccountPPFlow,
  computeVillageLiveStatus,
  formatPPAndCurrency,
  formatTimeAgo,
  getAccountTargetDailyPP,
  type ErpAppState
} from '../../core';
import type { MutationResult } from '../../data';
import { FieldError, FormErrorsBanner } from '../components/FieldError';
import { DailyFlowTrajectorySvg } from '../components/TacticalWidgets';
import { SectionHeader, StatusNotice } from '../components/UiPrimitives';

interface AccountFlowPageProps {
  accountId: string;
  state: ErpAppState;
  navigate: (path: string) => void;
  onOverrideDailySession: (
    accountId: string,
    dateKey: string,
    startPP: number,
    endPP: number,
    targetPP?: number
  ) => MutationResult;
}

export function AccountFlowPage({
  accountId,
  state,
  navigate,
  onOverrideDailySession
}: AccountFlowPageProps) {
  const [daysCount, setDaysCount] = useState(14);
  const acc = state.userAccounts.find((a) => a.id === accountId);
  const vils = state.villages.filter((v) => v.accountId === accountId);
  const liveStatuses = vils.map((v) => computeVillageLiveStatus(v, state));
  const unsoldPP = liveStatuses.reduce((sum, s) => sum + s.unsoldPP, 0);
  const scavLootPP = liveStatuses.reduce((sum, s) => sum + s.scavLootPP, 0);

  const flow = acc
    ? buildAccountPPFlow({
        account: acc,
        villagesCount: vils.length,
        dailySessions: state.dailySessions,
        ppLog: state.ppLog,
        targetDailyPP: getAccountTargetDailyPP(acc.id, state),
        unsoldPP,
        scavLootPP,
        finance: state.finance,
        daysCount
      })
    : null;

  const [editDateKey, setEditDateKey] = useState(
    () => flow?.daysDesc[0]?.dateKey || new Date().toISOString().slice(0, 10)
  );
  const [startPP, setStartPP] = useState(() => String(flow?.daysDesc[0]?.startPP ?? acc?.pp ?? 0));
  const [endPP, setEndPP] = useState(() => String(flow?.daysDesc[0]?.endPP ?? acc?.pp ?? 0));
  const [targetPP, setTargetPP] = useState(() => String(flow?.daysDesc[0]?.targetPP ?? 100));
  const [errors, setErrors] = useState<Record<string, string> | null>(null);
  const [statusMsg, setStatusMsg] = useState('');

  const topRow = flow?.daysDesc[0];
  const syncSignature = `${accountId}|${topRow?.dateKey || ''}|${topRow?.startPP ?? ''}|${topRow?.endPP ?? ''}|${topRow?.targetPP ?? ''}`;
  useEffect(() => {
    if (!topRow) return;
    setEditDateKey(topRow.dateKey);
    setStartPP(String(topRow.startPP ?? acc?.pp ?? 0));
    setEndPP(String(topRow.endPP ?? acc?.pp ?? 0));
    setTargetPP(String(topRow.targetPP ?? 100));
  }, [syncSignature]);

  function handleLinkClick(e: MouseEvent<HTMLAnchorElement>, path: string) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    navigate(path);
  }

  if (!flow) {
    return (
      <main className="nx-card p-10 text-center">
        <h2 className="text-xl font-bold text-[var(--nx-text-primary)]">
          الحساب غير موجود
        </h2>
        <p className="mt-2 text-sm text-[var(--nx-text-secondary)]">
          لم يتم العثور على سجل لهذا الحساب.
        </p>
        <div className="mt-6">
          <a
            href="/accounts"
            onClick={(e) => handleLinkClick(e, '/accounts')}
            className="nx-btn nx-btn-primary"
          >
            العودة إلى قائمة الحسابات
          </a>
        </div>
      </main>
    );
  }

  function handleSelectRowForEdit(dateKey: string) {
    const row = flow?.daysDesc.find((r) => r.dateKey === dateKey);
    if (!row) return;
    setEditDateKey(row.dateKey);
    setStartPP(String(row.startPP ?? acc?.pp ?? 0));
    setEndPP(String(row.endPP ?? acc?.pp ?? 0));
    setTargetPP(String(row.targetPP ?? 100));
    setErrors(null);
    setStatusMsg('');
  }

  function handleOverrideSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors(null);
    setStatusMsg('');

    if (!/^\d{4}-\d{2}-\d{2}$/.test(editDateKey)) {
      setErrors({ dateKey: 'صيغة التاريخ يجب أن تكون YYYY-MM-DD' });
      return;
    }

    const startVal = Number(startPP);
    const endVal = Number(endPP);
    const tgtVal = Number(targetPP);
    if (!Number.isFinite(startVal) || !Number.isFinite(endVal) || startVal < 0 || endVal < 0) {
      setErrors({ pp: 'قيم البداية والنهاية يجب أن تكون أرقاماً صحيحة موجبة.' });
      return;
    }

    const res = onOverrideDailySession(acc!.id, editDateKey, startVal, endVal, tgtVal);
    if (!res.ok) {
      setErrors(res.errors || { form: 'فشل تحديث سجل اليوم.' });
      return;
    }

    setStatusMsg(`تم تحديث سجل نقاط التميز ليوم ${editDateKey} بنجاح.`);
  }

  return (
    <main className="space-y-5">
      <section aria-labelledby="acc-flow-summary" className="nx-card p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--nx-text-muted)]">
              <a
                href="/accounts"
                onClick={(e) => handleLinkClick(e, '/accounts')}
                className="inline-flex items-center gap-1 hover:text-[var(--nx-text-primary)]"
              >
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                <span>الحسابات والقرى</span>
              </a>
              <span aria-hidden="true">/</span>
              <a
                href="/reports"
                onClick={(e) => handleLinkClick(e, '/reports')}
                className="hover:text-[var(--nx-text-primary)]"
              >
                التقارير والأمان
              </a>
            </div>
            <h1 id="acc-flow-summary" className="mt-2 text-2xl font-extrabold text-[var(--nx-text-primary)]">
              تدفق نقاط التميز: {flow.accountName}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--nx-text-muted)]">
              <Network className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span dir="ltr" className="font-mono">
                IP: {flow.ip || 'غير مسجل'}
              </span>
              <span aria-hidden="true">·</span>
              <span>الجهاز: {flow.device || '—'}</span>
              <span aria-hidden="true">·</span>
              <span>القرى: {flow.villagesCount}</span>
              <span aria-hidden="true">·</span>
              <span>آخر مزامنة: {formatTimeAgo(flow.lastSyncTime)}</span>
            </p>
          </div>

          <div className="w-full sm:w-44">
            <label htmlFor="flow-days-select" className="mb-1.5 block text-xs font-semibold text-[var(--nx-text-secondary)]">
              نافذة العرض
            </label>
            <select
              id="flow-days-select"
              className="nx-select"
              value={daysCount}
              onChange={(e) => setDaysCount(Number(e.target.value))}
            >
              <option value={7}>7 أيام</option>
              <option value={14}>14 يوماً</option>
              <option value={30}>30 يوماً</option>
            </select>
          </div>
        </div>

        {(() => {
          const curFmt = formatPPAndCurrency(flow.currentPP, state, { decimals: 0, unit: 'نقطة' });
          const periodFmt = formatPPAndCurrency(flow.periodNetPP, state, {
            decimals: 1,
            unit: 'نقطة',
            showSign: true
          });
          const avgFmt = formatPPAndCurrency(flow.avgDailyPP, state, {
            decimals: 1,
            unit: 'نقطة',
            perDay: true
          });
          const targetFmt = formatPPAndCurrency(flow.targetDailyPP, state, {
            decimals: 0,
            unit: 'نقطة',
            perDay: true
          });
          const bestFmt = flow.bestDay
            ? formatPPAndCurrency(flow.bestDay.netPP, state, {
                decimals: 1,
                unit: 'نقطة',
                showSign: true
              })
            : null;
          return (
            <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-[var(--nx-border)] pt-4 lg:grid-cols-5">
              <div>
                <dt className="text-xs text-[var(--nx-text-muted)]">الرصيد الحالي</dt>
                <dd className="mt-1 font-mono text-lg font-bold tabular-nums text-[var(--nx-text-primary)]">
                  {curFmt.ppText}
                </dd>
                <dd className="font-mono text-xs font-semibold tabular-nums text-[var(--nx-amber)]">
                  {curFmt.moneyText}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--nx-text-muted)]">
                  صافي ربح الفترة ({flow.windowDays} يوم)
                </dt>
                <dd className="mt-1 font-mono text-lg font-bold tabular-nums text-[var(--nx-emerald)]">
                  {periodFmt.ppText}
                </dd>
                <dd className="font-mono text-xs font-semibold tabular-nums text-[var(--nx-text-secondary)]">
                  {periodFmt.moneyText}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--nx-text-muted)]">متوسط الربح اليومي</dt>
                <dd className="mt-1 font-mono text-lg font-bold tabular-nums text-[var(--nx-text-primary)]">
                  {avgFmt.ppText}
                </dd>
                <dd className="font-mono text-xs font-semibold tabular-nums text-[var(--nx-text-secondary)]">
                  {avgFmt.moneyText}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--nx-text-muted)]">الهدف اليومي المقدر</dt>
                <dd className="mt-1 font-mono text-lg font-bold tabular-nums text-[var(--nx-text-primary)]">
                  {targetFmt.ppText}
                </dd>
                <dd className="font-mono text-xs font-semibold tabular-nums text-[var(--nx-text-secondary)]">
                  {targetFmt.moneyText}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--nx-text-muted)]">أفضل يوم مسجل</dt>
                <dd className="mt-1 font-mono text-sm font-bold tabular-nums text-[var(--nx-amber)]">
                  {bestFmt ? bestFmt.combinedText : '—'}
                </dd>
                <dd className="text-xs text-[var(--nx-text-muted)]">
                  {flow.bestDay ? `${flow.bestDay.relativeLabel} (${flow.bestDay.dateKey})` : 'لا بيانات'}
                </dd>
              </div>
            </dl>
          );
        })()}

        <div className="mt-5 border-t border-[var(--nx-border)] pt-4">
          <h4 className="mb-2 text-xs font-semibold text-[var(--nx-text-muted)]">
            القرى المرتبطة بالحساب ({vils.length})
          </h4>
          {vils.length === 0 ? (
            <p className="text-xs text-[var(--nx-text-muted)]">
              لا توجد قرى مرتبطة بهذا الحساب.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {vils.map((v) => (
                <a
                  key={v.id}
                  href={`/villages/${encodeURIComponent(v.id)}`}
                  onClick={(e) => handleLinkClick(e, `/villages/${encodeURIComponent(v.id)}`)}
                  className="inline-flex items-center gap-2 rounded-[var(--nx-radius-sm)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--nx-text-primary)] transition-colors hover:border-[var(--nx-indigo)]"
                >
                  <span>{v.name}</span>
                  <span dir="ltr" className="font-mono text-[var(--nx-text-muted)]">
                    {v.coord}
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <section aria-labelledby="pp-chart-heading" className="nx-card p-5 lg:col-span-8">
          <SectionHeader
            headingId="pp-chart-heading"
            title="منحنى الأرباح اليومية التفاعلي"
            subtitle={`مرر فوق أي عمود لمعاينة تفاصيل اليوم · الهدف المرجعي: ${
              formatPPAndCurrency(flow.targetDailyPP, state, {
                decimals: 0,
                unit: 'نقطة',
                perDay: true
              }).combinedText
            }`}
            action={<TrendingUp className="h-5 w-5 text-[var(--nx-text-muted)]" aria-hidden="true" />}
          />
          <DailyFlowTrajectorySvg
            rows={flow.daysDesc}
            targetDailyPP={flow.targetDailyPP}
            finance={state.finance}
          />
        </section>

        <section aria-labelledby="pp-override-heading" className="nx-card p-5 lg:col-span-4">
          <SectionHeader
            headingId="pp-override-heading"
            title="تصحيح جلسة يومية يدوياً"
            subtitle={`اليوم المحدد: ${editDateKey}`}
            action={<CalendarClock className="h-5 w-5 text-[var(--nx-text-muted)]" aria-hidden="true" />}
          />

          <form onSubmit={handleOverrideSubmit} noValidate className="space-y-3.5">
            <FormErrorsBanner errors={errors} />
            <StatusNotice message={statusMsg} />

            <fieldset className="grid grid-cols-2 gap-3">
              <legend className="sr-only">بيانات اليوم ({editDateKey})</legend>

              <div className="col-span-2">
                <label htmlFor="override-date" className="mb-1 block text-xs font-semibold text-[var(--nx-text-secondary)]">
                  التاريخ (YYYY-MM-DD)
                </label>
                <input
                  id="override-date"
                  type="date"
                  className="nx-input font-mono"
                  value={editDateKey}
                  onChange={(e) => setEditDateKey(e.target.value)}
                />
                <FieldError message={errors?.dateKey} />
              </div>

              <div>
                <label htmlFor="override-start" className="mb-1 block text-xs font-semibold text-[var(--nx-text-secondary)]">
                  نقاط البداية
                </label>
                <input
                  id="override-start"
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  className="nx-input font-mono tabular-nums"
                  value={startPP}
                  onChange={(e) => setStartPP(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="override-end" className="mb-1 block text-xs font-semibold text-[var(--nx-text-secondary)]">
                  نقاط النهاية
                </label>
                <input
                  id="override-end"
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  className="nx-input font-mono tabular-nums"
                  value={endPP}
                  onChange={(e) => setEndPP(e.target.value)}
                />
              </div>

              <div className="col-span-2">
                <label htmlFor="override-target" className="mb-1 block text-xs font-semibold text-[var(--nx-text-secondary)]">
                  الهدف اليومي
                </label>
                <input
                  id="override-target"
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  className="nx-input font-mono tabular-nums"
                  value={targetPP}
                  onChange={(e) => setTargetPP(e.target.value)}
                />
              </div>
            </fieldset>

            <button type="submit" className="nx-btn nx-btn-primary w-full justify-center">
              حفظ التعديل اليدوي
            </button>
          </form>
        </section>
      </div>

      <section aria-labelledby="pp-daily-table-heading" className="nx-card space-y-4 p-5">
        <SectionHeader
          headingId="pp-daily-table-heading"
          title="السجل اليومي المفصل"
          subtitle="انقر على تعديل لتحميل قيم اليوم إلى استوديو التصحيح"
        />

        {/* Mobile Responsive Daily Cards */}
        <div className="grid grid-cols-1 gap-2.5 md:hidden">
          {flow.daysDesc.map((r) => {
            const netTone =
              r.netPP === null
                ? 'text-[var(--nx-text-muted)]'
                : r.netPP < 0
                  ? 'font-bold text-[var(--nx-coral)]'
                  : r.netPP > 0
                    ? 'font-bold text-[var(--nx-emerald)]'
                    : 'text-[var(--nx-text-secondary)]';

            const netFmt =
              r.netPP !== null
                ? formatPPAndCurrency(r.netPP, state, { decimals: 1, unit: 'نقطة', showSign: true })
                : null;
            const rowTargetFmt = formatPPAndCurrency(r.targetPP, state, { decimals: 0, unit: 'نقطة' });

            return (
              <div
                key={r.dateKey}
                className={`rounded-[var(--nx-radius-md)] border p-3.5 ${
                  editDateKey === r.dateKey
                    ? 'border-[var(--nx-indigo)]/35 bg-[var(--nx-indigo-soft)]'
                    : 'border-[var(--nx-border)] bg-[var(--nx-bg-subtle)]'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono font-bold text-[var(--nx-text-primary)]">{r.dateKey}</span>
                    <span className="ms-1.5 text-[var(--nx-text-muted)]">({r.relativeLabel})</span>
                  </div>
                  <div className={`font-mono text-sm ${netTone}`}>
                    {netFmt ? netFmt.combinedText : '—'}
                  </div>
                </div>

                <div className="mt-2.5 flex items-center justify-between border-t border-[var(--nx-border)] pt-2 text-xs">
                  <div className="font-mono text-[var(--nx-text-muted)]">
                    الهدف: {rowTargetFmt.combinedText} · {r.achievementPct !== null ? `${r.achievementPct}%` : '—'}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectRowForEdit(r.dateKey)}
                    className="nx-btn nx-btn-outline nx-btn-compact !min-h-[36px]"
                  >
                    <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>تعديل</span>
                  </button>
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
                <th className="border-b border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] px-3 py-2 text-start text-xs font-semibold text-[var(--nx-text-muted)]">التاريخ</th>
                <th className="border-b border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] px-3 py-2 text-start text-xs font-semibold text-[var(--nx-text-muted)]">اليوم</th>
                <th className="border-b border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] px-3 py-2 text-start text-xs font-semibold text-[var(--nx-text-muted)]">البداية</th>
                <th className="border-b border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] px-3 py-2 text-start text-xs font-semibold text-[var(--nx-text-muted)]">النهاية</th>
                <th className="border-b border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] px-3 py-2 text-start text-xs font-semibold text-[var(--nx-text-muted)]">الصافي (PP)</th>
                <th className="border-b border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] px-3 py-2 text-start text-xs font-semibold text-[var(--nx-text-muted)]">القيمة</th>
                <th className="border-b border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] px-3 py-2 text-start text-xs font-semibold text-[var(--nx-text-muted)]">الهدف</th>
                <th className="border-b border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] px-3 py-2 text-start text-xs font-semibold text-[var(--nx-text-muted)]">الإنجاز %</th>
                <th className="border-b border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] px-3 py-2 text-start text-xs font-semibold text-[var(--nx-text-muted)]">المصدر</th>
                <th className="border-b border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] px-3 py-2 text-start text-xs font-semibold text-[var(--nx-text-muted)]">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--nx-border)] text-sm">
              {flow.daysDesc.map((r) => {
                const netTone =
                  r.netPP === null
                    ? 'text-[var(--nx-text-muted)]'
                    : r.netPP < 0
                      ? 'font-bold text-[var(--nx-coral)]'
                      : r.netPP > 0
                        ? 'font-bold text-[var(--nx-emerald)]'
                        : 'text-[var(--nx-text-secondary)]';

                const startFmt =
                  r.startPP !== null
                    ? formatPPAndCurrency(r.startPP, state, { decimals: 0, unit: 'نقطة' })
                    : null;
                const endFmt =
                  r.endPP !== null
                    ? formatPPAndCurrency(r.endPP, state, { decimals: 0, unit: 'نقطة' })
                    : null;
                const netFmt =
                  r.netPP !== null
                    ? formatPPAndCurrency(r.netPP, state, { decimals: 1, unit: 'نقطة', showSign: true })
                    : null;
                const rowTargetFmt = formatPPAndCurrency(r.targetPP, state, {
                  decimals: 0,
                  unit: 'نقطة'
                });

                return (
                  <tr
                    key={r.dateKey}
                    className={`hover:bg-[var(--nx-bg-hover)] ${
                      editDateKey === r.dateKey ? 'bg-[var(--nx-indigo-soft)]/50' : ''
                    }`}
                  >
                    <td className="px-3 py-2 whitespace-nowrap font-mono text-xs text-[var(--nx-text-primary)]">
                      {r.dateKey}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-[var(--nx-text-secondary)]">
                      {r.relativeLabel} ({r.weekdayLabel})
                    </td>
                    <td className="px-3 py-2 font-mono text-xs tabular-nums text-[var(--nx-text-secondary)]">
                      {startFmt ? (
                        <div>
                          <div>{startFmt.ppText}</div>
                          <div className="text-[11px] text-[var(--nx-text-muted)]">{startFmt.moneyText}</div>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs tabular-nums text-[var(--nx-text-secondary)]">
                      {endFmt ? (
                        <div>
                          <div>{endFmt.ppText}</div>
                          <div className="text-[11px] text-[var(--nx-text-muted)]">{endFmt.moneyText}</div>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className={`px-3 py-2 font-mono tabular-nums ${netTone}`}>
                      {netFmt ? netFmt.ppText : '—'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap font-mono text-xs font-semibold tabular-nums text-[var(--nx-text-secondary)]">
                      {netFmt ? netFmt.moneyText : '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs tabular-nums text-[var(--nx-text-secondary)]">
                      <div>{rowTargetFmt.ppText}</div>
                      <div className="text-[11px] text-[var(--nx-text-muted)]">{rowTargetFmt.moneyText}</div>
                    </td>
                    <td className="px-3 py-2 font-mono tabular-nums text-[var(--nx-text-primary)]">
                      {r.achievementPct !== null ? `${r.achievementPct}%` : '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-[var(--nx-text-muted)]">
                      {r.source}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleSelectRowForEdit(r.dateKey)}
                        className="nx-btn nx-btn-outline nx-btn-compact"
                      >
                        <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>تعديل</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
