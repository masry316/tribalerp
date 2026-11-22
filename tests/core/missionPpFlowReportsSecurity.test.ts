import test from 'node:test';
import assert from 'node:assert/strict';
import {
  auditAccountsSecurity,
  buildAccountLoginQueue,
  buildAccountPPFlow,
  buildSecurityAuditRows,
  computeMissionBriefingForVillage,
  computeMoneyFromPP,
  computeSessionStats,
  createDefaultAppState,
  evaluateVillageMissionBriefing,
  filterAndSortEfficiencyRows,
  filterAndSortProfitRows,
  filterAndSortSecurityRows,
  formatArabicDayLabel,
  formatPPAndCurrency,
  pruneOldDailySessions,
  resolveBaselineBeforeDate,
  shiftCairoDateKey,
  upsertAccountDaySnapshot,
  type VillageSyncSnapshot
} from '../../src/core';

function makeSnapshot(overrides: Partial<VillageSyncSnapshot> = {}): VillageSyncSnapshot {
  return {
    id: 'vil_test',
    name: 'قرية الاختبار',
    accountName: 'حساب اختبار',
    device: 'Mobile',
    browser: 'Chrome',
    buildings: { 'الخشاب': 10, 'حفرة الطمي': 10, 'منجم الحديد': 9, 'المخازن': 8, 'السوق': 5 },
    woodStock: 5000,
    clayStock: 5000,
    ironStock: 5000,
    warehouseCap: 10000,
    wProd: 200,
    cProd: 200,
    iProd: 180,
    spearsHome: 0,
    swordsHome: 0,
    spearsAway: 0,
    swordsAway: 0,
    spearsTotal: 0,
    swordsTotal: 0,
    unlockedScavTiers: 2,
    scavState: 'idle_troops',
    scavRemHours: 0,
    marketLevel: 5,
    sellWood: 250,
    sellClay: 260,
    sellIron: 240,
    buyRate: 250,
    assignedPlan: null,
    ...overrides
  };
}

test('Bug fix #3: evaluateVillageMissionBriefing detects non-spear home units (lights/axes) for scavenging', () => {
  const snap = makeSnapshot({
    spearsHome: 0,
    swordsHome: 0,
    lightsHome: 20,
    axesHome: 15,
    unitsHome: { spear: 0, sword: 0, light: 20, axe: 15 },
    scavState: 'idle_troops'
  });
  const briefing = evaluateVillageMissionBriefing(snap);
  assert.equal(briefing.shouldSendScavenge, true);
  assert.equal(briefing.hasAnyImmediateAction, true);
  assert.ok(briefing.scavengeSummary.includes('20 خفيف'));
});

test('Regression: computeMissionBriefingForVillage resolves scavData/returned raid home army and triggers warehouse overflow sell on high-rate worlds', () => {
  const nowMs = Date.now();
  const state = createDefaultAppState();
  state.userAccounts = [{ id: 'acc_g', name: 'going1572', pp: 500 }];
  state.worlds = [
    {
      id: 'w_96',
      name: 'العالم 96',
      speed: 2,
      continents: {
        '44': {
          buyRate: 64,
          sellRate: 1250,
          sellWood: 1250,
          sellClay: 1300,
          sellIron: 1200,
          lastUpdated: nowMs
        }
      }
    }
  ];
  state.villages = [
    {
      id: 'vil_13',
      accountId: 'acc_g',
      worldId: 'w_96',
      continent: '44',
      name: 'going1572 (44)',
      villagePoints: 1200,
      flag: 0,
      woodItem: 0,
      clayItem: 0,
      ironItem: 0,
      premium: false,
      boost30: false,
      marketLevel: 10,
      farmLevel: 15,
      mines: { wood: { curr: 15, target: 20 }, clay: { curr: 15, target: 20 }, iron: { curr: 15, target: 20 } },
      warehouse: { level: 12, woodStock: 4200, clayStock: 3900, ironStock: 2100, lastUpdated: nowMs },
      scavData: {
        unlockedTiers: 3,
        unitsHome: { spear: 350, sword: 156 },
        unitsTotal: { spear: 350, sword: 156 }
      },
      // Elapsed scavReturnAt in the past -> returned raid should mark idle_troops and use home army
      scavReturnAt: nowMs - 60_000
    }
  ];

  const briefing = computeMissionBriefingForVillage(state.villages[0], state);
  assert.equal(briefing.shouldSendScavenge, true);
  assert.ok(briefing.scavengeSummary.includes('350 رمح'));
  assert.equal(briefing.shouldSellMarket, true);
  assert.ok(briefing.marketSummary.includes('بيع'));
  assert.ok(briefing.freeMerchants >= 10);
});

test('evaluateVillageMissionBriefing tracks plan readiness, market selling, and safe-close ETA', () => {
  const snapReady = makeSnapshot({
    assignedPlan: {
      name: 'خطة تطوير سريعة',
      steps: [
        { bName: 'الخشاب', targetLvl: 10, atype: 'bldg', cost: { w: 500, c: 500, i: 500 } }, // already 10 -> done
        { bName: 'الخشاب', targetLvl: 11, atype: 'bldg', cost: { w: 1200, c: 1400, i: 900 } }, // ready now
        { bName: 'الخشاب', targetLvl: 12, atype: 'bldg', cost: { w: 9000, c: 9000, i: 9000 } } // waiting
      ]
    }
  });
  const b1 = evaluateVillageMissionBriefing(snapReady);
  assert.equal(b1.hasPlan, true);
  assert.equal(b1.completedStepsCount, 1);
  assert.equal(b1.readyStepsNow.length, 1);
  assert.equal(b1.nextWaitingStep?.targetLvl, 12);
  assert.ok(b1.nextStepReadyInHours > 0);
  assert.equal(b1.shouldSellMarket, true);

  const snapIdle = makeSnapshot({
    woodStock: 100,
    clayStock: 100,
    ironStock: 100,
    marketLevel: 0,
    scavState: 'running',
    scavRemHours: 1.5,
    assignedPlan: {
      name: 'خطة انتظار',
      steps: [{ bName: 'الخشاب', targetLvl: 11, atype: 'bldg', cost: { w: 1000, c: 1000, i: 1000 } }]
    }
  });
  const b2 = evaluateVillageMissionBriefing(snapIdle);
  assert.equal(b2.hasAnyImmediateAction, false);
  assert.ok(b2.closeAndReopenMessage.includes('اقفل الحساب'));

  const state = createDefaultAppState();
  state.userAccounts = [{ id: 'a1', name: 'أحمد', pp: 100 }];
  state.villages = [
    {
      id: 'v1',
      accountId: 'a1',
      worldId: 'w_94',
      continent: '44',
      name: 'قرية 1',
      villagePoints: 100,
      flag: 0,
      woodItem: 0,
      clayItem: 0,
      ironItem: 0,
      premium: false,
      boost30: false,
      marketLevel: 5,
      farmLevel: 5,
      mines: { wood: { curr: 10, target: 20 }, clay: { curr: 10, target: 20 }, iron: { curr: 10, target: 20 } },
      warehouse: { level: 10, woodStock: 3000, clayStock: 3000, ironStock: 3000, lastUpdated: 1_750_000_000_000 },
      lightsHome: 15,
      unitsHome: { light: 15 },
      unitsTotal: { light: 15 }
    }
  ];
  const fullBriefing = computeMissionBriefingForVillage(state.villages[0], state);
  assert.equal(fullBriefing.shouldSendScavenge, true);
});

test('computeSessionStats summarizes today and overall durations per account', () => {
  const stats = computeSessionStats(
    [
      { accountId: 'a1', accountName: 'علي', durationSec: 120, timestamp: 1, dateKey: '2026-05-01' },
      { accountId: 'a1', accountName: 'علي', durationSec: 60, timestamp: 2, dateKey: '2026-05-02' },
      { accountId: 'a2', accountName: 'عمر', durationSec: 180, timestamp: 3, dateKey: '2026-05-02' }
    ],
    '2026-05-02'
  );
  assert.equal(stats.todayTotalSec, 240);
  assert.equal(stats.todayTotalSessions, 2);
  assert.equal(stats.todayAvgSec, 120);
  assert.equal(stats.byAccount.a1.totalSec, 180);
  assert.equal(stats.byAccount.a1.todaySec, 60);
});

test('ppFlowEngine accurately shifts dates, computes baseline, prunes sessions, and builds multi-day PP report', () => {
  assert.equal(shiftCairoDateKey('2026-05-10', -2), '2026-05-08');
  assert.equal(formatArabicDayLabel('2026-05-09', '2026-05-10').isYesterday, true);
  assert.equal(computeMoneyFromPP(10000, { bundlePoints: 10000, bundleEGP: 2500, currency: 'EGP' }).amount, 2500);
  assert.equal(computeMoneyFromPP(10000, { bundlePoints: 10000, bundleUSD: 50, currency: 'USD' }).formatted, '$50.00');

  const sessions: any = {
    '2026-01-01': { a1: { startPP: 100, lastSyncedPP: 150, targetPP: 50, lastSyncTime: 1 } },
    '2026-05-08': { a1: { startPP: 200, lastSyncedPP: 260, targetPP: 50, lastSyncTime: 2 } },
    '2026-05-09': { a1: { startPP: 260, lastSyncedPP: 330, targetPP: 50, lastSyncTime: 3 } }
  };
  pruneOldDailySessions(sessions, 30, '2026-05-10');
  assert.equal(sessions['2026-01-01'], undefined);
  assert.ok(sessions['2026-05-08']);

  upsertAccountDaySnapshot(sessions, {
    accId: 'a1',
    dateKey: '2026-05-10',
    startPP: 330,
    endPP: 410,
    targetPP: 60,
    nowMs: Date.UTC(2026, 4, 10, 12, 0, 0)
  });

  const baseline = resolveBaselineBeforeDate('a1', '2026-05-09', sessions, {});
  assert.equal(baseline, 260);

  const report = buildAccountPPFlow({
    account: { id: 'a1', name: 'حساب تدفق', pp: 410 },
    dailySessions: sessions,
    targetDailyPP: 60,
    daysCount: 7,
    nowMs: Date.UTC(2026, 4, 10, 12, 0, 0)
  });
  assert.equal(report.todayKey, '2026-05-10');
  assert.equal(report.today?.netPP, 80);
  assert.equal(report.yesterday?.netPP, 70);
  assert.equal(report.periodNetPP, 210);
  assert.equal(report.bestDay?.dateKey, '2026-05-10');
});

test('securityEngine and reportsEngine audit IP collisions cleanly with explicit accounts', () => {
  const state = createDefaultAppState();
  state.userAccounts = [
    { id: 'acc_1', name: 'حساب ألفا', pp: 100, ip: '41.44.10.1' },
    { id: 'acc_2', name: 'حساب بيتا', pp: 200, ip: '41.44.10.1' },
    { id: 'acc_3', name: 'حساب جاما', pp: 300, ip: '' }
  ];
  state.villages = [
    {
      id: 'v1',
      accountId: 'acc_1',
      worldId: 'w_94',
      continent: '44',
      name: 'قرية 1',
      villagePoints: 100,
      flag: 0,
      woodItem: 0,
      clayItem: 0,
      ironItem: 0,
      premium: false,
      boost30: false,
      marketLevel: 0,
      farmLevel: 1,
      mines: { wood: { curr: 1, target: 20 }, clay: { curr: 1, target: 20 }, iron: { curr: 1, target: 20 } },
      warehouse: { level: 1, woodStock: 950, clayStock: 100, ironStock: 100, lastUpdated: 1 }
    },
    {
      id: 'v2',
      accountId: 'acc_2',
      worldId: 'w_94',
      continent: '44',
      name: 'قرية 2',
      villagePoints: 100,
      flag: 0,
      woodItem: 0,
      clayItem: 0,
      ironItem: 0,
      premium: false,
      boost30: false,
      marketLevel: 0,
      farmLevel: 1,
      mines: { wood: { curr: 1, target: 20 }, clay: { curr: 1, target: 20 }, iron: { curr: 1, target: 20 } },
      warehouse: { level: 1, woodStock: 100, clayStock: 100, ironStock: 100, lastUpdated: 1 }
    },
    {
      id: 'v3',
      accountId: 'acc_3',
      worldId: 'w_94',
      continent: '45',
      name: 'قرية 3',
      villagePoints: 100,
      flag: 0,
      woodItem: 0,
      clayItem: 0,
      ironItem: 0,
      premium: false,
      boost30: false,
      marketLevel: 0,
      farmLevel: 1,
      mines: { wood: { curr: 1, target: 20 }, clay: { curr: 1, target: 20 }, iron: { curr: 1, target: 20 } },
      warehouse: { level: 1, woodStock: 100, clayStock: 100, ironStock: 100, lastUpdated: 1 }
    }
  ];

  const collisions = auditAccountsSecurity(state);
  assert.equal(collisions.length, 1);
  assert.equal(collisions[0].ip, '41.44.10.1');
  assert.deepEqual(collisions[0].accountIds, ['acc_1', 'acc_2']);

  const secRows = buildSecurityAuditRows(state);
  assert.equal(secRows[0].riskScore, 2);
  assert.equal(secRows[0].whRiskCount, 1);
  assert.equal(secRows[2].riskScore, 1); // missing IP

  const filteredSec = filterAndSortSecurityRows(secRows, { status: 'ip_issue', sortBy: 'riskScore', sortDir: 'desc' });
  assert.equal(filteredSec.length, 3);
  assert.equal(filteredSec[0].riskScore, 2);

  const profitSorted = filterAndSortProfitRows(
    [
      { accountId: 'acc_1', accountName: 'أ', realized: 30, worldIds: ['w_94'], continents: ['44'] },
      { accountId: 'acc_2', accountName: 'ب', realized: 90, worldIds: ['w_94'], continents: ['44'] }
    ],
    { sortBy: 'realized', sortDir: 'desc' }
  );
  assert.equal(profitSorted[0].accountId, 'acc_2');

  const effFiltered = filterAndSortEfficiencyRows(
    [
      { vil: { name: 'قرية 1' }, worldId: 'w_94', continent: '44', accountId: 'acc_1', dailyPP: 40, hasPlan: true },
      { vil: { name: 'قرية 2' }, worldId: 'w_94', continent: '45', accountId: 'acc_2', dailyPP: 80, hasPlan: false }
    ],
    { continent: '45', status: 'no_plan' }
  );
  assert.equal(effFiltered.length, 1);
  assert.equal(effFiltered[0].accountId, 'acc_2');
});

test('formatPPAndCurrency binds PP values to converted currency uniformly', () => {
  const f1 = formatPPAndCurrency(10000, { bundlePoints: 10000, bundleEGP: 2600, currency: 'EGP' }, { decimals: 0, unit: 'نقطة' });
  assert.equal(f1.ppText, '10,000 نقطة');
  assert.equal(f1.moneyText, '2,600 ج.م');
  assert.equal(f1.combinedText, '10,000 نقطة / 2,600 ج.م');

  const f2 = formatPPAndCurrency(100, { bundlePoints: 10000, bundleEGP: 2500, currency: 'EGP' }, { decimals: 0, unit: 'نقطة' });
  assert.equal(f2.combinedText, '100 نقطة / 25 ج.م');

  const f3 = formatPPAndCurrency(250, { bundlePoints: 10000, bundleUSD: 50, currency: 'USD' }, { decimals: 0, unit: 'نقطة', showSign: true });
  assert.equal(f3.ppText, '+250 نقطة');
  assert.equal(f3.moneyText, '+$1.25');
});

test('buildAccountLoginQueue ranks critical warehouses, returned raids, and ready plan steps above standby accounts', () => {
  const nowMs = Date.UTC(2026, 5, 1, 12, 0, 0);
  const state = createDefaultAppState();
  state.userAccounts = [
    { id: 'acc_standby', name: 'حساب منتظر', pp: 500, ip: '41.1.1.1' },
    { id: 'acc_crit', name: 'حساب حرج', pp: 800, ip: '41.1.1.2' },
    { id: 'acc_plan', name: 'حساب مهمة جاهزة', pp: 400, ip: '41.1.1.3' }
  ];
  state.villages = [
    {
      id: 'v_standby',
      accountId: 'acc_standby',
      worldId: 'w_94',
      continent: '44',
      name: 'قرية هادئة',
      villagePoints: 300,
      flag: 0,
      woodItem: 0,
      clayItem: 0,
      ironItem: 0,
      premium: false,
      boost30: false,
      marketLevel: 0,
      farmLevel: 3,
      mines: { wood: { curr: 4, target: 20 }, clay: { curr: 4, target: 20 }, iron: { curr: 4, target: 20 } },
      warehouse: { level: 5, woodStock: 100, clayStock: 100, ironStock: 100, lastUpdated: nowMs },
      scavData: { unlockedTiers: 2 },
      scavReturnAt: nowMs + 3 * 3600_000
    },
    {
      id: 'v_crit',
      accountId: 'acc_crit',
      worldId: 'w_94',
      continent: '44',
      name: 'قرية مخزن ممتلئ',
      villagePoints: 900,
      flag: 0,
      woodItem: 0,
      clayItem: 0,
      ironItem: 0,
      premium: false,
      boost30: false,
      marketLevel: 5,
      farmLevel: 10,
      mines: { wood: { curr: 12, target: 20 }, clay: { curr: 12, target: 20 }, iron: { curr: 12, target: 20 } },
      warehouse: { level: 1, woodStock: 980, clayStock: 950, ironStock: 900, lastUpdated: nowMs },
      scavData: { unitsHome: { spear: 120 }, unitsTotal: { spear: 120 }, unlockedTiers: 2 },
      scavReturnAt: nowMs - 60_000
    },
    {
      id: 'v_plan',
      accountId: 'acc_plan',
      worldId: 'w_94',
      continent: '45',
      name: 'قرية خطة جاهزة',
      villagePoints: 450,
      flag: 0,
      woodItem: 0,
      clayItem: 0,
      ironItem: 0,
      premium: false,
      boost30: false,
      marketLevel: 2,
      farmLevel: 6,
      mines: { wood: { curr: 10, target: 20 }, clay: { curr: 10, target: 20 }, iron: { curr: 10, target: 20 } },
      warehouse: { level: 8, woodStock: 1800, clayStock: 1800, ironStock: 1500, lastUpdated: nowMs },
      scavData: { unlockedTiers: 2 },
      scavReturnAt: nowMs + 2 * 3600_000,
      assignedPlan: {
        id: 'plan_test_1',
        assignedAt: nowMs - 3600_000,
        name: 'خطة مناجم',
        steps: [{ bName: 'الخشاب', targetLvl: 11, atype: 'bldg', cost: { w: 1000, c: 1200, i: 800 } }]
      }
    }
  ];

  const queue = buildAccountLoginQueue(state, {}, nowMs);
  assert.equal(queue.length, 3);
  assert.equal(queue[0].accountId, 'acc_crit');
  assert.equal(queue[0].urgencyTier, 'now');
  assert.ok(queue[0].triggers.some((t) => t.kind === 'warehouse_critical'));
  assert.ok(queue[0].triggers.some((t) => t.kind === 'scav_returned'));

  assert.equal(queue[1].accountId, 'acc_plan');
  assert.equal(queue[1].urgencyTier, 'now');
  assert.ok(queue[1].triggers.some((t) => t.kind === 'plan_step_ready'));

  assert.equal(queue[2].accountId, 'acc_standby');
  assert.equal(queue[2].urgencyTier, 'standby');
  assert.ok(queue[2].nextCheckHours !== null && queue[2].nextCheckHours > 0);
});

test('buildAccountPPFlow flags initial onboarding import jump without misclassifying subsequent days or manual edits', () => {
  const nowMs = Date.UTC(2026, 4, 10, 12, 0, 0);
  const sessions: any = {
    '2026-05-06': {
      a1: { startPP: 0, lastSyncedPP: 1500, targetPP: 1, lastSyncTime: nowMs - 4 * 86400_000 }
    },
    '2026-05-07': {
      a1: { startPP: 1500, lastSyncedPP: 1620, targetPP: 50, lastSyncTime: nowMs - 3 * 86400_000 }
    },
    '2026-05-08': {
      a1: { startPP: 0, lastSyncedPP: 400, targetPP: 1, manualAdjusted: true, lastSyncTime: nowMs - 2 * 86400_000 }
    }
  };

  const flow = buildAccountPPFlow({
    account: { id: 'a1', name: 'أبو يوسف', pp: 1620 },
    dailySessions: sessions,
    targetDailyPP: 50,
    daysCount: 7,
    nowMs
  });

  const d06 = flow.daysAsc.find((d) => d.dateKey === '2026-05-06');
  const d07 = flow.daysAsc.find((d) => d.dateKey === '2026-05-07');
  const d08 = flow.daysAsc.find((d) => d.dateKey === '2026-05-08');

  assert.equal(d06?.isOnboardingJump, true);
  assert.equal(d06?.netPP, 1500);
  assert.equal(d07?.isOnboardingJump, false);
  assert.equal(d07?.netPP, 120);
  assert.equal(d08?.isOnboardingJump, false);
});


