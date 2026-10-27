import React, { useState, useEffect, useRef } from 'react'
import type { Vendor, VendorCategory, BookingStatus } from '@/types'
import { VendorCategoryValues } from '@/types'
import { derivePaymentStatus, validateVendorPayment } from '@/lib/vendors'
import { formatINR, parseINRInput } from '@/lib/currency'

interface AvailableBudgetItem {
  id: string
  label: string
  categoryName: string
  currentVendorId?: string
}

interface VendorModalProps {
  isOpen: boolean
  initialVendor?: Vendor | null
  existingBudgetItems: AvailableBudgetItem[]
  onSave: (vendorData: {
    name: string
    category: VendorCategory
    contactInfo: string
    quotedCost: number
    amountPaid: number
    refundAmount: number
    bookingStatus: BookingStatus
    notes: string
    linkedBudgetItemId?: string
  }) => void
  onClose: () => void
}

export function VendorModal({
  isOpen,
  initialVendor,
  existingBudgetItems,
  onSave,
  onClose,
}: VendorModalProps): React.JSX.Element | null {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<VendorCategory>('venue')
  const [contactInfo, setContactInfo] = useState('')
  const [quotedCost, setQuotedCost] = useState('0')
  const [amountPaid, setAmountPaid] = useState('0')
  const [refundAmount, setRefundAmount] = useState('0')
  const [bookingStatus, setBookingStatus] = useState<BookingStatus>('enquiring')
  const [notes, setNotes] = useState('')
  const [linkedBudgetItemId, setLinkedBudgetItemId] = useState<string>('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      if (initialVendor) {
        setName(initialVendor.name)
        setCategory(initialVendor.category)
        setContactInfo(initialVendor.contactInfo || '')
        setQuotedCost(String(initialVendor.quotedCost))
        setAmountPaid(String(initialVendor.amountPaid))
        setRefundAmount(String(initialVendor.refundAmount ?? 0))
        setBookingStatus(initialVendor.bookingStatus)
        setNotes(initialVendor.notes || '')
        setLinkedBudgetItemId(initialVendor.linkedBudgetItemId || '')
      } else {
        setName('')
        setCategory('venue')
        setContactInfo('')
        setQuotedCost('0')
        setAmountPaid('0')
        setRefundAmount('0')
        setBookingStatus('enquiring')
        setNotes('')
        setLinkedBudgetItemId('')
      }
      setErrors({})
      setTimeout(() => nameInputRef.current?.focus(), 50)
    }
  }, [isOpen, initialVendor])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const numQuoted = Number(quotedCost)
  const numPaid = Number(amountPaid)
  const numRefund = Number(refundAmount)

  // Derived financial previews
  const derivedStatus = Number.isFinite(numPaid) && Number.isFinite(numQuoted)
    ? derivePaymentStatus({ amountPaid: numPaid, quotedCost: numQuoted })
    : 'unpaid'
  const netPaidPreview = Math.max(0, numPaid - (Number.isFinite(numRefund) ? numRefund : 0))
  const outstandingPreview = bookingStatus === 'cancelled'
    ? 0
    : Math.max(0, numQuoted - numPaid)

  const validate = (): boolean => {
    const errs: Record<string, string> = {}

    const trimmedName = name.trim()
    if (!trimmedName) {
      errs.name = 'Vendor name is required.'
    } else if (trimmedName.length > 120) {
      errs.name = 'Vendor name cannot exceed 120 characters.'
    }

    if (contactInfo.length > 200) {
      errs.contactInfo = 'Contact info cannot exceed 200 characters.'
    }

    if (!quotedCost.trim() || !Number.isFinite(numQuoted) || isNaN(numQuoted) || numQuoted < 0 || !Number.isInteger(numQuoted)) {
      errs.quotedCost = 'Quoted cost must be a whole non-negative integer (whole INR).'
    }

    if (!amountPaid.trim() || !Number.isFinite(numPaid) || isNaN(numPaid) || numPaid < 0 || !Number.isInteger(numPaid)) {
      errs.amountPaid = 'Amount paid must be a whole non-negative integer (whole INR).'
    } else if (Number.isFinite(numQuoted) && numPaid > numQuoted) {
      errs.amountPaid = 'Amount paid cannot exceed quoted cost.'
    }

    if (refundAmount.trim() !== '') {
      if (!Number.isFinite(numRefund) || isNaN(numRefund) || numRefund < 0 || !Number.isInteger(numRefund)) {
        errs.refundAmount = 'Refund amount must be a whole non-negative integer.'
      } else if (Number.isFinite(numPaid) && numRefund > numPaid) {
        errs.refundAmount = 'Refund amount cannot exceed amount paid.'
      }
    }

    if (notes.length > 500) {
      errs.notes = 'Notes cannot exceed 500 characters.'
    }

    const paymentErr = validateVendorPayment({
      quotedCost: numQuoted,
      amountPaid: numPaid,
      refundAmount: numRefund,
    })
    if (paymentErr && !errs.amountPaid && !errs.refundAmount && !errs.quotedCost) {
      errs.amountPaid = paymentErr
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (!validate()) return

    onSave({
      name: name.trim(),
      category,
      contactInfo: contactInfo.trim(),
      quotedCost: parseINRInput(quotedCost),
      amountPaid: parseINRInput(amountPaid),
      refundAmount: parseINRInput(refundAmount),
      bookingStatus,
      notes: notes.trim(),
      linkedBudgetItemId: linkedBudgetItemId || undefined,
    })
  }

  return (
    <div
      className="modal-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vendor-modal-title"
        style={{ maxWidth: '560px' }}
      >
        <div className="flex-between" style={{ marginBottom: 'var(--space-4)' }}>
          <div>
            <h2
              id="vendor-modal-title"
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--color-plum-800)',
                fontSize: 'var(--text-xl)',
              }}
            >
              {initialVendor ? 'Edit Vendor Profile' : 'Register New Vendor'}
            </h2>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Contracts, quotes, advance payments, and budget linkage
            </p>
          </div>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Cancellation Notice */}
        {bookingStatus === 'cancelled' && numPaid > 0 && (
          <div
            className="alert alert--warning"
            style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--text-xs)' }}
          >
            <span aria-hidden="true">⚠️</span>
            <div>
              <strong>Cancelled with Payment History:</strong> This vendor is cancelled but holds{' '}
              <strong>{formatINR(numPaid)}</strong> in historical payments (Refunded: {formatINR(numRefund)}, Net: {formatINR(netPaidPreview)}). Cancellation removes outstanding quote obligations while safely preserving payment records.
            </div>
          </div>
        )}

        <form noValidate onSubmit={handleSubmit} className="flex-col" style={{ gap: 'var(--space-3)' }}>
          {/* Vendor Name & Category */}
          <div className="grid-auto grid-auto--2">
            <div className="form-group">
              <label htmlFor="vendor-modal-name" className="form-label form-label--required">
                Vendor / Business Name
              </label>
              <input
                ref={nameInputRef}
                id="vendor-modal-name"
                type="text"
                className={`form-input ${errors.name ? 'form-input--error' : ''}`}
                placeholder="e.g. Royal Shahi Caterers"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (errors.name) setErrors((prev) => ({ ...prev, name: '' }))
                }}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'error-vendor-name' : undefined}
              />
              {errors.name && (
                <span id="error-vendor-name" className="form-error" role="alert">
                  {errors.name}
                </span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="vendor-modal-category" className="form-label form-label--required">
                Vendor Category
              </label>
              <select
                id="vendor-modal-category"
                className="form-select"
                value={category}
                onChange={(e) => setCategory(e.target.value as VendorCategory)}
              >
                {VendorCategoryValues.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Contact Information & Booking Status */}
          <div className="grid-auto grid-auto--2">
            <div className="form-group">
              <label htmlFor="vendor-modal-contact" className="form-label">
                Contact Info
              </label>
              <input
                id="vendor-modal-contact"
                type="text"
                className={`form-input ${errors.contactInfo ? 'form-input--error' : ''}`}
                placeholder="Phone, email, or manager name"
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                maxLength={200}
              />
            </div>

            <div className="form-group">
              <label htmlFor="vendor-modal-booking" className="form-label form-label--required">
                Booking Status
              </label>
              <select
                id="vendor-modal-booking"
                className="form-select"
                value={bookingStatus}
                onChange={(e) => setBookingStatus(e.target.value as BookingStatus)}
              >
                <option value="enquiring">⏳ Enquiring (Quote stage)</option>
                <option value="booked">✓ Booked (Contract confirmed)</option>
                <option value="cancelled">✕ Cancelled (Booking dropped)</option>
              </select>
            </div>
          </div>

          {/* Quoted Cost, Amount Paid, and Refund Amount */}
          <div className="grid-auto grid-auto--3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
            <div className="form-group">
              <label htmlFor="vendor-modal-quoted" className="form-label form-label--required">
                Quoted Cost (₹)
              </label>
              <input
                id="vendor-modal-quoted"
                type="number"
                min="0"
                step="1"
                className={`form-input ${errors.quotedCost ? 'form-input--error' : ''}`}
                value={quotedCost}
                onChange={(e) => setQuotedCost(e.target.value)}
                aria-invalid={Boolean(errors.quotedCost)}
                aria-describedby={errors.quotedCost ? 'error-vendor-quoted' : undefined}
              />
              <span className="form-hint">{formatINR(parseINRInput(quotedCost))}</span>
              {errors.quotedCost && (
                <span id="error-vendor-quoted" className="form-error" role="alert">
                  {errors.quotedCost}
                </span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="vendor-modal-paid" className="form-label form-label--required">
                Amount Paid (₹)
              </label>
              <input
                id="vendor-modal-paid"
                type="number"
                min="0"
                step="1"
                className={`form-input ${errors.amountPaid ? 'form-input--error' : ''}`}
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                aria-invalid={Boolean(errors.amountPaid)}
                aria-describedby={errors.amountPaid ? 'error-vendor-paid' : undefined}
              />
              <span className="form-hint">{formatINR(parseINRInput(amountPaid))}</span>
              {errors.amountPaid && (
                <span id="error-vendor-paid" className="form-error" role="alert">
                  {errors.amountPaid}
                </span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="vendor-modal-refund" className="form-label">
                Refund Received (₹)
              </label>
              <input
                id="vendor-modal-refund"
                type="number"
                min="0"
                step="1"
                className={`form-input ${errors.refundAmount ? 'form-input--error' : ''}`}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                aria-invalid={Boolean(errors.refundAmount)}
                aria-describedby={errors.refundAmount ? 'error-vendor-refund' : undefined}
              />
              <span className="form-hint">{formatINR(parseINRInput(refundAmount))}</span>
              {errors.refundAmount && (
                <span id="error-vendor-refund" className="form-error" role="alert">
                  {errors.refundAmount}
                </span>
              )}
            </div>
          </div>

          {/* Financial Calculation Banner */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 'var(--space-2) var(--space-3)',
              background: 'var(--color-bg-subtle)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-xs)',
              flexWrap: 'wrap',
              gap: 'var(--space-2)',
            }}
          >
            <div>
              <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Derived Payment Status</span>
              <span
                className={`badge ${
                  derivedStatus === 'paid'
                    ? 'badge--success'
                    : derivedStatus === 'partial'
                    ? 'badge--warning'
                    : 'badge--neutral'
                }`}
              >
                {derivedStatus === 'paid'
                  ? '✓ Fully Paid'
                  : derivedStatus === 'partial'
                  ? '⚡ Partially Paid'
                  : '○ Unpaid'}
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Net Funds Paid</span>
              <strong style={{ color: 'var(--color-sage-600)' }}>{formatINR(netPaidPreview)}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Outstanding Liability</span>
              <strong style={{ color: 'var(--color-accent)' }}>{formatINR(outstandingPreview)}</strong>
            </div>
          </div>

          {/* Budget Linkage */}
          <div className="form-group">
            <label htmlFor="vendor-modal-link" className="form-label">
              Link to Budget Expense Item (Single Source of Truth)
            </label>
            <select
              id="vendor-modal-link"
              className="form-select"
              value={linkedBudgetItemId}
              onChange={(e) => setLinkedBudgetItemId(e.target.value)}
            >
              <option value="">— Do not link to budget (Standalone Vendor) —</option>
              {existingBudgetItems.map((item) => {
                const isLinkedToOther =
                  Boolean(item.currentVendorId) && item.currentVendorId !== initialVendor?.id
                return (
                  <option
                    key={item.id}
                    value={item.id}
                    disabled={isLinkedToOther}
                  >
                    [{item.categoryName}] {item.label}{' '}
                    {isLinkedToOther ? '(Already linked to another vendor)' : ''}
                  </option>
                )
              })}
            </select>
            <span className="form-hint">
              Linking a vendor directly updates the linked expense item&apos;s quote and verified payments, preventing double-counting.
            </span>
          </div>

          {/* Notes */}
          <div className="form-group">
            <label htmlFor="vendor-modal-notes" className="form-label">
              Contract Terms &amp; Notes
            </label>
            <textarea
              id="vendor-modal-notes"
              className={`form-textarea ${errors.notes ? 'form-textarea--error' : ''}`}
              rows={2}
              placeholder="e.g. 30% advance on signing, remaining balance due on arrival."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
            />
            <div className="flex-between">
              <span className="form-hint">Max 500 characters</span>
              <span className="form-hint">{notes.length}/500</span>
            </div>
          </div>

          {/* Modal Actions */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 'var(--space-3)',
              marginTop: 'var(--space-4)',
            }}
          >
            <button type="button" className="btn btn--outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary">
              {initialVendor ? 'Save Vendor Changes' : 'Register Vendor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
