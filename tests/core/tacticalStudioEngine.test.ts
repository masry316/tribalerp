import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAssignedPlanFromTacticalResult,
  calcBuildDurationSec,
  calcBuildingRange,
  calcDailyMerchantCapacityRes,
  checkBuildingPrerequisites,
  createDefaultAppState,
  createDefaultTacticalStudioInput,
  evaluateVillageMissionBriefing,
  optimizeMineBudget,
  runTacticalAutoSearch,
  runTacticalSimulation,
  type ErpAppState,
  type VillageSyncSnapshot
} from '../../src/core/index.ts';

function makeBaseInput() {
  return createDefaultTacticalStudioInput();
}

test('calcBuildDurationSec matches official Tribal Wars live timings', () => {
  // Wood L11 at HQ 15, 1x speed = 44m 26s = 2666s (matches live screenshot)
  assert.equal(calcBuildDurationSec('الخشاب', 11, 15, 1, false), 2666);
  // Wood L12 at HQ 15, 1x speed = 55m 16s = 3316s (matches live screenshot)
  assert.equal(calcBuildDurationSec('الخشاب', 12, 15, 1, false), 3316);
  // Wood L1 at HQ 1, 1x speed = 10s (minimum duration)
  assert.equal(calcBuildDurationSec('الخشاب', 1, 1, 1, false), 10);
  // Free finish cuts up to 180s
  assert.equal(calcBuildDurationSec('الخشاب', 1, 1, 1, true, 180), 0);
  assert.equal(calcBuildDurationSec('الخشاب', 11, 15, 1, true, 180), 2486);
});

test('calcBuildingRange matches live reference Wood L10 -> L18 at HQ 15 (1x, 64/PP)', () => {
  const res = calcBuildingRange({
    buildingName: 'الخشاب',
    fromLvl: 10,
    toLvl: 18,
    hqLvl: 15,
    worldSpeed: 1,
    buyRate: 64,
    discountMode: 'smart'
  });

  assert.equal(res.rows.length, 8);
  assert.equal(res.totalWood, 9239);
  assert.equal(res.totalClay, 14820);
  assert.equal(res.totalIron, 6973);
  assert.equal(res.totalRes, 31032);
  assert.equal(res.totalPP, 484.9);
  assert.equal(res.discountLevelsCount, 0);
  assert.equal(res.savedRes, 0);
  // 13h 24m = 48240s +/- 60s
  assert.ok(res.totalBuildSec >= 48180 && res.totalBuildSec <= 48300);

  // Discount mode 'all' saves 20% resources and adds 30 PP per level
  const allDisc = calcBuildingRange({
    buildingName: 'الخشاب',
    fromLvl: 10,
    toLvl: 18,
    hqLvl: 15,
    worldSpeed: 1,
    buyRate: 64,
    discountMode: 'all'
  });
  assert.equal(allDisc.discountLevelsCount, 8);
  assert.equal(allDisc.discountPP, 240);
  assert.ok(allDisc.savedRes > 6000);
  assert.ok(allDisc.totalRes < res.totalRes);
});

test('optimizeMineBudget matches live reference 350 PP at 64/PP on 0/0/0 village', () => {
  const res = optimizeMineBudget({
    startWood: 0,
    startClay: 0,
    startIron: 0,
    budgetPP: 350,
    buyRate: 64,
    discountMode: 'smart',
    worldSpeed: 1
  });

  assert.equal(res.woodLvl, 13);
  assert.equal(res.clayLvl, 11);
  assert.equal(res.ironLvl, 8);
  assert.ok(res.spentPP > 340 && res.spentPP <= 350);
  assert.equal(res.addedHourlyProd, 391);
});

test('Every single Tab 1 toggle, bonus, and parameter visibly changes simulation results', () => {
  const base = makeBaseInput();
  const baseRes = runTacticalSimulation(base);

  assert.ok(baseRes.s1NetPP > 500, `Expected meaningful S1 PP, got ${baseRes.s1NetPP}`);
  assert.ok(baseRes.steps.length >= 20);
  assert.ok(baseRes.snapshots.length >= 15);
  assert.equal(baseRes.stages.length, 3);
  assert.equal(baseRes.chartPoints.length, 5);

  // 1. freeFinish toggle
  const freeFinishRes = runTacticalSimulation({ ...base, freeFinish: true });
  assert.notEqual(
    freeFinishRes.s1NetPP,
    baseRes.s1NetPP,
    'freeFinish toggle must change S1 PP'
  );
  assert.ok(
    freeFinishRes.s1NetPP >= baseRes.s1NetPP,
    'freeFinish should improve or equal S1 PP'
  );

  // 2. sideQuests toggle (default true includes Barracks L3 +30 spears +30 swords quest!)
  const noSideQuestsRes = runTacticalSimulation({ ...base, sideQuests: false });
  const sideQuestsRes = runTacticalSimulation({ ...base, sideQuests: true });
  assert.ok(
    sideQuestsRes.finalSwords >= 30 && sideQuestsRes.finalSwords > noSideQuestsRes.finalSwords,
    `sideQuests toggle must grant 30 gift swords at Barracks L3 (got ${sideQuestsRes.finalSwords} vs ${noSideQuestsRes.finalSwords})`
  );
  assert.ok(
    sideQuestsRes.s1NetPP > noSideQuestsRes.s1NetPP + 150,
    `sideQuests toggle must substantially increase S1 PP (${sideQuestsRes.s1NetPP} vs ${noSideQuestsRes.s1NetPP})`
  );

  // 3. boost30 toggle (default true -> false)
  const noBoost30Res = runTacticalSimulation({ ...base, boost30: false });
  assert.ok(
    noBoost30Res.finalHourlyMineProd < baseRes.finalHourlyMineProd,
    'Disabling boost30 must lower hourly mine production'
  );
  assert.ok(
    noBoost30Res.s1NetPP < baseRes.s1NetPP,
    'Disabling boost30 must lower S1 PP'
  );

  // 4. flagPct bonus
  const flagRes = runTacticalSimulation({ ...base, flagPct: 14 });
  assert.ok(flagRes.finalHourlyMineProd > baseRes.finalHourlyMineProd);
  assert.ok(flagRes.s1NetPP > baseRes.s1NetPP);

  // 5. premPct bonus
  const premRes = runTacticalSimulation({ ...base, premPct: 20 });
  assert.ok(premRes.finalHourlyMineProd > baseRes.finalHourlyMineProd);
  assert.ok(premRes.s1NetPP > baseRes.s1NetPP);

  // 6. woodBonusPct / clayBonusPct / ironBonusPct
  const resBonus = runTacticalSimulation({
    ...base,
    woodBonusPct: 20,
    clayBonusPct: 20,
    ironBonusPct: 20
  });
  assert.ok(resBonus.finalHourlyMineProd > baseRes.finalHourlyMineProd);
  assert.ok(resBonus.s1NetPP > baseRes.s1NetPP);

  // 7. 48h +30% boost timing ('after_dev' vs 'during_dev') — PP boosting removed by design
  const boostAfter = runTacticalSimulation({
    ...base,
    boost30: true,
    boostTiming: 'after_dev'
  });
  const boostDuring = runTacticalSimulation({
    ...base,
    boost30: true,
    boostTiming: 'during_dev'
  });
  assert.equal(boostAfter.usedBoostPP, 0, 'PP boost spending is disabled');
  assert.ok(
    boostDuring.boost30ActiveStartSec !== null &&
      boostAfter.boost30ActiveStartSec !== null &&
      boostDuring.boost30ActiveStartSec < boostAfter.boost30ActiveStartSec,
    'during_dev must activate the 48h +30% boost earlier than after_dev'
  );
  assert.ok(boostAfter.boost30ExtraRes > 0, 'after_dev +30% boost must add extra mine resources');
  assert.ok(boostDuring.boost30ExtraRes > 0, 'during_dev +30% boost must add extra mine resources');
  assert.notEqual(
    boostAfter.s1NetPP,
    boostDuring.s1NetPP,
    'after_dev vs during_dev timing must produce distinct paths'
  );

  // 8. extraSpears
  const extraSpRes = runTacticalSimulation({ ...base, extraSpears: 60 });
  assert.ok(
    extraSpRes.finalSpears > baseRes.finalSpears,
    'extraSpears must increase final spear count'
  );

  // 9. marketTargetLvl
  const mktLow = runTacticalSimulation({ ...base, marketTargetLvl: 1 });
  const mktHigh = runTacticalSimulation({ ...base, marketTargetLvl: 10 });
  assert.ok(
    (mktHigh.finalBuildings['السوق'] || 0) > (mktLow.finalBuildings['السوق'] || 0),
    'marketTargetLvl must control built Market level'
  );

  // 10. scavMode ('max_profit' 2h default vs 'min_logins' custom 3.5h cycle)
  const minLoginsRes = runTacticalSimulation({ ...base, scavMode: 'min_logins', scavCycleHrs: 3.5 });
  assert.notEqual(
    minLoginsRes.scavLootTotal,
    baseRes.scavLootTotal,
    'scavMode must change scavenging loot outcome'
  );

  // 11. worldSpeed (1x vs 2x)
  const speed2x = runTacticalSimulation({ ...base, worldSpeed: 2 });
  assert.ok(speed2x.s1NetPP > baseRes.s1NetPP * 1.4, '2x world speed must dramatically boost PP');
});

test('Tab 2 Stages 2-4 checkboxes and cumulative vs per_phase mode update matrix and cumulative PP', () => {
  const base = makeBaseInput();
  const baseRes = runTacticalSimulation(base);
  assert.equal(baseRes.totalCumulativePP, baseRes.s1NetPP);
  assert.ok(baseRes.stages.every((s) => !s.enabled && s.netStagePP === 0));

  const withStages = runTacticalSimulation({
    ...base,
    phases: {
      p2: { enabled: true, days: 4, startRate: 120, endRate: 150 },
      p3: { enabled: true, days: 5, startRate: 150, endRate: 200 },
      p4: { enabled: true, days: 7, startRate: 200, endRate: 260 }
    }
  });

  assert.ok(withStages.stages.every((s) => s.enabled && s.netStagePP > 0));
  assert.ok(withStages.totalCumulativePP > withStages.s1NetPP);
  assert.equal(
    withStages.chartPoints[4].cumulativePP,
    withStages.totalCumulativePP
  );

  // Cumulative optimization mode considers later stages when deciding upgrades
  const cumRes = runTacticalSimulation({
    ...base,
    optMode: 'cumulative',
    phases: {
      p2: { enabled: true, days: 4, startRate: 120, endRate: 150 },
      p3: { enabled: true, days: 5, startRate: 150, endRate: 200 },
      p4: { enabled: true, days: 7, startRate: 200, endRate: 260 }
    }
  });
  assert.ok(cumRes.totalCumulativePP > cumRes.s1NetPP);
  assert.notEqual(
    cumRes.totalCumulativePP,
    withStages.totalCumulativePP,
    'cumulative vs per_phase optimization must produce distinct stage upgrade paths'
  );
});

test('500+ Scenario Multi-Strategy Optimizer beats classic baseline, respects prerequisites, and supports rival policy switching', () => {
  const base = makeBaseInput();
  const res = runTacticalSimulation(base);

  // Must genuinely evaluate > 500 distinct strategic scenarios
  assert.ok(
    res.scenariosTested >= 500,
    `Expected >= 500 tested scenarios, got ${res.scenariosTested}`
  );
  // Winner must strictly beat the classic fixed baseline via reward arbitrage / Paladin / dynamic ROI
  assert.ok(
    res.totalCumulativePP > res.baselineTotalPP,
    `Winner (${res.totalCumulativePP}) must strictly exceed classic baseline (${res.baselineTotalPP})`
  );
  assert.ok(res.gainVsBaselinePP > 50, `Expected meaningful PP gain, got +${res.gainVsBaselinePP}`);
  assert.ok(res.arbitrageBonusRes > 1000, `Expected free arbitrage resources, got ${res.arbitrageBonusRes}`);

  // Top strategies must contain at least 4 distinct strategies sorted descending by PP
  assert.ok(res.topStrategies.length >= 4);
  const archetypes = new Set(res.topStrategies.map((s) => s.policy.archetype));
  assert.ok(archetypes.size >= 3, `Expected diverse archetypes in top strategies, got ${archetypes.size}`);
  for (let i = 1; i < res.topStrategies.length; i++) {
    assert.ok(
      res.topStrategies[i - 1].totalCumulativePP >= res.topStrategies[i].totalCumulativePP,
      'topStrategies must be sorted descending by totalCumulativePP'
    );
  }

  // Every building step in the winning timeline must obey official Tribal Wars prerequisites sequentially
  const simLvls: Record<string, number> = { ...res.startBuildings };
  for (const step of res.steps) {
    if (step.atype === 'bldg') {
      assert.equal(
        checkBuildingPrerequisites(step.baseName, simLvls),
        true,
        `Step #${step.stepNum} (${step.bName}) violated building prerequisites!`
      );
      simLvls[step.baseName] = step.lvl;
    }
  }

  // Switching to a rival strategy via forcedPolicy reproduces that strategy accurately
  const rival = res.topStrategies[res.topStrategies.length - 1];
  const rivalRes = runTacticalSimulation(base, undefined, rival.policy);
  assert.equal(rivalRes.winningPolicy.id, rival.policy.id);
  assert.equal(rivalRes.totalCumulativePP, rival.totalCumulativePP);
  assert.equal(rivalRes.finalSpears, rival.finalSpears);
});

test('runTacticalAutoSearch sweeps 700+ scenarios and finds equal or higher totalCumulativePP than baseline', () => {
  const base = makeBaseInput();
  const baseRes = runTacticalSimulation(base);
  const auto = runTacticalAutoSearch(base);

  assert.ok(auto.testedCount >= 700, `Expected >= 700 auto-search scenarios, got ${auto.testedCount}`);
  assert.ok(
    auto.bestResult.totalCumulativePP >= baseRes.totalCumulativePP,
    `Auto-search (${auto.bestResult.totalCumulativePP}) must be >= baseline (${baseRes.totalCumulativePP})`
  );
});

test('simMode real loads village buildings, stock, and troops properly', () => {
  const state: ErpAppState = {
    ...createDefaultAppState(),
    villages: [
      {
        id: 'v_real_1',
        accountId: 'acc1',
        worldId: 'w94',
        continent: '44',
        name: 'قرية متقدمة',
        coord: '500|500',
        villagePoints: 640,
        flag: 10,
        woodItem: 0,
        clayItem: 0,
        ironItem: 0,
        premium: true,
        boost30: true,
        marketLevel: 6,
        farmLevel: 10,
        mines: {
          wood: { curr: 15, target: 20 },
          clay: { curr: 15, target: 20 },
          iron: { curr: 14, target: 20 }
        },
        warehouse: {
          level: 12,
          woodStock: 4000,
          clayStock: 4000,
          ironStock: 4000,
          lastUpdated: Date.now()
        },
        buildings: {
          'المبنى الرئيسي': 10,
          الثكنات: 5,
          السوق: 6,
          الخشاب: 15,
          'حفرة الطمي': 15,
          'منجم الحديد': 14,
          المخازن: 12,
          المزارع: 10
        },
        spearsTotal: 120,
        unlockedScavTiers: 3
      }
    ]
  };

  const virtualRes = runTacticalSimulation(makeBaseInput(), state);
  const realRes = runTacticalSimulation(
    { ...makeBaseInput(), simMode: 'real', realVillageId: 'v_real_1' },
    state
  );

  assert.ok(realRes.startPoints > virtualRes.startPoints);
  assert.ok(realRes.s1NetPP > virtualRes.s1NetPP);
});

test('buildAssignedPlanFromTacticalResult integrates cleanly with missionEngine tracking', () => {
  const res = runTacticalSimulation(makeBaseInput());
  const plan = buildAssignedPlanFromTacticalResult(res, 'خطة تجريبية');
  assert.equal(plan.name, 'خطة تجريبية');
  assert.ok(plan.steps.length > 0);
  assert.ok(plan.steps.every((s) => s.atype !== 'scav_return'));

  // Starter village has 0 completed steps
  const starterSnap: VillageSyncSnapshot = {
    id: 'v1',
    name: 'قرية 1',
    accountName: 'حساب 1',
    device: 'Chrome',
    browser: 'Chrome',
    buildings: res.startBuildings,
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
    unlockedScavTiers: 0,
    scavState: 'no_barracks',
    scavRemHours: 0,
    marketLevel: 0,
    sellWood: 64,
    sellClay: 64,
    sellIron: 64,
    buyRate: 64,
    assignedPlan: { name: plan.name, steps: plan.steps }
  };
  const briefStart = evaluateVillageMissionBriefing(starterSnap);
  assert.equal(briefStart.completedStepsCount, 0);
  assert.ok(briefStart.readyStepsNow.length > 0);

  // Completed village hits 100% completion (including Paladin and Swords if trained)
  const doneSnap: VillageSyncSnapshot = {
    ...starterSnap,
    buildings: res.finalBuildings,
    spearsTotal: res.finalSpears,
    swordsTotal: res.finalSwords,
    unitsTotal: {
      spear: res.finalSpears,
      sword: res.finalSwords,
      knight: res.finalPaladins
    },
    unlockedScavTiers: res.finalScavTier,
    boost30: res.boost30ActiveStartSec !== null
  };
  const briefDone = evaluateVillageMissionBriefing(doneSnap);
  assert.equal(briefDone.completedStepsCount, plan.steps.length);
  assert.equal(briefDone.remainingSteps.length, 0);
});

test('Mechanical Invariant Auditor: zero Warehouse/Farm/Prereq/Timing violations across configs, rivals, and Scav Tier 4 gating', async () => {
  const {
    getBuildingLevelCost,
    getWarehouseCap,
    getFarmCap,
    SCAV_UNLOCK_DATA,
    getBuildingTotalPop,
    getBuildingPopDelta,
    getMinWarehouseLevelForCost
  } = await import('../../src/core/index.ts');

  // Verify exact Tribal Wars Scavenging Tier 4 capacity requirement: 12,000 clay requires WH 14 (14,670 cap; WH 13 is only 11,932)
  const scav4 = SCAV_UNLOCK_DATA['4'];
  assert.equal(scav4.wood + scav4.clay + scav4.iron, 32000);
  assert.equal(getMinWarehouseLevelForCost({ w: scav4.wood, c: scav4.clay, i: scav4.iron }), 14);
  assert.ok(getWarehouseCap(13) < scav4.clay);
  assert.ok(getWarehouseCap(14) >= scav4.clay);

  const calcUsedPop = (
    lvls: Record<string, number>,
    spears: number,
    swords: number,
    knights: number
  ): number => {
    let pop = 0;
    for (const [b, lvl] of Object.entries(lvls)) {
      if (lvl > 0) pop += getBuildingTotalPop(b, lvl);
    }
    return pop + spears + swords + knights * 10;
  };

  const auditTimeline = (
    label: string,
    input: ReturnType<typeof makeBaseInput>,
    res: ReturnType<typeof runTacticalSimulation>,
    startScav = 0,
    startSpears = 0,
    startSwords = 0
  ) => {
    const lvls: Record<string, number> = { ...res.startBuildings };
    let spears = startSpears;
    let swords = startSwords;
    let knights = 0;
    let scavUnlocked = startScav;
    let tier1FinishSec = scavUnlocked >= 1 ? 0 : Infinity;
    let firstTroopFinishSec = spears + swords + knights > 0 ? 0 : Infinity;

    for (const s of res.steps) {
      if (s.atype === 'bldg') {
        assert.ok(
          !(s.reason?.includes('لفتح الإغارة 4') && res.finalScavTier < 4),
          `${label}: wasted WH upgrade for unreached Scav Tier 4 at step #${s.stepNum}`
        );
        assert.equal(
          s.lvl,
          (lvls[s.baseName] || 0) + 1,
          `${label}: ${s.baseName} jumped from ${lvls[s.baseName] || 0} to ${s.lvl}`
        );
        assert.equal(
          checkBuildingPrerequisites(s.baseName, lvls),
          true,
          `${label}: prereq failed for ${s.bName}`
        );
        const cost = getBuildingLevelCost(s.baseName, s.lvl);
        const whCap = getWarehouseCap(lvls['المخازن'] || 1);
        assert.ok(
          Math.max(cost.w, cost.c, cost.i) <= whCap,
          `${label}: ${s.bName} maxCost ${Math.max(cost.w, cost.c, cost.i)} > WH cap ${whCap}`
        );
        const popDelta = getBuildingPopDelta(s.baseName, s.lvl);
        const isBarracks3Gift =
          s.baseName === 'الثكنات' &&
          s.lvl === 3 &&
          input.sideQuests &&
          (res.startBuildings['الثكنات'] || 0) < 3;
        const questPop = isBarracks3Gift ? 60 : 0;
        const usedPop = calcUsedPop(lvls, spears, swords, knights);
        const farmCap = getFarmCap(lvls['المزارع'] || 1);
        if (s.baseName !== 'المزارع' && popDelta + questPop > 0) {
          assert.ok(
            usedPop + popDelta + questPop <= farmCap,
            `${label}: ${s.bName} pop ${usedPop}+${popDelta}+${questPop} > Farm cap ${farmCap}`
          );
        }
        lvls[s.baseName] = s.lvl;
        if (isBarracks3Gift) {
          spears += 30;
          swords += 30;
          firstTroopFinishSec = Math.min(firstTroopFinishSec, s.tEnd);
        }
      } else if (s.atype === 'scav_unlock') {
        const tier = s.lvl;
        assert.equal(tier, scavUnlocked + 1, `${label}: scav tier jumped from ${scavUnlocked} to ${tier}`);
        assert.ok((lvls['نقطة التجمع'] || 0) >= 1, `${label}: scav unlock without rally point`);
        const cfg = SCAV_UNLOCK_DATA[String(tier)];
        const whCap = getWarehouseCap(lvls['المخازن'] || 1);
        assert.ok(
          Math.max(cfg.wood, cfg.clay, cfg.iron) <= whCap,
          `${label}: Scav Tier ${tier} maxCost > WH cap ${whCap} (WH L${lvls['المخازن']})`
        );
        const expectedDur = Math.max(10, Math.round(cfg.sec / (input.worldSpeed || 1)));
        assert.ok(
          Math.abs(s.buildDur - expectedDur) <= 2,
          `${label}: Scav Tier ${tier} buildDur ${s.buildDur} !== expected ${expectedDur}`
        );
        scavUnlocked = tier;
        if (tier === 1) tier1FinishSec = s.tEnd;
      } else if (s.atype === 'train_paladin') {
        assert.ok((lvls['النصب التذكاري'] || 0) >= 1, `${label}: paladin without statue`);
        assert.ok(calcUsedPop(lvls, spears, swords, knights) + 10 <= getFarmCap(lvls['المزارع'] || 1));
        knights += 1;
        firstTroopFinishSec = Math.min(firstTroopFinishSec, s.tEnd);
      } else if (s.atype === 'train_spear') {
        assert.ok((lvls['الثكنات'] || 0) >= 1, `${label}: spear without barracks`);
        const delta = Math.max(0, s.lvl - spears);
        assert.ok(calcUsedPop(lvls, spears, swords, knights) + delta <= getFarmCap(lvls['المزارع'] || 1));
        spears = Math.max(spears, s.lvl);
        firstTroopFinishSec = Math.min(firstTroopFinishSec, s.tStart + (delta > 0 ? s.buildDur / delta : 0));
      } else if (s.atype === 'train_sword') {
        assert.ok(
          (lvls['الثكنات'] || 0) >= 1 && (lvls['الحداد'] || 0) >= 1,
          `${label}: sword requires Barracks L1 + Smithy L1`
        );
        const delta = Math.max(0, s.lvl - swords);
        assert.ok(calcUsedPop(lvls, spears, swords, knights) + delta <= getFarmCap(lvls['المزارع'] || 1));
        swords = Math.max(swords, s.lvl);
        firstTroopFinishSec = Math.min(firstTroopFinishSec, s.tStart + (delta > 0 ? s.buildDur / delta : 0));
      } else if (s.atype === 'scav_return') {
        assert.ok(s.tStart >= tier1FinishSec - 1, `${label}: scav_return before Tier 1 finished`);
        assert.ok(s.tStart >= firstTroopFinishSec - 1, `${label}: scav_return before first troop finished`);
      }
    }

    assert.ok(
      res.actualSummary.includes(`مخزن م${res.finalBuildings['المخازن']}`),
      `${label}: actualSummary must display actual WH level`
    );
    assert.ok(
      res.actualSummary.includes(`إغارة م${res.finalScavTier}`),
      `${label}: actualSummary must display actual reached Scav tier`
    );
    if (res.finalScavTier >= 4) {
      assert.ok((res.finalBuildings['المخازن'] || 0) >= 14, `${label}: Scav 4 requires WH >= 14`);
    }
  };

  const base = makeBaseInput();

  // 1. Starter village configs (including 2x speed & boosts) — Scav 4 must NEVER be falsely unlocked at WH 5
  const starterConfigs = [
    ['default', base],
    ['2x', { ...base, worldSpeed: 2 }],
    ['boost_after', { ...base, boostBudgetPP: 200, boostTiming: 'after_dev' as const }],
    ['boost_during', { ...base, boostBudgetPP: 300, boostTiming: 'during_dev' as const }],
    ['sideQuests_freeFinish', { ...base, sideQuests: true, freeFinish: true }]
  ] as const;

  for (const [name, cfg] of starterConfigs) {
    const res = runTacticalSimulation(cfg);
    auditTimeline(name, cfg, res);
    assert.ok(res.finalScavTier <= 3, `${name}: starter village should not unlock unprofitable Scav Tier 4`);
    // Also audit ALL Top 5 rival strategies for default & 2x
    if (name === 'default' || name === '2x') {
      for (let i = 0; i < res.topStrategies.length; i++) {
        const rivalRes = runTacticalSimulation(cfg, undefined, res.topStrategies[i].policy);
        auditTimeline(`${name}-rival-${i + 1}`, cfg, rivalRes);
      }
    }
  }

  // 2. Real advanced village with WH 14 & 600 spears — Scav 4 MUST be able to unlock legally & profitably
  const advState: ErpAppState = {
    ...createDefaultAppState(),
    villages: [
      {
        id: 'v_adv_wh14',
        accountId: 'acc1',
        worldId: 'w94',
        continent: '44',
        name: 'قرية متقدمة WH14',
        coord: '500|500',
        villagePoints: 1850,
        flag: 10,
        woodItem: 0,
        clayItem: 0,
        ironItem: 0,
        premium: true,
        boost30: true,
        marketLevel: 10,
        farmLevel: 18,
        mines: {
          wood: { curr: 18, target: 25 },
          clay: { curr: 18, target: 25 },
          iron: { curr: 17, target: 25 }
        },
        warehouse: {
          level: 14,
          woodStock: 11000,
          clayStock: 13000,
          ironStock: 11000,
          lastUpdated: Date.now()
        },
        buildings: {
          'المبنى الرئيسي': 15,
          الثكنات: 12,
          الاسطبل: 5,
          الورشة: 2,
          الأكاديمية: 0,
          الحداد: 10,
          'نقطة التجمع': 1,
          'النصب التذكاري': 1,
          السوق: 10,
          الخشاب: 18,
          'حفرة الطمي': 18,
          'منجم الحديد': 17,
          المزارع: 18,
          المخازن: 14,
          المخابئ: 1,
          الحائط: 10
        },
        spearsTotal: 600,
        swordsTotal: 100,
        unlockedScavTiers: 3
      }
    ]
  };
  const advInput = {
    ...base,
    simMode: 'real' as const,
    realVillageId: 'v_adv_wh14',
    devHours: 48,
    s1Days: 10
  };
  const advRes = runTacticalSimulation(advInput, advState);
  auditTimeline('advanced_wh14', advInput, advRes, 3, 600, 100);
  assert.equal(advRes.finalScavTier, 4, 'Advanced village with WH 14 and 600 spears should legally unlock Scav Tier 4');
  assert.ok(advRes.finalBuildings['المخازن'] >= 14);
  assert.ok(advRes.gainVsBaselinePP > 0);
});

test('Strategic Intelligence Verification: Hiding Place L4, Wall L1-3, Barracks L3 30+30 Quest, Wood-First Iron-Deferral, and JIT Market L3-5', () => {
  const base = makeBaseInput();
  const res = runTacticalSimulation(base);

  // 1. Harvests Hiding Place & Wall early free-resource arbitrage
  assert.ok(
    (res.finalBuildings['المخابئ'] || 0) >= 3,
    `Expected Hiding Place >= 3 for early free arbitrage, got ${res.finalBuildings['المخابئ']}`
  );
  assert.ok(
    (res.finalBuildings['الحائط'] || 0) >= 2,
    `Expected Wall >= 2 for early free wood arbitrage, got ${res.finalBuildings['الحائط']}`
  );

  // 2. Rushes Barracks L3 to claim the 30 Spears + 30 Swords quest army early
  assert.ok(
    (res.finalBuildings['الثكنات'] || 0) >= 3,
    `Expected Barracks >= 3 for 30+30 quest reward, got ${res.finalBuildings['الثكنات']}`
  );
  assert.ok(res.finalSwords >= 30, `Expected >= 30 gift swords, got ${res.finalSwords}`);
  assert.ok(res.s1NetPP >= 1200, `Expected high-efficiency S1 PP >= 1200 with 48h boost30 & quests, got ${res.s1NetPP}`);

  // 3. Shadow-priced resource ordering: Timber Camp leads Iron Mine during development
  assert.ok(
    (res.finalBuildings['الخشاب'] || 0) > (res.finalBuildings['منجم الحديد'] || 0),
    `Expected Wood (${res.finalBuildings['الخشاب']}) > Iron (${res.finalBuildings['منجم الحديد']})`
  );

  // 4. Market L3-5 built just-in-time (not wasted in first half of dev!)
  const mkt3Step = res.steps.find((s) => s.atype === 'bldg' && s.baseName === 'السوق' && s.lvl === 3);
  assert.ok(mkt3Step, 'Expected Market L3 step when marketTargetLvl = 5');
  assert.ok(
    mkt3Step!.tStart >= (base.devHours * 3600) * 0.5,
    `Market L3 should be built JIT in second half of dev, but started at ${Math.round(mkt3Step!.tStart / 3600)}h`
  );

  // 5. Even with sideQuests disabled, unified brain beats classic baseline decisively
  const noQuestRes = runTacticalSimulation({ ...base, sideQuests: false });
  assert.ok(
    noQuestRes.gainVsBaselinePP >= 75,
    `Expected >= +75 PP algorithmic gain even without sideQuests, got +${noQuestRes.gainVsBaselinePP}`
  );
  assert.ok((noQuestRes.finalBuildings['المخابئ'] || 0) >= 3);
  assert.ok((noQuestRes.finalBuildings['الحائط'] || 0) >= 2);
});

test('Simulator Sanity Guard: never unlocks Tier 3 with tiny army, differentiates 48h boost30 timing & 2x speed, and keeps honest labels', () => {
  const base = makeBaseInput();
  const res1x = runTacticalSimulation(base);

  // Must train substantial army when Tier 3 is unlocked (never 6 spears + T3!)
  if (res1x.finalScavTier >= 3) {
    assert.ok(
      res1x.finalSpears >= 80,
      `Expected >= 80 spears with Tier 3 unlocked on 1x, got ${res1x.finalSpears}`
    );
  }
  // Warehouse must not panic-build to Lv 7+ on 1x mines <= 12
  assert.ok(
    (res1x.finalBuildings['المخازن'] || 1) <= 6,
    `Expected realistic WH <= 6 on 1x, got ${res1x.finalBuildings['المخازن']}`
  );
  // Steps must be in non-decreasing chronological order
  for (let i = 1; i < res1x.steps.length; i++) {
    assert.ok(
      res1x.steps[i].tStart >= res1x.steps[i - 1].tStart,
      `Step #${i + 1} (${res1x.steps[i].tStart}) precedes Step #${i} (${res1x.steps[i - 1].tStart})`
    );
  }
  // Honest executed labels: never claim Paladin if finalPaladins === 0
  for (const cand of res1x.topStrategies) {
    if (cand.finalPaladins === 0) {
      assert.equal(cand.label.includes('قائد الفرسان'), false, `Misleading Paladin label: ${cand.label}`);
    }
    if (cand.barracksLvl < 3) {
      assert.equal(cand.label.includes('ثكنات م3'), false, `Misleading Barracks 3 label: ${cand.label}`);
    }
  }

  // 48h +30% boost timing: during_dev activates earlier than after_dev and alters results
  const resDuring = runTacticalSimulation({ ...base, boost30: true, boostTiming: 'during_dev' });
  assert.ok(res1x.boost30ActiveStartSec !== null && resDuring.boost30ActiveStartSec !== null);
  assert.ok(
    resDuring.boost30ActiveStartSec! < res1x.boost30ActiveStartSec!,
    'during_dev must activate +30% boost earlier than after_dev'
  );
  assert.equal(res1x.boost30ActiveEndSec! - res1x.boost30ActiveStartSec!, 48 * 3600);
  assert.equal(resDuring.boost30ActiveEndSec! - resDuring.boost30ActiveStartSec!, 48 * 3600);

  // 2x world speed genuinely shifts strategy (higher mines & higher PP)
  const res2x = runTacticalSimulation({ ...base, worldSpeed: 2 });
  assert.ok(res2x.s1NetPP > res1x.s1NetPP * 1.8);
  assert.ok((res2x.finalBuildings['الخشاب'] || 0) > (res1x.finalBuildings['الخشاب'] || 0));

  // max_profit (2h) vs min_logins (3h) produce different dispatch login intervals
  const resMinLog = runTacticalSimulation({ ...base, scavMode: 'min_logins', scavCycleHrs: 3 });
  assert.ok(
    resMinLog.loginIntervalSec > res1x.loginIntervalSec,
    `Expected min_logins 3h (${resMinLog.loginIntervalSec}s) > max_profit 2h (${res1x.loginIntervalSec}s)`
  );
});

test('Parallel multi-queue execution overlaps HQ builds with Barracks training and Scav unlocks', () => {
  const base = makeBaseInput();
  const res = runTacticalSimulation(base);

  const bldgs = res.steps.filter((s) => s.atype === 'bldg' && s.tEnd > s.tStart);
  const nonHq = res.steps.filter(
    (s) =>
      (s.atype === 'train_spear' ||
        s.atype === 'train_sword' ||
        s.atype === 'train_paladin' ||
        s.atype === 'scav_unlock' ||
        s.atype === 'research_sword') &&
      s.tEnd > s.tStart
  );

  let parallelOverlaps = 0;
  for (const b of bldgs) {
    for (const o of nonHq) {
      if (b.tStart < o.tEnd && o.tStart < b.tEnd) {
        parallelOverlaps++;
      }
    }
  }
  assert.ok(
    parallelOverlaps >= 5,
    `Expected substantial parallel overlap between HQ builds and Barracks/Scav queues, got ${parallelOverlaps}`
  );
});

test('4-slot scavenging pauses new dispatches during sleep, launches overnight wave, and respects minScavCycleHrs', () => {
  const base = makeBaseInput();
  const resSleep = runTacticalSimulation({ ...base, activeHrs: 16, devHours: 36 });
  assert.ok(
    resSleep.overnightScavRunsDev >= 1,
    `Expected at least 1 overnight scav wave when activeHrs=16 & devHours=36, got ${resSleep.overnightScavRunsDev}`
  );
  assert.ok(
    resSleep.dayScavRunsDev >= 5,
    `Expected multiple daytime scav runs, got ${resSleep.dayScavRunsDev}`
  );

  // Configurable minScavCycleHrs under max_profit
  const resFast = runTacticalSimulation({ ...base, scavMode: 'max_profit', minScavCycleHrs: 1 });
  const resSlow = runTacticalSimulation({ ...base, scavMode: 'max_profit', minScavCycleHrs: 3 });
  assert.ok(
    resSlow.loginIntervalSec > resFast.loginIntervalSec,
    `Expected minScavCycleHrs=3 (${resSlow.loginIntervalSec}s) > minScavCycleHrs=1 (${resFast.loginIntervalSec}s)`
  );
});

test('Authentic quests: buildingQuests=false disables 10% refunds and configurable starting stocks change results', () => {
  const base = makeBaseInput();
  const noBuildQuests = runTacticalSimulation({ ...base, buildingQuests: false });
  assert.equal(noBuildQuests.arbitrageBonusRes, 0, 'buildingQuests=false must produce zero arbitrage bonus');
  for (const s of noBuildQuests.steps.filter((st) => st.atype === 'bldg')) {
    assert.equal(
      s.rew.w + s.rew.c + s.rew.i,
      0,
      `Expected zero build refund on ${s.bName} when buildingQuests=false`
    );
  }

  // Configurable virtual26 starting stocks
  const richStart = runTacticalSimulation({
    ...base,
    startWoodStock: 900,
    startClayStock: 900,
    startIronStock: 800
  });
  const poorStart = runTacticalSimulation({
    ...base,
    startWoodStock: 200,
    startClayStock: 200,
    startIronStock: 150
  });
  assert.ok(
    richStart.s1NetPP > poorStart.s1NetPP,
    `Higher starting stocks (${richStart.s1NetPP}) should yield higher S1 PP than lower stocks (${poorStart.s1NetPP})`
  );
});

test('Authentic Smithy Lv1 Sword Research gates train_sword in both simulator and missionEngine', () => {
  const base = makeBaseInput();
  const res = runTacticalSimulation(base);
  const swordPolicy = {
    ...res.winningPolicy,
    swordTarget: 20,
    scavTierCap: 3 as const
  };
  const withResearch = runTacticalSimulation(
    { ...base, devHours: 48, requireSwordResearch: true },
    undefined,
    swordPolicy
  );

  const researchStep = withResearch.steps.find((s) => s.atype === 'research_sword');
  const firstTrainSword = withResearch.steps.find((s) => s.atype === 'train_sword');
  const smithy1Step = withResearch.steps.find(
    (s) => s.atype === 'bldg' && s.baseName === 'الحداد' && s.lvl === 1
  );

  if (firstTrainSword) {
    assert.ok(smithy1Step, 'Smithy Lv1 must be built before training swords');
    assert.ok(researchStep, 'research_sword step must exist before train_sword when requireSwordResearch=true');
    assert.ok(
      researchStep!.tStart >= smithy1Step!.tEnd - 1,
      'research_sword must start only after Smithy Lv1 finishes'
    );
    assert.ok(
      firstTrainSword.tStart >= researchStep!.tEnd - 1,
      'train_sword must start only after research_sword completes'
    );
  }

  // Mission engine prerequisite check: train_sword waits for research_sword when swordResearched is false
  const plan = {
    name: 'خطة اختبار السيف',
    steps: [
      {
        stepNum: 1,
        atype: 'bldg' as const,
        bName: 'الحداد (م1)',
        baseName: 'الحداد',
        targetLvl: 1,
        costW: 220,
        costC: 180,
        costI: 240
      },
      {
        stepNum: 2,
        atype: 'research_sword' as const,
        bName: 'بحث مقاتل السيف (الحداد م1)',
        baseName: 'مقاتل السيف',
        targetLvl: 1,
        costW: 900,
        costC: 800,
        costI: 700
      },
      {
        stepNum: 3,
        atype: 'train_sword' as const,
        bName: 'تدريب 10 سيف',
        baseName: 'سيف',
        targetLvl: 10,
        costW: 300,
        costC: 300,
        costI: 700
      }
    ]
  };
  const snapBase: VillageSyncSnapshot = {
    id: 'v_sw_test',
    name: 'قرية السيف',
    accountName: 'acc1',
    device: 'PC',
    browser: 'Chrome',
    woodStock: 1000,
    clayStock: 1000,
    ironStock: 1000,
    wProd: 120,
    cProd: 120,
    iProd: 120,
    warehouseCap: 2000,
    marketLevel: 1,
    buildings: { 'المبنى الرئيسي': 5, الثكنات: 3, الحداد: 1, المخازن: 5, المزارع: 5, السوق: 1 },
    spearsHome: 30,
    swordsHome: 0,
    spearsAway: 0,
    swordsAway: 0,
    spearsTotal: 30,
    swordsTotal: 0,
    swordResearched: false,
    unlockedScavTiers: 1,
    scavState: 'idle_troops',
    scavRemHours: 0,
    sellWood: 64,
    sellClay: 64,
    sellIron: 64,
    buyRate: 64,
    assignedPlan: plan
  };
  const briefingBefore = evaluateVillageMissionBriefing(snapBase);
  assert.equal(
    briefingBefore.readyStepsNow[0]?.atype,
    'research_sword',
    'missionEngine must queue research_sword before train_sword'
  );
  // With Smithy Lv0, research_sword must wait for prerequisite
  const briefingNoSmithy = evaluateVillageMissionBriefing({
    ...snapBase,
    buildings: { 'المبنى الرئيسي': 5, الثكنات: 3, الحداد: 0, المخازن: 5, المزارع: 5, السوق: 1 }
  });
  assert.equal(briefingNoSmithy.readyStepsNow[0]?.baseName, 'الحداد');

  const briefingAfter = evaluateVillageMissionBriefing({
    ...snapBase,
    swordResearched: true
  });
  assert.equal(
    briefingAfter.readyStepsNow[0]?.atype,
    'train_sword',
    'Once swordResearched=true, missionEngine advances to train_sword'
  );
});

test('Real merchant capacity and per-resource sell pricing shape valuation and bottleneck telemetry', () => {
  // Real merchant throughput formula
  assert.equal(calcDailyMerchantCapacityRes(0, 16, 1), 0);
  const capM5 = calcDailyMerchantCapacityRes(5, 16, 1);
  const capM10 = calcDailyMerchantCapacityRes(10, 16, 1);
  assert.ok(capM10 > capM5 * 1.9, `Market Lv10 (${capM10}) must offer ~2x merchant capacity of Market Lv5 (${capM5})`);

  const base = makeBaseInput();
  const woodExpensive = runTacticalSimulation({
    ...base,
    sellRate: 120,
    sellWood: 40,
    sellClay: 120,
    sellIron: 200
  });
  const ironExpensive = runTacticalSimulation({
    ...base,
    sellRate: 120,
    sellWood: 200,
    sellClay: 120,
    sellIron: 40
  });

  assert.ok(woodExpensive.dailyMerchantCapRes > 0, 'dailyMerchantCapRes must be reported');
  assert.ok(
    (woodExpensive.finalBuildings['الخشاب'] || 0) - (woodExpensive.finalBuildings['منجم الحديد'] || 0) >
      (ironExpensive.finalBuildings['الخشاب'] || 0) - (ironExpensive.finalBuildings['منجم الحديد'] || 0),
    'Per-resource sell pricing must shift mine preference toward the higher-PP/resource mine'
  );
});

test('Steady daily PP excludes temporary 48h +30% boost while boost30ExtraPP tracks it separately (including 2x during_dev)', () => {
  const base = makeBaseInput();
  const withBoost = runTacticalSimulation({ ...base, boost30: true, boostTiming: 'after_dev' });
  const withoutBoost = runTacticalSimulation({ ...base, boost30: false });

  assert.equal(
    Number((withBoost.steadyDailyMinePP + withBoost.steadyDailyScavPP).toFixed(1)),
    Number(withBoost.steadyDailyTotalPP.toFixed(1)),
    'steadyDailyTotalPP must equal steadyDailyMinePP + steadyDailyScavPP'
  );
  assert.equal(
    withBoost.dailyTotalPP,
    withBoost.steadyDailyTotalPP,
    'dailyTotalPP must reflect clean steady base rate, not temporary 48h boost'
  );
  assert.ok(withBoost.boost30ExtraPP > 0, `Expected positive boost30ExtraPP when boost30=true, got ${withBoost.boost30ExtraPP}`);
  assert.equal(withoutBoost.boost30ExtraPP, 0, 'Expected zero boost30ExtraPP when boost30=false');

  // 2x speed during_dev should still trigger boost30 cleanly with speed-calibrated threshold
  const fastDuring = runTacticalSimulation({
    ...base,
    worldSpeed: 2,
    boost30: true,
    boostTiming: 'during_dev'
  });
  assert.ok(fastDuring.boost30ActiveStartSec !== null && fastDuring.boost30ExtraPP > 0);
});

test('Stages 2-4 model real offline overflow, merchant limits, and multi-building upgrades', () => {
  const base = makeBaseInput();
  const stagesCfg = {
    ...base,
    activeHrs: 12,
    marketTargetLvl: 3,
    phases: {
      p2: { enabled: true, days: 7, startRate: 70, endRate: 95 },
      p3: { enabled: true, days: 7, startRate: 95, endRate: 130 },
      p4: { enabled: true, days: 7, startRate: 130, endRate: 170 }
    }
  };
  const multiStageCum = runTacticalSimulation({ ...stagesCfg, optMode: 'cumulative' });
  const multiStagePer = runTacticalSimulation({ ...stagesCfg, optMode: 'per_phase' });

  assert.equal(multiStageCum.stages.length, 3);
  assert.ok(
    multiStageCum.totalCumulativePP > multiStagePer.totalCumulativePP,
    `Cumulative mode (${multiStageCum.totalCumulativePP}) should outperform per_phase (${multiStagePer.totalCumulativePP})`
  );
  const allUpgradeText = multiStageCum.stages.map((s) => s.upgradesDesc).join(' ');
  assert.ok(
    allUpgradeText.includes('مخزن') || allUpgradeText.includes('سوق'),
    `Expected Stages 2-4 to upgrade Warehouse or Market under 12h offline / Market L3, got: ${allUpgradeText}`
  );
  for (const st of multiStagePer.stages) {
    assert.ok(st.enabled);
    assert.ok(
      st.netStagePP >= st.sellOnlyPP,
      `Per-phase Stage ${st.stageNum} net PP (${st.netStagePP}) should never be worse than sell-only (${st.sellOnlyPP})`
    );
    assert.ok(typeof st.overflowLossRes === 'number' && st.overflowLossRes >= 0);
    assert.ok(typeof st.merchantBottleneckRes === 'number' && st.merchantBottleneckRes >= 0);
  }
});



