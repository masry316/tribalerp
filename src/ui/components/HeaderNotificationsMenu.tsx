import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Hammer,
  ShieldAlert,
  Swords,
  Warehouse,
  X,
  Zap
} from 'lucide-react';
import type { ErpAppState } from '../../core';
import {
  buildHeaderNotifications,
  countNotificationsByCategory,
  filterNotificationsByCategory,
  type NotificationCategory
} from '../viewModels';
import { BaseModal } from './modals/BaseModal';

interface HeaderNotificationsMenuProps {
  state: ErpAppState;
  navigate: (path: string) => void;
  compact?: boolean;
}

export function HeaderNotificationsMenu({
  state,
  navigate,
  compact = false
}: HeaderNotificationsMenuProps) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<NotificationCategory>('all');
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  const allNotifications = useMemo(() => buildHeaderNotifications(state), [state]);

  const activeItems = useMemo(
    () => allNotifications.filter((n) => !dismissedIds.includes(n.id)),
    [allNotifications, dismissedIds]
  );

  const counts = useMemo(() => countNotificationsByCategory(activeItems), [activeItems]);
  const criticalCount = useMemo(
    () => activeItems.filter((n) => n.severity === 'critical').length,
    [activeItems]
  );

  const visibleItems = useMemo(
    () => filterNotificationsByCategory(activeItems, category),
    [activeItems, category]
  );

  const badgeCount = activeItems.length;

  const filterTabs: Array<{ id: NotificationCategory; label: string; count: number }> = [
    { id: 'all', label: 'الكل', count: counts.all },
    { id: 'security', label: 'تضارب IP', count: counts.security },
    { id: 'warehouse', label: 'مخازن ممتلئة', count: counts.warehouse },
    { id: 'scav', label: 'إرسال إغارات', count: counts.scav },
    { id: 'other', label: 'خطط وبيع', count: counts.other }
  ];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="الإشعارات والتنبيهات"
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`nx-transition relative flex cursor-pointer items-center justify-center rounded-[var(--nx-radius-md)] border bg-[var(--nx-bg-surface)] text-[var(--nx-text-secondary)] hover:bg-[var(--nx-bg-hover)] ${
          compact ? 'h-10 w-10 border-transparent bg-transparent' : 'h-9 w-9 border-[var(--nx-border)]'
        } ${open ? 'border-[var(--nx-indigo)] bg-[var(--nx-indigo-soft)] text-[var(--nx-indigo)]' : ''}`}
      >
        <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
        {badgeCount > 0 && (
          <span
            className={`font-mono-num absolute flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[10px] leading-none font-bold text-white ${
              compact ? 'end-0.5 top-1' : '-end-1 -top-1'
            } ${criticalCount > 0 ? 'bg-[var(--nx-coral)]' : 'bg-[var(--nx-amber)]'}`}
          >
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
      </button>

      <BaseModal
        open={open}
        onClose={() => setOpen(false)}
        ariaLabel="قائمة الإشعارات والتنبيهات"
        closeButtonLabel="إغلاق الإشعارات"
        maxWidthClass="max-w-lg"
        bodyClassName="flex flex-1 flex-col overflow-hidden"
        icon={<Bell className="h-5 w-5" aria-hidden="true" />}
        title={
          <span className="inline-flex items-center gap-2">
            <span>الإشعارات والتنبيهات</span>
            {badgeCount > 0 && (
              <span className="font-mono-num rounded-[var(--nx-radius-xs)] bg-[var(--nx-indigo-soft)] px-2 py-0.5 text-xs font-bold text-[var(--nx-indigo)]">
                {badgeCount}
              </span>
            )}
          </span>
        }
        subtitle="تصفية سريعة حسب نوع الإجراء المطلوب الآن"
        headerActions={
          <div className="flex w-full flex-wrap items-center justify-between gap-2 text-xs">
            <div
              role="tablist"
              aria-label="تصفية الإشعارات حسب نوع الإجراء"
              className="flex flex-1 items-center gap-1 overflow-x-auto pb-0.5"
            >
              {filterTabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={category === t.id}
                  onClick={() => setCategory(t.id)}
                  className={`shrink-0 cursor-pointer whitespace-nowrap rounded-[var(--nx-radius-xs)] px-2.5 py-1 font-semibold transition-colors ${
                    category === t.id
                      ? 'bg-[var(--nx-bg-surface)] text-[var(--nx-indigo)] shadow-xs'
                      : 'text-[var(--nx-text-muted)] hover:text-[var(--nx-text-primary)]'
                  }`}
                >
                  {t.label} ({t.count})
                </button>
              ))}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {dismissedIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setDismissedIds([])}
                  className="cursor-pointer font-semibold text-[var(--nx-indigo)] hover:underline"
                >
                  استرجاع ({dismissedIds.length})
                </button>
              )}
              {activeItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setDismissedIds(allNotifications.map((n) => n.id))}
                  className="cursor-pointer font-medium text-[var(--nx-text-muted)] hover:text-[var(--nx-coral)]"
                >
                  تحديد كمقروء
                </button>
              )}
            </div>
          </div>
        }
        footer={
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate('/dashboard?urgent=1');
              }}
              className="cursor-pointer text-xs font-semibold text-[var(--nx-indigo)] hover:underline"
            >
              تصفية القرى الحرجة
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="nx-btn nx-btn-outline nx-btn-compact !min-h-[34px] !px-4 text-xs"
            >
              إغلاق
            </button>
          </div>
        }
      >
        {/* Notification Rows */}
        <div className="flex-1 divide-y divide-[var(--nx-border)] overflow-y-auto">
          {visibleItems.length === 0 ? (
            <div className="p-8 text-center text-sm text-[var(--nx-text-muted)]">
              <CheckCircle2 className="mx-auto mb-2 h-7 w-7 text-[var(--nx-emerald)]" aria-hidden="true" />
              <p className="font-semibold text-[var(--nx-text-primary)]">
                {category === 'all' ? 'لا توجد إشعارات جديدة' : 'لا توجد إشعارات ضمن هذا التصنيف'}
              </p>
              <p className="mt-1 text-xs">جميع الحسابات والقرى في وضع مستقر.</p>
            </div>
          ) : (
            visibleItems.map((item) => (
              <div
                key={item.id}
                className="nx-transition flex items-start gap-3 px-4 py-3 hover:bg-[var(--nx-bg-hover)]"
              >
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    item.severity === 'critical'
                      ? 'bg-[var(--nx-coral-bg)] text-[var(--nx-coral)]'
                      : 'bg-[var(--nx-amber-bg)] text-[var(--nx-amber)]'
                  }`}
                >
                  {item.kind === 'security' ? (
                    <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                  ) : item.kind === 'warehouse' ? (
                    <Warehouse className="h-4 w-4" aria-hidden="true" />
                  ) : item.kind === 'scav' ? (
                    <Swords className="h-4 w-4" aria-hidden="true" />
                  ) : item.kind === 'plan' ? (
                    <Hammer className="h-4 w-4" aria-hidden="true" />
                  ) : item.kind === 'market' ? (
                    <Zap className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    navigate(item.targetPath);
                  }}
                  className="min-w-0 flex-1 cursor-pointer text-start"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="truncate text-sm font-bold text-[var(--nx-text-primary)]">
                      {item.title}
                    </span>
                    <span className="font-mono-num shrink-0 text-xs text-[var(--nx-text-muted)]">
                      {item.timeText}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-xs font-medium text-[var(--nx-text-muted)]">
                    {item.subtitle}
                  </div>
                  <div className="mt-1 text-xs leading-relaxed text-[var(--nx-text-secondary)]">
                    {item.detail}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDismissedIds((prev) => [...prev, item.id])}
                  aria-label={`إخفاء إشعار ${item.title}`}
                  title="إخفاء"
                  className="mt-0.5 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded text-[var(--nx-text-muted)] hover:bg-[var(--nx-bg-muted)] hover:text-[var(--nx-coral)]"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ))
          )}
        </div>
      </BaseModal>
    </div>
  );
}
