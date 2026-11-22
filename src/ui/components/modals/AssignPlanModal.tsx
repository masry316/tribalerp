import { useEffect, useMemo, useState } from 'react';
import { Check, CheckSquare, Search, Square } from 'lucide-react';
import {
  buildAssignedPlanFromStrategy,
  type AssignedPlan,
  type ErpAppState,
  type SmartPlannerInput,
  type SmartStrategyResult
} from '../../../core';
import { BaseModal } from './BaseModal';

interface AssignPlanModalProps {
  open: boolean;
  onClose: () => void;
  state: ErpAppState;
  strategy: SmartStrategyResult | null;
  plannerInput: SmartPlannerInput;
  defaultVillageId?: string;
  onAssignPlans: (villageIds: string[], plan: AssignedPlan, simType: 'virtual26' | 'real') => void;
}

export function AssignPlanModal({
  open,
  onClose,
  state,
  strategy,
  plannerInput,
  defaultVillageId,
  onAssignPlans
}: AssignPlanModalProps) {
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    defaultVillageId && state.villages.some((v) => v.id === defaultVillageId)
      ? [defaultVillageId]
      : state.villages[0]
        ? [state.villages[0].id]
        : []
  );

  useEffect(() => {
    if (!open) return;
    setQuery('');
    if (defaultVillageId && state.villages.some((v) => v.id === defaultVillageId)) {
      setSelectedIds([defaultVillageId]);
    } else if (state.villages[0]) {
      setSelectedIds((prev) =>
        prev.some((id) => state.villages.some((v) => v.id === id))
          ? prev
          : [state.villages[0].id]
      );
    }
  }, [open, defaultVillageId, state.villages]);

  const accountNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of state.userAccounts) m.set(a.id, a.name);
    return m;
  }, [state.userAccounts]);

  const worldNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of state.worlds) m.set(w.id, `${w.name} (${w.speed}x)`);
    return m;
  }, [state.worlds]);

  const filteredVillages = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = state.villages.filter((v) => {
      if (state.selectedWorldFilter !== 'all' && v.worldId !== state.selectedWorldFilter) {
        return false;
      }
      if (!q) return true;
      const accName = accountNameById.get(v.accountId) || '';
      return (
        v.name.toLowerCase().includes(q) ||
        accName.toLowerCase().includes(q) ||
        String(v.coord || '').toLowerCase().includes(q) ||
        `k${v.continent}`.toLowerCase().includes(q)
      );
    });
    if (!defaultVillageId) return list;
    return [...list].sort((a, b) => {
      const aPin = a.id === defaultVillageId ? 1 : 0;
      const bPin = b.id === defaultVillageId ? 1 : 0;
      return bPin - aPin;
    });
  }, [state.villages, state.selectedWorldFilter, query, accountNameById, defaultVillageId]);

  const validSelectedIds = useMemo(
    () => selectedIds.filter((id) => state.villages.some((v) => v.id === id)),
    [selectedIds, state.villages]
  );

  const toggleVillage = (vid: string) => {
    setSelectedIds((prev) =>
      prev.includes(vid) ? prev.filter((id) => id !== vid) : [...prev, vid]
    );
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = filteredVillages.map((v) => v.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => validSelectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleConfirm = () => {
    if (!strategy || validSelectedIds.length === 0) return;
    const plan = buildAssignedPlanFromStrategy(strategy, plannerInput, Date.now());
    onAssignPlans(validSelectedIds, plan, plannerInput.sourceMode);
    onClose();
  };

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      ariaLabel="إسناد خطة التطوير للقرى"
      title="إسناد خطة التطوير للقرى"
      subtitle={
        strategy
          ? `${strategy.name} · ${strategy.steps.length} خطوة · صافي متوقع ${strategy.totalNetPP.toLocaleString('en-US')} نقطة`
          : undefined
      }
      maxWidthClass="max-w-xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="nx-btn nx-btn-outline"
          >
            إلغاء
          </button>
          <button
            type="button"
            disabled={!strategy || validSelectedIds.length === 0}
            onClick={handleConfirm}
            className="nx-btn nx-btn-primary"
          >
            <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              تأكيد الإسناد ({validSelectedIds.length}{' '}
              {validSelectedIds.length === 1 ? 'قرية' : 'قرى'})
            </span>
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {state.villages.length === 0 ? (
          <div className="rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] p-6 text-center text-sm text-[var(--nx-text-muted)]">
            لا توجد قرى مسجلة في النظام بعد. أضف قرية أولاً من صفحة الحسابات أو عبر المزامنة السحابية لتتمكن من إسناد الخطط لها.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search
                  className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--nx-text-muted)]"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="بحث باسم القرية أو الحساب أو الإحداثيات..."
                  aria-label="بحث في القرى"
                  className="nx-input ps-9"
                />
              </div>
              <button
                type="button"
                onClick={toggleSelectAllVisible}
                className="nx-btn nx-btn-outline nx-btn-compact"
              >
                {filteredVillages.length > 0 &&
                filteredVillages.every((v) => validSelectedIds.includes(v.id))
                  ? 'إلغاء تحديد الكل'
                  : `تحديد الكل (${filteredVillages.length})`}
              </button>
            </div>

            <div className="max-h-[340px] divide-y divide-[var(--nx-border)] overflow-y-auto rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)]">
              {filteredVillages.length === 0 ? (
                <div className="p-5 text-center text-xs text-[var(--nx-text-muted)]">
                  لا توجد قرى مطابقة للبحث الحالي.
                </div>
              ) : (
                filteredVillages.map((v) => {
                  const checked = validSelectedIds.includes(v.id);
                  const accName = accountNameById.get(v.accountId) || 'حساب غير معروف';
                  const worldLabel = worldNameById.get(v.worldId) || v.worldId;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => toggleVillage(v.id)}
                      aria-pressed={checked}
                      className={`nx-transition flex w-full cursor-pointer items-center justify-between gap-3 px-3.5 py-2.5 text-start ${
                        checked
                          ? 'bg-[var(--nx-indigo-soft)]'
                          : 'hover:bg-[var(--nx-bg-hover)]'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        {checked ? (
                          <CheckSquare
                            className="h-4 w-4 shrink-0 text-[var(--nx-indigo)]"
                            aria-hidden="true"
                          />
                        ) : (
                          <Square
                            className="h-4 w-4 shrink-0 text-[var(--nx-text-muted)]"
                            aria-hidden="true"
                          />
                        )}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-[var(--nx-text-primary)]">
                            <span className="truncate">{v.name}</span>
                            <span dir="ltr" className="font-mono-num text-xs text-[var(--nx-text-muted)]">
                              {v.coord || '—'}
                            </span>
                          </div>
                          <div className="mt-0.5 text-xs text-[var(--nx-text-muted)]">
                            {accName} · {worldLabel} · K{v.continent} ·{' '}
                            <span className="font-mono-num">{v.villagePoints || 26} ن.ق</span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-end text-xs">
                        {v.assignedPlan ? (
                          <span className="font-medium text-[var(--nx-amber)]">
                            عليها خطة حالية
                          </span>
                        ) : (
                          <span className="text-[var(--nx-text-subtle)]">بدون خطة</span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <p className="text-xs text-[var(--nx-text-muted)]">
              سيتم حفظ الخطوات في القرية المحددة ومزامنتها سحابياً، لتظهر فوراً في غرفة القرية وإحاطة المهام المباشرة مع متابعة تلقائية للتقدم.
            </p>
          </>
        )}
      </div>
    </BaseModal>
  );
}
