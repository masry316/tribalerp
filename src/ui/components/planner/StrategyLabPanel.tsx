import { RotateCcw, Sparkles, Trophy } from 'lucide-react';
import {
  formatPPAndCurrency,
  type ErpAppState,
  type StrategyCandidateSummary,
  type TacticalSimulationResult,
  type TacticalStrategyPolicy
} from '../../../core';

interface StrategyLabPanelProps {
  simResult: TacticalSimulationResult;
  finance: ErpAppState['finance'];
  selectedPolicy: TacticalStrategyPolicy | null;
  onSelectPolicy: (policy: TacticalStrategyPolicy | null) => void;
}

export function StrategyLabPanel({
  simResult,
  finance,
  selectedPolicy,
  onSelectPolicy
}: StrategyLabPanelProps) {
  const activePolicyId = simResult.winningPolicy.id;
  const bestPP = simResult.topStrategies[0]?.totalCumulativePP ?? simResult.totalCumulativePP;

  return (
    <div
      data-testid="strategy-lab-panel"
      className="space-y-3 rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] p-3.5"
    >
      {/* Winner Telemetry Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded bg-[var(--nx-indigo-soft)] px-2 py-0.5 text-[11px] font-extrabold text-[var(--nx-indigo)]">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span data-testid="scenarios-tested-badge">
                تم فحص {simResult.scenariosTested.toLocaleString('en-US')} سيناريو مختلف
              </span>
            </span>

            {simResult.gainVsBaselinePP > 0 && (
              <span
                data-testid="gain-vs-baseline-badge"
                className="font-mono-num inline-flex items-center rounded bg-[var(--nx-emerald-bg)] px-2 py-0.5 text-[11px] font-bold text-[var(--nx-emerald)]"
              >
                +{simResult.gainVsBaselinePP.toLocaleString('en-US')} نقطة عن المسار التقليدي
              </span>
            )}

            {simResult.arbitrageBonusRes > 0 && (
              <span className="font-mono-num inline-flex items-center rounded border border-[var(--nx-border)] bg-[var(--nx-bg-surface)] px-2 py-0.5 text-[11px] font-semibold text-[var(--nx-amber)]">
                +{simResult.arbitrageBonusRes.toLocaleString('en-US')} مورد مجاني من المكافآت
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--nx-text-primary)]">
            <Trophy className="h-3.5 w-3.5 shrink-0 text-[var(--nx-amber)]" aria-hidden="true" />
            <span data-testid="active-strategy-label">
              {selectedPolicy ? 'المسار المختار:' : 'الاستراتيجية الفائزة:'}{' '}
              {simResult.winningPolicy.label}
            </span>
          </div>
          <div className="text-[11px] text-[var(--nx-text-muted)]" data-testid="active-strategy-summary">
            {simResult.actualSummary}
            {simResult.effectiveDevHours !== simResult.input.devHours
              ? ` · توقف ذكي للتطوير عند ${simResult.effectiveDevHours}س`
              : ''}
          </div>
        </div>

        {selectedPolicy && (
          <button
            type="button"
            onClick={() => onSelectPolicy(null)}
            className="nx-btn nx-btn-outline nx-btn-compact shrink-0"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>العودة للأفضل تلقائياً</span>
          </button>
        )}
      </div>

      {/* Top 5 Distinct Strategies Comparison Table */}
      {simResult.topStrategies.length > 0 && (
        <div className="overflow-x-auto rounded-[var(--nx-radius-sm)] border border-[var(--nx-border)] bg-[var(--nx-bg-surface)]">
          <table className="w-full min-w-[620px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] text-[var(--nx-text-muted)]">
                <th className="whitespace-nowrap px-2.5 py-2 text-start font-semibold">الاستراتيجية</th>
                <th className="whitespace-nowrap px-2.5 py-2 text-end font-semibold">الصافي التراكمي</th>
                <th className="whitespace-nowrap px-2.5 py-2 text-center font-semibold">المناجم (خ/ط/ح)</th>
                <th className="whitespace-nowrap px-2.5 py-2 text-center font-semibold">الجيش والإغارة</th>
                <th className="whitespace-nowrap px-2.5 py-2 text-center font-semibold">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--nx-border)]">
              {simResult.topStrategies.map((cand: StrategyCandidateSummary, idx: number) => {
                const isActive = cand.policy.id === activePolicyId;
                const ppFmt = formatPPAndCurrency(cand.totalCumulativePP, finance, {
                  decimals: 0
                });
                const deltaFromTop = cand.totalCumulativePP - bestPP;
                const armyParts: string[] = [];
                if (cand.finalSpears > 0) armyParts.push(`${cand.finalSpears} رمح`);
                if (cand.finalSwords > 0) armyParts.push(`${cand.finalSwords} سيف`);
                if (cand.finalPaladins > 0) armyParts.push('قائد');
                const armyText = armyParts.length > 0 ? armyParts.join(' · ') : 'بدون جيش';

                return (
                  <tr
                    key={cand.policy.id}
                    data-testid={`strategy-row-${idx + 1}`}
                    className={
                      isActive
                        ? 'bg-[var(--nx-indigo-soft)]/35'
                        : 'hover:bg-[var(--nx-bg-hover)]'
                    }
                  >
                    <td className="px-2.5 py-2">
                      <div className="font-bold text-[var(--nx-text-primary)]">
                        <span className="font-mono-num me-1.5 text-[11px] text-[var(--nx-text-muted)]">
                          #{idx + 1}
                        </span>
                        {cand.policy.label}
                      </div>
                      <div className="mt-0.5 text-[10.5px] text-[var(--nx-text-muted)]">
                        {cand.actualSummary}
                      </div>
                    </td>

                    <td className="font-mono-num whitespace-nowrap px-2.5 py-2 text-end">
                      <div
                        className={`font-extrabold ${
                          idx === 0
                            ? 'text-[var(--nx-emerald)]'
                            : 'text-[var(--nx-text-primary)]'
                        }`}
                      >
                        {ppFmt.ppText}
                      </div>
                      <div className="text-[10.5px] text-[var(--nx-text-muted)]">
                        {idx === 0
                          ? ppFmt.moneyText
                          : `${deltaFromTop} نقطة عن #1`}
                      </div>
                    </td>

                    <td className="font-mono-num whitespace-nowrap px-2.5 py-2 text-center font-semibold text-[var(--nx-text-primary)]">
                      {cand.woodLvl} / {cand.clayLvl} / {cand.ironLvl}
                      <div className="text-[10.5px] font-normal text-[var(--nx-text-muted)]">
                        {cand.finalHourlyMineProd.toLocaleString('en-US')} مورد/س
                      </div>
                    </td>

                    <td className="font-mono-num whitespace-nowrap px-2.5 py-2 text-center text-[var(--nx-text-secondary)]">
                      <div>{armyText}</div>
                      <div className="text-[10.5px] text-[var(--nx-text-muted)]">
                        إغارة م{cand.finalScavTier}
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-2.5 py-2 text-center">
                      {isActive ? (
                        <span className="inline-block rounded bg-[var(--nx-emerald-bg)] px-2 py-1 text-[11px] font-bold text-[var(--nx-emerald)]">
                          المسار المعتمد
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSelectPolicy(idx === 0 ? null : cand.policy)}
                          className="nx-btn nx-btn-outline nx-btn-compact"
                        >
                          اعتماد المسار
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
