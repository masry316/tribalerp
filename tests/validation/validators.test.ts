import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAccountInput,
  validateAppStateBackupJson,
  validateContinentRatesInput,
  validateIncomingSyncPayload,
  validateVillageInput,
  validateWorldInput
} from '../../src/validation';

test('validateAccountInput accepts valid accounts and rejects missing name or bad IP/PP', () => {
  const ok = validateAccountInput({
    name: '  لاعب رئيسي  ',
    pp: 1250,
    ip: '197.44.12.8',
    device: 'Android 14',
    browser: 'Kiwi',
    email: 'player@example.com'
  });
  assert.equal(ok.valid, true);
  if (ok.valid) {
    assert.equal(ok.data.name, 'لاعب رئيسي');
    assert.equal(ok.data.pp, 1250);
    assert.equal(ok.data.ip, '197.44.12.8');
  }

  const bad = validateAccountInput({
    name: '   ',
    pp: -50,
    ip: '999.10.1.1',
    email: 'invalid-email'
  });
  assert.equal(bad.valid, false);
  if (!bad.valid) {
    assert.ok(bad.errors.name);
    assert.ok(bad.errors.pp);
    assert.ok(bad.errors.ip);
    assert.ok(bad.errors.email);
  }
});

test('validateVillageInput enforces continent, coord format, building/troop bounds', () => {
  const ok = validateVillageInput({
    name: 'القرية الأولى',
    accountId: 'acc_1',
    worldId: 'w_94',
    continent: '44',
    coord: '495|502',
    flag: 18,
    warehouseLevel: 15,
    marketLevel: 10,
    farmLevel: 18,
    woodLevel: 20,
    clayLevel: 20,
    ironLevel: 18,
    unlockedScavTiers: 4
  });
  assert.equal(ok.valid, true);

  const bad = validateVillageInput({
    name: '',
    accountId: '',
    worldId: '',
    continent: '99',
    coord: '49-50',
    warehouseLevel: 35,
    marketLevel: 30,
    unlockedScavTiers: 5
  });
  assert.equal(bad.valid, false);
  if (!bad.valid) {
    assert.ok(bad.errors.name);
    assert.ok(bad.errors.accountId);
    assert.ok(bad.errors.worldId);
    assert.ok(bad.errors.continent);
    assert.ok(bad.errors.coord);
    assert.ok(bad.errors.warehouseLevel);
    assert.ok(bad.errors.marketLevel);
    assert.ok(bad.errors.unlockedScavTiers);
  }
});

test('validateWorldInput and validateContinentRatesInput validate speeds and exchange rates', () => {
  assert.equal(validateWorldInput({ name: 'عالم 95', speed: 1.5 }).valid, true);
  assert.equal(validateWorldInput({ name: '', speed: 0 }).valid, false);

  assert.equal(
    validateContinentRatesInput({
      continent: '54',
      sellRate: 120,
      buyRate: 95,
      sellWood: 110,
      sellClay: 120,
      sellIron: 130
    }).valid,
    true
  );
  const badRates = validateContinentRatesInput({
    continent: '12',
    sellRate: 30,
    buyRate: 0,
    sellWood: 20
  });
  assert.equal(badRates.valid, false);
  if (!badRates.valid) {
    assert.ok(badRates.errors.continent);
    assert.ok(badRates.errors.sellRate);
    assert.ok(badRates.errors.buyRate);
  }
});

test('validateIncomingSyncPayload and validateAppStateBackupJson reject malformed payloads', () => {
  assert.equal(validateIncomingSyncPayload('').valid, false);
  assert.equal(validateIncomingSyncPayload('javascript:(function(){window.game_data={};})();').valid, false);
  assert.equal(validateIncomingSyncPayload('{not-json').valid, false);
  assert.equal(
    validateIncomingSyncPayload(
      JSON.stringify({
        playerName: 'حساب',
        coord: '495|502',
        ip: '192.168.1.1',
        woodStock: 1000,
        spearsHome: 40,
        buildings: { الخشاب: 15 }
      })
    ).valid,
    true
  );
  assert.equal(
    validateIncomingSyncPayload({
      coord: 'bad',
      ip: '999.1.1.1',
      woodStock: -10,
      buildings: { الخشاب: 40 }
    }).valid,
    false
  );

  assert.equal(validateAppStateBackupJson('{"worlds":[],"userAccounts":[],"villages":[]}').valid, true);
  assert.equal(validateAppStateBackupJson('{"worlds":[]}').valid, false);
});
