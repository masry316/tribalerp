import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Cloud,
  Coins,
  Download,
  Globe,
  Lock,
  Moon,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Sun,
  Trash2,
  Unlock,
  Upload
} from 'lucide-react';
import {
  estimateWorldTotalPP,
  FIXED_CONTINENTS,
  formatPPAndCurrency,
  type CurrencyCode,
  type ErpAppState,
  type ErpFinance,
  type ErpGameRules
} from '../../core';
import type { MutationResult } from '../../data';
import type { ContinentRatesInput, WorldInput } from '../../validation';
import { FieldError, FormErrorsBanner } from '../components/FieldError';
import { NumericInput } from '../components/NumericInput';
import { StatusNotice } from '../components/UiPrimitives';

interface SettingsPageProps {
  state: ErpAppState;
  theme: 'dark' | 'light';
  fontSize: number;
  onChangeTheme: (theme: 'dark' | 'light') => void;
  onChangeFontSize: (px: number) => void;
  onSaveWorld: (input: Partial<WorldInput>) => MutationResult;
  onSetWorldTradeEnded: (
    worldId: string,
    tradeEnded: boolean,
    customTotalPP?: number | null
  ) => MutationResult;
  onDeleteWorld: (worldId: string) => MutationResult;
  onUpdateContinentRates: (worldId: string, ratesInput: Partial<ContinentRatesInput>) => MutationResult;
  onUpdateSettings: (patch: {
    gameRules?: Partial<ErpGameRules>;
    finance?: Partial<ErpFinance>;
  }) => MutationResult;
  onExportBackup: () => void;
  onImportBackupJson: (raw: string) => MutationResult;
  onResetWorkspace: () => void;
  onRefreshData: () => Promise<void> | void;
  onForceCloudSync: () => Promise<void> | void;
  onOpenSyncModal: () => void;
  onPushToast: (msg: string, tone?: 'info' | 'success' | 'warn' | 'danger') => void;
}

export function SettingsPage({
  state,
  theme,
  fontSize,
  onChangeTheme,
  onChangeFontSize,
  onSaveWorld,
  onSetWorldTradeEnded,
  onDeleteWorld,
  onUpdateContinentRates,
  onUpdateSettings,
  onExportBackup,
  onImportBackupJson,
  onResetWorkspace,
  onRefreshData,
  onForceCloudSync,
  onOpenSyncModal,
  onPushToast
}: SettingsPageProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 1. Finance state
  const [currency, setCurrency] = useState<CurrencyCode>(state.finance.currency || 'EGP');
  const [bundlePoints, setBundlePoints] = useState(String(state.finance.bundlePoints || 10000));
  const [bundleEGP, setBundleEGP] = useState(String(state.finance.bundleEGP || 2500));
  const [bundleUSD, setBundleUSD] = useState(String(state.finance.bundleUSD || 50));

  // 2. Worlds & Continent rates state
  const [selectedWorldId, setSelectedWorldId] = useState(state.worlds[0]?.id || '');
  const activeWorld = state.worlds.find((w) => w.id === selectedWorldId) || state.worlds[0];
  const [newWorldName, setNewWorldName] = useState('');
  const [newWorldSpeed, setNewWorldSpeed] = useState('1');
  const [worldErrors, setWorldErrors] = useState<Record<string, string> | null>(null);

  // Selected world edit / lifecycle state
  const [editWorldName, setEditWorldName] = useState(activeWorld?.name || '');
  const [editWorldSpeed, setEditWorldSpeed] = useState(String(activeWorld?.speed ?? 1));
  const [editWorldSummaryPP, setEditWorldSummaryPP] = useState(
    activeWorld?.tradeSummaryPP !== undefined && activeWorld?.tradeSummaryPP !== null
      ? String(activeWorld.tradeSummaryPP)
      : ''
  );
  const [editWorldErrors, setEditWorldErrors] = useState<Record<string, string> | null>(null);
  const [confirmDeleteWorldId, setConfirmDeleteWorldId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeWorld) {
      setSelectedWorldId('');
      setEditWorldName('');
      setEditWorldSpeed('1');
      setEditWorldSummaryPP('');
      setConfirmDeleteWorldId(null);
      return;
    }
    if (selectedWorldId !== activeWorld.id) {
      setSelectedWorldId(activeWorld.id);
    }
    setEditWorldName(activeWorld.name || '');
    setEditWorldSpeed(String(activeWorld.speed ?? 1));
    setEditWorldSummaryPP(
      activeWorld.tradeSummaryPP !== undefined && activeWorld.tradeSummaryPP !== null
        ? String(activeWorld.tradeSummaryPP)
        : ''
    );
    setEditWorldErrors(null);
    setConfirmDeleteWorldId(null);
  }, [activeWorld?.id, activeWorld?.name, activeWorld?.speed, activeWorld?.tradeSummaryPP, selectedWorldId]);

  // 3. Alert Thresholds state
  const [critHours, setCritHours] = useState(String(state.gameRules.critHours ?? 2));
  const [warnHours, setWarnHours] = useState(String(state.gameRules.warnHours ?? 5));
  const [freeFinishSec, setFreeFinishSec] = useState(String(state.gameRules.freeFinishSec ?? 180));

  // 4. Backup / Feedback state
  const [confirmReset, setConfirmReset] = useState(false);
  const [errors, setErrors] = useState<Record<string, string> | null>(null);
  const [statusMsg, setStatusMsg] = useState('');

  function handleSaveFinance(e: FormEvent) {
    e.preventDefault();
    setErrors(null);
    setStatusMsg('');
    const res = onUpdateSettings({
      finance: {
        currency,
        bundlePoints: Number(bundlePoints),
        bundleEGP: Number(bundleEGP),
        bundleUSD: Number(bundleUSD)
      }
    });
    if (!res.ok) {
      setErrors(res.errors || { form: 'تعذر حفظ إعدادات التسعير.' });
      return;
    }
    setStatusMsg('تم حفظ إعدادات المصرف وتسعير نقاط التميز.');
    onPushToast('تم تحديث أسعار صرف النقاط', 'success');
  }

  function handleAddWorld(e: FormEvent) {
    e.preventDefault();
    setWorldErrors(null);
    const res = onSaveWorld({
      name: newWorldName.trim(),
      speed: Number(newWorldSpeed) || 1
    });
    if (!res.ok) {
      setWorldErrors(res.errors || { name: 'تعذر إضافة العالم.' });
      return;
    }
    const created = res.state.worlds[res.state.worlds.length - 1];
    if (created) setSelectedWorldId(created.id);
    setNewWorldName('');
    setNewWorldSpeed('1');
    onPushToast('تمت إضافة العالم الجديد بنجاح', 'success');
  }

  function handleUpdateActiveWorld(e: FormEvent) {
    e.preventDefault();
    if (!activeWorld) return;
    setEditWorldErrors(null);
    const parsedSummary =
      editWorldSummaryPP.trim() === '' ? activeWorld.tradeSummaryPP : Math.max(0, Math.round(Number(editWorldSummaryPP) || 0));
    const res = onSaveWorld({
      id: activeWorld.id,
      name: editWorldName.trim(),
      speed: Number(editWorldSpeed),
      tradeEnded: activeWorld.tradeEnded,
      tradeSummaryPP: parsedSummary
    });
    if (!res.ok) {
      setEditWorldErrors(res.errors || { name: 'تعذر حفظ تعديلات العالم.' });
      return;
    }
    onPushToast(`تم تحديث بيانات ${editWorldName.trim()} (سرعة ${Number(editWorldSpeed)}x)`, 'success');
  }

  function handleToggleTradeEnded(nextEnded: boolean) {
    if (!activeWorld) return;
    const customPP =
      nextEnded && editWorldSummaryPP.trim() !== ''
        ? Math.max(0, Math.round(Number(editWorldSummaryPP) || 0))
        : undefined;
    const res = onSetWorldTradeEnded(activeWorld.id, nextEnded, customPP);
    if (!res.ok) {
      onPushToast(Object.values(res.errors || {})[0] || 'تعذر تحديث حالة التجارة', 'danger');
      return;
    }
    if (nextEnded) {
      onPushToast(
        `تم إعلان انتهاء التجارة في ${activeWorld.name}: الصرف ممتلئ ومغلق (0 متوقع) وإشعارات العالم مخفية`,
        'warn'
      );
    } else {
      onPushToast(`تم إعادة فتح التجارة في ${activeWorld.name}`, 'success');
    }
  }

  function handleSaveWorldSummaryPP() {
    if (!activeWorld) return;
    const val = Math.max(0, Math.round(Number(editWorldSummaryPP) || 0));
    const res = onSaveWorld({
      id: activeWorld.id,
      name: activeWorld.name,
      speed: activeWorld.speed,
      tradeEnded: activeWorld.tradeEnded,
      tradeSummaryPP: val
    });
    if (!res.ok) {
      onPushToast('تعذر حفظ إجمالي نقاط العالم', 'danger');
      return;
    }
    onPushToast(`تم تسجيل ${val.toLocaleString('en-US')} نقطة لإجمالي أرباح ${activeWorld.name}`, 'success');
  }

  function handleConfirmDeleteWorld(worldId: string) {
    const target = state.worlds.find((w) => w.id === worldId);
    const res = onDeleteWorld(worldId);
    if (!res.ok) {
      onPushToast(Object.values(res.errors || {})[0] || 'تعذر حذف العالم', 'danger');
      setConfirmDeleteWorldId(null);
      return;
    }
    const nextWorld = res.state.worlds[0];
    setSelectedWorldId(nextWorld?.id || '');
    setConfirmDeleteWorldId(null);
    onPushToast(`تم حذف ${target?.name || 'العالم'} نهائياً`, 'warn');
  }

  function handleContinentField(
    continent: string,
    field:
      | 'sellWood'
      | 'sellClay'
      | 'sellIron'
      | 'buyRate'
      | 'stockWood'
      | 'stockClay'
      | 'stockIron'
      | 'capWood'
      | 'capClay'
      | 'capIron',
    rawVal: string
  ) {
    if (!activeWorld) return;
    const prev = activeWorld.continents?.[continent] || {
      sellRate: 64,
      buyRate: 64,
      sellWood: 64,
      sellClay: 64,
      sellIron: 64,
      lastUpdated: null
    };
    const nextNum = Math.max(0, Number(rawVal) || 0);
    const nextRates: ContinentRatesInput = {
      continent,
      sellRate: prev.sellRate || 64,
      buyRate: field === 'buyRate' ? Math.max(1, nextNum) : prev.buyRate || 64,
      sellWood: field === 'sellWood' ? Math.max(64, nextNum) : prev.sellWood || 64,
      sellClay: field === 'sellClay' ? Math.max(64, nextNum) : prev.sellClay || 64,
      sellIron: field === 'sellIron' ? Math.max(64, nextNum) : prev.sellIron || 64,
      stockWood: field === 'stockWood' ? nextNum : prev.stockWood,
      stockClay: field === 'stockClay' ? nextNum : prev.stockClay,
      stockIron: field === 'stockIron' ? nextNum : prev.stockIron,
      capWood: field === 'capWood' ? nextNum : prev.capWood,
      capClay: field === 'capClay' ? nextNum : prev.capClay,
      capIron: field === 'capIron' ? nextNum : prev.capIron
    };
    onUpdateContinentRates(activeWorld.id, nextRates);
  }

  function handleSaveThresholds(e: FormEvent) {
    e.preventDefault();
    setErrors(null);
    setStatusMsg('');
    const res = onUpdateSettings({
      gameRules: {
        critHours: Number(critHours),
        warnHours: Number(warnHours),
        freeFinishSec: Number(freeFinishSec)
      }
    });
    if (!res.ok) {
      setErrors(res.errors || { form: 'تعذر حفظ حدود التنبيهات.' });
      return;
    }
    setStatusMsg('تم حفظ حدود التنبيهات وإعدادات البناء.');
    onPushToast('تم حفظ قواعد التنبيهات والمظهر', 'success');
  }

  function handleImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || '');
      const res = onImportBackupJson(raw);
      if (!res.ok) {
        onPushToast(Object.values(res.errors || {})[0] || 'ملف النسخة الاحتياطية غير صالح', 'danger');
      } else {
        onPushToast('تم استيراد النسخة الاحتياطية بنجاح', 'success');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-[var(--nx-text-primary)]">
            الإعدادات والأسعار
          </h1>
          <p className="text-xs text-[var(--nx-text-muted)]">
            تسعير النقاط، العوالم وأسعار الصرف بالقارات، المظهر وحدود التنبيهات، والمزامنة السحابية
          </p>
        </div>
      </div>

      <FormErrorsBanner errors={errors} />
      <StatusNotice message={statusMsg} />

      {/* Section 1: Finance & PP Pricing */}
      <section className="nx-card p-5">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-[var(--nx-radius-sm)] bg-[var(--nx-indigo-soft)] text-[var(--nx-indigo)]">
            <Coins className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--nx-text-primary)]">
              المصرف وتسعير النقاط (PP)
            </h2>
            <p className="text-xs text-[var(--nx-text-muted)]">
              تسعير حزمة النقاط لتحويل صافي أرباح اللعبة إلى العملة المالية تلقائياً
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveFinance} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="set-currency" className="mb-1 block text-xs font-semibold text-[var(--nx-text-secondary)]">
              العملة الأساسية
            </label>
            <select
              id="set-currency"
              className="nx-select w-full"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
            >
              <option value="EGP">جنيه مصري (EGP)</option>
              <option value="USD">دولار أمريكي (USD)</option>
            </select>
          </div>

          <div>
            <label htmlFor="set-bundle-pts" className="mb-1 block text-xs font-semibold text-[var(--nx-text-secondary)]">
              حجم الحزمة (PP)
            </label>
            <input
              id="set-bundle-pts"
              type="text"
              inputMode="numeric"
              dir="ltr"
              className="nx-input font-mono-num w-full"
              value={bundlePoints}
              onChange={(e) => setBundlePoints(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="set-bundle-egp" className="mb-1 block text-xs font-semibold text-[var(--nx-text-secondary)]">
              سعر الحزمة (ج.م)
            </label>
            <input
              id="set-bundle-egp"
              type="text"
              inputMode="decimal"
              dir="ltr"
              className="nx-input font-mono-num w-full"
              value={bundleEGP}
              onChange={(e) => setBundleEGP(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="set-bundle-usd" className="mb-1 block text-xs font-semibold text-[var(--nx-text-secondary)]">
              سعر الحزمة (USD)
            </label>
            <input
              id="set-bundle-usd"
              type="text"
              inputMode="decimal"
              dir="ltr"
              className="nx-input font-mono-num w-full"
              value={bundleUSD}
              onChange={(e) => setBundleUSD(e.target.value)}
            />
          </div>

          {(() => {
            const draftFinance: Partial<ErpFinance> = {
              currency,
              bundlePoints: Math.max(1, Number(bundlePoints) || 10000),
              bundleEGP: Math.max(0, Number(bundleEGP) || 0),
              bundleUSD: Math.max(0, Number(bundleUSD) || 0)
            };
            const p10k = formatPPAndCurrency(10000, draftFinance, { decimals: 0, unit: 'نقطة' });
            const p100 = formatPPAndCurrency(100, draftFinance, { decimals: 0, unit: 'نقطة' });
            return (
              <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] px-3.5 py-2.5">
                <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--nx-text-secondary)]">
                  <span>معاينة التسعير:</span>
                  <strong className="font-mono-num text-[var(--nx-indigo)]">{p10k.combinedText}</strong>
                  <span aria-hidden="true" className="text-[var(--nx-text-subtle)]">·</span>
                  <strong className="font-mono-num text-[var(--nx-text-primary)]">{p100.combinedText}</strong>
                </div>
                <button type="submit" className="nx-btn nx-btn-primary nx-btn-compact">
                  <Save className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>حفظ تسعير النقاط</span>
                </button>
              </div>
            );
          })()}
        </form>
      </section>

      {/* Section 2: Worlds & Continent Rates */}
      <section className="nx-card space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-[var(--nx-radius-sm)] bg-[var(--nx-bg-subtle)] text-[var(--nx-teal)]">
              <Globe className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--nx-text-primary)]">
                إدارة العوالم وأسعار الصرف (K44 – K55)
              </h2>
              <p className="text-xs text-[var(--nx-text-muted)]">
                اختر أي عالم لتعديل اسمه وسرعته، إنهاء التجارة فيه لإخفاء إشعاراته، أو حذفه وضبط أسعار القارات
              </p>
            </div>
          </div>

          <select
            aria-label="اختيار العالم النشط"
            value={activeWorld?.id || ''}
            onChange={(e) => setSelectedWorldId(e.target.value)}
            className="nx-select nx-select-compact min-w-[180px] !w-auto"
          >
            {state.worlds.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.speed}x){w.tradeEnded ? ' — انتهت التجارة' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* All Worlds Overview Cards */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3" data-testid="worlds-overview-list">
          {state.worlds.map((w) => {
            const isSelected = activeWorld?.id === w.id;
            const worldVils = state.villages.filter((v) => v.worldId === w.id);
            const accCount = new Set(worldVils.map((v) => v.accountId)).size;
            const est = estimateWorldTotalPP(state, w.id);
            const totalPP =
              w.tradeSummaryPP !== undefined && w.tradeSummaryPP !== null
                ? Number(w.tradeSummaryPP)
                : est.totalPP;
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => setSelectedWorldId(w.id)}
                data-testid={`world-card-${w.id}`}
                className={`nx-transition flex cursor-pointer flex-col gap-2 rounded-[var(--nx-radius-md)] border p-3 text-start ${
                  isSelected
                    ? 'border-[var(--nx-indigo)] bg-[var(--nx-indigo-soft)]/45'
                    : 'border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] hover:bg-[var(--nx-bg-hover)]'
                }`}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-bold text-[var(--nx-text-primary)]">{w.name}</span>
                    <span className="font-mono-num shrink-0 rounded-[var(--nx-radius-xs)] bg-[var(--nx-bg-surface)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--nx-indigo)]">
                      {w.speed}x
                    </span>
                  </div>
                  <span
                    className={`shrink-0 rounded-[var(--nx-radius-xs)] px-2 py-0.5 text-[10.5px] font-bold ${
                      w.tradeEnded
                        ? 'bg-[var(--nx-coral-bg)] text-[var(--nx-coral)]'
                        : 'bg-[var(--nx-emerald-bg)] text-[var(--nx-emerald)]'
                    }`}
                  >
                    {w.tradeEnded ? 'انتهت التجارة' : 'تجارة نشطة'}
                  </span>
                </div>
                <div className="flex w-full items-center justify-between text-[11.5px] text-[var(--nx-text-muted)]">
                  <span>{accCount} حساب · {worldVils.length} قرية</span>
                  <span className="font-mono-num font-semibold text-[var(--nx-text-secondary)]">
                    {Math.round(totalPP).toLocaleString('en-US')} PP
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected World Management Box */}
        {activeWorld && (() => {
          const linkedVillagesCount = state.villages.filter((v) => v.worldId === activeWorld.id).length;
          const autoEst = estimateWorldTotalPP(state, activeWorld.id);
          const canDeleteWorld = state.worlds.length > 1;
          return (
            <div
              data-testid="active-world-editor"
              className="space-y-3.5 rounded-[var(--nx-radius-md)] border border-[var(--nx-border-strong)] bg-[var(--nx-bg-subtle)] p-4"
            >
              {/* Edit Name & Speed */}
              <form
                onSubmit={handleUpdateActiveWorld}
                className="flex flex-wrap items-end gap-3 border-b border-[var(--nx-border)] pb-3.5"
              >
                <div className="min-w-[170px] flex-1">
                  <label
                    htmlFor="edit-world-name"
                    className="mb-1 block text-xs font-semibold text-[var(--nx-text-secondary)]"
                  >
                    اسم العالم المحدد
                  </label>
                  <input
                    id="edit-world-name"
                    className="nx-input nx-input-compact w-full"
                    value={editWorldName}
                    onChange={(e) => setEditWorldName(e.target.value)}
                  />
                  <FieldError message={editWorldErrors?.name} />
                </div>

                <div className="w-32">
                  <label
                    htmlFor="edit-world-speed"
                    className="mb-1 block text-xs font-semibold text-[var(--nx-text-secondary)]"
                  >
                    سرعة العالم (x)
                  </label>
                  <input
                    id="edit-world-speed"
                    type="text"
                    inputMode="decimal"
                    dir="ltr"
                    className="nx-input nx-input-compact font-mono-num w-full"
                    value={editWorldSpeed}
                    onChange={(e) => setEditWorldSpeed(e.target.value)}
                  />
                  <FieldError message={editWorldErrors?.speed} />
                </div>

                <button
                  type="submit"
                  data-testid="save-world-details-btn"
                  className="nx-btn nx-btn-primary nx-btn-compact"
                >
                  <Save className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>حفظ بيانات العالم</span>
                </button>
              </form>

              {/* Trade Lifecycle & Delete Controls */}
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex-1 space-y-2">
                  {activeWorld.tradeEnded ? (
                    <div className="space-y-2.5 rounded-[var(--nx-radius-sm)] border border-[var(--nx-coral-border)] bg-[var(--nx-coral-bg)]/50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-[var(--nx-coral)]">
                          <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span>انتهت التجارة في {activeWorld.name} — الصرف مغلق (0 متوقع) وإشعاراته مخفية</span>
                        </div>
                        <button
                          type="button"
                          data-testid="reopen-trade-btn"
                          onClick={() => handleToggleTradeEnded(false)}
                          className="nx-btn nx-btn-outline nx-btn-compact"
                        >
                          <Unlock className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>إعادة فتح التجارة</span>
                        </button>
                      </div>

                      <div className="flex flex-wrap items-end gap-2 pt-1">
                        <div className="min-w-[180px] flex-1 max-w-xs">
                          <label
                            htmlFor="edit-world-summary-pp"
                            className="mb-1 block text-[11px] font-semibold text-[var(--nx-text-secondary)]"
                          >
                            إجمالي النقاط المحققة من هذا العالم (لمقارنة التقارير)
                          </label>
                          <input
                            id="edit-world-summary-pp"
                            type="text"
                            inputMode="numeric"
                            dir="ltr"
                            placeholder={String(autoEst.totalPP)}
                            className="nx-input nx-input-compact font-mono-num w-full"
                            value={editWorldSummaryPP}
                            onChange={(e) => setEditWorldSummaryPP(e.target.value)}
                          />
                        </div>
                        <button
                          type="button"
                          data-testid="save-world-summary-pp-btn"
                          onClick={handleSaveWorldSummaryPP}
                          className="nx-btn nx-btn-primary nx-btn-compact"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>حفظ النقاط للتقرير</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--nx-radius-sm)] border border-[var(--nx-border)] bg-[var(--nx-bg-surface)] p-3">
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-[var(--nx-text-primary)]">
                          حالة التجارة: نشطة حالياً
                        </div>
                        <p className="text-[11px] text-[var(--nx-text-muted)]">
                          عند تفعيل «انتهت التجارة» يتم ملء وإغلاق الصرف تلقائياً (0 نقاط متوقعة)، إخفاء كل إشعارات العالم، وحفظ إجمالي نقاطه للمقارنة في التقارير.
                        </p>
                      </div>
                      <button
                        type="button"
                        data-testid="toggle-trade-ended-btn"
                        onClick={() => handleToggleTradeEnded(true)}
                        className="nx-btn nx-btn-compact shrink-0 border border-[var(--nx-amber-border)] bg-[var(--nx-amber-bg)] text-[var(--nx-amber)] hover:opacity-90"
                      >
                        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>انتهت التجارة</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Inline 2-step Delete World */}
                <div className="flex shrink-0 items-center justify-end gap-2">
                  {confirmDeleteWorldId !== activeWorld.id ? (
                    <button
                      type="button"
                      data-testid="delete-world-btn"
                      disabled={!canDeleteWorld}
                      title={!canDeleteWorld ? 'يجب بقاء عالم واحد على الأقل' : `حذف ${activeWorld.name}`}
                      onClick={() => setConfirmDeleteWorldId(activeWorld.id)}
                      className="nx-btn nx-btn-compact border border-[var(--nx-coral-border)] bg-[var(--nx-coral-bg)] text-[var(--nx-coral)]"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>حذف العالم</span>
                    </button>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 rounded-[var(--nx-radius-sm)] border border-[var(--nx-coral-border)] bg-[var(--nx-coral-bg)] px-2.5 py-1.5">
                      <span className="flex items-center gap-1 text-[11px] font-bold text-[var(--nx-coral)]">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>
                          سيُحذف {activeWorld.name}
                          {linkedVillagesCount > 0 ? ` و${linkedVillagesCount} قرية مرتبطة` : ''}
                        </span>
                      </span>
                      <button
                        type="button"
                        data-testid="confirm-delete-world-btn"
                        onClick={() => handleConfirmDeleteWorld(activeWorld.id)}
                        className="nx-btn nx-btn-compact border-[var(--nx-coral)] bg-[var(--nx-coral)] text-white"
                      >
                        تأكيد الحذف
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteWorldId(null)}
                        className="nx-btn nx-btn-outline nx-btn-compact"
                      >
                        إلغاء
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {activeWorld?.tradeEnded && (
          <div className="flex items-center gap-2 rounded-[var(--nx-radius-sm)] border border-[var(--nx-amber-border)] bg-[var(--nx-amber-bg)] px-3 py-2 text-xs font-semibold text-[var(--nx-amber)]">
            <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              التجارة منتهية في هذا العالم — البورصة مغلقة بالكامل في جميع القارات الأربع (0 نقاط متوقعة). يمكنك إعادة فتح التجارة من الأعلى عند الحاجة.
            </span>
          </div>
        )}

        {activeWorld && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FIXED_CONTINENTS.map((cont) => {
              const r = activeWorld.continents?.[cont];
              const hWood = r?.capWood ? Math.max(0, r.capWood - (r.stockWood || 0)) : Infinity;
              const hClay = r?.capClay ? Math.max(0, r.capClay - (r.stockClay || 0)) : Infinity;
              const hIron = r?.capIron ? Math.max(0, r.capIron - (r.stockIron || 0)) : Infinity;
              const isFull =
                Boolean(activeWorld.tradeEnded) ||
                Boolean(r?.isMarketClosed) ||
                (r?.capWood && hWood <= 0) ||
                (r?.capClay && hClay <= 0) ||
                (r?.capIron && hIron <= 0);

              return (
                <div
                  key={cont}
                  className="rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] p-3 space-y-2.5"
                >
                  <div className="flex items-center justify-between border-b border-[var(--nx-border)] pb-1.5">
                    <span className="text-xs font-bold text-[var(--nx-text-primary)]">قارة K{cont}</span>
                    <div className="flex items-center gap-1.5">
                      {isFull && (
                        <span className="rounded-[var(--nx-radius-xs)] bg-[var(--nx-coral-bg)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--nx-coral)]">
                          ممتلئ
                        </span>
                      )}
                      <span className="font-mono-num text-[11px] text-[var(--nx-text-muted)]">
                        شراء: {r?.buyRate ?? 64}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-[var(--nx-text-secondary)]">أسعار الصرف (مورد / PP):</span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="mb-0.5 block text-[10.5px] text-[var(--nx-text-muted)]">بيع خشب</label>
                        <NumericInput
                          min={1}
                          integer
                          fallback={64}
                          className="nx-input nx-input-compact font-mono-num w-full"
                          value={r?.sellWood ?? r?.sellRate ?? 64}
                          onValueChange={(v) => handleContinentField(cont, 'sellWood', String(v))}
                        />
                      </div>
                      <div>
                        <label className="mb-0.5 block text-[10.5px] text-[var(--nx-text-muted)]">بيع طمي</label>
                        <NumericInput
                          min={1}
                          integer
                          fallback={64}
                          className="nx-input nx-input-compact font-mono-num w-full"
                          value={r?.sellClay ?? r?.sellRate ?? 64}
                          onValueChange={(v) => handleContinentField(cont, 'sellClay', String(v))}
                        />
                      </div>
                      <div>
                        <label className="mb-0.5 block text-[10.5px] text-[var(--nx-text-muted)]">بيع حديد</label>
                        <NumericInput
                          min={1}
                          integer
                          fallback={64}
                          className="nx-input nx-input-compact font-mono-num w-full"
                          value={r?.sellIron ?? r?.sellRate ?? 64}
                          onValueChange={(v) => handleContinentField(cont, 'sellIron', String(v))}
                        />
                      </div>
                      <div>
                        <label className="mb-0.5 block text-[10.5px] text-[var(--nx-text-muted)]">سعر الشراء</label>
                        <NumericInput
                          min={1}
                          integer
                          fallback={64}
                          className="nx-input nx-input-compact font-mono-num w-full"
                          value={r?.buyRate ?? 64}
                          onValueChange={(v) => handleContinentField(cont, 'buyRate', String(v))}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Market Stock & Capacity Controls */}
                  <div className="space-y-1 border-t border-[var(--nx-border)]/70 pt-2">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-[var(--nx-text-secondary)]">سعة ومخزون البورصة:</span>
                      <span className="text-[9.5px] text-[var(--nx-text-muted)]">(المخزون / السعة)</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                      <div>
                        <label className="mb-0.5 block truncate text-[9.5px] text-[var(--nx-text-muted)]">خشب (م/س)</label>
                        <NumericInput
                          min={0}
                          integer
                          allowEmpty
                          placeholder="مخزون"
                          className="nx-input nx-input-compact font-mono-num w-full text-[10px]"
                          value={r?.stockWood ?? ''}
                          onValueChange={(v) => handleContinentField(cont, 'stockWood', String(v))}
                          onEmptyChange={() => handleContinentField(cont, 'stockWood', '')}
                        />
                        <NumericInput
                          min={0}
                          integer
                          allowEmpty
                          placeholder="سعة"
                          className="nx-input nx-input-compact font-mono-num mt-1 w-full text-[10px]"
                          value={r?.capWood ?? ''}
                          onValueChange={(v) => handleContinentField(cont, 'capWood', String(v))}
                          onEmptyChange={() => handleContinentField(cont, 'capWood', '')}
                        />
                      </div>
                      <div>
                        <label className="mb-0.5 block truncate text-[9.5px] text-[var(--nx-text-muted)]">طمي (م/س)</label>
                        <NumericInput
                          min={0}
                          integer
                          allowEmpty
                          placeholder="مخزون"
                          className="nx-input nx-input-compact font-mono-num w-full text-[10px]"
                          value={r?.stockClay ?? ''}
                          onValueChange={(v) => handleContinentField(cont, 'stockClay', String(v))}
                          onEmptyChange={() => handleContinentField(cont, 'stockClay', '')}
                        />
                        <NumericInput
                          min={0}
                          integer
                          allowEmpty
                          placeholder="سعة"
                          className="nx-input nx-input-compact font-mono-num mt-1 w-full text-[10px]"
                          value={r?.capClay ?? ''}
                          onValueChange={(v) => handleContinentField(cont, 'capClay', String(v))}
                          onEmptyChange={() => handleContinentField(cont, 'capClay', '')}
                        />
                      </div>
                      <div>
                        <label className="mb-0.5 block truncate text-[9.5px] text-[var(--nx-text-muted)]">حديد (م/س)</label>
                        <NumericInput
                          min={0}
                          integer
                          allowEmpty
                          placeholder="مخزون"
                          className="nx-input nx-input-compact font-mono-num w-full text-[10px]"
                          value={r?.stockIron ?? ''}
                          onValueChange={(v) => handleContinentField(cont, 'stockIron', String(v))}
                          onEmptyChange={() => handleContinentField(cont, 'stockIron', '')}
                        />
                        <NumericInput
                          min={0}
                          integer
                          allowEmpty
                          placeholder="سعة"
                          className="nx-input nx-input-compact font-mono-num mt-1 w-full text-[10px]"
                          value={r?.capIron ?? ''}
                          onValueChange={(v) => handleContinentField(cont, 'capIron', String(v))}
                          onEmptyChange={() => handleContinentField(cont, 'capIron', '')}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <form onSubmit={handleAddWorld} className="flex flex-wrap items-end gap-2 border-t border-[var(--nx-border)] pt-3">
          <div className="min-w-[160px] flex-1">
            <label htmlFor="new-world-name" className="mb-1 block text-xs font-semibold text-[var(--nx-text-secondary)]">
              اسم العالم الجديد
            </label>
            <input
              id="new-world-name"
              className="nx-input nx-input-compact w-full"
              placeholder="مثال: عالم 95"
              value={newWorldName}
              onChange={(e) => setNewWorldName(e.target.value)}
            />
            <FieldError message={worldErrors?.name} />
          </div>
          <div className="w-28">
            <label htmlFor="new-world-speed" className="mb-1 block text-xs font-semibold text-[var(--nx-text-secondary)]">
              السرعة
            </label>
            <input
              id="new-world-speed"
              type="text"
              inputMode="decimal"
              dir="ltr"
              className="nx-input nx-input-compact font-mono-num w-full"
              value={newWorldSpeed}
              onChange={(e) => setNewWorldSpeed(e.target.value)}
            />
          </div>
          <button type="submit" className="nx-btn nx-btn-outline nx-btn-compact">
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>إضافة عالم</span>
          </button>
        </form>
      </section>

      {/* Section 3: Appearance & Alert Thresholds */}
      <section className="nx-card space-y-4 p-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-[var(--nx-radius-sm)] bg-[var(--nx-amber-bg)] text-[var(--nx-amber)]">
            <Bell className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--nx-text-primary)]">
              المظهر وحدود التنبيهات
            </h2>
            <p className="text-xs text-[var(--nx-text-muted)]">
              تخصيص الثيم النهاري/الليلي، حجم الخط العام، وحدود إنذار امتلاء المخازن
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--nx-text-primary)]">المظهر العام</span>
              <div className="inline-flex rounded-[var(--nx-radius-sm)] border border-[var(--nx-border)] bg-[var(--nx-bg-surface)] p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => onChangeTheme('light')}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-[4px] px-3 py-1 font-semibold ${
                    theme === 'light'
                      ? 'bg-[var(--nx-indigo)] text-white'
                      : 'text-[var(--nx-text-muted)]'
                  }`}
                >
                  <Sun className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>نهاري</span>
                </button>
                <button
                  type="button"
                  onClick={() => onChangeTheme('dark')}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-[4px] px-3 py-1 font-semibold ${
                    theme === 'dark'
                      ? 'bg-[var(--nx-indigo)] text-white'
                      : 'text-[var(--nx-text-muted)]'
                  }`}
                >
                  <Moon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>ليلي</span>
                </button>
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <label htmlFor="set-font-size" className="font-semibold text-[var(--nx-text-secondary)]">
                  حجم الخط الأساسي
                </label>
                <span className="font-mono-num font-bold text-[var(--nx-indigo)]">{fontSize}px</span>
              </div>
              <input
                id="set-font-size"
                type="range"
                min={13}
                max={18}
                step={1}
                value={fontSize}
                onChange={(e) => onChangeFontSize(Number(e.target.value))}
                className="w-full accent-[var(--nx-indigo)]"
              />
            </div>
          </div>

          <form onSubmit={handleSaveThresholds} className="grid grid-cols-3 gap-3 items-end">
            <div>
              <label htmlFor="set-crit-hrs" className="mb-1 block text-xs font-semibold text-[var(--nx-text-secondary)]">
                تنبيه حرج (س)
              </label>
              <input
                id="set-crit-hrs"
                type="text"
                inputMode="decimal"
                dir="ltr"
                className="nx-input font-mono-num w-full"
                value={critHours}
                onChange={(e) => setCritHours(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="set-warn-hrs" className="mb-1 block text-xs font-semibold text-[var(--nx-text-secondary)]">
                تنبيه تحذير (س)
              </label>
              <input
                id="set-warn-hrs"
                type="text"
                inputMode="decimal"
                dir="ltr"
                className="nx-input font-mono-num w-full"
                value={warnHours}
                onChange={(e) => setWarnHours(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="set-free-sec" className="mb-1 block text-xs font-semibold text-[var(--nx-text-secondary)]">
                إنهاء مجاني (ث)
              </label>
              <input
                id="set-free-sec"
                type="text"
                inputMode="numeric"
                dir="ltr"
                className="nx-input font-mono-num w-full"
                value={freeFinishSec}
                onChange={(e) => setFreeFinishSec(e.target.value)}
              />
            </div>
            <div className="col-span-3 flex justify-end">
              <button type="submit" className="nx-btn nx-btn-primary nx-btn-compact">
                <Save className="h-3.5 w-3.5" aria-hidden="true" />
                <span>حفظ حدود التنبيهات</span>
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Section 4: Cloud Sync & Backup */}
      <section className="nx-card space-y-4 p-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-[var(--nx-radius-sm)] bg-[var(--nx-bg-subtle)] text-[var(--nx-indigo)]">
            <Cloud className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--nx-text-primary)]">
              المزامنة السحابية والنسخ الاحتياطي
            </h2>
            <p className="text-xs text-[var(--nx-text-muted)]">
              يتم حفظ البيانات محلياً في المتصفح (IndexedDB + localStorage) لتقليل قراءات Firestore — اضغط «تحديث الداتا» يدوياً لسحب التحديثات السحابية
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => void onRefreshData()}
            className="nx-btn nx-btn-primary nx-btn-compact"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>تحديث الداتا من السحابة</span>
          </button>

          <button
            type="button"
            onClick={() => void onForceCloudSync()}
            className="nx-btn nx-btn-outline nx-btn-compact"
          >
            <Cloud className="h-3.5 w-3.5" aria-hidden="true" />
            <span>حفظ ورفع للسحابة</span>
          </button>

          <button
            type="button"
            onClick={onOpenSyncModal}
            className="nx-btn nx-btn-outline nx-btn-compact"
          >
            أدوات الربط والبوك مارك
          </button>

          <button
            type="button"
            onClick={onExportBackup}
            className="nx-btn nx-btn-outline nx-btn-compact"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>تصدير نسخة JSON</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="nx-btn nx-btn-outline nx-btn-compact"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            <span>استيراد نسخة JSON</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportFile}
            className="hidden"
          />

          <div className="ms-auto">
            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="nx-btn nx-btn-compact border-[var(--nx-coral-border)] bg-[var(--nx-coral-bg)] text-[var(--nx-coral)]"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>إعادة ضبط مساحة العمل</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onResetWorkspace();
                    setConfirmReset(false);
                    onPushToast('تمت إعادة ضبط مساحة العمل', 'warn');
                  }}
                  className="nx-btn nx-btn-compact border-[var(--nx-coral)] bg-[var(--nx-coral)] text-white"
                >
                  تأكيد المسح وإعادة الضبط
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="nx-btn nx-btn-outline nx-btn-compact"
                >
                  إلغاء
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
