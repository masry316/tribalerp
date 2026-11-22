import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  computeVillageLiveStatus,
  createDefaultAppState,
  filterAndSortEfficiencyRows,
  filterAndSortProfitRows
} from '../../src/core';
import { mutateSaveAccount, mutateSaveVillage, mutateSetVillageRole } from '../../src/data';
import { buildRoutePath, parseRoutePath } from '../../src/ui/router';
import {
  buildContinentSellGroups,
  buildDashboardAlerts,
  buildDashboardDailyFlow,
  buildDashboardOverviewColumns,
  buildDashboardResourcesAndAttacksSeries,
  buildDistributionAttribution,
  buildEfficiencyReportRows,
  buildHeaderNotifications,
  buildProfitReportRows,
  buildVillageArmyBreakdown,
  buildVillageRadarTileData,
  buildWorldMapData,
  countNotificationsByCategory,
  filterNotificationsByCategory,
  parseVillageCoord,
  projectWorldCoordToPct
} from '../../src/ui/viewModels';

test('URL router parses and builds all system routes cleanly', () => {
  assert.deepEqual(parseRoutePath('/'), { page: 'dashboard', tab: 'dashboard' });
  assert.deepEqual(parseRoutePath('/dashboard/'), { page: 'dashboard', tab: 'dashboard' });
  assert.deepEqual(parseRoutePath('/accounts'), { page: 'accounts', tab: 'accounts' });
  assert.deepEqual(parseRoutePath('/accounts/acc_123'), {
    page: 'account_flow',
    tab: 'accounts',
    accountId: 'acc_123'
  });
  assert.deepEqual(parseRoutePath('/villages/vil_99'), {
    page: 'village_detail',
    tab: 'dashboard',
    villageId: 'vil_99'
  });
  assert.deepEqual(parseRoutePath('/reports'), { page: 'reports', tab: 'reports' });
  assert.deepEqual(parseRoutePath('/planner'), { page: 'planner', tab: 'planner' });
  assert.equal(parseRoutePath('/settings').page, 'settings');
  assert.deepEqual(parseRoutePath('/pro'), { page: 'not_found', tab: 'dashboard', rawPath: '/pro' });
  assert.deepEqual(parseRoutePath('/unknown/route'), {
    page: 'not_found',
    tab: 'dashboard',
    rawPath: '/unknown/route'
  });

  assert.equal(buildRoutePath({ page: 'planner', tab: 'planner' }), '/planner');
  assert.equal(buildRoutePath({ page: 'account_flow', tab: 'accounts', accountId: 'a b' }), '/accounts/a%20b');
  assert.equal(buildRoutePath({ page: 'village_detail', tab: 'dashboard', villageId: 'v_1' }), '/villages/v_1');
});

test('viewModels build profit, efficiency, and alerts reports accurately', () => {
  let state = createDefaultAppState();
  const acc1Res = mutateSaveAccount(state, {
    id: 'acc_1',
    name: 'لاعب أول',
    pp: 2400,
    ip: '197.1.2.3',
    device: 'PC-1',
    browser: 'Chrome',
    email: 'a@example.com',
    password: ''
  });
  assert.equal(acc1Res.ok, true);
  state = acc1Res.state;

  const acc2Res = mutateSaveAccount(state, {
    id: 'acc_2',
    name: 'لاعب ثاني',
    pp: 1200,
    ip: '197.1.2.3',
    device: 'PC-2',
    browser: 'Firefox',
    email: 'b@example.com',
    password: ''
  });
  assert.equal(acc2Res.ok, true);
  state = acc2Res.state;

  const vilRes = mutateSaveVillage(state, {
    id: 'vil_1',
    name: 'قرية اختبار',
    accountId: 'acc_1',
    worldId: 'w_94',
    continent: '44',
    coord: '501|502',
    flag: 10,
    woodItem: 0,
    clayItem: 0,
    ironItem: 0,
    premium: true,
    boost30: false,
    warehouseLevel: 1,
    marketLevel: 5,
    farmLevel: 5,
    woodLevel: 10,
    clayLevel: 10,
    ironLevel: 10,
    woodStock: 950,
    clayStock: 500,
    ironStock: 400,
    spearsTotal: 50,
    swordsTotal: 20,
    axesTotal: 0,
    lightsTotal: 0,
    heaviesTotal: 0,
    unlockedScavTiers: 2
  });
  assert.equal(vilRes.ok, true);
  state = vilRes.state;

  const vil2Res = mutateSaveVillage(state, {
    id: 'vil_2',
    name: 'قرية ثانية',
    accountId: 'acc_2',
    worldId: 'w_94',
    continent: '45',
    coord: '510|510',
    flag: 0,
    woodItem: 0,
    clayItem: 0,
    ironItem: 0,
    premium: false,
    boost30: false,
    warehouseLevel: 5,
    marketLevel: 1,
    farmLevel: 3,
    woodLevel: 5,
    clayLevel: 5,
    ironLevel: 5,
    woodStock: 200,
    clayStock: 200,
    ironStock: 200,
    spearsTotal: 0,
    swordsTotal: 0,
    axesTotal: 0,
    lightsTotal: 0,
    heaviesTotal: 0,
    unlockedScavTiers: 0
  });
  assert.equal(vil2Res.ok, true);
  state = vil2Res.state;

  const profitRows = filterAndSortProfitRows(buildProfitReportRows(state));
  assert.equal(profitRows.length, 2);
  assert.equal(profitRows.every((r) => r.hasIpIssue === true), true);

  const effRows = filterAndSortEfficiencyRows(buildEfficiencyReportRows(state));
  assert.equal(effRows.length, 2);
  assert.equal(effRows[0].villageId, 'vil_1');

  const alerts = buildDashboardAlerts(state);
  assert.equal(alerts.some((a) => a.category === 'warehouse'), true);
  assert.equal(alerts.some((a) => a.category === 'scav'), true);
  assert.equal(alerts.some((a) => a.category === 'security'), true);
});

test('buildContinentSellGroups groups sellable stock and opportunities by world and continent', () => {
  let state = createDefaultAppState();
  state = mutateSaveAccount(state, { id: 'acc_a', name: 'ألفا', pp: 500 }).state;
  state = mutateSaveVillage(state, {
    id: 'v_44a',
    name: 'قرية 44 الأولى',
    accountId: 'acc_a',
    worldId: 'w_94',
    continent: '44',
    warehouseLevel: 10,
    marketLevel: 8,
    woodStock: 4000,
    clayStock: 4000,
    ironStock: 4000
  }).state;
  state = mutateSaveVillage(state, {
    id: 'v_44b',
    name: 'قرية 44 الثانية',
    accountId: 'acc_a',
    worldId: 'w_94',
    continent: '44',
    warehouseLevel: 10,
    marketLevel: 6,
    woodStock: 3000,
    clayStock: 2500,
    ironStock: 2500
  }).state;
  state = mutateSaveVillage(state, {
    id: 'v_55',
    name: 'قرية 55',
    accountId: 'acc_a',
    worldId: 'w_94',
    continent: '55',
    warehouseLevel: 5,
    marketLevel: 0,
    woodStock: 500,
    clayStock: 500,
    ironStock: 500
  }).state;

  const contexts = state.villages.map((vil) => ({
    vil,
    acc: state.userAccounts.find((a) => a.id === vil.accountId) || null,
    live: computeVillageLiveStatus(vil, state)
  }));
  const groups = buildContinentSellGroups(contexts, state);
  assert.equal(groups.length, 2);
  const k44 = groups.find((g) => g.continent === '44');
  assert.ok(k44);
  assert.equal(k44.villagesCount, 2);
  assert.equal(k44.opportunityCount, 2);
  assert.ok(k44.totalSellableNowPP > 0);
  const k55 = groups.find((g) => g.continent === '55');
  assert.ok(k55);
  assert.equal(k55.opportunityCount, 0);
  assert.equal(k55.isMarketClosed, true);
});

test('UI integrates Tailwind CSS v4 and avoids forbidden browser popups', () => {
  const indexCssPath = path.resolve(process.cwd(), 'src/index.css');
  assert.equal(fs.existsSync(indexCssPath), true, 'src/index.css must exist');
  const cssContent = fs.readFileSync(indexCssPath, 'utf8');
  assert.equal(cssContent.includes('@import "tailwindcss";'), true);
  assert.equal(cssContent.includes('@custom-variant dark'), true);

  const uiDir = path.resolve(process.cwd(), 'src/ui');
  const filesToCheck = [path.resolve(process.cwd(), 'src/App.tsx')];

  function collectFiles(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) collectFiles(full);
      else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) filesToCheck.push(full);
    }
  }
  collectFiles(uiDir);

  for (const file of filesToCheck) {
    const content = fs.readFileSync(file, 'utf8');
    assert.equal(
      /window\.(alert|confirm|open|prompt)/.test(content),
      false,
      `Forbidden window popup in ${file}`
    );
  }
});

test('dashboard chart aggregators preserve KPI sums and include per-account attribution across 7d and 14d windows', () => {
  let state = createDefaultAppState();
  state = mutateSaveAccount(state, { id: 'acc_a', name: 'ألفا', pp: 1500, ip: '197.10.1.1' }).state;
  state = mutateSaveAccount(state, { id: 'acc_b', name: 'بيتا', pp: 900, ip: '197.10.1.2' }).state;
  state = mutateSaveVillage(state, {
    id: 'v_a',
    name: 'قرية K44',
    accountId: 'acc_a',
    worldId: 'w_94',
    continent: '44',
    warehouseLevel: 10,
    marketLevel: 8,
    woodLevel: 14,
    clayLevel: 14,
    ironLevel: 14,
    woodStock: 3500,
    clayStock: 2800,
    ironStock: 1900,
    spearsTotal: 120,
    unlockedScavTiers: 2
  }).state;
  state = mutateSaveVillage(state, {
    id: 'v_b',
    name: 'قرية K55',
    accountId: 'acc_b',
    worldId: 'w_94',
    continent: '55',
    warehouseLevel: 10,
    marketLevel: 6,
    woodLevel: 12,
    clayLevel: 12,
    ironLevel: 12,
    woodStock: 1500,
    clayStock: 1200,
    ironStock: 900,
    spearsTotal: 0,
    unlockedScavTiers: 0
  }).state;

  const filtered = state.villages.map((vil) => ({
    vil,
    acc: state.userAccounts.find((a) => a.id === vil.accountId) || null,
    live: computeVillageLiveStatus(vil, state)
  }));

  const expectedMines = filtered.reduce((s, x) => s + x.live.mineDailyPP, 0);
  const expectedScav = filtered.reduce((s, x) => s + Math.max(0, x.live.dailyPP - x.live.mineDailyPP), 0);
  const expectedUnsold = filtered.reduce((s, x) => s + Math.max(0, x.live.unsoldPP), 0);

  const cols = buildDashboardOverviewColumns(filtered, 'all');
  assert.equal(cols.length, 2);
  assert.ok(cols.every((c) => c.accountsBreakdown.length === 1));
  const totalDailyFromCols = cols.reduce((s, c) => s + c.dailyPP, 0);
  assert.ok(totalDailyFromCols > 0);

  const flow7 = buildDashboardDailyFlow(state, 7);
  const flow14 = buildDashboardDailyFlow(state, 14);
  assert.equal(flow7.dayPoints.length, 7);
  assert.equal(flow14.dayPoints.length, 14);

  const dist = buildDistributionAttribution(filtered);
  assert.ok(Math.abs(dist.minesAccounts.reduce((s, x) => s + x.pp, 0) - expectedMines) < 1e-6);
  assert.ok(Math.abs(dist.scavAccounts.reduce((s, x) => s + x.pp, 0) - expectedScav) < 1e-6);
  assert.ok(Math.abs(dist.unsoldAccounts.reduce((s, x) => s + x.pp, 0) - expectedUnsold) < 1e-6);
  assert.ok((dist.unsoldAccounts[0]?.sellableNowPP ?? 0) > 0);
  assert.equal(dist.scavAccounts.reduce((s, x) => s + (x.activeScavPP || 0), 0), 0);
});

test('buildDashboardDailyFlow separates earnedPeriodNetPP from initial onboarding jump', () => {
  const nowMs = Date.UTC(2026, 4, 10, 12, 0, 0);
  let state = createDefaultAppState();
  state = mutateSaveAccount(state, { id: 'acc_1', name: 'حساب 1', pp: 1650 }).state;
  state.dailySessions = {
    '2026-05-06': {
      acc_1: { startPP: 0, lastSyncedPP: 1500, targetPP: 1, lastSyncTime: nowMs - 4 * 86400_000 }
    },
    '2026-05-07': {
      acc_1: { startPP: 1500, lastSyncedPP: 1620, targetPP: 60, lastSyncTime: nowMs - 3 * 86400_000 }
    },
    '2026-05-10': {
      acc_1: { startPP: 1620, lastSyncedPP: 1650, targetPP: 60, lastSyncTime: nowMs }
    }
  };

  const flow = buildDashboardDailyFlow(state, 7, undefined, nowMs);
  assert.equal(flow.hasOnboardingJump, true);
  assert.equal(flow.onboardingJumpPP, 1500);
  assert.equal(flow.periodNetPP, 1650);
  assert.equal(flow.earnedPeriodNetPP, 150);
  assert.equal(flow.todayNetPP, 30);
  // Prior earned day avg = 120, today = 30 -> (30-120)/120 = -75%
  assert.equal(flow.earnedDeltaPct, -75);
});

test('radar tiles, categorized header notifications, and analytics series work cleanly', () => {
  const nowMs = Date.UTC(2026, 4, 10, 12, 0, 0);
  let state = createDefaultAppState();
  state = mutateSaveAccount(state, { id: 'acc_1', name: 'حساب 1', pp: 1000, ip: '10.0.0.1' }, nowMs).state;
  state = mutateSaveAccount(state, { id: 'acc_2', name: 'حساب 2', pp: 800, ip: '10.0.0.1' }, nowMs).state;
  state = mutateSaveVillage(state, {
    id: 'v_crit',
    name: 'قرية الحرج',
    accountId: 'acc_1',
    worldId: 'w_94',
    continent: '44',
    coord: '500|500',
    warehouseLevel: 1,
    marketLevel: 5,
    woodLevel: 12,
    clayLevel: 12,
    ironLevel: 12,
    woodStock: 960,
    clayStock: 500,
    ironStock: 400,
    spearsTotal: 80,
    unlockedScavTiers: 2
  }, nowMs).state;
  state = mutateSaveVillage(state, {
    id: 'v_safe',
    name: 'قرية الآمن',
    accountId: 'acc_2',
    worldId: 'w_94',
    continent: '45',
    coord: '520|520',
    warehouseLevel: 12,
    marketLevel: 8,
    woodLevel: 10,
    clayLevel: 10,
    ironLevel: 10,
    woodStock: 1000,
    clayStock: 1000,
    ironStock: 1000,
    spearsTotal: 0,
    unlockedScavTiers: 0
  }, nowMs).state;

  const critVil = state.villages.find((v) => v.id === 'v_crit')!;
  const critAcc = state.userAccounts.find((a) => a.id === 'acc_1')!;
  const critLive = computeVillageLiveStatus(critVil, state, nowMs);
  const tile = buildVillageRadarTileData(critVil, critAcc, critLive, state);
  assert.equal(tile.tone, 'critical');
  assert.equal(tile.villageName, 'قرية الحرج');

  const notifs = buildHeaderNotifications(state, nowMs);
  const counts = countNotificationsByCategory(notifs);
  assert.ok(counts.all >= 3);
  assert.equal(counts.security, 1);
  assert.equal(counts.warehouse >= 1, true);
  assert.equal(counts.scav >= 1, true);
  assert.equal(filterNotificationsByCategory(notifs, 'security').length, 1);
  assert.equal(filterNotificationsByCategory(notifs, 'all').length, counts.all);

  const contexts = state.villages.map((vil) => ({
    vil,
    acc: state.userAccounts.find((a) => a.id === vil.accountId) || null,
    live: computeVillageLiveStatus(vil, state, nowMs)
  }));
  const seriesAll = buildDashboardResourcesAndAttacksSeries(state, contexts, 7, 'all', nowMs);
  const seriesAcc1 = buildDashboardResourcesAndAttacksSeries(state, contexts, 7, 'acc_1', nowMs);
  assert.equal(seriesAll.points.length, 7);
  assert.equal(seriesAcc1.points.length, 7);
  assert.ok(seriesAll.totalMineResK >= seriesAcc1.totalMineResK);
});

test('4-continent world map enforces strict quadrant boundaries for 60+ dense villages, tracks roles, and supports fit/continent zoom', () => {
  assert.deepEqual(parseVillageCoord('452|489'), { x: 452, y: 489 });
  assert.deepEqual(parseVillageCoord(' 510 | 575 '), { x: 510, y: 575 });
  assert.equal(parseVillageCoord('invalid'), null);
  assert.equal(parseVillageCoord(''), null);

  // Cell-center projection keeps x=499 strictly West of 50% and x=500 strictly East of 50%
  const westEdge = projectWorldCoordToPct(499, 499, 'all');
  const eastEdge = projectWorldCoordToPct(500, 499, 'all');
  assert.ok(westEdge.xPct < 50 && westEdge.yPct < 50, '499|499 must stay strictly inside K44 (NW)');
  assert.ok(eastEdge.xPct > 50 && eastEdge.yPct < 50, '500|499 must stay strictly inside K45 (NE)');

  const k45Zoom = projectWorldCoordToPct(550, 450, '45');
  assert.ok(Math.abs(k45Zoom.xPct - 50.5) < 0.01);
  assert.ok(Math.abs(k45Zoom.yPct - 50.5) < 0.01);

  let state = createDefaultAppState();
  state = mutateSaveAccount(state, { id: 'acc_map', name: 'قائد الخريطة', pp: 1000 }).state;

  // Create 60 dense villages clustered right around the X=500 / Y=500 continent borders across all 4 continents
  const roles = ['offense', 'defense', 'unset'] as const;
  for (let i = 0; i < 60; i++) {
    const q = i % 4;
    const x = q === 0 || q === 2 ? 499 - (i % 6) : 500 + (i % 6);
    const y = q === 0 || q === 1 ? 499 - (Math.floor(i / 4) % 8) : 500 + (Math.floor(i / 4) % 8);
    const continent = q === 0 ? '44' : q === 1 ? '45' : q === 2 ? '54' : '55';
    state = mutateSaveVillage(state, {
      id: `v_dense_${i}`,
      name: `قرية ${i}`,
      accountId: 'acc_map',
      worldId: 'w_94',
      continent,
      coord: `${x}|${y}`,
      villageRole: roles[i % 3],
      warehouseLevel: 10,
      marketLevel: 5,
      woodLevel: 12,
      clayLevel: 12,
      ironLevel: 12
    }).state;
  }

  // Test one-click role mutation
  const roleRes = mutateSetVillageRole(state, 'v_dense_2', 'offense');
  assert.equal(roleRes.ok, true);
  state = roleRes.state;
  assert.equal(state.villages.find((v) => v.id === 'v_dense_2')?.villageRole, 'offense');

  const contexts = state.villages.map((vil) => ({
    vil,
    acc: state.userAccounts.find((a) => a.id === vil.accountId) || null,
    live: computeVillageLiveStatus(vil, state)
  }));

  for (const mode of ['all', 'fit'] as const) {
    const map = buildWorldMapData(contexts, state, mode);
    assert.equal(map.totalVillages, 60);
    assert.equal(map.continents.length, 4);
    assert.ok(map.axisXPct !== null && map.axisYPct !== null, `Mode ${mode} should expose continent split axes`);

    for (const pt of map.visiblePoints) {
      if (pt.continent === '44') {
        assert.ok(pt.xPct < map.axisXPct! && pt.yPct < map.axisYPct!, `K44 pin ${pt.coordText} crossed border in ${mode}`);
      } else if (pt.continent === '45') {
        assert.ok(pt.xPct > map.axisXPct! && pt.yPct < map.axisYPct!, `K45 pin ${pt.coordText} crossed into NW/SE in ${mode}`);
      } else if (pt.continent === '54') {
        assert.ok(pt.xPct < map.axisXPct! && pt.yPct > map.axisYPct!, `K54 pin ${pt.coordText} crossed border in ${mode}`);
      } else if (pt.continent === '55') {
        assert.ok(pt.xPct > map.axisXPct! && pt.yPct > map.axisYPct!, `K55 pin ${pt.coordText} crossed border in ${mode}`);
      }
    }
  }

  const fullMap = buildWorldMapData(contexts, state, 'all');
  assert.equal(fullMap.roleCounts.offense + fullMap.roleCounts.defense + fullMap.roleCounts.unset, 60);
  assert.equal(fullMap.roleCounts.offense, 21);
  assert.equal(fullMap.roleCounts.defense, 20);
  assert.equal(fullMap.roleCounts.unset, 19);

  // Zoomed K45 view should only show K45 villages (15 out of 60)
  const zoomedK45 = buildWorldMapData(contexts, state, '45');
  assert.equal(zoomedK45.visiblePoints.length, 15);
  assert.equal(zoomedK45.visiblePoints.every((p) => p.continent === '45'), true);
});

test('buildVillageArmyBreakdown exposes all 12 Tribal Wars units with home/away/total, haul, and population', () => {
  let state = createDefaultAppState();
  state = mutateSaveAccount(state, { id: 'acc_army', name: 'قائد الجيش', pp: 500 }).state;
  state = mutateSaveVillage(state, {
    id: 'v_army',
    name: 'قرية الجيش',
    accountId: 'acc_army',
    worldId: 'w_94',
    continent: '45',
    coord: '515|485',
    spearsTotal: 400,
    swordsTotal: 250,
    axesTotal: 150,
    lightsTotal: 60,
    heaviesTotal: 20
  }).state;

  const vil = state.villages[0];
  vil.unitsHome = { spear: 300, sword: 250, axe: 150, spy: 30, light: 40, heavy: 20, ram: 15, snob: 1 };
  vil.unitsAway = { spear: 100, light: 20 };
  vil.unitsTotal = { spear: 400, sword: 250, axe: 150, spy: 30, light: 60, heavy: 20, ram: 15, snob: 1 };

  const army = buildVillageArmyBreakdown(vil);
  assert.equal(army.units.length, 12);
  const spear = army.units.find((u) => u.key === 'spear')!;
  const axe = army.units.find((u) => u.key === 'axe')!;
  const light = army.units.find((u) => u.key === 'light')!;
  const snob = army.units.find((u) => u.key === 'snob')!;

  assert.equal(spear.home, 300);
  assert.equal(spear.away, 100);
  assert.equal(spear.total, 400);
  assert.equal(axe.total, 150);
  assert.equal(light.home, 40);
  assert.equal(light.away, 20);
  assert.equal(snob.total, 1);
  assert.equal(army.totalHome, 806);
  assert.equal(army.totalAway, 120);
  assert.equal(army.totalAll, 926);
  assert.ok(army.totalHaulCap > 0);
  assert.ok(army.totalPop > 1000);
});




