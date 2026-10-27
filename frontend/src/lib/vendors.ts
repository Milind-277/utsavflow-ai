// ═══════════════════════════════════════════════════════════
// lib/vendors.ts — Vendor-budget bridge logic
//
// Accounting rules:
//   enquiring: estimated = quotedCost, actual = 0
//   booked:    estimated = quotedCost, actual = amountPaid
//   cancelled: estimated = 0,          actual = 0
//
// These are PURE functions with NO side effects.
// ═══════════════════════════════════════════════════════════

import type { Vendor, PaymentStatus, BudgetSection, ExpenseItem } from '@/types'

// ── Derived status ──────────────────────────────────────────

/**
 * Derive payment status from amountPaid vs quotedCost.
 * This is always computed — never user-set.
 */
export function derivePaymentStatus(vendor: Pick<Vendor, 'amountPaid' | 'quotedCost'>): PaymentStatus {
  if (vendor.amountPaid <= 0)                       return 'unpaid'
  if (vendor.amountPaid < vendor.quotedCost)         return 'partial'
  return 'paid'
}

// ── Budget contribution ─────────────────────────────────────

/**
 * What estimated cost should a linked budget item show for this vendor?
 */
export function vendorBudgetEstimated(vendor: Vendor): number {
  if (vendor.bookingStatus === 'cancelled') return 0
  // enquiring and booked both surface the quote as an estimate
  return Math.max(0, vendor.quotedCost)
}

/**
 * What actual cost should a linked budget item show for this vendor?
 * Only booked vendors contribute to actual spending.
 * Deducts any recorded refunds so actual spending reflects net paid funds.
 */
export function vendorBudgetActual(vendor: Vendor): number {
  if (vendor.bookingStatus !== 'booked') return 0
  return Math.max(0, vendor.amountPaid - (vendor.refundAmount ?? 0))
}

/**
 * Calculate net money paid to a vendor after deducting recorded refunds.
 */
export function vendorNetPaid(vendor: Pick<Vendor, 'amountPaid'> & { refundAmount?: number }): number {
  const refund = vendor.refundAmount ?? 0
  return Math.max(0, vendor.amountPaid - refund)
}

/**
 * Calculate outstanding balance owed to a vendor.
 * Cancelled vendors have zero outstanding commitment.
 */
export function vendorOutstanding(
  vendor: Pick<Vendor, 'quotedCost' | 'amountPaid' | 'bookingStatus'>
): number {
  if (vendor.bookingStatus === 'cancelled') return 0
  return Math.max(0, vendor.quotedCost - vendor.amountPaid)
}

// ── Budget sync ─────────────────────────────────────────────

/**
 * Apply vendor changes to a budget section.
 * Updates all expense items linked to ANY of the provided vendors.
 * Returns a NEW BudgetSection (immutable update).
 *
 * This is the single update path — prevents double-counting by
 * ensuring only one mechanism sets item.estimated/actual when
 * a vendorId link exists.
 */
export function syncVendorsToBudget(
  budget: BudgetSection,
  vendors: Vendor[],
): BudgetSection {
  const vendorMap = new Map(vendors.map((v) => [v.id, v]))

  return {
    ...budget,
    categories: budget.categories.map((cat) => ({
      ...cat,
      items: cat.items.map((item): ExpenseItem => {
        if (!item.vendorId) return item
        const vendor = vendorMap.get(item.vendorId)
        if (!vendor) {
          // Linked vendor was removed — clear link and amounts
          return { ...item, vendorId: undefined, estimated: 0, actual: 0 }
        }
        return {
          ...item,
          estimated: vendorBudgetEstimated(vendor),
          actual:    vendorBudgetActual(vendor),
        }
      }),
    })),
  }
}

// ── Validation helpers ──────────────────────────────────────

/**
 * Check that amountPaid does not exceed quotedCost and refund does not exceed amountPaid.
 * Returns an error string or null.
 */
export function validateVendorPayment(
  vendor: Pick<Vendor, 'amountPaid' | 'quotedCost'> & { refundAmount?: number }
): string | null {
  if (!Number.isFinite(vendor.amountPaid) || vendor.amountPaid < 0) return 'Amount paid cannot be negative.'
  if (!Number.isFinite(vendor.quotedCost) || vendor.quotedCost < 0) return 'Quoted cost cannot be negative.'
  if (vendor.amountPaid > vendor.quotedCost) return 'Amount paid cannot exceed quoted cost.'
  if (vendor.refundAmount !== undefined) {
    if (!Number.isFinite(vendor.refundAmount) || vendor.refundAmount < 0) return 'Refund amount cannot be negative.'
    if (vendor.refundAmount > vendor.amountPaid) return 'Refund amount cannot exceed amount paid.'
  }
  return null
}

/**
 * Validate no duplicate vendorId links in a budget section.
 * Returns array of duplicate vendorIds (empty = valid).
 */
export function findDuplicateVendorLinks(budget: BudgetSection): string[] {
  const seen = new Set<string>()
  const duplicates: string[] = []
  for (const cat of budget.categories) {
    for (const item of cat.items) {
      if (item.vendorId) {
        if (seen.has(item.vendorId)) duplicates.push(item.vendorId)
        else seen.add(item.vendorId)
      }
    }
  }
  return duplicates
}
