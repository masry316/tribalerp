import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react';
import {
  BarChart2,
  Bell,
  ChevronsUpDown,
  Cloud,
  Compass,
  Download,
  Globe,
  LayoutDashboard,
  Menu,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  Sun,
  Users,
  X
} from 'lucide-react';
import {
  auditAccountsSecurity,
  computeVillageLiveStatus,
  type ErpAppState,
  type NavTabId,
  type SyncStatusState
} from '../../core';
import type { AppRoute } from '../router';
import { HeaderNotificationsMenu } from './HeaderNotificationsMenu';
import { hasOpenBaseModal } from './modals/BaseModal';
import { SyncErrorBanner } from './StateViews';

export interface ToastItem {
  id: string;
  message: string;
  tone: 'info' | 'success' | 'warn' | 'danger';
}

interface LayoutNavProps {
  state: ErpAppState;
  route: AppRoute;
  searchUrl: string;
  syncStatus: SyncStatusState;
  theme: 'dark' | 'light';
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onToggleTheme: () => void;
  navigate: (path: string) => void;
  onFilterChange: (worldId: string, device: string) => void;
  onOpenSyncModal: () => void;
  onRefreshData: () => Promise<void> | void;
  onOpenCreateVillage: () => void;
  onRetrySync?: () => void;
  toasts: ToastItem[];
  onDismissToast: (id: string) => void;
  children: ReactNode;
}

const MOBILE_TABS: Array<{ id: NavTabId; path: string; label: string; icon: ComponentType<{ className?: string }> }> = [
  { id: 'dashboard', path: '/dashboard', label: 'القيادة', icon: LayoutDashboard },
  { id: 'accounts', path: '/accounts', label: 'الحسابات', icon: Users },
  { id: 'planner', path: '/planner', label: 'المحاكي', icon: Compass },
  { id: 'reports', path: '/reports', label: 'التقارير', icon: BarChart2 },
  { id: 'settings', path: '/settings', label: 'الإعدادات', icon: Settings }
];

export function LayoutNav({
  state,
  route,
  searchUrl,
  syncStatus,
  theme,
  searchQuery,
  onSearchChange,
  onToggleTheme,
  navigate,
  onFilterChange,
  onOpenSyncModal,
  onRefreshData,
  onOpenCreateVillage,
  onRetrySync,
  toasts,
  onDismissToast,
  children
}: LayoutNavProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const isDark = theme === 'dark';
  const urlParams = useMemo(() => new URLSearchParams(searchUrl), [searchUrl]);
  const isUrgentDashboard = route.page === 'dashboard' && urlParams.get('urgent') === '1';
  const isSecurityReport = route.page === 'reports' && urlParams.get('tab') === 'security';

  const [installPrompt, setInstallPrompt] = useState<{
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: string }>;
  } | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        if (searchInputRef.current) {
          e.preventDefault();
          searchInputRef.current.focus();
        }
      } else if (e.key === 'Escape' && !hasOpenBaseModal()) {
        setMobileDrawerOpen(false);
      }
    };
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as unknown as { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> });
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    };
  }, []);

  async function handleInstallClick() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setInstallPrompt(null);
    }
  }

  const urgentCount = useMemo(() => {
    const nowMs = Date.now();
    const closedWorldIds = new Set(state.worlds.filter((w) => w.tradeEnded).map((w) => w.id));
    return state.villages.filter((v) => {
      if (closedWorldIds.has(v.worldId)) return false;
      if (state.selectedWorldFilter !== 'all' && v.worldId !== state.selectedWorldFilter) return false;
      const live = computeVillageLiveStatus(v, state, nowMs);
      return live.status !== 'safe';
    }).length;
  }, [state]);

  const ipCollisionCount = useMemo(() => auditAccountsSecurity(state).length, [state]);

  const selectedWorldObj = useMemo(
    () => state.worlds.find((w) => w.id === state.selectedWorldFilter) || null,
    [state.worlds, state.selectedWorldFilter]
  );

  const renderNavButton = (
    id: string,
    label: string,
    Icon: ComponentType<{ className?: string }>,
    active: boolean,
    onClick: () => void,
    badge?: number | string | null,
    badgeTone: 'neutral' | 'danger' | 'indigo' = 'neutral'
  ) => (
    <button
      key={id}
      type="button"
      onClick={onClick}
      title={sidebarCollapsed ? label : undefined}
      aria-current={active ? 'page' : undefined}
      className={`nx-transition flex min-h-[44px] w-full cursor-pointer items-center justify-between gap-2.5 rounded-[var(--nx-radius-md)] px-3 text-[13.5px] font-medium lg:min-h-[38px] ${
        active
          ? 'bg-[var(--nx-bg-active)] font-semibold text-[var(--nx-text-primary)]'
          : 'text-[var(--nx-text-secondary)] hover:bg-[var(--nx-bg-hover)] hover:text-[var(--nx-text-primary)]'
      } ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <Icon
          className={`h-[18px] w-[18px] shrink-0 ${
            active ? 'text-[var(--nx-indigo)]' : 'text-[var(--nx-text-muted)]'
          }`}
          aria-hidden="true"
        />
        {!sidebarCollapsed && <span className="truncate">{label}</span>}
      </span>

      {!sidebarCollapsed && badge !== null && badge !== undefined && badge !== 0 && (
        <span
          className={`font-mono-num min-w-[20px] rounded-[var(--nx-radius-xs)] px-1.5 py-0.5 text-center text-[11px] font-bold ${
            badgeTone === 'danger'
              ? 'bg-[var(--nx-coral-bg)] text-[var(--nx-coral)]'
              : badgeTone === 'indigo'
                ? 'bg-[var(--nx-indigo-soft)] text-[var(--nx-indigo)]'
                : 'bg-[var(--nx-bg-muted)] text-[var(--nx-text-secondary)]'
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );

  return (
    <div dir="rtl" className="flex min-h-screen bg-[var(--nx-bg-canvas)] text-[var(--nx-text-primary)]">
      {/* Desktop Crisp White Sidebar */}
      <aside
        className={`nx-transition sticky top-0 hidden h-screen shrink-0 flex-col border-e border-[var(--nx-border)] bg-[var(--nx-bg-surface)] lg:flex ${
          sidebarCollapsed ? 'w-[74px]' : 'w-[244px]'
        }`}
      >
        <div
          className={`flex h-[56px] items-center border-b border-[var(--nx-border)] px-3 ${
            sidebarCollapsed ? 'justify-center' : 'justify-between'
          }`}
        >
          {!sidebarCollapsed && (
            <span className="px-1 text-xs font-bold tracking-wide text-[var(--nx-text-muted)]">
              التنقل
            </span>
          )}
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            aria-label={sidebarCollapsed ? 'توسيع القائمة الجانبية' : 'طي القائمة الجانبية'}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[var(--nx-radius-sm)] border border-[var(--nx-border)] text-[var(--nx-text-muted)] hover:bg-[var(--nx-bg-hover)] hover:text-[var(--nx-text-primary)]"
          >
            {sidebarCollapsed ? (
              <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
            ) : (
              <PanelRightClose className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="التنقل الرئيسي">
          <div className="space-y-1">
            {!sidebarCollapsed && (
              <div className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-[var(--nx-text-subtle)] uppercase">
                عام
              </div>
            )}
            {renderNavButton(
              'dashboard',
              'لوحة القيادة',
              LayoutDashboard,
              route.page === 'dashboard' && !isUrgentDashboard,
              () => navigate('/dashboard')
            )}
            {renderNavButton(
              'accounts',
              'الحسابات والقرى',
              Users,
              route.page === 'accounts' || route.page === 'account_flow',
              () => navigate('/accounts'),
              state.userAccounts.length
            )}
            {renderNavButton(
              'urgent',
              'التنبيهات الحرجة',
              Bell,
              isUrgentDashboard,
              () => navigate('/dashboard?urgent=1'),
              urgentCount > 0 ? urgentCount : null,
              urgentCount > 0 ? 'danger' : 'neutral'
            )}
          </div>

          <div className="space-y-1">
            {!sidebarCollapsed && (
              <div className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-[var(--nx-text-subtle)] uppercase">
                الأدوات
              </div>
            )}
            {renderNavButton(
              'planner',
              'المخطط والمحاكي',
              Compass,
              route.page === 'planner',
              () => navigate('/planner'),
              'ذكي',
              'indigo'
            )}
            {renderNavButton(
              'reports',
              'التقارير والتحليل',
              BarChart2,
              route.page === 'reports' && !isSecurityReport,
              () => navigate('/reports')
            )}
          </div>

          <div className="space-y-1">
            {!sidebarCollapsed && (
              <div className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-[var(--nx-text-subtle)] uppercase">
                الإدارة والأمان
              </div>
            )}
            {renderNavButton(
              'settings',
              'الإعدادات والأسعار',
              Settings,
              route.page === 'settings',
              () => navigate('/settings')
            )}
            {renderNavButton(
              'security',
              'تدقيق الـ IP والأمان',
              ShieldAlert,
              isSecurityReport,
              () => navigate('/reports?tab=security'),
              ipCollisionCount > 0 ? ipCollisionCount : null,
              ipCollisionCount > 0 ? 'danger' : 'neutral'
            )}
          </div>
        </nav>

        <div className="space-y-2.5 border-t border-[var(--nx-border)] p-3">
          {!sidebarCollapsed && (
            <div className="relative flex items-center gap-2.5 rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] p-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--nx-radius-sm)] bg-[var(--nx-teal)] text-white">
                <Globe className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] text-[var(--nx-text-muted)]">النطاق النشط</div>
                <div className="truncate text-[13px] font-bold text-[var(--nx-text-primary)]">
                  {selectedWorldObj
                    ? `${selectedWorldObj.name}${selectedWorldObj.tradeEnded ? ' (منتهي)' : ''}`
                    : 'كل العوالم'}
                </div>
              </div>
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-[var(--nx-text-muted)]" aria-hidden="true" />
              <select
                aria-label="تغيير العالم النشط"
                value={state.selectedWorldFilter}
                onChange={(e) => onFilterChange(e.target.value, state.selectedDeviceFilter)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              >
                <option value="all">كل العوالم ({state.villages.length} قرية)</option>
                {state.worlds.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.speed}x){w.tradeEnded ? ' — انتهت التجارة' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {installPrompt && (
            <button
              type="button"
              onClick={handleInstallClick}
              className="nx-btn nx-btn-primary nx-btn-compact w-full justify-center"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              {!sidebarCollapsed && <span>تثبيت التطبيق (PWA)</span>}
            </button>
          )}

          <button
            type="button"
            disabled={syncStatus.status === 'syncing'}
            onClick={() => void onRefreshData()}
            title="تحديث الداتا من السحابة يدوياً"
            className="nx-btn nx-btn-primary nx-btn-compact w-full justify-center"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${syncStatus.status === 'syncing' ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            {!sidebarCollapsed && (
              <span>{syncStatus.status === 'syncing' ? 'جاري التحديث...' : 'تحديث الداتا'}</span>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenSyncModal}
            className="nx-btn nx-btn-outline nx-btn-compact w-full justify-center"
          >
            <Cloud className="h-3.5 w-3.5" aria-hidden="true" />
            {!sidebarCollapsed && <span>مركز المزامنة السحابية</span>}
          </button>

          {!sidebarCollapsed && (
            <div className="pt-0.5 text-center text-[11px] text-[var(--nx-text-subtle)]">
              حرب القبائل <bdi dir="ltr">ERP</bdi> · {state.userAccounts.length} حساب ·{' '}
              {state.villages.length} قرية
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Desktop 64px Top Header */}
        <header className="sticky top-0 z-30 hidden h-[64px] shrink-0 items-center justify-between gap-4 border-b border-[var(--nx-border)] bg-[var(--nx-bg-surface)] px-6 lg:flex">
          <div className="relative w-96 max-w-full">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--nx-text-muted)]"
              aria-hidden="true"
            />
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="بحث في القرى أو الحسابات..."
              className="nx-transition h-9 w-full rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] ps-9 pe-16 text-sm text-[var(--nx-text-primary)] placeholder:text-[var(--nx-text-subtle)] focus:border-[var(--nx-indigo)] focus:bg-[var(--nx-bg-surface)] focus:outline-none"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="مسح البحث"
                className="absolute end-2 top-1/2 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-[var(--nx-text-muted)] hover:text-[var(--nx-text-primary)]"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : (
              <kbd className="font-mono-num pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 rounded border border-[var(--nx-border)] bg-[var(--nx-bg-surface)] px-1.5 py-0.5 text-[11px] text-[var(--nx-text-muted)]">
                ⌘F
              </kbd>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={isDark ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن'}
              className="nx-transition flex h-9 w-9 cursor-pointer items-center justify-center rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] bg-[var(--nx-bg-surface)] text-[var(--nx-text-secondary)] hover:bg-[var(--nx-bg-hover)]"
            >
              {isDark ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
            </button>

            <HeaderNotificationsMenu state={state} navigate={navigate} />

            <div className="mx-1 h-6 w-px bg-[var(--nx-border)]" />

            <button
              type="button"
              disabled={syncStatus.status === 'syncing'}
              onClick={() => void onRefreshData()}
              aria-label="تحديث الداتا من السحابة"
              title="سحب أحدث البيانات من Firestore يدوياً"
              className="nx-btn nx-btn-primary nx-btn-compact"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${syncStatus.status === 'syncing' ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>{syncStatus.status === 'syncing' ? 'جاري التحديث...' : 'تحديث الداتا'}</span>
            </button>

            <button
              type="button"
              onClick={onOpenSyncModal}
              aria-label="مركز المزامنة السحابية والربط السريع"
              className="nx-transition flex cursor-pointer items-center gap-2.5 rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] bg-[var(--nx-bg-surface)] px-2.5 py-1 hover:bg-[var(--nx-bg-hover)]"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--nx-radius-sm)] bg-[var(--nx-indigo-soft)] text-[var(--nx-indigo)]">
                <Cloud className="h-3.5 w-3.5" aria-hidden="true" />
              </div>
              <div className="text-start leading-tight">
                <div className="text-[12.5px] font-semibold text-[var(--nx-text-primary)]">
                  المزامنة والربط
                </div>
                <div className="text-[11px] text-[var(--nx-text-muted)]">
                  {syncStatus.status === 'syncing'
                    ? 'جاري المزامنة...'
                    : syncStatus.status === 'error'
                      ? 'تعذر الاتصال'
                      : syncStatus.source === 'firestore'
                        ? 'محدّث سحابياً'
                        : 'محفوظ محلياً'}
                </div>
              </div>
            </button>
          </div>
        </header>

        {/* Mobile Compact Header (52px clean ergonomic bar — Menu at far RTL start edge) */}
        <header className="sticky top-0 z-30 border-b border-[var(--nx-border)] bg-[var(--nx-bg-surface)] px-2.5 lg:hidden">
          <div className="flex h-[52px] items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <button
                type="button"
                data-testid="mobile-menu-btn"
                onClick={() => setMobileDrawerOpen(true)}
                aria-label="فتح القائمة الجانبية"
                aria-expanded={mobileDrawerOpen}
                className="relative flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-[var(--nx-radius-md)] text-[var(--nx-text-primary)] hover:bg-[var(--nx-bg-hover)]"
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
                {urgentCount + ipCollisionCount > 0 && (
                  <span className="absolute end-2 top-2 h-2 w-2 rounded-full bg-[var(--nx-coral)]" />
                )}
              </button>

              <div className="min-w-0 leading-tight">
                <div className="truncate text-xs font-bold text-[var(--nx-text-primary)]">
                  {selectedWorldObj
                    ? `${selectedWorldObj.name} (${selectedWorldObj.speed}x)`
                    : 'كل العوالم'}
                </div>
                {selectedWorldObj?.tradeEnded && (
                  <div className="truncate text-[10px] font-semibold text-[var(--nx-coral)]">
                    انتهت التجارة
                  </div>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                onClick={() => setMobileSearchOpen((o) => !o)}
                aria-label="بحث"
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-[var(--nx-radius-md)] text-[var(--nx-text-secondary)] hover:bg-[var(--nx-bg-hover)]"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
              </button>
              <HeaderNotificationsMenu state={state} navigate={navigate} compact />
              <button
                type="button"
                disabled={syncStatus.status === 'syncing'}
                onClick={() => void onRefreshData()}
                aria-label="تحديث الداتا"
                title="تحديث الداتا من السحابة"
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-[var(--nx-radius-md)] text-[var(--nx-indigo)] hover:bg-[var(--nx-bg-hover)] disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-4 w-4 ${syncStatus.status === 'syncing' ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>

          {mobileSearchOpen && (
            <div className="flex items-center gap-2 pb-2.5">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="بحث في القرى أو الحسابات..."
                className="nx-input w-full text-sm"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="nx-btn nx-btn-outline shrink-0 !px-3"
                >
                  مسح
                </button>
              )}
            </div>
          )}
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 space-y-4 px-3 pb-24 pt-4 sm:px-6 sm:pt-5 lg:pb-8">
          {syncStatus.status === 'error' && (
            <SyncErrorBanner message={syncStatus.errorMessage} onRetry={onRetrySync} />
          )}
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="التنقل السفلي"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[var(--nx-border)] bg-[var(--nx-bg-surface)] px-1 py-1 lg:hidden"
        style={{ paddingBottom: 'max(4px, env(safe-area-inset-bottom))' }}
      >
        {MOBILE_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = route.tab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => navigate(tab.path)}
              aria-current={active ? 'page' : undefined}
              className={`nx-transition flex min-h-[48px] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[var(--nx-radius-sm)] text-[11px] font-medium ${
                active
                  ? 'bg-[var(--nx-indigo-soft)] font-semibold text-[var(--nx-indigo)]'
                  : 'text-[var(--nx-text-muted)]'
              }`}
            >
              <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Mobile Slide-Out Navigation Drawer */}
      {mobileDrawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="قائمة التنقل"
          className="fixed inset-0 z-[80] flex lg:hidden"
        >
          <div
            onPointerDown={(e) => {
              if (e.isPrimary === false) return;
              setMobileDrawerOpen(false);
            }}
            className="fixed inset-0 bg-black/50 backdrop-blur-[1px]"
          />
          <aside className="relative z-10 flex h-full w-72 max-w-[85vw] flex-col border-e border-[var(--nx-border)] bg-[var(--nx-bg-surface)] shadow-xl">
            <div className="flex h-[54px] items-center justify-between border-b border-[var(--nx-border)] px-4">
              <span className="text-sm font-bold text-[var(--nx-text-primary)]">القائمة</span>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                aria-label="إغلاق القائمة الجانبية"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[var(--nx-radius-sm)] border border-[var(--nx-border)] text-[var(--nx-text-secondary)] hover:bg-[var(--nx-bg-hover)]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4" aria-label="قائمة الهاتف">
              <div className="space-y-1">
                {renderNavButton(
                  'mob_dashboard',
                  'لوحة القيادة',
                  LayoutDashboard,
                  route.page === 'dashboard' && !isUrgentDashboard,
                  () => {
                    navigate('/dashboard');
                    setMobileDrawerOpen(false);
                  }
                )}
                {renderNavButton(
                  'mob_accounts',
                  'الحسابات والقرى',
                  Users,
                  route.page === 'accounts' || route.page === 'account_flow',
                  () => {
                    navigate('/accounts');
                    setMobileDrawerOpen(false);
                  },
                  state.userAccounts.length
                )}
                {renderNavButton(
                  'mob_urgent',
                  'التنبيهات الحرجة',
                  Bell,
                  isUrgentDashboard,
                  () => {
                    navigate('/dashboard?urgent=1');
                    setMobileDrawerOpen(false);
                  },
                  urgentCount > 0 ? urgentCount : null,
                  urgentCount > 0 ? 'danger' : 'neutral'
                )}
                {renderNavButton(
                  'mob_planner',
                  'المخطط والمحاكي',
                  Compass,
                  route.page === 'planner',
                  () => {
                    navigate('/planner');
                    setMobileDrawerOpen(false);
                  },
                  'ذكي',
                  'indigo'
                )}
                {renderNavButton(
                  'mob_reports',
                  'التقارير والتحليل',
                  BarChart2,
                  route.page === 'reports' && !isSecurityReport,
                  () => {
                    navigate('/reports');
                    setMobileDrawerOpen(false);
                  }
                )}
                {renderNavButton(
                  'mob_settings',
                  'الإعدادات والأسعار',
                  Settings,
                  route.page === 'settings',
                  () => {
                    navigate('/settings');
                    setMobileDrawerOpen(false);
                  }
                )}
                {renderNavButton(
                  'mob_security',
                  'تدقيق الـ IP والأمان',
                  ShieldAlert,
                  isSecurityReport,
                  () => {
                    navigate('/reports?tab=security');
                    setMobileDrawerOpen(false);
                  },
                  ipCollisionCount > 0 ? ipCollisionCount : null,
                  ipCollisionCount > 0 ? 'danger' : 'neutral'
                )}
              </div>
            </nav>

            <div className="space-y-2.5 border-t border-[var(--nx-border)] p-3">
              <div>
                <label htmlFor="mobile-world-filter" className="mb-1 block text-[11px] font-semibold text-[var(--nx-text-muted)]">
                  النطاق النشط
                </label>
                <select
                  id="mobile-world-filter"
                  value={state.selectedWorldFilter}
                  onChange={(e) => onFilterChange(e.target.value, state.selectedDeviceFilter)}
                  className="nx-select py-1.5 text-xs"
                >
                  <option value="all">كل العوالم ({state.villages.length} قرية)</option>
                  {state.worlds.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.speed}x){w.tradeEnded ? ' — انتهت التجارة' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {installPrompt && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileDrawerOpen(false);
                    void handleInstallClick();
                  }}
                  className="nx-btn nx-btn-primary nx-btn-compact w-full justify-center"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>تثبيت التطبيق (PWA)</span>
                </button>
              )}

              <button
                type="button"
                disabled={syncStatus.status === 'syncing'}
                onClick={() => {
                  setMobileDrawerOpen(false);
                  void onRefreshData();
                }}
                className="nx-btn nx-btn-primary nx-btn-compact w-full justify-center"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${syncStatus.status === 'syncing' ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                <span>{syncStatus.status === 'syncing' ? 'جاري التحديث...' : 'تحديث الداتا'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMobileDrawerOpen(false);
                  onOpenSyncModal();
                }}
                className="nx-btn nx-btn-outline nx-btn-compact w-full justify-center"
              >
                <Cloud className="h-3.5 w-3.5" aria-hidden="true" />
                <span>مركز المزامنة السحابية</span>
              </button>

              <button
                type="button"
                onClick={onToggleTheme}
                className="nx-btn nx-btn-outline nx-btn-compact w-full justify-center"
              >
                {isDark ? <Sun className="h-3.5 w-3.5" aria-hidden="true" /> : <Moon className="h-3.5 w-3.5" aria-hidden="true" />}
                <span>{isDark ? 'الوضع الفاتح' : 'الوضع الداكن'}</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Toasts / Top Notifications Drawer */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="pointer-events-none fixed top-16 end-3 start-3 z-50 mx-auto max-w-lg space-y-2 sm:start-auto sm:end-6 sm:w-96"
        >
          <div className="pointer-events-auto flex items-center justify-between gap-2 rounded-t-[var(--nx-radius-md)] border-x border-t border-[var(--nx-border)] bg-[var(--nx-bg-surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--nx-text-primary)] shadow-sm">
            <span className="flex items-center gap-1.5">
              <Bell className="h-3.5 w-3.5 text-[var(--nx-indigo)]" aria-hidden="true" />
              <span>الإشعارات الفورية ({toasts.length})</span>
            </span>
            <button
              type="button"
              onClick={() => {
                toasts.forEach((t) => onDismissToast(t.id));
              }}
              className="text-[11px] font-medium text-[var(--nx-text-muted)] hover:text-[var(--nx-coral)] cursor-pointer"
            >
              مسح الكل
            </button>
          </div>

          <div className="pointer-events-auto space-y-2 max-h-[60vh] overflow-y-auto rounded-b-[var(--nx-radius-md)] border border-[var(--nx-border)] bg-[var(--nx-bg-surface)] p-2 shadow-[var(--nx-shadow-float)]">
            {toasts.map((t) => (
              <div
                key={t.id}
                className={`flex items-center justify-between gap-2 rounded-[var(--nx-radius-sm)] border px-3 py-2 text-xs font-semibold ${
                  t.tone === 'success'
                    ? 'border-[var(--nx-emerald-border)] bg-[var(--nx-emerald-bg)] text-[var(--nx-emerald)]'
                    : t.tone === 'danger'
                      ? 'border-[var(--nx-coral-border)] bg-[var(--nx-coral-bg)] text-[var(--nx-coral)]'
                      : t.tone === 'warn'
                        ? 'border-[var(--nx-amber-border)] bg-[var(--nx-amber-bg)] text-[var(--nx-amber)]'
                        : 'border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] text-[var(--nx-text-primary)]'
                }`}
              >
                <span className="leading-snug">{t.message}</span>
                <button
                  type="button"
                  onClick={() => onDismissToast(t.id)}
                  aria-label="إغلاق الإشعار"
                  className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded hover:opacity-75"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
