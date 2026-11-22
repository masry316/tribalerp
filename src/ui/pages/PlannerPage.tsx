import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  Globe2,
  Loader2,
  Play,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Swords,
  TrendingUp
} from 'lucide-react';
import {
  buildAssignedPlanFromTacticalResult,
  createDefaultTacticalStudioInput,
  formatPPAndCurrency,
  formatSecondsArabic,
  getVillageContinentRates,
  runTacticalAutoSearch,
  runTacticalSimulation,
  type AssignedPlan,
  type ErpAppState,
  type OptMode,
  type TacticalSimulationResult,
  type TacticalStepActionType,
  type TacticalStrategyPolicy,
  type TacticalStudioInput
} from '../../core';
import type { MutationResult, VirtualVillageBatchParams } from '../../data';
import type {
  TacticalWorkerRequest,
  TacticalWorkerResponse
} from '../../workers/tacticalSim.worker';
import type { ToastItem } from '../components/LayoutNav';
import { NumericInput } from '../components/NumericInput';
import { VirtualWorldPrepModal } from '../components/modals/VirtualWorldPrepModal';
import {
  BuildingCalcResults,
  computeMineBudgetForSelection,
  MinesBuildingsControls,
  type BuildingCalcState,
  type MineOptState
} from '../components/planner/MinesBuildingsPanel';
import {
  createInitialScavCalcState,
  ScavengingCalcControls,
  ScavengingCalcResults,
  type ScavCalcState
} from '../components/planner/ScavengingCalcPanel';
import { StageAccumulationChart } from '../components/planner/StageAccumulationChart';
import { StrategyLabPanel } from '../components/planner/StrategyLabPanel';

interface PlannerPageProps {
  state: ErpAppState;
  searchUrl: string;
  navigate: (path: string) => void;
  onAssignPlan: (
    villageId: string,
    plan: AssignedPlan | null,
    simType?: 'virtual26' | 'real'
  ) => { ok: boolean };
  onAssignPlanBulk: (
    villageIds: string[],
    plan: AssignedPlan | null,
    simType?: 'virtual26' | 'real'
  ) => MutationResult;
  onGenerateVirtualVillages: (params: VirtualVillageBatchParams) => MutationResult;
  onPushToast: (message: string, tone?: ToastItem['tone']) => void;
}

type StudioTab = 'basics' | 'stages' | 'scav' | 'mines';
type TimelineFilter = 'all' | TacticalStepActionType;

const TIMELINE_FILTERS: Array<{ id: TimelineFilter; label: string }> = [
  { id: 'all', label: 'الكل' },
  { id: 'bldg', label: 'بناء' },
  { id: 'train_spear', label: 'تدريب وبحث' },
  { id: 'scav_unlock', label: 'فتح إغارة' },
  { id: 'scav_return', label: 'عودة إغارة' },
  { id: 'sell_surplus', label: 'بيع فائض' },
  { id: 'boost30_activate', label: 'معزز +30%' }
];

const BUILDING_DISPLAY_ORDER = [
  'المبنى الرئيسي',
  'الثكنات',
  'نقطة التجمع',
  'السوق',
  'الخشاب',
  'حفرة الطمي',
  'منجم الحديد',
  'المزارع',
  'المخازن',
  'المخابئ',
  'الحائط',
  'الإسطبل',
  'الحداد',
  'الورشة',
  'النصب التذكاري',
  'الأكاديمية'
];

export function PlannerPage({
  state,
  searchUrl,
  navigate,
  onAssignPlan,
  onAssignPlanBulk,
  onGenerateVirtualVillages,
  onPushToast
}: PlannerPageProps) {
  const [activeTab, setActiveTab] = useState<StudioTab>('basics');
  const [simInput, setSimInput] = useState<TacticalStudioInput>(() =>
    createDefaultTacticalStudioInput(state)
  );
  const [selectedPolicy, setSelectedPolicy] = useState<TacticalStrategyPolicy | null>(null);
  const [simResult, setSimResult] = useState<TacticalSimulationResult | null>(null);
  const [isRunningSim, setIsRunningSim] = useState<boolean>(false);
  const [runningMode, setRunningMode] = useState<'simulate' | 'autoSearch' | null>(null);
  const [hasPendingChanges, setHasPendingChanges] = useState<boolean>(false);

  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>('all');
  const [showAllSteps, setShowAllSteps] = useState(false);
  const [useSplitSellRates, setUseSplitSellRates] = useState<boolean>(() => {
    const cfg = state.asimConfig;
    if (!cfg) return false;
    const w = Number(cfg.sellWood || cfg.ppRate || 64);
    const c = Number(cfg.sellClay || cfg.ppRate || 64);
    const i = Number(cfg.sellIron || cfg.ppRate || 64);
    return w !== c || c !== i;
  });

  // Village assignment inline card state (single | world | all_active)
  const [assignScope, setAssignScope] = useState<'single' | 'world' | 'all_active'>('single');
  const [assignVillageId, setAssignVillageId] = useState<string>(
    () => state.villages[0]?.id || ''
  );
  const [assignWorldId, setAssignWorldId] = useState<string>(() => {
    const activeW = state.worlds.find((w) => !w.tradeEnded);
    return activeW?.id || state.worlds[0]?.id || '';
  });
  const [customPlanName, setCustomPlanName] = useState<string>('');
  const [virtualPrepOpen, setVirtualPrepOpen] = useState<boolean>(false);

  // Worker lifecycle refs
  const workerRef = useRef<Worker | null>(null);
  const reqSeqRef = useRef<number>(0);
  const stateRef = useRef<ErpAppState>(state);
  stateRef.current = state;

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  // Tab 3: Scavenging Calculator state
  const [scavState, setScavState] = useState<ScavCalcState>(() =>
    createInitialScavCalcState(state)
  );

  // Tab 4: Mines Optimizer & Building Calculator state
  const [mineOpt, setMineOpt] = useState<MineOptState>({
    villageId: '',
    budgetPP: Math.max(50, Number(state.upgradeBudgetPP || 350)),
    buyRate: Math.max(1, Number(state.asimConfig?.buyRate || 64)),
    discountMode: state.simDiscountMode || 'smart'
  });
  const [showMineOptResult, setShowMineOptResult] = useState<boolean>(false);

  const [bldgCalc, setBldgCalc] = useState<BuildingCalcState>({
    buildingName: 'الخشاب',
    fromLvl: 10,
    toLvl: 18,
    hqLvl: 15,
    discountMode: 'smart'
  });

  const updateSimInput = useCallback(
    (updater: (prev: TacticalStudioInput) => TacticalStudioInput) => {
      setSimInput(updater);
      setSelectedPolicy(null);
      setHasPendingChanges(true);
    },
    []
  );

  // Sync URL ?villageId=... when arriving from VillageDetailPage
  useEffect(() => {
    const params = new URLSearchParams(searchUrl);
    const vId = params.get('villageId');
    if (vId && state.villages.some((v) => v.id === vId)) {
      setAssignScope('single');
      setAssignVillageId(vId);
      setSimInput((prev) => ({
        ...prev,
        simMode: 'real',
        realVillageId: vId
      }));
    }
  }, [searchUrl, state.villages]);

  // Keep assignVillageId & assignWorldId valid as villages/worlds change
  useEffect(() => {
    if (!assignVillageId && state.villages.length > 0) {
      setAssignVillageId(state.villages[0].id);
    }
  }, [assignVillageId, state.villages]);

  useEffect(() => {
    if (!assignWorldId && state.worlds.length > 0) {
      const activeW = state.worlds.find((w) => !w.tradeEnded);
      setAssignWorldId(activeW?.id || state.worlds[0].id);
    }
  }, [assignWorldId, state.worlds]);

  // Helper to hydrate simulation settings when picking a real village
  const applyRealVillageContext = (vilId: string, base: TacticalStudioInput): TacticalStudioInput => {
    const vil = state.villages.find((v) => v.id === vilId);
    if (!vil) return { ...base, realVillageId: vilId };
    const info = getVillageContinentRates(vil, state.worlds);
    const sw = Math.max(1, Number(info.sellWood || info.sellRate || 64));
    const sc = Math.max(1, Number(info.sellClay || info.sellRate || 64));
    const si = Math.max(1, Number(info.sellIron || info.sellRate || 64));
    if (sw !== sc || sc !== si) {
      setUseSplitSellRates(true);
    }
    return {
      ...base,
      simMode: 'real',
      realVillageId: vil.id,
      worldSpeed: Number(info.worldSpeed || 1),
      sellRate: Math.max(1, Number(info.sellRate || 64)),
      sellWood: sw,
      sellClay: sc,
      sellIron: si,
      buyRate: Math.max(1, Number(info.buyRate || 64)),
      boost30: Boolean(vil.boost30),
      flagPct: Math.max(0, Number(vil.flag || 0)),
      premPct: vil.premium ? Number(state.gameRules?.premPct ?? 20) : 0,
      woodBonusPct: Math.max(0, Number(vil.woodItem || 0)),
      clayBonusPct: Math.max(0, Number(vil.clayItem || 0)),
      ironBonusPct: Math.max(0, Number(vil.ironItem || 0))
    };
  };

  const dispatchToWorker = useCallback(
    (
      reqWithoutId:
        | {
            kind: 'simulate';
            input: TacticalStudioInput;
            policy: TacticalStrategyPolicy | null;
            showToast: boolean;
          }
        | {
            kind: 'autoSearch';
            input: TacticalStudioInput;
          }
    ) => {
      const reqId = ++reqSeqRef.current;
      const currentState = stateRef.current;
      setIsRunningSim(true);
      setRunningMode(reqWithoutId.kind);

      const handleSuccess = (resp: TacticalWorkerResponse) => {
        if (resp.id !== reqSeqRef.current) return;
        setIsRunningSim(false);
        setRunningMode(null);

        if (!resp.ok) {
          onPushToast(`تعذر إتمام المحاكاة: ${resp.error}`, 'danger');
          return;
        }

        if (resp.kind === 'simulate') {
          setSimResult(resp.result);
          setHasPendingChanges(false);
          if (reqWithoutId.kind === 'simulate' && reqWithoutId.showToast) {
            const fmt = formatPPAndCurrency(resp.result.totalCumulativePP, currentState.finance, {
              decimals: 0
            });
            onPushToast(
              `تم اختبار ${resp.result.scenariosTested} سيناريو — المسار الفائز: ${resp.result.winningPolicy.label} ← ${fmt.combinedText}`,
              'success'
            );
          }
        } else if (resp.kind === 'autoSearch') {
          setSimInput(resp.result.bestInput);
          setSelectedPolicy(null);
          setSimResult(resp.result.bestResult);
          setHasPendingChanges(false);
          const fmt = formatPPAndCurrency(
            resp.result.bestResult.totalCumulativePP,
            currentState.finance,
            { decimals: 0 }
          );
          onPushToast(
            `اكتمل البحث التلقائي الشامل (${resp.result.testedCount} سيناريو): أفضل مدة تطوير ${resp.result.bestInput.devHours}س · ${resp.result.bestResult.winningPolicy.label} ← ${fmt.combinedText}`,
            'success'
          );
        }
      };

      const runFallbackSync = () => {
        window.setTimeout(() => {
          try {
            if (reqWithoutId.kind === 'simulate') {
              const result = runTacticalSimulation(
                reqWithoutId.input,
                currentState,
                reqWithoutId.policy
              );
              handleSuccess({ id: reqId, kind: 'simulate', ok: true, result });
            } else {
              const result = runTacticalAutoSearch(reqWithoutId.input, currentState);
              handleSuccess({ id: reqId, kind: 'autoSearch', ok: true, result });
            }
          } catch (err) {
            handleSuccess({
              id: reqId,
              kind: reqWithoutId.kind,
              ok: false,
              error: err instanceof Error ? err.message : String(err)
            });
          }
        }, 0);
      };

      if (typeof Worker === 'undefined') {
        runFallbackSync();
        return;
      }

      try {
        if (!workerRef.current) {
          workerRef.current = new Worker(
            new URL('../../workers/tacticalSim.worker.ts', import.meta.url),
            { type: 'module' }
          );
        }
        const worker = workerRef.current;
        worker.onmessage = (event: MessageEvent<TacticalWorkerResponse>) => {
          handleSuccess(event.data);
        };
        worker.onerror = () => {
          if (workerRef.current) {
            workerRef.current.terminate();
            workerRef.current = null;
          }
          runFallbackSync();
        };

        const payload: TacticalWorkerRequest =
          reqWithoutId.kind === 'simulate'
            ? {
                id: reqId,
                kind: 'simulate',
                input: reqWithoutId.input,
                state: currentState,
                policy: reqWithoutId.policy
              }
            : {
                id: reqId,
                kind: 'autoSearch',
                input: reqWithoutId.input,
                state: currentState
              };

        worker.postMessage(payload);
      } catch {
        runFallbackSync();
      }
    },
    [onPushToast]
  );

  const mineOptResult = useMemo(
    () =>
      showMineOptResult
        ? computeMineBudgetForSelection(state, mineOpt, simInput.worldSpeed)
        : null,
    [showMineOptResult, state, mineOpt, simInput.worldSpeed]
  );

  const filteredSteps = useMemo(() => {
    if (!simResult) return [];
    if (timelineFilter === 'all') return simResult.steps;
    if (timelineFilter === 'train_spear') {
      return simResult.steps.filter(
        (s) =>
          s.atype === 'train_spear' ||
          s.atype === 'train_sword' ||
          s.atype === 'train_paladin' ||
          s.atype === 'research_sword'
      );
    }
    return simResult.steps.filter((s) => s.atype === timelineFilter);
  }, [simResult, timelineFilter]);

  const displayedSteps = showAllSteps ? filteredSteps : filteredSteps.slice(0, 20);

  const s1Fmt = simResult
    ? formatPPAndCurrency(simResult.s1NetPP, state.finance, { decimals: 0 })
    : null;
  const totalFmt = simResult
    ? formatPPAndCurrency(simResult.totalCumulativePP, state.finance, { decimals: 0 })
    : null;
  const dailyTotalFmt = simResult
    ? formatPPAndCurrency(simResult.steadyDailyTotalPP, state.finance, {
        decimals: 1,
        perDay: true
      })
    : null;

  const actionableStepsCount = useMemo(
    () =>
      simResult
        ? simResult.steps.filter(
            (s) => s.atype !== 'scav_return' && s.atype !== 'sell_surplus'
          ).length
        : 0,
    [simResult]
  );
  const enabledExtraStagesCount = useMemo(
    () => (simResult ? simResult.stages.filter((s) => s.enabled).length : 0),
    [simResult]
  );

  const activeWorldIdsSet = useMemo(
    () => new Set(state.worlds.filter((w) => !w.tradeEnded).map((w) => w.id)),
    [state.worlds]
  );

  const targetVillagesForAssign = useMemo(() => {
    if (assignScope === 'single') {
      const v = state.villages.find((x) => x.id === assignVillageId);
      return v ? [v] : [];
    }
    if (assignScope === 'world') {
      return state.villages.filter((x) => x.worldId === assignWorldId);
    }
    // all_active: all villages belonging to non-ended worlds (or all villages if all worlds ended)
    const activeVils = state.villages.filter((x) => activeWorldIdsSet.has(x.worldId));
    return activeVils.length > 0 ? activeVils : state.villages;
  }, [assignScope, assignVillageId, assignWorldId, state.villages, activeWorldIdsSet]);

  const currentDraftPlan = useMemo(
    () => (simResult ? buildAssignedPlanFromTacticalResult(simResult, customPlanName) : null),
    [simResult, customPlanName]
  );

  const handleRunSimulationClick = () => {
    dispatchToWorker({
      kind: 'simulate',
      input: simInput,
      policy: selectedPolicy,
      showToast: true
    });
  };

  const handleAutoSearchClick = () => {
    dispatchToWorker({
      kind: 'autoSearch',
      input: simInput
    });
  };

  const handleSelectRivalPolicy = (pol: TacticalStrategyPolicy | null) => {
    setSelectedPolicy(pol);
    dispatchToWorker({
      kind: 'simulate',
      input: simInput,
      policy: pol,
      showToast: false
    });
  };

  const handleAssignPlanClick = () => {
    if (!simResult) {
      onPushToast('شغّل المحاكاة أولاً لإنتاج خطة قابلة للإسناد', 'warn');
      return;
    }
    if (targetVillagesForAssign.length === 0) {
      onPushToast('لا توجد قرى مستهدفة في النطاق المحدد — يمكنك تجهيز قرى افتراضية أولاً', 'warn');
      return;
    }

    const plan = buildAssignedPlanFromTacticalResult(simResult, customPlanName);
    if (assignScope === 'single') {
      const targetVil = targetVillagesForAssign[0];
      const res = onAssignPlan(targetVil.id, plan, simInput.simMode);
      if (res.ok) {
        onPushToast(
          `تم إسناد الخطة "${plan.name}" (${plan.steps.length} خطوة) إلى ${targetVil.name}`,
          'success'
        );
        setCustomPlanName('');
      }
      return;
    }

    const ids = targetVillagesForAssign.map((v) => v.id);
    const res = onAssignPlanBulk(ids, plan, simInput.simMode);
    if (res.ok) {
      const count = res.updatedVillages?.length || ids.length;
      const scopeLabel =
        assignScope === 'world'
          ? state.worlds.find((w) => w.id === assignWorldId)?.name || 'العالم المحدد'
          : 'جميع القرى النشطة';
      onPushToast(
        `تم إسناد الخطة "${plan.name}" (${plan.steps.length} خطوة) إلى ${count} قرية (${scopeLabel})`,
        'success'
      );
      setCustomPlanName('');
    }
  };

  const updatePhase = (
    phaseKey: 'p2' | 'p3' | 'p4',
    patch: Partial<{ enabled: boolean; days: number; startRate: number; endRate: number }>
  ) => {
    updateSimInput((prev) => ({
      ...prev,
      phases: {
        ...prev.phases,
        [phaseKey]: {
          ...prev.phases[phaseKey],
          ...patch
        }
      }
    }));
  };

  const tabItems: Array<{ id: StudioTab; label: string }> = [
    { id: 'basics', label: 'الأساسيات' },
    { id: 'stages', label: 'المراحل 2-4' },
    { id: 'scav', label: 'حاسبة الإغارات' },
    { id: 'mines', label: 'المناجم والمباني' }
  ];

  const buildingBadges = simResult
    ? BUILDING_DISPLAY_ORDER.filter((name) => (simResult.finalBuildings[name] || 0) > 0)
    : [];

  return (
    <div className="space-y-4">
      {/* Page Header matching live reference */}
      <div>
        <h1 className="text-[22px] font-extrabold tracking-tight text-[var(--nx-text-primary)] sm:text-[25px]">
          استوديو المحاكاة والخطط التكتيكية
        </h1>
        <p className="mt-0.5 text-xs text-[var(--nx-text-muted)] sm:text-[13px]">
          محرك تحسين ذكي يختبر أكثر من 500 سيناريو مختلف عبر 4 مراحل سوق، حاسبة الإغارات، ومحسن المناجم والمباني
        </p>
      </div>

      {/* Main 2-Column Workspace (RTL: Controls Right 4 cols, Results Left 8 cols) */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
        {/* RIGHT COLUMN: Control Studio Card */}
        <section
          aria-label="إعدادات المحاكي والحاسبات"
          className="nx-card space-y-4 p-4 lg:col-span-4"
        >
          {/* 2x2 Tab Switcher matching live screenshot */}
          <div
            role="tablist"
            aria-label="أقسام استوديو المحاكاة"
            className="grid grid-cols-2 gap-1.5 rounded-[var(--nx-radius-md)] bg-[var(--nx-bg-subtle)] p-1.5"
          >
            {tabItems.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(tab.id)}
                  className={`nx-transition cursor-pointer rounded-[var(--nx-radius-sm)] px-2.5 py-2 text-center text-xs font-bold ${
                    active
                      ? 'bg-[var(--nx-bg-surface)] text-[var(--nx-indigo)] shadow-sm'
                      : 'text-[var(--nx-text-secondary)] hover:text-[var(--nx-text-primary)]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* TAB 1: الأساسيات */}
          {activeTab === 'basics' && (
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="sim-mode"
                  className="mb-1 block text-[11.5px] font-semibold text-[var(--nx-text-secondary)]"
                >
                  نوع المحاكاة
                </label>
                <select
                  id="sim-mode"
                  value={simInput.simMode}
                  onChange={(e) => {
                    const mode = e.target.value === 'real' ? 'real' : 'virtual26';
                    if (mode === 'real' && state.villages.length > 0) {
                      const targetId = simInput.realVillageId || state.villages[0].id;
                      updateSimInput((prev) => applyRealVillageContext(targetId, prev));
                    } else {
                      updateSimInput((prev) => ({ ...prev, simMode: 'virtual26' }));
                    }
                  }}
                  className="nx-select nx-select-compact"
                >
                  <option value="virtual26">قرية جديدة افتراضية (26 نقطة)</option>
                  <option value="real" disabled={state.villages.length === 0}>
                    قرية حقيقية مسجلة ({state.villages.length})
                  </option>
                </select>
              </div>

              {simInput.simMode === 'real' && state.villages.length > 0 && (
                <div>
                  <label
                    htmlFor="sim-real-village"
                    className="mb-1 block text-[11.5px] font-semibold text-[var(--nx-text-secondary)]"
                  >
                    القرية الحقيقية المصدر
                  </label>
                  <select
                    id="sim-real-village"
                    value={simInput.realVillageId}
                    onChange={(e) =>
                      updateSimInput((prev) => applyRealVillageContext(e.target.value, prev))
                    }
                    className="nx-select nx-select-compact"
                  >
                    {state.villages.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} {v.coord ? `(${v.coord})` : ''} — {v.villagePoints} نقطة
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label
                    htmlFor="sim-opt-mode"
                    className="mb-1 block text-[11.5px] font-semibold text-[var(--nx-text-secondary)]"
                  >
                    التحسين
                  </label>
                  <select
                    id="sim-opt-mode"
                    value={simInput.optMode}
                    onChange={(e) =>
                      updateSimInput((prev) => ({
                        ...prev,
                        optMode: e.target.value as OptMode
                      }))
                    }
                    className="nx-select nx-select-compact"
                  >
                    <option value="per_phase">مرحلة مستقلة</option>
                    <option value="cumulative">تراكمي</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="sim-scav-mode"
                    className="mb-1 block text-[11.5px] font-semibold text-[var(--nx-text-secondary)]"
                  >
                    أسلوب الإغارات
                  </label>
                  <select
                    id="sim-scav-mode"
                    value={simInput.scavMode}
                    onChange={(e) =>
                      updateSimInput((prev) => ({
                        ...prev,
                        scavMode:
                          e.target.value === 'min_logins' ? 'min_logins' : 'max_profit'
                      }))
                    }
                    className="nx-select nx-select-compact"
                  >
                    <option value="max_profit">أقصى عائد (دورة ساعتين)</option>
                    <option value="min_logins">أقل عدد دخولات</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label
                    htmlFor="sim-s1-days"
                    className="mb-1 block text-[11.5px] font-semibold text-[var(--nx-text-secondary)]"
                  >
                    أيام S1
                  </label>
                  <NumericInput
                    id="sim-s1-days"
                    min={1}
                    max={60}
                    integer
                    fallback={3}
                    value={simInput.s1Days}
                    onValueChange={(v) =>
                      updateSimInput((prev) => ({
                        ...prev,
                        s1Days: v
                      }))
                    }
                    className="nx-input nx-input-compact font-mono-num"
                  />
                </div>
                <div>
                  <label
                    htmlFor="sim-dev-hours"
                    className="mb-1 block text-[11.5px] font-semibold text-[var(--nx-text-secondary)]"
                  >
                    ساعات التطوير
                  </label>
                  <NumericInput
                    id="sim-dev-hours"
                    min={1}
                    max={240}
                    integer
                    fallback={42}
                    value={simInput.devHours}
                    onValueChange={(v) =>
                      updateSimInput((prev) => ({
                        ...prev,
                        devHours: v
                      }))
                    }
                    className="nx-input nx-input-compact font-mono-num"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label
                    htmlFor="sim-active-hrs"
                    className="mb-1 block text-[11.5px] font-semibold text-[var(--nx-text-secondary)]"
                  >
                    النشاط اليومي (س)
                  </label>
                  <NumericInput
                    id="sim-active-hrs"
                    min={1}
                    max={24}
                    allowDecimal
                    fallback={12}
                    value={simInput.activeHrs}
                    onValueChange={(v) =>
                      updateSimInput((prev) => ({
                        ...prev,
                        activeHrs: v
                      }))
                    }
                    className="nx-input nx-input-compact font-mono-num"
                  />
                </div>
                <div>
                  <label
                    htmlFor="sim-scav-cycle"
                    className="mb-1 block text-[11.5px] font-semibold text-[var(--nx-text-secondary)]"
                  >
                    {simInput.scavMode === 'max_profit'
                      ? 'أدنى دورة إغارة (س)'
                      : 'دورة الإغارة (س)'}
                  </label>
                  <NumericInput
                    id="sim-scav-cycle"
                    min={0.5}
                    max={simInput.scavMode === 'max_profit' ? 6 : 12}
                    allowDecimal
                    fallback={2}
                    value={
                      simInput.scavMode === 'max_profit'
                        ? (simInput.minScavCycleHrs ?? 2)
                        : simInput.scavCycleHrs
                    }
                    onValueChange={(v) => {
                      updateSimInput((prev) =>
                        prev.scavMode === 'max_profit'
                          ? { ...prev, minScavCycleHrs: Math.min(6, v) }
                          : { ...prev, scavCycleHrs: Math.min(12, v) }
                      );
                    }}
                    className="nx-input nx-input-compact font-mono-num"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <div className="mb-1 flex items-center justify-between gap-1">
                    <label
                      htmlFor="sim-sell-rate"
                      className="text-[11.5px] font-semibold text-[var(--nx-text-secondary)]"
                    >
                      سعر البيع
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setUseSplitSellRates((prev) => {
                          const next = !prev;
                          if (!next) {
                            updateSimInput((s) => ({
                              ...s,
                              sellWood: s.sellRate,
                              sellClay: s.sellRate,
                              sellIron: s.sellRate
                            }));
                          }
                          return next;
                        });
                      }}
                      className="cursor-pointer text-[10.5px] font-bold text-[var(--nx-indigo)] hover:underline"
                    >
                      {useSplitSellRates ? 'سعر موحد' : 'تفصيل خ/ط/ح'}
                    </button>
                  </div>
                  <NumericInput
                    id="sim-sell-rate"
                    min={1}
                    integer
                    fallback={64}
                    value={simInput.sellRate}
                    onValueChange={(rate) => {
                      updateSimInput((prev) => ({
                        ...prev,
                        sellRate: rate,
                        ...(useSplitSellRates
                          ? {}
                          : { sellWood: rate, sellClay: rate, sellIron: rate })
                      }));
                    }}
                    className="nx-input nx-input-compact font-mono-num"
                  />
                </div>
                <div>
                  <label
                    htmlFor="sim-buy-rate"
                    className="mb-1 block text-[11.5px] font-semibold text-[var(--nx-text-secondary)]"
                  >
                    سعر الشراء
                  </label>
                  <NumericInput
                    id="sim-buy-rate"
                    min={1}
                    integer
                    fallback={64}
                    value={simInput.buyRate}
                    onValueChange={(v) =>
                      updateSimInput((prev) => ({
                        ...prev,
                        buyRate: v
                      }))
                    }
                    className="nx-input nx-input-compact font-mono-num"
                  />
                </div>
              </div>

              {useSplitSellRates && (
                <div className="grid grid-cols-3 gap-2 rounded-[var(--nx-radius-sm)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] p-2">
                  <div>
                    <label
                      htmlFor="sim-sell-wood"
                      className="mb-1 block text-[10.5px] font-semibold text-[var(--nx-text-muted)]"
                    >
                      بيع خشب
                    </label>
                    <NumericInput
                      id="sim-sell-wood"
                      min={1}
                      integer
                      fallback={64}
                      value={simInput.sellWood ?? simInput.sellRate}
                      onValueChange={(v) => {
                        updateSimInput((prev) => {
                          const c = prev.sellClay ?? prev.sellRate;
                          const i = prev.sellIron ?? prev.sellRate;
                          return {
                            ...prev,
                            sellWood: v,
                            sellRate: Math.round((v + c + i) / 3)
                          };
                        });
                      }}
                      className="nx-input nx-input-compact font-mono-num"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sim-sell-clay"
                      className="mb-1 block text-[10.5px] font-semibold text-[var(--nx-text-muted)]"
                    >
                      بيع طمي
                    </label>
                    <NumericInput
                      id="sim-sell-clay"
                      min={1}
                      integer
                      fallback={64}
                      value={simInput.sellClay ?? simInput.sellRate}
                      onValueChange={(v) => {
                        updateSimInput((prev) => {
                          const w = prev.sellWood ?? prev.sellRate;
                          const i = prev.sellIron ?? prev.sellRate;
                          return {
                            ...prev,
                            sellClay: v,
                            sellRate: Math.round((w + v + i) / 3)
                          };
                        });
                      }}
                      className="nx-input nx-input-compact font-mono-num"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sim-sell-iron"
                      className="mb-1 block text-[10.5px] font-semibold text-[var(--nx-text-muted)]"
                    >
                      بيع حديد
                    </label>
                    <NumericInput
                      id="sim-sell-iron"
                      min={1}
                      integer
                      fallback={64}
                      value={simInput.sellIron ?? simInput.sellRate}
                      onValueChange={(v) => {
                        updateSimInput((prev) => {
                          const w = prev.sellWood ?? prev.sellRate;
                          const c = prev.sellClay ?? prev.sellRate;
                          return {
                            ...prev,
                            sellIron: v,
                            sellRate: Math.round((w + c + v) / 3)
                          };
                        });
                      }}
                      className="nx-input nx-input-compact font-mono-num"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label
                    htmlFor="sim-world-speed"
                    className="mb-1 block text-[11.5px] font-semibold text-[var(--nx-text-secondary)]"
                  >
                    سرعة العالم
                  </label>
                  <NumericInput
                    id="sim-world-speed"
                    min={0.1}
                    max={20}
                    allowDecimal
                    fallback={1}
                    value={simInput.worldSpeed}
                    onValueChange={(v) =>
                      updateSimInput((prev) => ({
                        ...prev,
                        worldSpeed: v
                      }))
                    }
                    className="nx-input nx-input-compact font-mono-num"
                  />
                </div>
                <div>
                  <label
                    htmlFor="sim-extra-spears"
                    className="mb-1 block text-[11.5px] font-semibold text-[var(--nx-text-secondary)]"
                  >
                    رماح إضافية
                  </label>
                  <NumericInput
                    id="sim-extra-spears"
                    min={0}
                    max={2000}
                    integer
                    fallback={0}
                    value={simInput.extraSpears}
                    onValueChange={(v) =>
                      updateSimInput((prev) => ({
                        ...prev,
                        extraSpears: v
                      }))
                    }
                    className="nx-input nx-input-compact font-mono-num"
                  />
                </div>
              </div>

              {/* 3 Toggle Checkboxes row */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--nx-border)] pt-2.5 text-xs">
                <label className="inline-flex cursor-pointer items-center gap-1.5 font-medium text-[var(--nx-text-primary)]">
                  <input
                    type="checkbox"
                    checked={simInput.freeFinish}
                    onChange={(e) =>
                      updateSimInput((prev) => ({ ...prev, freeFinish: e.target.checked }))
                    }
                    className="h-4 w-4 accent-[var(--nx-indigo)]"
                  />
                  <span>إنهاء مجاني</span>
                </label>

                <label
                  title="مكافأة مهمة الثكنات مستوى 3 الأصلية فقط (30 رمح + 30 سيف مجاني بدون موارد وهمية)"
                  className="inline-flex cursor-pointer items-center gap-1.5 font-medium text-[var(--nx-text-primary)]"
                >
                  <input
                    type="checkbox"
                    checked={simInput.sideQuests}
                    onChange={(e) =>
                      updateSimInput((prev) => ({ ...prev, sideQuests: e.target.checked }))
                    }
                    className="h-4 w-4 accent-[var(--nx-indigo)]"
                  />
                  <span>مهام جانبية (ثكنات م3)</span>
                </label>

                <label
                  title="يتطلب بناء السوق مستوى 5 ويعمل لمدة 48 ساعة بالضبط من لحظة تفعيله"
                  className="inline-flex cursor-pointer items-center gap-1.5 font-semibold text-[var(--nx-text-primary)]"
                >
                  <input
                    id="sim-boost30-checkbox"
                    type="checkbox"
                    checked={simInput.boost30}
                    onChange={(e) =>
                      updateSimInput((prev) => ({ ...prev, boost30: e.target.checked }))
                    }
                    className="h-4 w-4 accent-[var(--nx-indigo)]"
                  />
                  <span>معزز +30% (48س)</span>
                </label>
              </div>

              {/* +30% Market Boost Timing Switcher (48h, Market Lv 5) */}
              {simInput.boost30 && (
                <div className="rounded-[var(--nx-radius-md)] border border-[var(--nx-indigo)]/30 bg-[var(--nx-indigo-soft)]/35 p-2.5">
                  <label
                    htmlFor="sim-boost-timing"
                    className="mb-1.5 block text-[11.5px] font-bold text-[var(--nx-text-primary)]"
                  >
                    توقيت معزز +30% (48 ساعة · يتطلب سوق م5)
                  </label>
                  <select
                    id="sim-boost-timing"
                    value={simInput.boostTiming}
                    onChange={(e) =>
                      updateSimInput((prev) => ({
                        ...prev,
                        boostTiming:
                          e.target.value === 'during_dev' ? 'during_dev' : 'after_dev'
                      }))
                    }
                    className="nx-select nx-select-compact"
                  >
                    <option value="after_dev">بعد انتهاء التطوير (48س على أقصى مناجم)</option>
                    <option value="during_dev">أثناء التطوير (فور وصول السوق م5)</option>
                  </select>
                </div>
              )}

              {/* Expandable Advanced Bonuses Drawer */}
              <details className="rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] p-3">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-bold text-[var(--nx-text-primary)]">
                  <SlidersHorizontal
                    className="h-3.5 w-3.5 text-[var(--nx-amber)]"
                    aria-hidden="true"
                  />
                  <span>بونصات البدء وسياسة السوق المتقدمة</span>
                </summary>

                <div className="mt-3 space-y-2.5 border-t border-[var(--nx-border)] pt-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label
                        htmlFor="sim-flag-pct"
                        className="mb-1 block text-[11px] font-semibold text-[var(--nx-text-secondary)]"
                      >
                        العلم (%)
                      </label>
                      <NumericInput
                        id="sim-flag-pct"
                        min={0}
                        max={30}
                        integer
                        fallback={0}
                        value={simInput.flagPct}
                        onValueChange={(v) =>
                          updateSimInput((prev) => ({
                            ...prev,
                            flagPct: v
                          }))
                        }
                        className="nx-input nx-input-compact font-mono-num"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="sim-prem-pct"
                        className="mb-1 block text-[11px] font-semibold text-[var(--nx-text-secondary)]"
                      >
                        عضوية (%)
                      </label>
                      <NumericInput
                        id="sim-prem-pct"
                        min={0}
                        max={50}
                        integer
                        fallback={0}
                        value={simInput.premPct}
                        onValueChange={(v) =>
                          updateSimInput((prev) => ({
                            ...prev,
                            premPct: v
                          }))
                        }
                        className="nx-input nx-input-compact font-mono-num"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label
                        htmlFor="sim-wood-bonus"
                        className="mb-1 block text-[11px] font-semibold text-[var(--nx-text-secondary)]"
                      >
                        بونص خشب %
                      </label>
                      <NumericInput
                        id="sim-wood-bonus"
                        min={0}
                        max={100}
                        integer
                        fallback={0}
                        value={simInput.woodBonusPct}
                        onValueChange={(v) =>
                          updateSimInput((prev) => ({
                            ...prev,
                            woodBonusPct: v
                          }))
                        }
                        className="nx-input nx-input-compact font-mono-num"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="sim-clay-bonus"
                        className="mb-1 block text-[11px] font-semibold text-[var(--nx-text-secondary)]"
                      >
                        بونص طمي %
                      </label>
                      <NumericInput
                        id="sim-clay-bonus"
                        min={0}
                        max={100}
                        integer
                        fallback={0}
                        value={simInput.clayBonusPct}
                        onValueChange={(v) =>
                          updateSimInput((prev) => ({
                            ...prev,
                            clayBonusPct: v
                          }))
                        }
                        className="nx-input nx-input-compact font-mono-num"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="sim-iron-bonus"
                        className="mb-1 block text-[11px] font-semibold text-[var(--nx-text-secondary)]"
                      >
                        بونص حديد %
                      </label>
                      <NumericInput
                        id="sim-iron-bonus"
                        min={0}
                        max={100}
                        integer
                        fallback={0}
                        value={simInput.ironBonusPct}
                        onValueChange={(v) =>
                          updateSimInput((prev) => ({
                            ...prev,
                            ironBonusPct: v
                          }))
                        }
                        className="nx-input nx-input-compact font-mono-num"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="sim-market-target"
                      className="mb-1 block text-[11px] font-semibold text-[var(--nx-text-secondary)]"
                    >
                      هدف السوق (مستوى)
                    </label>
                    <NumericInput
                      id="sim-market-target"
                      min={0}
                      max={25}
                      integer
                      fallback={0}
                      value={simInput.marketTargetLvl}
                      onValueChange={(v) =>
                        updateSimInput((prev) => ({
                          ...prev,
                          marketTargetLvl: v
                        }))
                      }
                      className="nx-input nx-input-compact font-mono-num"
                    />
                  </div>

                  <div className="space-y-1.5 border-t border-[var(--nx-border)] pt-2.5 text-xs">
                    <label className="flex cursor-pointer items-center gap-2 font-medium text-[var(--nx-text-primary)]">
                      <input
                        id="sim-building-quests"
                        type="checkbox"
                        checked={simInput.buildingQuests !== false}
                        onChange={(e) =>
                          updateSimInput((prev) => ({
                            ...prev,
                            buildingQuests: e.target.checked
                          }))
                        }
                        className="h-4 w-4 accent-[var(--nx-indigo)]"
                      />
                      <span>مكافآت مهام المباني (استرداد 10%)</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 font-medium text-[var(--nx-text-primary)]">
                      <input
                        id="sim-require-sword-research"
                        type="checkbox"
                        checked={simInput.requireSwordResearch !== false}
                        onChange={(e) =>
                          updateSimInput((prev) => ({
                            ...prev,
                            requireSwordResearch: e.target.checked
                          }))
                        }
                        className="h-4 w-4 accent-[var(--nx-indigo)]"
                      />
                      <span>اشتراط بحث السيف بالحداد م1 قبل التدريب</span>
                    </label>
                  </div>

                  {simInput.simMode === 'virtual26' && (
                    <div className="border-t border-[var(--nx-border)] pt-2.5">
                      <div className="mb-1.5 text-[11px] font-semibold text-[var(--nx-text-secondary)]">
                        مخزون البداية الافتراضي (خ / ط / ح)
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <NumericInput
                          aria-label="خشب البداية"
                          min={0}
                          max={1000}
                          integer
                          fallback={500}
                          value={simInput.startWoodStock ?? 500}
                          onValueChange={(v) =>
                            updateSimInput((prev) => ({
                              ...prev,
                              startWoodStock: v
                            }))
                          }
                          className="nx-input nx-input-compact font-mono-num"
                        />
                        <NumericInput
                          aria-label="طمي البداية"
                          min={0}
                          max={1000}
                          integer
                          fallback={500}
                          value={simInput.startClayStock ?? 500}
                          onValueChange={(v) =>
                            updateSimInput((prev) => ({
                              ...prev,
                              startClayStock: v
                            }))
                          }
                          className="nx-input nx-input-compact font-mono-num"
                        />
                        <NumericInput
                          aria-label="حديد البداية"
                          min={0}
                          max={1000}
                          integer
                          fallback={400}
                          value={simInput.startIronStock ?? 400}
                          onValueChange={(v) =>
                            updateSimInput((prev) => ({
                              ...prev,
                              startIronStock: v
                            }))
                          }
                          className="nx-input nx-input-compact font-mono-num"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </details>
            </div>
          )}

          {/* TAB 2: المراحل 2-4 */}
          {activeTab === 'stages' && (
            <div className="space-y-3">
              {(
                [
                  { key: 'p2', num: 2, label: 'المرحلة 2', toggleLabel: 'تفعيل المرحلة 2' },
                  { key: 'p3', num: 3, label: 'المرحلة 3', toggleLabel: 'تفعيل المرحلة 3' },
                  { key: 'p4', num: 4, label: 'المرحلة 4', toggleLabel: 'تفعيل المرحلة 4' }
                ] as const
              ).map((st) => {
                const cfg = simInput.phases[st.key];
                return (
                  <fieldset
                    key={st.key}
                    className={`rounded-[var(--nx-radius-md)] border p-3 ${
                      cfg.enabled
                        ? 'border-[var(--nx-indigo)] bg-[var(--nx-indigo-soft)]/30'
                        : 'border-[var(--nx-border)] bg-[var(--nx-bg-subtle)]'
                    }`}
                  >
                    <legend className="px-1.5 text-[11.5px] font-bold text-[var(--nx-text-secondary)]">
                      {st.label}
                    </legend>
                    <label className="mb-2.5 flex cursor-pointer items-center gap-2 text-xs font-bold text-[var(--nx-text-primary)]">
                      <input
                        type="checkbox"
                        checked={cfg.enabled}
                        onChange={(e) => updatePhase(st.key, { enabled: e.target.checked })}
                        className="h-4 w-4 accent-[var(--nx-indigo)]"
                      />
                      <span>{st.toggleLabel}</span>
                    </label>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label
                          htmlFor={`stage-${st.num}-days`}
                          className="mb-1 block text-[11px] font-semibold text-[var(--nx-text-muted)]"
                        >
                          الأيام
                        </label>
                        <NumericInput
                          id={`stage-${st.num}-days`}
                          min={1}
                          max={60}
                          integer
                          fallback={4}
                          value={cfg.days}
                          onValueChange={(v) => updatePhase(st.key, { days: v })}
                          className="nx-input nx-input-compact font-mono-num"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor={`stage-${st.num}-start`}
                          className="mb-1 block text-[11px] font-semibold text-[var(--nx-text-muted)]"
                        >
                          بداية
                        </label>
                        <NumericInput
                          id={`stage-${st.num}-start`}
                          min={1}
                          integer
                          fallback={64}
                          value={cfg.startRate}
                          onValueChange={(v) => updatePhase(st.key, { startRate: v })}
                          className="nx-input nx-input-compact font-mono-num"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor={`stage-${st.num}-end`}
                          className="mb-1 block text-[11px] font-semibold text-[var(--nx-text-muted)]"
                        >
                          نهاية
                        </label>
                        <NumericInput
                          id={`stage-${st.num}-end`}
                          min={1}
                          integer
                          fallback={64}
                          value={cfg.endRate}
                          onValueChange={(v) => updatePhase(st.key, { endRate: v })}
                          className="nx-input nx-input-compact font-mono-num"
                        />
                      </div>
                    </div>
                  </fieldset>
                );
              })}
            </div>
          )}

          {/* TAB 3: حاسبة الإغارات */}
          {activeTab === 'scav' && (
            <ScavengingCalcControls
              state={state}
              value={scavState}
              onChange={setScavState}
            />
          )}

          {/* TAB 4: المناجم والمباني */}
          {activeTab === 'mines' && (
            <MinesBuildingsControls
              state={state}
              worldSpeed={simInput.worldSpeed}
              mineOpt={mineOpt}
              mineResult={mineOptResult}
              onChangeMineOpt={setMineOpt}
              onRunMineOpt={() => {
                setShowMineOptResult(true);
                const computed = computeMineBudgetForSelection(
                  state,
                  mineOpt,
                  simInput.worldSpeed
                );
                onPushToast(
                  `أفضل ترقية للمناجم: خشب ${computed.woodLvl} · طمي ${computed.clayLvl} · حديد ${computed.ironLvl} (+${computed.addedHourlyProd} مورد/س)`,
                  'success'
                );
              }}
              bldgCalc={bldgCalc}
              onChangeBldgCalc={setBldgCalc}
            />
          )}

          {/* Primary Action Buttons on Tabs 1 & 2 */}
          {(activeTab === 'basics' || activeTab === 'stages') && (
            <div className="grid grid-cols-2 gap-2 border-t border-[var(--nx-border)] pt-3">
              <button
                type="button"
                data-testid="run-sim-btn"
                disabled={isRunningSim}
                onClick={handleRunSimulationClick}
                className="nx-btn nx-btn-primary w-full justify-center"
              >
                {isRunningSim && runningMode === 'simulate' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>{isRunningSim && runningMode === 'simulate' ? 'جاري الفحص...' : 'تشغيل المحاكاة'}</span>
              </button>
              <button
                type="button"
                data-testid="auto-search-btn"
                disabled={isRunningSim}
                onClick={handleAutoSearchClick}
                className="nx-btn nx-btn-outline w-full justify-center"
              >
                {isRunningSim && runningMode === 'autoSearch' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--nx-amber)]" aria-hidden="true" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 text-[var(--nx-amber)]" aria-hidden="true" />
                )}
                <span>{isRunningSim && runningMode === 'autoSearch' ? 'بحث...' : 'بحث تلقائي'}</span>
              </button>
            </div>
          )}
        </section>

        {/* LEFT COLUMN: Dynamic Results Workspace */}
        <div className="space-y-4 lg:col-span-8">
          {/* RESULTS FOR TABS 1 & 2 — Instant Ready Card before first run, Executive Summary after */}
          {(activeTab === 'basics' || activeTab === 'stages') && !simResult && (
            <section
              data-testid="sim-ready-card"
              className="nx-card flex flex-col items-start gap-4 p-5 sm:p-6"
            >
              <div className="space-y-1.5">
                <h2 className="text-[18px] font-extrabold text-[var(--nx-text-primary)]">
                  المحاكي جاهز — بدون تحميل تلقائي
                </h2>
                <p className="text-xs leading-relaxed text-[var(--nx-text-secondary)] sm:text-[13px]">
                  اضبط إعدادات عالمك وسرعة السوق والأيام من اللوحة الجانبية بكل سلاسة، ثم اضغط
                  <strong className="mx-1 text-[var(--nx-text-primary)]">تشغيل المحاكاة</strong>
                  لفحص 876 سيناريو في الخلفية (Web Worker) بدون تجميد المتصفح.
                </p>
              </div>

              {isRunningSim ? (
                <div
                  data-testid="sim-loading-banner"
                  className="flex w-full items-center gap-3 rounded-[var(--nx-radius-md)] border border-[var(--nx-indigo)]/30 bg-[var(--nx-indigo-soft)]/45 px-4 py-3 text-xs font-bold text-[var(--nx-indigo)]"
                >
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
                  <span>
                    {runningMode === 'autoSearch'
                      ? 'جاري تنفيذ البحث التلقائي الشامل في الخلفية...'
                      : 'جاري فحص 876 سيناريو وإيجاد أعلى خطة ربحية في الخلفية...'}
                  </span>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    data-testid="ready-run-sim-btn"
                    onClick={handleRunSimulationClick}
                    className="nx-btn nx-btn-primary"
                  >
                    <Play className="h-4 w-4" aria-hidden="true" />
                    <span>تشغيل المحاكاة الآن</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleAutoSearchClick}
                    className="nx-btn nx-btn-outline"
                  >
                    <Sparkles className="h-4 w-4 text-[var(--nx-amber)]" aria-hidden="true" />
                    <span>بحث تلقائي لأفضل مدة تطوير</span>
                  </button>
                  <button
                    type="button"
                    data-testid="open-virtual-prep-from-ready-btn"
                    onClick={() => setVirtualPrepOpen(true)}
                    className="nx-btn nx-btn-outline"
                  >
                    <Globe2 className="h-4 w-4 text-[var(--nx-teal)]" aria-hidden="true" />
                    <span>تجهيز قرى افتراضية لعالم جديد (4 قارات)</span>
                  </button>
                </div>
              )}
            </section>
          )}

          {(activeTab === 'basics' || activeTab === 'stages') && simResult && s1Fmt && totalFmt && dailyTotalFmt && (
            <>
              {/* Pending changes or background running notice */}
              {(hasPendingChanges || isRunningSim) && (
                <div
                  data-testid="sim-pending-bar"
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--nx-radius-md)] border border-[var(--nx-amber-border)] bg-[var(--nx-amber-bg)] px-4 py-2.5 text-xs font-bold text-[var(--nx-amber)]"
                >
                  <div className="flex items-center gap-2">
                    {isRunningSim ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        <span>جاري تحديث المحاكاة في الخلفية...</span>
                      </>
                    ) : (
                      <span>تم تعديل الإعدادات — النتائج المعروضة لآخر تشغيل. اضغط لتحديثها.</span>
                    )}
                  </div>
                  {!isRunningSim && (
                    <button
                      type="button"
                      onClick={handleRunSimulationClick}
                      className="nx-btn nx-btn-primary nx-btn-compact"
                    >
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>تحديث الآن</span>
                    </button>
                  )}
                </div>
              )}

              {/* EXECUTIVE SUMMARY CARD: Prominent Final Outcomes Only */}
              <section
                className="nx-card space-y-4 p-4 sm:p-5"
                data-testid="sim-results-card"
              >
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--nx-border)] pb-3">
                  <div>
                    <h2 className="text-[17px] font-extrabold text-[var(--nx-text-primary)]">
                      الملخص التنفيذي للخطة
                    </h2>
                    <p className="mt-0.5 text-xs text-[var(--nx-text-muted)]">
                      {simResult.winningPolicy.label} · تطوير {simResult.effectiveDevHours}س · المرحلة الأولى {simInput.s1Days} أيام · فحص {simResult.scenariosTested.toLocaleString('en-US')} سيناريو
                    </p>
                  </div>
                  {simInput.boost30 && simResult.boost30ActiveStartSec !== null && simResult.boost30ActiveEndSec !== null && (
                    <div
                      data-testid="boost30-window-summary"
                      className="font-mono-num rounded-[var(--nx-radius-sm)] border border-[var(--nx-indigo)]/30 bg-[var(--nx-indigo-soft)]/50 px-2.5 py-1 text-[11px] font-bold text-[var(--nx-indigo)]"
                    >
                      معزز +30% (48س): {formatSecondsArabic(simResult.boost30ActiveStartSec)} ← {formatSecondsArabic(simResult.boost30ActiveEndSec)}
                    </div>
                  )}
                </div>

                {/* 4 Executive Outcome Cards */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {/* 1. Daily PP After Plan (Steady Base vs Temporary +30% Boost) */}
                  <div className="rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] p-3.5">
                    <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[var(--nx-text-muted)]">
                      <span>الإنتاج اليومي المستقر بعد الخطة</span>
                      <TrendingUp className="h-4 w-4 text-[var(--nx-emerald)]" aria-hidden="true" />
                    </div>
                    <div
                      data-testid="kpi-daily-pp"
                      className="font-mono-num mt-1.5 text-[24px] font-extrabold leading-tight text-[var(--nx-emerald)]"
                    >
                      {dailyTotalFmt.ppText}
                    </div>
                    <div className="font-mono-num mt-0.5 text-xs font-semibold text-[var(--nx-text-secondary)]">
                      {dailyTotalFmt.moneyText}
                    </div>
                    <div
                      data-testid="kpi-daily-breakdown"
                      className="font-mono-num mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--nx-border)] pt-2 text-[11.5px] text-[var(--nx-text-secondary)]"
                    >
                      <span>مناجم: {simResult.steadyDailyMinePP.toFixed(1)}/يوم</span>
                      <span>·</span>
                      <span>إغارات: {simResult.steadyDailyScavPP.toFixed(1)}/يوم</span>
                    </div>
                    {simResult.boost30ExtraPP > 0 && (
                      <div
                        data-testid="kpi-boost30-extra"
                        className="font-mono-num mt-1 text-[11px] font-semibold text-[var(--nx-indigo)]"
                      >
                        +{simResult.boost30ExtraPP} نقطة إضافية مؤقتة من معزز +30% (48س)
                      </div>
                    )}
                  </div>

                  {/* 2. Net Stage 1 PP (Production + Scavenging) */}
                  <div className="rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] p-3.5">
                    <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[var(--nx-text-muted)]">
                      <span>صافي المرحلة الأولى (S1 — {simInput.s1Days} أيام)</span>
                      <Sparkles className="h-4 w-4 text-[var(--nx-amber)]" aria-hidden="true" />
                    </div>
                    <div
                      data-testid="kpi-s1-pp"
                      className="font-mono-num mt-1.5 text-[24px] font-extrabold leading-tight text-[var(--nx-amber)]"
                    >
                      {s1Fmt.ppText}
                    </div>
                    <div className="font-mono-num mt-0.5 text-xs font-semibold text-[var(--nx-text-secondary)]">
                      {s1Fmt.moneyText}
                      {enabledExtraStagesCount > 0 && (
                        <span data-testid="kpi-total-pp" className="ms-2 text-[var(--nx-text-muted)]">
                          (الإجمالي {totalFmt.ppText})
                        </span>
                      )}
                    </div>
                    <div
                      data-testid="kpi-yield-split"
                      className="font-mono-num mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-[var(--nx-border)] pt-2 text-[11.5px] text-[var(--nx-text-secondary)]"
                    >
                      <span>إنتاج: {simResult.minePP}</span>
                      <span>·</span>
                      <span>إغارات: {simResult.scavPP}</span>
                      {simResult.devSoldPP > 0 && (
                        <>
                          <span>·</span>
                          <span>فائض مبكر: +{simResult.devSoldPP}</span>
                        </>
                      )}
                    </div>
                    {(simResult.merchantBottleneckRes > 0 || simResult.devOverflowLossRes > 0) && (
                      <div className="font-mono-num mt-1 text-[11px] font-semibold text-[var(--nx-amber)]">
                        {simResult.merchantBottleneckRes > 0 && (
                          <span>
                            اختناق تجار: -{Math.round(simResult.merchantBottleneckRes).toLocaleString('en-US')} مورد/يوم
                          </span>
                        )}
                        {simResult.merchantBottleneckRes > 0 && simResult.devOverflowLossRes > 0 && ' · '}
                        {simResult.devOverflowLossRes > 0 && (
                          <span>
                            فاقد مخزن بالتطوير: {Math.round(simResult.devOverflowLossRes).toLocaleString('en-US')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 3. Final Army & Unlocked Scavenging */}
                  <div className="rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] p-3.5">
                    <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[var(--nx-text-muted)]">
                      <span>الجيش والإغارات المفتوحة</span>
                      <Swords className="h-4 w-4 text-[var(--nx-indigo)]" aria-hidden="true" />
                    </div>
                    <div
                      data-testid="kpi-army-scav"
                      className="font-mono-num mt-1.5 text-[18px] font-extrabold leading-snug text-[var(--nx-text-primary)]"
                    >
                      {simResult.finalSpears} رمح
                      {simResult.finalSwords > 0 ? ` + ${simResult.finalSwords} سيف` : ''}
                      {simResult.finalPaladins > 0 ? ' + قائد' : ''}
                    </div>
                    <div className="font-mono-num mt-0.5 text-xs font-bold text-[var(--nx-indigo)]">
                      {simResult.finalScavTier > 0
                        ? `مفتوح حتى الإغارة رقم ${simResult.finalScavTier}`
                        : 'بدون إغارات (مناجم فقط)'}
                    </div>
                    <div
                      data-testid="kpi-points-growth"
                      className="font-mono-num mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-[var(--nx-border)] pt-2 text-[11.5px] text-[var(--nx-text-secondary)]"
                    >
                      <span>
                        مناجم: {simResult.finalBuildings['الخشاب'] || 0}/
                        {simResult.finalBuildings['حفرة الطمي'] || 0}/
                        {simResult.finalBuildings['منجم الحديد'] || 0}
                      </span>
                      <span>·</span>
                      <span>مخزن م{simResult.finalBuildings['المخازن'] || 1}</span>
                      <span>·</span>
                      <span>سوق م{simResult.finalBuildings['السوق'] || 0}</span>
                      <span>·</span>
                      <span>سعة تجار: {Math.round(simResult.dailyMerchantCapRes).toLocaleString('en-US')}/يوم</span>
                    </div>
                  </div>

                  {/* 4. Account Login Cadence */}
                  <div className="rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] p-3.5">
                    <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[var(--nx-text-muted)]">
                      <span>موعد دخولك للحساب</span>
                      <Clock className="h-4 w-4 text-[var(--nx-teal)]" aria-hidden="true" />
                    </div>
                    <div
                      data-testid="kpi-login-interval"
                      className="font-mono-num mt-1.5 text-[22px] font-extrabold leading-tight text-[var(--nx-text-primary)]"
                    >
                      {simResult.loginIntervalSec > 0
                        ? `كل ${formatSecondsArabic(simResult.loginIntervalSec)}`
                        : 'مرة واحدة يومياً'}
                    </div>
                    <div className="font-mono-num mt-0.5 text-xs font-semibold text-[var(--nx-text-secondary)]">
                      {simResult.loginIntervalSec > 0
                        ? `${simResult.finalScavDispatch.runsPerDay} جولة يومياً (${simInput.activeHrs}س نشاط${simResult.overnightScavRunsDev > 0 ? ` · ${simResult.overnightScavRunsDev} موجة ليلية بالتطوير` : ''})`
                        : 'بيع موارد المناجم فقط حسب سعة المخزن'}
                    </div>
                    <div className="font-mono-num mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-[var(--nx-border)] pt-2 text-[11.5px] text-[var(--nx-text-secondary)]">
                      <span>
                        {simInput.scavMode === 'max_profit'
                          ? `أقصى عائد (أدنى دورة ${simInput.minScavCycleHrs ?? 2}س)`
                          : `أقل دخولات (${simInput.scavCycleHrs}س)`}
                      </span>
                      <span>·</span>
                      <span>{simResult.finalHourlyScavProd.toLocaleString('en-US')} مورد/س إغارة</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* ASSIGN PLAN CARD: Single Village, Full World, or All Active Villages + Virtual Prep */}
              <section className="nx-card space-y-3.5 p-4 sm:p-5" data-testid="assign-plan-card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-[15px] font-bold text-[var(--nx-text-primary)]">
                      إسناد الخطة للقرى للتتبع التلقائي
                    </h2>
                    <p className="mt-0.5 text-[11.5px] text-[var(--nx-text-muted)]">
                      أسند الخطة لقرية محددة، أو لعالم كامل، أو لجميع القرى النشطة بضغطة واحدة ({actionableStepsCount} خطوة قابلة للتتبع)
                    </p>
                  </div>
                  <button
                    type="button"
                    data-testid="open-virtual-prep-btn"
                    onClick={() => setVirtualPrepOpen(true)}
                    className="nx-btn nx-btn-outline nx-btn-compact"
                  >
                    <Globe2 className="h-3.5 w-3.5 text-[var(--nx-teal)]" aria-hidden="true" />
                    <span>تجهيز قرى افتراضية (4 قارات)</span>
                  </button>
                </div>

                {/* Scope Selector */}
                <div
                  role="group"
                  aria-label="نطاق إسناد الخطة"
                  className="grid grid-cols-1 gap-1.5 rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] p-1 sm:grid-cols-3"
                >
                  <button
                    type="button"
                    data-testid="assign-scope-single"
                    onClick={() => setAssignScope('single')}
                    className={`cursor-pointer rounded-[var(--nx-radius-sm)] px-3 py-1.5 text-xs font-bold ${
                      assignScope === 'single'
                        ? 'bg-[var(--nx-bg-surface)] text-[var(--nx-indigo)] shadow-xs'
                        : 'text-[var(--nx-text-secondary)] hover:text-[var(--nx-text-primary)]'
                    }`}
                  >
                    قرية محددة
                  </button>
                  <button
                    type="button"
                    data-testid="assign-scope-world"
                    onClick={() => setAssignScope('world')}
                    className={`cursor-pointer rounded-[var(--nx-radius-sm)] px-3 py-1.5 text-xs font-bold ${
                      assignScope === 'world'
                        ? 'bg-[var(--nx-bg-surface)] text-[var(--nx-indigo)] shadow-xs'
                        : 'text-[var(--nx-text-secondary)] hover:text-[var(--nx-text-primary)]'
                    }`}
                  >
                    جميع قرى عالم محدد
                  </button>
                  <button
                    type="button"
                    data-testid="assign-scope-all"
                    onClick={() => setAssignScope('all_active')}
                    className={`cursor-pointer rounded-[var(--nx-radius-sm)] px-3 py-1.5 text-xs font-bold ${
                      assignScope === 'all_active'
                        ? 'bg-[var(--nx-bg-surface)] text-[var(--nx-indigo)] shadow-xs'
                        : 'text-[var(--nx-text-secondary)] hover:text-[var(--nx-text-primary)]'
                    }`}
                  >
                    إسناد للجميع (القرى النشطة)
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {assignScope === 'single' && (
                    <div>
                      <label
                        htmlFor="assign-target-village"
                        className="mb-1 block text-[11.5px] font-semibold text-[var(--nx-text-secondary)]"
                      >
                        القرية المستهدفة
                      </label>
                      <select
                        id="assign-target-village"
                        value={assignVillageId}
                        onChange={(e) => setAssignVillageId(e.target.value)}
                        className="nx-select nx-select-compact"
                      >
                        {state.villages.length === 0 ? (
                          <option value="">لا توجد قرى مسجلة بعد</option>
                        ) : (
                          state.villages.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} {v.coord ? `(${v.coord})` : v.isVirtual ? '(افتراضية)' : ''}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  )}

                  {assignScope === 'world' && (
                    <div>
                      <label
                        htmlFor="assign-target-world"
                        className="mb-1 block text-[11.5px] font-semibold text-[var(--nx-text-secondary)]"
                      >
                        العالم المستهدف ({targetVillagesForAssign.length} قرية)
                      </label>
                      <select
                        id="assign-target-world"
                        value={assignWorldId}
                        onChange={(e) => setAssignWorldId(e.target.value)}
                        className="nx-select nx-select-compact"
                      >
                        {state.worlds.map((w) => {
                          const count = state.villages.filter((v) => v.worldId === w.id).length;
                          return (
                            <option key={w.id} value={w.id}>
                              {w.name} ({count} قرية){w.tradeEnded ? ' — انتهت التجارة' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}

                  {assignScope === 'all_active' && (
                    <div className="flex flex-col justify-center rounded-[var(--nx-radius-sm)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] px-3 py-2 text-xs">
                      <span className="font-bold text-[var(--nx-text-primary)]">
                        سيتم إسناد الخطة إلى {targetVillagesForAssign.length} قرية نشطة دفعة واحدة
                      </span>
                      <span className="mt-0.5 text-[11px] text-[var(--nx-text-muted)]">
                        يشمل القرى الحقيقية والافتراضية في جميع العوالم النشطة
                      </span>
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="assign-plan-name"
                      className="mb-1 block text-[11.5px] font-semibold text-[var(--nx-text-secondary)]"
                    >
                      اسم الخطة (اختياري)
                    </label>
                    <input
                      id="assign-plan-name"
                      type="text"
                      value={customPlanName}
                      onChange={(e) => setCustomPlanName(e.target.value)}
                      placeholder="مثال: خطة أول 5 أيام"
                      className="nx-input nx-input-compact"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    data-testid="assign-plan-submit-btn"
                    disabled={targetVillagesForAssign.length === 0}
                    onClick={handleAssignPlanClick}
                    className="nx-btn nx-btn-primary"
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    <span>
                      {assignScope === 'single'
                        ? 'إسناد الخطة للقرية'
                        : `إسناد الخطة لـ ${targetVillagesForAssign.length} قرية`}
                    </span>
                  </button>

                  {assignScope === 'single' && assignVillageId && (
                    <button
                      type="button"
                      onClick={() => navigate(`/villages/${encodeURIComponent(assignVillageId)}`)}
                      className="cursor-pointer text-xs font-bold text-[var(--nx-indigo)] hover:underline"
                    >
                      فتح غرفة القرية المحددة
                    </button>
                  )}
                </div>
              </section>

              {/* COLLAPSIBLE DETAIL 1: Timeline Steps & Snapshots */}
              <details
                data-testid="timeline-accordion"
                className="nx-card group overflow-hidden"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-bold text-[var(--nx-text-primary)] hover:bg-[var(--nx-bg-hover)] sm:px-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>تفاصيل خطوات الخطة والجدول الزمني</span>
                    <span className="font-mono-num rounded-[var(--nx-radius-xs)] bg-[var(--nx-bg-subtle)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--nx-text-secondary)]">
                      {actionableStepsCount} خطوة تنفيذية · {simResult.steps.length} إجمالي
                    </span>
                  </div>
                  <ChevronDown
                    className="h-4 w-4 shrink-0 text-[var(--nx-text-muted)] transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>

                <div className="space-y-3 border-t border-[var(--nx-border)] p-4 sm:p-5" data-testid="timeline-card">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-[var(--nx-text-muted)]">
                      عرض ({filteredSteps.length}) خطوة
                    </div>

                    <div
                      role="group"
                      aria-label="تصفية خطوات الجدول الزمني"
                      className="flex flex-wrap items-center gap-1 rounded-[var(--nx-radius-sm)] bg-[var(--nx-bg-subtle)] p-1"
                    >
                      {TIMELINE_FILTERS.map((f) => {
                        const active = timelineFilter === f.id;
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => {
                              setTimelineFilter(f.id);
                              setShowAllSteps(false);
                            }}
                            className={`nx-transition cursor-pointer rounded px-2.5 py-1 text-[11.5px] font-bold ${
                              active
                                ? 'bg-[var(--nx-bg-surface)] text-[var(--nx-indigo)] shadow-sm'
                                : 'text-[var(--nx-text-secondary)] hover:text-[var(--nx-text-primary)]'
                            }`}
                          >
                            {f.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] border-collapse text-xs">
                      <thead>
                        <tr className="border-y border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] text-[var(--nx-text-muted)]">
                          <th className="px-2.5 py-2.5 text-center font-semibold">#</th>
                          <th className="px-2.5 py-2.5 text-start font-semibold">الإجراء</th>
                          <th className="px-2.5 py-2.5 text-center font-semibold">الوقت</th>
                          <th className="px-2.5 py-2.5 text-center font-semibold">
                            التكلفة (خ/ط/ح)
                          </th>
                          <th className="px-2.5 py-2.5 text-center font-semibold">المكافأة</th>
                          <th className="px-2.5 py-2.5 text-start font-semibold">السبب</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--nx-border)]">
                        {displayedSteps.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-4 py-6 text-center text-xs text-[var(--nx-text-muted)]"
                            >
                              لا توجد خطوات مطابقة لهذا الفلتر في المحاكاة الحالية
                            </td>
                          </tr>
                        ) : (
                          displayedSteps.map((step) => {
                            const hasRew =
                              step.rew.w > 0 || step.rew.c > 0 || step.rew.i > 0;
                            return (
                              <tr key={step.stepNum} className="hover:bg-[var(--nx-bg-hover)]">
                                <td className="font-mono-num px-2.5 py-2 text-center text-[var(--nx-text-muted)]">
                                  {step.stepNum}
                                </td>
                                <td className="px-2.5 py-2 font-bold text-[var(--nx-text-primary)]">
                                  {step.bName}
                                </td>
                                <td className="font-mono-num px-2.5 py-2 text-center text-[var(--nx-text-secondary)]">
                                  {formatSecondsArabic(step.tStart)} ← {formatSecondsArabic(step.tEnd)}
                                </td>
                                <td className="font-mono-num px-2.5 py-2 text-center text-[var(--nx-text-secondary)]">
                                  {step.cost.w} / {step.cost.c} / {step.cost.i}
                                </td>
                                <td className="font-mono-num px-2.5 py-2 text-center font-semibold text-[var(--nx-emerald)]">
                                  {hasRew ? `${step.rew.w}/${step.rew.c}/${step.rew.i}` : '—'}
                                </td>
                                <td className="px-2.5 py-2 text-[var(--nx-text-secondary)]">
                                  {step.reason}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {filteredSteps.length > 20 && (
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => setShowAllSteps((v) => !v)}
                        className="nx-btn nx-btn-outline nx-btn-compact"
                      >
                        {showAllSteps
                          ? 'عرض أول 20 خطوة فقط'
                          : `عرض كل الخطوات (${filteredSteps.length})`}
                      </button>
                    </div>
                  )}

                  {/* Nested Snapshots Drawer */}
                  <details className="rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] px-3.5 py-2.5">
                    <summary className="cursor-pointer text-xs font-bold text-[var(--nx-text-primary)]">
                      لقطات المسار الزمني والتراكم ({simResult.snapshots.length} نقطة رصد)
                    </summary>
                    <div className="mt-3 max-h-[340px] overflow-auto border-t border-[var(--nx-border)] pt-2">
                      <table className="w-full min-w-[540px] border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-[var(--nx-border)] bg-[var(--nx-bg-surface)] text-[var(--nx-text-muted)]">
                            <th className="px-2.5 py-2 text-start font-semibold">الوقت</th>
                            <th className="px-2.5 py-2 text-center font-semibold">
                              المخزون (خ/ط/ح)
                            </th>
                            <th className="px-2.5 py-2 text-end font-semibold">الإنتاج/س</th>
                            <th className="px-2.5 py-2 text-end font-semibold">إغارة/س</th>
                            <th className="px-2.5 py-2 text-end font-semibold">رماح</th>
                            <th className="px-2.5 py-2 text-start font-semibold">ملاحظة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--nx-border)]">
                          {simResult.snapshots.map((snap, i) => (
                            <tr key={`${snap.tSec}_${i}`}>
                              <td className="font-mono-num px-2.5 py-1.5 text-[var(--nx-text-secondary)]">
                                {formatSecondsArabic(snap.tSec)}
                              </td>
                              <td className="font-mono-num px-2.5 py-1.5 text-center text-[var(--nx-text-primary)]">
                                {snap.wStock} / {snap.cStock} / {snap.iStock}
                              </td>
                              <td className="font-mono-num px-2.5 py-1.5 text-end font-semibold text-[var(--nx-text-primary)]">
                                {snap.mineHourly}
                              </td>
                              <td className="font-mono-num px-2.5 py-1.5 text-end font-semibold text-[var(--nx-amber)]">
                                {snap.scavHourly}
                              </td>
                              <td className="font-mono-num px-2.5 py-1.5 text-end text-[var(--nx-text-secondary)]">
                                {snap.spears}
                              </td>
                              <td className="px-2.5 py-1.5 text-[var(--nx-text-secondary)]">
                                {snap.note}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </div>
              </details>

              {/* COLLAPSIBLE DETAIL 2: Strategy Lab Comparison */}
              <details
                data-testid="strategy-lab-accordion"
                className="nx-card group overflow-hidden"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-bold text-[var(--nx-text-primary)] hover:bg-[var(--nx-bg-hover)] sm:px-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>مقارنة أفضل الاستراتيجيات (مختبر السيناريوهات)</span>
                    <span className="font-mono-num rounded-[var(--nx-radius-xs)] bg-[var(--nx-bg-subtle)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--nx-text-secondary)]">
                      {simResult.scenariosTested.toLocaleString('en-US')} سيناريو
                    </span>
                  </div>
                  <ChevronDown
                    className="h-4 w-4 shrink-0 text-[var(--nx-text-muted)] transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <div className="border-t border-[var(--nx-border)] p-4 sm:p-5">
                  <StrategyLabPanel
                    simResult={simResult}
                    finance={state.finance}
                    selectedPolicy={selectedPolicy}
                    onSelectPolicy={handleSelectRivalPolicy}
                  />
                </div>
              </details>

              {/* COLLAPSIBLE DETAIL 3: Army Scavenging Split & Final Buildings */}
              <details
                data-testid="buildings-scav-accordion"
                className="nx-card group overflow-hidden"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-bold text-[var(--nx-text-primary)] hover:bg-[var(--nx-bg-hover)] sm:px-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>توزيع الجيش على الإغارات ومستويات المباني النهائية</span>
                    <span className="font-mono-num rounded-[var(--nx-radius-xs)] bg-[var(--nx-bg-subtle)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--nx-text-secondary)]">
                      {simResult.startPoints} ← {simResult.endPoints} نقطة
                    </span>
                  </div>
                  <ChevronDown
                    className="h-4 w-4 shrink-0 text-[var(--nx-text-muted)] transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <div className="space-y-4 border-t border-[var(--nx-border)] p-4 sm:p-5">
                  {/* Scavenging Army Distribution */}
                  {simResult.finalScavDispatch.allocs.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-[var(--nx-text-primary)]">
                        توزيع الجيش على فئات الإغارة (العودة كل {formatSecondsArabic(simResult.loginIntervalSec)})
                      </div>
                      <div className="overflow-x-auto rounded-[var(--nx-radius-sm)] border border-[var(--nx-border)]">
                        <table className="w-full min-w-[460px] border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] text-[var(--nx-text-muted)]">
                              <th className="px-3 py-2 text-start font-semibold">الفئة</th>
                              <th className="px-3 py-2 text-start font-semibold">الوحدات</th>
                              <th className="px-3 py-2 text-end font-semibold">الغنيمة/جولة</th>
                              <th className="px-3 py-2 text-end font-semibold">المدة</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--nx-border)]">
                            {simResult.finalScavDispatch.allocs.map((a) => {
                              const parts: string[] = [];
                              if (a.kn > 0) parts.push(`${a.kn} قائد`);
                              if (a.sp > 0) parts.push(`${a.sp} رمح`);
                              if (a.sw > 0) parts.push(`${a.sw} سيف`);
                              return (
                                <tr key={a.tier}>
                                  <td className="px-3 py-2 font-bold text-[var(--nx-text-primary)]">
                                    إغارة {a.tier} ({Math.round(a.lf * 100)}%)
                                  </td>
                                  <td className="px-3 py-2 text-[var(--nx-text-secondary)]">
                                    {parts.join(' + ') || '—'}
                                  </td>
                                  <td className="font-mono-num px-3 py-2 text-end font-bold text-[var(--nx-emerald)]">
                                    +{a.loot.toLocaleString('en-US')}
                                  </td>
                                  <td className="font-mono-num px-3 py-2 text-end text-[var(--nx-text-secondary)]">
                                    {formatSecondsArabic(a.durSec)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Final Building Levels */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-[var(--nx-text-primary)]">
                      مستويات المباني النهائية ({simResult.finalHourlyMineProd.toLocaleString('en-US')} مورد/س)
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {buildingBadges.map((bName) => (
                        <div
                          key={bName}
                          className="inline-flex items-center gap-2 rounded-[var(--nx-radius-sm)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] px-2.5 py-1 text-xs"
                        >
                          <span className="font-medium text-[var(--nx-text-secondary)]">
                            {bName}
                          </span>
                          <span className="font-mono-num font-bold text-[var(--nx-amber)]">
                            {simResult.finalBuildings[bName]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </details>

              {/* COLLAPSIBLE DETAIL 4: Stages 2–4 & Cumulative Chart */}
              <details
                data-testid="stages-matrix-accordion"
                className="nx-card group overflow-hidden"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-bold text-[var(--nx-text-primary)] hover:bg-[var(--nx-bg-hover)] sm:px-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>توقعات المراحل المتقدمة (S2 – S4) والمنحنى التراكمي</span>
                    <span className="font-mono-num rounded-[var(--nx-radius-xs)] bg-[var(--nx-bg-subtle)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--nx-text-secondary)]">
                      الإجمالي: {totalFmt.ppText}
                    </span>
                  </div>
                  <ChevronDown
                    className="h-4 w-4 shrink-0 text-[var(--nx-text-muted)] transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>

                <div className="space-y-4 border-t border-[var(--nx-border)] p-4 sm:p-5" data-testid="stages-matrix-card">
                  <StageAccumulationChart
                    points={simResult.chartPoints}
                    totalCumulativePP={simResult.totalCumulativePP}
                    finance={state.finance}
                  />

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[660px] border-collapse text-xs">
                      <thead>
                        <tr className="border-y border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] text-[var(--nx-text-muted)]">
                          <th className="px-3 py-2.5 text-start font-semibold">المرحلة</th>
                          <th className="px-3 py-2.5 text-start font-semibold">الحالة</th>
                          <th className="px-3 py-2.5 text-center font-semibold">الأيام</th>
                          <th className="px-3 py-2.5 text-center font-semibold">نطاق السعر</th>
                          <th className="px-3 py-2.5 text-end font-semibold">بيع فقط</th>
                          <th className="px-3 py-2.5 text-start font-semibold">الترقيات</th>
                          <th className="px-3 py-2.5 text-center font-semibold">الاسترداد</th>
                          <th className="px-3 py-2.5 text-end font-semibold">صافي المرحلة</th>
                          <th className="px-3 py-2.5 text-end font-semibold">PP / يوم</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--nx-border)]">
                        {simResult.stages.map((st) => {
                          const sellOnlyFmt = formatPPAndCurrency(st.sellOnlyPP, state.finance, {
                            decimals: 0
                          });
                          const netFmt = formatPPAndCurrency(st.netStagePP, state.finance, {
                            decimals: 0
                          });
                          const dayFmt = formatPPAndCurrency(st.ppPerDay, state.finance, {
                            decimals: 1,
                            perDay: true
                          });
                          return (
                            <tr
                              key={st.stageNum}
                              data-testid={`stage-row-${st.stageNum}`}
                              className={st.enabled ? '' : 'opacity-65'}
                            >
                              <td className="whitespace-nowrap px-3 py-2.5 font-bold text-[var(--nx-text-primary)]">
                                {st.label}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5">
                                <span
                                  className={`inline-block rounded px-2 py-0.5 text-[11px] font-bold ${
                                    st.enabled
                                      ? 'bg-[var(--nx-emerald-bg)] text-[var(--nx-emerald)]'
                                      : 'bg-[var(--nx-bg-muted)] text-[var(--nx-text-muted)]'
                                  }`}
                                >
                                  {st.enabled ? 'مفعلة' : 'معطلة'}
                                </span>
                              </td>
                              <td className="font-mono-num whitespace-nowrap px-3 py-2.5 text-center font-medium text-[var(--nx-text-primary)]">
                                {st.days}
                              </td>
                              <td className="font-mono-num whitespace-nowrap px-3 py-2.5 text-center text-[var(--nx-text-secondary)]">
                                {st.startRate} ← {st.endRate}
                              </td>
                              <td className="font-mono-num whitespace-nowrap px-3 py-2.5 text-end">
                                <div className="font-semibold text-[var(--nx-text-primary)]">
                                  {sellOnlyFmt.ppText}
                                </div>
                                <div className="text-[11px] text-[var(--nx-text-muted)]">
                                  {sellOnlyFmt.moneyText}
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-[var(--nx-text-secondary)]">
                                <div>{st.upgradesDesc}</div>
                                {((st.overflowLossRes || 0) > 0 || (st.merchantBottleneckRes || 0) > 0) && (
                                  <div className="font-mono-num mt-0.5 text-[10.5px] text-[var(--nx-amber)]">
                                    {(st.overflowLossRes || 0) > 0 && (
                                      <span>فاقد نوم: {Math.round(st.overflowLossRes || 0).toLocaleString('en-US')}</span>
                                    )}
                                    {(st.overflowLossRes || 0) > 0 && (st.merchantBottleneckRes || 0) > 0 && ' · '}
                                    {(st.merchantBottleneckRes || 0) > 0 && (
                                      <span>اختناق تجار: {Math.round(st.merchantBottleneckRes || 0).toLocaleString('en-US')}</span>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="font-mono-num whitespace-nowrap px-3 py-2.5 text-center text-[var(--nx-text-secondary)]">
                                {st.paybackDays !== null ? `${st.paybackDays} يوم` : '—'}
                              </td>
                              <td className="font-mono-num whitespace-nowrap px-3 py-2.5 text-end">
                                <div className="font-bold text-[var(--nx-text-primary)]">
                                  {netFmt.ppText}
                                </div>
                                <div className="text-[11px] text-[var(--nx-text-muted)]">
                                  {netFmt.moneyText}
                                </div>
                              </td>
                              <td className="font-mono-num whitespace-nowrap px-3 py-2.5 text-end">
                                <div className="font-bold text-[var(--nx-emerald)]">
                                  {dayFmt.ppText}
                                </div>
                                <div className="text-[11px] text-[var(--nx-text-muted)]">
                                  {dayFmt.moneyText}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </details>
            </>
          )}

          {/* RESULTS FOR TAB 3: حاسبة الإغارات */}
          {activeTab === 'scav' && <ScavengingCalcResults value={scavState} />}

          {/* RESULTS FOR TAB 4: المناجم والمباني */}
          {activeTab === 'mines' && (
            <BuildingCalcResults
              state={state}
              bldgCalc={bldgCalc}
              worldSpeed={simInput.worldSpeed}
              buyRate={mineOpt.buyRate}
            />
          )}
        </div>
      </div>

      <VirtualWorldPrepModal
        open={virtualPrepOpen}
        state={state}
        defaultPlan={currentDraftPlan}
        defaultWorldId={assignWorldId}
        onClose={() => setVirtualPrepOpen(false)}
        onGenerate={onGenerateVirtualVillages}
        onPushToast={onPushToast}
      />
    </div>
  );
}
