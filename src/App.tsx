import { useCallback, useEffect, useState, type MouseEvent } from 'react';
import { computeFirestoreDashboardSummary, type SessionLogEntry } from './core';
import { useErpWorkspace } from './data';
import { LayoutNav, type ToastItem } from './ui/components/LayoutNav';
import { DashboardSkeleton } from './ui/components/StateViews';
import { BTN_PRIMARY_CLS, SURFACE_CLS } from './ui/components/UiPrimitives';
import { AccountModal } from './ui/components/modals/AccountModal';
import { AccountPPFlowModal } from './ui/components/modals/AccountPPFlowModal';
import { SyncModal } from './ui/components/modals/SyncModal';
import { VillageModal } from './ui/components/modals/VillageModal';
import { AccountFlowPage } from './ui/pages/AccountFlowPage';
import { AccountsPage } from './ui/pages/AccountsPage';
import { DashboardPage } from './ui/pages/DashboardPage';
import { PlannerPage } from './ui/pages/PlannerPage';
import { ReportsPage } from './ui/pages/ReportsPage';
import { SettingsPage } from './ui/pages/SettingsPage';
import { VillageDetailPage } from './ui/pages/VillageDetailPage';
import { useAppRouter } from './ui/router';

export function App() {
  const {
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
    exportBackupJson,
    resetWorkspace,
    setActiveVillageId
  } = useErpWorkspace();

  const { route, search, navigate } = useAppRouter();
  const summary = computeFirestoreDashboardSummary({ erpState: state, syncStatus });

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    }
    return 'light';
  });

  const [fontSize, setFontSize] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem('tw_erp_font_size'));
      if (Number.isFinite(saved) && saved >= 13 && saved <= 18) return saved;
    } catch {
      // Ignore storage failures
    }
    return 15;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [accountModal, setAccountModal] = useState<{
    open: boolean;
    creating: boolean;
    accountId: string | null;
  }>({ open: false, creating: false, accountId: null });
  const [villageModal, setVillageModal] = useState<{
    open: boolean;
    creating: boolean;
    villageId: string | null;
  }>({ open: false, creating: false, villageId: null });
  const [missionVillageId, setMissionVillageId] = useState<string | null>(null);
  const [ppFlowAccountId, setPpFlowAccountId] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem('tw_erp_theme', theme);
    } catch {
      // Ignore storage failures
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`;
    try {
      localStorage.setItem('tw_erp_font_size', String(fontSize));
    } catch {
      // Ignore storage failures
    }
  }, [fontSize]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (message: string, tone: ToastItem['tone'] = 'info') => {
      const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { id, message, tone }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    []
  );

  function handleFilterChange(worldId: string, device: string) {
    if (
      state.selectedWorldFilter === worldId &&
      state.selectedDeviceFilter === device
    ) {
      return;
    }
    commitState(
      {
        ...state,
        selectedWorldFilter: worldId,
        selectedDeviceFilter: device
      },
      false
    );
  }

  const handleLogSession = useCallback(
    (entry: SessionLogEntry) => {
      const nextLogs = [entry, ...(state.sessionLogs || [])].slice(0, 300);
      commitState({ ...state, sessionLogs: nextLogs }, true);
      pushToast(`تم حفظ جلسة عمل (${entry.accountName}) بنجاح`, 'success');
    },
    [state, commitState, pushToast]
  );


  function handleExportBackup() {
    try {
      const json = exportBackupJson();
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tribal-wars-erp-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      pushToast('تم تصدير النسخة الاحتياطية بنجاح', 'success');
    } catch {
      pushToast('تعذر تصدير النسخة الاحتياطية', 'danger');
    }
  }

  async function handleForceCloudSync() {
    await commitState(state, true);
    pushToast('تم حفظ ورفع البيانات للسحابة بنجاح', 'success');
  }

  async function handleRefreshData() {
    const res = await refreshDataFromCloud();
    if (!res.ok) {
      pushToast(res.errorMessage || 'تعذر تحديث البيانات من السحابة — البيانات المحلية محفوظة', 'warn');
      return;
    }
    if (res.appliedSyncsCount > 0) {
      pushToast(`تم تحديث الداتا وتطبيق ${res.appliedSyncsCount} مزامنة جديدة من اللعبة`, 'success');
    } else {
      pushToast('تم تحديث الداتا من السحابة وحفظها محلياً بنجاح', 'success');
    }
  }

  function handleNotFoundLink(e: MouseEvent<HTMLAnchorElement>, path: string) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    navigate(path);
  }

  return (
    <LayoutNav
      state={state}
      route={route}
      searchUrl={search}
      syncStatus={syncStatus}
      theme={theme}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
      navigate={navigate}
      onFilterChange={handleFilterChange}
      onOpenSyncModal={() => setSyncModalOpen(true)}
      onRefreshData={handleRefreshData}
      onOpenCreateVillage={() =>
        setVillageModal({ open: true, creating: true, villageId: null })
      }
      onRetrySync={() => void handleRefreshData()}
      toasts={toasts}
      onDismissToast={dismissToast}
    >
      {!ready && state.userAccounts.length === 0 ? (
        <DashboardSkeleton />
      ) : (
        <>
          {route.page === 'dashboard' ? (
            <DashboardPage
              state={state}
              summary={summary}
              syncStatus={syncStatus}
              searchQuery={searchQuery}
              searchUrl={search}
              navigate={navigate}
              onFilterChange={handleFilterChange}
              onRefreshData={handleRefreshData}
              onSelectActiveVillage={setActiveVillageId}
              onSetVillageRole={(villageId, role) => {
                const res = setVillageRole(villageId, role);
                if (res.ok) {
                  const roleLabel =
                    role === 'offense' ? 'هجوم (أحمر)' : role === 'defense' ? 'دفاع (أزرق)' : 'غير محددة (أصفر)';
                  pushToast(`تم تحديث نوع القرية إلى ${roleLabel}`, 'success');
                }
              }}
              onOpenAccountModal={(accountId) =>
                setAccountModal({ open: true, creating: false, accountId })
              }
              onOpenVillageModal={(villageId) =>
                setVillageModal({ open: true, creating: false, villageId })
              }
              onOpenCreateVillage={() =>
                setVillageModal({ open: true, creating: true, villageId: null })
              }
              onOpenMissionModal={(villageId) => setMissionVillageId(villageId)}
              onOpenPPFlowModal={(accountId) => setPpFlowAccountId(accountId)}
              onOpenSyncModal={() => setSyncModalOpen(true)}
              onExportBackup={handleExportBackup}
              onPushToast={pushToast}
              onLogSession={handleLogSession}
            />
          ) : null}

          {route.page === 'accounts' ? (
            <AccountsPage
              state={state}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              navigate={navigate}
              onOpenCreateAccount={() =>
                setAccountModal({ open: true, creating: true, accountId: null })
              }
              onOpenAccountModal={(accountId) =>
                setAccountModal({ open: true, creating: false, accountId })
              }
              onOpenCreateVillage={() =>
                setVillageModal({ open: true, creating: true, villageId: null })
              }
              onOpenVillageModal={(villageId) =>
                setVillageModal({ open: true, creating: false, villageId })
              }
              onOpenMissionModal={(villageId) => setMissionVillageId(villageId)}
              onOpenPPFlowModal={(accountId) => setPpFlowAccountId(accountId)}
              onOpenSyncModal={() => setSyncModalOpen(true)}
              onSaveAccount={saveAccount}
              onGenerateVirtualVillages={generateVirtualVillages}
              onPushToast={pushToast}
            />
          ) : null}

          {route.page === 'account_flow' ? (
            <AccountFlowPage
              accountId={route.accountId}
              state={state}
              navigate={navigate}
              onOverrideDailySession={overrideDailySession}
            />
          ) : null}

          {route.page === 'village_detail' ? (
            <VillageDetailPage
              villageId={route.villageId}
              state={state}
              navigate={navigate}
              onAssignPlan={assignVillagePlan}
            />
          ) : null}

          {route.page === 'planner' ? (
            <PlannerPage
              state={state}
              searchUrl={search}
              navigate={navigate}
              onAssignPlan={assignVillagePlan}
              onAssignPlanBulk={assignPlanBulk}
              onGenerateVirtualVillages={generateVirtualVillages}
              onPushToast={pushToast}
            />
          ) : null}

          {route.page === 'reports' ? (
            <ReportsPage
              state={state}
              searchUrl={search}
              navigate={navigate}
              onSaveWorld={saveWorld}
              onPushToast={pushToast}
              onOpenPPFlowModal={(accountId) => setPpFlowAccountId(accountId)}
              onOpenAccountModal={(accountId) =>
                setAccountModal({ open: true, creating: false, accountId })
              }
              onOpenVillageModal={(villageId) =>
                setVillageModal({ open: true, creating: false, villageId })
              }
            />
          ) : null}

          {route.page === 'settings' ? (
            <SettingsPage
              state={state}
              theme={theme}
              fontSize={fontSize}
              onChangeTheme={setTheme}
              onChangeFontSize={setFontSize}
              onSaveWorld={saveWorld}
              onSetWorldTradeEnded={setWorldTradeEnded}
              onDeleteWorld={deleteWorld}
              onUpdateContinentRates={updateContinentRates}
              onUpdateSettings={updateSettings}
              onExportBackup={handleExportBackup}
              onImportBackupJson={importBackupJson}
              onResetWorkspace={resetWorkspace}
              onRefreshData={handleRefreshData}
              onForceCloudSync={handleForceCloudSync}
              onOpenSyncModal={() => setSyncModalOpen(true)}
              onPushToast={pushToast}
            />
          ) : null}

          {route.page === 'not_found' ? (
            <main className={`${SURFACE_CLS} p-10 text-center`}>
              <h2 className="text-xl font-bold text-[var(--nx-text-primary)]">
                الصفحة غير موجودة
              </h2>
              <p className="mt-2 text-sm text-[var(--nx-text-muted)]">
                المسار المطلوب (<span dir="ltr" className="font-mono">{route.rawPath}</span>) غير معرف في النظام.
              </p>
              <div className="mt-6">
                <a
                  href="/dashboard"
                  onClick={(e) => handleNotFoundLink(e, '/dashboard')}
                  className={BTN_PRIMARY_CLS}
                >
                  العودة إلى لوحة القيادة
                </a>
              </div>
            </main>
          ) : null}
        </>
      )}

      {/* Interactive Modals */}
      <SyncModal
        open={syncModalOpen}
        syncStatus={syncStatus}
        onClose={() => setSyncModalOpen(false)}
        onRefreshData={handleRefreshData}
        onForceCloudSync={handleForceCloudSync}
        onApplyIncomingSync={applyIncomingSync}
        onPushToast={pushToast}
      />

      <AccountModal
        open={accountModal.open}
        creating={accountModal.creating}
        editingAccountId={accountModal.accountId}
        state={state}
        onClose={() => setAccountModal({ open: false, creating: false, accountId: null })}
        onSaveAccount={saveAccount}
        onDeleteAccount={deleteAccount}
        onPushToast={pushToast}
      />

      <VillageModal
        creatingVillage={villageModal.creating}
        editingVillageId={villageModal.villageId}
        missionVillageId={missionVillageId}
        state={state}
        onCloseEdit={() => setVillageModal({ open: false, creating: false, villageId: null })}
        onCloseMission={() => setMissionVillageId(null)}
        onSaveVillage={saveVillage}
        onDeleteVillage={deleteVillage}
        onAssignPlan={assignVillagePlan}
        onOpenVillageDetail={(vid) => navigate(`/villages/${encodeURIComponent(vid)}`)}
        onPushToast={pushToast}
      />

      <AccountPPFlowModal
        accountId={ppFlowAccountId}
        state={state}
        onClose={() => setPpFlowAccountId(null)}
        onOpenAccountModal={(accountId) =>
          setAccountModal({ open: true, creating: false, accountId })
        }
        onOpenVillageModal={(villageId) =>
          setVillageModal({ open: true, creating: false, villageId })
        }
        onOpenAccountFlowPage={(accountId) =>
          navigate(`/accounts/${encodeURIComponent(accountId)}`)
        }
        onOverrideDailySession={overrideDailySession}
        onPushToast={pushToast}
      />
    </LayoutNav>
  );
}

export default App;
