import { useEffect, useState, type FormEvent } from 'react';
import { ClipboardPaste, Cloud, CloudDownload, Copy, Download, RefreshCw } from 'lucide-react';
import { SHORT_CLOUD_BOOKMARKLET, type SyncProcessResult, type SyncStatusState } from '../../../core';
import { buildBookmarkletUrl } from '../../../utils/bookmarklet';
import { FormErrorsBanner } from '../FieldError';
import { BaseModal } from './BaseModal';

interface SyncModalProps {
  open: boolean;
  syncStatus: SyncStatusState;
  onClose: () => void;
  onRefreshData: () => Promise<void> | void;
  onForceCloudSync: () => Promise<void> | void;
  onApplyIncomingSync: (raw: string) => SyncProcessResult;
  onPushToast: (msg: string, tone?: 'info' | 'success' | 'warn' | 'danger') => void;
}

export function SyncModal({
  open,
  syncStatus,
  onClose,
  onRefreshData,
  onForceCloudSync,
  onApplyIncomingSync,
  onPushToast
}: SyncModalProps) {
  const [manualJson, setManualJson] = useState('');
  const [errors, setErrors] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    if (open) setErrors(null);
  }, [open]);

  if (!open) return null;

  async function copyText(txt: string, msg: string) {
    try {
      await navigator.clipboard.writeText(txt);
      onPushToast(msg, 'success');
    } catch {
      onPushToast('تعذر النسخ التلقائي — انسخ الكود يدوياً', 'warn');
    }
  }

  function processPayload(raw: string) {
    setErrors(null);
    const res = onApplyIncomingSync(raw);
    if (res.ok) {
      setManualJson('');
      onPushToast(res.summaryText || 'تمت معالجة مزامنة القرية بنجاح', 'success');
      onClose();
    } else {
      setErrors({ sync: res.error || 'تعذر قراءة بيانات المزامنة.' });
    }
  }

  async function handlePasteClipboard() {
    try {
      const txt = await navigator.clipboard.readText();
      if (txt) {
        setManualJson(txt);
        processPayload(txt);
      } else {
        onPushToast('الحافظة فارغة حالياً', 'warn');
      }
    } catch {
      onPushToast('اسمح للمتصفح بقراءة الحافظة أو الصق الكود في الصندوق أدناه', 'warn');
    }
  }

  function handleIngest(e: FormEvent) {
    e.preventDefault();
    if (!manualJson.trim()) return;
    processPayload(manualJson);
  }

  const isSyncing = syncStatus.status === 'syncing';

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      ariaLabel="مركز المزامنة السحابية"
      title="مركز المزامنة السحابية"
      subtitle="البيانات محفوظة محلياً (IndexedDB + localStorage) — اضغط «تحديث الداتا» لسحب التحديثات من السحابة"
      icon={<Cloud className="h-5 w-5" aria-hidden="true" />}
      bodyClassName="flex-1 space-y-4 overflow-y-auto p-5"
    >
      <FormErrorsBanner errors={errors} />

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <button
          type="button"
          disabled={isSyncing}
          onClick={() => void onRefreshData()}
          className="nx-btn nx-btn-primary w-full"
        >
          <CloudDownload
            className={`h-4 w-4 ${isSyncing ? 'animate-pulse' : ''}`}
            aria-hidden="true"
          />
          <span>{isSyncing ? 'جاري تحديث الداتا...' : 'تحديث الداتا من السحابة'}</span>
        </button>

        <button
          type="button"
          disabled={isSyncing}
          onClick={() => void onForceCloudSync()}
          className="nx-btn nx-btn-outline w-full"
        >
          <RefreshCw
            className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          <span>حفظ ورفع للسحابة الآن</span>
        </button>

        <button
          type="button"
          onClick={() => void copyText(SHORT_CLOUD_BOOKMARKLET, 'تم نسخ كود البوك مارك السحابي')}
          className="nx-btn nx-btn-outline w-full"
        >
          <Copy className="h-4 w-4" aria-hidden="true" />
          <span>نسخ كود البوك مارك السحابي</span>
        </button>

        <button
          type="button"
          onClick={() => void copyText(buildBookmarkletUrl(), 'تم نسخ البوك مارك الكامل للموبايل')}
          className="nx-btn nx-btn-outline w-full"
        >
          <Copy className="h-4 w-4" aria-hidden="true" />
          <span>نسخ النسخة المدمجة (موبايل)</span>
        </button>

        <a
          href="/tw-erp-auto-sync.user.js"
          download="tw-erp-auto-sync.user.js"
          className="nx-btn nx-btn-outline w-full sm:col-span-2"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          <span>تحميل سكريبت Tampermonkey</span>
        </a>
      </div>

      <form onSubmit={handleIngest} className="space-y-2.5 border-t border-[var(--nx-border)] pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="sync-json-input" className="text-xs font-bold text-[var(--nx-text-primary)]">
            لصق بيانات مزامنة القرية يدوياً (JSON)
          </label>
          <button
            type="button"
            onClick={() => void handlePasteClipboard()}
            className="nx-btn nx-btn-outline nx-btn-compact text-[var(--nx-indigo)]"
          >
            <ClipboardPaste className="h-3.5 w-3.5" aria-hidden="true" />
            <span>لصق من الحافظة وتأكيد</span>
          </button>
        </div>
        <textarea
          id="sync-json-input"
          rows={4}
          dir="ltr"
          value={manualJson}
          onChange={(e) => setManualJson(e.target.value)}
          placeholder='{"playerName":"...","villageId":"...","woodStock":...}'
          className="font-mono-num w-full rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] p-3 text-xs text-[var(--nx-text-primary)] focus:border-[var(--nx-indigo)] focus:outline-none"
        />
        <div className="flex items-center justify-between gap-2 pt-1">
          <button type="button" onClick={onClose} className="nx-btn nx-btn-outline">
            إغلاق
          </button>
          <button type="submit" disabled={!manualJson.trim()} className="nx-btn nx-btn-primary">
            <span>تأكيد ومعالجة المزامنة</span>
          </button>
        </div>
      </form>
    </BaseModal>
  );
}
