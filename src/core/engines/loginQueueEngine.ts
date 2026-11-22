import type {
  ErpAppState,
  ErpUserAccount,
  ErpVillage,
  MissionBriefingResult,
  VillageLiveStatus
} from '../types';
import { computeMissionBriefingForVillage, formatHoursArabic } from './missionEngine';
import { computeVillageLiveStatus, getAccountCleanDevice } from './resourceEngine';
import { auditAccountsSecurity } from './securityEngine';

export type QueueTriggerKind =
  | 'warehouse_critical'
  | 'scav_returned'
  | 'plan_step_ready'
  | 'scav_idle'
  | 'market_sell'
  | 'warehouse_warning';

export interface AccountQueueTrigger {
  kind: QueueTriggerKind;
  severity: 'critical' | 'high' | 'medium';
  score: number;
  villageId: string;
  villageName: string;
  title: string;
  detail: string;
}

export interface AccountQueueVillageSummary {
  vil: ErpVillage;
  live: VillageLiveStatus;
  briefing: MissionBriefingResult;
}

export interface AccountLoginQueueItem {
  account: ErpUserAccount;
  accountId: string;
  accountName: string;
  device: string;
  browser: string;
  ip: string;
  hasIpCollision: boolean;
  collidingAccounts: string[];
  urgencyTier: 'now' | 'soon' | 'standby';
  priorityScore: number;
  triggers: AccountQueueTrigger[];
  primaryTrigger: AccountQueueTrigger | null;
  primaryVillageId: string | null;
  villages: AccountQueueVillageSummary[];
  villagesCount: number;
  readyTasksCount: number;
  idleScavCount: number;
  criticalWhCount: number;
  dailyPP: number;
  unsoldPP: number;
  sellableNowPP: number;
  totalPP: number;
  staleVillagesCount: number;
  maxWhPct: number;
  nextCheckHours: number | null;
  nextCheckReason: string;
  nextCheckText: string;
  lastSyncTime: number | null;
}

export interface BuildLoginQueueOptions {
  worldFilter?: string;
  deviceFilter?: string;
  searchQuery?: string;
}

export function buildAccountLoginQueue(
  state: ErpAppState,
  options: BuildLoginQueueOptions = {},
  nowMs: number = Date.now()
): AccountLoginQueueItem[] {
  const collisions = auditAccountsSecurity(state);
  const collisionsByAccount = new Map<string, Set<string>>();
  for (const col of collisions) {
    col.accountIds.forEach((aid) => {
      if (!collisionsByAccount.has(aid)) collisionsByAccount.set(aid, new Set());
      col.accountNames.forEach((name, idx) => {
        if (col.accountIds[idx] !== aid) {
          collisionsByAccount.get(aid)!.add(name);
        }
      });
    });
  }

  const worldFilter = options.worldFilter || 'all';
  const deviceFilter = options.deviceFilter || 'all';
  const q = (options.searchQuery || '').trim().toLowerCase();

  const items: AccountLoginQueueItem[] = [];

  for (const acc of state.userAccounts) {
    const dev = getAccountCleanDevice(acc);
    if (deviceFilter !== 'all' && dev !== deviceFilter) continue;

    const accVillages = state.villages.filter((v) => {
      if (v.accountId !== acc.id) return false;
      if (worldFilter !== 'all' && v.worldId !== worldFilter) return false;
      return true;
    });

    if (worldFilter !== 'all' && accVillages.length === 0) continue;

    if (q) {
      const hay = [
        acc.name,
        acc.ip || '',
        dev,
        ...accVillages.map((v) => `${v.name} ${v.coord || ''} k${v.continent}`)
      ]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) continue;
    }

    const triggers: AccountQueueTrigger[] = [];
    const villageSummaries: AccountQueueVillageSummary[] = [];

    let readyTasksCount = 0;
    let idleScavCount = 0;
    let criticalWhCount = 0;
    let dailyPP = 0;
    let unsoldPP = 0;
    let sellableNowPP = 0;
    let staleVillagesCount = 0;
    let maxWhPct = 0;

    let earliestSoonHours: number | null = null;
    let earliestSoonReason = '';

    const considerNextCheck = (hours: number, reason: string) => {
      if (!Number.isFinite(hours) || hours <= 0 || hours >= 900) return;
      if (earliestSoonHours === null || hours < earliestSoonHours) {
        earliestSoonHours = hours;
        earliestSoonReason = reason;
      }
    };

    for (const vil of accVillages) {
      const live = computeVillageLiveStatus(vil, state, nowMs);
      const briefing = computeMissionBriefingForVillage(vil, state, live);
      villageSummaries.push({ vil, live, briefing });

      // Skip all active alerts, expected PP, and check timers for worlds where trading has ended or pre-launch virtual villages
      if (live.tradeEnded || vil.isVirtual) {
        continue;
      }

      dailyPP += live.dailyPP;
      unsoldPP += live.unsoldPP;
      sellableNowPP += live.sellableNowPP;
      if (live.isStaleSync) staleVillagesCount += 1;
      if (live.maxWhPct > maxWhPct) maxWhPct = live.maxWhPct;

      if (live.status === 'critical' && live.maxWhPct >= 85) {
        criticalWhCount += 1;
        triggers.push({
          kind: 'warehouse_critical',
          severity: 'critical',
          score: 120 + Math.min(30, live.maxWhPct - 85),
          villageId: vil.id,
          villageName: vil.name,
          title: `مخزن ${live.firstFullRes} ${live.maxWhPct}% في ${vil.name}`,
          detail:
            live.minHoursLeft <= 0.05
              ? `المخزن ممتلئ الآن — فرّغ الموارد بالبيع أو البناء فوراً`
              : `يمتلئ خلال ${formatHoursArabic(live.minHoursLeft)}`
        });
      } else if (live.status === 'warning') {
        triggers.push({
          kind: 'warehouse_warning',
          severity: 'medium',
          score: 42 + Math.round(live.maxWhPct * 0.2),
          villageId: vil.id,
          villageName: vil.name,
          title: `اقترب امتلاء ${live.firstFullRes} (${live.maxWhPct}%) في ${vil.name}`,
          detail: `يمتلئ خلال ${formatHoursArabic(live.minHoursLeft)}`
        });
      }

      if (live.scavState === 'returned') {
        idleScavCount += 1;
        triggers.push({
          kind: 'scav_returned',
          severity: 'critical',
          score: 105,
          villageId: vil.id,
          villageName: vil.name,
          title: `الجيش عاد من الإغارة في ${vil.name}`,
          detail: `أرسل جولة جديدة الآن (${live.haulHome.toLocaleString('en-US')} حمولة متاحة)`
        });
      } else if (live.scavState === 'idle_troops') {
        idleScavCount += 1;
        triggers.push({
          kind: 'scav_idle',
          severity: 'high',
          score: 90,
          villageId: vil.id,
          villageName: vil.name,
          title: `جيش متوقف بالقرية في ${vil.name}`,
          detail: `${live.haulHome.toLocaleString('en-US')} حمولة جاهزة للإرسال للإغارة`
        });
      } else if (live.scavState === 'running' && live.scavRemHours > 0 && live.scavRemHours < 900) {
        considerNextCheck(live.scavRemHours, `عودة الإغارة في ${vil.name}`);
      }

      if (briefing.readyStepsNow.length > 0) {
        readyTasksCount += briefing.readyStepsNow.length;
        const firstStep = briefing.readyStepsNow[0];
        const extra =
          briefing.readyStepsNow.length > 1 ? ` (+${briefing.readyStepsNow.length - 1})` : '';
        triggers.push({
          kind: 'plan_step_ready',
          severity: 'high',
          score: 95 + Math.min(25, briefing.readyStepsNow.length * 8),
          villageId: vil.id,
          villageName: vil.name,
          title: `مهمة خطة جاهزة في ${vil.name}: ${firstStep.bName} م${firstStep.targetLvl}${extra}`,
          detail: 'الموارد المطلوبة أصبحت متوفرة بالمخزن الآن — نفّذ التطوير لتفادي التأخير'
        });
      } else if (briefing.nextWaitingStep && briefing.nextStepReadyInHours > 0) {
        considerNextCheck(
          briefing.nextStepReadyInHours,
          `جاهزية ${briefing.nextWaitingStep.bName} م${briefing.nextWaitingStep.targetLvl} (${vil.name})`
        );
      }

      if (briefing.shouldSellMarket) {
        triggers.push({
          kind: 'market_sell',
          severity: live.maxWhPct >= 80 ? 'high' : 'medium',
          score: live.maxWhPct >= 80 ? 75 : 48,
          villageId: vil.id,
          villageName: vil.name,
          title: `فرصة بيع ${briefing.bestSellResName} في ${vil.name}`,
          detail: `${briefing.freeMerchants} تاجر متاح لبيع ~${briefing.sellableAmount.toLocaleString('en-US')} بسعر ${briefing.bestSellRate}/PP`
        });
      }

      considerNextCheck(live.minHoursLeft, `امتلاء ${live.firstFullRes} (${vil.name})`);
    }

    triggers.sort((a, b) => b.score - a.score);

    const hasCriticalOrHigh = triggers.some((t) => t.severity === 'critical' || t.severity === 'high');
    const hasSoonTrigger = triggers.length > 0 || (earliestSoonHours !== null && earliestSoonHours <= 2.5);

    const urgencyTier: 'now' | 'soon' | 'standby' = hasCriticalOrHigh
      ? 'now'
      : hasSoonTrigger
        ? 'soon'
        : 'standby';

    const priorityScore = triggers.reduce((max, t) => Math.max(max, t.score), 0) + triggers.length * 4;
    const collidingAccounts = Array.from(collisionsByAccount.get(acc.id) || []);

    const nextCheckText =
      urgencyTier === 'now'
        ? 'مطلوب الدخول الآن'
        : earliestSoonHours !== null
          ? `افتح بعد ${formatHoursArabic(earliestSoonHours)}`
          : 'مستقر حالياً';

    items.push({
      account: acc,
      accountId: acc.id,
      accountName: acc.name,
      device: dev,
      browser: acc.browser || 'Chrome',
      ip: String(acc.ip || ''),
      hasIpCollision: collidingAccounts.length > 0,
      collidingAccounts,
      urgencyTier,
      priorityScore,
      triggers,
      primaryTrigger: triggers[0] || null,
      primaryVillageId: triggers[0]?.villageId || accVillages[0]?.id || null,
      villages: villageSummaries,
      villagesCount: accVillages.length,
      readyTasksCount,
      idleScavCount,
      criticalWhCount,
      dailyPP,
      unsoldPP,
      sellableNowPP,
      totalPP: Number(acc.pp || 0),
      staleVillagesCount,
      maxWhPct,
      nextCheckHours: earliestSoonHours,
      nextCheckReason: earliestSoonReason || 'لا توجد أحداث وشيكة',
      nextCheckText,
      lastSyncTime: Number(acc.lastSyncTime || 0) || null
    });
  }

  const tierRank = { now: 0, soon: 1, standby: 2 } as const;
  items.sort((a, b) => {
    const tDiff = tierRank[a.urgencyTier] - tierRank[b.urgencyTier];
    if (tDiff !== 0) return tDiff;
    if (a.urgencyTier !== 'standby' && a.priorityScore !== b.priorityScore) {
      return b.priorityScore - a.priorityScore;
    }
    const ah = a.nextCheckHours ?? 9999;
    const bh = b.nextCheckHours ?? 9999;
    if (ah !== bh) return ah - bh;
    return b.dailyPP - a.dailyPP;
  });

  return items;
}
