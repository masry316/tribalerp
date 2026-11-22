import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeVillageLiveStatus,
  createDefaultAppState,
  getCairoDateKey,
  shiftCairoDateKey,
  type ErpAppState
} from '../../src/core/index.ts';
import { buildDashboardResourcesAndAttacksSeries } from '../../src/ui/viewModels.ts';

function buildFixtureState(nowMs: number): ErpAppState {
  const base = createDefaultAppState();
  const todayKey = getCairoDateKey(nowMs);
  const yesterdayKey = shiftCairoDateKey(todayKey, -1);

  const state: ErpAppState = {
    ...base,
    userAccounts: [
      {
        id: 'acc_res',
        name: 'حساب_موارد',
        pp: 1200,
        lastSyncTime: nowMs - 30 * 60000,
        loginHistory: [{ date: todayKey, device: 'Chrome', ip: '197.10.1.1', ts: nowMs }]
      },
      {
        id: 'acc_mil',
        name: 'حساب_هجومي',
        pp: 850,
        lastSyncTime: nowMs - 20 * 60000,
        loginHistory: [{ date: yesterdayKey, device: 'AdsPower', ip: '197.10.2.2', ts: nowMs - 86400_000 }]
      }
    ],
    villages: [
      {
        id: 'vil_res',
        accountId: 'acc_res',
        worldId: 'w94',
        continent: '44',
        name: 'قرية_المناجم',
        coord: '480|510',
        villagePoints: 650,
        flag: 0,
        woodItem: 0,
        clayItem: 0,
        ironItem: 0,
        premium: true,
        boost30: false,
        marketLevel: 8,
        farmLevel: 12,
        mines: {
          wood: { curr: 18, target: 20 },
          clay: { curr: 18, target: 20 },
          iron: { curr: 16, target: 20 }
        },
        warehouse: {
          level: 14,
          woodStock: 14500,
          clayStock: 14200,
          ironStock: 9000,
          lastUpdated: nowMs - 10 * 60000
        },
        buildings: { الخشاب: 18, 'حفرة الطمي': 18, 'منجم الحديد': 16, المخزن: 14, السوق: 8, الثكنات: 2 },
        unitsHome: { spear: 20 },
        unitsTotal: { spear: 20 }
      },
      {
        id: 'vil_mil',
        accountId: 'acc_mil',
        worldId: 'w94',
        continent: '44',
        name: 'قلعة_الهجوم',
        coord: '490|520',
        villagePoints: 1120,
        flag: 0,
        woodItem: 0,
        clayItem: 0,
        ironItem: 0,
        premium: false,
        boost30: false,
        marketLevel: 4,
        farmLevel: 16,
        mines: {
          wood: { curr: 10, target: 15 },
          clay: { curr: 10, target: 15 },
          iron: { curr: 10, target: 15 }
        },
        warehouse: {
          level: 12,
          woodStock: 2400,
          clayStock: 2100,
          ironStock: 1900,
          lastUpdated: nowMs - 10 * 60000
        },
        buildings: { الخشاب: 10, 'حفرة الطمي': 10, 'منجم الحديد': 10, المخزن: 12, الثكنات: 9, الإسطبل: 4 },
        unitsHome: { spear: 150, axe: 120, light: 65 },
        unitsAway: { axe: 90, light: 45 },
        unitsTotal: { spear: 150, axe: 210, light: 110 },
        unlockedScavTiers: 4,
        scavReturnAt: nowMs - 60000
      },
      {
        id: 'vil_start',
        accountId: 'acc_res',
        worldId: 'w94',
        continent: '44',
        name: 'قرية_ناشئة',
        coord: '475|505',
        villagePoints: 58,
        flag: 0,
        woodItem: 0,
        clayItem: 0,
        ironItem: 0,
        premium: false,
        boost30: false,
        marketLevel: 0,
        farmLevel: 1,
        mines: {
          wood: { curr: 2, target: 10 },
          clay: { curr: 2, target: 10 },
          iron: { curr: 1, target: 10 }
        },
        warehouse: {
          level: 1,
          woodStock: 400,
          clayStock: 400,
          ironStock: 350,
          lastUpdated: nowMs
        },
        buildings: { الخشاب: 2, 'حفرة الطمي': 2, 'منجم الحديد': 1 }
      }
    ],
    dailySessions: {
      [yesterdayKey]: {
        acc_res: { startPP: 1050, targetPP: 150, lastSyncedPP: 1170, lastSyncTime: nowMs - 86400_000 },
        acc_mil: { startPP: 800, targetPP: 100, lastSyncedPP: 850, lastSyncTime: nowMs - 86400_000 }
      },
      [todayKey]: {
        acc_res: { startPP: 1170, targetPP: 150, lastSyncedPP: 1200, lastSyncTime: nowMs }
      }
    },
    sessionLogs: [
      {
        accountId: 'acc_mil',
        accountName: 'حساب_هجومي',
        villageId: 'vil_mil',
        durationSec: 120,
        timestamp: nowMs - 86400_000,
        dateKey: yesterdayKey
      },
      {
        accountId: 'acc_mil',
        accountName: 'حساب_هجومي',
        villageId: 'vil_mil',
        durationSec: 95,
        timestamp: nowMs,
        dateKey: todayKey
      }
    ]
  };

  return state;
}

test('buildDashboardResourcesAndAttacksSeries aggregates 7d/14d resources and attacks per account accurately', () => {
  const nowMs = Date.UTC(2026, 10, 17, 12, 0, 0);
  const state = buildFixtureState(nowMs);
  const contexts = state.villages.map((vil) => ({
    vil,
    acc: state.userAccounts.find((a) => a.id === vil.accountId) || null,
    live: computeVillageLiveStatus(vil, state, nowMs)
  }));

  const all7 = buildDashboardResourcesAndAttacksSeries(state, contexts, 7, 'all', nowMs);
  assert.equal(all7.points.length, 7);
  assert.equal(all7.accountOptions.length, 2);
  assert.ok(all7.totalMineResK > 0);
  assert.ok(all7.totalRaidResK > 0);
  assert.ok(all7.totalAttacks > 0);
  assert.ok(all7.activeDaysCount >= 2);

  const mil14 = buildDashboardResourcesAndAttacksSeries(state, contexts, 14, 'acc_mil', nowMs);
  assert.equal(mil14.points.length, 14);
  assert.ok(mil14.totalAttacks > 0);
  assert.ok(mil14.totalMineResK < all7.totalMineResK * 2);
});
