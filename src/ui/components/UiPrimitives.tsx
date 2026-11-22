import type { ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';

export const BTN_PRIMARY_CLS =
  'inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap shrink-0 rounded-[var(--nx-radius-md)] bg-[var(--nx-indigo)] px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nx-indigo)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer';

export const SURFACE_CLS = 'nx-card';

export function StatusNotice({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-[var(--nx-radius-md)] border border-[var(--nx-emerald-border)] bg-[var(--nx-emerald-bg)] px-3.5 py-2.5 text-xs font-medium text-[var(--nx-emerald)]"
    >
      <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

export function SectionHeader({
  title,
  subtitle,
  headingId,
  action
}: {
  title: string;
  subtitle?: string;
  headingId?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h3
          id={headingId}
          className="text-base font-bold tracking-tight text-[var(--nx-text-primary)] sm:text-lg"
        >
          {title}
        </h3>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-[var(--nx-text-muted)]">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
