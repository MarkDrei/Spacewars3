/**
 * Central number formatting utilities for the Spacewars UI.
 *
 * ## Formatting contract
 *
 * `formatNumber(value)` applies the following rules:
 *
 * 1. **All integer digits are always shown** – the integer part is never
 *    rounded or truncated.  Thousand-separators (`,`) are added for readability.
 * 2. **Decimal digits are capped so that the total displayed significant
 *    figures do not exceed 3.**
 *    - Values with ≥ 3 integer digits → no decimal part  (e.g. `16,202`)
 *    - Values with 2 integer digits  → 1 decimal place   (e.g. `43.2`)
 *    - Values with 1 integer digit   → 2 decimal places  (e.g. `2.23`)
 *    - Values < 1                    → `toPrecision(3)`   (e.g. `0.00123`)
 * 3. **Trailing decimal zeros are stripped** so `10.0` displays as `10`.
 *
 * Examples that pass the formatting contract:
 *   `16,202`   `2.23`   `43.2`   `100`   `0.00123`
 *
 * Counter-examples (these must NOT appear):
 *   `1.2323`   `16,202.03`
 */

/**
 * Format a numeric value according to the 3-significant-figure / all-integer-digits
 * rule described in this module's JSDoc.
 *
 * @param value - The number to format.
 * @returns A formatted string with thousand separators and at most 3 significant
 *          figures in the decimal portion.
 *
 * @example
 * formatNumber(16202)    // "16,202"
 * formatNumber(43.2456)  // "43.2"
 * formatNumber(2.2345)   // "2.23"
 * formatNumber(100.5)    // "101"
 * formatNumber(0.001234) // "0.00123"
 * formatNumber(0)        // "0"
 */
export function formatNumber(value: number): string {
  if (!isFinite(value)) return String(value);
  if (value === 0) return '0';

  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  // --- Values less than 1 ---
  // Use toPrecision(3) so that leading zeros after the decimal are preserved
  // and the result has exactly 3 significant figures.
  if (absValue < 1) {
    const str = absValue.toPrecision(3);

    if (str.includes('e')) {
      // Extremely small numbers (e.g. 1.23e-20) – keep exponential notation.
      return sign + str;
    }

    // Strip trailing zeros (e.g. "0.100" → "0.1")
    const [intPart, decPart] = str.split('.');
    const trimmed = decPart ? decPart.replace(/0+$/, '') : '';
    return sign + intPart + (trimmed ? '.' + trimmed : '');
  }

  // --- Values >= 1 ---
  // Determine how many integer digits the value has, then derive how many
  // decimal places are needed to reach 3 significant figures in total.
  const integerDigits = String(Math.floor(absValue)).length;
  const targetDecimalPlaces = Math.max(0, 3 - integerDigits);

  if (targetDecimalPlaces === 0) {
    return sign + Math.round(absValue).toLocaleString('en-US');
  }

  // Round to the target decimal places.  Rounding may carry over and increase
  // the integer part (e.g. 9.999 → 10.00), so recalculate after rounding.
  const rounded = Number(absValue.toFixed(targetDecimalPlaces));
  const newIntDigits = String(Math.floor(rounded)).length;
  const finalDecimalPlaces = Math.max(0, 3 - newIntDigits);

  if (finalDecimalPlaces === 0) {
    return sign + Math.round(rounded).toLocaleString('en-US');
  }

  const [intStr, decStr] = rounded.toFixed(finalDecimalPlaces).split('.');
  const trimmedDec = decStr.replace(/0+$/, '');
  const intWithSep = parseInt(intStr).toLocaleString('en-US');

  return trimmedDec
    ? sign + intWithSep + '.' + trimmedDec
    : sign + intWithSep;
}
