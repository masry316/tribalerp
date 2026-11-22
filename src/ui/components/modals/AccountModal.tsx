import { useEffect, useState, type FormEvent } from 'react';
import { History, Save, Trash2, UserCog } from 'lucide-react';
import { formatPPAndCurrency, type ErpAppState } from '../../../core';
import type { MutationResult } from '../../../data';
import type { AccountInput } from '../../../validation';
import { FieldError, FormErrorsBanner } from '../FieldError';
import { BaseModal } from './BaseModal';

interface AccountModalProps {
  open: boolean;
  creating: boolean;
  editingAccountId: string | null;
  state: ErpAppState;
  onClose: () => void;
  onSaveAccount: (input: Partial<AccountInput>) => MutationResult;
  onDeleteAccount: (accountId: string) => MutationResult;
  onPushToast: (msg: string, tone?: 'info' | 'success' | 'warn' | 'danger') => void;
}

export function AccountModal({
  open,
  creating,
  editingAccountId,
  state,
  onClose,
  onSaveAccount,
  onDeleteAccount,
  onPushToast
}: AccountModalProps) {
  const existing = state.userAccounts.find((a) => a.id === editingAccountId) || null;

  const [tab, setTab] = useState<'form' | 'logins'>('form');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errors, setErrors] = useState<Record<string, string> | null>(null);

  const [name, setName] = useState('');
  const [pp, setPp] = useState('0');
  const [ip, setIp] = useState('');
  const [device, setDevice] = useState('Mobile');
  const [browser, setBrowser] = useState('Chrome');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!open) return;
    setTab('form');
    setConfirmDelete(false);
    setErrors(null);
    if (creating) {
      setName('');
      setPp('0');
      setIp('');
      setDevice('Mobile');
      setBrowser('Chrome');
      setEmail('');
      setPassword('');
    } else if (existing) {
      setName(existing.name || '');
      setPp(String(existing.pp || 0));
      setIp(existing.ip || '');
      setDevice(existing.device || 'Mobile');
      setBrowser(existing.browser || 'Chrome');
      setEmail(existing.email || '');
      setPassword(existing.password || '');
    }
  }, [open, creating, existing]);

  if (!open) return null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors(null);
    const res = onSaveAccount({
      id: existing?.id,
      name: name.trim(),
      pp: Math.max(0, Math.round(Number(pp) || 0)),
      ip: ip.trim(),
      device: device.trim() || 'Mobile',
      browser: browser.trim() || 'Chrome',
      email: email.trim(),
      password: password.trim()
    });
    if (!res.ok) {
      setErrors(res.errors || { form: 'يرجى مراجعة الحقول قبل الحفظ.' });
      return;
    }
    onPushToast(creating ? 'تمت إضافة الحساب بنجاح' : 'تم تحديث بيانات الحساب', 'success');
    onClose();
  }

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      ariaLabel={creating ? 'إضافة حساب جديد' : 'تعديل الحساب'}
      title={creating ? 'إضافة حساب لعبة جديد' : `تعديل حساب · ${existing?.name || ''}`}
      icon={<UserCog className="h-5 w-5" aria-hidden="true" />}
      bodyClassName="flex flex-1 flex-col overflow-hidden"
    >
      {!creating && existing && (
          <div className="flex items-center gap-2 border-b border-[var(--nx-border)] px-5 pt-3">
            <button
              type="button"
              onClick={() => setTab('form')}
              className={`cursor-pointer border-b-2 px-2 pb-2.5 text-xs font-semibold ${
                tab === 'form'
                  ? 'border-[var(--nx-indigo)] text-[var(--nx-indigo)]'
                  : 'border-transparent text-[var(--nx-text-muted)]'
              }`}
            >
              البيانات الأساسية
            </button>
            <button
              type="button"
              onClick={() => setTab('logins')}
              className={`flex cursor-pointer items-center gap-1 border-b-2 px-2 pb-2.5 text-xs font-semibold ${
                tab === 'logins'
                  ? 'border-[var(--nx-indigo)] text-[var(--nx-indigo)]'
                  : 'border-transparent text-[var(--nx-text-muted)]'
              }`}
            >
              <History className="h-3.5 w-3.5" aria-hidden="true" />
              <span>سجل الدخول ({existing.loginHistory?.length || 0})</span>
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'form' ? (
            <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
              <FormErrorsBanner errors={errors} />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs font-medium text-[var(--nx-text-secondary)]">
                  <span>اسم الحساب باللعبة</span>
                  <input
                    required
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="nx-input w-full"
                  />
                  <FieldError message={errors?.name} />
                </label>
                <label className="space-y-1 text-xs font-medium text-[var(--nx-text-secondary)]">
                  <span>رصيد النقاط (PP)</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    dir="ltr"
                    value={pp}
                    onChange={(e) => setPp(e.target.value)}
                    className="nx-input font-mono-num w-full"
                  />
                  <div className="font-mono-num text-[11px] font-semibold text-[var(--nx-indigo)]">
                    القيمة المالية: {formatPPAndCurrency(Number(pp) || 0, state, { decimals: 0, unit: 'نقطة' }).combinedText}
                  </div>
                  <FieldError message={errors?.pp} />
                </label>
                <label className="space-y-1 text-xs font-medium text-[var(--nx-text-secondary)]">
                  <span>عنوان IP</span>
                  <input
                    type="text"
                    dir="ltr"
                    value={ip}
                    onChange={(e) => setIp(e.target.value)}
                    placeholder="197.x.x.x"
                    className="nx-input font-mono-num w-full"
                  />
                  <FieldError message={errors?.ip} />
                </label>
                <label className="space-y-1 text-xs font-medium text-[var(--nx-text-secondary)]">
                  <span>الجهاز</span>
                  <input
                    type="text"
                    value={device}
                    onChange={(e) => setDevice(e.target.value)}
                    className="nx-input w-full"
                  />
                </label>
                <label className="space-y-1 text-xs font-medium text-[var(--nx-text-secondary)]">
                  <span>المتصفح</span>
                  <input
                    type="text"
                    value={browser}
                    onChange={(e) => setBrowser(e.target.value)}
                    className="nx-input w-full"
                  />
                </label>
                <label className="space-y-1 text-xs font-medium text-[var(--nx-text-secondary)]">
                  <span>البريد (اختياري)</span>
                  <input
                    type="text"
                    dir="ltr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="nx-input w-full"
                  />
                  <FieldError message={errors?.email} />
                </label>
              </div>

              <label className="block space-y-1 text-xs font-medium text-[var(--nx-text-secondary)]">
                <span>كلمة المرور (ملاحظة محلية)</span>
                <input
                  type="text"
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="nx-input w-full"
                />
              </label>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--nx-border)] pt-3">
                {!creating && existing ? (
                  !confirmDelete ? (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="nx-btn nx-btn-outline border-[var(--nx-coral-border)] text-[var(--nx-coral)]"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      <span>حذف الحساب</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteAccount(existing.id);
                          onPushToast('تم حذف الحساب والقرى المرتبطة به', 'info');
                          onClose();
                        }}
                        className="nx-btn bg-[var(--nx-coral)] text-white"
                      >
                        تأكيد الحذف
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="nx-btn nx-btn-outline"
                      >
                        إلغاء
                      </button>
                    </div>
                  )
                ) : (
                  <span />
                )}

                <div className="flex items-center gap-2">
                  <button type="button" onClick={onClose} className="nx-btn nx-btn-outline">
                    إلغاء
                  </button>
                  <button type="submit" className="nx-btn nx-btn-primary">
                    <Save className="h-4 w-4" aria-hidden="true" />
                    <span>حفظ</span>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="space-y-2">
              {!existing?.loginHistory?.length ? (
                <div className="p-6 text-center text-sm text-[var(--nx-text-muted)]">
                  لا يوجد سجل دخول مسجل لهذا الحساب بعد.
                </div>
              ) : (
                <div className="divide-y divide-[var(--nx-border)] rounded-[var(--nx-radius-md)] border border-[var(--nx-border)]">
                  {existing.loginHistory.map((row, idx) => (
                    <div
                      key={`${row.date}-${idx}`}
                      className="flex flex-wrap items-center justify-between gap-2 p-3 text-xs"
                    >
                      <div>
                        <div className="font-semibold text-[var(--nx-text-primary)]">{row.date}</div>
                        <div className="text-[var(--nx-text-muted)]">
                          {row.device} {row.sitter ? `· حضانة: ${row.sitter}` : ''}
                        </div>
                      </div>
                      <span className="font-mono-num font-bold" dir="ltr">
                        {row.ip}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </BaseModal>
  );
}
