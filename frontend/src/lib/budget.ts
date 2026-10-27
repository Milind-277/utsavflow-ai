// ═══════════════════════════════════════════════════════════
// lib/budget.ts — Pure budget calculation functions
//
// Accounting model:
//   allocated = planned envelope per item
//   estimated = expected cost (= vendor.quotedCost when linked)
//   actual    = money spent  (= vendor.amountPaid when linked)
//
// Invariants enforced:
//   1. unallocatedFunds  = max(0, slack)
//   2. allocationOverage = max(0, -slack)
//      where slack = totalBudget - totalAllocated - contingencyReserve
//   3. All amounts >= 0
//   4. contingencyPct ∈ [0, 30]
//
// These are PURE functions with NO side effects.
// ═══════════════════════════════════════════════════════════

import type { BudgetCategory, BudgetSection, BudgetSummary, ExpenseItem } from '@/types'

// ── Item-level ─────────────────────────────────────────────

export function itemAllocated(item: ExpenseItem): number {
  return Math.max(0, item.allocated)
}

export function itemEstimated(item: ExpenseItem): number {
  return Math.max(0, item.estimated)
}

export function itemActual(item: ExpenseItem): number {
  return Math.max(0, item.actual)
}

// ── Category-level ─────────────────────────────────────────

export function categoryAllocated(cat: BudgetCategory): number {
  return cat.items.reduce((sum, item) => sum + itemAllocated(item), 0)
}

export function categoryEstimated(cat: BudgetCategory): number {
  return cat.items.reduce((sum, item) => sum + itemEstimated(item), 0)
}

export function categoryActual(cat: BudgetCategory): number {
  return cat.items.reduce((sum, item) => sum + itemActual(item), 0)
}

// ── Section-level ───────────────────────────────────────────

export function totalAllocated(budget: BudgetSection): number {
  return budget.categories.reduce((sum, cat) => sum + categoryAllocated(cat), 0)
}

export function totalEstimated(budget: BudgetSection): number {
  return budget.categories.reduce((sum, cat) => sum + categoryEstimated(cat), 0)
}

export function totalActual(budget: BudgetSection): number {
  return budget.categories.reduce((sum, cat) => sum + categoryActual(cat), 0)
}

// ── Reserve ─────────────────────────────────────────────────

export function contingencyReserve(budget: BudgetSection, totalBudget: number): number {
  const pct = Math.max(0, Math.min(30, budget.contingencyPct))
  return Math.floor(totalBudget * pct / 100)
}

// ── Summary ─────────────────────────────────────────────────

/**
 * Compute the full budget summary from raw data.
 * All values are computed from scratch — never trust client-supplied totals.
 */
export function computeBudgetSummary(
  budget: BudgetSection,
  totalBudget: number,
): BudgetSummary {
  const allocated  = totalAllocated(budget)
  const estimated  = totalEstimated(budget)
  const actual     = totalActual(budget)
  const reserve    = contingencyReserve(budget, totalBudget)

  // slack can be negative (over-allocated)
  const slack = totalBudget - allocated - reserve

  return {
    totalBudget,
    totalAllocated:    allocated,
    totalEstimated:    estimated,
    totalActual:       actual,
    contingencyReserve: reserve,
    unallocatedFunds:  Math.max(0, slack),
    allocationOverage: Math.max(0, -slack),
    remainingBudget:   totalBudget - actual - reserve,
    isOverAllocated:   slack < 0,
    isOverspent:       actual > totalBudget - reserve,
  }
}

// ── Invariant Checks (for tests and debug assertions) ────────

/**
 * Returns an array of violated invariant strings.
 * An empty array means all invariants hold.
 */
export function checkBudgetInvariants(
  budget: BudgetSection,
  totalBudget: number,
): string[] {
  const violations: string[] = []
  const summary = computeBudgetSummary(budget, totalBudget)

  // 1. unallocatedFunds - allocationOverage === slack
  const slack = totalBudget - summary.totalAllocated - summary.contingencyReserve
  const computedSlack = summary.unallocatedFunds - summary.allocationOverage
  if (computedSlack !== slack) {
    violations.push(
      `Slack mismatch: expected ${slack}, got unallocated(${summary.unallocatedFunds}) - overage(${summary.allocationOverage}) = ${computedSlack}`
    )
  }

  // 2. No negative amounts
  for (const cat of budget.categories) {
    for (const item of cat.items) {
      if (item.allocated < 0) violations.push(`Item "${item.id}" has negative allocated: ${item.allocated}`)
      if (item.estimated < 0) violations.push(`Item "${item.id}" has negative estimated: ${item.estimated}`)
      if (item.actual    < 0) violations.push(`Item "${item.id}" has negative actual: ${item.actual}`)
    }
  }

  // 3. contingencyPct in range
  if (budget.contingencyPct < 0 || budget.contingencyPct > 30) {
    violations.push(`contingencyPct ${budget.contingencyPct} is out of range [0, 30]`)
  }

  return violations
}
