import { useEffect, useRef, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// Shared modal stack so Escape closes only the topmost open modal,
// stacked modals always layer in open order, and body scroll lock is reference-counted.
const modalCloseStack: Array<() => void> = [];
let openModalCount = 0;
let nextModalZIndex = 100;
let previousBodyOverflow = '';

export function hasOpenBaseModal(): boolean {
  return modalCloseStack.length > 0;
}

function handleGlobalEscape(e: KeyboardEvent) {
  if (e.key !== 'Escape') return;
  const topClose = modalCloseStack[modalCloseStack.length - 1];
  if (topClose) {
    e.preventDefault();
    e.stopImmediatePropagation();
    topClose();
  }
}

export interface BaseModalProps {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  headerActions?: ReactNode;
  headerContent?: ReactNode;
  footer?: ReactNode;
  maxWidthClass?: string;
  bodyClassName?: string;
  closeButtonLabel?: string;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  children: ReactNode;
}

export function BaseModal({
  open,
  onClose,
  ariaLabel,
  title,
  subtitle,
  icon,
  headerActions,
  headerContent,
  footer,
  maxWidthClass = 'max-w-xl',
  bodyClassName = 'flex-1 overflow-y-auto p-4 sm:p-5',
  closeButtonLabel = 'إغلاق',
  closeOnBackdropClick = true,
  closeOnEscape = true,
  children
}: BaseModalProps) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const zIndexRef = useRef<number>(100);
  const wasOpenRef = useRef<boolean>(false);
  if (open && !wasOpenRef.current) {
    nextModalZIndex += 10;
    zIndexRef.current = nextModalZIndex;
  }
  wasOpenRef.current = open;

  useEffect(() => {
    if (!open) return;

    const closeHandler = () => {
      if (closeOnEscape) onCloseRef.current();
    };

    if (modalCloseStack.length === 0) {
      window.addEventListener('keydown', handleGlobalEscape, true);
    }
    modalCloseStack.push(closeHandler);

    if (typeof document !== 'undefined') {
      if (openModalCount === 0) {
        previousBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
      }
      openModalCount += 1;
    }

    return () => {
      const idx = modalCloseStack.lastIndexOf(closeHandler);
      if (idx >= 0) modalCloseStack.splice(idx, 1);
      if (modalCloseStack.length === 0) {
        window.removeEventListener('keydown', handleGlobalEscape, true);
        nextModalZIndex = 100;
      }

      if (typeof document !== 'undefined') {
        openModalCount = Math.max(0, openModalCount - 1);
        if (openModalCount === 0) {
          document.body.style.overflow = previousBodyOverflow;
        }
      }
    };
  }, [open, closeOnEscape]);

  if (!open) return null;

  function handleBackdropPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (!closeOnBackdropClick) return;
    if (e.isPrimary === false) return;
    if (e.target === e.currentTarget) {
      e.preventDefault();
      onClose();
    }
  }

  const modalNode = (
    <div
      data-modal-backdrop="true"
      style={{ zIndex: zIndexRef.current }}
      className="fixed inset-0 flex items-center justify-center bg-black/55 p-3 backdrop-blur-[2px] sm:p-4"
      onPointerDown={handleBackdropPointerDown}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={`flex max-h-[86dvh] w-full ${maxWidthClass} flex-col overflow-hidden rounded-[var(--nx-radius-xl)] border border-[var(--nx-border-strong)] bg-[var(--nx-bg-surface)] shadow-[var(--nx-shadow-float)] sm:max-h-[90dvh]`}
      >
        {/* Pinned Header: Title/Content + Guaranteed Top-Corner Close (X) Button */}
        <div className="shrink-0 border-b border-[var(--nx-border)]">
          <div className="flex items-start justify-between gap-3 px-4 py-3.5 sm:px-5 sm:py-4">
            {headerContent ? (
              <div className="min-w-0 flex-1">{headerContent}</div>
            ) : (
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                {icon ? (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--nx-radius-sm)] bg-[var(--nx-indigo-soft)] text-[var(--nx-indigo)]">
                    {icon}
                  </div>
                ) : null}
                <div className="min-w-0">
                  {title ? (
                    <h2 className="truncate text-sm font-bold text-[var(--nx-text-primary)] sm:text-base">
                      {title}
                    </h2>
                  ) : null}
                  {subtitle ? (
                    <div className="mt-0.5 text-xs leading-snug text-[var(--nx-text-muted)]">
                      {subtitle}
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label={closeButtonLabel}
              title="إغلاق (Esc)"
              data-modal-close="true"
              className="nx-transition flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[var(--nx-radius-sm)] border border-[var(--nx-border-strong)] bg-[var(--nx-bg-subtle)] text-[var(--nx-text-primary)] hover:border-[var(--nx-coral-border)] hover:bg-[var(--nx-coral-bg)] hover:text-[var(--nx-coral)] focus:outline-none focus:ring-2 focus:ring-[var(--nx-indigo)]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {headerActions ? (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--nx-border)]/70 bg-[var(--nx-bg-subtle)]/65 px-4 py-2 sm:px-5">
              {headerActions}
            </div>
          ) : null}
        </div>

        {/* Scrollable Modal Body */}
        <div className={bodyClassName}>{children}</div>

        {/* Optional Pinned Footer */}
        {footer ? (
          <div className="shrink-0 border-t border-[var(--nx-border)] px-4 py-3 sm:px-5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(modalNode, document.body);
  }

  return modalNode;
}
