import React, { useState } from 'react'
import { nanoid } from 'nanoid'
import type { EventPlan, ExpenseItem, BudgetCategory, BudgetSection } from '@/types'
import {
  computeBudgetSummary,
  categoryAllocated,
  categoryEstimated,
  categoryActual,
  checkBudgetInvariants,
} from '@/lib/budget'
import { syncVendorsToBudget } from '@/lib/vendors'
import { formatINR } from '@/lib/currency'
import { ExpenseModal } from './ExpenseModal'
import { CategoryModal } from './CategoryModal'
import { ConfirmDialog } from './ConfirmDialog'

interface BudgetTabProps {
  plan: EventPlan
  onUpdatePlan?: (updatedPlan: EventPlan) => void
}

export function BudgetTab({ plan, onUpdatePlan }: BudgetTabProps): React.JSX.Element {
  const summary = computeBudgetSummary(plan.budget, plan.budgetTotal)
  const slack = plan.budgetTotal - summary.totalAllocated - summary.contingencyReserve

  // Expense modal state
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false)
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<ExpenseItem | null>(null)

  // Category modal state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)

  // Confirmation dialogs
  const [deleteItemTarget, setDeleteItemTarget] = useState<{
    categoryId: string
    itemId: string
    label: string
    isVendorLinked: boolean
  } | null>(null)

  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<{
    categoryId: string
    name: string
    itemCount: number
  } | null>(null)

  // Success / error message banner
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const showFeedback = (type: 'success' | 'error', message: string): void => {
    setFeedback({ type, message })
    setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev))
    }, 4000)
  }

  // ── Helper: Save updated budget and sync ──────────────────
  const applyBudgetUpdate = (
    newBudget: BudgetSection,
    actionDesc: string,
    unlinkedVendorId?: string
  ): void => {
    // 1. Re-sync with vendors to maintain single source of truth for vendor-linked items
    const syncedBudget = syncVendorsToBudget(newBudget, plan.vendors)

    // 2. If an item was deleted that was linked to a vendor, clear linkedBudgetItemId on that vendor
    const updatedVendors = unlinkedVendorId
      ? plan.vendors.map((v) => (v.id === unlinkedVendorId ? { ...v, linkedBudgetItemId: undefined } : v))
      : plan.vendors

    // 3. Verify invariants
    const invariantErrors = checkBudgetInvariants(syncedBudget, plan.budgetTotal)
    if (invariantErrors.length > 0) {
      showFeedback('error', `Accounting violation: ${invariantErrors[0]}`)
      return
    }

    const updatedPlan: EventPlan = {
      ...plan,
      budget: syncedBudget,
      vendors: updatedVendors,
      updatedAt: new Date().toISOString(),
    }

    if (onUpdatePlan) {
      onUpdatePlan(updatedPlan)
    }
    showFeedback('success', actionDesc)
  }

  // ── Contingency Percentage Adjustment ─────────────────────
  const handleContingencyChange = (newPct: number): void => {
    const clamped = Math.max(0, Math.min(30, Math.round(newPct)))
    const updatedBudget: BudgetSection = {
      ...plan.budget,
      contingencyPct: clamped,
    }
    applyBudgetUpdate(updatedBudget, `Contingency reserve updated to ${clamped}%`)
  }

  // ── Category Actions ──────────────────────────────────────
  const handleAddCategory = (name: string): void => {
    const newCategory: BudgetCategory = {
      id: `cat-${nanoid(8)}`,
      name,
      items: [],
    }
    const updatedBudget: BudgetSection = {
      ...plan.budget,
      categories: [...plan.budget.categories, newCategory],
    }
    setIsCategoryModalOpen(false)
    applyBudgetUpdate(updatedBudget, `Category "${name}" added successfully.`)
  }

  const handleDeleteCategoryConfirm = (): void => {
    if (!deleteCategoryTarget) return
    const targetCat = plan.budget.categories.find((c) => c.id === deleteCategoryTarget.categoryId)
    const linkedVendorIds = targetCat?.items.map((i) => i.vendorId).filter(Boolean) as string[] | undefined

    const updatedCategories = plan.budget.categories.filter((c) => c.id !== deleteCategoryTarget.categoryId)
    const updatedBudget: BudgetSection = {
      ...plan.budget,
      categories: updatedCategories,
    }

    // Unlink any vendors that were attached to items in this deleted category
    let updatedVendors = plan.vendors
    if (linkedVendorIds && linkedVendorIds.length > 0) {
      const set = new Set(linkedVendorIds)
      updatedVendors = plan.vendors.map((v) => (set.has(v.id) ? { ...v, linkedBudgetItemId: undefined } : v))
    }

    setDeleteCategoryTarget(null)
    const updatedPlan: EventPlan = {
      ...plan,
      budget: updatedBudget,
      vendors: updatedVendors,
      updatedAt: new Date().toISOString(),
    }
    if (onUpdatePlan) onUpdatePlan(updatedPlan)
    showFeedback('success', `Category "${deleteCategoryTarget.name}" deleted.`)
  }

  // ── Expense Item Actions ──────────────────────────────────
  const openAddExpenseModal = (categoryId: string): void => {
    setActiveCategoryId(categoryId)
    setEditingItem(null)
    setIsExpenseModalOpen(true)
  }

  const openEditExpenseModal = (categoryId: string, item: ExpenseItem): void => {
    setActiveCategoryId(categoryId)
    setEditingItem(item)
    setIsExpenseModalOpen(true)
  }

  const handleSaveExpense = (itemData: {
    label: string
    allocated: number
    estimated: number
    actual: number
    note: string
  }): void => {
    if (!activeCategoryId) return

    const updatedCategories = plan.budget.categories.map((cat) => {
      if (cat.id !== activeCategoryId) return cat

      if (editingItem) {
        // Edit existing item
        const updatedItems = cat.items.map((it) => {
          if (it.id !== editingItem.id) return it
          return {
            ...it,
            label: itemData.label,
            allocated: itemData.allocated,
            estimated: it.vendorId ? it.estimated : itemData.estimated,
            actual: it.vendorId ? it.actual : itemData.actual,
            note: itemData.note,
          }
        })
        return { ...cat, items: updatedItems }
      } else {
        // Add new item
        const newItem: ExpenseItem = {
          id: `item-${nanoid(10)}`,
          label: itemData.label,
          allocated: itemData.allocated,
          estimated: itemData.estimated,
          actual: itemData.actual,
          note: itemData.note,
        }
        return { ...cat, items: [...cat.items, newItem] }
      }
    })

    const updatedBudget: BudgetSection = {
      ...plan.budget,
      categories: updatedCategories,
    }

    setIsExpenseModalOpen(false)
    const actionDesc = editingItem
      ? `Expense "${itemData.label}" updated.`
      : `Expense "${itemData.label}" added.`
    applyBudgetUpdate(updatedBudget, actionDesc)
  }

  const handleDeleteExpenseConfirm = (): void => {
    if (!deleteItemTarget) return

    let unlinkedVendorId: string | undefined
    const updatedCategories = plan.budget.categories.map((cat) => {
      if (cat.id !== deleteItemTarget.categoryId) return cat
      const itemToDelete = cat.items.find((i) => i.id === deleteItemTarget.itemId)
      if (itemToDelete?.vendorId) {
        unlinkedVendorId = itemToDelete.vendorId
      }
      return {
        ...cat,
        items: cat.items.filter((i) => i.id !== deleteItemTarget.itemId),
      }
    })

    const updatedBudget: BudgetSection = {
      ...plan.budget,
      categories: updatedCategories,
    }

    const label = deleteItemTarget.label
    setDeleteItemTarget(null)
    applyBudgetUpdate(updatedBudget, `Expense "${label}" deleted.`, unlinkedVendorId)
  }

  const activeCategory = plan.budget.categories.find((c) => c.id === activeCategoryId)
  const linkedVendor = editingItem?.vendorId
    ? plan.vendors.find((v) => v.id === editingItem.vendorId)
    : null

  return (
    <div className="flex-col" style={{ gap: 'var(--space-6)' }}>
      {/* ── Feedback Notice ─────────────────────────────────── */}
      {feedback && (
        <div
          className={`alert ${feedback.type === 'success' ? 'alert--success' : 'alert--error'}`}
          role="status"
          aria-live="polite"
        >
          <span>{feedback.type === 'success' ? '✓' : '⚠️'}</span>
          <div>{feedback.message}</div>
        </div>
      )}

      {/* ── 1. Budget Overview: All 8 Accounting Metrics ────── */}
      <section aria-label="Budget Overview & Accounting Guard">
        <div className="flex-between" style={{ marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--color-plum-800)', fontSize: 'var(--text-2xl)' }}>
              Budget Guard Overview
            </h2>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Real-time mathematical accounting derived directly from event envelopes and vendor bridges
            </p>
          </div>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => setIsCategoryModalOpen(true)}
          >
            + Add Category
          </button>
        </div>

        {/* 8 Metric Cards Grid */}
        <div className="grid-auto grid-auto--4">
          {/* 1. Total Event Budget */}
          <div className="stat-card" data-testid="metric-total-budget">
            <span className="stat-card__label">Total Budget</span>
            <span className="stat-card__value" style={{ color: 'var(--color-brand)' }}>
              {formatINR(summary.totalBudget)}
            </span>
            <span className="stat-card__sub">Overall spending ceiling</span>
          </div>

          {/* 2. Allocated Budget */}
          <div className="stat-card" data-testid="metric-allocated">
            <span className="stat-card__label">Allocated Budget</span>
            <span className="stat-card__value">
              {formatINR(summary.totalAllocated)}
            </span>
            <span className="stat-card__sub">
              {summary.totalBudget > 0
                ? `${Math.round((summary.totalAllocated / summary.totalBudget) * 100)}% of ceiling`
                : 'No budget set'}
            </span>
          </div>

          {/* 3. Estimated Costs */}
          <div className="stat-card" data-testid="metric-estimated">
            <span className="stat-card__label">Estimated Costs</span>
            <span className="stat-card__value" style={{ color: 'var(--color-plum-700)' }}>
              {formatINR(summary.totalEstimated)}
            </span>
            <span className="stat-card__sub">Quotes &amp; expectations</span>
          </div>

          {/* 4. Actual Expenses */}
          <div className="stat-card" data-testid="metric-actual">
            <span className="stat-card__label">Actual Expenses</span>
            <span
              className="stat-card__value"
              style={{ color: summary.isOverspent ? 'var(--color-error)' : 'var(--color-sage-600)' }}
            >
              {formatINR(summary.totalActual)}
            </span>
            <span className="stat-card__sub">Verified money disbursed</span>
          </div>

          {/* 5. Contingency Reserve */}
          <div className="stat-card" data-testid="metric-contingency">
            <span className="stat-card__label">Contingency Reserve</span>
            <span className="stat-card__value" style={{ color: 'var(--color-highlight)' }}>
              {formatINR(summary.contingencyReserve)}
            </span>
            <span className="stat-card__sub">
              Separately reserved ({plan.budget.contingencyPct}%)
            </span>
          </div>

          {/* 6. Unallocated Funds */}
          <div className="stat-card" data-testid="metric-unallocated">
            <span className="stat-card__label">Unallocated Funds</span>
            <span className="stat-card__value" style={{ color: 'var(--color-sage-600)' }}>
              {formatINR(summary.unallocatedFunds)}
            </span>
            <span className="stat-card__sub">Available planned slack</span>
          </div>

          {/* 7. Allocation Overage */}
          <div className="stat-card" data-testid="metric-overage">
            <span className="stat-card__label">Allocation Overage</span>
            <span
              className="stat-card__value"
              style={{ color: summary.allocationOverage > 0 ? 'var(--color-error)' : 'var(--color-text-muted)' }}
            >
              {formatINR(summary.allocationOverage)}
            </span>
            <span className="stat-card__sub">
              {summary.allocationOverage > 0 ? '⚠️ Exceeds budget ceiling' : 'Zero allocation excess'}
            </span>
          </div>

          {/* 8. Remaining Budget (Not clamped!) */}
          <div className="stat-card" data-testid="metric-remaining">
            <span className="stat-card__label">Remaining Budget</span>
            <span
              className="stat-card__value"
              style={{ color: summary.remainingBudget < 0 ? 'var(--color-error)' : 'var(--color-sage-600)' }}
            >
              {formatINR(summary.remainingBudget)}
            </span>
            <span className="stat-card__sub">
              {summary.remainingBudget < 0 ? '🚨 Net budget deficit' : 'Cash balance after reserve'}
            </span>
          </div>
        </div>
      </section>

      {/* ── 2. Accounting Guard & Status Alerts ─────────────── */}
      <section className="card card--raised" style={{ padding: 'var(--space-6)' }}>
        <div className="flex-between" style={{ marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)', color: 'var(--color-text-primary)' }}>
              Accounting Guard State &amp; Identity
            </h3>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Enforces: <code>slack = totalBudget − totalAllocated − contingencyReserve</code> ({formatINR(slack)})
            </p>
          </div>

          {/* Contingency Buffer Adjuster */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <label htmlFor="contingency-pct-input" style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--color-text-secondary)' }}>
              Contingency Reserve %:
            </label>
            <input
              id="contingency-pct-input"
              type="number"
              min="0"
              max="30"
              step="1"
              value={plan.budget.contingencyPct}
              onChange={(e) => handleContingencyChange(Number(e.target.value))}
              style={{
                width: '64px',
                padding: 'var(--space-1) var(--space-2)',
                borderRadius: 'var(--radius-md)',
                border: '1.5px solid var(--color-border)',
                textAlign: 'center',
                fontWeight: 'var(--weight-bold)',
              }}
              aria-label="Contingency Percentage"
            />
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              ({formatINR(summary.contingencyReserve)})
            </span>
          </div>
        </div>

        {/* Status Callout Banners */}
        {summary.isOverAllocated && (
          <div className="alert alert--error" style={{ marginBottom: 'var(--space-3)' }} role="alert">
            <span>⚠️</span>
            <div>
              <strong>Over-Allocation Warning:</strong> Planned category allocations plus contingency reserve exceed your total budget by{' '}
              <strong>{formatINR(summary.allocationOverage)}</strong>. Reduce planned envelopes to bring unallocated slack back to zero or higher.
            </div>
          </div>
        )}

        {summary.isOverspent && (
          <div className="alert alert--error" style={{ marginBottom: 'var(--space-3)' }} role="alert">
            <span>🚨</span>
            <div>
              <strong>Overspending Deficit Warning:</strong> Actual expenses ({formatINR(summary.totalActual)}) have exceeded your available budget and contingency reserve. Remaining budget is{' '}
              <strong>{formatINR(summary.remainingBudget)}</strong>.
            </div>
          </div>
        )}

        {!summary.isOverAllocated && !summary.isOverspent && (
          <div className="alert alert--success" style={{ marginBottom: 'var(--space-3)' }} role="status">
            <span>✓</span>
            <div>
              <strong>Budget Guard Healthy:</strong> Planned allocations and actual expenses are safely within your budget ceiling. Unallocated funds available:{' '}
              <strong>{formatINR(summary.unallocatedFunds)}</strong>.
            </div>
          </div>
        )}

        {/* Visual Allocation Envelope Progress Bar */}
        <div style={{ marginTop: 'var(--space-4)' }}>
          <div className="flex-between" style={{ fontSize: 'var(--text-xs)', marginBottom: 'var(--space-1)' }}>
            <span>Envelope Allocation Breakdown</span>
            <span>
              {formatINR(summary.totalAllocated + summary.contingencyReserve)} / {formatINR(summary.totalBudget)}
            </span>
          </div>
          <div className="progress-bar">
            <div
              className={`progress-bar__fill ${summary.isOverAllocated ? 'progress-bar__fill--error' : ''}`}
              style={{
                width: `${Math.min(100, Math.round(((summary.totalAllocated + summary.contingencyReserve) / (summary.totalBudget || 1)) * 100))}%`,
              }}
            />
          </div>
        </div>
      </section>

      {/* ── 3. Category Envelopes & Expense Items ────────────── */}
      <section aria-label="Budget Categories and Line Items">
        <div className="flex-between" style={{ marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--color-plum-800)', fontSize: 'var(--text-xl)' }}>
              Category Envelopes &amp; Expenses
            </h3>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Add, edit, and organize individual expense items within planned categories
            </p>
          </div>
          <span className="badge badge--brand">
            {plan.budget.categories.length} Categories Active
          </span>
        </div>

        {plan.budget.categories.length === 0 ? (
          <div className="empty-state card card--flat" style={{ padding: 'var(--space-12) var(--space-6)' }}>
            <div className="empty-state__icon" aria-hidden="true">
              💰
            </div>
            <div className="empty-state__title">No Budget Categories Yet</div>
            <p className="empty-state__body">
              Create your first budget category (such as Venue, Catering, or Decor) to begin tracking allocations and spending.
            </p>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setIsCategoryModalOpen(true)}
            >
              + Add First Category
            </button>
          </div>
        ) : (
          <div className="flex-col" style={{ gap: 'var(--space-5)' }}>
            {plan.budget.categories.map((cat) => {
              const allocated = categoryAllocated(cat)
              const estimated = categoryEstimated(cat)
              const actual = categoryActual(cat)
              const isCatOverAllocated = allocated > 0 && actual > allocated

              return (
                <div key={cat.id} className="card card--raised" style={{ padding: 'var(--space-6)' }} data-testid={`category-card-${cat.id}`}>
                  {/* Category Header */}
                  <div className="flex-between" style={{ marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <h4 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--color-text-primary)' }}>
                          {cat.name}
                        </h4>
                        <span className="badge badge--neutral">
                          {cat.items.length} item{cat.items.length === 1 ? '' : 's'}
                        </span>
                        {isCatOverAllocated && (
                          <span className="badge badge--error">
                            ⚠️ Over Envelope
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Category Totals & Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 'var(--text-xs)' }}>
                        <div>
                          <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Allocated</span>
                          <strong style={{ fontSize: 'var(--text-sm)' }}>{formatINR(allocated)}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Estimated</span>
                          <span style={{ fontSize: 'var(--text-sm)' }}>{formatINR(estimated)}</span>
                        </div>
                        <div>
                          <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Actual</span>
                          <strong
                            style={{
                              fontSize: 'var(--text-sm)',
                              color: isCatOverAllocated ? 'var(--color-error)' : 'var(--color-sage-600)',
                            }}
                          >
                            {formatINR(actual)}
                          </strong>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <button
                          type="button"
                          className="btn btn--outline btn--sm"
                          onClick={() => openAddExpenseModal(cat.id)}
                          title={`Add expense item to ${cat.name}`}
                        >
                          + Add Expense
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() =>
                            setDeleteCategoryTarget({
                              categoryId: cat.id,
                              name: cat.name,
                              itemCount: cat.items.length,
                            })
                          }
                          title={`Delete category ${cat.name}`}
                          style={{ color: 'var(--color-error)' }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Items List */}
                  {cat.items.length === 0 ? (
                    <div
                      style={{
                        padding: 'var(--space-4)',
                        textAlign: 'center',
                        background: 'var(--color-bg-subtle)',
                        borderRadius: 'var(--radius-lg)',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      No expense items in this category yet.{' '}
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        style={{ padding: '0 var(--space-2)', fontSize: 'var(--text-xs)', textDecoration: 'underline' }}
                        onClick={() => openAddExpenseModal(cat.id)}
                      >
                        Add an expense now
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                      {cat.items.map((item) => {
                        const linkedV = item.vendorId
                          ? plan.vendors.find((v) => v.id === item.vendorId)
                          : null

                        return (
                          <div
                            key={item.id}
                            data-testid={`expense-item-${item.id}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: 'var(--space-3) var(--space-4)',
                              background: 'var(--color-bg-subtle)',
                              borderRadius: 'var(--radius-lg)',
                              border: '1px solid var(--color-border-subtle)',
                              gap: 'var(--space-3)',
                              flexWrap: 'wrap',
                            }}
                          >
                            {/* Label & Notes */}
                            <div style={{ flex: '1 1 200px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--color-text-primary)', fontSize: 'var(--text-sm)' }}>
                                  {item.label}
                                </span>
                                {item.vendorId && (
                                  <span
                                    className="badge badge--brand"
                                    title="Actual spending and estimate are linked directly to vendor contract"
                                    style={{ fontSize: '0.7rem' }}
                                  >
                                    🔒 Linked: {linkedV?.name || 'Vendor'}
                                  </span>
                                )}
                              </div>
                              {item.note && (
                                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                  {item.note}
                                </p>
                              )}
                            </div>

                            {/* Amounts */}
                            <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 'var(--text-xs)', alignItems: 'center' }}>
                              <div>
                                <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Allocated</span>
                                <strong>{formatINR(item.allocated)}</strong>
                              </div>
                              <div>
                                <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Estimated</span>
                                <span>{formatINR(item.estimated)}</span>
                              </div>
                              <div>
                                <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Actual</span>
                                <strong style={{ color: item.actual > item.allocated && item.allocated > 0 ? 'var(--color-error)' : 'var(--color-sage-600)' }}>
                                  {formatINR(item.actual)}
                                </strong>
                              </div>
                            </div>

                            {/* Item Actions */}
                            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                              <button
                                type="button"
                                className="btn btn--outline btn--sm"
                                onClick={() => openEditExpenseModal(cat.id, item)}
                                aria-label={`Edit expense ${item.label}`}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn--danger btn--sm"
                                onClick={() =>
                                  setDeleteItemTarget({
                                    categoryId: cat.id,
                                    itemId: item.id,
                                    label: item.label,
                                    isVendorLinked: Boolean(item.vendorId),
                                  })
                                }
                                aria-label={`Delete expense ${item.label}`}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Add / Edit Expense Modal ────────────────────────── */}
      <ExpenseModal
        isOpen={isExpenseModalOpen}
        categoryName={activeCategory?.name || ''}
        initialItem={editingItem}
        linkedVendor={linkedVendor}
        onSave={handleSaveExpense}
        onClose={() => setIsExpenseModalOpen(false)}
      />

      {/* ── Add Category Modal ──────────────────────────────── */}
      <CategoryModal
        isOpen={isCategoryModalOpen}
        onSave={handleAddCategory}
        onClose={() => setIsCategoryModalOpen(false)}
      />

      {/* ── Delete Expense Confirmation Dialog ──────────────── */}
      <ConfirmDialog
        isOpen={Boolean(deleteItemTarget)}
        title="Delete Expense Item?"
        message={
          deleteItemTarget?.isVendorLinked
            ? `Are you sure you want to delete "${deleteItemTarget?.label}"? This expense is currently linked to a vendor. Deleting it will unlink the vendor without affecting the vendor contract itself.`
            : `Are you sure you want to delete "${deleteItemTarget?.label}"? This action will remove this allocation and cannot be undone.`
        }
        confirmText="Delete Expense"
        cancelText="Cancel"
        confirmVariant="danger"
        onConfirm={handleDeleteExpenseConfirm}
        onCancel={() => setDeleteItemTarget(null)}
      />

      {/* ── Delete Category Confirmation Dialog ─────────────── */}
      <ConfirmDialog
        isOpen={Boolean(deleteCategoryTarget)}
        title={`Delete Category "${deleteCategoryTarget?.name}"?`}
        message={
          deleteCategoryTarget && deleteCategoryTarget.itemCount > 0
            ? `This category contains ${deleteCategoryTarget.itemCount} expense item(s). Deleting the category will remove all items within it. Do you wish to continue?`
            : `Are you sure you want to delete the category "${deleteCategoryTarget?.name}"?`
        }
        confirmText="Delete Category"
        cancelText="Cancel"
        confirmVariant="danger"
        onConfirm={handleDeleteCategoryConfirm}
        onCancel={() => setDeleteCategoryTarget(null)}
      />
    </div>
  )
}
