import type {
  AccountFlowDayEntry,
  AccountPPFlowReport,
  CurrencyCode,
  DailySessionEntry,
  ErpAppState,
  ErpFinance,
  ErpUserAccount,
  PpLogEntry
} from '../types';

export function getCairoDateKey(ts: number = Date.now()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(
      new Date(Number(ts) || Date.now())
    );
  } catch {
    const d = new Date(Number(ts) || Date.now());
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }
}

export function shiftCairoDateKey(dateKey: string, deltaDays: number): string {
  const m = String(dateKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return getCairoDateKey();
  const baseMs = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  const shifted = new Date(baseMs + Number(deltaDays || 0) * 86400000);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
}

export function formatArabicDayLabel(dateKey: string, todayKey: string = getCairoDateKey()) {
  const m = String(dateKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    return {
      dateKey: String(dateKey || ''),
      diffDays: 0,
      relativeLabel: String(dateKey || ''),
      weekdayLabel: '',
      shortDateLabel: String(dateKey || ''),
      isToday: false,
      isYesterday: false,
      isDayBefore: false
    };
  }
  const todayM = String(todayKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const dayMs = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  const todayMs = todayM
    ? Date.UTC(Number(todayM[1]), Number(todayM[2]) - 1, Number(todayM[3]), 12, 0, 0)
    : dayMs;
  const diffDays = Math.round((todayMs - dayMs) / 86400000);

  let weekdayLabel = '';
  try {
    weekdayLabel = new Intl.DateTimeFormat('ar-EG', { weekday: 'long', timeZone: 'UTC' }).format(new Date(dayMs));
  } catch {
    weekdayLabel = '';
  }

  const shortDateLabel = `${Number(m[3])}/${Number(m[2])}`;

  let relativeLabel = `منذ ${diffDays} يوم`;
  if (diffDays === 0) relativeLabel = 'اليوم';
  else if (diffDays === 1) relativeLabel = 'أمس (امبارح)';
  else if (diffDays === 2) relativeLabel = 'أول أمس';
  else if (diffDays >= 3 && diffDays <= 10) relativeLabel = `منذ ${diffDays} أيام`;
  else if (diffDays < 0) relativeLabel = shortDateLabel;

  return {
    dateKey,
    diffDays,
    relativeLabel,
    weekdayLabel,
    shortDateLabel,
    isToday: diffDays === 0,
    isYesterday: diffDays === 1,
    isDayBefore: diffDays === 2
  };
}

export function computeMoneyFromPP(
  pp: number,
  finance: Partial<ErpFinance> = {}
): { amount: number; currency: CurrencyCode; formatted: string } {
  const pts = Number(pp) || 0;
  const bundlePts = Math.max(1, Number(finance.bundlePoints || 10000));
  const currency: CurrencyCode = finance.currency === 'USD' ? 'USD' : 'EGP';
  const bundlePrice =
    currency === 'USD'
      ? Math.max(0, Number(finance.bundleUSD ?? 50))
      : Math.max(0, Number(finance.bundleEGP ?? 2500));
  const amount = (pts / bundlePts) * bundlePrice;
  const formatted = currency === 'USD' ? `$${amount.toFixed(2)}` : `${amount.toFixed(1)} ج.م`;
  return { amount, currency, formatted };
}

export function formatCurrencyPP(pp: number, state: Pick<ErpAppState, 'finance'>): string {
  return computeMoneyFromPP(pp, state.finance).formatted;
}

export function formatSmartCurrencyAmount(amount: number, currency: CurrencyCode): string {
  const abs = Math.abs(amount);
  const rounded = Math.round(amount);
  const isNearInt = Math.abs(amount - rounded) < 0.05;
  if (currency === 'USD') {
    const numStr = isNearInt && abs >= 10
      ? rounded.toLocaleString('en-US')
      : amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `$${numStr}`;
  }
  const numStr = isNearInt
    ? rounded.toLocaleString('en-US')
    : amount.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${numStr} ج.م`;
}

export function formatPPAndCurrency(
  pp: number,
  financeOrState?: Partial<ErpFinance> | Pick<ErpAppState, 'finance'>,
  opts: {
    decimals?: number;
    showSign?: boolean;
    unit?: 'PP' | 'نقطة';
    perDay?: boolean;
  } = {}
): {
  ppValue: number;
  ppText: string;
  moneyAmount: number;
  moneyText: string;
  combinedText: string;
} {
  const finance: Partial<ErpFinance> =
    financeOrState && 'finance' in financeOrState
      ? financeOrState.finance || {}
      : (financeOrState as Partial<ErpFinance>) || {};
  const raw = Number(pp) || 0;
  const decimals = opts.decimals ?? (Math.abs(raw) >= 100 || Number.isInteger(raw) ? 0 : 1);
  const factor = Math.pow(10, decimals);
  const ppValue = Math.round(raw * factor) / factor;
  const sign = opts.showSign && ppValue > 0 ? '+' : '';
  const unit = opts.unit ?? 'نقطة';
  const suffix = opts.perDay ? `${unit}/يوم` : unit;
  const formattedPPNum = ppValue.toLocaleString('en-US', {
    minimumFractionDigits: decimals > 0 && !Number.isInteger(ppValue) ? decimals : 0,
    maximumFractionDigits: decimals
  });
  const ppText = `${sign}${formattedPPNum} ${suffix}`;
  const { amount, currency } = computeMoneyFromPP(raw, finance);
  const moneySign = opts.showSign && amount > 0 ? '+' : '';
  const moneyText = `${moneySign}${formatSmartCurrencyAmount(amount, currency)}`;
  const combinedText = `${ppText} / ${moneyText}`;
  return { ppValue, ppText, moneyAmount: amount, moneyText, combinedText };
}

export function resolveBaselineBeforeDate(
  accId: string,
  dateKey: string,
  dailySessions: Record<string, Record<string, Partial<DailySessionEntry>>> = {},
  ppLog: Record<string, PpLogEntry[]> = {},
  fallbackPP: number | null = null
): number | null {
  if (!accId || !dateKey) return fallbackPP;

  const sessionDates = Object.keys(dailySessions || {})
    .filter((d) => d < dateKey && dailySessions[d] && dailySessions[d][accId])
    .sort((a, b) => b.localeCompare(a));

  if (sessionDates.length > 0) {
    const prevSess = dailySessions[sessionDates[0]][accId];
    const endVal = Number(prevSess.lastSyncedPP ?? prevSess.startPP);
    if (Number.isFinite(endVal)) return Math.max(0, endVal);
  }

  const logs = Array.isArray(ppLog?.[accId]) ? ppLog[accId] : [];
  let latestPriorLog: PpLogEntry | null = null;
  for (const entry of logs) {
    if (!entry || entry.pp === undefined || !entry.t) continue;
    const eDate = getCairoDateKey(entry.t);
    if (eDate < dateKey) {
      if (!latestPriorLog || Number(entry.t) > Number(latestPriorLog.t)) {
        latestPriorLog = entry;
      }
    }
  }
  if (latestPriorLog && Number.isFinite(Number(latestPriorLog.pp))) {
    return Math.max(0, Number(latestPriorLog.pp));
  }

  return fallbackPP;
}

export function pruneOldDailySessions(
  dailySessions: Record<string, Record<string, DailySessionEntry>> = {},
  keepDays: number = 60,
  todayKey: string = getCairoDateKey()
): Record<string, Record<string, DailySessionEntry>> {
  if (!dailySessions || typeof dailySessions !== 'object') return {};
  const cutoffKey = shiftCairoDateKey(todayKey, -Math.max(7, Number(keepDays) || 60));
  Object.keys(dailySessions).forEach((dk) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dk) && dk < cutoffKey) {
      delete dailySessions[dk];
    }
  });
  return dailySessions;
}

export function upsertAccountDaySnapshot(
  dailySessions: Record<string, Record<string, DailySessionEntry>> = {},
  opts: {
    accId?: string;
    dateKey?: string;
    startPP?: number;
    endPP?: number;
    targetPP?: number;
    manualAdjusted?: boolean;
    nowMs?: number;
  } = {}
): Record<string, Record<string, DailySessionEntry>> {
  const {
    accId,
    dateKey,
    startPP,
    endPP,
    targetPP = 0,
    manualAdjusted = false,
    nowMs = Date.now()
  } = opts;
  if (!accId || !dateKey) return dailySessions;
  if (!dailySessions[dateKey] || typeof dailySessions[dateKey] !== 'object') {
    dailySessions[dateKey] = {};
  }
  const cleanStart = Math.max(0, Math.round(Number(startPP || 0)));
  const cleanEnd = Math.max(0, Math.round(Number(endPP ?? cleanStart)));
  const prev: Partial<DailySessionEntry> = dailySessions[dateKey][accId] || {};

  dailySessions[dateKey][accId] = {
    startPP: cleanStart,
    targetPP: Math.max(Number(targetPP || prev.targetPP || 0), 1),
    lastSyncedPP: cleanEnd,
    firstSyncTime: Number(prev.firstSyncTime || nowMs),
    lastSyncTime: Number(nowMs),
    ...(manualAdjusted ? { manualAdjusted: true } : {})
  };
  return dailySessions;
}

export function buildAccountPPFlow(params: {
  account?: Partial<ErpUserAccount>;
  villagesCount?: number;
  dailySessions?: Record<string, Record<string, DailySessionEntry>>;
  ppLog?: Record<string, PpLogEntry[]>;
  targetDailyPP?: number;
  unsoldPP?: number;
  scavLootPP?: number;
  finance?: Partial<ErpFinance>;
  daysCount?: number;
  nowMs?: number;
} = {}): AccountPPFlowReport {
  const {
    account = {},
    villagesCount = 0,
    dailySessions = {},
    ppLog = {},
    targetDailyPP = 0,
    unsoldPP = 0,
    scavLootPP = 0,
    finance = {},
    daysCount = 14,
    nowMs = Date.now()
  } = params;

  const accId = String(account?.id || '');
  const curPP = Math.max(0, Number(account?.pp || 0));
  const todayKey = getCairoDateKey(nowMs);
  const windowDays = Math.max(3, Math.min(60, parseInt(String(daysCount), 10) || 14));
  const safeTarget = Math.max(0, Math.round(Number(targetDailyPP || 0) * 10) / 10);

  const logsByDate = new Map<string, Array<{ t: number; pp: number }>>();
  const rawLogs = Array.isArray(ppLog?.[accId]) ? ppLog[accId] : [];
  for (const entry of rawLogs) {
    if (!entry || !entry.t || entry.pp === undefined) continue;
    const dk = getCairoDateKey(entry.t);
    if (!logsByDate.has(dk)) logsByDate.set(dk, []);
    logsByDate.get(dk)!.push({ t: Number(entry.t), pp: Math.max(0, Number(entry.pp) || 0) });
  }
  logsByDate.forEach((arr) => arr.sort((a, b) => a.t - b.t));

  const dateKeysAsc: string[] = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    dateKeysAsc.push(shiftCairoDateKey(todayKey, -i));
  }

  let runningLastKnownPP = resolveBaselineBeforeDate(accId, dateKeysAsc[0], dailySessions, ppLog, null);
  let prevRecordedNetPP: number | null = null;
  const daysAsc: AccountFlowDayEntry[] = [];

  for (const dk of dateKeysAsc) {
    const labelMeta = formatArabicDayLabel(dk, todayKey);
    const sess = dailySessions?.[dk]?.[accId] || null;
    const dayLogs = logsByDate.get(dk) || [];

    let hasData = false;
    let source = 'none';
    let startPP: number | null = null;
    let endPP: number | null = null;
    let dayTargetPP = safeTarget;
    let lastSyncTs: number | null = null;
    let manualAdjusted = false;

    if (sess && typeof sess === 'object') {
      hasData = true;
      manualAdjusted = Boolean(sess.manualAdjusted);
      source = manualAdjusted ? 'manual' : 'session';
      startPP = Math.max(0, Number(sess.startPP ?? runningLastKnownPP ?? curPP));
      if (labelMeta.isToday) {
        endPP =
          manualAdjusted && sess.lastSyncedPP !== undefined
            ? Math.max(0, Number(sess.lastSyncedPP))
            : curPP;
      } else {
        endPP = Math.max(0, Number(sess.lastSyncedPP ?? sess.startPP ?? 0));
      }
      dayTargetPP = Math.max(0, Number(sess.targetPP || safeTarget || 0));
      lastSyncTs = Number(sess.lastSyncTime || 0) || null;
    } else if (dayLogs.length > 0) {
      hasData = true;
      source = 'ppLog';
      startPP = runningLastKnownPP !== null ? runningLastKnownPP : dayLogs[0].pp;
      endPP = labelMeta.isToday ? curPP : dayLogs[dayLogs.length - 1].pp;
      lastSyncTs = dayLogs[dayLogs.length - 1].t || null;
    } else if (labelMeta.isToday) {
      hasData = true;
      source = 'live';
      startPP = runningLastKnownPP !== null ? runningLastKnownPP : curPP;
      endPP = curPP;
      lastSyncTs = Number(account?.lastSyncTime || 0) || null;
    }

    const prevBaselineBeforeThisDay = runningLastKnownPP;
    if (hasData && endPP !== null) {
      runningLastKnownPP = endPP;
    }

    const netPP = hasData && endPP !== null && startPP !== null ? Math.round((endPP - startPP) * 10) / 10 : null;
    const isOnboardingJump = Boolean(
      hasData &&
        !manualAdjusted &&
        startPP === 0 &&
        endPP !== null &&
        endPP >= 100 &&
        Number(sess?.targetPP ?? 0) <= 1 &&
        (prevBaselineBeforeThisDay === null || prevBaselineBeforeThisDay === 0)
    );
    const dayUnsoldPP = labelMeta.isToday ? Math.round((Number(unsoldPP) || 0) * 10) / 10 : 0;
    const dayScavPP = labelMeta.isToday ? Math.round((Number(scavLootPP) || 0) * 10) / 10 : 0;
    const effectivePP = hasData
      ? Math.round(((netPP || 0) + dayUnsoldPP + dayScavPP) * 10) / 10
      : null;

    const achievementPct =
      hasData && dayTargetPP > 0 && effectivePP !== null
        ? Math.min(999, Math.round((Math.max(0, effectivePP) / dayTargetPP) * 100))
        : 0;

    let deltaVsPrevDay: number | null = null;
    if (hasData && netPP !== null && prevRecordedNetPP !== null) {
      deltaVsPrevDay = Math.round((netPP - prevRecordedNetPP) * 10) / 10;
    }
    if (hasData && netPP !== null) {
      prevRecordedNetPP = netPP;
    }

    const money = hasData && netPP !== null ? computeMoneyFromPP(netPP, finance) : null;
    const effectiveMoney =
      hasData && effectivePP !== null ? computeMoneyFromPP(effectivePP, finance) : null;

    daysAsc.push({
      ...labelMeta,
      hasData,
      source,
      manualAdjusted,
      startPP,
      endPP,
      netPP,
      unsoldPP: dayUnsoldPP,
      scavLootPP: dayScavPP,
      effectivePP,
      targetPP: Math.round(dayTargetPP * 10) / 10,
      achievementPct,
      deltaVsPrevDay,
      moneyFormatted: money ? money.formatted : '—',
      effectiveMoneyFormatted: effectiveMoney ? effectiveMoney.formatted : '—',
      lastSyncTime: lastSyncTs,
      isOnboardingJump
    });
  }

  const recordedDays = daysAsc.filter((d) => d.hasData);
  const pastRecordedDays = recordedDays.filter((d) => !d.isToday);

  const todayEntry = daysAsc[daysAsc.length - 1] || null;
  const yesterdayEntry = daysAsc.find((d) => d.isYesterday) || null;
  const dayBeforeEntry = daysAsc.find((d) => d.isDayBefore) || null;

  const periodNetPP =
    Math.round(recordedDays.reduce((sum, d) => sum + (Number(d.netPP) || 0), 0) * 10) / 10;

  const positiveDays = recordedDays.filter((d) => Number(d.netPP) > 0);
  const avgDivisor = positiveDays.length > 0 ? positiveDays.length : Math.max(1, recordedDays.length);
  const avgDailyPP =
    recordedDays.length > 0 ? Math.round((periodNetPP / avgDivisor) * 10) / 10 : 0;

  let bestDay: AccountFlowDayEntry | null = null;
  for (const d of recordedDays) {
    if (!bestDay || Number(d.netPP) > Number(bestDay.netPP)) {
      bestDay = d;
    }
  }

  const maxChartVal = Math.max(
    safeTarget,
    10,
    ...daysAsc.map((d) => (d.hasData ? Math.max(0, Number(d.effectivePP || d.netPP || 0)) : 0))
  );

  const curMoney = computeMoneyFromPP(curPP, finance);
  const periodMoney = computeMoneyFromPP(periodNetPP, finance);

  return {
    accountId: accId,
    accountName: String(account?.name || 'حساب'),
    currentPP: curPP,
    currentMoneyFormatted: curMoney.formatted,
    villagesCount: Number(villagesCount) || 0,
    ip: String(account?.ip || ''),
    device: String(account?.device || ''),
    browser: String(account?.browser || ''),
    lastSyncTime: Number(account?.lastSyncTime || 0) || null,
    todayKey,
    windowDays,
    targetDailyPP: safeTarget,
    today: todayEntry,
    yesterday: yesterdayEntry,
    dayBefore: dayBeforeEntry,
    periodNetPP,
    periodMoneyFormatted: periodMoney.formatted,
    avgDailyPP,
    avgMoneyFormatted: computeMoneyFromPP(avgDailyPP, finance).formatted,
    recordedDaysCount: recordedDays.length,
    pastRecordedDaysCount: pastRecordedDays.length,
    bestDay:
      bestDay && bestDay.netPP !== null
        ? {
            dateKey: bestDay.dateKey,
            relativeLabel: bestDay.relativeLabel,
            netPP: bestDay.netPP
          }
        : null,
    maxChartVal: Math.round(maxChartVal * 10) / 10,
    daysAsc,
    daysDesc: daysAsc.slice().reverse()
  };
}
