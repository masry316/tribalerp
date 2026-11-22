import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcScavDispatch,
  calcVillagePointsFromBuildings,
  computeFirestoreDashboardSummary,
  computeMerchantSellablePP,
  computeVillageLiveResourcesAndArmy,
  computeVillageLiveStatus,
  createDefaultAppState,
  getMineHourlyProd,
  getVillageUsedPop,
  mergeCloudSnapshotWithLocalSecrets,
  normalizeBuildingsMap,
  normalizeVillageTroops,
  processIncomingVillageSync,
  repairStateIntegrity,
  resolveConflictResolutionStrategy,
  sanitizeStateForFirestore,
  type ErpAppState,
  type ErpVillage
} from '../../src/core';

test('createDefaultAppState starts with zero hardcoded accounts and zero villages', () => {
  const s = createDefaultAppState();
  assert.equal(s.userAccounts.length, 0);
  assert.equal(s.villages.length, 0);
  assert.ok(s.worlds.length >= 1);
  assert.equal((s as any).uiConfig, undefined);
});

test('repairStateIntegrity strips uiConfig, removes synthetic starter villages, and normalizes legacy building keys', () => {
  const dirty: any = {
    uiConfig: { fontSize: 16, theme: 'dark' },
    userAccounts: [{ id: 'acc_1', name: 'حساب مضاف', pp: 250 }],
    villages: [
      {
        id: 'vil_1',
        name: 'قرية افتراضية قديمة',
        villagePoints: 820,
        warehouse: { woodStock: 12000 }
      },
      {
        id: 'vil_real',
        accountId: 'acc_1',
        worldId: 'w_94',
        continent: '44',
        name: 'قريتي الحقيقية',
        villagePoints: 500,
        flag: 0,
        woodItem: 0,
        clayItem: 0,
        ironItem: 0,
        premium: false,
        boost30: false,
        marketLevel: 5,
        farmLevel: 10,
        mines: {
          wood: { curr: 14, target: 20 },
          clay: { curr: 14, target: 20 },
          iron: { curr: 12, target: 20 }
        },
        warehouse: { level: 10, woodStock: 1000, clayStock: 1000, ironStock: 1000, lastUpdated: 1700000000000 },
        buildings: { 'المركز الرئيسي': 9, 'المخبأ': 3 }
      }
    ]
  };

  const repaired = repairStateIntegrity(dirty);
  assert.equal((repaired as any).uiConfig, undefined);
  assert.equal(repaired.userAccounts.length, 1);
  assert.equal(repaired.villages.length, 1);
  assert.equal(repaired.villages[0].id, 'vil_real');
  assert.equal(repaired.villages[0].buildings?.['المبنى الرئيسي'], 9);
  assert.equal(repaired.villages[0].buildings?.['المخابئ'], 3);
});

test('normalizeVillageTroops, sanitizeStateForFirestore, mergeCloudSnapshotWithLocalSecrets, and conflict resolution', () => {
  const troops = normalizeVillageTroops({
    unitsHome: { spear: 100, light: 25, knight: 1 },
    unitsAway: { spear: 40, heavy: 5 }
  });
  assert.equal(troops.spearsHome, 100);
  assert.equal(troops.spearsAway, 40);
  assert.equal(troops.spearsTotal, 140);
  assert.equal(troops.lightsHome, 25);
  assert.equal(troops.heaviesAway, 5);
  assert.equal(troops.unitsTotal.knight, 1);

  const state = createDefaultAppState();
  state.userAccounts = [{ id: 'a1', name: 'حساب 1', password: 'secret-password', pp: 500 }];
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
      marketLevel: 0,
      farmLevel: 1,
      mines: {
        wood: { curr: 1, target: 20 },
        clay: { curr: 1, target: 20 },
        iron: { curr: 1, target: 20 }
      },
      warehouse: { level: 1, woodStock: 100, clayStock: 100, ironStock: 100, lastUpdated: 1 },
      spearsHome: 50,
      spearsAway: 20
    }
  ];

  const prepared = sanitizeStateForFirestore(state);
  assert.equal(prepared.sanitizedState.userAccounts[0].password, '');
  assert.equal(prepared.accountsCount, 1);
  assert.equal(prepared.totalPP, 500);
  assert.equal(prepared.sanitizedState.villages[0].spearsTotal, 70);

  const merged = mergeCloudSnapshotWithLocalSecrets(prepared.sanitizedState as any, state);
  assert.equal(merged.userAccounts[0].password, 'secret-password');

  assert.equal(
    resolveConflictResolutionStrategy({
      localTimestamp: 2000,
      cloudTimestamp: 1000,
      hasPendingLocalChanges: true,
      deviceTagMatchesSelf: false
    }),
    'PUSH_LOCAL_TO_CLOUD'
  );
  assert.equal(
    resolveConflictResolutionStrategy({
      localTimestamp: 1000,
      cloudTimestamp: 3000,
      hasPendingLocalChanges: false,
      deviceTagMatchesSelf: false
    }),
    'APPLY_CLOUD_TO_LOCAL'
  );
  assert.equal(
    resolveConflictResolutionStrategy({
      localTimestamp: 3000,
      cloudTimestamp: 3500,
      hasPendingLocalChanges: false,
      deviceTagMatchesSelf: true
    }),
    'NO_OP'
  );
});

test('processIncomingVillageSync handles rejections, auto-creates account/world/village, syncs all 12 units & preserves active scavenge timer', () => {
  const base = createDefaultAppState();
  const emptyRes = processIncomingVillageSync(base, '');
  assert.equal(emptyRes.ok, false);
  const bmRes = processIncomingVillageSync(base, 'javascript:(function(){window.game_data={};})()');
  assert.equal(bmRes.ok, false);

  const now1 = 1_750_000_000_000;
  const payload1 = {
    playerName: 'أبو سلطان',
    pp: 850,
    villageId: '551',
    worldCode: 'ae95',
    name: 'قرية العز',
    coord: '495|502',
    woodLevel: 18,
    clayLevel: 19,
    ironLevel: 16,
    warehouseLevel: 12,
    marketLevel: 6,
    farmLevel: 14,
    woodStock: 2500,
    clayStock: 2600,
    ironStock: 1800,
    buildings: {
      'المبنى الرئيسي': 15,
      'الثكنات': 8,
      'الإسطبل': 5,
      'الخشاب': 18,
      'حفرة الطمي': 19,
      'منجم الحديد': 16
    },
    unitsHome: { spear: 100, light: 20 },
    unitsAway: { spear: 50, light: 10 },
    unlockedScavTiers: 3,
    scavReturnAt: now1 + 3600_000,
    scavNextReturnAt: now1 + 1800_000,
    scavActiveCount: 2,
    scavLoot: { wood: 400, clay: 400, iron: 400, total: 1200 },
    rates: { wood: 240, clay: 250, iron: 260 },
    ip: '156.210.44.12',
    device: 'Android 14',
    browser: 'Kiwi',
    deviceId: 'dev_abc'
  };

  const r1 = processIncomingVillageSync(base, payload1, now1);
  assert.equal(r1.ok, true);
  assert.equal(r1.isNewAccount, true);
  assert.equal(r1.isNewVillage, true);
  assert.equal(r1.continent, '54');
  assert.equal(r1.world?.id, 'w_95');
  assert.equal(r1.village?.lightsTotal, 30);
  assert.equal(r1.village?.spearsTotal, 150);

  // Second sync slightly later without scavReturnAt keeps ongoing scav timer
  const now2 = now1 + 60_000;
  const payload2 = {
    playerName: 'أبو سلطان',
    pp: 910,
    villageId: '551',
    worldCode: 'ae95',
    name: 'قرية العز',
    coord: '495|502',
    woodStock: 2700,
    buildings: { 'المبنى الرئيسي': 15, 'الثكنات': 8, 'الإسطبل': 0 }
  };
  const r2 = processIncomingVillageSync(r1.nextState!, payload2, now2);
  assert.equal(r2.ok, true);
  assert.equal(r2.isNewAccount, false);
  assert.equal(r2.isNewVillage, false);
  assert.equal(r2.account?.pp, 910);
  assert.equal(r2.village?.scavReturnAt, now1 + 3600_000);
  // Since الإسطبل is 0 in payload2, stable units should be zeroed cleanly
  assert.equal(r2.village?.lightsTotal, 0);
});

test('computeVillageLiveResourcesAndArmy, computeVillageLiveStatus, and computeFirestoreDashboardSummary compute rates and haul accurately', () => {
  const base = createDefaultAppState();
  const now0 = 1_750_000_000_000;
  const syncRes = processIncomingVillageSync(
    base,
    {
      playerName: 'سلطان',
      pp: 400,
      villageId: '77',
      worldCode: 'ae94',
      name: 'قرية النصر',
      coord: '510|480',
      woodLevel: 15,
      clayLevel: 15,
      ironLevel: 15,
      warehouseLevel: 12,
      marketLevel: 8,
      farmLevel: 12,
      woodStock: 1000,
      clayStock: 1000,
      ironStock: 1000,
      buildings: { 'الثكنات': 5, 'الإسطبل': 5 },
      unitsHome: { spear: 40, light: 25 },
      unitsAway: {},
      rates: { wood: 120, clay: 120, iron: 120 }
    },
    now0
  );
  assert.equal(syncRes.ok, true);
  const state = syncRes.nextState!;
  const vil = state.villages[0];

  const liveArmy = computeVillageLiveResourcesAndArmy(vil, {
    nowMs: now0 + 3600_000,
    worldSpeed: 1
  });
  assert.equal(liveArmy.haulHome, 40 * 25 + 25 * 80);
  assert.ok(liveArmy.currentWood > 1000);

  const liveStatus = computeVillageLiveStatus(vil, state, now0 + 3600_000);
  assert.equal(liveStatus.scavState, 'idle_troops');
  assert.equal(liveStatus.canScavenge, true);
  assert.equal(liveStatus.status, 'critical');
  assert.ok(liveStatus.dailyPP > 0);

  const summary = computeFirestoreDashboardSummary({ erpState: state, nowMs: now0 + 3600_000 });
  assert.equal(summary.villagesCount, 1);
  assert.equal(summary.accountsCount, 1);
  assert.equal(summary.totalHaulCapacity, 3000);
  assert.equal(summary.idleArmyVillagesCount, 1);
  assert.equal(summary.topPriorityVillage?.isIdleArmy, true);
});

test('building pop and points helpers stay consistent', () => {
  const b = normalizeBuildingsMap({ 'المبنى الرئيسي': 5, 'الخشاب': 10 });
  assert.ok(calcVillagePointsFromBuildings(b) > 26);
  const pop = getVillageUsedPop(b, { spear: 100, light: 10 });
  // 100*1 + 10*4 = 140 troop pop + buildings pop
  const bOnlyPop = getVillageUsedPop(b, 0, 0);
  assert.equal(pop - bOnlyPop, 140);
  assert.ok(getMineHourlyProd(10, true, 10, 0, false, 1) > getMineHourlyProd(10, false, 0, 0, false, 1));
});

test('computeMerchantSellablePP, scavActiveDailyPP, and isStaleSync report accurate capacities and sync freshness', () => {
  // 0 merchants -> 0 sellable
  assert.deepEqual(computeMerchantSellablePP(5000, 5000, 5000, 100, 200, 400, 0), {
    sellableNowRes: 0,
    sellableNowPP: 0
  });

  // 2 merchants = 2,000 cap -> greedily sells lowest sellRate (highest PP/res) first:
  // 1,500 wood @ 100 = 15 PP + 500 clay @ 200 = 2.5 PP -> 17.5 PP total
  const m = computeMerchantSellablePP(1500, 2000, 3000, 100, 200, 400, 2);
  assert.equal(m.sellableNowRes, 2000);
  assert.ok(Math.abs(m.sellableNowPP - 17.5) < 1e-6);

  const now0 = 1_750_000_000_000;
  const syncRes = processIncomingVillageSync(
    createDefaultAppState(),
    {
      playerName: 'سلطان',
      pp: 400,
      villageId: '88',
      worldCode: 'ae94',
      name: 'قرية التاجر',
      coord: '510|485',
      woodLevel: 12,
      clayLevel: 12,
      ironLevel: 12,
      warehouseLevel: 10,
      marketLevel: 3, // 3 merchants = 3000 capacity
      farmLevel: 10,
      woodStock: 5000,
      clayStock: 5000,
      ironStock: 5000,
      buildings: { 'الثكنات': 5 },
      unitsHome: { spear: 100 },
      unitsAway: { spear: 100 },
      unlockedScavTiers: 2,
      scavReturnAt: now0 + 3600_000,
      rates: { wood: 100, clay: 100, iron: 100 }
    },
    now0
  );
  const state = syncRes.nextState!;
  const vil = state.villages[0];

  // Fresh check (+30m): scav is running -> scavActiveDailyPP > 0, isStaleSync false
  const runningLive = computeVillageLiveStatus(vil, state, now0 + 1800_000);
  assert.equal(runningLive.scavState, 'running');
  assert.ok(runningLive.scavActiveDailyPP > 0);
  assert.equal(runningLive.isStaleSync, false);
  assert.ok(runningLive.sellableNowPP > 0);
  assert.ok(runningLive.sellableNowPP < runningLive.unsoldPP);

  const staleLive = computeVillageLiveStatus(vil, state, now0 + 25 * 3600_000);
  assert.equal(staleLive.isStaleSync, true);
  assert.equal(staleLive.scavActiveDailyPP, 0);
});

test('market capacity and headroom constrain selling and daily PP when market is full', () => {
  // Test computeMerchantSellablePP with headroom
  // Headroom: wood: 500, clay: 0 (full), iron: 1000
  const limited = computeMerchantSellablePP(
    3000, 3000, 3000,
    100, 100, 100,
    5, // 5 merchants = 5000 max capacity
    { wood: 500, clay: 0, iron: 1000 }
  );
  // Can only sell max 500 wood + 0 clay + 1000 iron = 1500 res -> 15 PP
  assert.equal(limited.sellableNowRes, 1500);
  assert.equal(limited.sellableNowPP, 15);

  // When all headrooms are 0:
  const blocked = computeMerchantSellablePP(
    3000, 3000, 3000,
    100, 100, 100,
    5,
    { wood: 0, clay: 0, iron: 0 }
  );
  assert.equal(blocked.sellableNowRes, 0);
  assert.equal(blocked.sellableNowPP, 0);

  // Test computeVillageLiveStatus when market is completely full in continent
  const state: ErpAppState = {
    ...createDefaultAppState(),
    worlds: [
      {
        id: 'w_test',
        name: 'عالم تجريبي',
        speed: 1.0,
        continents: {
          '44': {
            sellRate: 200,
            sellWood: 200,
            sellClay: 200,
            sellIron: 200,
            buyRate: 200,
            stockWood: 50000,
            stockClay: 50000,
            stockIron: 50000,
            capWood: 50000, // 100% full
            capClay: 50000, // 100% full
            capIron: 50000, // 100% full
            lastUpdated: Date.now()
          }
        }
      }
    ],
    villages: [
      {
        id: 'vil_full_mkt',
        accountId: 'acc_1',
        worldId: 'w_test',
        continent: '44',
        name: 'قرية سوق ممتلئ',
        villagePoints: 1000,
        marketLevel: 5,
        farmLevel: 10,
        flag: 0,
        woodItem: 0,
        clayItem: 0,
        ironItem: 0,
        premium: false,
        boost30: false,
        mines: {
          wood: { curr: 20, target: 20 },
          clay: { curr: 20, target: 20 },
          iron: { curr: 20, target: 20 }
        },
        warehouse: {
          level: 15,
          woodStock: 5000,
          clayStock: 5000,
          ironStock: 5000,
          lastUpdated: Date.now()
        }
      }
    ]
  };

  const liveFull = computeVillageLiveStatus(state.villages[0], state);
  assert.equal(liveFull.isMarketCompletelyBlocked, true);
  assert.equal(liveFull.mineDailyPP, 0);
  assert.equal(liveFull.scavDailyPP, 0);
  assert.equal(liveFull.dailyPP, 0);
  assert.equal(liveFull.unsoldPP, 0);
  assert.equal(liveFull.sellableNowPP, 0);

  // Test when village marketLevel is 0 (market not built)
  const noMarketVil: ErpVillage = {
    ...state.villages[0],
    id: 'vil_no_mkt',
    marketLevel: 0
  };
  const liveNoMkt = computeVillageLiveStatus(noMarketVil, state);
  assert.equal(liveNoMkt.isMarketClosed, true);
  assert.equal(liveNoMkt.dailyPP, 0);

  // Test computeFirestoreDashboardSummary reflects 0 daily PP
  const summary = computeFirestoreDashboardSummary({ erpState: state });
  assert.equal(summary.estimatedDailyPP, 0);
});

test('expected daily PP projects 24h mines and 12h scavenging independent of warehouse stock', () => {
  const now0 = 1_750_000_000_000;
  const base = createDefaultAppState();
  base.asimConfig.activeHrs = 18; // Even if legacy state stored 18h, daily projection stays 12h
  base.worlds = [
    {
      id: 'w_94',
      name: 'عالم 94',
      speed: 1,
      continents: {
        '44': { sellRate: 100, buyRate: 95, sellWood: 100, sellClay: 100, sellIron: 100, lastUpdated: now0 }
      }
    }
  ];
  const commonVil: ErpVillage = {
    id: 'v_proj',
    accountId: 'acc_1',
    worldId: 'w_94',
    continent: '44',
    name: 'قرية توقع',
    villagePoints: 800,
    marketLevel: 8,
    farmLevel: 10,
    flag: 0,
    woodItem: 0,
    clayItem: 0,
    ironItem: 0,
    premium: false,
    boost30: false,
    mines: {
      wood: { curr: 15, target: 15 },
      clay: { curr: 15, target: 15 },
      iron: { curr: 15, target: 15 }
    },
    warehouse: {
      level: 12,
      woodStock: 0,
      clayStock: 0,
      ironStock: 0,
      lastUpdated: now0
    },
    unitsTotal: { spear: 150, sword: 30 },
    unlockedScavTiers: 2,
    lastSyncTime: now0
  };
  const emptyStockLive = computeVillageLiveStatus(commonVil, base, now0);
  const fullStockLive = computeVillageLiveStatus(
    {
      ...commonVil,
      warehouse: {
        level: 12,
        woodStock: 10000,
        clayStock: 10000,
        ironStock: 10000,
        lastUpdated: now0
      }
    },
    base,
    now0
  );

  // Expected mines (24h) & scav (12h) must be identical regardless of warehouse stock
  assert.equal(emptyStockLive.mineDailyPP, fullStockLive.mineDailyPP);
  assert.equal(emptyStockLive.scavDailyPP, fullStockLive.scavDailyPP);
  assert.equal(emptyStockLive.dailyPP, fullStockLive.dailyPP);
  assert.ok(emptyStockLive.mineDailyPP > 0);
  assert.ok(emptyStockLive.scavDailyPP > 0);
  assert.equal(emptyStockLive.unsoldPP, 0);
  assert.ok(fullStockLive.unsoldPP > 0);

  // Verify scavDailyPP equals calcScavDispatch with 12 active hours specifically
  const expectedScav12 = calcScavDispatch(150, 30, 2, 2, 12, 1, 'max_profit', 1);
  assert.ok(Math.abs(emptyStockLive.scavDailyPP - expectedScav12.dailyLoot / 100) < 1e-6);
});


