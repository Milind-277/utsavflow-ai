import { describe, it, expect } from 'vitest'
import {
  derivePaymentStatus,
  vendorBudgetEstimated,
  vendorBudgetActual,
  syncVendorsToBudget,
  validateVendorPayment,
  findDuplicateVendorLinks,
} from '@/lib/vendors'
import type { Vendor, BudgetSection } from '@/types'
import { VendorSchema } from '../types'

// ── Test Factories ──────────────────────────────────────────

function makeVendor(overrides: Partial<Vendor> = {}): Vendor {
  return {
    id: 'v1',
    category: 'venue',
    name: 'Test Vendor',
    contactInfo: '',
    quotedCost: 100_000,
    amountPaid: 0,
    bookingStatus: 'enquiring',
    paymentStatus: 'unpaid',
    notes: '',
    ...overrides,
  }
}

function makeBudget(itemOverrides: {
  id?: string
  allocated?: number
  estimated?: number
  actual?: number
  vendorId?: string
}[] = []): BudgetSection {
  return {
    contingencyPct: 10,
    categories: [
      {
        id: 'cat-1',
        name: 'Test',
        items: itemOverrides.map((o, i) => ({
          id: o.id ?? `item-${i}`,
          label: 'Test Item',
          allocated: o.allocated ?? 0,
          estimated: o.estimated ?? 0,
          actual: o.actual ?? 0,
          vendorId: o.vendorId,
          note: '',
        })),
      },
    ],
  }
}

// ── derivePaymentStatus ─────────────────────────────────────

describe('derivePaymentStatus', () => {
  it('returns unpaid when amountPaid is 0', () => {
    expect(derivePaymentStatus({ amountPaid: 0, quotedCost: 100_000 })).toBe('unpaid')
  })

  it('returns partial when amountPaid < quotedCost', () => {
    expect(derivePaymentStatus({ amountPaid: 40_000, quotedCost: 100_000 })).toBe('partial')
  })

  it('returns paid when amountPaid equals quotedCost', () => {
    expect(derivePaymentStatus({ amountPaid: 100_000, quotedCost: 100_000 })).toBe('paid')
  })

  it('returns unpaid when amountPaid is negative (defensive)', () => {
    expect(derivePaymentStatus({ amountPaid: -1, quotedCost: 100_000 })).toBe('unpaid')
  })
})

// ── vendorBudgetEstimated ───────────────────────────────────

describe('vendorBudgetEstimated', () => {
  it('enquiring → quotedCost (shows quote as estimate)', () => {
    const v = makeVendor({ bookingStatus: 'enquiring', quotedCost: 50_000 })
    expect(vendorBudgetEstimated(v)).toBe(50_000)
  })

  it('booked → quotedCost', () => {
    const v = makeVendor({ bookingStatus: 'booked', quotedCost: 50_000 })
    expect(vendorBudgetEstimated(v)).toBe(50_000)
  })

  it('cancelled → 0 (removed from accounting)', () => {
    const v = makeVendor({ bookingStatus: 'cancelled', quotedCost: 50_000 })
    expect(vendorBudgetEstimated(v)).toBe(0)
  })
})

// ── vendorBudgetActual ──────────────────────────────────────

describe('vendorBudgetActual', () => {
  it('enquiring → 0 (not an actual expense)', () => {
    const v = makeVendor({ bookingStatus: 'enquiring', amountPaid: 0 })
    expect(vendorBudgetActual(v)).toBe(0)
  })

  it('booked + unpaid → 0', () => {
    const v = makeVendor({ bookingStatus: 'booked', amountPaid: 0, quotedCost: 100_000 })
    expect(vendorBudgetActual(v)).toBe(0)
  })

  it('booked + partially paid → amountPaid', () => {
    const v = makeVendor({ bookingStatus: 'booked', amountPaid: 40_000, quotedCost: 100_000 })
    expect(vendorBudgetActual(v)).toBe(40_000)
  })

  it('booked + fully paid → amountPaid (= quotedCost)', () => {
    const v = makeVendor({ bookingStatus: 'booked', amountPaid: 100_000, quotedCost: 100_000 })
    expect(vendorBudgetActual(v)).toBe(100_000)
  })

  it('cancelled → 0', () => {
    const v = makeVendor({ bookingStatus: 'cancelled', amountPaid: 50_000 })
    expect(vendorBudgetActual(v)).toBe(0)
  })
})

// ── syncVendorsToBudget ─────────────────────────────────────

describe('syncVendorsToBudget', () => {
  it('updates estimated and actual for a booked vendor', () => {
    const vendor = makeVendor({
      id: 'v1',
      bookingStatus: 'booked',
      quotedCost: 80_000,
      amountPaid: 30_000,
    })
    const budget = makeBudget([{ id: 'item-0', vendorId: 'v1', estimated: 0, actual: 0 }])
    const updated = syncVendorsToBudget(budget, [vendor])
    const item = updated.categories[0].items[0]
    expect(item.estimated).toBe(80_000)
    expect(item.actual).toBe(30_000)
  })

  it('sets estimated and actual to 0 for cancelled vendor', () => {
    const vendor = makeVendor({ id: 'v1', bookingStatus: 'cancelled', quotedCost: 80_000 })
    const budget = makeBudget([{ id: 'item-0', vendorId: 'v1', estimated: 80_000, actual: 0 }])
    const updated = syncVendorsToBudget(budget, [vendor])
    const item = updated.categories[0].items[0]
    expect(item.estimated).toBe(0)
    expect(item.actual).toBe(0)
  })

  it('clears link and amounts when vendor is removed from list', () => {
    const budget = makeBudget([{ id: 'item-0', vendorId: 'v1', estimated: 50_000, actual: 20_000 }])
    // Pass empty vendors list (vendor removed)
    const updated = syncVendorsToBudget(budget, [])
    const item = updated.categories[0].items[0]
    expect(item.vendorId).toBeUndefined()
    expect(item.estimated).toBe(0)
    expect(item.actual).toBe(0)
  })

  it('does not touch unlinked items', () => {
    const vendor = makeVendor({ id: 'v1', bookingStatus: 'booked', quotedCost: 80_000, amountPaid: 80_000 })
    const budget = makeBudget([
      { id: 'item-0', vendorId: 'v1', estimated: 0, actual: 0 },
      { id: 'item-1', estimated: 50_000, actual: 20_000 },  // no vendorId
    ])
    const updated = syncVendorsToBudget(budget, [vendor])
    const unlinked = updated.categories[0].items[1]
    expect(unlinked.estimated).toBe(50_000)  // unchanged
    expect(unlinked.actual).toBe(20_000)     // unchanged
  })

  it('does not double-count when a single vendor is linked to one item', () => {
    const vendor = makeVendor({
      id: 'v1',
      bookingStatus: 'booked',
      quotedCost: 100_000,
      amountPaid: 100_000,
    })
    const budget = makeBudget([{ id: 'item-0', vendorId: 'v1' }])
    const updated = syncVendorsToBudget(budget, [vendor])
    // Only one item should have actual = 100,000; total should be 100,000, not 200,000
    const total = updated.categories[0].items.reduce((s, i) => s + i.actual, 0)
    expect(total).toBe(100_000)
  })
})

// ── validateVendorPayment ───────────────────────────────────

describe('validateVendorPayment', () => {
  it('returns null for valid payment', () => {
    expect(validateVendorPayment({ amountPaid: 50_000, quotedCost: 100_000 })).toBeNull()
  })

  it('returns error when amountPaid > quotedCost', () => {
    const err = validateVendorPayment({ amountPaid: 110_000, quotedCost: 100_000 })
    expect(err).not.toBeNull()
    expect(err).toMatch(/exceed/i)
  })

  it('returns error for negative amountPaid', () => {
    const err = validateVendorPayment({ amountPaid: -1, quotedCost: 100_000 })
    expect(err).not.toBeNull()
  })

  it('returns error for negative quotedCost', () => {
    const err = validateVendorPayment({ amountPaid: 0, quotedCost: -1 })
    expect(err).not.toBeNull()
  })

  it('allows amountPaid === quotedCost (fully paid)', () => {
    expect(validateVendorPayment({ amountPaid: 100_000, quotedCost: 100_000 })).toBeNull()
  })

  it('allows zero amountPaid (unpaid)', () => {
    expect(validateVendorPayment({ amountPaid: 0, quotedCost: 0 })).toBeNull()
  })
})

// ── findDuplicateVendorLinks ────────────────────────────────

describe('findDuplicateVendorLinks', () => {
  it('returns empty array when no duplicates', () => {
    const budget = makeBudget([
      { id: 'i1', vendorId: 'v1' },
      { id: 'i2', vendorId: 'v2' },
    ])
    expect(findDuplicateVendorLinks(budget)).toHaveLength(0)
  })

  it('detects duplicate vendorId', () => {
    const budget = makeBudget([
      { id: 'i1', vendorId: 'v1' },
      { id: 'i2', vendorId: 'v1' },  // duplicate
    ])
    const dups = findDuplicateVendorLinks(budget)
    expect(dups).toContain('v1')
  })

  it('ignores items without vendorId', () => {
    const budget = makeBudget([
      { id: 'i1' },
      { id: 'i2' },
    ])
    expect(findDuplicateVendorLinks(budget)).toHaveLength(0)
  })
})

// ── Zod schema: amountPaid > quotedCost rejected ────────────

describe('Vendor Zod schema', () => {
  it('rejects amountPaid > quotedCost', () => {
    const result = VendorSchema.safeParse({
      id: 'v1',
      category: 'venue',
      name: 'Test',
      contactInfo: '',
      quotedCost: 100_000,
      amountPaid: 200_000,   // > quotedCost
      bookingStatus: 'booked',
      paymentStatus: 'paid',
      notes: '',
    })
    expect(result.success).toBe(false)
  })
})
