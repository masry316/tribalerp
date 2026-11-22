import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAssignedPlanFromStrategy,
  calcSmoothDailyScavLoot,
  createDefaultSmartPlannerInput,
  evaluateVillageMissionBriefing,
  getOfficialBuildSec,
  getOfficialSpearTrainSec,
  getOfficialUnitTrainSec,
  makeStarter26Buildings,
  runSmartDevelopmentOptimizer,
  solveOptimalScavAllocation,
  type SmartPlannerInput
} from '../../src/core';

test('official unit training formulas match live server XML (ae101)', () => {
  // At 1x Barracks L1: round(1020 * (2/3) * 1.06^-1) = round(641.51) = 642s
  assert.equal(getOfficialSpearTrainSec(1, 1.0), 642);
  // At 1.2x Barracks L1: round(641.51 / 1.2) = 535s
  assert.equal(getOfficialSpearTrainSec(1, 1.2), 535);
  // Higher barracks reduces training time strictly
  assert.ok(getOfficialSpearTrainSec(5, 1.0) < getOfficialSpearTrainSec(1, 1.0));
  // Higher world speed cuts training time proportionally
  assert.equal(getOfficialSpearTrainSec(1, 2.0), 321);
  // Paladin takes 6h at 1x and 3h at 2x
  assert.equal(getOfficialUnitTrainSec('paladin', 1, 1.0), 21600);
  assert.equal(getOfficialUnitTrainSec('paladin', 1, 2.0), 10800);
});

test('4-slot independent scavenging solver optimizes daytime hourly rate and overnight max-tier blast', () => {
  // 200 spears = 5000 carry across T1, T2, T3 at 1x
  const dayAlloc = solveOptimalScavAllocation(5000, [0, 1, 2], 1.0, 'max_rate', 8 * 3600);
  assert.ok(dayAlloc.slots.length >= 2, 'Daytime split should use multiple parallel slots');
  const sumCarry = dayAlloc.slots.reduce((a, s) => a + s.carry, 0);
  assert.ok(sumCarry <= 5005 && sumCarry >= 4900, `Expected full carry utilization, got ${sumCarry}`);
  assert.ok(dayAlloc.hourlyLoot > 1150, `Expected optimal hourly loot > 1150 res/hr, got ${dayAlloc.hourlyLoot}`);

  // Overnight blast packs highest tier (T3 = 50%) first!
  const nightAlloc = solveOptimalScavAllocation(5000, [0, 1, 2], 1.0, 'overnight_max_loot', 12 * 3600);
  assert.equal(nightAlloc.slots.length, 1, '5000 carry fits completely in T3 for 12h overnight');
  assert.equal(nightAlloc.slots[0].tier, 3, 'Overnight blast must pack T3 (50%) first');
  assert.equal(nightAlloc.totalLoot, 2500, '5000 carry * 0.50 = 2500 loot');
});

test('Step 1 profitable opening achieves zero overflow and positive net resource gain', () => {
  const input = createDefaultSmartPlannerInput();
  const out = runSmartDevelopmentOptimizer({
    ...input,
    horizonDays: 5,
    worldSpeed: 1.0,
    activeHoursPerDay: 12,
    sellWood: 64,
    sellClay: 64,
    sellIron: 64
  });

  const op = out.winner.openingSummary;
  assert.equal(op.overflowRes, 0, 'Opening must prevent any reward overflow');
  assert.ok(op.netProfitRes > 3000, `Expected >3000 net opening profit, got ${op.netProfitRes}`);
  assert.ok(op.endBuildings['المخازن'] >= 5, 'Warehouse should reach at least L5 in opening');
  assert.ok(op.endPoints >= 100, `Opening village points should grow substantially (got ${op.endPoints})`);
});

test('V2 Unconstrained Optimizer strictly crushes Pure Mines AND beats V1 benchmarks across 1x, 1.5x, 2x', () => {
  const base = createDefaultSmartPlannerInput();
  const v1Baselines: Record<number, number> = { 1.0: 917, 1.5: 1462, 2.0: 1968 };

  for (const ws of [1.0, 1.5, 2.0]) {
    const out = runSmartDevelopmentOptimizer({
      ...base,
      horizonDays: 5,
      worldSpeed: ws,
      activeHoursPerDay: 12,
      sellWood: 64,
      sellClay: 64,
      sellIron: 64,
      goal: 'max_net_pp'
    });

    const pureMines = out.strategies.find((s) => s.key === 'pure_mines');
    assert.ok(pureMines, 'Pure Mines baseline must exist');
    assert.ok(
      out.winner.totalNetPP > pureMines.totalNetPP * 1.5,
      `At ${ws}x, winner (${out.winner.totalNetPP} PP) should beat Pure Mines (${pureMines.totalNetPP} PP) by >50%`
    );
    assert.ok(
      out.winner.totalNetPP > v1Baselines[ws] * 1.08,
      `At ${ws}x, V2 (${out.winner.totalNetPP} PP) must beat V1 (${v1Baselines[ws]} PP) by >8%`
    );
    assert.ok(out.winner.finalSpears >= 150, `At ${ws}x, winner should train substantial spears (got ${out.winner.finalSpears})`);
    assert.ok(out.winner.finalScavTiers >= 3, `At ${ws}x, winner should unlock at least T3 (got T${out.winner.finalScavTiers})`);
    assert.ok(out.winner.checkpoint24h.dailyTotalPP > 130, `24h daily PP at ${ws}x should be strong (got ${out.winner.checkpoint24h.dailyTotalPP})`);
    assert.ok(out.winner.keyDecisions.length >= 2, 'Winner must include human-readable Arabic strategic decisions');
    assert.ok(out.evaluatedGenomesCount >= 80, 'Unconstrained optimizer must evaluate 80+ candidate strategies');
  }
});

test('Zero active hours automatically avoids wasting resources on unused spears', () => {
  const base = createDefaultSmartPlannerInput();
  const out = runSmartDevelopmentOptimizer({
    ...base,
    horizonDays: 5,
    worldSpeed: 1.0,
    activeHoursPerDay: 0,
    sellWood: 64,
    sellClay: 64,
    sellIron: 64
  });

  assert.equal(out.winner.spearsTrained, 0, 'With 0 active hours, optimizer must train 0 spears');
  assert.equal(out.winner.finalPaladins, 0, 'With 0 active hours, optimizer must recruit 0 paladins');
  assert.equal(out.winner.finalScavTiers, 0, 'With 0 active hours, optimizer must unlock 0 scav tiers');
});

test('Longer horizon (14 days) yields higher net PP and unlocks T4 cleanly', () => {
  const base = createDefaultSmartPlannerInput();
  const out5 = runSmartDevelopmentOptimizer({ ...base, horizonDays: 5, worldSpeed: 1.5, activeHoursPerDay: 12 });
  const out14 = runSmartDevelopmentOptimizer({ ...base, horizonDays: 14, worldSpeed: 1.5, activeHoursPerDay: 12 });

  assert.ok(out14.winner.totalNetPP > out5.winner.totalNetPP * 4, '14-day net PP should exceed 4x of 5-day net PP');
  assert.ok(out14.winner.endDailyTotalPP > out5.winner.endDailyTotalPP * 2, '14-day end daily PP should be >2x higher');
  assert.equal(out14.winner.finalScavTiers, 4, '14-day 1.5x plan should unlock T4');
});

test('Real village mid-game continuation respects starting buildings, army, and unlocked tiers', () => {
  const startBldgs = makeStarter26Buildings();
  startBldgs['المبنى الرئيسي'] = 8;
  startBldgs['المخازن'] = 12;
  startBldgs['المزارع'] = 12;
  startBldgs['الخشاب'] = 14;
  startBldgs['حفرة الطمي'] = 14;
  startBldgs['منجم الحديد'] = 12;
  startBldgs['الثكنات'] = 5;
  startBldgs['السوق'] = 6;

  const input: SmartPlannerInput = {
    ...createDefaultSmartPlannerInput(),
    sourceMode: 'real',
    villageId: 'vil_mid',
    villageName: 'قرية متوسطة',
    horizonDays: 7,
    worldSpeed: 1.5,
    activeHoursPerDay: 12,
    sellWood: 70,
    sellClay: 64,
    sellIron: 90,
    startBuildings: startBldgs,
    startStock: { w: 4500, c: 4500, i: 3500 },
    startSpears: 150,
    otherUnitsCarryCap: 1500,
    otherUnitsPop: 100,
    startUnlockedScavTiers: 2
  };

  const out = runSmartDevelopmentOptimizer(input);
  assert.ok(out.winner.finalBuildings['الخشاب'] >= 14);
  assert.ok(out.winner.finalBuildings['حفرة الطمي'] >= 14);
  assert.ok(out.winner.finalSpears >= 150);
  assert.ok(out.winner.finalScavTiers >= 2);
  for (const s of out.winner.steps) {
    if (s.atype === 'bldg' && s.baseName && s.bName !== 'بحث الفارس الخفيف') {
      assert.ok(
        s.targetLvl > (startBldgs[s.baseName] || 0),
        `Step ${s.bName} L${s.targetLvl} should exceed start level ${startBldgs[s.baseName] || 0}`
      );
    }
    if (s.atype === 'train_spear') {
      assert.ok(s.targetLvl > 150, 'Spear training steps must have cumulative target > starting spears');
    }
    if (s.atype === 'scav_unlock') {
      assert.ok(s.targetLvl > 2, 'Scav unlock steps must only unlock tiers > starting unlocked tiers');
    }
  }
});

test('Generated AssignedPlan integrates cleanly with missionEngine tracking including Paladin/Swords/Light', () => {
  const input = createDefaultSmartPlannerInput();
  const out = runSmartDevelopmentOptimizer({ ...input, horizonDays: 5, worldSpeed: 1.0, activeHoursPerDay: 12 });
  const assignedPlan = buildAssignedPlanFromStrategy(out.winner, out.input, 1_700_000_000_000);

  assert.ok(assignedPlan.steps.length > 20, 'Assigned plan must contain full actionable step timeline');

  const freshBriefing = evaluateVillageMissionBriefing({
    id: 'v1',
    name: 'Test Village',
    accountName: 'Acc1',
    device: 'PC',
    browser: 'Chrome',
    buildings: makeStarter26Buildings(),
    woodStock: 500,
    clayStock: 500,
    ironStock: 400,
    warehouseCap: 1000,
    wProd: 5,
    cProd: 5,
    iProd: 5,
    spearsHome: 0,
    swordsHome: 0,
    spearsAway: 0,
    swordsAway: 0,
    spearsTotal: 0,
    swordsTotal: 0,
    unitsTotal: { spear: 0, sword: 0, light: 0, knight: 0 },
    unlockedScavTiers: 0,
    scavState: 'no_barracks',
    scavRemHours: 0,
    marketLevel: 0,
    sellWood: 64,
    sellClay: 64,
    sellIron: 64,
    buyRate: 64,
    assignedPlan
  });

  assert.equal(freshBriefing.hasPlan, true);
  assert.equal(freshBriefing.completedStepsCount, 0);
  assert.ok(freshBriefing.readyStepsNow.length >= 1, 'Starter village should have immediate ready steps');

  // Fully completed village (including Paladin, Spears, Swords, Light Cav) should register 100% completion
  const doneBriefing = evaluateVillageMissionBriefing({
    id: 'v1',
    name: 'Test Village',
    accountName: 'Acc1',
    device: 'PC',
    browser: 'Chrome',
    buildings: out.winner.finalBuildings,
    woodStock: 1000,
    clayStock: 1000,
    ironStock: 1000,
    warehouseCap: 50000,
    wProd: 500,
    cProd: 500,
    iProd: 500,
    spearsHome: out.winner.finalSpears,
    swordsHome: out.winner.finalSwords,
    spearsAway: 0,
    swordsAway: 0,
    spearsTotal: out.winner.finalSpears,
    swordsTotal: out.winner.finalSwords,
    unitsTotal: {
      spear: out.winner.finalSpears,
      sword: out.winner.finalSwords,
      light: out.winner.finalLights,
      knight: out.winner.finalPaladins
    },
    unlockedScavTiers: out.winner.finalScavTiers,
    scavState: 'idle_troops',
    scavRemHours: 0,
    marketLevel: out.winner.finalBuildings['السوق'] || 2,
    sellWood: 64,
    sellClay: 64,
    sellIron: 64,
    buyRate: 64,
    assignedPlan
  });

  assert.equal(doneBriefing.completedStepsCount, assignedPlan.steps.length);
  assert.equal(doneBriefing.remainingSteps.length, 0);
});

test('Smooth daily scav loot increases monotonically with carry capacity (no step-function drop)', () => {
  let prev = 0;
  for (let sp = 20; sp <= 300; sp += 20) {
    const res = calcSmoothDailyScavLoot(sp * 25, 3, 12, 0, 1.0);
    assert.ok(res.dailyLoot >= prev, `Expected monotonic smooth loot at ${sp} spears (${res.dailyLoot} < ${prev})`);
    prev = res.dailyLoot;
  }
});

test('Determinism and non-NaN invariants across optimization goals', () => {
  const input = { ...createDefaultSmartPlannerInput(), horizonDays: 5, worldSpeed: 1.5, activeHoursPerDay: 12 };
  const r1 = runSmartDevelopmentOptimizer(input);
  const r2 = runSmartDevelopmentOptimizer(input);
  assert.equal(r1.winner.totalNetPP, r2.winner.totalNetPP);
  assert.equal(r1.winner.finalSpears, r2.winner.finalSpears);
  assert.equal(r1.winner.steps.length, r2.winner.steps.length);

  const endDailyRun = runSmartDevelopmentOptimizer({ ...input, goal: 'max_end_daily_pp' });
  assert.ok(Number.isFinite(endDailyRun.winner.endDailyTotalPP));
  assert.ok(endDailyRun.winner.endDailyTotalPP > r1.winner.endDailyTotalPP * 1.3);
  assert.ok(getOfficialBuildSec('الخشاب', 1, 1, 1.0, true, 180) === 0);
});
