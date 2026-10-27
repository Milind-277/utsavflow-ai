// ═══════════════════════════════════════════════════════════
// lib/currency.ts — INR formatting and parsing
//
// Rules:
// - All stored amounts are non-negative integers (whole INR, no paise).
// - Formatting uses Intl.NumberFormat with en-IN locale.
// - Parsing strips all non-digit characters; NaN → 0.
// - Fractional input is rounded (Math.round) on save.
// - No floating-point arithmetic chains — amounts are integer sums.
// ═══════════════════════════════════════════════════════════

const INR_FORMATTER = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
})

/**
 * Format a number as Indian Rupees (₹X,XX,XXX format).
 * Returns '₹—' for non-finite values.
 */
export function formatINR(amount: number): string {
  if (!Number.isFinite(amount)) return '₹—'
  return INR_FORMATTER.format(Math.round(amount))
}

/**
 * Parse a user-typed string into a non-negative integer rupee amount.
 * Strips everything except digits. NaN → 0.
 * Clamps to MAX_SAFE_INTEGER.
 */
export function parseINRInput(raw: string): number {
  const cleaned = raw.replace(/[^0-9]/g, '')
  if (cleaned === '') return 0
  const n = parseInt(cleaned, 10)
  if (!Number.isFinite(n) || isNaN(n)) return 0
  return Math.min(n, Number.MAX_SAFE_INTEGER)
}

/**
 * Safely round a number to the nearest integer for storage.
 * Returns 0 for NaN or Infinity.
 */
export function roundToRupees(amount: number): number {
  if (!Number.isFinite(amount)) return 0
  return Math.round(amount)
}

/**
 * Compact human-readable INR: 1,00,000 → ₹1L; 1,00,00,000 → ₹1Cr
 * Used for space-constrained displays (e.g. chart labels).
 */
export function formatINRCompact(amount: number): string {
  if (!Number.isFinite(amount)) return '₹—'
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''
  if (abs >= 1_00_00_000) {
    return `${sign}₹${(abs / 1_00_00_000).toFixed(1)}Cr`
  }
  if (abs >= 1_00_000) {
    return `${sign}₹${(abs / 1_00_000).toFixed(1)}L`
  }
  if (abs >= 1_000) {
    return `${sign}₹${(abs / 1_000).toFixed(1)}K`
  }
  return `${sign}₹${abs}`
}
