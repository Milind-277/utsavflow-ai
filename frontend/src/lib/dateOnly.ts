// ═══════════════════════════════════════════════════════════
// lib/dateOnly.ts — Timezone-safe calendar-date arithmetic
//
// Strategy: Parse YYYY-MM-DD strings as LOCAL midnight using
// the Date(year, month, day) constructor (never new Date(str)
// which would parse as UTC and cause off-by-one errors in
// timezones behind UTC).
//
// All arithmetic normalises to local midnight before computing
// differences. Math.round() absorbs DST transitions where a
// calendar "day" is 23 or 25 clock-hours.
// ═══════════════════════════════════════════════════════════

/**
 * Parse a YYYY-MM-DD string as a local-midnight Date.
 * Safe in any timezone — never uses the UTC-parsing path.
 */
export function parseDateOnly(iso: string): Date {
  const parts = iso.split('-')
  if (parts.length !== 3) {
    throw new Error(`Invalid date string: "${iso}". Expected YYYY-MM-DD.`)
  }
  const y = Number(parts[0])
  const m = Number(parts[1])
  const d = Number(parts[2])
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    throw new Error(`Invalid date components in: "${iso}"`)
  }
  // new Date(year, monthIndex, day) → always LOCAL midnight
  const date = new Date(y, m - 1, d)
  // Validate: if month overflows (e.g. Feb 30), Date normalises it.
  // We detect this by checking the result matches input.
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    throw new Error(`Date "${iso}" is not a valid calendar date (day out of range for month).`)
  }
  return date
}

/**
 * Normalise any Date to LOCAL calendar-day midnight.
 * Strips sub-day time components; safe before arithmetic.
 */
export function toLocalMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/**
 * Calendar-day difference: how many days from `from` to `to`.
 * Positive = to is in the future. Negative = to is in the past.
 * Math.round() handles DST transitions (23 h or 25 h days).
 */
export function calendarDaysBetween(from: Date, to: Date): number {
  const a = toLocalMidnight(from).getTime()
  const b = toLocalMidnight(to).getTime()
  return Math.round((b - a) / (1000 * 60 * 60 * 24))
}

/**
 * Days from today (local) until the given event date string.
 * Negative = event is in the past.
 * today parameter is optional and defaults to new Date() — useful for testing.
 */
export function daysUntilEvent(eventDateIso: string, today: Date = new Date()): number {
  const eventDate = parseDateOnly(eventDateIso)
  return calendarDaysBetween(today, eventDate)
}

/**
 * Add offsetDays (may be negative) to a date string and return YYYY-MM-DD.
 * Uses setDate() which correctly handles month and year rollovers.
 */
export function addCalendarDays(iso: string, offsetDays: number): string {
  const d = parseDateOnly(iso)
  d.setDate(d.getDate() + offsetDays)
  return formatDateOnly(d)
}

/**
 * Serialize a Date to YYYY-MM-DD using local timezone components.
 */
export function formatDateOnly(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Get today's date as a YYYY-MM-DD string (local timezone).
 */
export function todayString(): string {
  return formatDateOnly(new Date())
}

/**
 * Is the given date string today?
 */
export function isToday(iso: string, today: Date = new Date()): boolean {
  return daysUntilEvent(iso, today) === 0
}

/**
 * Is the given date string strictly in the past?
 */
export function isPast(iso: string, today: Date = new Date()): boolean {
  return daysUntilEvent(iso, today) < 0
}

/**
 * Is the given date string strictly in the future?
 */
export function isFuture(iso: string, today: Date = new Date()): boolean {
  return daysUntilEvent(iso, today) > 0
}
