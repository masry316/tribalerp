import { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  KeyRound,
  Mail,
  RefreshCw,
  UserCheck,
  UserPlus,
  Wand2
} from 'lucide-react';
import {
  generateHumanIdentity,
  type GeneratedIdentity,
  type IdentityLang
} from '../../../core';
import type { MutationResult } from '../../../data';
import type { AccountInput } from '../../../validation';
import { BaseModal } from './BaseModal';

interface IdentityGeneratorModalProps {
  open: boolean;
  onClose: () => void;
  onSaveAccount: (input: Partial<AccountInput>) => MutationResult;
  onPushToast: (msg: string, tone?: 'info' | 'success' | 'warn' | 'danger') => void;
}

type CopyFieldKey = 'emailUsername' | 'accountName' | 'password';

export function IdentityGeneratorModal({
  open,
  onClose,
  onSaveAccount,
  onPushToast
}: IdentityGeneratorModalProps) {
  const [lang, setLang] = useState<IdentityLang>('ar');
  const [identity, setIdentity] = useState<GeneratedIdentity>(() =>
    generateHumanIdentity('ar')
  );
  const [copiedField, setCopiedField] = useState<CopyFieldKey | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setIdentity(generateHumanIdentity(lang));
    setCopiedField(null);
    setSaveError(null);
  }, [open, lang]);

  function handleLanguageSwitch(nextLang: IdentityLang) {
    setLang(nextLang);
    setIdentity(generateHumanIdentity(nextLang));
    setCopiedField(null);
    setSaveError(null);
  }

  function handleRegenerate() {
    setIdentity(generateHumanIdentity(lang));
    setCopiedField(null);
    setSaveError(null);
  }

  async function handleCopy(field: CopyFieldKey, value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      onPushToast(`تم نسخ ${label}`, 'success');
      window.setTimeout(() => {
        setCopiedField((cur) => (cur === field ? null : cur));
      }, 1800);
    } catch {
      onPushToast('تعذر النسخ التلقائي للحافظة', 'warn');
    }
  }

  function handleAddToAccounts() {
    setSaveError(null);
    const res = onSaveAccount({
      name: identity.accountName,
      email: `${identity.emailUser}@gmail.com`,
      password: identity.password,
      pp: 0,
      ip: '',
      device: 'Mobile',
      browser: 'Chrome'
    });
    if (!res.ok) {
      const firstErr = res.errors ? Object.values(res.errors)[0] : 'تعذر حفظ الحساب.';
      setSaveError(firstErr);
      onPushToast(firstErr, 'danger');
      return;
    }
    onPushToast(`تمت إضافة الحساب "${identity.accountName}" إلى قائمة الحسابات`, 'success');
    onClose();
  }

  const fields: Array<{
    key: CopyFieldKey;
    label: string;
    hint: string;
    value: string;
    dir: 'ltr' | 'rtl';
    mono: boolean;
    icon: typeof Mail;
  }> = [
    {
      key: 'emailUsername',
      label: 'اسم مستخدم البريد (بدون @)',
      hint: 'يوزر نيم جاهز للتسجيل — انسخه وأضف الدومين الذي تريده',
      value: identity.emailUser,
      dir: 'ltr',
      mono: true,
      icon: Mail
    },
    {
      key: 'accountName',
      label: 'اسم الحساب (داخل اللعبة)',
      hint: 'اسم طبيعي يبدو كاختيار لاعب حقيقي',
      value: identity.accountName,
      dir: lang === 'en' ? 'ltr' : 'rtl',
      mono: false,
      icon: UserCheck
    },
    {
      key: 'password',
      label: 'كلمة المرور (مرتبطة بالاسم)',
      hint: 'بشرية وسهلة التذكر وتحتوي على حروف وأرقام ورمز',
      value: identity.password,
      dir: 'ltr',
      mono: true,
      icon: KeyRound
    }
  ];

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      ariaLabel="توليد هوية حساب بشري"
      title="توليد بيانات حساب جديدة"
      subtitle="أسماء بشرية طبيعية بالعربية أو الإنجليزية جاهزة لإنشاء حساب جديد"
      icon={<Wand2 className="h-4 w-4" aria-hidden="true" />}
      maxWidthClass="max-w-lg"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleRegenerate}
            className="nx-btn nx-btn-outline nx-btn-compact"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>توليد جديد</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="nx-btn nx-btn-outline nx-btn-compact"
            >
              إغلاق
            </button>
            <button
              type="button"
              onClick={handleAddToAccounts}
              className="nx-btn nx-btn-primary nx-btn-compact"
            >
              <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>إضافة للحسابات</span>
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Language Switcher */}
        <div className="flex items-center justify-between gap-3 rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] p-2">
          <span className="px-1.5 text-xs font-semibold text-[var(--nx-text-secondary)]">
            لغة الاسم والهوية
          </span>
          <div
            role="radiogroup"
            aria-label="اختيار لغة توليد الهوية"
            className="inline-flex rounded-[var(--nx-radius-sm)] border border-[var(--nx-border)] bg-[var(--nx-bg-surface)] p-0.5"
          >
            <button
              type="button"
              role="radio"
              aria-checked={lang === 'ar'}
              onClick={() => handleLanguageSwitch('ar')}
              className={`cursor-pointer rounded-[var(--nx-radius-xs)] px-3.5 py-1.5 text-xs font-bold transition-colors ${
                lang === 'ar'
                  ? 'bg-[var(--nx-indigo)] text-white shadow-xs'
                  : 'text-[var(--nx-text-muted)] hover:text-[var(--nx-text-primary)]'
              }`}
            >
              عربي
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={lang === 'en'}
              onClick={() => handleLanguageSwitch('en')}
              className={`cursor-pointer rounded-[var(--nx-radius-xs)] px-3.5 py-1.5 text-xs font-bold transition-colors ${
                lang === 'en'
                  ? 'bg-[var(--nx-indigo)] text-white shadow-xs'
                  : 'text-[var(--nx-text-muted)] hover:text-[var(--nx-text-primary)]'
              }`}
            >
              إنجليزي
            </button>
          </div>
        </div>

        {/* Generated Identity Fields */}
        <div className="space-y-3">
          {fields.map((f) => {
            const Icon = f.icon;
            const isCopied = copiedField === f.key;
            return (
              <div
                key={f.key}
                className="rounded-[var(--nx-radius-md)] border border-[var(--nx-border)] bg-[var(--nx-bg-subtle)] p-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--nx-text-secondary)]">
                    <Icon className="h-3.5 w-3.5 text-[var(--nx-indigo)]" aria-hidden="true" />
                    <span>{f.label}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCopy(f.key, f.value, f.label)}
                    aria-label={`نسخ ${f.label}`}
                    className={`nx-btn nx-btn-compact !min-h-[30px] !px-2.5 !text-[11px] ${
                      isCopied
                        ? 'border-[var(--nx-emerald-border)] bg-[var(--nx-emerald-bg)] text-[var(--nx-emerald)]'
                        : 'nx-btn-outline'
                    }`}
                  >
                    {isCopied ? (
                      <>
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>تم النسخ</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>نسخ</span>
                      </>
                    )}
                  </button>
                </div>

                <div
                  dir={f.dir}
                  data-testid={`identity-${f.key}`}
                  className={`mt-2 select-all rounded-[var(--nx-radius-sm)] border border-[var(--nx-border)] bg-[var(--nx-bg-surface)] px-3 py-2 text-start text-sm font-bold text-[var(--nx-text-primary)] ${
                    f.mono ? 'font-mono-num tracking-wide' : ''
                  }`}
                >
                  {f.value}
                </div>
                <p className="mt-1.5 text-[11px] text-[var(--nx-text-muted)]">{f.hint}</p>
              </div>
            );
          })}
        </div>

        {saveError ? (
          <div
            role="alert"
            className="rounded-[var(--nx-radius-md)] border border-[var(--nx-coral-border)] bg-[var(--nx-coral-bg)] px-3 py-2 text-xs font-semibold text-[var(--nx-coral)]"
          >
            {saveError}
          </div>
        ) : null}

        <p className="text-[11px] leading-relaxed text-[var(--nx-text-muted)]">
          عند الضغط على <strong className="text-[var(--nx-text-secondary)]">إضافة للحسابات</strong> سيتم حفظ اسم الحساب وكلمة المرور تلقائياً في جدول حساباتك (مع ربط البريد بـ{' '}
          <span dir="ltr" className="font-mono-num">
            {identity.emailUser}@gmail.com
          </span>
          ) ويمكنك تعديله لاحقاً في أي وقت.
        </p>
      </div>
    </BaseModal>
  );
}
