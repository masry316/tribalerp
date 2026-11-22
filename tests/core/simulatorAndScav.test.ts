import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcScavDispatch,
  getMaxCapForDuration,
  getScavDurationFactor,
  getScavDurationSec
} from '../../src/core';

test('calcScavDispatch distributes multi-unit haul capacity cleanly across unlocked tiers', () => {
  const res = calcScavDispatch(100, 20, 4, 2, 16, 1, 'max_profit', 1, 30, 0, 15, 5, 0, 0, 1);
  // 100*25 + 20*15 + 30*10 + 15*80 + 5*50 + 1*100 = 2500 + 300 + 300 + 1200 + 250 + 100 = 4650
  assert.equal(res.totalCap, 4650);
  assert.equal(res.allocs.length, 4);
  assert.ok(res.lootPerRun > 0);
  assert.ok(res.dailyLoot > res.lootPerRun);
  assert.ok(res.eachHr > 0);
});

test('scavenging max_profit vs min_logins differ genuinely, stretch symmetrically on huge armies, and are strictly monotonic', () => {
  // Huge army (500 LC = 40,000 haul) stretches all 4 tiers symmetrically instead of dumping excess into Tier 1 or idling troops
  const hugeMax = calcScavDispatch(0, 0, 4, 2, 16, 1, 'max_profit', 1, 0, 0, 500);
  const deployedCap = hugeMax.allocs.reduce((s, a) => s + a.cap, 0);
  assert.ok(deployedCap >= 39500, `Expected nearly all 40,000 haul deployed, got ${deployedCap}`);
  const durs = hugeMax.allocs.map((a) => a.durSec);
  assert.ok(
    Math.max(...durs) - Math.min(...durs) <= 300,
    `All 4 tiers should stretch symmetrically together, got ${durs.join(', ')}`
  );

  // max_profit (2h default) packs T3 to 2h then spills into T2; min_logins (4h) puts more into T3 for fewer logins
  const midMax = calcScavDispatch(120, 30, 3, 4, 12, 1, 'max_profit', 1);
  const midMin = calcScavDispatch(120, 30, 3, 4, 12, 1, 'min_logins', 1);
  assert.ok(midMax.dailyLoot >= midMin.dailyLoot, 'max_profit should achieve at least min_logins daily loot');
  assert.ok(midMin.runsPerDay <= midMax.runsPerDay, 'min_logins should use fewer or equal daily logins');
  assert.ok(midMin.lootPerRun >= midMax.lootPerRun, 'min_logins should carry >= loot per login');

  // Strict monotonicity: adding spears MUST NEVER reduce dailyLoot (prevents Math.floor cliff freeze)
  let prevDaily = 0;
  for (let sp = 10; sp <= 200; sp += 5) {
    const d = calcScavDispatch(sp, 30, 3, 2, 12, 1, 'max_profit', 1, 0, 0, 0, 0, 0, 0, 1);
    assert.ok(
      d.dailyLoot >= prevDaily,
      `dailyLoot dropped from ${prevDaily} to ${d.dailyLoot} at ${sp} spears!`
    );
    prevDaily = d.dailyLoot;
  }
});

test('scavenging duration depends strictly on worldSpeed^(-0.55) and ignores unitSpeed', () => {
  // Official Tribal Wars duration_factor reference points
  assert.ok(Math.abs(getScavDurationFactor(1) - 1.0) < 1e-6);
  assert.ok(Math.abs(getScavDurationFactor(2) - 0.6830201284) < 1e-6);
  assert.ok(Math.abs(getScavDurationFactor(1.2) - 0.9045919) < 1e-5);
  assert.ok(Math.abs(getScavDurationFactor(0.75) - 1.171434) < 1e-5);

  // Changing unitSpeed must NOT change scavenging duration, max cap, or daily loot
  const durSlowUnits = getScavDurationSec(5000, 0.5, 2, 0.5);
  const durNormalUnits = getScavDurationSec(5000, 0.5, 2, 1.0);
  const durFastUnits = getScavDurationSec(5000, 0.5, 2, 2.0);
  assert.equal(durSlowUnits, durNormalUnits);
  assert.equal(durFastUnits, durNormalUnits);

  assert.equal(
    getMaxCapForDuration(7200, 0.5, 2, 0.5),
    getMaxCapForDuration(7200, 0.5, 2, 1.5)
  );

  const dispSlowUnit = calcScavDispatch(400, 200, 4, 2, 12, 2, 'max_profit', 0.5);
  const dispFastUnit = calcScavDispatch(400, 200, 4, 2, 12, 2, 'max_profit', 2.0);
  assert.equal(dispSlowUnit.dailyLoot, dispFastUnit.dailyLoot);
  assert.equal(dispSlowUnit.maxRunSec, dispFastUnit.maxRunSec);

  // Faster world speed strictly reduces trip duration and increases 12h yield
  const dur1x = getScavDurationSec(5000, 0.5, 1);
  const dur2x = getScavDurationSec(5000, 0.5, 2);
  assert.ok(dur2x < dur1x, `2x world (${dur2x}s) must scavenge faster than 1x world (${dur1x}s)`);
});



