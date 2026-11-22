import type { ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  DatabaseZap,
  RefreshCw
} from 'lucide-react';

interface DeltaBadgeProps {
  label: string;
  direction?: 'up' | 'down' | 'neutral';
  className?: string;
}

export function DeltaBadge({ label, direction = 'up', className = '' }: DeltaBadgeProps) {
  if (direction === 'down') {
    return (
      <span className={`nx-delta-neg ${className}`}>
        <span>{label}</span>
        <ArrowDownRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      </span>
    );
  }
  if (direction === 'neutral') {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-[var(--nx-radius-xs)] bg-[var(--nx-bg-subtle)] px-2 py-0.5 text-xs font-semibold text-[var(--nx-text-secondary)] ${className}`}
      >
        <span>{label}</span>
      </span>
    );
  }
  return (
    <span className={`nx-delta-pos ${className}`}>
      <span>{label}</span>
      <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    </span>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="جاري تحميل البيانات">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="nx-skeleton h-8 w-44" />
        <div className="flex items-center gap-2">
          <div className="nx-skeleton h-9 w-28" />
          <div className="nx-skeleton h-9 w-24" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="nx-card space-y-3 p-4">
            <div className="nx-skeleton h-4 w-32" />
            <div className="nx-skeleton h-8 w-28" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="nx-card space-y-4 p-5 lg:col-span-7">
          <div className="nx-skeleton h-5 w-44" />
          <div className="nx-skeleton h-8 w-36" />
          <div className="nx-skeleton h-48 w-full" />
        </div>
        <div className="nx-card space-y-4 p-5 lg:col-span-5">
          <div className="nx-skeleton h-5 w-40" />
          <div className="nx-skeleton h-8 w-32" />
          <div className="nx-skeleton h-48 w-full" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="nx-card space-y-4 p-5 lg:col-span-5">
          <div className="nx-skeleton h-5 w-40" />
          <div className="nx-skeleton h-40 w-full" />
        </div>
        <div className="nx-card space-y-3 p-5 lg:col-span-7">
          <div className="nx-skeleton h-5 w-44" />
          {[0, 1, 2, 3].map((r) => (
            <div key={r} className="nx-skeleton h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  icon?: ReactNode;
}

export function ScreenEmptyState({
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  icon
}: EmptyStateProps) {
  return (
    <div className="nx-card flex flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-[var(--nx-radius-md)] bg-[var(--nx-indigo-soft)] text-[var(--nx-indigo)]">
        {icon || <DatabaseZap className="h-6 w-6" aria-hidden="true" />}
      </div>
      <div className="max-w-md space-y-1">
        <h3 className="text-base font-bold text-[var(--nx-text-primary)]">{title}</h3>
        <p className="text-sm leading-relaxed text-[var(--nx-text-muted)]">{description}</p>
      </div>
      {(actionLabel || secondaryLabel) && (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          {actionLabel && onAction && (
            <button type="button" onClick={onAction} className="nx-btn nx-btn-primary">
              {actionLabel}
            </button>
          )}
          {secondaryLabel && onSecondary && (
            <button type="button" onClick={onSecondary} className="nx-btn nx-btn-outline">
              {secondaryLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface SyncErrorBannerProps {
  message?: string | null;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export function SyncErrorBanner({ message, onRetry, isRetrying }: SyncErrorBannerProps) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--nx-radius-md)] border border-[var(--nx-coral-border)] bg-[var(--nx-coral-bg)] px-4 py-3 text-[var(--nx-coral)]"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="truncate text-sm font-medium">
          {message || 'تعذر الاتصال بالسحابة مؤقتاً — البيانات معروضة من النسخة المحلية.'}
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          className="nx-btn nx-btn-outline nx-btn-compact border-[var(--nx-coral-border)] bg-[var(--nx-bg-surface)] text-[var(--nx-coral)]"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRetrying ? 'animate-spin' : ''}`} aria-hidden="true" />
          <span>إعادة المحاولة</span>
        </button>
      )}
    </div>
  );
}
