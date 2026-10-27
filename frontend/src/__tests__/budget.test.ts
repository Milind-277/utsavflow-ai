import { describe, it, expect } from 'vitest'
import {
  computeBudgetSummary,
  categoryAllocated,
  categoryEstimated,
  categoryActual,
  totalAllocated,
  totalActual,
  contingencyReserve,
  checkBudgetInvariants,
} from '@/lib/budget'
import type { BudgetSection, BudgetCategory } from '@/types'

// ── Test Factories ──────────────────────────────────────────

function makeCategory(
  overrides: Partial<BudgetCategory> & { items?: BudgetCategory['items'] } = {}
): BudgetCategory {
  return {
    id: 'cat-1',
    name: 'Test Category',
    items: overrides.items ?? [
      { id: 'i1', label: 'Item 1', allocated: 1000, estimated: 900, actual: 500, note: '' },
      { id: 'i2', label: 'Item 2', allocated: 2000, estimated: 1800, actual: 1200, note: '' },
    ],
    ...overrides,
  }
}

function makeBudget(
  categories: BudgetCategory[],
  contingencyPct = 10,
): BudgetSection {
  return { categories, contingencyPct }
}

// ── Category-level ─────────────────────────────────────────

describe('categoryAllocated / Estimated / Actual', () => {
  it('sums allocated across items', () => {
    const cat = makeCategory()
    expect(categoryAllocated(cat)).toBe(3000)
  })

  it('sums estimated across items', () => {
    const cat = makeCategory()
    expect(categoryEstimated(cat)).toBe(2700)
  })

  it('sums actual across items', () => {
    const cat = makeCategory()
    expect(categoryActual(cat)).toBe(1700)
  })

  it('handles empty items array', () => {
    const cat = makeCategory({ items: [] })
    expect(categoryAllocated(cat)).toBe(0)
    expect(categoryEstimated(cat)).toBe(0)
    expect(categoryActual(cat)).toBe(0)
  })

  it('clamps negative amounts to 0', () => {
    const cat = makeCategory({
      items: [{ id: 'i1', label: 'X', allocated: -100, estimated: -50, actual: -200, note: '' }],
    })
    expect(categoryAllocated(cat)).toBe(0)
    expect(categoryActual(cat)).toBe(0)
  })
})

// ── contingencyReserve ─────────────────────────────────────

describe('contingencyReserve', () => {
  it('computes 10% of 1,000,000', () => {
    const budget = makeBudget([], 10)
    expect(contingencyReserve(budget, 1_000_000)).toBe(100_000)
  })

  it('floors fractional results', () => {
    // 8% of 1,500,000 = 120,000 (exact)
    const budget = makeBudget([], 8)
    expect(contingencyReserve(budget, 1_500_000)).toBe(120_000)
  })

  it('returns 0 for 0% contingency', () => {
    const budget = makeBudget([], 0)
    expect(contingencyReserve(budget, 1_000_000)).toBe(0)
  })

  it('clamps contingencyPct above 30 to 30', () => {
    const budget = makeBudget([], 50) // invalid, should be clamped
    const reserve = contingencyReserve(budget, 1_000_000)
    expect(reserve).toBe(300_000)  // 30% of 1M
  })

  it('clamps negative contingencyPct to 0', () => {
    const budget = makeBudget([], -5)
    expect(contingencyReserve(budget, 1_000_000)).toBe(0)
  })
})

// ── computeBudgetSummary — within-budget ───────────────────

describe('computeBudgetSummary — within budget', () => {
  const budget = makeBudget([
    makeCategory({
      items: [
        { id: 'i1', label: 'A', allocated: 300_000, estimated: 280_000, actual: 100_000, note: '' },
        { id: 'i2', label: 'B', allocated: 200_000, estimated: 180_000, actual: 85_000, note: '' },
      ],
    }),
  ], 10)
  const totalBudget = 1_000_000

  const summary = computeBudgetSummary(budget, totalBudget)

  it('totalBudget is correct', () => {
    expect(summary.totalBudget).toBe(1_000_000)
  })

  it('totalAllocated is sum of all items', () => {
    expect(summary.totalAllocated).toBe(500_000)
  })

  it('totalEstimated is correct', () => {
    expect(summary.totalEstimated).toBe(460_000)
  })

  it('totalActual is correct', () => {
    expect(summary.totalActual).toBe(185_000)
  })

  it('contingencyReserve is 10% of totalBudget', () => {
    expect(summary.contingencyReserve).toBe(100_000)
  })

  it('unallocatedFunds = totalBudget - allocated - reserve', () => {
    // 1,000,000 - 500,000 - 100,000 = 400,000
    expect(summary.unallocatedFunds).toBe(400_000)
  })

  it('allocationOverage is 0 when not over-allocated', () => {
    expect(summary.allocationOverage).toBe(0)
  })

  it('remainingBudget = totalBudget - actual - reserve', () => {
    // 1,000,000 - 185,000 - 100,000 = 715,000
    expect(summary.remainingBudget).toBe(715_000)
  })

  it('isOverAllocated is false', () => {
    expect(summary.isOverAllocated).toBe(false)
  })

  it('isOverspent is false', () => {
    expect(summary.isOverspent).toBe(false)
  })
})

// ── computeBudgetSummary — over-allocated ──────────────────

describe('computeBudgetSummary — over-allocated', () => {
  const budget = makeBudget([
    makeCategory({
      items: [
        { id: 'i1', label: 'A', allocated: 700_000, estimated: 650_000, actual: 200_000, note: '' },
        { id: 'i2', label: 'B', allocated: 400_000, estimated: 380_000, actual: 0, note: '' },
      ],
    }),
  ], 10)  // 10% reserve = 100,000
  const totalBudget = 1_000_000

  const summary = computeBudgetSummary(budget, totalBudget)

  it('totalAllocated exceeds totalBudget - reserve', () => {
    // allocated = 1,100,000; budget - reserve = 900,000 → over by 200,000
    expect(summary.totalAllocated).toBe(1_100_000)
  })

  it('unallocatedFunds is clamped to 0 (not negative)', () => {
    expect(summary.unallocatedFunds).toBe(0)
  })

  it('allocationOverage reflects the over-allocation', () => {
    // slack = 1,000,000 - 1,100,000 - 100,000 = -200,000 → overage = 200,000
    expect(summary.allocationOverage).toBe(200_000)
  })

  it('isOverAllocated is true', () => {
    expect(summary.isOverAllocated).toBe(true)
  })

  it('isOverspent is false (actual is within budget)', () => {
    // actual = 200,000 which is < 900,000
    expect(summary.isOverspent).toBe(false)
  })
})

// ── computeBudgetSummary — overspent ──────────────────────

describe('computeBudgetSummary — overspent', () => {
  const budget = makeBudget([
    makeCategory({
      items: [
        { id: 'i1', label: 'A', allocated: 300_000, estimated: 280_000, actual: 950_000, note: '' },
      ],
    }),
  ], 10)
  const totalBudget = 1_000_000
  const summary = computeBudgetSummary(budget, totalBudget)

  it('isOverspent is true when actual exceeds budget - reserve', () => {
    // actual = 950,000; budget - reserve = 900,000 → overspent
    expect(summary.isOverspent).toBe(true)
  })

  it('remainingBudget is negative when overspent', () => {
    // 1,000,000 - 950,000 - 100,000 = -50,000
    expect(summary.remainingBudget).toBe(-50_000)
  })
})

// ── Budget invariant: unallocated - overage === slack ──────

describe('budget invariant: unallocated - overage = slack', () => {
  const cases = [
    { totalBudget: 1_000_000, allocated: 500_000, pct: 10 },  // normal
    { totalBudget: 1_000_000, allocated: 1_100_000, pct: 10 }, // over-allocated
    { totalBudget: 0, allocated: 0, pct: 0 },                  // zero budget
    { totalBudget: 1_000_000, allocated: 900_000, pct: 10 },   // exactly at limit
  ]

  for (const { totalBudget, allocated, pct } of cases) {
    it(`holds for budget=${totalBudget}, allocated=${allocated}, pct=${pct}`, () => {
      const budget = makeBudget([
        makeCategory({
          items: [{ id: 'i1', label: 'X', allocated, estimated: 0, actual: 0, note: '' }],
        }),
      ], pct)
      const summary = computeBudgetSummary(budget, totalBudget)
      const reserve = summary.contingencyReserve
      const slack = totalBudget - allocated - reserve
      expect(summary.unallocatedFunds - summary.allocationOverage).toBe(slack)
    })
  }
})

// ── totalAllocated across multiple categories ──────────────

describe('totalAllocated across multiple categories', () => {
  it('sums correctly', () => {
    const budget = makeBudget([
      makeCategory({ items: [{ id: 'i1', label: 'A', allocated: 100_000, estimated: 0, actual: 0, note: '' }] }),
      makeCategory({ id: 'cat-2', name: 'Cat 2', items: [{ id: 'i2', label: 'B', allocated: 200_000, estimated: 0, actual: 0, note: '' }] }),
    ])
    expect(totalAllocated(budget)).toBe(300_000)
  })

  it('handles empty budget', () => {
    const budget = makeBudget([])
    expect(totalAllocated(budget)).toBe(0)
    expect(totalActual(budget)).toBe(0)
  })
})

// ── checkBudgetInvariants ──────────────────────────────────

describe('checkBudgetInvariants', () => {
  it('returns no violations for a valid budget', () => {
    const budget = makeBudget([makeCategory()])
    const violations = checkBudgetInvariants(budget, 1_000_000)
    expect(violations).toHaveLength(0)
  })

  it('detects negative allocated', () => {
    const budget = makeBudget([
      makeCategory({ items: [{ id: 'i1', label: 'X', allocated: -1, estimated: 0, actual: 0, note: '' }] }),
    ])
    const violations = checkBudgetInvariants(budget, 1_000_000)
    expect(violations.some((v) => v.includes('negative allocated'))).toBe(true)
  })

  it('detects contingencyPct out of range', () => {
    const budget = makeBudget([], 35)
    const violations = checkBudgetInvariants(budget, 1_000_000)
    expect(violations.some((v) => v.includes('out of range'))).toBe(true)
  })
})
