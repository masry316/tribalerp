import { FIXED_CONTINENTS } from '../core/constants/gameData';
import { failValidation, okValidation, type ValidationResult } from './types';

export interface WorldInput {
  id?: string;
  name: string;
  speed: number;
  settingsUrl?: string;
  tradeEnded?: boolean;
  tradeSummaryPP?: number | null;
}

export interface ContinentRatesInput {
  continent: string;
  sellRate: number;
  buyRate: number;
  sellWood: number;
  sellClay: number;
  sellIron: number;
  stockWood?: number;
  stockClay?: number;
  stockIron?: number;
  capWood?: number;
  capClay?: number;
  capIron?: number;
}

export function validateWorldInput(
  input: Partial<WorldInput> | null | undefined
): ValidationResult<WorldInput> {
  const errors: Record<string, string> = {};
  const src = input || {};

  const name = String(src.name ?? '').trim();
  if (!name) {
    errors.name = 'اسم العالم مطلوب.';
  } else if (name.length > 120) {
    errors.name = 'اسم العالم يجب ألا يتجاوز 120 حرفاً.';
  }

  const speed = src.speed === undefined || src.speed === null ? 1 : Number(src.speed);
  if (!Number.isFinite(speed) || speed < 0.1 || speed > 100) {
    errors.speed = 'سرعة العالم يجب أن تكون بين 0.1 و 100.';
  }

  const settingsUrl = String(src.settingsUrl ?? '').trim();
  if (settingsUrl && !/^https?:\/\//i.test(settingsUrl)) {
    errors.settingsUrl = 'رابط إعدادات العالم يجب أن يبدأ بـ http:// أو https://';
  }

  let tradeSummaryPP: number | null | undefined = undefined;
  if (src.tradeSummaryPP !== undefined) {
    if (src.tradeSummaryPP === null || (src.tradeSummaryPP as unknown) === '') {
      tradeSummaryPP = null;
    } else {
      const parsed = Number(src.tradeSummaryPP);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100_000_000) {
        errors.tradeSummaryPP = 'إجمالي النقاط المحققة يجب أن يكون رقماً غير سالب.';
      } else {
        tradeSummaryPP = Math.round(parsed);
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return failValidation(errors);
  }

  return okValidation({
    ...(src.id ? { id: String(src.id).trim() } : {}),
    name,
    speed,
    ...(settingsUrl ? { settingsUrl } : {}),
    ...(src.tradeEnded !== undefined ? { tradeEnded: Boolean(src.tradeEnded) } : {}),
    ...(tradeSummaryPP !== undefined ? { tradeSummaryPP } : {})
  });
}

export function validateContinentRatesInput(
  input: Partial<ContinentRatesInput> | null | undefined
): ValidationResult<ContinentRatesInput> {
  const errors: Record<string, string> = {};
  const src = input || {};

  const continent = String(src.continent ?? '').trim();
  if (!(FIXED_CONTINENTS as readonly string[]).includes(continent)) {
    errors.continent = 'القارة غير مدعومة (المتاح: 44، 45، 54، 55).';
  }

  const sellRate = Number(src.sellRate ?? 64);
  if (!Number.isFinite(sellRate) || sellRate < 64 || sellRate > 100_000) {
    errors.sellRate = 'سعر صرف البيع العام يجب أن يكون >= 64.';
  }

  const sellWood = src.sellWood === undefined ? sellRate : Number(src.sellWood);
  const sellClay = src.sellClay === undefined ? sellRate : Number(src.sellClay);
  const sellIron = src.sellIron === undefined ? sellRate : Number(src.sellIron);

  if (!Number.isFinite(sellWood) || sellWood < 64 || sellWood > 100_000) {
    errors.sellWood = 'سعر بيع الخشب يجب أن يكون >= 64.';
  }
  if (!Number.isFinite(sellClay) || sellClay < 64 || sellClay > 100_000) {
    errors.sellClay = 'سعر بيع الطمي يجب أن يكون >= 64.';
  }
  if (!Number.isFinite(sellIron) || sellIron < 64 || sellIron > 100_000) {
    errors.sellIron = 'سعر بيع الحديد يجب أن يكون >= 64.';
  }

  const buyRate = Number(src.buyRate ?? 64);
  if (!Number.isFinite(buyRate) || buyRate < 1 || buyRate > 100_000) {
    errors.buyRate = 'سعر الشراء يجب أن يكون بين 1 و 100,000.';
  }

  if (Object.keys(errors).length > 0) {
    return failValidation(errors);
  }

  return okValidation({
    continent,
    sellRate: Math.round(sellRate),
    buyRate: Math.round(buyRate),
    sellWood: Math.round(sellWood),
    sellClay: Math.round(sellClay),
    sellIron: Math.round(sellIron),
    ...(src.stockWood !== undefined ? { stockWood: Math.max(0, Math.round(Number(src.stockWood) || 0)) } : {}),
    ...(src.stockClay !== undefined ? { stockClay: Math.max(0, Math.round(Number(src.stockClay) || 0)) } : {}),
    ...(src.stockIron !== undefined ? { stockIron: Math.max(0, Math.round(Number(src.stockIron) || 0)) } : {}),
    ...(src.capWood !== undefined ? { capWood: Math.max(0, Math.round(Number(src.capWood) || 0)) } : {}),
    ...(src.capClay !== undefined ? { capClay: Math.max(0, Math.round(Number(src.capClay) || 0)) } : {}),
    ...(src.capIron !== undefined ? { capIron: Math.max(0, Math.round(Number(src.capIron) || 0)) } : {})
  });
}
