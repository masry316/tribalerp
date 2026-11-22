import { useEffect, useRef, useState, type InputHTMLAttributes, type KeyboardEvent } from 'react';

const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

function normalizeNumericRaw(raw: string, allowDecimal: boolean, allowNegative: boolean): string {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    const arIdx = ARABIC_INDIC_DIGITS.indexOf(ch);
    if (arIdx >= 0) {
      out += String(arIdx);
      continue;
    }
    const faIdx = PERSIAN_DIGITS.indexOf(ch);
    if (faIdx >= 0) {
      out += String(faIdx);
      continue;
    }
    if (ch === '٫' || ch === ',') {
      if (allowDecimal) out += '.';
      continue;
    }
    if (ch >= '0' && ch <= '9') {
      out += ch;
      continue;
    }
    if (ch === '.' && allowDecimal && !out.includes('.')) {
      out += '.';
      continue;
    }
    if (ch === '-' && allowNegative && out.length === 0) {
      out += '-';
    }
  }
  return out;
}

export interface NumericInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'type' | 'value' | 'onChange' | 'min' | 'max' | 'step'
  > {
  value: number | '';
  onValueChange: (next: number) => void;
  onEmptyChange?: () => void;
  min?: number;
  max?: number;
  fallback?: number;
  allowDecimal?: boolean;
  allowNegative?: boolean;
  allowEmpty?: boolean;
  integer?: boolean;
}

/**
 * Frictionless numeric input that lets users freely backspace/clear the field
 * and type partial numbers without snapping back to `min` or `fallback` mid-edit.
 * Clamping and fallback resolution happen only on blur or Enter.
 */
export function NumericInput({
  value,
  onValueChange,
  onEmptyChange,
  min,
  max,
  fallback,
  allowDecimal = false,
  allowNegative = false,
  allowEmpty = false,
  integer = false,
  onFocus,
  onBlur,
  onKeyDown,
  className = '',
  dir = 'ltr',
  ...rest
}: NumericInputProps) {
  const formatPropValue = (v: number | ''): string => {
    if (v === '' || v === null || v === undefined || !Number.isFinite(Number(v))) return '';
    return String(v);
  };

  const [draft, setDraft] = useState<string>(() => formatPropValue(value));
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setDraft(formatPropValue(value));
    }
  }, [value]);

  const clampNumber = (n: number): number => {
    let result = integer ? Math.trunc(n) : n;
    if (min !== undefined && result < min) result = min;
    if (max !== undefined && result > max) result = max;
    return result;
  };

  const commitDraft = (rawText: string) => {
    const trimmed = rawText.trim();
    if (trimmed === '' || trimmed === '-' || trimmed === '.' || trimmed === '-.') {
      if (allowEmpty && onEmptyChange) {
        setDraft('');
        onEmptyChange();
        return;
      }
      const resolvedFallback =
        fallback !== undefined
          ? fallback
          : min !== undefined
            ? min
            : typeof value === 'number' && Number.isFinite(value)
              ? value
              : 0;
      const clamped = clampNumber(resolvedFallback);
      setDraft(String(clamped));
      onValueChange(clamped);
      return;
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      const resolvedFallback =
        fallback !== undefined ? fallback : min !== undefined ? min : 0;
      const clamped = clampNumber(resolvedFallback);
      setDraft(String(clamped));
      onValueChange(clamped);
      return;
    }

    const clamped = clampNumber(parsed);
    setDraft(String(clamped));
    onValueChange(clamped);
  };

  const handleChange = (raw: string) => {
    const normalized = normalizeNumericRaw(raw, allowDecimal && !integer, allowNegative);
    setDraft(normalized);

    if (normalized === '') {
      if (allowEmpty && onEmptyChange) {
        onEmptyChange();
      }
      return;
    }

    if (normalized === '-' || normalized === '.' || normalized === '-.' || normalized.endsWith('.')) {
      return;
    }

    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) return;

    // Emit live updates only when within valid range (never snap upward to `min` while typing!)
    if (min !== undefined && parsed < min) return;
    if (max !== undefined && parsed > max) return;

    const nextVal = integer ? Math.trunc(parsed) : parsed;
    onValueChange(nextVal);
  };

  const handleKeyDownInternal = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitDraft(draft);
    }
    onKeyDown?.(e);
  };

  return (
    <input
      {...rest}
      type="text"
      inputMode={allowDecimal && !integer ? 'decimal' : 'numeric'}
      autoComplete="off"
      dir={dir}
      value={draft}
      onFocus={(e) => {
        isFocusedRef.current = true;
        onFocus?.(e);
      }}
      onBlur={(e) => {
        isFocusedRef.current = false;
        commitDraft(e.target.value);
        onBlur?.(e);
      }}
      onKeyDown={handleKeyDownInternal}
      onChange={(e) => handleChange(e.target.value)}
      className={className}
    />
  );
}
