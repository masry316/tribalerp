import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeVillageLiveStatus,
  createDefaultAppState,
  getCairoDateKey,
  shiftCairoDateKey
} from '../../src/core';
import { mutateSaveAccount, mutateSaveVillage } from '../../src/data/stateMutations';
import { buildDashboardGrowthReport } from '../../src/ui/growthReportViewModel';

test('buildDashboardGrowthReport generates accurate 7/14/30d resource & village series from Firestore state', () => {
  const nowMs = Date.UTC(2026, 10, 19, 14, 0, 0);
  const todayKey = getCairoDateKey(nowMs);
  const dayMinus5 = shiftCairoDateKey(todayKey, -5);
  const dayMinus2 = shiftCairoDateKey(todayKey, -2);
  const dayMinus1 = shiftCairoDateKey(todayKey, -1);

  let state = createDefaultAppState();
  const accRes = mutateSaveAccount(state, { name: 'Alpha', pp: 1500, ip: '10.0.0.1' });
  assert.equal(accRes.ok, true);
  state = accRes.state;
  const accId = state.userAccounts[0].id;
  const worldId = state.worlds[0].id;

  const v1Res = mutateSaveVillage(state, {
    accountId: accId,
    worldId,
    name: 'Capital',
    continent: '44',
    coord: '450|450',
    woodLevel: 20,
    clayLevel: 20,
    ironLevel: 18,
    warehouseLevel: 18,
    woodStock: 12000,
    clayStock: 11000,
    ironStock: 9000,
    spearsTotal: 400
  });
  assert.equal(v1Res.ok, true);
  state = v1Res.state;

  const v2Res = mutateSaveVillage(state, {
    accountId: accId,
    worldId,
    name: 'Outpost',
    continent: '45',
    coord: '520|460',
    woodLevel: 14,
    clayLevel: 14,
    ironLevel: 12,
    warehouseLevel: 14,
    woodStock: 5000,
    clayStock: 5000,
    ironStock: 4000,
    spearsTotal: 150
  });
  assert.equal(v2Res.ok, true);
  state = v2Res.state;

  // Stamp realistic Firestore historical timestamps:
  // v1 existed 5 days ago, v2 was discovered 2 days ago
  const fiveDaysAgoMs = nowMs - 5 * 86_400_000;
  const twoDaysAgoMs = nowMs - 2 * 86_400_000;
  state.villages[0].lastSyncTime = fiveDaysAgoMs;
  state.villages[0].warehouse.lastUpdated = fiveDaysAgoMs;
  state.villages[1].lastSyncTime = twoDaysAgoMs;
  state.villages[1].warehouse.lastUpdated = twoDaysAgoMs;
  // Isolate v2 on a second account so its discovery date isn't inherited from acc1's older ppLog
  const acc2Res = mutateSaveAccount(state, { name: 'Beta', pp: 600, ip: '10.0.0.2' });
  assert.equal(acc2Res.ok, true);
  state = acc2Res.state;
  const acc2Id = state.userAccounts[1].id;
  state.villages[1].accountId = acc2Id;

  // Firestore PP history & daily sessions
  state.dailySessions = {
    [dayMinus5]: {
      [accId]: { startPP: 1100, targetPP: 100, lastSyncedPP: 1200, lastSyncTime: fiveDaysAgoMs }
    },
    [dayMinus2]: {
      [accId]: { startPP: 1300, targetPP: 100, lastSyncedPP: 1380, lastSyncTime: twoDaysAgoMs },
      [acc2Id]: { startPP: 500, targetPP: 50, lastSyncedPP: 540, lastSyncTime: twoDaysAgoMs }
    },
    [dayMinus1]: {
      [accId]: { startPP: 1380, targetPP: 100, lastSyncedPP: 1450, lastSyncTime: nowMs - 86_400_000 },
      [acc2Id]: { startPP: 540, targetPP: 50, lastSyncedPP: 580, lastSyncTime: nowMs - 86_400_000 }
    }
  };
  state.ppLog = {
    [accId]: [
      { t: fiveDaysAgoMs, pp: 1200 },
      { t: nowMs, pp: 1500 }
    ],
    [acc2Id]: [
      { t: twoDaysAgoMs, pp: 540 },
      { t: nowMs, pp: 600 }
    ]
  };

  const scoped = state.villages.map((vil) => ({
    vil,
    acc: state.userAccounts.find((a) => a.id === vil.accountId) || null,
    live: computeVillageLiveStatus(vil, state, nowMs)
  }));

  const report7 = buildDashboardGrowthReport(state, scoped, 7, nowMs);
  const report14 = buildDashboardGrowthReport(state, scoped, 14, nowMs);
  const report30 = buildDashboardGrowthReport(state, scoped, 30, nowMs);

  assert.equal(report7.resourceSeries.length, 7);
  assert.equal(report7.villageSeries.length, 7);
  assert.equal(report14.resourceSeries.length, 14);
  assert.equal(report30.resourceSeries.length, 30);

  // Verify resource series math & monotonic cumulative total
  let prevCum = 0;
  for (const pt of report7.resourceSeries) {
    const sum = Math.round((pt.woodK + pt.clayK + pt.ironK + pt.raidK) * 10) / 10;
    assert.equal(pt.totalDailyK, sum);
    assert.ok(pt.cumulativeTotalK >= prevCum);
    prevCum = pt.cumulativeTotalK;
  }

  // Verify village count steps up on dayMinus2 when Outpost first appeared
  const beforeOutpost = report7.villageSeries.find((p) => p.dateKey === dayMinus5);
  const onOutpostDay = report7.villageSeries.find((p) => p.dateKey === dayMinus2);
  const onToday = report7.villageSeries[report7.villageSeries.length - 1];
  assert.equal(beforeOutpost?.villagesCount, 1);
  assert.equal(onOutpostDay?.villagesCount, 2);
  assert.equal(onOutpostDay?.newVillagesCount, 1);
  assert.equal(onToday.villagesCount, 2);
  assert.equal(onToday.totalPP, 2100);
  assert.ok(report7.kpis.periodNetPP > 0);

  // Continent breakdown includes K44 and K45 with exact village counts
  const k44 = report7.continentBreakdown.find((c) => c.code === '44');
  const k45 = report7.continentBreakdown.find((c) => c.code === '45');
  assert.equal(k44?.villagesCount, 1);
  assert.equal(k45?.villagesCount, 1);
  assert.ok((k44?.totalDailyK || 0) > (k45?.totalDailyK || 0));

  // Village rows sorted descending by totalDailyRes
  assert.equal(report7.villageRows.length, 2);
  assert.equal(report7.villageRows[0].villageName, 'Capital');
});

test('buildDashboardGrowthReport handles empty village sets gracefully', () => {
  const state = createDefaultAppState();
  const report = buildDashboardGrowthReport(state, [], 14, Date.UTC(2026, 10, 19, 12, 0, 0));
  assert.equal(report.resourceSeries.length, 14);
  assert.equal(report.villageSeries.length, 14);
  assert.equal(report.kpis.villagesCount, 0);
  assert.equal(report.kpis.dailyResourcesTotal, 0);
  assert.equal(report.villageRows.length, 0);
});
