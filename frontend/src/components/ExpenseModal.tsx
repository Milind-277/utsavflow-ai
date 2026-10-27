import React, { useState, useEffect, useRef } from 'react'
import type { ExpenseItem, Vendor } from '@/types'
import { formatINR, parseINRInput } from '@/lib/currency'

interface ExpenseModalProps {
  isOpen: boolean
  categoryName: string
  initialItem?: ExpenseItem | null
  linkedVendor?: Vendor | null
  onSave: (itemData: {
    label: string
    allocated: number
    estimated: number
    actual: number
    note: string
  }) => void
  onClose: () => void
}

export function ExpenseModal({
  isOpen,
  categoryName,
  initialItem,
  linkedVendor,
  onSave,
  onClose,
}: ExpenseModalProps): React.JSX.Element | null {
  const [label, setLabel] = useState('')
  const [allocated, setAllocated] = useState('0')
  const [estimated, setEstimated] = useState('0')
  const [actual, setActual] = useState('0')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const labelInputRef = useRef<HTMLInputElement>(null)
  const isVendorLinked = Boolean(initialItem?.vendorId)

  useEffect(() => {
    if (isOpen) {
      if (initialItem) {
        setLabel(initialItem.label)
        setAllocated(String(initialItem.allocated))
        setEstimated(String(initialItem.estimated))
        setActual(String(initialItem.actual))
        setNote(initialItem.note || '')
      } else {
        setLabel('')
        setAllocated('0')
        setEstimated('0')
        setActual('0')
        setNote('')
      }
      setErrors({})
      setTimeout(() => labelInputRef.current?.focus(), 50)
    }
  }, [isOpen, initialItem])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const validate = (): boolean => {
    const errs: Record<string, string> = {}

    if (!label.trim()) {
      errs.label = 'Expense label is required.'
    } else if (label.trim().length > 120) {
      errs.label = 'Label cannot exceed 120 characters.'
    }

    const allocNum = Number(allocated)
    if (!Number.isFinite(allocNum) || isNaN(allocNum) || allocNum < 0 || !Number.isInteger(allocNum)) {
      errs.allocated = 'Allocated amount must be a whole non-negative integer (whole INR).'
    }

    if (!isVendorLinked) {
      const estNum = Number(estimated)
      if (!Number.isFinite(estNum) || isNaN(estNum) || estNum < 0 || !Number.isInteger(estNum)) {
        errs.estimated = 'Estimated amount must be a whole non-negative integer (whole INR).'
      }

      const actNum = Number(actual)
      if (!Number.isFinite(actNum) || isNaN(actNum) || actNum < 0 || !Number.isInteger(actNum)) {
        errs.actual = 'Actual amount must be a whole non-negative integer (whole INR).'
      }
    }

    if (note.length > 300) {
      errs.note = 'Note cannot exceed 300 characters.'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (!validate()) return

    const allocNum = parseINRInput(allocated)
    const estNum = isVendorLinked ? (initialItem?.estimated ?? 0) : parseINRInput(estimated)
    const actNum = isVendorLinked ? (initialItem?.actual ?? 0) : parseINRInput(actual)

    onSave({
      label: label.trim(),
      allocated: allocNum,
      estimated: estNum,
      actual: actNum,
      note: note.trim(),
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
        aria-labelledby="expense-modal-title"
        style={{ maxWidth: '520px' }}
      >
        <div className="flex-between" style={{ marginBottom: 'var(--space-4)' }}>
          <div>
            <h2 id="expense-modal-title" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-plum-800)', fontSize: 'var(--text-xl)' }}>
              {initialItem ? 'Edit Expense Item' : 'Add New Expense Item'}
            </h2>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Category: <strong>{categoryName}</strong>
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

        {isVendorLinked && (
          <div className="alert alert--info" style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--text-xs)' }}>
            <span>🔒</span>
            <div>
              <strong>Vendor-Linked Expense:</strong> This expense is synced to vendor{' '}
              <strong>{linkedVendor?.name || 'Registered Vendor'}</strong>. Estimated and actual spending
              are derived directly from vendor contracts and payments and cannot be edited independently.
            </div>
          </div>
        )}

        <form noValidate onSubmit={handleSubmit} className="flex-col" style={{ gap: 'var(--space-3)' }}>
          {/* Label */}
          <div className="form-group">
            <label htmlFor="expense-modal-label" className="form-label form-label--required">
              Expense Label
            </label>
            <input
              ref={labelInputRef}
              id="expense-modal-label"
              type="text"
              className={`form-input ${errors.label ? 'form-input--error' : ''}`}
              placeholder="e.g. Stage floral installation"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              aria-invalid={Boolean(errors.label)}
              aria-describedby={errors.label ? 'error-expense-label' : undefined}
            />
            {errors.label && (
              <span id="error-expense-label" className="form-error" role="alert">
                {errors.label}
              </span>
            )}
          </div>

          {/* Allocated Envelope */}
          <div className="form-group">
            <label htmlFor="expense-modal-allocated" className="form-label form-label--required">
              Planned Allocation (₹)
            </label>
            <input
              id="expense-modal-allocated"
              type="number"
              min="0"
              step="1"
              className={`form-input ${errors.allocated ? 'form-input--error' : ''}`}
              value={allocated}
              onChange={(e) => setAllocated(e.target.value)}
              aria-invalid={Boolean(errors.allocated)}
              aria-describedby={errors.allocated ? 'error-expense-allocated' : undefined}
            />
            <span className="form-hint">
              Formatted: <strong>{formatINR(parseINRInput(allocated))}</strong> (Planned ceiling for this line item)
            </span>
            {errors.allocated && (
              <span id="error-expense-allocated" className="form-error" role="alert">
                {errors.allocated}
              </span>
            )}
          </div>

          {/* Two-column: Estimated & Actual */}
          <div className="grid-auto grid-auto--2">
            <div className="form-group">
              <label htmlFor="expense-modal-estimated" className="form-label">
                Estimated Cost (₹)
              </label>
              <input
                id="expense-modal-estimated"
                type="number"
                min="0"
                step="1"
                disabled={isVendorLinked}
                className={`form-input ${errors.estimated ? 'form-input--error' : ''}`}
                value={estimated}
                onChange={(e) => setEstimated(e.target.value)}
                aria-invalid={Boolean(errors.estimated)}
                aria-describedby={errors.estimated ? 'error-expense-estimated' : undefined}
              />
              <span className="form-hint">
                {isVendorLinked ? 'Synced from vendor quote' : formatINR(parseINRInput(estimated))}
              </span>
              {errors.estimated && (
                <span id="error-expense-estimated" className="form-error" role="alert">
                  {errors.estimated}
                </span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="expense-modal-actual" className="form-label">
                Actual Spending (₹)
              </label>
              <input
                id="expense-modal-actual"
                type="number"
                min="0"
                step="1"
                disabled={isVendorLinked}
                className={`form-input ${errors.actual ? 'form-input--error' : ''}`}
                value={actual}
                onChange={(e) => setActual(e.target.value)}
                aria-invalid={Boolean(errors.actual)}
                aria-describedby={errors.actual ? 'error-expense-actual' : undefined}
              />
              <span className="form-hint">
                {isVendorLinked ? 'Synced from payments' : formatINR(parseINRInput(actual))}
              </span>
              {errors.actual && (
                <span id="error-expense-actual" className="form-error" role="alert">
                  {errors.actual}
                </span>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="form-group">
            <label htmlFor="expense-modal-note" className="form-label">
              Notes (Optional)
            </label>
            <textarea
              id="expense-modal-note"
              className={`form-textarea ${errors.note ? 'form-textarea--error' : ''}`}
              rows={2}
              placeholder="e.g. Rate negotiated with vendor; includes transport."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
            />
            <div className="flex-between">
              <span className="form-hint">Max 300 characters</span>
              <span className="form-hint">{note.length}/300</span>
            </div>
            {errors.note && (
              <span className="form-error" role="alert">
                {errors.note}
              </span>
            )}
          </div>

          {/* Modal Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
            <button
              type="button"
              className="btn btn--outline"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--primary"
            >
              {initialItem ? 'Save Changes' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
