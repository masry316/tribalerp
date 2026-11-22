export type CurrencyCode = 'EGP' | 'USD';
export type NavTabId = 'dashboard' | 'accounts' | 'planner' | 'reports' | 'settings';
export type ReportTabId = 'profit' | 'efficiency' | 'security' | 'analytics' | 'worlds';
export type SimDiscountMode = 'smart' | 'all' | 'none';
export type OptMode = 'per_phase' | 'cumulative';
export type VillageRole = 'offense' | 'defense' | 'unset';

export type UnitKey =
  | 'spear'
  | 'sword'
  | 'axe'
  | 'archer'
  | 'spy'
  | 'light'
  | 'marcher'
  | 'heavy'
  | 'ram'
  | 'catapult'
  | 'knight'
  | 'snob';

export type UnitCountMap = Partial<Record<UnitKey, number>> & Record<string, number>;

export interface BuildingLevelSpec {
  lvl: number;
  wood: number;
  clay: number;
  iron: number;
  pop: string;
  prod: number;
  prop: string;
}

export interface BuildingDef {
  name: string;
  max_lvl: number;
  btype: string;
  col_title: string;
  levels: BuildingLevelSpec[];
}

export interface ContinentRates {
  sellRate: number;
  buyRate: number;
  sellWood: number;
  sellClay: number;
  sellIron: number;
  lastUpdated: number | null;
  stockWood?: number;
  stockClay?: number;
  stockIron?: number;
  capWood?: number;
  capClay?: number;
  capIron?: number;
  isMarketClosed?: boolean;
}

export interface ErpWorld {
  id: string;
  name: string;
  speed: number;
  settingsUrl?: string;
  continents: Record<string, ContinentRates>;
  tradeEnded?: boolean;
  tradeEndedAt?: number | null;
  tradeSummaryPP?: number | null;
  startedAt?: number | null;
}

export interface LoginHistoryItem {
  date: string;
  device: string;
  ip: string;
  sitter?: string;
  ts?: number;
}

export interface DeviceLogItem {
  t: number;
  deviceId: string;
  device: string;
  browser: string;
  ip: string;
}

export interface ErpUserAccount {
  id: string;
  name: string;
  password?: string;
  email?: string;
  device?: string;
  browser?: string;
  ip?: string;
  pp: number;
  lastSyncTime?: number;
  deviceId?: string;
  loginHistory?: LoginHistoryItem[];
  deviceLog?: DeviceLogItem[];
}

export interface VillageWarehouse {
  level: number;
  woodStock: number;
  clayStock: number;
  ironStock: number;
  lastUpdated: number;
}

export interface VillageMines {
  wood: { curr: number; target: number };
  clay: { curr: number; target: number };
  iron: { curr: number; target: number };
}

export interface AssignedPlanStep {
  stepNum?: number;
  atype: string;
  bName: string;
  baseName?: string;
  targetLvl: number;
  lvl?: number;
  tStart?: number;
  tEnd?: number;
  cost?: { w: number; c: number; i: number };
  reason?: string;
}

export interface AssignedPlan {
  id: string;
  name: string;
  isRealVillageBased?: boolean;
  assignedAt: number;
  steps: AssignedPlanStep[];
}

export interface VillageScavData {
  scavReturnAt?: number;
  scavNextReturnAt?: number;
  scavActiveCount?: number;
  loot?: { wood: number; clay: number; iron: number; total?: number };
  spearsHome?: number;
  swordsHome?: number;
  axesHome?: number;
  spiesHome?: number;
  lightsHome?: number;
  heaviesHome?: number;
  spearsAway?: number;
  swordsAway?: number;
  axesAway?: number;
  spiesAway?: number;
  lightsAway?: number;
  heaviesAway?: number;
  spearsTotal?: number;
  swordsTotal?: number;
  axesTotal?: number;
  spiesTotal?: number;
  lightsTotal?: number;
  heaviesTotal?: number;
  unitsHome?: Record<string, number>;
  unitsAway?: Record<string, number>;
  unitsTotal?: Record<string, number>;
  unlockedScavTiers?: number;
  unlockedTiers?: number;
  buildEndAt?: number;
  timestamp?: number;
}

export interface ErpVillage {
  id: string;
  villageId?: string;
  accountId: string;
  worldId: string;
  continent: string;
  name: string;
  coord?: string;
  villageRole?: VillageRole;
  villagePoints: number;
  lastSyncTime?: number;
  flag: number;
  woodItem: number;
  clayItem: number;
  ironItem: number;
  premium: boolean;
  boost30: boolean;
  marketLevel: number;
  farmLevel: number;
  mines: VillageMines;
  warehouse: VillageWarehouse;
  buildings?: Record<string, number> | null;
  buildingDiscounts?: Record<string, boolean>;
  scavReturnAt?: number;
  scavNextReturnAt?: number;
  scavActiveCount?: number;
  spearsHome?: number;
  swordsHome?: number;
  axesHome?: number;
  spiesHome?: number;
  lightsHome?: number;
  heaviesHome?: number;
  spearsAway?: number;
  swordsAway?: number;
  axesAway?: number;
  spiesAway?: number;
  lightsAway?: number;
  heaviesAway?: number;
  spearsTotal?: number;
  swordsTotal?: number;
  axesTotal?: number;
  spiesTotal?: number;
  lightsTotal?: number;
  heaviesTotal?: number;
  unitsHome?: Record<string, number>;
  unitsAway?: Record<string, number>;
  unitsTotal?: Record<string, number>;
  unitsTs?: number;
  unlockedScavTiers?: number;
  buildEndAt?: number;
  scavData?: VillageScavData | null;
  assignedPlan?: AssignedPlan | null;
  isVirtual?: boolean;
  device?: string;
  browser?: string;
}

export interface DailySessionEntry {
  startPP: number;
  targetPP: number;
  lastSyncedPP: number;
  lastSyncTime: number;
  firstSyncTime?: number;
  manualAdjusted?: boolean;
}

export interface PpLogEntry {
  t: number;
  pp: number;
}

export interface SessionLogEntry {
  accountId: string;
  accountName: string;
  villageId?: string;
  durationSec: number;
  timestamp: number;
  dateKey: string;
}

export interface ErpGameRules {
  rewPct: number;
  minRewW: number;
  minRewC: number;
  minRewI: number;
  freeFinishSec: number;
  giftSpears: number;
  giftSwords: number;
  critHours: number;
  warnHours: number;
  premPct: number;
  boostPct: number;
}

export interface ErpFinance {
  bundlePoints: number;
  bundleEGP: number;
  bundleUSD: number;
  currency: CurrencyCode;
}

export interface PhaseConfigInput {
  enabled: boolean;
  days: number;
  startRate: number;
  endRate: number;
}

export interface AutoSimConfigState {
  simType: 'virtual26' | 'real';
  realVilId: string;
  windowDays: number;
  hours: number;
  autoPlan: boolean;
  optMode: OptMode;
  scavMode: 'max_profit' | 'min_logins';
  ppRate: number;
  buyRate: number;
  activeHrs: number;
  sessionHrs: number;
  worldSpeed: number;
  unitSpeed: number;
  flagPct: number;
  premPct: number;
  wBon: number;
  cBon: number;
  iBon: number;
  wStart: number;
  cStart: number;
  iStart: number;
  freeFinish: boolean;
  harvestSide: boolean;
  marketBoost: boolean;
  boostPP: number;
  extraSpears?: number;
  worldId?: string;
  sellWood?: number;
  sellClay?: number;
  sellIron?: number;
  minScavCycleHrs?: number;
  buildingQuests?: boolean;
  requireSwordResearch?: boolean;
  activePol?: SimPolicy;
  phases: {
    p2: PhaseConfigInput;
    p3: PhaseConfigInput;
    p4: PhaseConfigInput;
  };
}

export interface ErpAppState {
  activeTab: NavTabId;
  activeVillageId: string;
  selectedWorldFilter: string;
  selectedDeviceFilter: string;
  simDiscountMode: SimDiscountMode;
  upgradeBudgetPP: number;
  uiConfig?: {
    fontSize?: number;
    fontWeight?: number;
    density?: 'default' | 'compact';
    theme?: 'dark' | 'light';
  };
  gameRules: ErpGameRules;
  finance: ErpFinance;
  worlds: ErpWorld[];
  deletedCoreNames: string[];
  deletedVillageIds: string[];
  userAccounts: ErpUserAccount[];
  villages: ErpVillage[];
  dailySessions: Record<string, Record<string, DailySessionEntry>>;
  ppLog: Record<string, PpLogEntry[]>;
  sessionLogs: SessionLogEntry[];
  asimConfig: AutoSimConfigState;
}

export interface SyncStatusState {
  online: boolean;
  status: 'idle' | 'syncing' | 'synced' | 'offline' | 'error';
  lastSyncAt: number | null;
  accountsCount: number;
  villagesCount: number;
  totalPP: number;
  errorMessage: string | null;
  source: string;
}

export interface ArmyMatrixItem {
  key: UnitKey;
  ar: string;
  total: number;
  home: number;
  away: number;
  haul: number;
}

export interface VillageLiveResourcesAndArmy {
  cap: number;
  syncRefTs: number;
  elapsedHours: number;
  baseWood: number;
  baseClay: number;
  baseIron: number;
  prodWood: number;
  prodClay: number;
  prodIron: number;
  lootWood: number;
  lootClay: number;
  lootIron: number;
  addedWood: number;
  addedClay: number;
  addedIron: number;
  totalAddedSinceSync: number;
  currentWood: number;
  currentClay: number;
  currentIron: number;
  wProd: number;
  cProd: number;
  iProd: number;
  armyMatrix: ArmyMatrixItem[];
  totalTroops: number;
  homeTroops: number;
  awayTroops: number;
  haulTotal: number;
  haulHome: number;
}

export interface VillageLiveStatus {
  continent: string;
  sellRate: number;
  sellWood: number;
  sellClay: number;
  sellIron: number;
  buyRate: number;
  worldSpeed: number;
  worldName: string;
  lastUpdated: number | null;
  cap: number;
  wProd: number;
  cProd: number;
  iProd: number;
  syncRefTs: number;
  elapsedHours: number;
  baseWood: number;
  baseClay: number;
  baseIron: number;
  prodWood: number;
  prodClay: number;
  prodIron: number;
  lootWood: number;
  lootClay: number;
  lootIron: number;
  addedWood: number;
  addedClay: number;
  addedIron: number;
  totalAddedSinceSync: number;
  totalHourly: number;
  dailyRes: number;
  dailyPP: number;
  mineDailyPP: number;
  scavLootPP: number;
  dailyEGP: number;
  dailyUSD: number;
  currentWood: number;
  currentClay: number;
  currentIron: number;
  wPct: number;
  cPct: number;
  iPct: number;
  maxWhPct: number;
  minHoursLeft: number;
  firstFullRes: string;
  scavState: 'running' | 'returned' | 'idle_troops' | 'no_troops' | 'no_barracks';
  scavRemHours: number;
  scavStatusText: string;
  status: 'safe' | 'warning' | 'critical';
  nextActionHours: number;
  armyMatrix: ArmyMatrixItem[];
  totalTroops: number;
  homeTroops: number;
  awayTroops: number;
  haulTotal: number;
  haulHome: number;
  merchants: number;
  canScavenge: boolean;
  homeText: string;
  totalText: string;
  unsoldPP: number;
  unsoldRes: number;
  sellableNowPP: number;
  sellableNowRes: number;
  scavDailyPP: number;
  scavActiveDailyPP: number;
  syncAgeHours: number;
  isStaleSync: boolean;
  isRateCalibrated: boolean;
  stockWood?: number;
  stockClay?: number;
  stockIron?: number;
  capWood?: number;
  capClay?: number;
  capIron?: number;
  marketHeadroomWood: number;
  marketHeadroomClay: number;
  marketHeadroomIron: number;
  isMarketFullWood: boolean;
  isMarketFullClay: boolean;
  isMarketFullIron: boolean;
  isMarketCompletelyBlocked: boolean;
  isMarketClosed?: boolean;
  tradeEnded?: boolean;
  marketStatusText?: string;
}

export interface IpCollisionGroup {
  type: 'ip';
  ip: string;
  worldId: string;
  wName: string;
  accounts: ErpUserAccount[];
  accountNames: string[];
  accountIds: string[];
}

export interface SecurityAuditRow {
  accountId: string;
  acc: ErpUserAccount;
  ip: string;
  hasIp: boolean;
  isCol: boolean;
  riskScore: 0 | 1 | 2;
  worldIds: string[];
  wNames: string[];
  continents: string[];
  vilsCount: number;
  histCount: number;
  idleScavCount: number;
  whRiskCount: number;
  lastSyncTime: number;
}

export interface SimPolicy {
  mk: number;
  side: number;
  army: number;
  boostTiming: 'after_dev' | 'during_dev';
}

export interface PhaseSimConfig {
  phaseNum: 2 | 3 | 4;
  enabled: boolean;
  days: number;
  activeDays: number;
  totalHrs: number;
  startRate: number;
  endRate: number;
  avgRate: number;
  dailyDelta: number;
}

export interface AutoSimRunConfig {
  simType: 'virtual26' | 'real';
  isRealVillage?: boolean;
  startBuildings?: Record<string, number>;
  wStartStock?: number;
  cStartStock?: number;
  iStartStock?: number;
  startScavTiers?: number;
  startSpears?: number;
  startSwords?: number;
  startAxes?: number;
  startArchers?: number;
  startSpies?: number;
  startLights?: number;
  startMarchers?: number;
  startHeavies?: number;
  startKnights?: number;
  startBoost30?: boolean;
  extraUnits?: {
    spear?: number;
    sword?: number;
    axe?: number;
    archer?: number;
    spy?: number;
    light?: number;
    marcher?: number;
    heavy?: number;
    knight?: number;
  };
  windowDays: number;
  hours: number;
  optMode: OptMode;
  scavMode: 'max_profit' | 'min_logins';
  ppRate: number;
  buyRate: number;
  activeHrs: number;
  sessionHrs: number;
  worldSpeed: number;
  unitSpeed: number;
  flagPct: number;
  premPct: number;
  wBon: number;
  cBon: number;
  iBon: number;
  wStart: number;
  cStart: number;
  iStart: number;
  freeFinish: boolean;
  harvestSide: boolean;
  marketBoost: boolean;
  boostPP: number;
  extraSpears?: number;
  worldId?: string;
  pol?: Partial<SimPolicy>;
  phases?: Record<number, PhaseSimConfig>;
  rules?: Partial<ErpGameRules>;
}

export interface ScavAllocItem {
  tier: number;
  lf: number;
  name: string;
  cap: number;
  sp: number;
  sw: number;
  ax: number;
  ar: number;
  spy: number;
  lc: number;
  ma: number;
  hc: number;
  kn: number;
  loot: number;
  durSec: number;
}

export interface ScavDispatchResult {
  totalCap: number;
  spearsTotal: number;
  swordsTotal: number;
  axesTotal: number;
  archersTotal: number;
  spiesTotal: number;
  lightsTotal: number;
  marchersTotal: number;
  heaviesTotal: number;
  knightsTotal: number;
  unlockedTiers: number;
  lootPerRun: number;
  wLoot: number;
  cLoot: number;
  iLoot: number;
  maxRunSec: number;
  effCycleSec: number;
  avgIntervalSec: number;
  runsPerDay: number;
  dailyLoot: number;
  effHourly: number;
  eachHr: number;
  allocs: ScavAllocItem[];
}

export interface SimStepEntry {
  stepNum: number;
  atype: string;
  bName: string;
  lvl: number;
  cat: string;
  reason: string;
  tStart: number;
  tEnd: number;
  buildDur: number;
  cost: { w: number; c: number; i: number };
  rew: { rw: number; rc: number; ri: number };
  prodAdded: { w: number; c: number; i: number };
  stockAfter: { w: number; c: number; i: number };
  ratesAfter: {
    mineW: number;
    mineC: number;
    mineI: number;
    scavEach: number;
    wHr: number;
    cHr: number;
    iHr: number;
    scavInfo: ScavDispatchResult;
  };
}

export interface SimTimelineSnapshot {
  tSec: number;
  lvls: Record<string, number>;
  spearsTrained: number;
  spearsTotal: number;
  barracksRemSpears: number;
  swordsTotal: number;
  axesTotal: number;
  lightsTotal: number;
  heaviesTotal: number;
  scavUnlocked: number;
  scavRunsDone: number;
  cumScavW: number;
  cumScavC: number;
  cumScavI: number;
  cumScavTotal: number;
  cumMineTotal: number;
  wStock: number;
  cStock: number;
  iStock: number;
  cap: number;
  mineW: number;
  mineC: number;
  mineI: number;
  scavEach: number;
  wHr: number;
  cHr: number;
  iHr: number;
  scavInfo: ScavDispatchResult;
  note: string;
}

export interface AutoSimRunResult {
  cfg: AutoSimRunConfig;
  wMult: number;
  cMult: number;
  iMult: number;
  lvls: Record<string, number>;
  spearsTrained: number;
  spearsTotal: number;
  spearsGraduatedAtHorizon: number;
  barracksRemSpears: number;
  swordsTotal: number;
  scavUnlocked: number;
  scavRunsDone: number;
  market5ReadySec: number | null;
  boostStartSec: number | null;
  boostEndSec: number | null;
  cumBoostDevRes: number;
  cumScavW: number;
  cumScavC: number;
  cumScavI: number;
  cumScavTotal: number;
  cumMineTotal: number;
  optimalTier3TrainedSpears: number;
  boostPP: number;
  buyRate: number;
  ppSpentBoosters: number;
  ppSpentTimeCuts: number;
  ppSpentOnRes: number;
  actuallySpentPP: number;
  unspentPP: number;
  ppResUsedTotal: number;
  ppResUsedW: number;
  ppResUsedC: number;
  ppResUsedI: number;
  wStock: number;
  cStock: number;
  iStock: number;
  finalRates: {
    mineW: number;
    mineC: number;
    mineI: number;
    scavEach: number;
    wHr: number;
    cHr: number;
    iHr: number;
    scavInfo: ScavDispatchResult;
  };
  extraSpearsAdded: number;
  axesTotal: number;
  archersTotal?: number;
  spiesTotal: number;
  lightsTotal: number;
  marchersTotal?: number;
  heaviesTotal: number;
  knightsTotal?: number;
  minePP: number;
  scavPP: number;
  minePct: number;
  scavPct: number;
  startLvls: Record<string, number>;
  finalLvls: Record<string, number>;
  startPoints: number;
  finalPoints: number;
  gainedPoints: number;
  steps: SimStepEntry[];
  timelineSnapshots: SimTimelineSnapshot[];
}

export interface PhaseOutcomeResult {
  phaseNum: 2 | 3 | 4;
  enabled: boolean;
  days: number;
  activeDays: number;
  totalHrs: number;
  startRate: number;
  endRate: number;
  avgRate: number;
  dailyDelta: number;
  baseTotHr: number;
  endTotHr: number;
  sellOnlyRes: number;
  sellOnlyPP: number;
  up: {
    bonusNetRes: number;
    bonusNetPP: number;
    bonusCumPP: number;
    costRes: number;
    costPP: number;
    devHrs: number;
    paybackDays: number;
    extraHr: number;
    desc: string;
  };
  netPP: number;
  ppDay: number;
  nextState: {
    lvls: Record<string, number>;
    spearsTotal: number;
    swordsTotal: number;
    axesTotal: number;
    archersTotal?: number;
    spiesTotal: number;
    lightsTotal: number;
    marchersTotal?: number;
    heaviesTotal: number;
    knightsTotal?: number;
    scavUnlocked: number;
    scavEachHr: number;
    totHr: number;
  };
}

export interface PlanStep {
  stepNum?: number;
  bName: string;
  baseName?: string;
  targetLvl: number;
  atype: 'bldg' | 'train_spear' | 'scav_unlock' | 'scav_return' | string;
  cost?: { w: number; c: number; i: number } | number;
}

export interface VillageSyncSnapshot {
  id: string;
  name: string;
  accountName: string;
  device: string;
  browser: string;
  buildings: Record<string, number>;
  woodStock: number;
  clayStock: number;
  ironStock: number;
  warehouseCap: number;
  wProd: number;
  cProd: number;
  iProd: number;
  spearsHome: number;
  swordsHome: number;
  axesHome?: number;
  lightsHome?: number;
  heaviesHome?: number;
  unitsHome?: Record<string, number>;
  spearsAway: number;
  swordsAway: number;
  spearsTotal: number;
  swordsTotal: number;
  unlockedScavTiers: number;
  scavState: 'running' | 'returned' | 'idle_troops' | 'no_rally' | 'no_barracks' | 'no_troops' | string;
  scavRemHours: number;
  scavLoot?: { wood?: number; clay?: number; iron?: number; total?: number };
  marketLevel: number;
  boost30?: boolean;
  swordResearched?: boolean;
  tradersAway?: number;
  sellWood: number;
  sellClay: number;
  sellIron: number;
  buyRate: number;
  sellRate?: number;
  stockWood?: number;
  stockClay?: number;
  stockIron?: number;
  capWood?: number;
  capClay?: number;
  capIron?: number;
  unitsTotal?: Record<string, number>;
  assignedPlan?: {
    name: string;
    steps: PlanStep[];
  } | null;
}

export interface MissionBriefingResult {
  hasPlan: boolean;
  planName: string;
  totalSteps: number;
  completedStepsCount: number;
  remainingSteps: PlanStep[];
  readyStepsNow: PlanStep[];
  nextWaitingStep: PlanStep | null;
  nextStepReadyInHours: number;
  nextStepReadyText: string;
  shouldSendScavenge: boolean;
  scavengeSummary: string;
  scavNextOpenHours: number;
  scavNextOpenText: string;
  shouldSellMarket: boolean;
  freeMerchants: number;
  sellableAmount: number;
  bestSellResName: string;
  bestSellRate: number;
  marketSummary: string;
  hasAnyImmediateAction: boolean;
  closeAndReopenMessage: string;
}

export interface SessionStatsOverview {
  todayTotalSec: number;
  todayTotalSessions: number;
  todayAvgSec: number;
  byAccount: Record<
    string,
    {
      accountId: string;
      accountName: string;
      totalSec: number;
      todaySec: number;
      sessionsCount: number;
      todaySessionsCount: number;
      avgSec: number;
      lastSessionSec: number;
    }
  >;
}

export interface AccountFlowDayEntry {
  dateKey: string;
  diffDays: number;
  relativeLabel: string;
  weekdayLabel: string;
  shortDateLabel: string;
  isToday: boolean;
  isYesterday: boolean;
  isDayBefore: boolean;
  hasData: boolean;
  source: string;
  manualAdjusted: boolean;
  startPP: number | null;
  endPP: number | null;
  netPP: number | null;
  unsoldPP: number;
  scavLootPP: number;
  effectivePP: number | null;
  targetPP: number;
  achievementPct: number;
  deltaVsPrevDay: number | null;
  moneyFormatted: string;
  effectiveMoneyFormatted: string;
  lastSyncTime: number | null;
  isOnboardingJump?: boolean;
}

export interface AccountPPFlowReport {
  accountId: string;
  accountName: string;
  currentPP: number;
  currentMoneyFormatted: string;
  villagesCount: number;
  ip: string;
  device: string;
  browser: string;
  lastSyncTime: number | null;
  todayKey: string;
  windowDays: number;
  targetDailyPP: number;
  today: AccountFlowDayEntry | null;
  yesterday: AccountFlowDayEntry | null;
  dayBefore: AccountFlowDayEntry | null;
  periodNetPP: number;
  periodMoneyFormatted: string;
  avgDailyPP: number;
  avgMoneyFormatted: string;
  recordedDaysCount: number;
  pastRecordedDaysCount: number;
  bestDay: {
    dateKey: string;
    relativeLabel: string;
    netPP: number;
  } | null;
  maxChartVal: number;
  daysAsc: AccountFlowDayEntry[];
  daysDesc: AccountFlowDayEntry[];
}

export interface SyncProcessResult {
  ok: boolean;
  error?: string;
  nextState?: ErpAppState;
  account?: ErpUserAccount;
  village?: ErpVillage;
  world?: ErpWorld;
  continent?: string;
  isNewAccount?: boolean;
  isNewVillage?: boolean;
  deviceChanged?: boolean;
  addedLogins?: number;
  summaryText?: string;
}

export interface FirestoreDashboardSummary {
  status: string;
  online: boolean;
  errorMessage: string | null;
  lastSyncAt: number | null;
  dataSource: string;
  villagesCount: number;
  syncedLast24hCount: number;
  accountsCount: number;
  activeAccountsCount: number;
  plansCount: number;
  worldsCount: number;
  totalPP: number;
  totalVillagePoints: number;
  totalSpears: number;
  totalSwords: number;
  totalTroopsCount: number;
  totalHaulCapacity: number;
  idleHaulCapacity: number;
  idleArmyVillagesCount: number;
  woodStock: number;
  clayStock: number;
  ironStock: number;
  totalResources: number;
  totalPerResourceCapacity: number;
  totalCombinedCapacity: number;
  woodFillPct: number;
  clayFillPct: number;
  ironFillPct: number;
  overallFillPct: number;
  hourlyWoodProd: number;
  hourlyClayProd: number;
  hourlyIronProd: number;
  totalHourlyProd: number;
  estimatedHourlyPP: number;
  estimatedDailyPP: number;
  nearestFillHours: number | null;
  nearestFillVillageName: string;
  nearestFillResName: string;
  bestMarketRate: { rate: number; resName: string; villageName: string } | null;
  topPriorityVillage: {
    id: string;
    accountId: string;
    accountName: string;
    villageName: string;
    coord: string;
    continent: string;
    device: string;
    browser: string;
    maxFillPct: number;
    haulHome: number;
    isIdleArmy: boolean;
    isWhCritical: boolean;
    hasPlan: boolean;
    planName: string;
    reasonText: string;
  } | null;
  criticalWhCount: number;
  warnWhCount: number;
  safeWhCount: number;
  healthState: 'empty' | 'safe' | 'warning' | 'critical';
  healthLabel: string;
  computedAt: number;
}
