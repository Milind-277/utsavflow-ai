import React, { useState, useEffect, useRef } from 'react'
import { parseDateOnly } from '@/lib/dateOnly'

interface EventDateModalProps {
  isOpen: boolean
  currentDate: string
  onSave: (newDate: string) => void
  onClose: () => void
}

export function EventDateModal({
  isOpen,
  currentDate,
  onSave,
  onClose,
}: EventDateModalProps): React.JSX.Element | null {
  const [date, setDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setDate(currentDate)
      setError(null)
      setTimeout(() => dateInputRef.current?.focus(), 50)
    }
  }, [isOpen, currentDate])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    const trimmed = date.trim()

    if (!trimmed) {
      setError('Event date is required.')
      return
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      setError('Date must be in YYYY-MM-DD format.')
      return
    }

    try {
      parseDateOnly(trimmed)
    } catch {
      setError('Invalid calendar date. Please enter a real date.')
      return
    }

    onSave(trimmed)
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
        aria-labelledby="event-date-modal-title"
        style={{ maxWidth: '480px' }}
      >
        <div className="flex-between" style={{ marginBottom: 'var(--space-4)' }}>
          <h2
            id="event-date-modal-title"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--color-plum-800)',
              fontSize: 'var(--text-xl)',
            }}
          >
            Adjust Celebration Date
          </h2>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <div
          className="alert alert--info"
          style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--text-xs)' }}
        >
          <span aria-hidden="true">ℹ️</span>
          <div>
            <strong>Smart Date Recalculation:</strong> Updating your event date will automatically reschedule all system-generated milestone tasks according to their countdown offsets. Custom tasks you created with fixed dates will keep their dates, and any conflicts will be flagged.
          </div>
        </div>

        <form noValidate onSubmit={handleSubmit} className="flex-col">
          <div className="form-group">
            <label htmlFor="event-date-modal-input" className="form-label form-label--required">
              New Event Date
            </label>
            <input
              ref={dateInputRef}
              id="event-date-modal-input"
              type="date"
              className={`form-input ${error ? 'form-input--error' : ''}`}
              value={date}
              onChange={(e) => {
                setDate(e.target.value)
                if (error) setError(null)
              }}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'error-event-date' : undefined}
            />
            {error && (
              <span id="error-event-date" className="form-error" role="alert">
                {error}
              </span>
            )}
            <span className="form-hint">
              Current scheduled date: <strong>{currentDate}</strong>
            </span>
          </div>

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
              Update Date &amp; Recalculate
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
