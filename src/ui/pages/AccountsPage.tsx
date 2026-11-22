import { useMemo, useState } from 'react';
import {
  Bookmark,
  Copy,
  Edit3,
  ExternalLink,
  Globe2,
  Plus,
  Search,
  ShieldAlert,
  TrendingUp,
  Users,
  Wand2,
  Warehouse
} from 'lucide-react';
import {
  auditAccountsSecurity,
  computeVillageLiveStatus,
  formatPPAndCurrency,
  formatTimeAgo,
  getAccountCleanDevice,
  SHORT_CLOUD_BOOKMARKLET,
  type ErpAppState
} from '../../core';
import type { MutationResult, VirtualVillageBatchParams } from '../../data';
import type { AccountInput } from '../../validation';
import { buildBookmarkletUrl } from '../../utils/bookmarklet';
import { ScreenEmptyState } from '../components/StateViews';
import { VillageOperationalCard } from '../components/VillageCard';
import { IdentityGeneratorModal } from '../components/modals/IdentityGeneratorModal';
import { VirtualWorldPrepModal } from '../components/modals/VirtualWorldPrepModal';

interface AccountsPageProps {
  state: ErpAppState;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  navigate: (path: string) => void;
  onOpenCreateAccount: () => void;
  onOpenAccountModal: (accountId: string) => void;
  onOpenCreateVillage: () => void;
  onOpenVillageModal: (villageId: string) => void;
  onOpenMissionModal: (villageId: string) => void;
  onOpenPPFlowModal: (accountId: string) => void;
  onOpenSyncModal: () => void;
  onSaveAccount: (input: Partial<AccountInput>) => MutationResult;
  onGenerateVirtualVillages: (params: VirtualVillageBatchParams) => MutationResult;
  onPushToast: (msg: string, tone?: 'info' | 'success' | 'warn' | 'danger') => void;
}

export function AccountsPage({
  state,
  searchQuery,
  onSearchChange,
  navigate,
  onOpenCreateAccount,
  onOpenAccountModal,
  onOpenCreateVillage,
  onOpenVillageModal,
  onOpenMissionModal,
  onOpenPPFlowModal,
  onOpenSyncModal,
  onSaveAccount,
  onGenerateVirtualVillages,
  onPushToast
}: AccountsPageProps) {
  const [subTab, setSubTab] = useState<'accounts' | 'villages'>('accounts');
  const [onlyCollisions, setOnlyCollisions] = useState(false);
  const [identityModalOpen, setIdentityModalOpen] = useState(false);
  const [virtualPrepOpen, setVirtualPrepOpen] = useState(false);

  const collisions = useMemo(() => auditAccountsSecurity(state), [state]);
  const collidingAccountIds = useMemo(() => {
    const s = new Set<string>();
    collisions.forEach((c) => c.accountIds.forEach((id) => s.add(id)));
    return s;
  }, [collisions]);

  const fullBookmarkletUrl = useMemo(() => buildBookmarkletUrl(), []);

  const filteredAccounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return state.userAccounts.filter((acc) => {
      if (onlyCollisions && !collidingAccountIds.has(acc.id)) return false;
      if (!q) return true;
      const hay = `${acc.name} ${acc.ip || ''} ${acc.device || ''} ${acc.browser || ''} ${acc.email || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [state.userAccounts, searchQuery, onlyCollisions, collidingAccountIds]);

  const filteredVillages = useMemo(() => {
    const nowMs = Date.now();
    const q = searchQuery.trim().toLowerCase();
    return state.villages
      .map((v) => {
        const acc = state.userAccounts.find((a) => a.id === v.accountId) || null;
        const live = computeVillageLiveStatus(v, state, nowMs);
        return { vil: v, acc, live };
      })
      .filter(({ vil, acc, live }) => {
        if (state.selectedWorldFilter !== 'all' && vil.worldId !== state.selectedWorldFilter) return false;
        if (onlyCollisions && (!acc || !collidingAccountIds.has(acc.id))) return false;
        if (!q) return true;
        const hay = `${vil.name} ${vil.coord || ''} ${acc?.name || ''} ${live.worldName} k${vil.continent}`.toLowerCase();
        return hay.includes(q);
      });
  }, [state, searchQuery, onlyCollisions, collidingAccountIds]);

  async function handleCopyBookmarklet(url: string, label: string) {
    try {
      await navigator.clipboard.writeText(url);
      onPushToast(`تم نسخ ${label}`, 'success');
    } catch {
      onPushToast('تعذر النسخ التلقائي للحافظة', 'warn');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-[var(--nx-text-primary)]">
            الحسابات والقرى
          </h1>
          <p className="text-xs text-[var(--nx-text-muted)]">
            إدارة الحسابات ({state.userAccounts.length}) والقرى المرتبطة ({state.villages.length}) وتتبع الأرصدة والعملة والـ IP
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="accounts-virtual-prep-btn"
            onClick={() => setVirtualPrepOpen(true)}
            className="nx-btn nx-btn-outline nx-btn-compact"
          >
            <Globe2 className="h-3.5 w-3.5 text-[var(--nx-teal)]" aria-hidden="true" />
            <span>تجهيز عالم افتراضي</span>
          </button>
          <button
            type="button"
            onClick={() => setIdentityModalOpen(true)}
            className="nx-btn nx-btn-outline nx-btn-compact"
          >
            <Wand2 className="h-3.5 w-3.5 text-[var(--nx-indigo)]" aria-hidden="true" />
            <span>توليد اسم</span>
          </button>
          <button
            type="button"
            onClick={onOpenCreateAccount}
            className="nx-btn nx-btn-outline nx-btn-compact"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>حساب جديد</span>
          </button>
          <button
            type="button"
            onClick={onOpenCreateVillage}
            className="nx-btn nx-btn-primary nx-btn-compact"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>قرية جديدة</span>
          </button>
        </div>
      </div>

      {/* Sub-Tabs + Search & Collision Filter */}
      <div className="nx-card flex flex-wrap items-center justify-between gap-3 p-3">
        <div
          role="tablist"
          aria-label="أقسام الحسابات والقرى"
          className="inline-flex rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'accounts'}
            onClick={() => setSubTab('accounts')}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-[var(--nx-radius-sm)] px-3 py-1.5 text-xs font-semibold ${
              subTab === 'accounts'
                ? 'bg-[var(--nx-bg-surface)] text-[var(--nx-indigo)] shadow-xs'
                : 'text-[var(--nx-text-muted)] hover:text-[var(--nx-text-primary)]'
            }`}
          >
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            <span>الحسابات ({filteredAccounts.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'villages'}
            onClick={() => setSubTab('villages')}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-[var(--nx-radius-sm)] px-3 py-1.5 text-xs font-semibold ${
              subTab === 'villages'
                ? 'bg-[var(--nx-bg-surface)] text-[var(--nx-indigo)] shadow-xs'
                : 'text-[var(--nx-text-muted)] hover:text-[var(--nx-text-primary)]'
            }`}
          >
            <Warehouse className="h-3.5 w-3.5" aria-hidden="true" />
            <span>القرى ({filteredVillages.length})</span>
          </button>
        </div>

        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <div className="relative w-full min-w-[200px] sm:w-64">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--nx-text-muted)]"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="بحث في الحسابات والقرى"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="بحث بالاسم، IP، الإحداثيات..."
              className="nx-input nx-input-compact w-full ps-9"
            />
          </div>

          <button
            type="button"
            onClick={() => setOnlyCollisions((v) => !v)}
            className={`nx-btn nx-btn-compact ${
              onlyCollisions
                ? 'border-[var(--nx-coral-border)] bg-[var(--nx-coral-bg)] text-[var(--nx-coral)]'
                : 'nx-btn-outline'
            }`}
          >
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
            <span>تعارض IP</span>
            {collisions.length > 0 && (
              <span className="font-mono-num rounded bg-[var(--nx-coral)] px-1.5 text-[10px] font-bold text-white">
                {collisions.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* SubTab 1: Accounts */}
      {subTab === 'accounts' ? (
        filteredAccounts.length === 0 ? (
          <ScreenEmptyState
            title="لا توجد حسابات مطابقة"
            description="أضف حساباً جديداً أو ابدأ المزامنة السحابية من داخل اللعبة لإدراج الحسابات تلقائياً."
            actionLabel="إضافة حساب جديد"
            onAction={onOpenCreateAccount}
            secondaryLabel="مركز المزامنة"
            onSecondary={onOpenSyncModal}
          />
        ) : (
          <div className="nx-card overflow-hidden">
            {/* Desktop Table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-start text-sm">
                <thead>
                  <tr className="border-b border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] text-[11px] font-semibold text-[var(--nx-text-muted)]">
                    <th className="px-4 py-3 text-start">الحساب</th>
                    <th className="px-3 py-3 text-start">الرصيد والعملة</th>
                    <th className="px-3 py-3 text-start">العائد اليومي</th>
                    <th className="px-3 py-3 text-start">القرى</th>
                    <th className="px-3 py-3 text-start">IP / الجهاز</th>
                    <th className="px-3 py-3 text-start">آخر مزامنة</th>
                    <th className="px-4 py-3 text-end">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--nx-border)]">
                  {filteredAccounts.map((acc) => {
                    const accVils = state.villages.filter((v) => v.accountId === acc.id);
                    const accDailyPP = accVils.reduce(
                      (s, v) => s + computeVillageLiveStatus(v, state).dailyPP,
                      0
                    );
                    const balFmt = formatPPAndCurrency(Number(acc.pp || 0), state, {
                      decimals: 0,
                      unit: 'نقطة'
                    });
                    const dailyFmt = formatPPAndCurrency(accDailyPP, state, {
                      decimals: 1,
                      unit: 'نقطة',
                      perDay: true
                    });
                    const hasCol = collidingAccountIds.has(acc.id);
                    return (
                      <tr key={acc.id} className="nx-transition hover:bg-[var(--nx-bg-hover)]">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onOpenPPFlowModal(acc.id)}
                              className="cursor-pointer font-bold text-[var(--nx-text-primary)] hover:text-[var(--nx-indigo)]"
                            >
                              {acc.name}
                            </button>
                            {hasCol && (
                              <span className="rounded-[var(--nx-radius-xs)] bg-[var(--nx-coral-bg)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--nx-coral)]">
                                تعارض IP
                              </span>
                            )}
                          </div>
                          {acc.email && (
                            <div className="text-[11px] text-[var(--nx-text-muted)]">{acc.email}</div>
                          )}
                        </td>

                        <td className="px-3 py-3">
                          <div className="font-mono-num font-bold text-[var(--nx-indigo)]">
                            {balFmt.combinedText}
                          </div>
                        </td>

                        <td className="px-3 py-3">
                          <div className="font-mono-num text-xs font-semibold text-[var(--nx-emerald)]">
                            {dailyFmt.combinedText}
                          </div>
                        </td>

                        <td className="px-3 py-3">
                          <span className="font-mono-num rounded-[var(--nx-radius-xs)] bg-[var(--nx-bg-subtle)] px-2 py-0.5 text-xs font-semibold">
                            {accVils.length}
                          </span>
                        </td>

                        <td className="px-3 py-3">
                          <div dir="ltr" className="font-mono-num text-xs font-semibold text-[var(--nx-text-primary)]">
                            {acc.ip || '—'}
                          </div>
                          <div className="text-[11px] text-[var(--nx-text-muted)]">
                            {getAccountCleanDevice(acc)} · {acc.browser || 'Chrome'}
                          </div>
                        </td>

                        <td className="px-3 py-3 text-xs text-[var(--nx-text-muted)]">
                          {formatTimeAgo(acc.lastSyncTime)}
                        </td>

                        <td className="px-4 py-3 text-end">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onOpenPPFlowModal(acc.id)}
                              className="nx-btn nx-btn-outline nx-btn-compact"
                            >
                              <TrendingUp className="h-3.5 w-3.5 text-[var(--nx-indigo)]" aria-hidden="true" />
                              <span>التدفق</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => navigate(`/accounts/${encodeURIComponent(acc.id)}`)}
                              aria-label={`فتح صفحة تدفق ${acc.name}`}
                              className="nx-btn nx-btn-outline nx-btn-compact !px-2"
                            >
                              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenAccountModal(acc.id)}
                              aria-label={`تعديل الحساب ${acc.name}`}
                              className="nx-btn nx-btn-outline nx-btn-compact !px-2"
                            >
                              <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="divide-y divide-[var(--nx-border)] md:hidden">
              {filteredAccounts.map((acc) => {
                const accVils = state.villages.filter((v) => v.accountId === acc.id);
                const accDailyPP = accVils.reduce(
                  (s, v) => s + computeVillageLiveStatus(v, state).dailyPP,
                  0
                );
                const balFmt = formatPPAndCurrency(Number(acc.pp || 0), state, {
                  decimals: 0,
                  unit: 'نقطة'
                });
                const dailyFmt = formatPPAndCurrency(accDailyPP, state, {
                  decimals: 1,
                  unit: 'نقطة',
                  perDay: true
                });
                const hasCol = collidingAccountIds.has(acc.id);
                return (
                  <div key={acc.id} className="space-y-2.5 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-[var(--nx-text-primary)]">{acc.name}</span>
                          {hasCol && (
                            <span className="rounded bg-[var(--nx-coral-bg)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--nx-coral)]">
                              تعارض IP
                            </span>
                          )}
                        </div>
                        <div dir="ltr" className="font-mono-num mt-0.5 text-xs text-[var(--nx-text-muted)]">
                          {acc.ip || 'بدون IP'} · {getAccountCleanDevice(acc)}
                        </div>
                      </div>
                      <div className="text-end">
                        <div className="font-mono-num text-xs font-bold text-[var(--nx-indigo)]">
                          {balFmt.combinedText}
                        </div>
                        <div className="font-mono-num text-[11px] text-[var(--nx-emerald)]">
                          {dailyFmt.combinedText}
                        </div>
                        <div className="text-[11px] text-[var(--nx-text-muted)]">{accVils.length} قرية</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onOpenPPFlowModal(acc.id)}
                        className="nx-btn nx-btn-outline nx-btn-compact flex-1"
                      >
                        <TrendingUp className="h-3.5 w-3.5 text-[var(--nx-indigo)]" aria-hidden="true" />
                        <span>التدفق اليومي</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/accounts/${encodeURIComponent(acc.id)}`)}
                        className="nx-btn nx-btn-outline nx-btn-compact"
                      >
                        صفحة التدفق
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenAccountModal(acc.id)}
                        className="nx-btn nx-btn-outline nx-btn-compact"
                      >
                        تعديل
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      ) : /* SubTab 2: Villages — Redesigned Operational Cards */ filteredVillages.length === 0 ? (
        <ScreenEmptyState
          title="لا توجد قرى مطابقة"
          description="أضف قرية جديدة يدوياً أو زامن القرى عبر أداة المزامنة السحابية."
          actionLabel="إضافة قرية جديدة"
          onAction={onOpenCreateVillage}
          secondaryLabel="مركز المزامنة"
          onSecondary={onOpenSyncModal}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredVillages.map(({ vil, acc, live }) => (
            <VillageOperationalCard
              key={vil.id}
              vil={vil}
              acc={acc}
              live={live}
              state={state}
              onOpenVillageDetail={(vid) => navigate(`/villages/${encodeURIComponent(vid)}`)}
              onOpenAccountFlow={onOpenPPFlowModal}
              onOpenMissionModal={onOpenMissionModal}
              onOpenVillageModal={onOpenVillageModal}
            />
          ))}
        </div>
      )}

      {/* Quick Bookmarklet Sync Strip */}
      <section className="nx-card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--nx-radius-md)] bg-[var(--nx-indigo-soft)] text-[var(--nx-indigo)]">
            <Bookmark className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[var(--nx-text-primary)]">
              أداة المزامنة السريعة من اللعبة
            </h2>
            <p className="text-xs text-[var(--nx-text-muted)]">
              اسحب زر البوك مارك لشريط الإشارات أو انسخه لاستخدامه مباشرة على متصفح الموبايل
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={SHORT_CLOUD_BOOKMARKLET}
            onClick={(e) => e.preventDefault()}
            className="nx-btn nx-btn-primary nx-btn-compact"
            title="اسحب هذا الرابط إلى شريط المفضلة"
          >
            سحب للمفضلة (TW Sync v6.0)
          </a>
          <button
            type="button"
            onClick={() => void handleCopyBookmarklet(fullBookmarkletUrl, 'البوك مارك الكامل للموبايل')}
            className="nx-btn nx-btn-outline nx-btn-compact"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            <span>نسخ للموبايل</span>
          </button>
          <button
            type="button"
            onClick={onOpenSyncModal}
            className="nx-btn nx-btn-outline nx-btn-compact"
          >
            مركز المزامنة
          </button>
        </div>
      </section>

      <IdentityGeneratorModal
        open={identityModalOpen}
        onClose={() => setIdentityModalOpen(false)}
        onSaveAccount={onSaveAccount}
        onPushToast={onPushToast}
      />

      <VirtualWorldPrepModal
        open={virtualPrepOpen}
        state={state}
        onClose={() => setVirtualPrepOpen(false)}
        onGenerate={onGenerateVirtualVillages}
        onPushToast={onPushToast}
      />
    </div>
  );
}
