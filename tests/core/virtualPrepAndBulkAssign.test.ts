import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAccountLoginQueue,
  computeVillageLiveStatus,
  createDefaultAppState,
  processIncomingVillageSync,
  type AssignedPlan
} from '../../src/core';
import {
  mutateAssignPlanBulk,
  mutateGenerateVirtualVillages,
  mutateSaveAccount,
  mutateSaveWorld
} from '../../src/data/stateMutations';

const SAMPLE_PLAN: AssignedPlan = {
  id: 'plan_w102_start',
  name: 'خطة افتتاح عالم 102',
  isRealVillageBased: false,
  assignedAt: 1700000000000,
  steps: [
    { stepNum: 1, atype: 'bldg', bName: 'الخشاب (م1)', baseName: 'الخشاب', targetLvl: 1 },
    { stepNum: 2, atype: 'bldg', bName: 'حفرة الطمي (م1)', baseName: 'حفرة الطمي', targetLvl: 1 }
  ]
};

test('mutateGenerateVirtualVillages creates 1 village per registered account named after the account across 4 continents and blocks duplicates', () => {
  let state = createDefaultAppState();
  const wRes = mutateSaveWorld(state, { name: 'عالم 102', speed: 1.5 });
  assert.equal(wRes.ok, true);
  state = wRes.state;
  const world102 = wRes.updatedWorld!;

  const accNames = ['CommanderOne', 'CommanderTwo', 'CommanderThree', 'CommanderFour'];
  const accIds: string[] = [];
  for (const name of accNames) {
    const aRes = mutateSaveAccount(state, { name, pp: 100 });
    assert.equal(aRes.ok, true);
    state = aRes.state;
    accIds.push(aRes.updatedAccount!.id);
  }

  const genRes = mutateGenerateVirtualVillages(state, {
    worldId: world102.id,
    countsByContinent: { '44': 1, '45': 1, '54': 1, '55': 1 },
    accountIds: accIds,
    autoCreateMissingAccounts: false,
    assignedPlan: SAMPLE_PLAN
  });

  assert.equal(genRes.ok, true);
  assert.equal(genRes.updatedVillages?.length, 4);
  assert.equal(genRes.createdAccounts?.length, 0);

  const continents = genRes.updatedVillages!.map((v) => v.continent).sort();
  assert.deepEqual(continents, ['44', '45', '54', '55']);

  const villageNames = genRes.updatedVillages!.map((v) => v.name);
  assert.deepEqual(villageNames, accNames, 'Each virtual village must take its account name');

  for (const v of genRes.updatedVillages!) {
    assert.equal(v.isVirtual, true);
    assert.equal(v.worldId, world102.id);
    assert.equal(v.villagePoints, 26);
    assert.equal(v.assignedPlan?.name, SAMPLE_PLAN.name);
    assert.equal(v.assignedPlan?.steps.length, 2);
  }

  // Attempting to generate again for the same accounts in the same world must be rejected
  const duplicateRes = mutateGenerateVirtualVillages(genRes.state, {
    worldId: world102.id,
    countsByContinent: { '44': 1, '45': 1, '54': 1, '55': 1 },
    accountIds: accIds,
    autoCreateMissingAccounts: false,
    assignedPlan: SAMPLE_PLAN
  });
  assert.equal(duplicateRes.ok, false, 'Must block duplicate virtual village generation for accounts already in world');
  assert.equal(duplicateRes.state.villages.length, 4);
});

test('processIncomingVillageSync seamlessly takes over a virtual village in-place and preserves assignedPlan without duplicates', () => {
  let state = createDefaultAppState();
  const wRes = mutateSaveWorld(state, { id: 'w_102', name: 'عالم 102', speed: 1.5 });
  state = wRes.state;
  const aRes = mutateSaveAccount(state, { name: 'MahmoudAcc', pp: 0 });
  state = aRes.state;

  const genRes = mutateGenerateVirtualVillages(state, {
    worldId: 'w_102',
    countsByContinent: { '44': 1, '45': 0, '54': 0, '55': 0 },
    accountIds: [aRes.updatedAccount!.id],
    autoCreateMissingAccounts: false,
    assignedPlan: SAMPLE_PLAN
  });
  assert.equal(genRes.ok, true);
  state = genRes.state;
  const virtualVilId = genRes.updatedVillages![0].id;
  assert.equal(genRes.updatedVillages![0].name, 'MahmoudAcc');
  assert.equal(state.villages.length, 1);

  const syncRes = processIncomingVillageSync(state, {
    accountName: 'MahmoudAcc',
    world: 'عالم 102',
    worldSpeed: 1.5,
    villageId: '987654',
    name: 'قرية البداية الحقيقية',
    coord: '512|488',
    continent: '45',
    villagePoints: 68,
    pp: 120,
    woodLevel: 3,
    clayLevel: 2,
    ironLevel: 1,
    warehouseLevel: 2,
    woodStock: 750,
    clayStock: 620,
    ironStock: 410
  });

  assert.equal(syncRes.ok, true);
  assert.equal(syncRes.isNewVillage, false);
  assert.equal(syncRes.nextState!.villages.length, 1, 'Must replace virtual village in-place with zero duplicates');

  const updatedVil = syncRes.nextState!.villages[0];
  assert.equal(updatedVil.id, virtualVilId);
  assert.equal(updatedVil.isVirtual, false);
  assert.equal(updatedVil.villageId, '987654');
  assert.equal(updatedVil.name, 'قرية البداية الحقيقية');
  assert.equal(updatedVil.coord, '512|488');
  assert.equal(updatedVil.continent, '45');
  assert.equal(updatedVil.mines.wood.curr, 3);
  assert.equal(updatedVil.assignedPlan?.name, SAMPLE_PLAN.name, 'Assigned plan must survive live sync takeover');
  assert.equal(updatedVil.assignedPlan?.steps.length, 2);
});

test('mutateAssignPlanBulk assigns a plan atomically to multiple villages at once', () => {
  let state = createDefaultAppState();
  const wRes = mutateSaveWorld(state, { id: 'w_102', name: 'عالم 102', speed: 1 });
  state = wRes.state;

  const ids: string[] = [];
  for (let i = 1; i <= 4; i++) {
    const a = mutateSaveAccount(state, { name: `Acc${i}`, pp: 0 });
    state = a.state;
    ids.push(a.updatedAccount!.id);
  }

  const genRes = mutateGenerateVirtualVillages(state, {
    worldId: 'w_102',
    countsByContinent: { '44': 2, '45': 2, '54': 0, '55': 0 },
    accountIds: ids,
    autoCreateMissingAccounts: false,
    assignedPlan: null
  });
  state = genRes.state;
  const allIds = state.villages.map((v) => v.id);
  assert.equal(allIds.length, 4);
  assert.ok(state.villages.every((v) => !v.assignedPlan));

  const bulkRes = mutateAssignPlanBulk(state, allIds, SAMPLE_PLAN);
  assert.equal(bulkRes.ok, true);
  assert.equal(bulkRes.updatedVillages?.length, 4);
  assert.ok(
    bulkRes.state.villages.every(
      (v) => v.assignedPlan?.name === SAMPLE_PLAN.name && v.assignedPlan?.steps.length === 2
    )
  );
});

test('virtual villages do not trigger stale sync, critical warehouse, or login queue alerts before live sync', () => {
  let state = createDefaultAppState();
  const wRes = mutateSaveWorld(state, { id: 'w_103', name: 'عالم 103', speed: 1.5 });
  state = wRes.state;

  const ids: string[] = [];
  for (let i = 1; i <= 4; i++) {
    const a = mutateSaveAccount(state, { name: `ReadyAcc${i}`, pp: 0 });
    state = a.state;
    ids.push(a.updatedAccount!.id);
  }

  const genRes = mutateGenerateVirtualVillages(state, {
    worldId: 'w_103',
    countsByContinent: { '44': 2, '45': 2, '54': 0, '55': 0 },
    accountIds: ids,
    autoCreateMissingAccounts: false,
    assignedPlan: SAMPLE_PLAN
  });
  assert.equal(genRes.ok, true);
  state = genRes.state;

  const futureMs = Date.now() + 72 * 3600000;
  for (const v of state.villages) {
    const live = computeVillageLiveStatus(v, state, futureMs);
    assert.equal(live.status, 'safe', 'Virtual village must stay safe before live sync');
    assert.equal(live.isStaleSync, false, 'Virtual village must not be flagged as stale sync');
  }

  const queue = buildAccountLoginQueue(state, {}, futureMs);
  assert.ok(
    queue.every((item) => item.triggers.length === 0 && item.criticalWhCount === 0),
    'Pre-launch virtual villages must not create login queue triggers'
  );
});
