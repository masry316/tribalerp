import { Swords } from 'lucide-react';
import {
  calcScavDispatch,
  formatSecondsArabic,
  type ErpAppState,
  type ScavAllocItem
} from '../../../core';
import { NumericInput } from '../NumericInput';

export interface ScavCalcState {
  villageId: string;
  unlockedTiers: number;
  scavMode: 'max_profit' | 'min_logins';
  activeHrs: number;
  maxCycleHrs: number;
  worldSpeed: number;
  spear: number;
  sword: number;
  axe: number;
  archer: number;
  light: number;
  marcher: number;
  heavy: number;
  knight: number;
}

export function createInitialScavCalcState(state: ErpAppState): ScavCalcState {
  return {
    villageId: '',
    unlockedTiers: 4,
    scavMode: state.asimConfig?.scavMode === 'min_logins' ? 'min_logins' : 'max_profit',
    activeHrs: Number(state.asimConfig?.activeHrs || 12),
    maxCycleHrs: Number(state.asimConfig?.sessionHrs || 2),
    worldSpeed: Number(state.asimConfig?.worldSpeed || 1),
    spear: 100,
    sword: 20,
    axe: 0,
    archer: 0,
    light: 20,
    marcher: 0,
    heavy: 0,
    knight: 0
  };
}

function formatAllocUnits(a: ScavAllocItem): string {
  const parts: string[] = [];
  if (a.kn > 0) parts.push(`${a.kn} قائد`);
  if (a.lc > 0) parts.push(`${a.lc} خفيف`);
  if (a.ma > 0) parts.push(`${a.ma} قوس خيل`);
  if (a.hc > 0) parts.push(`${a.hc} ثقيل`);
  if (a.sp > 0) parts.push(`${a.sp} رمح`);
  if (a.sw > 0) parts.push(`${a.sw} سيف`);
  if (a.ax > 0) parts.push(`${a.ax} فأس`);
  if (a.ar > 0) parts.push(`${a.ar} قوس`);
  return parts.length > 0 ? parts.join(' + ') : '—';
}

interface ScavengingCalcControlsProps {
  state: ErpAppState;
  value: ScavCalcState;
  onChange: (next: ScavCalcState) => void;
}

export function ScavengingCalcControls({
  state,
  value,
  onChange
}: ScavengingCalcControlsProps) {
  const handleSelectVillage = (vilId: string) => {
    if (!vilId) {
      onChange({ ...value, villageId: '' });
      return;
    }
    const vil = state.villages.find((v) => v.id === vilId);
    if (!vil) {
      onChange({ ...value, villageId: '' });
      return;
    }
    const world = state.worlds.find((w) => w.id === vil.worldId);
    const uTot = vil.unitsTotal || vil.scavData?.unitsTotal || {};
    const unlocked = Math.max(
      1,
      Math.min(4, Number(vil.unlockedScavTiers || vil.scavData?.unlockedScavTiers || 4))
    );
    onChange({
      ...value,
      villageId: vil.id,
      unlockedTiers: unlocked,
      worldSpeed: Number(world?.speed || value.worldSpeed || 1),
      spear: Number(uTot.spear ?? vil.spearsTotal ?? 0),
      sword: Number(uTot.sword ?? vil.swordsTotal ?? 0),
      axe: Number(uTot.axe ?? vil.axesTotal ?? 0),
      archer: Number(uTot.archer ?? 0),
      light: Number(uTot.light ?? vil.lightsTotal ?? 0),
      marcher: Number(uTot.marcher ?? 0),
      heavy: Number(uTot.heavy ?? vil.heaviesTotal ?? 0),
      knight: Number(uTot.knight ?? 0)
    });
  };

  const numField = (
    id: string,
    label: string,
    field: keyof ScavCalcState,
    step: string = '1',
    disabled = false
  ) => (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-[11.5px] font-semibold text-[var(--nx-text-secondary)]"
      >
        {label}
      </label>
      <NumericInput
        id={id}
        min={0}
        allowDecimal={step !== '1'}
        integer={step === '1'}
        fallback={0}
        disabled={disabled}
        value={value[field] as number}
        onValueChange={(v) =>
          onChange({
            ...value,
            [field]: v
          })
        }
        className="nx-input nx-input-compact font-mono-num disabled:opacity-55"
      />
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--nx-text-primary)]">
        <Swords className="h-3.5 w-3.5 text-[var(--nx-amber)]" aria-hidden="true" />
        <span>استيراد جيش أو ضبط يدوي للإغارة</span>
      </div>

      <div>
        <label
          htmlFor="scav-import-village"
          className="mb-1 block text-[11.5px] font-semibold text-[var(--nx-text-secondary)]"
        >
          استيراد من قرية مسجلة
        </label>
        <select
          id="scav-import-village"
          value={value.villageId}
          onChange={(e) => handleSelectVillage(e.target.value)}
          className="nx-select nx-select-compact"
        >
          <option value="">-- إدخال يدوي حر --</option>
          {state.villages.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} {v.coord ? `(${v.coord})` : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label
            htmlFor="scav-unlocked-tiers"
            className="mb-1 block text-[11.5px] font-semibold text-[var(--nx-text-secondary)]"
          >
            القنوات المفتوحة
          </label>
          <select
            id="scav-unlocked-tiers"
            value={value.unlockedTiers}
            onChange={(e) =>
              onChange({ ...value, unlockedTiers: Number(e.target.value) || 4 })
            }
            className="nx-select nx-select-compact"
          >
            <option value={4}>كل المستويات (75%)</option>
            <option value={3}>حتى المستوى 3 (50%)</option>
            <option value={2}>حتى المستوى 2 (25%)</option>
            <option value={1}>المستوى 1 فقط (10%)</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="scav-dist-mode"
            className="mb-1 block text-[11.5px] font-semibold text-[var(--nx-text-secondary)]"
          >
            أسلوب التوزيع
          </label>
          <select
            id="scav-dist-mode"
            value={value.scavMode}
            onChange={(e) =>
              onChange({
                ...value,
                scavMode: e.target.value === 'min_logins' ? 'min_logins' : 'max_profit'
              })
            }
            className="nx-select nx-select-compact"
          >
            <option value="max_profit">أقصى عائد (دورة ساعتين)</option>
            <option value="min_logins">أقل عدد دخولات (حسب الدورة)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {numField('scav-active-hrs', 'النشاط اليومي (س)', 'activeHrs', '0.5')}
        {numField(
          'scav-max-cycle',
          value.scavMode === 'max_profit' ? 'الدورة (2س افتراضي)' : 'دورة الإغارة (س)',
          'maxCycleHrs',
          '0.5',
          value.scavMode === 'max_profit'
        )}
        {numField('scav-world-speed', 'سرعة العالم', 'worldSpeed', '0.1')}
      </div>

      <div className="border-t border-[var(--nx-border)] pt-2.5">
        <div className="mb-2 text-[11.5px] font-bold text-[var(--nx-text-muted)]">
          عدد الوحدات المتاحة
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {numField('scav-u-spear', 'رمح (25)', 'spear')}
          {numField('scav-u-sword', 'سيف (15)', 'sword')}
          {numField('scav-u-axe', 'فأس (10)', 'axe')}
          {numField('scav-u-archer', 'قوس (10)', 'archer')}
          {numField('scav-u-light', 'خفيف (80)', 'light')}
          {numField('scav-u-marcher', 'قوس خيل (50)', 'marcher')}
          {numField('scav-u-heavy', 'ثقيل (50)', 'heavy')}
          {numField('scav-u-knight', 'قائد (100)', 'knight')}
        </div>
      </div>
    </div>
  );
}

interface ScavengingCalcResultsProps {
  value: ScavCalcState;
}

export function ScavengingCalcResults({ value }: ScavengingCalcResultsProps) {
  const res = calcScavDispatch(
    value.spear,
    value.sword,
    value.unlockedTiers,
    value.maxCycleHrs,
    value.activeHrs,
    value.worldSpeed,
    value.scavMode,
    1,
    value.axe,
    0,
    value.light,
    value.heavy,
    value.archer,
    value.marcher,
    value.knight
  );

  const modeLabel =
    value.scavMode === 'min_logins'
      ? `أقل عدد دخولات (دورة ${value.maxCycleHrs}س)`
      : 'أقصى عائد (تعبئة أعلى فئة حتى ساعتين)';

  // Ensure all 4 tiers are always visible (locked or 0-cap show as —)
  const tierDefs = [
    { tier: 4, name: 'الإغارة 4 — العظام (75%)' },
    { tier: 3, name: 'الإغارة 3 — الأذكياء (50%)' },
    { tier: 2, name: 'الإغارة 2 — المتواضعون (25%)' },
    { tier: 1, name: 'الإغارة 1 — الكسالى (10%)' }
  ];

  return (
    <div className="nx-card p-4 sm:p-5" data-testid="scav-calc-results">
      <div className="border-b border-[var(--nx-border)] pb-3">
        <h2 className="text-[16px] font-bold text-[var(--nx-text-primary)]">
          مخرجات حاسبة الإغارات (T4 ← T1)
        </h2>
        <p className="mt-0.5 text-xs text-[var(--nx-text-muted)]">
          إجمالي الحمولة: {res.totalCap.toLocaleString('en-US')} مورد · {value.unlockedTiers} قنوات نشطة · {modeLabel}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 py-4 sm:grid-cols-4">
        <div className="space-y-0.5">
          <div className="text-[11.5px] text-[var(--nx-text-muted)]">الغنيمة / جولة</div>
          <div
            data-testid="scav-loot-per-run"
            className="font-mono-num text-[22px] font-bold text-[var(--nx-emerald)]"
          >
            {res.lootPerRun.toLocaleString('en-US')}
          </div>
          <div className="font-mono-num text-[11px] text-[var(--nx-text-muted)]">
            {res.wLoot.toLocaleString('en-US')} خ · {res.cLoot.toLocaleString('en-US')} ط · {res.iLoot.toLocaleString('en-US')} ح
          </div>
        </div>

        <div className="space-y-0.5">
          <div className="text-[11.5px] text-[var(--nx-text-muted)]">الغنيمة اليومية</div>
          <div
            data-testid="scav-daily-loot"
            className="font-mono-num text-[22px] font-bold text-[var(--nx-amber)]"
          >
            {res.dailyLoot.toLocaleString('en-US')}
          </div>
          <div className="font-mono-num text-[11px] text-[var(--nx-text-muted)]">
            {res.runsPerDay} جولة/يوم
          </div>
        </div>

        <div className="space-y-0.5">
          <div className="text-[11.5px] text-[var(--nx-text-muted)]">الصافي / ساعة</div>
          <div className="font-mono-num text-[22px] font-bold text-[var(--nx-text-primary)]">
            {Math.round(res.effHourly).toLocaleString('en-US')}
          </div>
          <div className="font-mono-num text-[11px] text-[var(--nx-text-muted)]">
            {Math.round(res.eachHr).toLocaleString('en-US')} لكل مورد/س
          </div>
        </div>

        <div className="space-y-0.5">
          <div className="text-[11.5px] text-[var(--nx-text-muted)]">أطول مدة جولة</div>
          <div className="font-mono-num text-[20px] font-bold text-[var(--nx-text-primary)]">
            {res.maxRunSec > 0 ? formatSecondsArabic(res.maxRunSec) : '—'}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-xs">
          <thead>
            <tr className="border-y border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] text-[var(--nx-text-muted)]">
              <th className="px-3 py-2.5 text-start font-semibold">الفئة</th>
              <th className="px-3 py-2.5 text-start font-semibold">الوحدات الموزعة</th>
              <th className="px-3 py-2.5 text-end font-semibold">الحمولة</th>
              <th className="px-3 py-2.5 text-end font-semibold">الغنيمة</th>
              <th className="px-3 py-2.5 text-end font-semibold">المدة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--nx-border)]">
            {tierDefs.map((td) => {
              const alloc = res.allocs.find((a) => a.tier === td.tier);
              const isLocked = td.tier > value.unlockedTiers;
              return (
                <tr key={td.tier} className={isLocked ? 'opacity-45' : ''}>
                  <td className="px-3 py-2.5 font-bold text-[var(--nx-text-primary)]">
                    {td.name}
                  </td>
                  <td className="px-3 py-2.5 text-[var(--nx-text-secondary)]">
                    {isLocked ? 'مغلقة' : alloc ? formatAllocUnits(alloc) : '—'}
                  </td>
                  <td className="font-mono-num px-3 py-2.5 text-end font-semibold text-[var(--nx-text-primary)]">
                    {alloc ? alloc.cap.toLocaleString('en-US') : '0'}
                  </td>
                  <td className="font-mono-num px-3 py-2.5 text-end font-bold text-[var(--nx-emerald)]">
                    +{alloc ? alloc.loot.toLocaleString('en-US') : '0'}
                  </td>
                  <td className="font-mono-num px-3 py-2.5 text-end text-[var(--nx-text-secondary)]">
                    {alloc && alloc.durSec > 0 ? formatSecondsArabic(alloc.durSec) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
