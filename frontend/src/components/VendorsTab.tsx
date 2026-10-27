import React, { useState, useMemo } from 'react'
import { nanoid } from 'nanoid'
import type { EventPlan, Vendor, BookingStatus, PaymentStatus, VendorCategory } from '@/types'
import {
  derivePaymentStatus,
  vendorNetPaid,
  vendorOutstanding,
  syncVendorsToBudget,
} from '@/lib/vendors'
import { formatINR } from '@/lib/currency'
import { VendorModal } from './VendorModal'
import { ConfirmDialog } from './ConfirmDialog'

interface VendorsTabProps {
  plan: EventPlan
  onUpdatePlan?: (updatedPlan: EventPlan) => void
}

type FilterMode = 'all' | 'booked' | 'enquiring' | 'cancelled' | 'balance-due'

export function VendorsTab({ plan, onUpdatePlan }: VendorsTabProps): React.JSX.Element {
  const [filter, setFilter] = useState<FilterMode>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Modal states
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
  const [deleteVendorTarget, setDeleteVendorTarget] = useState<Vendor | null>(null)

  // Status message
  const [feedback, setFeedback] = useState<{ type: 'success' | 'info'; message: string } | null>(null)

  const showFeedback = (type: 'success' | 'info', message: string): void => {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 4000)
  }

  // ── Financial Summaries ───────────────────────────────────
  const totalQuoted = useMemo(() => {
    return plan.vendors.reduce(
      (sum, v) => sum + (v.bookingStatus !== 'cancelled' ? v.quotedCost : 0),
      0
    )
  }, [plan.vendors])

  const totalPaid = useMemo(() => {
    return plan.vendors.reduce((sum, v) => sum + vendorNetPaid(v), 0)
  }, [plan.vendors])

  const balanceDue = useMemo(() => {
    return plan.vendors.reduce((sum, v) => sum + vendorOutstanding(v), 0)
  }, [plan.vendors])

  const bookedCount = useMemo(() => {
    return plan.vendors.filter((v) => v.bookingStatus === 'booked').length
  }, [plan.vendors])

  // Extract all available budget items across categories for linking
  const existingBudgetItems = useMemo(() => {
    const list: { id: string; label: string; categoryName: string; currentVendorId?: string }[] = []
    for (const cat of plan.budget.categories) {
      for (const item of cat.items) {
        list.push({
          id: item.id,
          label: item.label,
          categoryName: cat.name,
          currentVendorId: item.vendorId,
        })
      }
    }
    return list
  }, [plan.budget])

  // Map budget item ID to its label and category for quick display
  const budgetItemMap = useMemo(() => {
    const map = new Map<string, { label: string; categoryName: string }>()
    for (const item of existingBudgetItems) {
      map.set(item.id, { label: item.label, categoryName: item.categoryName })
    }
    return map
  }, [existingBudgetItems])

  // Filter chips counts
  const counts = useMemo(() => {
    const all = plan.vendors.length
    const booked = plan.vendors.filter((v) => v.bookingStatus === 'booked').length
    const enquiring = plan.vendors.filter((v) => v.bookingStatus === 'enquiring').length
    const cancelled = plan.vendors.filter((v) => v.bookingStatus === 'cancelled').length
    const balanceDueCount = plan.vendors.filter((v) => vendorOutstanding(v) > 0).length
    return { all, booked, enquiring, cancelled, balanceDueCount }
  }, [plan.vendors])

  // Filtered & Searched vendors
  const filteredVendors = useMemo(() => {
    return plan.vendors.filter((vendor) => {
      // 1. Status Filter
      if (filter === 'booked' && vendor.bookingStatus !== 'booked') return false
      if (filter === 'enquiring' && vendor.bookingStatus !== 'enquiring') return false
      if (filter === 'cancelled' && vendor.bookingStatus !== 'cancelled') return false
      if (filter === 'balance-due' && vendorOutstanding(vendor) <= 0) return false

      // 2. Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchName = vendor.name.toLowerCase().includes(q)
        const matchCategory = vendor.category.toLowerCase().includes(q)
        const matchNotes = (vendor.notes || '').toLowerCase().includes(q)
        const matchContact = (vendor.contactInfo || '').toLowerCase().includes(q)
        if (!matchName && !matchCategory && !matchNotes && !matchContact) {
          return false
        }
      }

      return true
    })
  }, [plan.vendors, filter, searchQuery])

  // ── Helper to commit vendor updates and re-sync budget ────
  const commitVendorUpdate = (
    updatedVendors: Vendor[],
    actionDesc: string,
    unlinkedItemIds?: string[]
  ): void => {
    // If specific budget items were explicitly unlinked, clear their vendorId before re-syncing
    let baseBudget = plan.budget
    if (unlinkedItemIds && unlinkedItemIds.length > 0) {
      const set = new Set(unlinkedItemIds)
      baseBudget = {
        ...plan.budget,
        categories: plan.budget.categories.map((cat) => ({
          ...cat,
          items: cat.items.map((it) => (set.has(it.id) ? { ...it, vendorId: undefined } : it)),
        })),
      }
    }

    // Now re-sync budget against updated vendors
    const syncedBudget = syncVendorsToBudget(baseBudget, updatedVendors)

    const updatedPlan: EventPlan = {
      ...plan,
      vendors: updatedVendors,
      budget: syncedBudget,
      updatedAt: new Date().toISOString(),
    }

    if (onUpdatePlan) {
      onUpdatePlan(updatedPlan)
    }
    showFeedback('success', actionDesc)
  }

  // ── Actions: Add, Edit, Delete, Unlink ─────────────────────
  const handleOpenAddVendor = (): void => {
    setEditingVendor(null)
    setIsVendorModalOpen(true)
  }

  const handleOpenEditVendor = (vendor: Vendor): void => {
    setEditingVendor(vendor)
    setIsVendorModalOpen(true)
  }

  const handleSaveVendor = (vendorData: {
    name: string
    category: VendorCategory
    contactInfo: string
    quotedCost: number
    amountPaid: number
    refundAmount: number
    bookingStatus: BookingStatus
    notes: string
    linkedBudgetItemId?: string
  }): void => {
    const derivedStatus = derivePaymentStatus({
      amountPaid: vendorData.amountPaid,
      quotedCost: vendorData.quotedCost,
    })

    const vendorId = editingVendor?.id ?? `vendor-${nanoid(10)}`

    const newVendor: Vendor = {
      id: vendorId,
      name: vendorData.name,
      category: vendorData.category,
      contactInfo: vendorData.contactInfo,
      quotedCost: vendorData.quotedCost,
      amountPaid: vendorData.amountPaid,
      refundAmount: vendorData.refundAmount,
      bookingStatus: vendorData.bookingStatus,
      paymentStatus: derivedStatus,
      linkedBudgetItemId: vendorData.linkedBudgetItemId,
      notes: vendorData.notes,
    }

    // Determine unlinked items (e.g. if this vendor previously linked to another item, or if the newly linked item was linked to another vendor)
    const unlinkedItemIds: string[] = []
    if (editingVendor?.linkedBudgetItemId && editingVendor.linkedBudgetItemId !== vendorData.linkedBudgetItemId) {
      unlinkedItemIds.push(editingVendor.linkedBudgetItemId)
    }

    let updatedVendors: Vendor[]

    if (editingVendor) {
      // Edit existing vendor
      updatedVendors = plan.vendors.map((v) => {
        if (v.id === editingVendor.id) return newVendor
        // If another vendor was previously linked to this item, clear its link
        if (vendorData.linkedBudgetItemId && v.linkedBudgetItemId === vendorData.linkedBudgetItemId) {
          return { ...v, linkedBudgetItemId: undefined }
        }
        return v
      })
    } else {
      // Add new vendor
      const cleaned = plan.vendors.map((v) => {
        if (vendorData.linkedBudgetItemId && v.linkedBudgetItemId === vendorData.linkedBudgetItemId) {
          return { ...v, linkedBudgetItemId: undefined }
        }
        return v
      })
      updatedVendors = [...cleaned, newVendor]
    }

    // Ensure the targeted budget item (if linked) has its vendorId attached
    let baseBudget = plan.budget
    if (vendorData.linkedBudgetItemId) {
      baseBudget = {
        ...plan.budget,
        categories: plan.budget.categories.map((cat) => ({
          ...cat,
          items: cat.items.map((it) =>
            it.id === vendorData.linkedBudgetItemId ? { ...it, vendorId } : it
          ),
        })),
      }
    }

    setIsVendorModalOpen(false)
    setEditingVendor(null)

    // Commit
    const syncedBudget = syncVendorsToBudget(baseBudget, updatedVendors)
    const updatedPlan: EventPlan = {
      ...plan,
      vendors: updatedVendors,
      budget: syncedBudget,
      updatedAt: new Date().toISOString(),
    }
    if (onUpdatePlan) onUpdatePlan(updatedPlan)
    showFeedback(
      'success',
      editingVendor ? `Vendor "${newVendor.name}" updated successfully.` : `Vendor "${newVendor.name}" registered.`
    )
  }

  const handleUnlinkVendor = (vendor: Vendor): void => {
    if (!vendor.linkedBudgetItemId) return
    const unlinkedItemId = vendor.linkedBudgetItemId

    const updatedVendors = plan.vendors.map((v) =>
      v.id === vendor.id ? { ...v, linkedBudgetItemId: undefined } : v
    )

    commitVendorUpdate(
      updatedVendors,
      `Unlinked vendor "${vendor.name}" from budget. Expense record amounts preserved.`,
      [unlinkedItemId]
    )
  }

  const handleDeleteVendorConfirm = (): void => {
    if (!deleteVendorTarget) return
    const target = deleteVendorTarget
    const unlinkedItemIds = target.linkedBudgetItemId ? [target.linkedBudgetItemId] : []

    const updatedVendors = plan.vendors.filter((v) => v.id !== target.id)
    setDeleteVendorTarget(null)

    commitVendorUpdate(
      updatedVendors,
      `Vendor "${target.name}" removed from directory. Historical budget records preserved.`,
      unlinkedItemIds
    )
  }

  // ── Badges ────────────────────────────────────────────────
  const getBookingBadge = (status: BookingStatus): React.JSX.Element => {
    switch (status) {
      case 'booked':
        return <span className="badge badge--success">✓ Booked</span>
      case 'enquiring':
        return <span className="badge badge--warning">⏳ Enquiring</span>
      case 'cancelled':
        return <span className="badge badge--error">✕ Cancelled</span>
    }
  }

  const getPaymentBadge = (status: PaymentStatus): React.JSX.Element => {
    switch (status) {
      case 'paid':
        return <span className="badge badge--success">✓ Fully Paid</span>
      case 'partial':
        return <span className="badge badge--warning">⚡ Partially Paid</span>
      case 'unpaid':
        return <span className="badge badge--neutral">○ Unpaid</span>
    }
  }

  return (
    <div className="flex-col" style={{ gap: 'var(--space-6)' }}>
      {/* ── Status Announcement ──────────────────────────────── */}
      {feedback && (
        <aside
          role="status"
          aria-live="polite"
          className={`alert ${feedback.type === 'success' ? 'alert--success' : 'alert--info'}`}
          style={{ animation: 'var(--animate-fade-in)' }}
        >
          <span aria-hidden="true">{feedback.type === 'success' ? '✓' : 'ℹ️'}</span>
          <span>{feedback.message}</span>
        </aside>
      )}

      {/* ── Summary Stats ───────────────────────────────────── */}
      <section aria-label="Vendor Financial Summary">
        <div className="grid-auto grid-auto--4">
          <div className="stat-card" data-testid="vendor-stat-active">
            <span className="stat-card__label">Active Booked Vendors</span>
            <span className="stat-card__value" style={{ color: 'var(--color-brand)' }}>
              {bookedCount}
            </span>
            <span className="stat-card__sub">{plan.vendors.length} Total Registered</span>
          </div>

          <div className="stat-card" data-testid="vendor-stat-quoted">
            <span className="stat-card__label">Total Quoted</span>
            <span className="stat-card__value">
              {formatINR(totalQuoted)}
            </span>
            <span className="stat-card__sub">Active contract commitments</span>
          </div>

          <div className="stat-card" data-testid="vendor-stat-paid">
            <span className="stat-card__label">Net Amount Paid</span>
            <span className="stat-card__value" style={{ color: 'var(--color-sage-600)' }}>
              {formatINR(totalPaid)}
            </span>
            <span className="stat-card__sub">Verified money disbursed</span>
          </div>

          <div className="stat-card" data-testid="vendor-stat-balance">
            <span className="stat-card__label">Outstanding Balance</span>
            <span className="stat-card__value" style={{ color: 'var(--color-accent)' }}>
              {formatINR(balanceDue)}
            </span>
            <span className="stat-card__sub">Due before or upon delivery</span>
          </div>
        </div>
      </section>

      {/* ── Directory Controls: Search, Filters & Add Action ── */}
      <section aria-label="Vendor Directory Controls">
        <div className="flex-between" style={{ marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--color-plum-800)', fontSize: 'var(--text-2xl)' }}>
              Vendor Directory &amp; Payment Bridge
            </h2>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Contract management, quote tracking, advance payments, and single-source-of-truth budget linkage
            </p>
          </div>

          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={handleOpenAddVendor}
          >
            + Register Vendor
          </button>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex-between" style={{ flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          {/* Filter Chips */}
          <div className="chip-group" role="group" aria-label="Vendor filters">
            <button
              type="button"
              className={`chip ${filter === 'all' ? 'chip--active' : ''}`}
              onClick={() => setFilter('all')}
              aria-pressed={filter === 'all'}
            >
              All Vendors ({counts.all})
            </button>
            <button
              type="button"
              className={`chip ${filter === 'booked' ? 'chip--active' : ''}`}
              onClick={() => setFilter('booked')}
              aria-pressed={filter === 'booked'}
            >
              Booked ({counts.booked})
            </button>
            <button
              type="button"
              className={`chip ${filter === 'enquiring' ? 'chip--active' : ''}`}
              onClick={() => setFilter('enquiring')}
              aria-pressed={filter === 'enquiring'}
            >
              Enquiring ({counts.enquiring})
            </button>
            <button
              type="button"
              className={`chip ${filter === 'cancelled' ? 'chip--active' : ''}`}
              onClick={() => setFilter('cancelled')}
              aria-pressed={filter === 'cancelled'}
            >
              Cancelled ({counts.cancelled})
            </button>
            <button
              type="button"
              className={`chip ${filter === 'balance-due' ? 'chip--active' : ''}`}
              onClick={() => setFilter('balance-due')}
              aria-pressed={filter === 'balance-due'}
            >
              Balance Due ({counts.balanceDueCount})
            </button>
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', minWidth: '220px' }}>
            <input
              type="text"
              className="form-input"
              style={{ fontSize: 'var(--text-xs)', padding: 'var(--space-2) var(--space-3)' }}
              placeholder="Search by name, category, notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search vendors"
            />
            {searchQuery && (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', minHeight: '28px', padding: '0 6px' }}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* ── Vendors Cards Grid ──────────────────────────────── */}
        {filteredVendors.length === 0 ? (
          <div className="empty-state card card--flat">
            <div className="empty-state__icon" aria-hidden="true">
              🤝
            </div>
            <div className="empty-state__title">
              {searchQuery
                ? 'No Matching Vendors Found'
                : filter === 'all'
                ? 'No Vendors Added Yet'
                : `No ${filter.replace('-', ' ')} Vendors`}
            </div>
            <p className="empty-state__body">
              {searchQuery
                ? `No vendor profiles match "${searchQuery}". Clear your search query or reset filters.`
                : 'Connect catering, decor, and photography quotes directly to your budget items with zero double-counting.'}
            </p>
            {filter === 'all' && !searchQuery && (
              <div style={{ marginTop: 'var(--space-4)' }}>
                <button type="button" className="btn btn--primary btn--sm" onClick={handleOpenAddVendor}>
                  + Register First Vendor
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid-auto grid-auto--2">
            {filteredVendors.map((vendor) => {
              const netPaid = vendorNetPaid(vendor)
              const outstanding = vendorOutstanding(vendor)
              const refund = vendor.refundAmount ?? 0
              const linkedItemInfo = vendor.linkedBudgetItemId ? budgetItemMap.get(vendor.linkedBudgetItemId) : null

              return (
                <div
                  key={vendor.id}
                  data-testid={`vendor-card-${vendor.id}`}
                  className="card card--raised"
                  style={{
                    padding: 'var(--space-5)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 'var(--space-3)',
                    background: vendor.bookingStatus === 'cancelled' ? 'var(--color-bg-subtle)' : 'var(--color-bg-card)',
                    borderColor: vendor.bookingStatus === 'cancelled' ? 'var(--color-border-subtle)' : undefined,
                  }}
                >
                  <div>
                    {/* Header Row: Category Badge & Status Badges */}
                    <div className="flex-between" style={{ marginBottom: 'var(--space-2)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                      <span className="badge badge--brand" style={{ textTransform: 'capitalize' }}>
                        {vendor.category}
                      </span>
                      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                        {getBookingBadge(vendor.bookingStatus)}
                        {getPaymentBadge(vendor.paymentStatus)}
                      </div>
                    </div>

                    {/* Vendor Name */}
                    <h3
                      style={{
                        fontSize: 'var(--text-lg)',
                        fontWeight: 'var(--weight-bold)',
                        color: 'var(--color-text-primary)',
                        marginBottom: 'var(--space-1)',
                      }}
                    >
                      {vendor.name}
                    </h3>

                    {/* Contact Info */}
                    {vendor.contactInfo && (
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
                        📞 {vendor.contactInfo}
                      </p>
                    )}

                    {/* Cancellation & Historical Payment Banner */}
                    {vendor.bookingStatus === 'cancelled' && (
                      <div
                        className="alert alert--warning"
                        style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-xs)', marginBottom: 'var(--space-3)' }}
                      >
                        <span aria-hidden="true">⚠️</span>
                        <div>
                          {vendor.amountPaid > 0 ? (
                            <>
                              <strong>Booking Cancelled:</strong> Holds {formatINR(vendor.amountPaid)} in historical payments
                              {refund > 0 ? ` (${formatINR(refund)} refunded, Net: ${formatINR(netPaid)})` : ' (No refund recorded)'}.
                              Outstanding quote commitment cleared.
                            </>
                          ) : (
                            <>
                              <strong>Booking Cancelled:</strong> No financial commitments outstanding.
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Financial Breakdown Card */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: refund > 0 ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)',
                        gap: 'var(--space-2)',
                        padding: 'var(--space-2) var(--space-3)',
                        background: 'var(--color-bg-subtle)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--text-xs)',
                        marginBottom: 'var(--space-3)',
                      }}
                    >
                      <div>
                        <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Quoted Cost</span>
                        <strong>{formatINR(vendor.quotedCost)}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>
                          {refund > 0 ? 'Gross Paid' : 'Amount Paid'}
                        </span>
                        <strong style={{ color: 'var(--color-sage-600)' }}>{formatINR(vendor.amountPaid)}</strong>
                      </div>
                      {refund > 0 && (
                        <div>
                          <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Refunded</span>
                          <strong style={{ color: 'var(--color-brand)' }}>{formatINR(refund)}</strong>
                        </div>
                      )}
                      <div>
                        <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Outstanding</span>
                        <strong style={{ color: outstanding > 0 ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                          {formatINR(outstanding)}
                        </strong>
                      </div>
                    </div>

                    {/* Budget Linkage Status */}
                    <div style={{ marginBottom: 'var(--space-2)' }}>
                      {vendor.linkedBudgetItemId && linkedItemInfo ? (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: 'var(--space-2)',
                            background: 'var(--color-bg-card)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: 'var(--text-xs)',
                          }}
                        >
                          <span>
                            🔗 Linked to: <strong>[{linkedItemInfo.categoryName}] {linkedItemInfo.label}</strong>
                          </span>
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            style={{ minHeight: '26px', padding: '0 var(--space-2)', fontSize: '11px' }}
                            onClick={() => handleUnlinkVendor(vendor)}
                            title="Unlink this vendor from budget item (preserves historical numbers)"
                          >
                            Unlink
                          </button>
                        </div>
                      ) : (
                        <span className="badge badge--neutral" style={{ fontSize: '10px' }}>
                          Standalone Vendor (Not linked to budget)
                        </span>
                      )}
                    </div>

                    {/* Notes */}
                    {vendor.notes && (
                      <p
                        style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--color-text-secondary)',
                          lineHeight: 'var(--leading-normal)',
                          marginTop: 'var(--space-1)',
                        }}
                      >
                        {vendor.notes}
                      </p>
                    )}
                  </div>

                  {/* Card Actions Footer */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: 'var(--space-2)',
                      paddingTop: 'var(--space-2)',
                      borderTop: '1px solid var(--color-border-subtle)',
                    }}
                  >
                    <button
                      type="button"
                      className="btn btn--outline btn--sm"
                      onClick={() => handleOpenEditVendor(vendor)}
                      aria-label={`Edit vendor "${vendor.name}"`}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger btn--sm"
                      onClick={() => setDeleteVendorTarget(vendor)}
                      aria-label={`Delete vendor "${vendor.name}"`}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Modals & Dialogs ─────────────────────────────────── */}
      <VendorModal
        isOpen={isVendorModalOpen}
        initialVendor={editingVendor}
        existingBudgetItems={existingBudgetItems}
        onSave={handleSaveVendor}
        onClose={() => {
          setIsVendorModalOpen(false)
          setEditingVendor(null)
        }}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteVendorTarget)}
        title="Delete Vendor Profile?"
        message={`Are you sure you want to delete "${deleteVendorTarget?.name}"? ${
          deleteVendorTarget?.linkedBudgetItemId
            ? 'This vendor is linked to a budget expense item. Deleting the vendor will unlink the expense and keep its recorded payment numbers intact.'
            : 'This cannot be undone.'
        }`}
        confirmText="Delete Vendor"
        cancelText="Cancel"
        confirmVariant="danger"
        onConfirm={handleDeleteVendorConfirm}
        onCancel={() => setDeleteVendorTarget(null)}
      />
    </div>
  )
}
