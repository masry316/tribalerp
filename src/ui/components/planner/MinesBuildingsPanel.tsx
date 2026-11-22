import { Building2, Calculator } from 'lucide-react';
import {
  BUILDINGS_DATA,
  calcBuildingRange,
  formatPPAndCurrency,
  formatSecondsArabic,
  optimizeMineBudget,
  type ErpAppState,
  type MineBudgetResult,
  type SimDiscountMode
} from '../../../core';
import { NumericInput } from '../NumericInput';

export interface MineOptState {
  villageId: string;
  budgetPP: number;
  buyRate: number;
  discountMode: SimDiscountMode;
}

export interface BuildingCalcState {
  buildingName: string;
  fromLvl: number;
  toLvl: number;
  hqLvl: number;
  discountMode: SimDiscountMode;
}

interface MinesBuildingsControlsProps {
  state: ErpAppState;
  worldSpeed: number;
  mineOpt: MineOptState;
  mineResult: MineBudgetResult | null;
  onChangeMineOpt: (next: MineOptState) => void;
  onRunMineOpt: () => void;
  bldgCalc: BuildingCalcState;
  onChangeBldgCalc: (next: BuildingCalcState) => void;
}

export function MinesBuildingsControls({
  state,
  mineOpt,
  mineResult,
  onChangeMineOpt,
  onRunMineOpt,
  bldgCalc,
  onChangeBldgCalc
}: MinesBuildingsControlsProps) {
  const budgetMoney = formatPPAndCurrency(mineOpt.budgetPP, state.finance, { decimals: 0 });
  const spentFmt = mineResult
    ? formatPPAndCurrency(mineResult.spentPP, state.finance, { decimals: 1 })
    : null;
  const maxLvl = BUILDINGS_DATA[bldgCalc.buildingName]?.max_lvl ?? 30;

  return (
    <div className="space-y-4">
      {/* Section 1: Mine Budget Optimizer */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--nx-text-primary)]">
          <Calculator className="h-3.5 w-3.5 text-[var(--nx-amber)]" aria-hidden="true" />
          <span>محسن ميزانية ترقية المناجم</span>
        </div>

        <div>
          <label
            htmlFor="mine-opt-village"
            className="mb-1 block text-[11.5px] font-semibold text-[var(--nx-text-secondary)]"
          >
            القرية (أو قياسي إذا تركت فارغة)
          </label>
          <select
            id="mine-opt-village"
            value={mineOpt.villageId}
            onChange={(e) => onChangeMineOpt({ ...mineOpt, villageId: e.target.value })}
            className="nx-select nx-select-compact"
          >
            <option value="">قرية قياسية (مستوى 0/0/0)</option>
            {state.villages.map((v) => {
              const w = v.mines?.wood?.curr ?? v.buildings?.['الخشاب'] ?? 0;
              const c = v.mines?.clay?.curr ?? v.buildings?.['حفرة الطمي'] ?? 0;
              const i = v.mines?.iron?.curr ?? v.buildings?.['منجم الحديد'] ?? 0;
              return (
                <option key={v.id} value={v.id}>
                  {v.name} ({w}/{c}/{i})
                </option>
              );
            })}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label
              htmlFor="mine-opt-budget"
              className="mb-1 block text-[11.5px] font-semibold text-[var(--nx-text-secondary)]"
            >
              الميزانية (نقطة)
            </label>
            <NumericInput
              id="mine-opt-budget"
              min={0}
              integer
              fallback={0}
              value={mineOpt.budgetPP}
              onValueChange={(v) =>
                onChangeMineOpt({
                  ...mineOpt,
                  budgetPP: v
                })
              }
              className="nx-input nx-input-compact font-mono-num"
            />
            <div className="mt-0.5 text-[11px] text-[var(--nx-text-muted)]">
              ≈ {budgetMoney.moneyText}
            </div>
          </div>

          <div>
            <label
              htmlFor="mine-opt-buy-rate"
              className="mb-1 block text-[11.5px] font-semibold text-[var(--nx-text-secondary)]"
            >
              سعر الشراء / PP
            </label>
            <NumericInput
              id="mine-opt-buy-rate"
              min={1}
              integer
              fallback={64}
              value={mineOpt.buyRate}
              onValueChange={(v) =>
                onChangeMineOpt({
                  ...mineOpt,
                  buyRate: v
                })
              }
              className="nx-input nx-input-compact font-mono-num"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="mine-opt-discount"
            className="mb-1 block text-[11.5px] font-semibold text-[var(--nx-text-secondary)]"
          >
            نظام التخفيض 20% (-30 PP)
          </label>
          <select
            id="mine-opt-discount"
            value={mineOpt.discountMode}
            onChange={(e) =>
              onChangeMineOpt({
                ...mineOpt,
                discountMode: e.target.value as SimDiscountMode
              })
            }
            className="nx-select nx-select-compact"
          >
            <option value="smart">ذكي (للمستويات الموفرة فقط)</option>
            <option value="all">تفعيل التخفيض لجميع المستويات</option>
            <option value="none">بدون تخفيض</option>
          </select>
        </div>

        <button
          type="button"
          onClick={onRunMineOpt}
          className="nx-btn nx-btn-primary w-full justify-center"
        >
          حساب الترقية المثلى للمناجم
        </button>

        {mineResult && spentFmt && (
          <div
            data-testid="mine-opt-result"
            className="rounded-[var(--nx-radius-md)] border border-[var(--nx-emerald-border)] bg-[var(--nx-emerald-bg)] p-3 text-xs"
          >
            <div className="text-[11px] font-medium text-[var(--nx-text-secondary)]">
              المستويات المثلى
            </div>
            <div className="font-mono-num mt-0.5 font-bold text-[var(--nx-text-primary)]">
              خشب: {mineResult.woodLvl} | طمي: {mineResult.clayLvl} | حديد: {mineResult.ironLvl}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-1 border-t border-[var(--nx-emerald-border)] pt-2 font-mono-num font-bold text-[var(--nx-emerald)]">
              <span>التكلفة: {spentFmt.combinedText}</span>
              <span>+{mineResult.addedHourlyProd.toLocaleString('en-US')} مورد/س</span>
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Building Cost & Time Calculator */}
      <div className="space-y-2.5 border-t border-[var(--nx-border)] pt-3.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--nx-text-primary)]">
          <Building2 className="h-3.5 w-3.5 text-[var(--nx-amber)]" aria-hidden="true" />
          <span>حاسبة تكلفة وزمن المباني</span>
        </div>

        <div>
          <label
            htmlFor="bldg-calc-name"
            className="mb-1 block text-[11.5px] font-semibold text-[var(--nx-text-secondary)]"
          >
            المبنى
          </label>
          <select
            id="bldg-calc-name"
            value={bldgCalc.buildingName}
            onChange={(e) => {
              const name = e.target.value;
              const cap = BUILDINGS_DATA[name]?.max_lvl ?? 30;
              onChangeBldgCalc({
                ...bldgCalc,
                buildingName: name,
                fromLvl: Math.min(bldgCalc.fromLvl, Math.max(0, cap - 1)),
                toLvl: Math.min(Math.max(1, bldgCalc.toLvl), cap)
              });
            }}
            className="nx-select nx-select-compact"
          >
            {Object.keys(BUILDINGS_DATA).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label
              htmlFor="bldg-calc-from"
              className="mb-1 block text-[11.5px] font-semibold text-[var(--nx-text-secondary)]"
            >
              من مستوى
            </label>
            <NumericInput
              id="bldg-calc-from"
              min={0}
              max={Math.max(0, maxLvl - 1)}
              integer
              fallback={0}
              value={bldgCalc.fromLvl}
              onValueChange={(v) => {
                onChangeBldgCalc({
                  ...bldgCalc,
                  fromLvl: v,
                  toLvl: Math.max(v + 1, bldgCalc.toLvl)
                });
              }}
              className="nx-input nx-input-compact font-mono-num"
            />
          </div>

          <div>
            <label
              htmlFor="bldg-calc-to"
              className="mb-1 block text-[11.5px] font-semibold text-[var(--nx-text-secondary)]"
            >
              إلى مستوى
            </label>
            <NumericInput
              id="bldg-calc-to"
              min={1}
              max={maxLvl}
              integer
              fallback={1}
              value={bldgCalc.toLvl}
              onValueChange={(v) => onChangeBldgCalc({ ...bldgCalc, toLvl: v })}
              className="nx-input nx-input-compact font-mono-num"
            />
          </div>

          <div>
            <label
              htmlFor="bldg-calc-hq"
              className="mb-1 block text-[11.5px] font-semibold text-[var(--nx-text-secondary)]"
            >
              الرئيسي
            </label>
            <NumericInput
              id="bldg-calc-hq"
              min={1}
              max={30}
              integer
              fallback={1}
              value={bldgCalc.hqLvl}
              onValueChange={(v) =>
                onChangeBldgCalc({
                  ...bldgCalc,
                  hqLvl: v
                })
              }
              className="nx-input nx-input-compact font-mono-num"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="bldg-calc-discount"
            className="mb-1 block text-[11.5px] font-semibold text-[var(--nx-text-secondary)]"
          >
            التخفيض 20%
          </label>
          <select
            id="bldg-calc-discount"
            value={bldgCalc.discountMode}
            onChange={(e) =>
              onChangeBldgCalc({
                ...bldgCalc,
                discountMode: e.target.value as SimDiscountMode
              })
            }
            className="nx-select nx-select-compact"
          >
            <option value="smart">ذكي (الأوفر تلقائياً)</option>
            <option value="all">كل المستويات</option>
            <option value="none">بدون تخفيض</option>
          </select>
        </div>
      </div>
    </div>
  );
}

interface BuildingCalcResultsProps {
  state: ErpAppState;
  bldgCalc: BuildingCalcState;
  worldSpeed: number;
  buyRate: number;
}

export function BuildingCalcResults({
  state,
  bldgCalc,
  worldSpeed,
  buyRate
}: BuildingCalcResultsProps) {
  const calc = calcBuildingRange({
    buildingName: bldgCalc.buildingName,
    fromLvl: bldgCalc.fromLvl,
    toLvl: bldgCalc.toLvl,
    hqLvl: bldgCalc.hqLvl,
    worldSpeed,
    buyRate,
    discountMode: bldgCalc.discountMode
  });

  const ppFmt = formatPPAndCurrency(calc.totalPP, state.finance, { decimals: 1 });
  const discFmt = formatPPAndCurrency(calc.discountPP, state.finance, { decimals: 0 });

  return (
    <div className="nx-card p-4 sm:p-5" data-testid="bldg-calc-results">
      <div className="border-b border-[var(--nx-border)] pb-3">
        <h2 className="text-[16px] font-bold text-[var(--nx-text-primary)]">
          تكلفة وزمن ترقية: {calc.buildingName} (م{calc.fromLvl} ← م{calc.toLvl})
        </h2>
        <p className="mt-0.5 text-xs text-[var(--nx-text-muted)]">
          رئيسي م{calc.hqLvl} · سرعة عالم {calc.worldSpeed}x · سعر الشراء {calc.buyRate} مورد/PP
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 py-4 sm:grid-cols-4">
        <div className="space-y-0.5">
          <div className="text-[11.5px] text-[var(--nx-text-muted)]">إجمالي التكلفة</div>
          <div
            data-testid="bldg-total-res"
            className="font-mono-num text-[22px] font-bold text-[var(--nx-text-primary)]"
          >
            {calc.totalRes.toLocaleString('en-US')}
          </div>
          <div className="font-mono-num text-[11px] text-[var(--nx-text-muted)]">
            وفر {calc.savedRes.toLocaleString('en-US')} مورد
          </div>
        </div>

        <div className="space-y-0.5">
          <div className="text-[11.5px] text-[var(--nx-text-muted)]">تفصيل الموارد</div>
          <div className="font-mono-num text-[13px] font-bold text-[var(--nx-text-primary)]">
            خ {calc.totalWood.toLocaleString('en-US')}
          </div>
          <div className="font-mono-num text-[11.5px] text-[var(--nx-text-secondary)]">
            ط {calc.totalClay.toLocaleString('en-US')} · ح {calc.totalIron.toLocaleString('en-US')}
          </div>
        </div>

        <div className="space-y-0.5">
          <div className="text-[11.5px] text-[var(--nx-text-muted)]">المكافئ بالـ PP والعملة</div>
          <div
            data-testid="bldg-total-pp"
            className="font-mono-num text-[17px] font-bold leading-snug text-[var(--nx-amber)]"
          >
            {ppFmt.combinedText}
          </div>
          <div className="font-mono-num text-[11px] text-[var(--nx-text-muted)]">
            تخفيض {calc.discountLevelsCount}م ({discFmt.combinedText})
          </div>
        </div>

        <div className="space-y-0.5">
          <div className="text-[11.5px] text-[var(--nx-text-muted)]">الزمن الكلي للبناء</div>
          <div
            data-testid="bldg-total-time"
            className="font-mono-num text-[20px] font-bold text-[var(--nx-emerald)]"
          >
            {formatSecondsArabic(calc.totalBuildSec)}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[540px] border-collapse text-xs">
          <thead>
            <tr className="border-y border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] text-[var(--nx-text-muted)]">
              <th className="px-3 py-2.5 text-start font-semibold">المستوى</th>
              <th className="px-3 py-2.5 text-end font-semibold">الخشب</th>
              <th className="px-3 py-2.5 text-end font-semibold">الطمي</th>
              <th className="px-3 py-2.5 text-end font-semibold">الحديد</th>
              <th className="px-3 py-2.5 text-end font-semibold">الميزة / الإنتاج</th>
              <th className="px-3 py-2.5 text-end font-semibold">مدة البناء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--nx-border)]">
            {calc.rows.map((row) => (
              <tr key={row.lvl} className="hover:bg-[var(--nx-bg-hover)]">
                <td className="font-mono-num px-3 py-2 font-bold text-[var(--nx-text-primary)]">
                  م{row.lvl}
                  {row.usedDiscount && (
                    <span className="ms-1.5 rounded bg-[var(--nx-emerald-bg)] px-1 py-0.5 text-[10px] font-semibold text-[var(--nx-emerald)]">
                      -20%
                    </span>
                  )}
                </td>
                <td className="font-mono-num px-3 py-2 text-end text-[var(--nx-text-secondary)]">
                  {row.wood.toLocaleString('en-US')}
                </td>
                <td className="font-mono-num px-3 py-2 text-end text-[var(--nx-text-secondary)]">
                  {row.clay.toLocaleString('en-US')}
                </td>
                <td className="font-mono-num px-3 py-2 text-end text-[var(--nx-text-secondary)]">
                  {row.iron.toLocaleString('en-US')}
                </td>
                <td className="font-mono-num px-3 py-2 text-end text-[var(--nx-text-primary)]">
                  {row.prop}
                </td>
                <td className="font-mono-num px-3 py-2 text-end text-[var(--nx-text-secondary)]">
                  {formatSecondsArabic(row.durSec)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function computeMineBudgetForSelection(
  state: ErpAppState,
  mineOpt: MineOptState,
  worldSpeed: number
): MineBudgetResult {
  const vil = mineOpt.villageId
    ? state.villages.find((v) => v.id === mineOpt.villageId)
    : undefined;
  const startWood = vil ? Number(vil.mines?.wood?.curr ?? vil.buildings?.['الخشاب'] ?? 0) : 0;
  const startClay = vil ? Number(vil.mines?.clay?.curr ?? vil.buildings?.['حفرة الطمي'] ?? 0) : 0;
  const startIron = vil ? Number(vil.mines?.iron?.curr ?? vil.buildings?.['منجم الحديد'] ?? 0) : 0;
  const wObj = vil ? state.worlds.find((w) => w.id === vil.worldId) : undefined;

  return optimizeMineBudget({
    startWood,
    startClay,
    startIron,
    budgetPP: mineOpt.budgetPP,
    buyRate: mineOpt.buyRate,
    discountMode: mineOpt.discountMode,
    worldSpeed: Number(wObj?.speed || worldSpeed || 1),
    premPct: vil?.premium ? Number(state.gameRules?.premPct ?? 20) : 0,
    flagPct: vil ? Number(vil.flag || 0) : 0,
    boost30: Boolean(vil?.boost30)
  });
}
