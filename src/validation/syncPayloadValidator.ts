import { failValidation, isValidIpAddress, okValidation, type ValidationResult } from './types';

export function validateIncomingSyncPayload(
  rawInput: string | Record<string, any> | null | undefined
): ValidationResult<Record<string, any>> {
  const errors: Record<string, string> = {};
  let parsed: Record<string, any> | null = null;

  if (typeof rawInput === 'string') {
    const trimmed = rawInput.trim();
    if (!trimmed) {
      return failValidation({ payload: 'لم يتم إدخال أي بيانات JSON للمزامنة.' });
    }
    if (trimmed.startsWith('javascript:') || trimmed.includes('window.game_data')) {
      return failValidation({
        payload: 'هذا كود أداة البوك مارك نفسها وليس مخرجات القرية! شغّل الأداة داخل اللعبة أولاً.'
      });
    }
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return failValidation({ payload: 'النص المدخل ليس JSON صالح من اللعبة.' });
    }
  } else if (rawInput && typeof rawInput === 'object') {
    parsed = rawInput;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return failValidation({ payload: 'بيانات المزامنة فارغة أو غير صالحة.' });
  }

  if (parsed.coord !== undefined && parsed.coord !== null && String(parsed.coord).trim() !== '') {
    const coord = String(parsed.coord).trim();
    if (!/^\d{3}\|\d{3}$/.test(coord)) {
      errors.coord = 'إحداثيات القرية في الحمولة غير صالحة (المطلوب xxx|yyy).';
    }
  }

  if (parsed.ip !== undefined && parsed.ip !== null && String(parsed.ip).trim() !== '') {
    if (!isValidIpAddress(String(parsed.ip))) {
      errors.ip = 'عنوان IP في حمولة المزامنة غير صالح.';
    }
  }

  const numericStockFields = ['woodStock', 'clayStock', 'ironStock'] as const;
  for (const field of numericStockFields) {
    if (parsed[field] !== undefined && parsed[field] !== null) {
      const n = Number(parsed[field]);
      if (!Number.isFinite(n) || n < 0 || n > 1_000_000) {
        errors[field] = `قيمة ${field} غير صالحة.`;
      }
    }
  }

  const troopFields = [
    'spearsHome',
    'swordsHome',
    'axesHome',
    'spiesHome',
    'lightsHome',
    'heaviesHome',
    'spearsAway',
    'swordsAway',
    'axesAway',
    'lightsAway',
    'heaviesAway',
    'spearsTotal',
    'swordsTotal'
  ] as const;
  for (const field of troopFields) {
    if (parsed[field] !== undefined && parsed[field] !== null) {
      const n = Number(parsed[field]);
      if (!Number.isFinite(n) || n < 0 || n > 200_000) {
        errors[field] = `عدد الوحدة ${field} غير صالح.`;
      }
    }
  }

  if (parsed.buildings && typeof parsed.buildings === 'object' && !Array.isArray(parsed.buildings)) {
    for (const [bName, lvl] of Object.entries(parsed.buildings)) {
      const n = Number(lvl);
      if (!Number.isFinite(n) || n < 0 || n > 30) {
        errors[`buildings.${bName}`] = `مستوى المبنى ${bName} خارج النطاق المسموح (0..30).`;
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return failValidation(errors);
  }

  return okValidation(parsed);
}

export function validateAppStateBackupJson(rawJson: string): ValidationResult<Record<string, any>> {
  const trimmed = String(rawJson || '').trim();
  if (!trimmed) {
    return failValidation({ backup: 'ملف النسخة الاحتياطية فارغ.' });
  }
  let parsed: any;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return failValidation({ backup: 'الملف ليس بصيغة JSON صالحة.' });
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return failValidation({ backup: 'بنية ملف النسخة الاحتياطية غير صحيحة.' });
  }

  const errors: Record<string, string> = {};
  if (!Array.isArray(parsed.worlds)) errors.worlds = 'قائمة العوالم مفقودة أو غير صالحة.';
  if (!Array.isArray(parsed.userAccounts)) errors.userAccounts = 'قائمة الحسابات مفقودة أو غير صالحة.';
  if (!Array.isArray(parsed.villages)) errors.villages = 'قائمة القرى مفقودة أو غير صالحة.';

  if (Object.keys(errors).length > 0) {
    return failValidation(errors);
  }
  return okValidation(parsed as Record<string, any>);
}
