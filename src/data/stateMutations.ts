import {
  createDefaultAppState,
  ensureAccountDailySessionInState,
  estimateWorldTotalPP,
  FIXED_CONTINENTS,
  getCairoDateKey,
  makeDefaultContinents,
  normalizeBuildingsMap,
  normalizeVillageTroops,
  processIncomingVillageSync,
  repairStateIntegrity,
  type AssignedPlan,
  type ErpAppState,
  type ErpFinance,
  type ErpGameRules,
  type ErpUserAccount,
  type ErpVillage,
  type ErpWorld,
  type SyncProcessResult,
  type VillageRole
} from '../core';
import {
  validateAccountInput,
  validateAppStateBackupJson,
  validateContinentRatesInput,
  validateIncomingSyncPayload,
  validateVillageInput,
  validateWorldInput,
  type AccountInput,
  type ContinentRatesInput,
  type VillageInput,
  type WorldInput
} from '../validation';

export interface MutationResult<T = ErpAppState> {
  ok: boolean;
  state: T;
  errors?: Record<string, string>;
  deletedVillages?: ErpVillage[];
  deletedWorldId?: string;
  updatedVillage?: ErpVillage;
  updatedVillages?: ErpVillage[];
  updatedAccount?: ErpUserAccount;
  createdAccounts?: ErpUserAccount[];
  updatedWorld?: ErpWorld;
}

export interface VirtualVillageBatchParams {
  worldId: string;
  countsByContinent: Record<'44' | '45' | '54' | '55', number>;
  accountIds?: string[];
  autoCreateMissingAccounts?: boolean;
  accountNamePrefix?: string;
  villageNamePrefix?: string;
  assignedPlan?: AssignedPlan | null;
}

export function mutateSaveAccount(
  prevState: ErpAppState,
  input: Partial<AccountInput>,
  nowMs: number = Date.now()
): MutationResult {
  const validation = validateAccountInput(input);
  if (!validation.valid) {
    return { ok: false, state: prevState, errors: validation.errors };
  }

  const data = validation.data;
  const nextState: ErpAppState = JSON.parse(JSON.stringify(prevState));
  const idx = data.id ? nextState.userAccounts.findIndex((a) => a.id === data.id) : -1;

  let savedAcc: ErpUserAccount;
  if (idx >= 0) {
    const existing = nextState.userAccounts[idx];
    savedAcc = {
      ...existing,
      name: data.name,
      pp: data.pp,
      ip: data.ip,
      device: data.device,
      browser: data.browser,
      email: data.email,
      password: data.password !== '' ? data.password : existing.password || '',
      lastSyncTime: existing.lastSyncTime || nowMs
    };
    nextState.userAccounts[idx] = savedAcc;
  } else {
    savedAcc = {
      id: data.id || `acc_${nowMs}_${Math.floor(Math.random() * 1000)}`,
      name: data.name,
      pp: data.pp,
      ip: data.ip,
      device: data.device,
      browser: data.browser,
      email: data.email,
      password: data.password,
      lastSyncTime: nowMs,
      loginHistory: [],
      deviceLog: []
    };
    nextState.userAccounts.push(savedAcc);
  }

  ensureAccountDailySessionInState(nextState, savedAcc, savedAcc.pp, nowMs);
  return { ok: true, state: nextState, updatedAccount: savedAcc };
}

export function mutateDeleteAccount(
  prevState: ErpAppState,
  accountId: string
): MutationResult {
  const exists = prevState.userAccounts.some((a) => a.id === accountId);
  if (!exists) {
    return { ok: false, state: prevState, errors: { accountId: 'الحساب غير موجود.' } };
  }

  const nextState: ErpAppState = JSON.parse(JSON.stringify(prevState));
  nextState.userAccounts = nextState.userAccounts.filter((a) => a.id !== accountId);

  const removedVillages: ErpVillage[] = [];
  nextState.villages = nextState.villages.filter((v) => {
    if (v.accountId === accountId) {
      removedVillages.push(v);
      if (v.id && !nextState.deletedVillageIds.includes(v.id)) nextState.deletedVillageIds.push(v.id);
      if (v.villageId && !nextState.deletedVillageIds.includes(v.villageId)) nextState.deletedVillageIds.push(v.villageId);
      return false;
    }
    return true;
  });

  if (nextState.ppLog && nextState.ppLog[accountId]) {
    delete nextState.ppLog[accountId];
  }
  if (!nextState.villages.some((v) => v.id === nextState.activeVillageId)) {
    nextState.activeVillageId = nextState.villages[0]?.id || '';
  }

  return { ok: true, state: nextState, deletedVillages: removedVillages };
}

export function mutateSaveVillage(
  prevState: ErpAppState,
  input: Partial<VillageInput>,
  nowMs: number = Date.now()
): MutationResult {
  const validation = validateVillageInput(input);
  if (!validation.valid) {
    return { ok: false, state: prevState, errors: validation.errors };
  }

  const data = validation.data;
  const relErrors: Record<string, string> = {};
  if (!prevState.userAccounts.some((a) => a.id === data.accountId)) {
    relErrors.accountId = 'الحساب المحدد غير موجود في النظام.';
  }
  if (!prevState.worlds.some((w) => w.id === data.worldId)) {
    relErrors.worldId = 'العالم المحدد غير موجود في النظام.';
  }
  if (Object.keys(relErrors).length > 0) {
    return { ok: false, state: prevState, errors: relErrors };
  }

  const nextState: ErpAppState = JSON.parse(JSON.stringify(prevState));
  const idx = data.id ? nextState.villages.findIndex((v) => v.id === data.id) : -1;
  const existing = idx >= 0 ? nextState.villages[idx] : undefined;

  const baseBuildings = { ...(existing?.buildings || {}) };
  baseBuildings['الخشاب'] = data.woodLevel;
  baseBuildings['حفرة الطمي'] = data.clayLevel;
  baseBuildings['منجم الحديد'] = data.ironLevel;
  baseBuildings['المخازن'] = data.warehouseLevel;
  baseBuildings['السوق'] = data.marketLevel;
  baseBuildings['المزارع'] = data.farmLevel;

  const troops = normalizeVillageTroops({
    ...(existing || {}),
    spearsTotal: data.spearsTotal,
    swordsTotal: data.swordsTotal,
    axesTotal: data.axesTotal,
    lightsTotal: data.lightsTotal,
    heaviesTotal: data.heaviesTotal,
    spearsHome: existing?.spearsHome ?? data.spearsTotal,
    swordsHome: existing?.swordsHome ?? data.swordsTotal
  });

  const savedVil: ErpVillage = {
    ...(existing || {}),
    id: data.id || `vil_${nowMs}_${Math.floor(Math.random() * 1000)}`,
    villageId: data.villageId ?? existing?.villageId ?? '',
    accountId: data.accountId,
    worldId: data.worldId,
    continent: data.continent,
    name: data.name,
    coord: data.coord || existing?.coord || '500|500',
    villageRole: data.villageRole ?? existing?.villageRole ?? 'unset',
    villagePoints: existing?.villagePoints ?? 26,
    lastSyncTime: existing?.lastSyncTime || nowMs,
    flag: data.flag,
    woodItem: data.woodItem,
    clayItem: data.clayItem,
    ironItem: data.ironItem,
    premium: data.premium,
    boost30: data.boost30,
    marketLevel: data.marketLevel,
    farmLevel: data.farmLevel,
    mines: {
      wood: { curr: data.woodLevel, target: existing?.mines?.wood?.target ?? 20 },
      clay: { curr: data.clayLevel, target: existing?.mines?.clay?.target ?? 20 },
      iron: { curr: data.ironLevel, target: existing?.mines?.iron?.target ?? 20 }
    },
    warehouse: {
      level: data.warehouseLevel,
      woodStock: data.woodStock,
      clayStock: data.clayStock,
      ironStock: data.ironStock,
      lastUpdated: nowMs
    },
    buildings: normalizeBuildingsMap(baseBuildings),
    unlockedScavTiers: data.unlockedScavTiers,
    spearsHome: troops.spearsHome,
    swordsHome: troops.swordsHome,
    spearsAway: troops.spearsAway,
    swordsAway: troops.swordsAway,
    spearsTotal: troops.spearsTotal,
    swordsTotal: troops.swordsTotal,
    axesTotal: troops.axesTotal,
    lightsTotal: troops.lightsTotal,
    heaviesTotal: troops.heaviesTotal,
    unitsHome: troops.unitsHome,
    unitsAway: troops.unitsAway,
    unitsTotal: troops.unitsTotal
  };

  if (idx >= 0) {
    nextState.villages[idx] = savedVil;
  } else {
    nextState.villages.push(savedVil);
  }
  if (!nextState.activeVillageId) {
    nextState.activeVillageId = savedVil.id;
  }

  return { ok: true, state: nextState, updatedVillage: savedVil };
}

export function mutateDeleteVillage(
  prevState: ErpAppState,
  villageId: string
): MutationResult {
  const target = prevState.villages.find((v) => v.id === villageId);
  if (!target) {
    return { ok: false, state: prevState, errors: { villageId: 'القرية غير موجودة.' } };
  }

  const nextState: ErpAppState = JSON.parse(JSON.stringify(prevState));
  nextState.villages = nextState.villages.filter((v) => v.id !== villageId);
  if (target.id && !nextState.deletedVillageIds.includes(target.id)) nextState.deletedVillageIds.push(target.id);
  if (target.villageId && !nextState.deletedVillageIds.includes(target.villageId)) {
    nextState.deletedVillageIds.push(target.villageId);
  }
  if (nextState.activeVillageId === villageId) {
    nextState.activeVillageId = nextState.villages[0]?.id || '';
  }

  return { ok: true, state: nextState, deletedVillages: [target] };
}

export function mutateSetVillageRole(
  prevState: ErpAppState,
  villageId: string,
  villageRole: VillageRole
): MutationResult {
  const idx = prevState.villages.findIndex((v) => v.id === villageId);
  if (idx < 0) {
    return { ok: false, state: prevState, errors: { villageId: 'القرية غير موجودة.' } };
  }
  const cleanRole: VillageRole =
    villageRole === 'offense' || villageRole === 'defense' ? villageRole : 'unset';
  if ((prevState.villages[idx].villageRole ?? 'unset') === cleanRole) {
    return { ok: true, state: prevState, updatedVillage: prevState.villages[idx] };
  }
  const nextState: ErpAppState = JSON.parse(JSON.stringify(prevState));
  nextState.villages[idx].villageRole = cleanRole;
  return { ok: true, state: nextState, updatedVillage: nextState.villages[idx] };
}

export function mutateSaveWorld(
  prevState: ErpAppState,
  input: Partial<WorldInput>,
  nowMs: number = Date.now()
): MutationResult {
  const validation = validateWorldInput(input);
  if (!validation.valid) {
    return { ok: false, state: prevState, errors: validation.errors };
  }

  const data = validation.data;
  const nextState: ErpAppState = JSON.parse(JSON.stringify(prevState));
  const idx = data.id ? nextState.worlds.findIndex((w) => w.id === data.id) : -1;

  let savedWorld: ErpWorld;
  if (idx >= 0) {
    const prevWorld = nextState.worlds[idx];
    savedWorld = {
      ...prevWorld,
      name: data.name,
      speed: data.speed,
      settingsUrl: data.settingsUrl ?? prevWorld.settingsUrl ?? '',
      ...(data.tradeEnded !== undefined ? { tradeEnded: data.tradeEnded } : {}),
      ...(data.tradeSummaryPP !== undefined ? { tradeSummaryPP: data.tradeSummaryPP } : {})
    };
    nextState.worlds[idx] = savedWorld;
  } else {
    savedWorld = {
      id: data.id || `w_${nowMs}`,
      name: data.name,
      speed: data.speed,
      settingsUrl: data.settingsUrl || '',
      tradeEnded: Boolean(data.tradeEnded),
      tradeEndedAt: data.tradeEnded ? nowMs : null,
      tradeSummaryPP: data.tradeSummaryPP ?? null,
      startedAt: nowMs,
      continents: makeDefaultContinents(64, 64)
    };
    nextState.worlds.push(savedWorld);
  }

  return { ok: true, state: nextState, updatedWorld: savedWorld };
}

export function mutateSetWorldTradeEnded(
  prevState: ErpAppState,
  worldId: string,
  tradeEnded: boolean,
  customTotalPP?: number | null,
  nowMs: number = Date.now()
): MutationResult {
  const idx = prevState.worlds.findIndex((w) => w.id === worldId);
  if (idx < 0) {
    return { ok: false, state: prevState, errors: { worldId: 'العالم المحدد غير موجود.' } };
  }

  const nextState: ErpAppState = JSON.parse(JSON.stringify(prevState));
  const world = nextState.worlds[idx];
  world.continents = world.continents || makeDefaultContinents(64, 64);

  if (tradeEnded) {
    world.tradeEnded = true;
    world.tradeEndedAt = nowMs;

    // Automatically mark all 4 continents' exchange as full/closed so expected PP drops to 0
    FIXED_CONTINENTS.forEach((cont) => {
      const cur = world.continents[cont] || {
        sellRate: 64,
        buyRate: 64,
        sellWood: 64,
        sellClay: 64,
        sellIron: 64,
        lastUpdated: nowMs
      };
      const capW = cur.capWood && cur.capWood > 0 ? cur.capWood : cur.stockWood || 100000;
      const capC = cur.capClay && cur.capClay > 0 ? cur.capClay : cur.stockClay || 100000;
      const capI = cur.capIron && cur.capIron > 0 ? cur.capIron : cur.stockIron || 100000;
      world.continents[cont] = {
        ...cur,
        isMarketClosed: true,
        stockWood: capW,
        stockClay: capC,
        stockIron: capI,
        capWood: capW,
        capClay: capC,
        capIron: capI,
        lastUpdated: nowMs
      };
    });

    // Snapshot total PP earned in this world for historical cross-world reports
    if (customTotalPP !== undefined && customTotalPP !== null && Number.isFinite(Number(customTotalPP))) {
      world.tradeSummaryPP = Math.max(0, Math.round(Number(customTotalPP)));
    } else if (world.tradeSummaryPP === undefined || world.tradeSummaryPP === null) {
      const est = estimateWorldTotalPP(prevState, worldId);
      world.tradeSummaryPP = est.totalPP;
    }
  } else {
    world.tradeEnded = false;
    world.tradeEndedAt = null;
    FIXED_CONTINENTS.forEach((cont) => {
      const cur = world.continents[cont];
      if (!cur) return;
      world.continents[cont] = {
        ...cur,
        isMarketClosed: false,
        stockWood: 0,
        stockClay: 0,
        stockIron: 0,
        lastUpdated: nowMs
      };
    });
  }

  return { ok: true, state: nextState, updatedWorld: world };
}

export function mutateDeleteWorld(
  prevState: ErpAppState,
  worldId: string
): MutationResult {
  const idx = prevState.worlds.findIndex((w) => w.id === worldId);
  if (idx < 0) {
    return { ok: false, state: prevState, errors: { worldId: 'العالم المحدد غير موجود.' } };
  }
  if (prevState.worlds.length <= 1) {
    return {
      ok: false,
      state: prevState,
      errors: { worldId: 'لا يمكن حذف العالم الوحيد في النظام. أضف عالماً آخر أولاً.' }
    };
  }

  const nextState: ErpAppState = JSON.parse(JSON.stringify(prevState));
  nextState.worlds = nextState.worlds.filter((w) => w.id !== worldId);

  const removedVillages = nextState.villages.filter((v) => v.worldId === worldId);
  nextState.villages = nextState.villages.filter((v) => v.worldId !== worldId);

  nextState.deletedVillageIds = Array.isArray(nextState.deletedVillageIds)
    ? nextState.deletedVillageIds
    : [];
  removedVillages.forEach((v) => {
    [v.id, v.villageId].filter(Boolean).forEach((idVal) => {
      if (!nextState.deletedVillageIds.includes(String(idVal))) {
        nextState.deletedVillageIds.push(String(idVal));
      }
    });
  });

  if (nextState.selectedWorldFilter === worldId) {
    nextState.selectedWorldFilter = 'all';
  }
  if (
    nextState.activeVillageId &&
    removedVillages.some((v) => v.id === nextState.activeVillageId)
  ) {
    nextState.activeVillageId = nextState.villages[0]?.id || '';
  }

  return {
    ok: true,
    state: nextState,
    deletedWorldId: worldId,
    deletedVillages: removedVillages
  };
}

export function mutateUpdateContinentRates(
  prevState: ErpAppState,
  worldId: string,
  ratesInput: Partial<ContinentRatesInput>,
  nowMs: number = Date.now()
): MutationResult {
  const worldExists = prevState.worlds.some((w) => w.id === worldId);
  if (!worldExists) {
    return { ok: false, state: prevState, errors: { worldId: 'العالم المحدد غير موجود.' } };
  }

  const validation = validateContinentRatesInput(ratesInput);
  if (!validation.valid) {
    return { ok: false, state: prevState, errors: validation.errors };
  }

  const data = validation.data;
  const nextState: ErpAppState = JSON.parse(JSON.stringify(prevState));
  const world = nextState.worlds.find((w) => w.id === worldId)!;
  world.continents = world.continents || makeDefaultContinents(64, 64);
  const prevCont = world.continents[data.continent];
  world.continents[data.continent] = {
    sellRate: data.sellRate,
    buyRate: data.buyRate,
    sellWood: data.sellWood,
    sellClay: data.sellClay,
    sellIron: data.sellIron,
    lastUpdated: nowMs,
    stockWood: data.stockWood !== undefined ? data.stockWood : prevCont?.stockWood,
    stockClay: data.stockClay !== undefined ? data.stockClay : prevCont?.stockClay,
    stockIron: data.stockIron !== undefined ? data.stockIron : prevCont?.stockIron,
    capWood: data.capWood !== undefined ? data.capWood : prevCont?.capWood,
    capClay: data.capClay !== undefined ? data.capClay : prevCont?.capClay,
    capIron: data.capIron !== undefined ? data.capIron : prevCont?.capIron
  };

  return { ok: true, state: nextState, updatedWorld: world };
}

export function mutateAssignVillagePlan(
  prevState: ErpAppState,
  villageId: string,
  plan: AssignedPlan | null
): MutationResult {
  const idx = prevState.villages.findIndex((v) => v.id === villageId);
  if (idx < 0) {
    return { ok: false, state: prevState, errors: { villageId: 'القرية غير موجودة.' } };
  }
  const nextState: ErpAppState = JSON.parse(JSON.stringify(prevState));
  nextState.villages[idx].assignedPlan = plan;
  return { ok: true, state: nextState, updatedVillage: nextState.villages[idx] };
}

export function mutateAssignPlanBulk(
  prevState: ErpAppState,
  villageIds: string[],
  plan: AssignedPlan | null
): MutationResult {
  const targetSet = new Set(villageIds.filter(Boolean));
  if (targetSet.size === 0) {
    return { ok: false, state: prevState, errors: { villageIds: 'لا توجد قرى محددة لإسناد الخطة.' } };
  }

  const nextState: ErpAppState = JSON.parse(JSON.stringify(prevState));
  const updatedVillages: ErpVillage[] = [];
  nextState.villages.forEach((v) => {
    if (targetSet.has(v.id)) {
      v.assignedPlan = plan ? JSON.parse(JSON.stringify(plan)) : null;
      updatedVillages.push(v);
    }
  });

  if (updatedVillages.length === 0) {
    return { ok: false, state: prevState, errors: { villageIds: 'لم يتم العثور على القرى المستهدفة.' } };
  }

  return {
    ok: true,
    state: nextState,
    updatedVillage: updatedVillages[0],
    updatedVillages
  };
}

export function mutateGenerateVirtualVillages(
  prevState: ErpAppState,
  params: VirtualVillageBatchParams,
  nowMs: number = Date.now()
): MutationResult {
  const world = prevState.worlds.find((w) => w.id === params.worldId);
  if (!world) {
    return { ok: false, state: prevState, errors: { worldId: 'العالم المحدد غير موجود.' } };
  }

  const slots: Array<'44' | '45' | '54' | '55'> = [];
  (['44', '45', '54', '55'] as const).forEach((cont) => {
    const count = Math.max(0, Math.min(200, Math.trunc(Number(params.countsByContinent[cont] || 0))));
    for (let i = 0; i < count; i++) {
      slots.push(cont);
    }
  });

  if (slots.length === 0) {
    return { ok: false, state: prevState, errors: { counts: 'حدد قرية واحدة على الأقل للتوليد.' } };
  }

  const nextState: ErpAppState = JSON.parse(JSON.stringify(prevState));
  const alreadyInWorld = new Set(
    nextState.villages.filter((v) => v.worldId === world.id).map((v) => v.accountId)
  );
  const seenRequested = new Set<string>();
  const validAccIds = (params.accountIds || []).filter((id) => {
    if (!id || seenRequested.has(id) || alreadyInWorld.has(id)) return false;
    if (!nextState.userAccounts.some((a) => a.id === id)) return false;
    seenRequested.add(id);
    return true;
  });
  const autoCreate = params.autoCreateMissingAccounts === true;

  if (!autoCreate && validAccIds.length === 0) {
    return {
      ok: false,
      state: prevState,
      errors: {
        accountIds: 'جميع الحسابات المحددة لديها بالفعل قرية في هذا العالم (قرية واحدة لكل حساب).'
      }
    };
  }

  if (!autoCreate && validAccIds.length < slots.length) {
    return {
      ok: false,
      state: prevState,
      errors: {
        accountIds: `عدد الحسابات المتاحة (${validAccIds.length}) أقل من عدد القرى الموزعة على القارات (${slots.length}).`
      }
    };
  }

  const createdAccounts: ErpUserAccount[] = [];
  const updatedVillages: ErpVillage[] = [];
  const accPrefix = (params.accountNamePrefix || `حساب ${world.name}`).trim();
  const vilPrefix = (params.villageNamePrefix || '').trim();
  const existingNamesLower = new Set(
    nextState.userAccounts.map((a) => a.name.trim().toLowerCase())
  );

  let autoAccSeq = 1;
  const contSeq: Record<string, number> = { '44': 0, '45': 0, '54': 0, '55': 0 };

  slots.forEach((cont, idx) => {
    contSeq[cont] = (contSeq[cont] || 0) + 1;

    let accountId = validAccIds[idx];
    let accountName = '';
    if (accountId) {
      accountName = nextState.userAccounts.find((a) => a.id === accountId)?.name || '';
    } else {
      let candidateName = `${accPrefix} #${autoAccSeq}`;
      while (existingNamesLower.has(candidateName.toLowerCase())) {
        autoAccSeq += 1;
        candidateName = `${accPrefix} #${autoAccSeq}`;
      }
      autoAccSeq += 1;
      existingNamesLower.add(candidateName.toLowerCase());

      const newAcc: ErpUserAccount = {
        id: `acc_v_${nowMs}_${idx}_${Math.floor(Math.random() * 1000)}`,
        name: candidateName,
        pp: 0,
        ip: '',
        device: '',
        browser: '',
        email: '',
        password: '',
        lastSyncTime: 0,
        loginHistory: [],
        deviceLog: []
      };
      nextState.userAccounts.push(newAcc);
      createdAccounts.push(newAcc);
      accountId = newAcc.id;
      accountName = newAcc.name;
    }

    const baseBuildings = normalizeBuildingsMap({
      'المبنى الرئيسي': 1,
      'نقطة التجمع': 1,
      'المزارع': 1,
      'المخازن': 1,
      'المخابئ': 1,
      'الخشاب': 0,
      'حفرة الطمي': 0,
      'منجم الحديد': 0
    });

    const villageName = vilPrefix
      ? `${vilPrefix} - ${accountName || `K${cont}-${contSeq[cont]}`}`
      : accountName || `قرية K${cont}-${contSeq[cont]}`;

    const troops = normalizeVillageTroops({});
    const newVil: ErpVillage = {
      id: `vil_v_${nowMs}_${idx}_${Math.floor(Math.random() * 1000)}`,
      villageId: '',
      accountId,
      worldId: world.id,
      continent: cont,
      name: villageName,
      coord: '',
      villageRole: 'unset',
      villagePoints: 26,
      isVirtual: true,
      lastSyncTime: 0,
      flag: 0,
      woodItem: 0,
      clayItem: 0,
      ironItem: 0,
      premium: false,
      boost30: false,
      marketLevel: 0,
      farmLevel: 1,
      mines: {
        wood: { curr: 0, target: 20 },
        clay: { curr: 0, target: 20 },
        iron: { curr: 0, target: 20 }
      },
      warehouse: {
        level: 1,
        woodStock: 500,
        clayStock: 500,
        ironStock: 400,
        lastUpdated: nowMs
      },
      buildings: baseBuildings,
      unlockedScavTiers: 0,
      spearsHome: troops.spearsHome,
      swordsHome: troops.swordsHome,
      spearsAway: troops.spearsAway,
      swordsAway: troops.swordsAway,
      spearsTotal: troops.spearsTotal,
      swordsTotal: troops.swordsTotal,
      axesTotal: troops.axesTotal,
      lightsTotal: troops.lightsTotal,
      heaviesTotal: troops.heaviesTotal,
      unitsHome: troops.unitsHome,
      unitsAway: troops.unitsAway,
      unitsTotal: troops.unitsTotal,
      assignedPlan: params.assignedPlan
        ? JSON.parse(JSON.stringify(params.assignedPlan))
        : null
    };

    nextState.villages.push(newVil);
    updatedVillages.push(newVil);
  });

  if (!nextState.activeVillageId && updatedVillages[0]) {
    nextState.activeVillageId = updatedVillages[0].id;
  }

  return {
    ok: true,
    state: nextState,
    updatedVillage: updatedVillages[0],
    updatedVillages,
    createdAccounts
  };
}

export function mutateOverrideDailySession(
  prevState: ErpAppState,
  accountId: string,
  dateKey: string,
  startPP: number,
  lastSyncedPP: number,
  targetPP?: number,
  nowMs: number = Date.now()
): MutationResult {
  const acc = prevState.userAccounts.find((a) => a.id === accountId);
  if (!acc) {
    return { ok: false, state: prevState, errors: { accountId: 'الحساب غير موجود.' } };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return { ok: false, state: prevState, errors: { dateKey: 'تنسيق التاريخ غير صالح.' } };
  }
  const cleanStart = Math.max(0, Math.trunc(Number(startPP)));
  const cleanEnd = Math.max(0, Math.trunc(Number(lastSyncedPP)));
  if (!Number.isFinite(cleanStart) || !Number.isFinite(cleanEnd)) {
    return { ok: false, state: prevState, errors: { pp: 'قيم النقاط غير صالحة.' } };
  }

  const nextState: ErpAppState = JSON.parse(JSON.stringify(prevState));
  nextState.dailySessions = nextState.dailySessions || {};
  nextState.dailySessions[dateKey] = nextState.dailySessions[dateKey] || {};
  const existing = nextState.dailySessions[dateKey][accountId];
  nextState.dailySessions[dateKey][accountId] = {
    startPP: cleanStart,
    lastSyncedPP: cleanEnd,
    targetPP: targetPP !== undefined ? Math.max(1, Math.trunc(targetPP)) : (existing?.targetPP || 100),
    firstSyncTime: existing?.firstSyncTime || nowMs,
    lastSyncTime: existing?.lastSyncTime || nowMs,
    manualAdjusted: true
  };
  if (dateKey === getCairoDateKey(nowMs)) {
    const targetAcc = nextState.userAccounts.find((a) => a.id === accountId);
    if (targetAcc) targetAcc.pp = cleanEnd;
  }

  return { ok: true, state: nextState };
}

export function mutateUpdateSettings(
  prevState: ErpAppState,
  patch: {
    gameRules?: Partial<ErpGameRules>;
    finance?: Partial<ErpFinance>;
    upgradeBudgetPP?: number;
    simDiscountMode?: ErpAppState['simDiscountMode'];
  }
): MutationResult {
  const nextState: ErpAppState = JSON.parse(JSON.stringify(prevState));
  if (patch.gameRules) {
    nextState.gameRules = { ...nextState.gameRules, ...patch.gameRules };
  }
  if (patch.finance) {
    nextState.finance = { ...nextState.finance, ...patch.finance };
  }
  if (patch.upgradeBudgetPP !== undefined && Number.isFinite(patch.upgradeBudgetPP)) {
    nextState.upgradeBudgetPP = Math.max(0, Math.min(100_000_000, Math.trunc(patch.upgradeBudgetPP)));
  }
  if (patch.simDiscountMode) {
    nextState.simDiscountMode = patch.simDiscountMode;
  }
  return { ok: true, state: nextState };
}

export function mutateApplyIncomingSync(
  prevState: ErpAppState,
  rawInput: string | Record<string, any>,
  nowMs: number = Date.now()
): SyncProcessResult & { validationErrors?: Record<string, string> } {
  const validation = validateIncomingSyncPayload(rawInput);
  if (!validation.valid) {
    const firstMsg = Object.values(validation.errors)[0] || 'بيانات المزامنة غير صالحة.';
    return { ok: false, error: String(firstMsg), validationErrors: validation.errors };
  }
  return processIncomingVillageSync(prevState, validation.data, nowMs);
}

export function exportStateBackupJson(state: ErpAppState): string {
  return JSON.stringify(state, null, 2);
}

export function mutateImportBackupJson(rawJson: string): MutationResult {
  const validation = validateAppStateBackupJson(rawJson);
  if (!validation.valid) {
    return {
      ok: false,
      state: createDefaultAppState(),
      errors: validation.errors
    };
  }
  const repaired = repairStateIntegrity(validation.data);
  return { ok: true, state: repaired };
}

export function mutateResetWorkspace(): ErpAppState {
  return createDefaultAppState();
}
