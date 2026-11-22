import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Globe2, Layers, Users, X } from 'lucide-react';
import type { AssignedPlan, ErpAppState } from '../../../core';
import type { MutationResult, VirtualVillageBatchParams } from '../../../data';
import { NumericInput } from '../NumericInput';
import type { ToastItem } from '../LayoutNav';

interface VirtualWorldPrepModalProps {
  open: boolean;
  state: ErpAppState;
  defaultPlan?: AssignedPlan | null;
  defaultWorldId?: string;
  onClose: () => void;
  onGenerate: (params: VirtualVillageBatchParams) => MutationResult;
  onPushToast: (message: string, tone?: ToastItem['tone']) => void;
}

type ContKey = '44' | '45' | '54' | '55';
const CONTINENTS: ContKey[] = ['44', '45', '54', '55'];

function splitEvenlyAcrossFour(total: number): Record<ContKey, number> {
  const clean = Math.max(0, Math.min(400, Math.trunc(total)));
  const base = Math.floor(clean / 4);
  const rem = clean % 4;
  return {
    '44': base + (rem > 0 ? 1 : 0),
    '45': base + (rem > 1 ? 1 : 0),
    '54': base + (rem > 2 ? 1 : 0),
    '55': base
  };
}

export function VirtualWorldPrepModal({
  open,
  state,
  defaultPlan = null,
  defaultWorldId,
  onClose,
  onGenerate,
  onPushToast
}: VirtualWorldPrepModalProps) {
  const activeWorlds = useMemo(
    () => state.worlds.filter((w) => !w.tradeEnded),
    [state.worlds]
  );
  const worldOptions = activeWorlds.length > 0 ? activeWorlds : state.worlds;

  const [worldId, setWorldId] = useState<string>(
    () => defaultWorldId || worldOptions[0]?.id || ''
  );
  const [distMode, setDistMode] = useState<'even' | 'custom'>('even');
  const [customCounts, setCustomCounts] = useState<Record<ContKey, number>>({
    '44': 0,
    '45': 0,
    '54': 0,
    '55': 0
  });
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [attachPlan, setAttachPlan] = useState<boolean>(Boolean(defaultPlan));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const targetWorld =
      (defaultWorldId && worldOptions.some((w) => w.id === defaultWorldId)
        ? defaultWorldId
        : worldOptions[0]?.id) || '';
    setWorldId(targetWorld);
    setDistMode('even');
    setAttachPlan(Boolean(defaultPlan));
    setErrorMsg(null);
  }, [open, defaultWorldId, defaultPlan, worldOptions]);

  // Registered accounts that do NOT yet have a village in the selected world (strictly 1 village per account)
  const availableAccounts = useMemo(() => {
    const usedIds = new Set(
      state.villages.filter((v) => v.worldId === worldId).map((v) => v.accountId)
    );
    return state.userAccounts.filter((a) => !usedIds.has(a.id));
  }, [state.userAccounts, state.villages, worldId]);

  const alreadyInWorldCount = state.userAccounts.length - availableAccounts.length;

  // Select all available accounts whenever modal opens or world switches
  useEffect(() => {
    if (!open) return;
    const ids = availableAccounts.map((a) => a.id);
    setSelectedAccountIds(ids);
    setCustomCounts(splitEvenlyAcrossFour(ids.length));
    setErrorMsg(null);
  }, [open, worldId, availableAccounts]);

  const selectedCount = selectedAccountIds.length;

  const countsByContinent = useMemo(
    () => (distMode === 'even' ? splitEvenlyAcrossFour(selectedCount) : customCounts),
    [distMode, selectedCount, customCounts]
  );

  const customTotal =
    customCounts['44'] + customCounts['45'] + customCounts['54'] + customCounts['55'];
  const totalToCreate =
    countsByContinent['44'] +
    countsByContinent['45'] +
    countsByContinent['54'] +
    countsByContinent['55'];
  const customMismatch = distMode === 'custom' && customTotal !== selectedCount;

  const selectedWorldObj = state.worlds.find((w) => w.id === worldId);

  if (!open) return null;

  const toggleAccount = (id: string) => {
    setSelectedAccountIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      if (distMode === 'custom') {
        setCustomCounts(splitEvenlyAcrossFour(next.length));
      }
      return next;
    });
  };

  const selectAllAccounts = () => {
    const ids = availableAccounts.map((a) => a.id);
    setSelectedAccountIds(ids);
    if (distMode === 'custom') {
      setCustomCounts(splitEvenlyAcrossFour(ids.length));
    }
  };

  const clearAllAccounts = () => {
    setSelectedAccountIds([]);
    if (distMode === 'custom') {
      setCustomCounts({ '44': 0, '45': 0, '54': 0, '55': 0 });
    }
  };

  const handleSubmit = () => {
    setErrorMsg(null);
    if (!worldId) {
      setErrorMsg('يرجى اختيار العالم المستهدف أولاً.');
      return;
    }
    if (selectedCount <= 0) {
      setErrorMsg('اختر حساباً واحداً على الأقل لتوليد قريته في هذا العالم.');
      return;
    }
    if (customMismatch) {
      setErrorMsg(
        `مجموع القارات (${customTotal}) يجب أن يساوي عدد الحسابات المختارة (${selectedCount}) — قرية واحدة لكل حساب.`
      );
      return;
    }

    const res = onGenerate({
      worldId,
      countsByContinent,
      accountIds: selectedAccountIds,
      autoCreateMissingAccounts: false,
      villageNamePrefix: '',
      assignedPlan: attachPlan && defaultPlan ? defaultPlan : null
    });

    if (!res.ok) {
      const firstErr = res.errors ? Object.values(res.errors)[0] : 'تعذر توليد القرى الافتراضية.';
      setErrorMsg(firstErr);
      return;
    }

    const vCount = res.updatedVillages?.length || selectedCount;
    onPushToast(
      `تم توليد ${vCount} قرية افتراضية (باسم كل حساب) في ${selectedWorldObj?.name || 'العالم'}${
        attachPlan && defaultPlan ? ' مع إسناد الخطة تلقائياً' : ''
      }`,
      'success'
    );
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="virtual-prep-modal-title"
      data-testid="virtual-prep-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4"
    >
      <div className="nx-card flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-[var(--nx-border)] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-[var(--nx-radius-sm)] bg-[var(--nx-indigo-soft)] text-[var(--nx-indigo)]">
              <Globe2 className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="virtual-prep-modal-title"
                className="text-sm font-extrabold text-[var(--nx-text-primary)] sm:text-base"
              >
                تجهيز قرى العالم الافتراضية (قرية لكل حساب)
              </h2>
              <p className="text-[11px] text-[var(--nx-text-muted)]">
                يولّد قرية واحدة باسم كل حساب مسجل ويوزعها على القارات الأربع — وتتحدّث تلقائياً فور المزامنة مع الحفاظ على الخطة
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة التجهيز الافتراضي"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--nx-radius-sm)] border border-[var(--nx-border)] text-[var(--nx-text-muted)] hover:bg-[var(--nx-bg-hover)] hover:text-[var(--nx-text-primary)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {errorMsg && (
            <div className="rounded-[var(--nx-radius-sm)] border border-[var(--nx-coral-border)] bg-[var(--nx-coral-bg)] px-3 py-2 text-xs font-semibold text-[var(--nx-coral)]">
              {errorMsg}
            </div>
          )}

          {/* World selector + summary */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-end">
            <div>
              <label
                htmlFor="vprep-world"
                className="mb-1 block text-xs font-semibold text-[var(--nx-text-secondary)]"
              >
                العالم المستهدف
              </label>
              <select
                id="vprep-world"
                value={worldId}
                onChange={(e) => setWorldId(e.target.value)}
                className="nx-select nx-select-compact w-full"
              >
                {worldOptions.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.speed}x)
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-[var(--nx-radius-sm)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] px-3 py-2 text-xs">
              <div className="text-[11px] text-[var(--nx-text-muted)]">حالة حساباتك في هذا العالم</div>
              <div className="mt-0.5 font-bold text-[var(--nx-text-primary)]">
                جاهز للتوليد:{' '}
                <span className="font-mono-num text-[var(--nx-indigo)]">{availableAccounts.length}</span>{' '}
                من أصل <span className="font-mono-num">{state.userAccounts.length}</span> حساب
                {alreadyInWorldCount > 0 && (
                  <span className="mr-1.5 text-[11px] font-normal text-[var(--nx-text-muted)]">
                    ({alreadyInWorldCount} لديها قرية بالفعل)
                  </span>
                )}
              </div>
            </div>
          </div>

          {availableAccounts.length === 0 ? (
            <div className="rounded-[var(--nx-radius-md)] border border-[var(--nx-teal-border)] bg-[var(--nx-teal-bg)] p-4 text-center text-xs font-semibold text-[var(--nx-teal)]">
              {state.userAccounts.length === 0
                ? 'لا توجد حسابات مسجلة بعد. أضف حساباتك أولاً من صفحة الحسابات ثم ارجع لتوليد قراها تلقائياً.'
                : `جميع حساباتك المسجلة (${state.userAccounts.length} حساب) لديها بالفعل قرية في ${selectedWorldObj?.name || 'هذا العالم'} — لا يمكن توليد قرى مكررة لنفس الحساب.`}
            </div>
          ) : (
            <>
              {/* Distribution across 4 continents */}
              <div className="space-y-3 rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--nx-text-primary)]">
                    <Layers className="h-3.5 w-3.5 text-[var(--nx-indigo)]" aria-hidden="true" />
                    <span>توزيع الـ {selectedCount} قرية على القارات الأربع (K44 · K45 · K54 · K55)</span>
                  </div>

                  <div className="inline-flex rounded-[var(--nx-radius-sm)] border border-[var(--nx-border)] bg-[var(--nx-bg-surface)] p-0.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setDistMode('even')}
                      className={`cursor-pointer rounded px-2.5 py-1 font-bold ${
                        distMode === 'even'
                          ? 'bg-[var(--nx-indigo)] text-white'
                          : 'text-[var(--nx-text-muted)]'
                      }`}
                    >
                      توزيع متساوٍ تلقائي
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomCounts(splitEvenlyAcrossFour(selectedCount));
                        setDistMode('custom');
                      }}
                      className={`cursor-pointer rounded px-2.5 py-1 font-bold ${
                        distMode === 'custom'
                          ? 'bg-[var(--nx-indigo)] text-white'
                          : 'text-[var(--nx-text-muted)]'
                      }`}
                    >
                      تخصيص لكل قارة
                    </button>
                  </div>
                </div>

                {distMode === 'even' ? (
                  <div className="grid grid-cols-4 gap-2">
                    {CONTINENTS.map((cont) => (
                      <div
                        key={cont}
                        className="rounded-[var(--nx-radius-sm)] border border-[var(--nx-border)] bg-[var(--nx-bg-surface)] px-2 py-2 text-center"
                      >
                        <div className="text-[11px] font-semibold text-[var(--nx-text-muted)]">
                          قارة K{cont}
                        </div>
                        <div className="font-mono-num mt-0.5 text-base font-extrabold text-[var(--nx-indigo)]">
                          {countsByContinent[cont]}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                      {CONTINENTS.map((cont) => (
                        <div key={cont}>
                          <label
                            htmlFor={`vprep-k-${cont}`}
                            className="mb-1 block text-[11.5px] font-semibold text-[var(--nx-text-secondary)]"
                          >
                            قارة K{cont}
                          </label>
                          <NumericInput
                            id={`vprep-k-${cont}`}
                            min={0}
                            max={selectedCount}
                            integer
                            fallback={0}
                            value={customCounts[cont]}
                            onValueChange={(v) =>
                              setCustomCounts((prev) => ({ ...prev, [cont]: v }))
                            }
                            className="nx-input nx-input-compact font-mono-num w-full"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-[11.5px]">
                      <span
                        className={
                          customMismatch
                            ? 'font-bold text-[var(--nx-coral)]'
                            : 'font-semibold text-[var(--nx-teal)]'
                        }
                      >
                        المجموع: {customTotal} / {selectedCount} حساب
                        {customMismatch
                          ? customTotal > selectedCount
                            ? ` (زيادة ${customTotal - selectedCount})`
                            : ` (متبقي ${selectedCount - customTotal})`
                          : ' ✓ مطابق'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCustomCounts(splitEvenlyAcrossFour(selectedCount))}
                        className="cursor-pointer font-bold text-[var(--nx-indigo)] hover:underline"
                      >
                        إعادة التوزيع المتساوي
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Accounts checklist */}
              <div className="space-y-2 rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--nx-text-primary)]">
                    <Users className="h-3.5 w-3.5 text-[var(--nx-teal)]" aria-hidden="true" />
                    <span>
                      الحسابات المختارة ({selectedCount} من {availableAccounts.length}) — كل قرية ستأخذ اسم حسابها
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={selectAllAccounts}
                      className="cursor-pointer font-bold text-[var(--nx-indigo)] hover:underline"
                    >
                      تحديد الكل
                    </button>
                    <span className="text-[var(--nx-text-muted)]">·</span>
                    <button
                      type="button"
                      onClick={clearAllAccounts}
                      className="cursor-pointer font-semibold text-[var(--nx-text-muted)] hover:underline"
                    >
                      إلغاء التحديد
                    </button>
                  </div>
                </div>

                <div className="grid max-h-36 grid-cols-2 gap-1.5 overflow-y-auto rounded-[var(--nx-radius-sm)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] p-2 sm:grid-cols-3">
                  {availableAccounts.map((acc) => {
                    const checked = selectedAccountIds.includes(acc.id);
                    return (
                      <label
                        key={acc.id}
                        className={`flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs ${
                          checked
                            ? 'bg-[var(--nx-indigo-soft)]/60 font-bold text-[var(--nx-text-primary)]'
                            : 'text-[var(--nx-text-secondary)] hover:bg-[var(--nx-bg-hover)]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleAccount(acc.id)}
                          className="h-3.5 w-3.5 accent-[var(--nx-indigo)]"
                        />
                        <span className="truncate">{acc.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Optional Plan Attachment */}
              {defaultPlan && (
                <label className="flex cursor-pointer items-start gap-2.5 rounded-[var(--nx-radius-md)] border border-[var(--nx-indigo)]/35 bg-[var(--nx-indigo-soft)]/35 p-3 text-xs">
                  <input
                    type="checkbox"
                    checked={attachPlan}
                    onChange={(e) => setAttachPlan(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[var(--nx-indigo)]"
                  />
                  <div>
                    <div className="font-bold text-[var(--nx-text-primary)]">
                      إسناد خطة المحاكي الحالية تلقائياً لكل القرى ({defaultPlan.steps.length} خطوة)
                    </div>
                    <div className="mt-0.5 text-[11px] text-[var(--nx-text-secondary)]">
                      الخطة: {defaultPlan.name} — ستبقى مربوطة بالقرية بعد مزامنة القرية الحقيقية فور فتح العالم
                    </div>
                  </div>
                </label>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] px-5 py-3">
          <div className="font-mono-num text-xs font-semibold text-[var(--nx-text-secondary)]">
            {availableAccounts.length === 0 ? (
              <span>لا توجد حسابات متبقية بدون قرية في هذا العالم</span>
            ) : (
              <span>
                سيتم توليد <strong className="text-[var(--nx-indigo)]">{totalToCreate} قرية</strong>{' '}
                (قرية واحدة باسم كل حساب)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="nx-btn nx-btn-outline nx-btn-compact"
            >
              إلغاء
            </button>
            <button
              type="button"
              data-testid="confirm-generate-virtual-btn"
              disabled={availableAccounts.length === 0 || selectedCount <= 0 || customMismatch}
              onClick={handleSubmit}
              className="nx-btn nx-btn-primary nx-btn-compact"
            >
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>توليد {selectedCount} قرية للحسابات</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
