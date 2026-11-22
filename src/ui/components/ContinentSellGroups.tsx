import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Coins, ExternalLink, Store, X } from 'lucide-react';
import { formatPPAndCurrency, type ErpFinance } from '../../core';
import type { ContinentSellGroup } from '../viewModels';

interface ContinentSellGroupsProps {
  groups: ContinentSellGroup[];
  finance?: Partial<ErpFinance>;
  onOpenVillageDetail: (villageId: string) => void;
}

export function ContinentSellGroups({
  groups,
  finance,
  onOpenVillageDetail
}: ContinentSellGroupsProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedKey(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedKey]);

  if (groups.length === 0) return null;

  const activeGroup = groups.find((g) => g.key === selectedKey) || null;
  const totalReadyPP = groups.reduce((s, g) => s + g.totalSellableNowPP, 0);
  const totalOpportunities = groups.reduce((s, g) => s + g.opportunityCount, 0);
  const totalReadyFmt = formatPPAndCurrency(totalReadyPP, finance, { decimals: 1, unit: 'نقطة' });

  return (
    <section aria-labelledby="continent-sell-groups-heading" className="nx-card space-y-2.5 p-3.5 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Store className="h-4 w-4 text-[var(--nx-emerald)]" aria-hidden="true" />
          <h2 id="continent-sell-groups-heading" className="text-sm font-bold text-[var(--nx-text-primary)]">
            فرص البيع حسب القارة
          </h2>
          <span className="text-xs text-[var(--nx-text-muted)]">
            · {totalOpportunities} فرصة جاهزة ({totalReadyFmt.combinedText})
          </span>
        </div>
        <span className="text-[11px] text-[var(--nx-text-muted)]">
          اختر قارة لعرض القرى الجاهزة
        </span>
      </div>

      {/* Compact Continent Tiles Grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {groups.map((grp) => {
          const isSelected = grp.key === selectedKey;
          const sellFmt = formatPPAndCurrency(grp.totalSellableNowPP, finance, {
            decimals: 1,
            unit: 'نقطة'
          });
          const statusColor =
            grp.isMarketClosed || grp.isMarketCompletelyBlocked
              ? 'text-[var(--nx-coral)]'
              : grp.opportunityCount > 0
                ? 'text-[var(--nx-emerald)]'
                : 'text-[var(--nx-text-muted)]';

          return (
            <button
              key={grp.key}
              type="button"
              onClick={() => setSelectedKey((prev) => (prev === grp.key ? null : grp.key))}
              aria-expanded={isSelected}
              className={`nx-transition flex cursor-pointer flex-col justify-between gap-1.5 rounded-[var(--nx-radius-sm)] border p-2.5 text-start ${
                isSelected
                  ? 'border-[var(--nx-indigo)] bg-[var(--nx-indigo-soft)]/50 ring-1 ring-[var(--nx-indigo)]'
                  : 'border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] hover:border-[var(--nx-border-strong)] hover:bg-[var(--nx-bg-hover)]'
              }`}
            >
              <div className="flex items-center justify-between gap-1.5">
                <div className="min-w-0 truncate">
                  <span className="font-mono-num text-xs font-bold text-[var(--nx-text-primary)]">
                    {grp.continentLabel}
                  </span>
                  <span className="ms-1 text-[11px] text-[var(--nx-text-muted)]">
                    · {grp.worldName}
                  </span>
                </div>
                <span className={`inline-flex shrink-0 items-center gap-0.5 text-[11px] font-bold ${statusColor}`}>
                  {grp.isMarketClosed
                    ? 'مغلق'
                    : grp.isMarketCompletelyBlocked
                      ? 'ممتلئ'
                      : grp.opportunityCount > 0
                        ? `${grp.opportunityCount} فرص`
                        : '0'}
                  {isSelected ? (
                    <ChevronUp className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-3 w-3" aria-hidden="true" />
                  )}
                </span>
              </div>

              <div className="font-mono-num flex items-baseline justify-between gap-1">
                <span className="text-sm font-bold text-[var(--nx-emerald)]">{sellFmt.ppText}</span>
                <span className="truncate text-[11px] text-[var(--nx-text-secondary)]">
                  {sellFmt.moneyText}
                </span>
              </div>

              <div className="font-mono-num flex items-center justify-between border-t border-[var(--nx-border)] pt-1 text-[10px] text-[var(--nx-text-muted)]">
                <span className="truncate">
                  خ {grp.sellWood} · ط {grp.sellClay} · ح {grp.sellIron}
                </span>
                <span className="shrink-0">{grp.villagesCount}ق</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Expandable Continent Village Sell List */}
      {activeGroup && (
        <div className="rounded-[var(--nx-radius-md)] border border-[var(--nx-indigo)]/35 bg-[var(--nx-bg-subtle)] p-3">
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--nx-border)] pb-2">
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-[var(--nx-indigo)]" aria-hidden="true" />
              <h3 className="text-xs font-bold text-[var(--nx-text-primary)] sm:text-sm">
                قرى قارة {activeGroup.continentLabel} ({activeGroup.worldName}) الجاهزة للبيع
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setSelectedKey(null)}
              aria-label="إغلاق تفاصيل القارة"
              className="nx-btn nx-btn-outline nx-btn-compact !min-h-[30px]"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              <span>إغلاق</span>
            </button>
          </div>

          {activeGroup.opportunityVillages.length === 0 ? (
            <p className="py-2.5 text-center text-xs text-[var(--nx-text-muted)]">
              {activeGroup.isMarketClosed
                ? 'السوق غير مبني في قرى هذه القارة.'
                : activeGroup.isMarketCompletelyBlocked
                  ? 'مخزن السوق في هذه القارة ممتلئ 100% حالياً.'
                  : 'لا توجد قرى بفائض جاهز للبيع في هذه القارة الآن.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {activeGroup.opportunityVillages.map((v) => {
                const vSellFmt = formatPPAndCurrency(v.sellableNowPP, finance, {
                  decimals: 1,
                  unit: 'نقطة'
                });
                return (
                  <div
                    key={v.villageId}
                    className="flex items-center justify-between gap-2.5 rounded-[var(--nx-radius-sm)] border border-[var(--nx-border)] bg-[var(--nx-bg-surface)] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-bold text-[var(--nx-text-primary)]">
                          {v.villageName}
                        </span>
                        <span dir="ltr" className="font-mono-num shrink-0 text-[11px] text-[var(--nx-text-muted)]">
                          {v.coord}
                        </span>
                      </div>
                      <div className="truncate text-[11px] text-[var(--nx-text-muted)]">
                        {v.accountName} · {v.freeMerchants} تاجر · {v.bestResName} ({v.bestRate})
                      </div>
                      <div className="font-mono-num text-xs font-bold text-[var(--nx-emerald)]">
                        {vSellFmt.combinedText}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenVillageDetail(v.villageId)}
                      className="nx-btn nx-btn-outline nx-btn-compact !min-h-[30px] shrink-0 !px-2.5"
                    >
                      <span>فتح</span>
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </button>
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
