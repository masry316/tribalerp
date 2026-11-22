import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultAppState, type ErpVillage } from '../../src/core/index.ts';
import {
  mutateDeleteWorld,
  mutateSaveWorld,
  mutateSetWorldTradeEnded
} from '../../src/data/stateMutations';
import { computeVillageLiveStatus } from '../../src/core/engines/resourceEngine';
import { buildHeaderNotifications } from '../../src/ui/viewModels';
import { buildAccountLoginQueue } from '../../src/core/engines/loginQueueEngine';
import { auditAccountsSecurity } from '../../src/core/engines/securityEngine';
import { buildWorldComparisonReport } from '../../src/core/engines/reportsEngine';

function makeTestVillage(id: string, worldId: string, accountId: string, nowMs: number): ErpVillage {
  return {
    id,
    villageId: id,
    accountId,
    worldId,
    continent: '44',
    name: `قرية ${id}`,
    coord: '500|500',
    villagePoints: 820,
    flag: 0,
    woodItem: 0,
    clayItem: 0,
    ironItem: 0,
    premium: false,
    boost30: false,
    marketLevel: 5,
    farmLevel: 8,
    mines: {
      wood: { curr: 20, target: 20 },
      clay: { curr: 20, target: 20 },
      iron: { curr: 20, target: 20 }
    },
    warehouse: {
      level: 10,
      woodStock: 6000,
      clayStock: 6000,
      ironStock: 6000,
      lastUpdated: nowMs - 10 * 3600 * 1000
    },
    buildings: {
      'المبنى الرئيسي': 5,
      الثكنات: 3,
      السوق: 5,
      الخشاب: 20,
      'حفرة الطمي': 20,
      'منجم الحديد': 20,
      المخازن: 10,
      المزارع: 8
    },
    spearsTotal: 100,
    unlockedScavTiers: 3
  };
}

test('mutateSaveWorld edits world name and speed without clobbering continents or tradeEnded', () => {
  const base = createDefaultAppState();
  const w0 = base.worlds[0];
  const res = mutateSaveWorld(base, {
    id: w0.id,
    name: 'عالم 101',
    speed: 1.5
  });
  assert.equal(res.ok, true);
  assert.equal(res.state.worlds[0].name, 'عالم 101');
  assert.equal(res.state.worlds[0].speed, 1.5);
  assert.ok(res.state.worlds[0].continents['44']);
});

test('mutateSetWorldTradeEnded closes all 4 continents, zeroes expected PP, silences notifications/login-queue/security, and reopens cleanly', () => {
  const nowMs = Date.now();
  let state = createDefaultAppState();
  const w1 = state.worlds[0];
  state.userAccounts.push({
    id: 'acc_1',
    name: 'أحمد المصري',
    email: 'ahmed.masry94',
    device: 'Chrome',
    browser: 'Chrome',
    ip: '192.168.1.10',
    pp: 1200
  });
  state.villages.push(makeTestVillage('v_101', w1.id, 'acc_1', nowMs));

  const liveBefore = computeVillageLiveStatus(state.villages[0], state, nowMs);
  assert.ok(liveBefore.dailyPP > 0, 'Active world village must produce expected dailyPP > 0');

  // End trade on w1 with a recorded final total of 14500 PP
  const ended = mutateSetWorldTradeEnded(state, w1.id, true, 14500, nowMs);
  assert.equal(ended.ok, true);
  state = ended.state;

  const closedWorld = state.worlds.find((w) => w.id === w1.id)!;
  assert.equal(closedWorld.tradeEnded, true);
  assert.equal(closedWorld.tradeSummaryPP, 14500);
  for (const cont of ['44', '45', '54', '55'] as const) {
    assert.equal(closedWorld.continents[cont].isMarketClosed, true);
    assert.equal(closedWorld.continents[cont].stockWood, closedWorld.continents[cont].capWood);
    assert.equal(closedWorld.continents[cont].stockClay, closedWorld.continents[cont].capClay);
    assert.equal(closedWorld.continents[cont].stockIron, closedWorld.continents[cont].capIron);
  }

  // Expected PP drops to 0 and status is safe
  const liveAfter = computeVillageLiveStatus(state.villages[0], state, nowMs);
  assert.equal(liveAfter.dailyPP, 0);
  assert.equal(liveAfter.unsoldPP, 0);
  assert.equal(liveAfter.status, 'safe');

  // Notifications, login queue, and security audit ignore closed worlds completely
  const notifications = buildHeaderNotifications(state, nowMs);
  assert.equal(notifications.length, 0, 'Closed world must emit zero header notifications');
  const queue = buildAccountLoginQueue(state);
  assert.equal(
    queue.filter((q) => q.triggers.length > 0 && q.villages.some((v) => v.vil.worldId === w1.id)).length,
    0,
    'Closed world must not schedule account login queue actions'
  );
  const sec = auditAccountsSecurity(state);
  assert.equal(sec.length, 0, 'Closed world must not raise security audit collisions');

  // Reopen trade restores active market status
  const reopened = mutateSetWorldTradeEnded(state, w1.id, false, null, nowMs + 1000);
  assert.equal(reopened.ok, true);
  const activeAgain = reopened.state.worlds.find((w) => w.id === w1.id)!;
  assert.equal(activeAgain.tradeEnded, false);
  assert.equal(activeAgain.continents['44'].isMarketClosed, false);
  const liveReopened = computeVillageLiveStatus(reopened.state.villages[0], reopened.state, nowMs + 1000);
  assert.ok(liveReopened.dailyPP > 0);
});

test('mutateDeleteWorld blocks deleting the sole world and cleanly deletes extra worlds with linked villages', () => {
  const nowMs = Date.now();
  let state = createDefaultAppState();
  state.worlds = [state.worlds[0]];
  const blocked = mutateDeleteWorld(state, state.worlds[0].id);
  assert.equal(blocked.ok, false);

  const added = mutateSaveWorld(state, { id: 'w_102', name: 'عالم 102', speed: 2 }, nowMs);
  assert.equal(added.ok, true);
  state = added.state;
  state.selectedWorldFilter = 'w_102';
  state.villages.push(makeTestVillage('v_102', 'w_102', 'acc_1', nowMs));

  const deleted = mutateDeleteWorld(state, 'w_102');
  assert.equal(deleted.ok, true);
  assert.equal(deleted.state.worlds.some((w) => w.id === 'w_102'), false);
  assert.equal(deleted.state.villages.some((v) => v.worldId === 'w_102'), false);
  assert.equal(deleted.state.selectedWorldFilter, 'all');
});

test('buildWorldComparisonReport compares ended and active worlds with delta and per-account metrics', () => {
  const nowMs = Date.now();
  let state = createDefaultAppState();
  const w1 = state.worlds[0];
  w1.name = 'عالم 101';
  state.userAccounts.push({
    id: 'acc_1',
    name: 'كريم الحربي',
    email: 'karim.harbi95',
    device: 'Chrome',
    browser: 'Chrome',
    ip: '10.0.0.1',
    pp: 5000
  });
  state.villages.push(makeTestVillage('v_101', w1.id, 'acc_1', nowMs));
  state = mutateSetWorldTradeEnded(state, w1.id, true, 10000, nowMs).state;

  const added = mutateSaveWorld(state, { id: 'w_102', name: 'عالم 102', speed: 2, tradeSummaryPP: 13500 }, nowMs);
  state = added.state;
  state.villages.push(makeTestVillage('v_102', 'w_102', 'acc_1', nowMs));

  const rows = buildWorldComparisonReport(state, nowMs);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].worldName, 'عالم 101');
  assert.equal(rows[0].tradeEnded, true);
  assert.equal(rows[0].totalEarnedPP, 10000);
  assert.equal(rows[0].liveDailyExpectedPP, 0);

  assert.equal(rows[1].worldName, 'عالم 102');
  assert.equal(rows[1].speed, 2);
  assert.equal(rows[1].totalEarnedPP, 13500);
  assert.equal(rows[1].deltaVsPrevPP, 3500);
  assert.equal(rows[1].deltaVsPrevPct, 35);
});
