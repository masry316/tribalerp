import { failValidation, isValidIpAddress, okValidation, type ValidationResult } from './types';

export interface AccountInput {
  id?: string;
  name: string;
  pp: number;
  ip: string;
  device: string;
  browser: string;
  email: string;
  password: string;
}

export function validateAccountInput(
  input: Partial<AccountInput> | null | undefined
): ValidationResult<AccountInput> {
  const errors: Record<string, string> = {};
  const src = input || {};

  const name = String(src.name ?? '').trim();
  if (!name) {
    errors.name = 'اسم الحساب مطلوب ولا يمكن تركه فارغاً.';
  } else if (name.length > 120) {
    errors.name = 'اسم الحساب يجب ألا يتجاوز 120 حرفاً.';
  }

  const rawPP = src.pp === undefined || src.pp === null ? 0 : Number(src.pp);
  if (!Number.isFinite(rawPP) || !Number.isInteger(rawPP) || rawPP < 0 || rawPP > 100_000_000) {
    errors.pp = 'نقاط التميز (PP) يجب أن تكون عدداً صحيحاً بين 0 و 100,000,000.';
  }

  const ip = String(src.ip ?? '').trim();
  if (ip && !isValidIpAddress(ip)) {
    errors.ip = 'صيغة عنوان IP غير صالحة (مطلوب IPv4 أو IPv6 صحيح).';
  }

  const device = String(src.device ?? '').trim();
  if (device.length > 120) {
    errors.device = 'اسم الجهاز يجب ألا يتجاوز 120 حرفاً.';
  }

  const browser = String(src.browser ?? '').trim();
  if (browser.length > 120) {
    errors.browser = 'اسم المتصفح يجب ألا يتجاوز 120 حرفاً.';
  }

  const email = String(src.email ?? '').trim();
  if (email && (email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    errors.email = 'صيغة البريد الإلكتروني غير صالحة.';
  }

  const password = String(src.password ?? '');
  if (password.length > 160) {
    errors.password = 'كلمة المرور طويلة جداً (الحد الأقصى 160 حرفاً).';
  }

  if (Object.keys(errors).length > 0) {
    return failValidation(errors);
  }

  return okValidation({
    ...(src.id ? { id: String(src.id).trim() } : {}),
    name,
    pp: Math.trunc(rawPP),
    ip,
    device,
    browser,
    email,
    password
  });
}
