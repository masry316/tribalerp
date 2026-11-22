import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Hammer,
  Save,
  Shield,
  Target,
  Trash2
} from 'lucide-react';
import {
  computeMissionBriefingForVillage,
  computeVillageLiveStatus,
  FIXED_CONTINENTS,
  type AssignedPlan,
  type ErpAppState,
  type VillageRole
} from '../../../core';
import type { MutationResult } from '../../../data';
import type { VillageInput } from '../../../validation';
import { FieldError, FormErrorsBanner } from '../FieldError';
import { BaseModal } from './BaseModal';

interface VillageModalProps {
  creatingVillage: boolean;
  editingVillageId: string | null;
  missionVillageId: string | null;
  state: ErpAppState;
  onCloseEdit: () => void;
  onCloseMission: () => void;
  onSaveVillage: (input: Partial<VillageInput>) => MutationResult;
  onDeleteVillage: (villageId: string) => MutationResult;
  onAssignPlan: (villageId: string, plan: AssignedPlan | null) => MutationResult;
  onOpenVillageDetail: (villageId: string) => void;
  onPushToast: (msg: string, tone?: 'info' | 'success' | 'warn' | 'danger') => void;
}

export function VillageModal({
  creatingVillage,
  editingVillageId,
  missionVillageId,
  state,
  onCloseEdit,
  onCloseMission,
  onSaveVillage,
  onDeleteVillage,
  onAssignPlan,
  onOpenVillageDetail,
  onPushToast
}: VillageModalProps) {
  const isEditOpen = creatingVillage || Boolean(editingVillageId);
  const existing = state.villages.find((v) => v.id === editingVillageId) || null;
  const missionVillage = state.villages.find((v) => v.id === missionVillageId) || null;

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errors, setErrors] = useState<Record<string, string> | null>(null);

  const [name, setName] = useState('');
  const [coord, setCoord] = useState('500|500');
  const [accountId, setAccountId] = useState('');
  const [worldId, setWorldId] = useState('w_94');
  const [continent, setContinent] = useState('44');
  const [villageRole, setVillageRole] = useState<VillageRole>('unset');
  const [warehouseLevel, setWarehouseLevel] = useState('1');
  const [woodStock, setWoodStock] = useState('500');
  const [clayStock, setClayStock] = useState('500');
  const [ironStock, setIronStock] = useState('500');
  const [wCurr, setWCurr] = useState('0');
  const [cCurr, setCCurr] = useState('0');
  const [iCurr, setICurr] = useState('0');
  const [farmLevel, setFarmLevel] = useState('1');
  const [marketLevel, setMarketLevel] = useState('0');
  const [flag, setFlag] = useState('0');
  const [spearsTotal, setSpearsTotal] = useState('0');
  const [swordsTotal, setSwordsTotal] = useState('0');
  const [axesTotal, setAxesTotal] = useState('0');
  const [lightsTotal, setLightsTotal] = useState('0');
  const [heaviesTotal, setHeaviesTotal] = useState('0');
  const [unlockedScavTiers, setUnlockedScavTiers] = useState('0');
  const [premium, setPremium] = useState(false);
  const [boost30, setBoost30] = useState(false);

  const liveTotalArmyCap = useMemo(() => {
    const sp = Math.max(0, Number(spearsTotal) || 0);
    const sw = Math.max(0, Number(swordsTotal) || 0);
    const ax = Math.max(0, Number(axesTotal) || 0);
    const lc = Math.max(0, Number(lightsTotal) || 0);
    const hc = Math.max(0, Number(heaviesTotal) || 0);
    return sp * 25 + sw * 15 + ax * 10 + lc * 80 + hc * 50;
  }, [spearsTotal, swordsTotal, axesTotal, lightsTotal, heaviesTotal]);

  useEffect(() => {
    if (!isEditOpen) return;
    setConfirmDelete(false);
    setErrors(null);
    if (creatingVillage) {
      setName('');
      setCoord('500|500');
      setAccountId(state.userAccounts[0]?.id || '');
      setWorldId(state.worlds[0]?.id || 'w_94');
      setContinent('44');
      setVillageRole('unset');
      setWarehouseLevel('1');
      setWoodStock('500');
      setClayStock('500');
      setIronStock('500');
      setWCurr('0');
      setCCurr('0');
      setICurr('0');
      setFarmLevel('1');
      setMarketLevel('0');
      setFlag('0');
      setSpearsTotal('0');
      setSwordsTotal('0');
      setAxesTotal('0');
      setLightsTotal('0');
      setHeaviesTotal('0');
      setUnlockedScavTiers('0');
      setPremium(false);
      setBoost30(false);
    } else if (existing) {
      setName(existing.name);
      setCoord(existing.coord || '500|500');
      setAccountId(existing.accountId);
      setWorldId(existing.worldId);
      setContinent(existing.continent || '44');
      setVillageRole(existing.villageRole === 'offense' || existing.villageRole === 'defense' ? existing.villageRole : 'unset');
      setWarehouseLevel(String(existing.warehouse?.level || 1));
      setWoodStock(String(Math.round(existing.warehouse?.woodStock || 0)));
      setClayStock(String(Math.round(existing.warehouse?.clayStock || 0)));
      setIronStock(String(Math.round(existing.warehouse?.ironStock || 0)));
      setWCurr(String(existing.mines?.wood?.curr || 0));
      setCCurr(String(existing.mines?.clay?.curr || 0));
      setICurr(String(existing.mines?.iron?.curr || 0));
      setFarmLevel(String(existing.farmLevel || 1));
      setMarketLevel(String(existing.marketLevel || 0));
      setFlag(String(existing.flag || 0));
      setSpearsTotal(String(existing.spearsTotal ?? existing.unitsTotal?.spear ?? 0));
      setSwordsTotal(String(existing.swordsTotal ?? existing.unitsTotal?.sword ?? 0));
      setAxesTotal(String(existing.axesTotal ?? existing.unitsTotal?.axe ?? 0));
      setLightsTotal(String(existing.lightsTotal ?? existing.unitsTotal?.light ?? 0));
      setHeaviesTotal(String(existing.heaviesTotal ?? existing.unitsTotal?.heavy ?? 0));
      setUnlockedScavTiers(String(existing.unlockedScavTiers ?? 0));
      setPremium(Boolean(existing.premium));
      setBoost30(Boolean(existing.boost30));
    }
  }, [isEditOpen, creatingVillage, existing, state.userAccounts, state.worlds]);

  const missionEval = useMemo(() => {
    if (!missionVillage) return null;
    const live = computeVillageLiveStatus(missionVillage, state, Date.now());
    const briefing = computeMissionBriefingForVillage(missionVillage, state, live);
    return { live, briefing };
  }, [missionVillage, state]);

  function handleSubmitVillage(e: FormEvent) {
    e.preventDefault();
    setErrors(null);
    const res = onSaveVillage({
      id: existing?.id,
      villageId: existing?.villageId || '',
      name: name.trim(),
      coord: coord.trim() || '500|500',
      accountId: accountId || state.userAccounts[0]?.id || '',
      worldId: worldId || state.worlds[0]?.id || 'w_94',
      continent,
      villageRole,
      flag: Math.max(0, Number(flag) || 0),
      woodItem: existing?.woodItem || 0,
      clayItem: existing?.clayItem || 0,
      ironItem: existing?.ironItem || 0,
      premium,
      boost30,
      warehouseLevel: Math.max(1, Math.min(30, Number(warehouseLevel) || 1)),
      marketLevel: Math.max(0, Math.min(25, Number(marketLevel) || 0)),
      farmLevel: Math.max(1, Math.min(30, Number(farmLevel) || 1)),
      woodLevel: Math.max(0, Math.min(30, Number(wCurr) || 0)),
      clayLevel: Math.max(0, Math.min(30, Number(cCurr) || 0)),
      ironLevel: Math.max(0, Math.min(30, Number(iCurr) || 0)),
      woodStock: Math.max(0, Number(woodStock) || 0),
      clayStock: Math.max(0, Number(clayStock) || 0),
      ironStock: Math.max(0, Number(ironStock) || 0),
      spearsTotal: Math.max(0, Math.round(Number(spearsTotal) || 0)),
      swordsTotal: Math.max(0, Math.round(Number(swordsTotal) || 0)),
      axesTotal: Math.max(0, Math.round(Number(axesTotal) || 0)),
      lightsTotal: Math.max(0, Math.round(Number(lightsTotal) || 0)),
      heaviesTotal: Math.max(0, Math.round(Number(heaviesTotal) || 0)),
      unlockedScavTiers: Math.max(0, Math.min(4, Math.round(Number(unlockedScavTiers) || 0)))
    });

    if (!res.ok) {
      setErrors(res.errors || { form: 'يرجى التحقق من الحقول المطلوبة.' });
      return;
    }

    onPushToast(creatingVillage ? 'تمت إضافة القرية بنجاح' : 'تم حفظ بيانات القرية', 'success');
    onCloseEdit();
  }

  if (missionVillage && missionEval) {
    const { briefing } = missionEval;
    const pct =
      briefing.totalSteps > 0
        ? Math.round((briefing.completedStepsCount / briefing.totalSteps) * 100)
        : 0;

    return (
      <BaseModal
        open={Boolean(missionVillage)}
        onClose={onCloseMission}
        ariaLabel={`توجيه المهمة · ${missionVillage.name}`}
        title={`توجيه المهمة · ${missionVillage.name}`}
        subtitle={briefing.hasPlan ? briefing.planName : 'بدون خطة بناء مسندة'}
        icon={<Target className="h-5 w-5" aria-hidden="true" />}
        bodyClassName="flex-1 space-y-4 overflow-y-auto p-5"
        headerActions={
          <button
            type="button"
            onClick={() => {
              const id = missionVillage.id;
              onCloseMission();
              onOpenVillageDetail(id);
            }}
            className="nx-btn nx-btn-outline nx-btn-compact"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            <span>غرفة القرية</span>
          </button>
        }
        footer={
          <div className="flex justify-end">
            <button type="button" onClick={onCloseMission} className="nx-btn nx-btn-outline nx-btn-compact px-5">
              إغلاق
            </button>
          </div>
        }
      >
            {!briefing.hasAnyImmediateAction ? (
              <div className="rounded-[var(--nx-radius-md)] border border-[var(--nx-emerald-border)] bg-[var(--nx-emerald-bg)] p-4 text-sm font-semibold text-[var(--nx-emerald)]">
                {briefing.closeAndReopenMessage}
              </div>
            ) : (
              <div className="rounded-[var(--nx-radius-md)] border border-[var(--nx-amber-border)] bg-[var(--nx-amber-bg)] p-3.5 text-sm font-semibold text-[var(--nx-amber)]">
                توجد إجراءات مطلوبة الآن في القرية قبل إغلاق الحساب.
              </div>
            )}

            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5 rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] p-3.5 text-xs">
                <Shield className="mt-0.5 h-4 w-4 shrink-0 text-[var(--nx-indigo)]" aria-hidden="true" />
                <div className="space-y-0.5">
                  <div className="font-bold text-[var(--nx-text-primary)]">حالة الإغارات</div>
                  <div className="text-[var(--nx-text-secondary)]">{briefing.scavengeSummary}</div>
                </div>
              </div>

              {briefing.shouldSellMarket && (
                <div className="rounded-[var(--nx-radius-md)] border border-[var(--nx-indigo)]/40 bg-[var(--nx-indigo-soft)] p-3.5 text-xs font-semibold text-[var(--nx-indigo)]">
                  {briefing.marketSummary}
                </div>
              )}
            </div>

            {briefing.hasPlan && (
              <div className="space-y-3 rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] p-4">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>
                    تقدم الخطة ({briefing.completedStepsCount} / {briefing.totalSteps})
                  </span>
                  <span className="font-mono-num">{pct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--nx-bg-muted)]">
                  <div className="h-full rounded-full bg-[var(--nx-indigo)]" style={{ width: `${pct}%` }} />
                </div>

                {briefing.readyStepsNow.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold text-[var(--nx-emerald)]">
                      خطوات جاهزة للتنفيذ الآن:
                    </div>
                    {briefing.readyStepsNow.map((s, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 rounded-[var(--nx-radius-sm)] bg-[var(--nx-emerald-bg)] px-3 py-2 text-xs font-medium text-[var(--nx-emerald)]"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>
                          {s.bName} (م{s.targetLvl})
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {briefing.nextWaitingStep && (
                  <div className="flex items-center justify-between gap-2 rounded-[var(--nx-radius-sm)] bg-[var(--nx-bg-subtle)] px-3 py-2.5 text-xs">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <Clock className="h-3.5 w-3.5 text-[var(--nx-text-muted)]" aria-hidden="true" />
                      <span>
                        الخطوة التالية: {briefing.nextWaitingStep.bName} (م{briefing.nextWaitingStep.targetLvl})
                      </span>
                    </span>
                    <span className="font-bold text-[var(--nx-indigo)]">{briefing.nextStepReadyText}</span>
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onAssignPlan(missionVillage.id, null);
                      onPushToast('تم إلغاء إسناد الخطة عن القرية', 'info');
                    }}
                    className="nx-btn nx-btn-outline nx-btn-compact border-[var(--nx-coral-border)] text-[var(--nx-coral)]"
                  >
                    إزالة الخطة عن القرية
                  </button>
                </div>
              </div>
            )}
      </BaseModal>
    );
  }

  if (!isEditOpen) return null;

  return (
    <BaseModal
      open={isEditOpen}
      onClose={onCloseEdit}
      ariaLabel={creatingVillage ? 'إضافة قرية جديدة' : 'تعديل القرية'}
      title={creatingVillage ? 'إضافة قرية جديدة' : `تعديل قرية · ${existing?.name || ''}`}
      icon={<Hammer className="h-5 w-5" aria-hidden="true" />}
      maxWidthClass="max-w-2xl"
      bodyClassName="flex flex-1 flex-col overflow-hidden"
      headerActions={
        existing ? (
          <button
            type="button"
            onClick={() => {
              const id = existing.id;
              onCloseEdit();
              onOpenVillageDetail(id);
            }}
            className="nx-btn nx-btn-outline nx-btn-compact"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            <span>غرفة القرية</span>
          </button>
        ) : undefined
      }
    >
      <form onSubmit={handleSubmitVillage} noValidate className="flex-1 space-y-4 overflow-y-auto p-5">
          <FormErrorsBanner errors={errors} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="space-y-1 text-xs font-medium text-[var(--nx-text-secondary)]">
              <span>اسم القرية</span>
              <input
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="nx-input w-full"
              />
              <FieldError message={errors?.name} />
            </label>
            <label className="space-y-1 text-xs font-medium text-[var(--nx-text-secondary)]">
              <span>الإحداثيات</span>
              <input
                type="text"
                dir="ltr"
                value={coord}
                onChange={(e) => setCoord(e.target.value)}
                className="nx-input font-mono-num w-full"
              />
              <FieldError message={errors?.coord} />
            </label>
            <label className="space-y-1 text-xs font-medium text-[var(--nx-text-secondary)]">
              <span>قنوات الإغارة المفتوحة</span>
              <input
                type="text"
                inputMode="numeric"
                dir="ltr"
                min={0}
                max={4}
                value={unlockedScavTiers}
                onChange={(e) => setUnlockedScavTiers(e.target.value)}
                className="nx-input font-mono-num w-full"
              />
            </label>

            <label className="space-y-1 text-xs font-medium text-[var(--nx-text-secondary)]">
              <span>الحساب</span>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="nx-select w-full cursor-pointer"
              >
                {state.userAccounts.length === 0 ? (
                  <option value="">لا توجد حسابات — أضف حساباً أولاً</option>
                ) : (
                  state.userAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))
                )}
              </select>
              <FieldError message={errors?.accountId} />
            </label>
            <label className="space-y-1 text-xs font-medium text-[var(--nx-text-secondary)]">
              <span>العالم</span>
              <select
                value={worldId}
                onChange={(e) => setWorldId(e.target.value)}
                className="nx-select w-full cursor-pointer"
              >
                {state.worlds.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-[var(--nx-text-secondary)]">
              <span>القارة</span>
              <select
                value={continent}
                onChange={(e) => setContinent(e.target.value)}
                className="nx-select w-full cursor-pointer"
              >
                {FIXED_CONTINENTS.map((c) => (
                  <option key={c} value={c}>
                    قارة K{c}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-[var(--nx-text-secondary)] sm:col-span-3">
              <span>نوع القرية (لون التمييز على الخريطة)</span>
              <select
                value={villageRole}
                onChange={(e) => setVillageRole(e.target.value as VillageRole)}
                className="nx-select w-full cursor-pointer"
              >
                <option value="unset">غير محددة (أصفر)</option>
                <option value="offense">قرية هجوم (أحمر)</option>
                <option value="defense">قرية دفاع (أزرق)</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="space-y-1 text-xs font-medium text-[var(--nx-text-secondary)]">
              <span>المخازن (م)</span>
              <input
                type="text"
                inputMode="numeric"
                dir="ltr"
                min={1}
                max={30}
                value={warehouseLevel}
                onChange={(e) => setWarehouseLevel(e.target.value)}
                className="nx-input font-mono-num w-full"
              />
            </label>
            <label className="space-y-1 text-xs font-medium text-[var(--nx-text-secondary)]">
              <span>مخزون الخشب</span>
              <input
                type="text"
                inputMode="numeric"
                dir="ltr"
                min={0}
                value={woodStock}
                onChange={(e) => setWoodStock(e.target.value)}
                className="nx-input font-mono-num w-full"
              />
            </label>
            <label className="space-y-1 text-xs font-medium text-[var(--nx-text-secondary)]">
              <span>مخزون الطمي</span>
              <input
                type="text"
                inputMode="numeric"
                dir="ltr"
                min={0}
                value={clayStock}
                onChange={(e) => setClayStock(e.target.value)}
                className="nx-input font-mono-num w-full"
              />
            </label>
            <label className="space-y-1 text-xs font-medium text-[var(--nx-text-secondary)]">
              <span>مخزون الحديد</span>
              <input
                type="text"
                inputMode="numeric"
                dir="ltr"
                min={0}
                value={ironStock}
                onChange={(e) => setIronStock(e.target.value)}
                className="nx-input font-mono-num w-full"
              />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            <label className="space-y-1 text-xs font-medium text-[var(--nx-text-secondary)]">
              <span>الخشاب</span>
              <input
                type="text"
                inputMode="numeric"
                dir="ltr"
                min={0}
                max={30}
                value={wCurr}
                onChange={(e) => setWCurr(e.target.value)}
                className="nx-input font-mono-num w-full"
              />
            </label>
            <label className="space-y-1 text-xs font-medium text-[var(--nx-text-secondary)]">
              <span>الطمي</span>
              <input
                type="text"
                inputMode="numeric"
                dir="ltr"
                min={0}
                max={30}
                value={cCurr}
                onChange={(e) => setCCurr(e.target.value)}
                className="nx-input font-mono-num w-full"
              />
            </label>
            <label className="space-y-1 text-xs font-medium text-[var(--nx-text-secondary)]">
              <span>الحديد</span>
              <input
                type="text"
                inputMode="numeric"
                dir="ltr"
                min={0}
                max={30}
                value={iCurr}
                onChange={(e) => setICurr(e.target.value)}
                className="nx-input font-mono-num w-full"
              />
            </label>
            <label className="space-y-1 text-xs font-medium text-[var(--nx-text-secondary)]">
              <span>المزارع</span>
              <input
                type="text"
                inputMode="numeric"
                dir="ltr"
                min={1}
                max={30}
                value={farmLevel}
                onChange={(e) => setFarmLevel(e.target.value)}
                className="nx-input font-mono-num w-full"
              />
            </label>
            <label className="space-y-1 text-xs font-medium text-[var(--nx-text-secondary)]">
              <span>السوق</span>
              <input
                type="text"
                inputMode="numeric"
                dir="ltr"
                min={0}
                max={25}
                value={marketLevel}
                onChange={(e) => setMarketLevel(e.target.value)}
                className="nx-input font-mono-num w-full"
              />
            </label>
            <label className="space-y-1 text-xs font-medium text-[var(--nx-text-secondary)]">
              <span>العلم (%)</span>
              <input
                type="text"
                inputMode="numeric"
                dir="ltr"
                min={0}
                max={30}
                value={flag}
                onChange={(e) => setFlag(e.target.value)}
                className="nx-input font-mono-num w-full"
              />
            </label>
          </div>

          <div className="space-y-2.5 rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] p-3">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <span className="text-xs font-bold text-[var(--nx-text-primary)]">
                جيش وقوات القرية
              </span>
              <span className="font-mono-num text-xs font-semibold text-[var(--nx-emerald)]">
                طاقة الحمولة: {liveTotalArmyCap.toLocaleString('en-US')} مورد
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
              <label className="space-y-1 text-xs text-[var(--nx-text-secondary)]">
                <span className="flex items-center justify-between">
                  <span>رمح</span>
                  <span className="font-mono-num text-[10px] text-[var(--nx-text-muted)]">25</span>
                </span>
                <input
                  type="text"
                inputMode="numeric"
                dir="ltr"
                  min={0}
                  value={spearsTotal}
                  onChange={(e) => setSpearsTotal(e.target.value)}
                  className="nx-input nx-input-compact font-mono-num w-full"
                />
              </label>

              <label className="space-y-1 text-xs text-[var(--nx-text-secondary)]">
                <span className="flex items-center justify-between">
                  <span>سيف</span>
                  <span className="font-mono-num text-[10px] text-[var(--nx-text-muted)]">15</span>
                </span>
                <input
                  type="text"
                inputMode="numeric"
                dir="ltr"
                  min={0}
                  value={swordsTotal}
                  onChange={(e) => setSwordsTotal(e.target.value)}
                  className="nx-input nx-input-compact font-mono-num w-full"
                />
              </label>

              <label className="space-y-1 text-xs text-[var(--nx-text-secondary)]">
                <span className="flex items-center justify-between">
                  <span>فأس</span>
                  <span className="font-mono-num text-[10px] text-[var(--nx-text-muted)]">10</span>
                </span>
                <input
                  type="text"
                inputMode="numeric"
                dir="ltr"
                  min={0}
                  value={axesTotal}
                  onChange={(e) => setAxesTotal(e.target.value)}
                  className="nx-input nx-input-compact font-mono-num w-full"
                />
              </label>

              <label className="space-y-1 text-xs text-[var(--nx-text-secondary)]">
                <span className="flex items-center justify-between">
                  <span>خفيف</span>
                  <span className="font-mono-num text-[10px] text-[var(--nx-text-muted)]">80</span>
                </span>
                <input
                  type="text"
                inputMode="numeric"
                dir="ltr"
                  min={0}
                  value={lightsTotal}
                  onChange={(e) => setLightsTotal(e.target.value)}
                  className="nx-input nx-input-compact font-mono-num w-full"
                />
              </label>

              <label className="space-y-1 text-xs text-[var(--nx-text-secondary)]">
                <span className="flex items-center justify-between">
                  <span>ثقيل</span>
                  <span className="font-mono-num text-[10px] text-[var(--nx-text-muted)]">50</span>
                </span>
                <input
                  type="text"
                inputMode="numeric"
                dir="ltr"
                  min={0}
                  value={heaviesTotal}
                  onChange={(e) => setHeaviesTotal(e.target.value)}
                  className="nx-input nx-input-compact font-mono-num w-full"
                />
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={premium}
                onChange={(e) => setPremium(e.target.checked)}
                className="h-4 w-4 cursor-pointer accent-[var(--nx-indigo)]"
              />
              <span>بريميوم إنتاج (+20%)</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={boost30}
                onChange={(e) => setBoost30(e.target.checked)}
                className="h-4 w-4 cursor-pointer accent-[var(--nx-indigo)]"
              />
              <span>بوست 30%</span>
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--nx-border)] pt-3">
            {!creatingVillage && existing ? (
              !confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="nx-btn nx-btn-outline border-[var(--nx-coral-border)] text-[var(--nx-coral)]"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  <span>حذف القرية</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteVillage(existing.id);
                      onPushToast('تم حذف القرية', 'info');
                      onCloseEdit();
                    }}
                    className="nx-btn bg-[var(--nx-coral)] text-white"
                  >
                    تأكيد الحذف
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="nx-btn nx-btn-outline"
                  >
                    إلغاء
                  </button>
                </div>
              )
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              <button type="button" onClick={onCloseEdit} className="nx-btn nx-btn-outline">
                إلغاء
              </button>
              <button type="submit" className="nx-btn nx-btn-primary">
                <Save className="h-4 w-4" aria-hidden="true" />
                <span>حفظ القرية</span>
              </button>
            </div>
          </div>
        </form>
      </BaseModal>
  );
}
