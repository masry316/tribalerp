import type { ErpAppState, ErpUserAccount, IpCollisionGroup, SecurityAuditRow } from '../types';

export function auditAccountsSecurity(state: ErpAppState): IpCollisionGroup[] {
  const collisions: IpCollisionGroup[] = [];
  const ipMap: Record<string, { acc: ErpUserAccount; wId: string }[]> = {};

  const closedWorldIds = new Set(
    (state.worlds || []).filter((w) => Boolean(w.tradeEnded)).map((w) => w.id)
  );

  state.userAccounts.forEach((acc) => {
    const ip = (acc.ip || '').trim();
    if (!ip) return;
    const vils = state.villages.filter(
      (v) => v.accountId === acc.id && !closedWorldIds.has(v.worldId)
    );
    const worldIds = [...new Set(vils.map((v) => v.worldId))];
    if (worldIds.length === 0) {
      const hasOnlyClosedVillages = state.villages.some((v) => v.accountId === acc.id);
      if (hasOnlyClosedVillages) return;
      worldIds.push('غير محدد');
    }
    worldIds.forEach((wId) => {
      const key = `${ip}___${wId}`;
      if (!ipMap[key]) ipMap[key] = [];
      ipMap[key].push({ acc, wId });
    });
  });

  Object.keys(ipMap).forEach((k) => {
    const list = ipMap[k];
    if (list.length > 1) {
      const [ip, wId] = k.split('___');
      const wObj = state.worlds.find((w) => w.id === wId);
      collisions.push({
        type: 'ip',
        ip,
        worldId: wId,
        wName: wObj ? wObj.name : wId,
        accounts: list.map((i) => i.acc),
        accountNames: list.map((i) => i.acc.name),
        accountIds: list.map((i) => i.acc.id)
      });
    }
  });

  return collisions;
}

export function buildSecurityAuditRows(
  state: ErpAppState,
  nowMs: number = Date.now()
): SecurityAuditRow[] {
  const collisions = auditAccountsSecurity(state);
  const collidingAccountIds = new Set<string>();
  collisions.forEach((g) => g.accountIds.forEach((id) => collidingAccountIds.add(id)));

  return state.userAccounts.map((acc) => {
    const ip = (acc.ip || '').trim();
    const hasIp = ip.length > 0;
    const isCol = collidingAccountIds.has(acc.id);
    const riskScore: 0 | 1 | 2 = isCol ? 2 : !hasIp ? 1 : 0;

    const vils = state.villages.filter((v) => v.accountId === acc.id);
    const worldIds = [...new Set(vils.map((v) => v.worldId))];
    const wNames = worldIds.map((wid) => state.worlds.find((w) => w.id === wid)?.name || wid);
    const continents = [...new Set(vils.map((v) => v.continent))];

    let idleScavCount = 0;
    let whRiskCount = 0;
    vils.forEach((v) => {
      const scavRet = Number(v.scavData?.scavReturnAt || v.scavReturnAt || 0);
      const uHome = v.unitsHome || v.scavData?.unitsHome || {};
      const homeTroops =
        Number(uHome.spear ?? v.spearsHome ?? 0) +
        Number(uHome.sword ?? v.swordsHome ?? 0) +
        Number(uHome.axe ?? v.axesHome ?? 0) +
        Number(uHome.light ?? v.lightsHome ?? 0) +
        Number(uHome.heavy ?? v.heaviesHome ?? 0);
      if (scavRet <= nowMs && homeTroops >= 10) idleScavCount++;

      const whMax = Number(v.warehouse?.level || 1) >= 1 ? v.warehouse : null;
      if (whMax) {
        const cap = Math.max(1000, Number(whMax.level || 1) * 1000);
        if (
          Number(whMax.woodStock || 0) >= cap * 0.9 ||
          Number(whMax.clayStock || 0) >= cap * 0.9 ||
          Number(whMax.ironStock || 0) >= cap * 0.9
        ) {
          whRiskCount++;
        }
      }
    });

    return {
      accountId: acc.id,
      acc,
      ip,
      hasIp,
      isCol,
      riskScore,
      worldIds,
      wNames,
      continents,
      vilsCount: vils.length,
      histCount: Array.isArray(acc.loginHistory) ? acc.loginHistory.length : 0,
      idleScavCount,
      whRiskCount,
      lastSyncTime: Number(acc.lastSyncTime || 0)
    };
  });
}
