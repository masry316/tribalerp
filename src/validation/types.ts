export type ValidationResult<T> =
  | { valid: true; data: T }
  | { valid: false; errors: Record<string, string> };

export function okValidation<T>(data: T): ValidationResult<T> {
  return { valid: true, data };
}

export function failValidation<T>(errors: Record<string, string>): ValidationResult<T> {
  return { valid: false, errors };
}

export function isValidIpv4(ip: string): boolean {
  const m = String(ip || '').trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  return [m[1], m[2], m[3], m[4]].every((oct) => {
    const n = Number(oct);
    return Number.isInteger(n) && n >= 0 && n <= 255;
  });
}

export function isValidIpAddress(ip: string): boolean {
  const trimmed = String(ip || '').trim();
  if (!trimmed || trimmed.length > 64) return false;
  if (isValidIpv4(trimmed)) return true;
  // IPv6 relaxed validation (colon-separated hex groups)
  return /^[0-9a-fA-F:]{3,64}$/.test(trimmed) && trimmed.includes(':');
}
