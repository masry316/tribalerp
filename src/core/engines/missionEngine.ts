import { MARKET_MERCHANTS, SCAV_UNIT_DEFS, UNIT_CARRY_CAP } from '../constants/gameData';
import type {
  ErpAppState,
  ErpVillage,
  MissionBriefingResult,
  PlanStep,
  SessionLogEntry,
  SessionStatsOverview,
  UnitKey,
  VillageLiveStatus,
  VillageSyncSnapshot
} from '../types';
import { computeVillageLiveStatus, normalizeBuildingsMap } from './resourceEngine';

export function formatHoursArabic(hours: number): string {
  if (!isFinite(hours) || hours <= 0) return 'الآن';
  const h = Math.floor(hours);
  const m = Math.max(1, Math.round((hours - h) * 60));
  if (m === 60) {
    return `${h + 1} ساعة`;
  }
  if (h > 0) return `${h}س و${m}د`;
  return `${m} دقيقة`;
}

export function formatSecondsArabic(sec: number): string {
  const s = Math.max(0, Math.round(Number(sec || 0)));
  if (s <= 0) return '0ث';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const remS = s % 60;
  if (h > 0) return `${h}س و${m}د`;
  if (m > 0 && remS > 0) return `${m}د و${remS}ث`;
  if (m > 0) return `${m} دقيقة`;
  return `${remS} ثانية`;
}

export function evaluateVillageMissionBriefing(v: VillageSyncSnapshot): MissionBriefingResult {
  const steps = v.assignedPlan && Array.isArray(v.assignedPlan.steps) ? v.assignedPlan.steps : [];
  const hasPlan = steps.length > 0;
  const bldgs = v.buildings || {};

  const remainingSteps: PlanStep[] = [];
  let completedStepsCount = 0;

  const checkPrereqBuilding = (base: string, map: Record<string, number>): boolean => {
    const hq = Number(map['المبنى الرئيسي'] || 0);
    const bar = Number(map['الثكنات'] || 0);
    const wh = Number(map['المخازن'] || 0);
    const sm = Number(map['الحداد'] || 0);
    const mkt = Number(map['السوق'] || v.marketLevel || 0);
    if (base === 'الثكنات') return hq >= 3;
    if (base === 'الحائط') return bar >= 1;
    if (base === 'السوق') return hq >= 3 && wh >= 2;
    if (base === 'الحداد') return hq >= 5 && bar >= 1;
    if (base === 'الإسطبل') return hq >= 10 && bar >= 5 && sm >= 5;
    if (base === 'الورشة') return hq >= 10 && sm >= 10;
    if (base === 'الأكاديمية') return hq >= 20 && sm >= 20 && mkt >= 10;
    return true;
  };

  const currentSwordCount = Number(v.unitsTotal?.sword ?? v.swordsTotal ?? 0);
  const currentSmithyLvl = Number(bldgs['الحداد'] || 0);
  const isSwordResearched =
    Boolean(v.swordResearched) ||
    (currentSmithyLvl >= 1 && (currentSwordCount > 0 || currentSmithyLvl >= 2));

  for (const s of steps) {
    if (s.atype === 'scav_return' || s.atype === 'sell_surplus') {
      completedStepsCount++;
      continue;
    }
    let isDone = false;
    if (s.atype === 'scav_unlock') {
      if ((v.unlockedScavTiers || 0) >= (s.targetLvl || 1)) isDone = true;
    } else if (s.atype === 'train_spear') {
      if ((v.spearsTotal || 0) >= (s.targetLvl || 1)) isDone = true;
    } else if (s.atype === 'train_paladin') {
      if (Number(v.unitsTotal?.knight || 0) >= (s.targetLvl || 1)) isDone = true;
    } else if (s.atype === 'research_sword') {
      if (isSwordResearched) isDone = true;
    } else if (s.atype === 'train_sword') {
      if (currentSwordCount >= (s.targetLvl || 1)) isDone = true;
    } else if (s.atype === 'train_light') {
      if (Number(v.unitsTotal?.light || 0) >= (s.targetLvl || 1)) isDone = true;
    } else if (s.atype === 'boost30_activate') {
      if (Boolean(v.boost30)) isDone = true;
    } else {
      const base = s.baseName || s.bName.replace(/\s*[\(（]?م\d+[\)）]?/g, '').trim();
      const curLvl = Number(bldgs[base] ?? bldgs[s.bName] ?? 0);
      if (curLvl >= (s.targetLvl || 1)) isDone = true;
    }

    if (isDone) {
      completedStepsCount++;
    } else {
      remainingSteps.push(s);
    }
  }

  let simW = Number(v.woodStock || 0);
  let simC = Number(v.clayStock || 0);
  let simI = Number(v.ironStock || 0);
  const simBldgs: Record<string, number> = { ...bldgs };
  if (simBldgs['السوق'] === undefined && Number(v.marketLevel || 0) > 0) {
    simBldgs['السوق'] = Number(v.marketLevel || 0);
  }
  let simScavTiers = Number(v.unlockedScavTiers || 0);
  let simSwordResearched = isSwordResearched;

  const readyStepsNow: PlanStep[] = [];
  let nextWaitingStep: PlanStep | null = null;
  let waitingPrereqText = '';

  const checkStepPrereq = (s: PlanStep): { ok: boolean; reason: string } => {
    if (s.atype === 'boost30_activate') {
      const mktLvl = Math.max(Number(simBldgs['السوق'] || 0), Number(v.marketLevel || 0));
      if (mktLvl < 5) return { ok: false, reason: 'يتطلب وصول السوق مستوى 5' };
      return { ok: true, reason: '' };
    }
    if (s.atype === 'research_sword') {
      if (Number(simBldgs['الحداد'] || 0) < 1) return { ok: false, reason: 'يتطلب بناء الحداد مستوى 1' };
      return { ok: true, reason: '' };
    }
    if (s.atype === 'train_sword') {
      if (Number(simBldgs['الثكنات'] || 0) < 1) return { ok: false, reason: 'يتطلب الثكنات مستوى 1' };
      if (Number(simBldgs['الحداد'] || 0) < 1) return { ok: false, reason: 'يتطلب الحداد مستوى 1 وبحث السيف' };
      if (!simSwordResearched) return { ok: false, reason: 'يتطلب إتمام بحث السيف في الحداد' };
      return { ok: true, reason: '' };
    }
    if (s.atype === 'train_spear') {
      if (Number(simBldgs['الثكنات'] || 0) < 1) return { ok: false, reason: 'يتطلب الثكنات مستوى 1' };
      return { ok: true, reason: '' };
    }
    if (s.atype === 'train_paladin') {
      if (Number(simBldgs['النصب التذكاري'] || 0) < 1) return { ok: false, reason: 'يتطلب النصب التذكاري مستوى 1' };
      return { ok: true, reason: '' };
    }
    if (s.atype === 'scav_unlock') {
      if (Number(simBldgs['نقطة التجمع'] || 0) < 1) return { ok: false, reason: 'يتطلب نقطة التجمع مستوى 1' };
      if (simScavTiers < Math.max(0, (s.targetLvl || 1) - 1)) {
        return { ok: false, reason: `يتطلب فتح الإغارة ${(s.targetLvl || 1) - 1} أولاً` };
      }
      return { ok: true, reason: '' };
    }
    if (s.atype === 'bldg') {
      const base = s.baseName || s.bName.replace(/\s*[\(（]?م\d+[\)）]?/g, '').trim();
      if (!checkPrereqBuilding(base, simBldgs)) {
        return { ok: false, reason: `يتطلب استكمال متطلبات ${base} أولاً` };
      }
      const curLvl = Number(simBldgs[base] ?? 0);
      const targetLvl = Number(s.targetLvl || 1);
      if (curLvl < targetLvl - 1) {
        return { ok: false, reason: `يتطلب ${base} مستوى ${targetLvl - 1} أولاً` };
      }
      return { ok: true, reason: '' };
    }
    return { ok: true, reason: '' };
  };

  for (const s of remainingSteps) {
    const prereq = checkStepPrereq(s);
    if (!prereq.ok) {
      nextWaitingStep = s;
      waitingPrereqText = prereq.reason;
      break;
    }

    const costObj =
      s.cost && typeof s.cost === 'object'
        ? { w: Number(s.cost.w || 0), c: Number(s.cost.c || 0), i: Number(s.cost.i || 0) }
        : { w: 0, c: 0, i: 0 };

    if (simW >= costObj.w && simC >= costObj.c && simI >= costObj.i) {
      readyStepsNow.push(s);
      simW -= costObj.w;
      simC -= costObj.c;
      simI -= costObj.i;
      // Advance simulated state only for instant/chained tracking when checking subsequent steps
      if (s.atype === 'bldg') {
        const base = s.baseName || s.bName.replace(/\s*[\(（]?م\d+[\)）]?/g, '').trim();
        simBldgs[base] = Math.max(Number(simBldgs[base] || 0), Number(s.targetLvl || 1));
      } else if (s.atype === 'scav_unlock') {
        simScavTiers = Math.max(simScavTiers, Number(s.targetLvl || 1));
      } else if (s.atype === 'research_sword') {
        simSwordResearched = true;
      }
      if (readyStepsNow.length >= 3) break;
    } else {
      nextWaitingStep = s;
      break;
    }
  }

  let nextStepReadyInHours = 0;
  let nextStepReadyText = 'جاهزة الآن';
  if (nextWaitingStep) {
    if (waitingPrereqText) {
      nextStepReadyInHours = 0;
      nextStepReadyText = waitingPrereqText;
    } else {
      const costObj =
        nextWaitingStep.cost && typeof nextWaitingStep.cost === 'object'
          ? {
              w: Number(nextWaitingStep.cost.w || 0),
              c: Number(nextWaitingStep.cost.c || 0),
              i: Number(nextWaitingStep.cost.i || 0)
            }
          : { w: 0, c: 0, i: 0 };
      const missW = Math.max(0, costObj.w - simW);
      const missC = Math.max(0, costObj.c - simC);
      const missI = Math.max(0, costObj.i - simI);
      const hW = v.wProd > 0 ? missW / v.wProd : 0;
      const hC = v.cProd > 0 ? missC / v.cProd : 0;
      const hI = v.iProd > 0 ? missI / v.iProd : 0;
      let bestH = Math.max(hW, hC, hI);

      if (v.scavState === 'running' && v.scavRemHours > 0 && v.scavRemHours < bestH && v.scavLoot) {
        const tRaid = v.scavRemHours;
        const remW = Math.max(0, missW - (v.wProd * tRaid + Number(v.scavLoot.wood || 0)));
        const remC = Math.max(0, missC - (v.cProd * tRaid + Number(v.scavLoot.clay || 0)));
        const remI = Math.max(0, missI - (v.iProd * tRaid + Number(v.scavLoot.iron || 0)));
        const extraH = Math.max(
          v.wProd > 0 ? remW / v.wProd : 0,
          v.cProd > 0 ? remC / v.cProd : 0,
          v.iProd > 0 ? remI / v.iProd : 0
        );
        if (tRaid + extraH < bestH) {
          bestH = tRaid + extraH;
        }
      }
      nextStepReadyInHours = bestH;
      nextStepReadyText = formatHoursArabic(bestH);
    }
  }

  // Multi-unit scavenging readiness check across all haul-capable units
  const uHome = v.unitsHome || {};
  const homeByUnit: Record<string, number> = {
    spear: Math.max(0, Number(uHome.spear ?? v.spearsHome ?? 0)),
    sword: Math.max(0, Number(uHome.sword ?? v.swordsHome ?? 0)),
    axe: Math.max(0, Number(uHome.axe ?? v.axesHome ?? 0)),
    archer: Math.max(0, Number(uHome.archer ?? 0)),
    light: Math.max(0, Number(uHome.light ?? v.lightsHome ?? 0)),
    marcher: Math.max(0, Number(uHome.marcher ?? 0)),
    heavy: Math.max(0, Number(uHome.heavy ?? v.heaviesHome ?? 0)),
    knight: Math.max(0, Number(uHome.knight ?? 0))
  };

  let homeTroops = 0;
  let homeHaulCapacity = 0;
  const homeUnitLabels: string[] = [];

  for (const def of SCAV_UNIT_DEFS) {
    const cnt = homeByUnit[def.key] || 0;
    const carry = UNIT_CARRY_CAP[def.key as UnitKey] || 0;
    if (carry > 0 && cnt > 0) {
      homeTroops += cnt;
      homeHaulCapacity += cnt * carry;
      homeUnitLabels.push(`${cnt} ${def.ar}`);
    }
  }

  const shouldSendScavenge =
    (homeTroops >= 10 || homeHaulCapacity >= 150) &&
    (v.scavState === 'returned' || v.scavState === 'idle_troops');
  const scavNextOpenHours = v.scavState === 'running' && v.scavRemHours > 0 ? v.scavRemHours : 0;
  const scavNextOpenText = scavNextOpenHours > 0 ? formatHoursArabic(scavNextOpenHours) : '';
  const scavengeSummary = shouldSendScavenge
    ? `الجيش في القرية (${homeUnitLabels.join(' + ')}) — أرسل إغارات الآن!`
    : scavNextOpenHours > 0
      ? `الإغارة جارية وتعود بعد ${scavNextOpenText}`
      : 'لا يوجد جيش متاح للإغارة حالياً';

  const totalTraders =
    MARKET_MERCHANTS[Math.min(25, Math.max(0, Number(v.marketLevel || 0)))] || 0;
  const freeMerchants = Math.max(0, totalTraders - Number(v.tradersAway || 0));
  const whCap = Math.max(1000, Number(v.warehouseCap || 1000));

  const hWood =
    v.capWood !== undefined && v.capWood > 0
      ? Math.max(0, v.capWood - Math.max(0, v.stockWood || 0))
      : Infinity;
  const hClay =
    v.capClay !== undefined && v.capClay > 0
      ? Math.max(0, v.capClay - Math.max(0, v.stockClay || 0))
      : Infinity;
  const hIron =
    v.capIron !== undefined && v.capIron > 0
      ? Math.max(0, v.capIron - Math.max(0, v.stockIron || 0))
      : Infinity;

  const isMarketCompletelyFull =
    v.capWood !== undefined &&
    v.capWood > 0 &&
    hWood <= 0 &&
    v.capClay !== undefined &&
    v.capClay > 0 &&
    hClay <= 0 &&
    v.capIron !== undefined &&
    v.capIron > 0 &&
    hIron <= 0;

  const rateOptions = [
    {
      name: 'خشب',
      rate: Number(v.sellWood || 64),
      stock: Number(v.woodStock || 0),
      fillPct: (Number(v.woodStock || 0) / whCap) * 100,
      headroom: hWood
    },
    {
      name: 'طمي',
      rate: Number(v.sellClay || 64),
      stock: Number(v.clayStock || 0),
      fillPct: (Number(v.clayStock || 0) / whCap) * 100,
      headroom: hClay
    },
    {
      name: 'حديد',
      rate: Number(v.sellIron || 64),
      stock: Number(v.ironStock || 0),
      fillPct: (Number(v.ironStock || 0) / whCap) * 100,
      headroom: hIron
    }
  ].filter((r) => r.rate > 0 && r.stock >= Math.max(500, r.rate) && r.headroom > 0);

  // Prioritize surplus near-full stocks when warehouse >= 80%, otherwise pick lowest rate (most PP per resource)
  rateOptions.sort((a, b) => {
    const aFull = a.fillPct >= 80 ? 1 : 0;
    const bFull = b.fillPct >= 80 ? 1 : 0;
    if (aFull !== bFull) return bFull - aFull;
    return a.rate - b.rate;
  });

  const bestOpt = rateOptions[0] || {
    name: 'موارد',
    rate: Number(v.sellWood || 64),
    stock: 0,
    fillPct: 0,
    headroom: 0
  };
  const rateBenchmark = Math.max(
    250,
    Number(v.buyRate || 64) * 1.25,
    Number(v.sellRate || 0) * 1.1
  );
  const isRateGood = bestOpt.rate <= rateBenchmark;
  const isWarehouseOverflowRisk = bestOpt.fillPct >= 80;
  const isRateFavorable = isRateGood || isWarehouseOverflowRisk;
  const maxSellByTraders = freeMerchants > 0 ? Math.min(freeMerchants * 1000, Math.max(0, bestOpt.stock - 200)) : 0;
  const sellableAmount = Math.min(maxSellByTraders, bestOpt.headroom > 0 ? bestOpt.headroom : maxSellByTraders);
  const shouldSellMarket =
    !isMarketCompletelyFull && freeMerchants > 0 && sellableAmount >= bestOpt.rate && isRateFavorable && bestOpt.headroom > 0;
  const marketSummary = isMarketCompletelyFull
    ? '⚠️ بورصة التميز ممتلئة بالكامل في هذه القارة - حركة البيع متوقفة حالياً لحين شراء لاعبين آخرين'
    : shouldSellMarket
      ? isRateGood
        ? `بيع ${bestOpt.name} في البورصة الآن (السعر ممتاز: ${bestOpt.rate} · سعة السوق المتاحة: ${bestOpt.headroom.toLocaleString('en-US')} · متاح ${freeMerchants} تاجر لبيع ~${sellableAmount} مورد)`
        : `بيع فائض ${bestOpt.name} لتفريغ المخزن (${Math.round(bestOpt.fillPct)}% ممتلئ · ${bestOpt.rate}/PP · سعة السوق المتاحة: ${bestOpt.headroom.toLocaleString('en-US')} · متاح ${freeMerchants} تاجر)`
      : '';

  const hasAnyImmediateAction =
    readyStepsNow.length > 0 || shouldSendScavenge || shouldSellMarket;

  let closeAndReopenMessage = '';
  if (!hasAnyImmediateAction) {
    const parts: string[] = [];
    if (scavNextOpenHours > 0) {
      parts.push(`افتح كمان ${scavNextOpenText} لإرسال الإغارة`);
    }
    if (nextWaitingStep && nextStepReadyInHours > 0) {
      parts.push(`وافتح كمان ${nextStepReadyText} لاستكمال الخطة (${nextWaitingStep.bName})`);
    }
    closeAndReopenMessage =
      parts.length > 0
        ? `مفيش حاجة تتعمل في القرية دلوقتي — اقفل الحساب، ${parts.join('، ')}.`
        : 'مفيش حاجة تتعمل في القرية دلوقتي — اقفل الحساب بأمان!';
  }

  return {
    hasPlan,
    planName: v.assignedPlan?.name || '',
    totalSteps: steps.length,
    completedStepsCount,
    remainingSteps,
    readyStepsNow,
    nextWaitingStep,
    nextStepReadyInHours,
    nextStepReadyText,
    shouldSendScavenge,
    scavengeSummary,
    scavNextOpenHours,
    scavNextOpenText,
    shouldSellMarket,
    freeMerchants,
    sellableAmount,
    bestSellResName: bestOpt.name,
    bestSellRate: bestOpt.rate,
    marketSummary,
    hasAnyImmediateAction,
    closeAndReopenMessage
  };
}

export function computeMissionBriefingForVillage(
  vil: ErpVillage,
  state: ErpAppState,
  live?: VillageLiveStatus
): MissionBriefingResult {
  const st = live || computeVillageLiveStatus(vil, state);
  const acc = state.userAccounts.find((a) => a.id === vil.accountId);

  const liveHomeMap: Record<string, number> = {
    ...(vil.scavData?.unitsHome || {}),
    ...(vil.unitsHome || {})
  };
  const liveTotalMap: Record<string, number> = {
    ...(vil.scavData?.unitsTotal || {}),
    ...(vil.unitsTotal || {})
  };
  for (const item of st.armyMatrix) {
    liveHomeMap[item.key] = item.home;
    liveTotalMap[item.key] = item.total;
  }

  const snap: VillageSyncSnapshot = {
    id: vil.id,
    name: vil.name,
    accountName: acc?.name || vil.name,
    device: acc?.device || vil.device || '',
    browser: acc?.browser || vil.browser || '',
    buildings: normalizeBuildingsMap(vil.buildings, vil),
    woodStock: st.currentWood,
    clayStock: st.currentClay,
    ironStock: st.currentIron,
    warehouseCap: st.cap,
    wProd: st.wProd,
    cProd: st.cProd,
    iProd: st.iProd,
    spearsHome: Number(liveHomeMap.spear ?? vil.spearsHome ?? 0),
    swordsHome: Number(liveHomeMap.sword ?? vil.swordsHome ?? 0),
    axesHome: Number(liveHomeMap.axe ?? vil.axesHome ?? 0),
    lightsHome: Number(liveHomeMap.light ?? vil.lightsHome ?? 0),
    heaviesHome: Number(liveHomeMap.heavy ?? vil.heaviesHome ?? 0),
    unitsHome: liveHomeMap,
    unitsTotal: liveTotalMap,
    spearsAway: Number(vil.unitsAway?.spear ?? vil.spearsAway ?? 0),
    swordsAway: Number(vil.unitsAway?.sword ?? vil.swordsAway ?? 0),
    spearsTotal: Number(liveTotalMap.spear ?? vil.spearsTotal ?? 0),
    swordsTotal: Number(liveTotalMap.sword ?? vil.swordsTotal ?? 0),
    unlockedScavTiers: Number(
      vil.unlockedScavTiers ||
        vil.scavData?.unlockedScavTiers ||
        vil.scavData?.unlockedTiers ||
        0
    ),
    scavState: st.scavState,
    scavRemHours: st.scavRemHours,
    scavLoot: vil.scavData?.loot,
    marketLevel: Number(vil.marketLevel || 0),
    boost30: Boolean(vil.boost30),
    sellWood: st.sellWood,
    sellClay: st.sellClay,
    sellIron: st.sellIron,
    buyRate: st.buyRate,
    sellRate: st.sellRate,
    assignedPlan: vil.assignedPlan
      ? {
          name: vil.assignedPlan.name,
          steps: vil.assignedPlan.steps as PlanStep[]
        }
      : null
  };
  return evaluateVillageMissionBriefing(snap);
}

export function computeSessionStats(
  logs: SessionLogEntry[],
  todayKey: string
): SessionStatsOverview {
  let todayTotalSec = 0;
  let todayTotalSessions = 0;
  const byAccount: SessionStatsOverview['byAccount'] = {};

  for (const raw of Array.isArray(logs) ? logs : []) {
    if (!raw || !raw.accountId) continue;
    const dur = Math.min(1800, Math.max(5, Math.round(Number(raw.durationSec || 0))));
    const accId = String(raw.accountId);
    if (!byAccount[accId]) {
      byAccount[accId] = {
        accountId: accId,
        accountName: raw.accountName || accId,
        totalSec: 0,
        todaySec: 0,
        sessionsCount: 0,
        todaySessionsCount: 0,
        avgSec: 0,
        lastSessionSec: dur
      };
    }
    const rec = byAccount[accId];
    rec.totalSec += dur;
    rec.sessionsCount += 1;
    rec.lastSessionSec = dur;
    rec.avgSec = Math.round(rec.totalSec / rec.sessionsCount);

    if (raw.dateKey === todayKey) {
      rec.todaySec += dur;
      rec.todaySessionsCount += 1;
      todayTotalSec += dur;
      todayTotalSessions += 1;
    }
  }

  return {
    todayTotalSec,
    todayTotalSessions,
    todayAvgSec: todayTotalSessions > 0 ? Math.round(todayTotalSec / todayTotalSessions) : 0,
    byAccount
  };
}
