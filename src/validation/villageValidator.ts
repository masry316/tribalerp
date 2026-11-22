import { FIXED_CONTINENTS } from '../core/constants/gameData';
import type { VillageRole } from '../core/types';
import { failValidation, okValidation, type ValidationResult } from './types';

export interface VillageInput {
  id?: string;
  villageId?: string;
  name: string;
  accountId: string;
  worldId: string;
  continent: string;
  coord: string;
  villageRole?: VillageRole;
  flag: number;
  woodItem: number;
  clayItem: number;
  ironItem: number;
  premium: boolean;
  boost30: boolean;
  warehouseLevel: number;
  marketLevel: number;
  farmLevel: number;
  woodLevel: number;
  clayLevel: number;
  ironLevel: number;
  woodStock: number;
  clayStock: number;
  ironStock: number;
  spearsTotal: number;
  swordsTotal: number;
  axesTotal: number;
  lightsTotal: number;
  heaviesTotal: number;
  unlockedScavTiers: number;
}

function checkIntRange(
  val: unknown,
  fallback: number,
  min: number,
  max: number,
  field: string,
  label: string,
  errors: Record<string, string>
): number {
  const num = val === undefined || val === null ? fallback : Number(val);
  if (!Number.isFinite(num) || !Number.isInteger(num) || num < min || num > max) {
    errors[field] = `${label} يجب أن يكون عدداً صحيحاً بين ${min} و ${max}.`;
    return fallback;
  }
  return num;
}

export function validateVillageInput(
  input: Partial<VillageInput> | null | undefined
): ValidationResult<VillageInput> {
  const errors: Record<string, string> = {};
  const src = input || {};

  const name = String(src.name ?? '').trim();
  if (!name) {
    errors.name = 'اسم القرية مطلوب.';
  } else if (name.length > 160) {
    errors.name = 'اسم القرية يجب ألا يتجاوز 160 حرفاً.';
  }

  const accountId = String(src.accountId ?? '').trim();
  if (!accountId) {
    errors.accountId = 'يجب ربط القرية بحساب موجود.';
  }

  const worldId = String(src.worldId ?? '').trim();
  if (!worldId) {
    errors.worldId = 'يجب تحديد العالم التابع للقرية.';
  }

  const continent = String(src.continent ?? '44').trim();
  if (!(FIXED_CONTINENTS as readonly string[]).includes(continent)) {
    errors.continent = 'القارة غير مدعومة (المتاح: 44، 45، 54، 55).';
  }

  const coord = String(src.coord ?? '').trim();
  if (coord && !/^\d{3}\|\d{3}$/.test(coord)) {
    errors.coord = 'صيغة الإحداثيات يجب أن تكون مثل 500|500.';
  }

  const rawRole = src.villageRole;
  const villageRole: VillageRole =
    rawRole === 'offense' || rawRole === 'defense' || rawRole === 'unset'
      ? rawRole
      : 'unset';

  const flag = checkIntRange(src.flag, 0, 0, 100, 'flag', 'نسبة العلم', errors);
  const woodItem = checkIntRange(src.woodItem, 0, 0, 500, 'woodItem', 'بونص الخشب', errors);
  const clayItem = checkIntRange(src.clayItem, 0, 0, 500, 'clayItem', 'بونص الطمي', errors);
  const ironItem = checkIntRange(src.ironItem, 0, 0, 500, 'ironItem', 'بونص الحديد', errors);

  const warehouseLevel = checkIntRange(src.warehouseLevel, 1, 1, 30, 'warehouseLevel', 'مستوى المخازن', errors);
  const marketLevel = checkIntRange(src.marketLevel, 0, 0, 25, 'marketLevel', 'مستوى السوق', errors);
  const farmLevel = checkIntRange(src.farmLevel, 1, 1, 30, 'farmLevel', 'مستوى المزارع', errors);
  const woodLevel = checkIntRange(src.woodLevel, 0, 0, 30, 'woodLevel', 'مستوى الخشاب', errors);
  const clayLevel = checkIntRange(src.clayLevel, 0, 0, 30, 'clayLevel', 'مستوى حفرة الطمي', errors);
  const ironLevel = checkIntRange(src.ironLevel, 0, 0, 30, 'ironLevel', 'مستوى منجم الحديد', errors);

  const woodStock = checkIntRange(src.woodStock, 0, 0, 1_000_000, 'woodStock', 'مخزون الخشب', errors);
  const clayStock = checkIntRange(src.clayStock, 0, 0, 1_000_000, 'clayStock', 'مخزون الطمي', errors);
  const ironStock = checkIntRange(src.ironStock, 0, 0, 1_000_000, 'ironStock', 'مخزون الحديد', errors);

  const spearsTotal = checkIntRange(src.spearsTotal, 0, 0, 200_000, 'spearsTotal', 'عدد الرماح', errors);
  const swordsTotal = checkIntRange(src.swordsTotal, 0, 0, 200_000, 'swordsTotal', 'عدد السيوف', errors);
  const axesTotal = checkIntRange(src.axesTotal, 0, 0, 200_000, 'axesTotal', 'عدد الفؤوس', errors);
  const lightsTotal = checkIntRange(src.lightsTotal, 0, 0, 200_000, 'lightsTotal', 'عدد الفرسان الخفيفة', errors);
  const heaviesTotal = checkIntRange(src.heaviesTotal, 0, 0, 200_000, 'heaviesTotal', 'عدد الفرسان الثقيلة', errors);
  const unlockedScavTiers = checkIntRange(
    src.unlockedScavTiers,
    0,
    0,
    4,
    'unlockedScavTiers',
    'مستويات الإغارة المفتوحة',
    errors
  );

  if (Object.keys(errors).length > 0) {
    return failValidation(errors);
  }

  return okValidation({
    ...(src.id ? { id: String(src.id).trim() } : {}),
    ...(src.villageId ? { villageId: String(src.villageId).trim() } : {}),
    name,
    accountId,
    worldId,
    continent,
    coord,
    ...(src.villageRole !== undefined ? { villageRole } : {}),
    flag,
    woodItem,
    clayItem,
    ironItem,
    premium: Boolean(src.premium),
    boost30: Boolean(src.boost30),
    warehouseLevel,
    marketLevel,
    farmLevel,
    woodLevel,
    clayLevel,
    ironLevel,
    woodStock,
    clayStock,
    ironStock,
    spearsTotal,
    swordsTotal,
    axesTotal,
    lightsTotal,
    heaviesTotal,
    unlockedScavTiers
  });
}
