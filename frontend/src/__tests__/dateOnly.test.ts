import { describe, it, expect } from 'vitest'
import {
  parseDateOnly,
  toLocalMidnight,
  calendarDaysBetween,
  daysUntilEvent,
  addCalendarDays,
  formatDateOnly,
  isPast,
  isFuture,
  isToday,
} from '@/lib/dateOnly'

describe('parseDateOnly', () => {
  it('parses a standard date correctly', () => {
    const d = parseDateOnly('2024-03-15')
    expect(d.getFullYear()).toBe(2024)
    expect(d.getMonth()).toBe(2)    // March = index 2
    expect(d.getDate()).toBe(15)
  })

  it('parses a leap day correctly (2024 is a leap year)', () => {
    const d = parseDateOnly('2024-02-29')
    expect(d.getFullYear()).toBe(2024)
    expect(d.getMonth()).toBe(1)   // February
    expect(d.getDate()).toBe(29)
  })

  it('throws for Feb 29 in a non-leap year', () => {
    expect(() => parseDateOnly('2023-02-29')).toThrow()
  })

  it('throws for an invalid day (Feb 30)', () => {
    expect(() => parseDateOnly('2024-02-30')).toThrow()
  })

  it('throws for malformed strings', () => {
    expect(() => parseDateOnly('not-a-date')).toThrow()
    expect(() => parseDateOnly('')).toThrow()
    expect(() => parseDateOnly('2024-13-01')).toThrow() // month 13 normalises
  })

  it('returns LOCAL midnight (not UTC midnight)', () => {
    const d = parseDateOnly('2024-06-15')
    // Should be midnight LOCAL — hours/minutes/seconds are 0
    expect(d.getHours()).toBe(0)
    expect(d.getMinutes()).toBe(0)
    expect(d.getSeconds()).toBe(0)
  })
})

describe('toLocalMidnight', () => {
  it('strips sub-day time from a date with time', () => {
    const d = new Date(2024, 5, 15, 14, 30, 45) // 2:30 PM local
    const midnight = toLocalMidnight(d)
    expect(midnight.getHours()).toBe(0)
    expect(midnight.getMinutes()).toBe(0)
    expect(midnight.getDate()).toBe(15)
  })
})

describe('calendarDaysBetween', () => {
  it('returns 1 for adjacent days', () => {
    const a = new Date(2024, 0, 31)  // Jan 31
    const b = new Date(2024, 1, 1)   // Feb 1
    expect(calendarDaysBetween(a, b)).toBe(1)
  })

  it('returns 1 across year boundary', () => {
    const a = new Date(2023, 11, 31) // Dec 31
    const b = new Date(2024, 0, 1)   // Jan 1
    expect(calendarDaysBetween(a, b)).toBe(1)
  })

  it('returns 1 from Feb 28 to Mar 1 in non-leap year', () => {
    const a = new Date(2023, 1, 28)  // Feb 28 2023
    const b = new Date(2023, 2, 1)   // Mar 1 2023
    expect(calendarDaysBetween(a, b)).toBe(1)
  })

  it('returns 2 from Feb 28 to Mar 1 in leap year', () => {
    const a = new Date(2024, 1, 28)  // Feb 28 2024
    const b = new Date(2024, 2, 1)   // Mar 1 2024
    expect(calendarDaysBetween(a, b)).toBe(2)
  })

  it('returns 0 for the same day', () => {
    const a = new Date(2024, 5, 15)
    expect(calendarDaysBetween(a, a)).toBe(0)
  })

  it('returns negative for past dates', () => {
    const a = new Date(2024, 5, 15)
    const b = new Date(2024, 5, 10)
    expect(calendarDaysBetween(a, b)).toBe(-5)
  })

  it('handles a large gap correctly', () => {
    const a = new Date(2020, 0, 1)
    const b = new Date(2025, 0, 1)
    // 5 years including 2 leap years (2020, 2024) = 365*5 + 2 = 1827
    expect(calendarDaysBetween(a, b)).toBe(1827)
  })
})

describe('daysUntilEvent', () => {
  it('returns negative for a past date', () => {
    const today = new Date(2024, 5, 15) // June 15
    expect(daysUntilEvent('2024-06-10', today)).toBe(-5)
  })

  it('returns 0 for today', () => {
    const today = new Date(2024, 5, 15)
    expect(daysUntilEvent('2024-06-15', today)).toBe(0)
  })

  it('returns 1 for tomorrow', () => {
    const today = new Date(2024, 5, 15)
    expect(daysUntilEvent('2024-06-16', today)).toBe(1)
  })

  it('handles month boundaries', () => {
    const today = new Date(2024, 0, 31) // Jan 31
    expect(daysUntilEvent('2024-02-01', today)).toBe(1)
  })
})

describe('addCalendarDays', () => {
  it('adds days across month boundary', () => {
    expect(addCalendarDays('2024-03-30', 2)).toBe('2024-04-01')
  })

  it('adds days across year boundary', () => {
    expect(addCalendarDays('2024-12-30', 3)).toBe('2025-01-02')
  })

  it('correctly lands on leap day', () => {
    expect(addCalendarDays('2024-02-27', 2)).toBe('2024-02-29')
  })

  it('correctly skips leap day in non-leap year', () => {
    expect(addCalendarDays('2023-02-27', 2)).toBe('2023-03-01')
  })

  it('handles negative offsets (subtracting days)', () => {
    expect(addCalendarDays('2024-03-01', -1)).toBe('2024-02-29') // leap year
    expect(addCalendarDays('2023-03-01', -1)).toBe('2023-02-28') // non-leap
  })

  it('handles zero offset', () => {
    expect(addCalendarDays('2024-06-15', 0)).toBe('2024-06-15')
  })
})

describe('formatDateOnly', () => {
  it('formats correctly with zero-padded month and day', () => {
    const d = new Date(2024, 2, 5)  // March 5 (month index 2)
    expect(formatDateOnly(d)).toBe('2024-03-05')
  })
})

describe('isPast / isToday / isFuture', () => {
  const today = new Date(2024, 5, 15) // June 15, 2024

  it('isPast returns true for yesterday', () => {
    expect(isPast('2024-06-14', today)).toBe(true)
  })

  it('isPast returns false for today', () => {
    expect(isPast('2024-06-15', today)).toBe(false)
  })

  it('isToday returns true for today', () => {
    expect(isToday('2024-06-15', today)).toBe(true)
  })

  it('isFuture returns true for tomorrow', () => {
    expect(isFuture('2024-06-16', today)).toBe(true)
  })

  it('isFuture returns false for today', () => {
    expect(isFuture('2024-06-15', today)).toBe(false)
  })
})
