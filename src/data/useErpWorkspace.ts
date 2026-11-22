import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createDefaultAppState,
  type AssignedPlan,
  type ErpAppState,
  type ErpFinance,
  type ErpGameRules,
  type SyncProcessResult,
  type SyncStatusState,
  type VillageRole
} from '../core';
import type { AccountInput, ContinentRatesInput, VillageInput, WorldInput } from '../validation';
import {
  fetchFirestoreDashboardSummary,
  loadMasterState,
  saveMasterState
} from './erpStateRepository';
import {
  ensureBookmarkletLibrarySynced,
  fetchAndConsumeIncomingSyncsOnce
} from './incomingSyncRepository';
import {
  getLocalCacheMeta,
  loadHydratedLocalCache,
  loadLocalCachedState,
  persistLocalCachedState
} from './localCacheRepository';
import {
  exportStateBackupJson,
  mutateApplyIncomingSync,
  mutateAssignPlanBulk,
  mutateAssignVillagePlan,
  mutateDeleteAccount,
  mutateDeleteVillage,
  mutateDeleteWorld,
  mutateGenerateVirtualVillages,
  mutateImportBackupJson,
  mutateOverrideDailySession,
  mutateResetWorkspace,
  mutateSaveAccount,
  mutateSaveVillage,
  mutateSaveWorld,
  mutateSetVillageRole,
  mutateSetWorldTradeEnded,
  mutateUpdateContinentRates,
  mutateUpdateSettings,
  type MutationResult,
  type VirtualVillageBatchParams
} from './stateMutations';
import {
  deleteVillageFromCloud,
  deleteWorldFromCloud,
  syncAssignedPlanToCloud
} from './villageRepository';

export interface ManualRefreshResult {
  ok: boolean;
  appliedSyncsCount: number;
  source: 'firestore' | 'cache' | 'default';
  errorMessage?: string;
}

export function useErpWorkspace() {
  const initialCacheRef = useRef(loadLocalCachedState());
  const [state, setState] = useState<ErpAppState>(
    () => initialCacheRef.current.state || createDefaultAppState()
  );
  const stateRef = useRef<ErpAppState>(state);
  stateRef.current = state;

  const [ready, setReady] = useState<boolean>(() => Boolean(initialCacheRef.current.hasLocalCache));
  const [syncStatus, setSyncStatus] = useState<SyncStatusState>(() => ({
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    status: 'idle',
    lastSyncAt: initialCacheRef.current.localTs || null,
    accountsCount: state.userAccounts.length,
    villagesCount: state.villages.length,
    totalPP: state.userAccounts.reduce((s, a) => s + (Number(a.pp) || 0), 0),
    errorMessage: null,
    source: initialCacheRef.current.hasLocalCache ? 'cache' : 'local'
  }));

  const commitState = useCallback(async (next: ErpAppState, syncCloud = true) => {
    stateRef.current = next;
    setState(next);
    const totalPP = next.userAccounts.reduce((s, a) => s + (Number(a.pp) || 0), 0);
    setSyncStatus((prev) => ({
      ...prev,
      status: syncCloud ? 'syncing' : prev.status,
      accountsCount: next.userAccounts.length,
      villagesCount: next.villages.length,
      totalPP
    }));

    if (!syncCloud) {
      persistLocalCachedState(next, Date.now(), true);
      return;
    }

    try {
      const res = await saveMasterState(next);
      setSyncStatus((prev) => ({
        ...prev,
        online: res.ok,
        status: res.ok ? 'synced' : 'error',
        lastSyncAt: res.clientTimestamp,
        errorMessage: res.error || null,
        source: res.ok ? 'firestore' : 'cache'
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSyncStatus((prev) => ({
        ...prev,
        online: typeof navigator !== 'undefined' ? navigator.onLine : false,
        status: 'error',
        errorMessage: msg
      }));
    }
  }, []);

  /**
   * Manual-only cloud data refresh ('تحديث الداتا'):
   * Pulls the latest master snapshot and any pending game bookmarklet syncs
   * from Firestore on user demand, updating IndexedDB + localStorage cache.
   */
  const refreshDataFromCloud = useCallback(async (): Promise<ManualRefreshResult> => {
    setSyncStatus((prev) => ({
      ...prev,
      status: 'syncing',
      errorMessage: null
    }));

    try {
      const localMeta = getLocalCacheMeta();
      if (localMeta.dirty && stateRef.current) {
        await saveMasterState(stateRef.current);
      }

      const loaded = await loadMasterState({ forceNetwork: true });
      let workingState = loaded.state;
      let appliedSyncsCount = 0;

      if (loaded.shouldPushLocal) {
        await saveMasterState(workingState);
      }

      try {
        appliedSyncsCount = await fetchAndConsumeIncomingSyncsOnce((_syncId, payload) => {
          const res = mutateApplyIncomingSync(workingState, payload);
          if (res.ok && res.nextState) {
            workingState = res.nextState;
          }
        });
      } catch (syncErr) {
        console.warn('[useErpWorkspace] Incoming sync pull skipped:', syncErr);
      }

      let finalTs = loaded.cloudTs || Date.now();
      if (appliedSyncsCount > 0) {
        const saved = await saveMasterState(workingState);
        finalTs = saved.clientTimestamp;
      } else {
        persistLocalCachedState(workingState, finalTs, false);
      }

      stateRef.current = workingState;
      setState(workingState);
      setSyncStatus({
        online: loaded.source === 'firestore' || appliedSyncsCount > 0,
        status: loaded.errorMessage ? 'error' : 'synced',
        lastSyncAt: finalTs,
        accountsCount: workingState.userAccounts.length,
        villagesCount: workingState.villages.length,
        totalPP: workingState.userAccounts.reduce((s, a) => s + (Number(a.pp) || 0), 0),
        errorMessage: loaded.errorMessage || null,
        source: loaded.source === 'firestore' || appliedSyncsCount > 0 ? 'firestore' : 'cache'
      });

      void ensureBookmarkletLibrarySynced().catch(() => {});

      return {
        ok: !loaded.errorMessage,
        appliedSyncsCount,
        source: loaded.source,
        errorMessage: loaded.errorMessage
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSyncStatus((prev) => ({
        ...prev,
        online: typeof navigator !== 'undefined' ? navigator.onLine : false,
        status: 'error',
        errorMessage: msg
      }));
      return {
        ok: false,
        appliedSyncsCount: 0,
        source: 'cache',
        errorMessage: msg
      };
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function bootFromLocalCacheOnly() {
      // Hydrate from localStorage + IndexedDB without triggering automatic Firestore reads
      const hydrated = await loadHydratedLocalCache();
      if (!mounted) return;

      if (hydrated.hasLocalCache && hydrated.state) {
        stateRef.current = hydrated.state;
        setState(hydrated.state);
        setSyncStatus((prev) => ({
          ...prev,
          status: 'idle',
          lastSyncAt: hydrated.localTs || prev.lastSyncAt,
          accountsCount: hydrated.state!.userAccounts.length,
          villagesCount: hydrated.state!.villages.length,
          totalPP: hydrated.state!.userAccounts.reduce((s, a) => s + (Number(a.pp) || 0), 0),
          source: 'cache',
          errorMessage: null
        }));
        setReady(true);
        return;
      }

      // First launch on a completely empty browser: perform one-shot initial fetch once,
      // cache locally into IndexedDB + localStorage, and keep subsequent reloads 100% local.
      try {
        const loaded = await loadMasterState({ forceNetwork: true });
        if (!mounted) return;
        stateRef.current = loaded.state;
        setState(loaded.state);
        setSyncStatus({
          online: loaded.source === 'firestore',
          status: loaded.errorMessage
            ? 'error'
            : loaded.source === 'firestore'
              ? 'synced'
              : 'idle',
          lastSyncAt: loaded.cloudTs || null,
          accountsCount: loaded.state.userAccounts.length,
          villagesCount: loaded.state.villages.length,
          totalPP: loaded.state.userAccounts.reduce((s, a) => s + (Number(a.pp) || 0), 0),
          errorMessage: loaded.errorMessage || null,
          source: loaded.source
        });
      } catch (err) {
        if (!mounted) return;
        const msg = err instanceof Error ? err.message : String(err);
        setSyncStatus((prev) => ({ ...prev, status: 'error', errorMessage: msg }));
      } finally {
        if (mounted) setReady(true);
      }
    }

    void bootFromLocalCacheOnly();

    return () => {
      mounted = false;
    };
  }, []);

  const saveAccount = useCallback(
    (input: Partial<AccountInput>): MutationResult => {
      const res = mutateSaveAccount(stateRef.current, input);
      if (res.ok) commitState(res.state, true);
      return res;
    },
    [commitState]
  );

  const deleteAccount = useCallback(
    (accountId: string): MutationResult => {
      const res = mutateDeleteAccount(stateRef.current, accountId);
      if (res.ok) {
        commitState(res.state, true);
        (res.deletedVillages || []).forEach((vil) => {
          deleteVillageFromCloud(vil).catch(() => {});
        });
      }
      return res;
    },
    [commitState]
  );

  const saveVillage = useCallback(
    (input: Partial<VillageInput>): MutationResult => {
      const res = mutateSaveVillage(stateRef.current, input);
      if (res.ok) commitState(res.state, true);
      return res;
    },
    [commitState]
  );

  const setVillageRole = useCallback(
    (villageId: string, role: VillageRole): MutationResult => {
      const res = mutateSetVillageRole(stateRef.current, villageId, role);
      if (res.ok) commitState(res.state, true);
      return res;
    },
    [commitState]
  );

  const deleteVillage = useCallback(
    (villageId: string): MutationResult => {
      const res = mutateDeleteVillage(stateRef.current, villageId);
      if (res.ok) {
        commitState(res.state, true);
        (res.deletedVillages || []).forEach((vil) => {
          deleteVillageFromCloud(vil).catch(() => {});
        });
      }
      return res;
    },
    [commitState]
  );

  const saveWorld = useCallback(
    (input: Partial<WorldInput>): MutationResult => {
      const res = mutateSaveWorld(stateRef.current, input);
      if (res.ok) commitState(res.state, true);
      return res;
    },
    [commitState]
  );

  const setWorldTradeEnded = useCallback(
    (worldId: string, tradeEnded: boolean, customTotalPP?: number | null): MutationResult => {
      const res = mutateSetWorldTradeEnded(stateRef.current, worldId, tradeEnded, customTotalPP);
      if (res.ok) commitState(res.state, true);
      return res;
    },
    [commitState]
  );

  const deleteWorld = useCallback(
    (worldId: string): MutationResult => {
      const res = mutateDeleteWorld(stateRef.current, worldId);
      if (res.ok) {
        commitState(res.state, true);
        deleteWorldFromCloud(worldId).catch(() => {});
        (res.deletedVillages || []).forEach((vil) => {
          deleteVillageFromCloud(vil).catch(() => {});
        });
      }
      return res;
    },
    [commitState]
  );

  const updateContinentRates = useCallback(
    (worldId: string, ratesInput: Partial<ContinentRatesInput>): MutationResult => {
      const res = mutateUpdateContinentRates(stateRef.current, worldId, ratesInput);
      if (res.ok) commitState(res.state, true);
      return res;
    },
    [commitState]
  );

  const assignVillagePlan = useCallback(
    (villageId: string, plan: AssignedPlan | null, simType = 'virtual26'): MutationResult => {
      const res = mutateAssignVillagePlan(stateRef.current, villageId, plan);
      if (res.ok) {
        commitState(res.state, true);
        if (res.updatedVillage) {
          syncAssignedPlanToCloud(res.updatedVillage, plan, simType).catch(() => {});
        }
      }
      return res;
    },
    [commitState]
  );

  const assignPlanBulk = useCallback(
    (villageIds: string[], plan: AssignedPlan | null, simType = 'virtual26'): MutationResult => {
      const res = mutateAssignPlanBulk(stateRef.current, villageIds, plan);
      if (res.ok) {
        commitState(res.state, true);
        (res.updatedVillages || []).forEach((vil) => {
          syncAssignedPlanToCloud(vil, plan, simType).catch(() => {});
        });
      }
      return res;
    },
    [commitState]
  );

  const generateVirtualVillages = useCallback(
    (params: VirtualVillageBatchParams): MutationResult => {
      const res = mutateGenerateVirtualVillages(stateRef.current, params);
      if (res.ok) {
        commitState(res.state, true);
        if (params.assignedPlan) {
          (res.updatedVillages || []).forEach((vil) => {
            syncAssignedPlanToCloud(vil, params.assignedPlan || null, 'virtual26').catch(() => {});
          });
        }
      }
      return res;
    },
    [commitState]
  );

  const overrideDailySession = useCallback(
    (accountId: string, dateKey: string, startPP: number, lastSyncedPP: number, targetPP?: number): MutationResult => {
      const res = mutateOverrideDailySession(stateRef.current, accountId, dateKey, startPP, lastSyncedPP, targetPP);
      if (res.ok) commitState(res.state, true);
      return res;
    },
    [commitState]
  );

  const updateSettings = useCallback(
    (patch: {
      gameRules?: Partial<ErpGameRules>;
      finance?: Partial<ErpFinance>;
      upgradeBudgetPP?: number;
      simDiscountMode?: ErpAppState['simDiscountMode'];
    }): MutationResult => {
      const res = mutateUpdateSettings(stateRef.current, patch);
      if (res.ok) commitState(res.state, true);
      return res;
    },
    [commitState]
  );

  const applyIncomingSync = useCallback(
    (rawInput: string | Record<string, any>): SyncProcessResult => {
      const res = mutateApplyIncomingSync(stateRef.current, rawInput);
      if (res.ok && res.nextState) commitState(res.nextState, true);
      return res;
    },
    [commitState]
  );

  const importBackupJson = useCallback(
    (rawJson: string): MutationResult => {
      const res = mutateImportBackupJson(rawJson);
      if (res.ok) commitState(res.state, true);
      return res;
    },
    [commitState]
  );

  const resetWorkspace = useCallback(() => {
    const clean = mutateResetWorkspace();
    commitState(clean, true);
  }, [commitState]);

  const setActiveVillageId = useCallback(
    (villageId: string) => {
      if (stateRef.current.activeVillageId === villageId) return;
      const next = { ...stateRef.current, activeVillageId: villageId };
      commitState(next, false);
    },
    [commitState]
  );

  const getDashboardSummary = useCallback(() => {
    return fetchFirestoreDashboardSummary(stateRef.current);
  }, []);

  return {
    state,
    ready,
    syncStatus,
    commitState,
    refreshDataFromCloud,
    saveAccount,
    deleteAccount,
    saveVillage,
    setVillageRole,
    deleteVillage,
    saveWorld,
    setWorldTradeEnded,
    deleteWorld,
    updateContinentRates,
    assignVillagePlan,
    assignPlanBulk,
    generateVirtualVillages,
    overrideDailySession,
    updateSettings,
    applyIncomingSync,
    importBackupJson,
    exportBackupJson: () => exportStateBackupJson(stateRef.current),
    resetWorkspace,
    setActiveVillageId,
    getDashboardSummary
  };
}
