import { describe, it, expect } from 'vitest'
import { formatINR, parseINRInput, formatINRCompact, roundToRupees } from '@/lib/currency'

describe('formatINR', () => {
  it('formats zero', () => {
    expect(formatINR(0)).toMatch(/₹\s*0/)
  })

  it('formats hundreds', () => {
    const result = formatINR(999)
    expect(result).toContain('999')
    expect(result).toContain('₹')
  })

  it('formats thousands with Indian number system (1,000)', () => {
    const result = formatINR(1000)
    expect(result).toContain('1,000')
  })

  it('formats lakhs with Indian number system (1,00,000)', () => {
    const result = formatINR(100000)
    expect(result).toContain('1,00,000')
  })

  it('formats ten lakhs (10,00,000)', () => {
    const result = formatINR(1000000)
    expect(result).toContain('10,00,000')
  })

  it('returns ₹— for NaN', () => {
    expect(formatINR(NaN)).toBe('₹—')
  })

  it('returns ₹— for Infinity', () => {
    expect(formatINR(Infinity)).toBe('₹—')
  })

  it('returns ₹— for -Infinity', () => {
    expect(formatINR(-Infinity)).toBe('₹—')
  })

  it('rounds fractional amounts', () => {
    // 100.7 should be formatted as 101
    const result = formatINR(100.7)
    expect(result).toContain('101')
  })

  it('formats large amounts (1 crore)', () => {
    const result = formatINR(10000000)
    expect(result).toContain('₹')
    expect(result).toContain('1,00,00,000')
  })
})

describe('parseINRInput', () => {
  it('parses a plain integer string', () => {
    expect(parseINRInput('5000')).toBe(5000)
  })

  it('strips the ₹ symbol', () => {
    expect(parseINRInput('₹1,00,000')).toBe(100000)
  })

  it('strips commas', () => {
    expect(parseINRInput('1,000')).toBe(1000)
  })

  it('strips spaces', () => {
    expect(parseINRInput('10 000')).toBe(10000)
  })

  it('returns 0 for empty string', () => {
    expect(parseINRInput('')).toBe(0)
  })

  it('returns 0 for non-numeric string', () => {
    expect(parseINRInput('abc')).toBe(0)
  })

  it('returns 0 for ₹ only', () => {
    expect(parseINRInput('₹')).toBe(0)
  })

  it('does not allow negative amounts (strips minus sign)', () => {
    // Our parser strips non-digits, so -100 becomes 100
    expect(parseINRInput('-100')).toBe(100)
  })

  it('handles extremely large numbers without overflow', () => {
    const result = parseINRInput('9'.repeat(20))
    expect(result).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER)
  })
})

describe('formatINRCompact', () => {
  it('formats below 1000 as plain rupees', () => {
    expect(formatINRCompact(500)).toBe('₹500')
  })

  it('formats thousands as K', () => {
    expect(formatINRCompact(50000)).toBe('₹50.0K')
  })

  it('formats lakhs as L', () => {
    expect(formatINRCompact(500000)).toBe('₹5.0L')
  })

  it('formats crores as Cr', () => {
    expect(formatINRCompact(10000000)).toBe('₹1.0Cr')
  })

  it('returns ₹— for NaN', () => {
    expect(formatINRCompact(NaN)).toBe('₹—')
  })
})

describe('roundToRupees', () => {
  it('rounds .5 up', () => {
    expect(roundToRupees(100.5)).toBe(101)
  })

  it('rounds .4 down', () => {
    expect(roundToRupees(100.4)).toBe(100)
  })

  it('returns 0 for NaN', () => {
    expect(roundToRupees(NaN)).toBe(0)
  })

  it('returns 0 for Infinity', () => {
    expect(roundToRupees(Infinity)).toBe(0)
  })
})
