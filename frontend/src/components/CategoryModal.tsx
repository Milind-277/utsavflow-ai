import React, { useState, useEffect, useRef } from 'react'

interface CategoryModalProps {
  isOpen: boolean
  onSave: (categoryName: string) => void
  onClose: () => void
}

export function CategoryModal({
  isOpen,
  onSave,
  onClose,
}: CategoryModalProps): React.JSX.Element | null {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setName('')
      setError(null)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

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
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Category name is required.')
      return
    }
    if (trimmed.length > 60) {
      setError('Category name cannot exceed 60 characters.')
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
        aria-labelledby="category-modal-title"
        style={{ maxWidth: '440px' }}
      >
        <div className="flex-between" style={{ marginBottom: 'var(--space-4)' }}>
          <h2 id="category-modal-title" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-plum-800)', fontSize: 'var(--text-xl)' }}>
            Add Budget Category
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

        <form noValidate onSubmit={handleSubmit} className="flex-col">
          <div className="form-group">
            <label htmlFor="category-modal-name" className="form-label form-label--required">
              Category Name
            </label>
            <input
              ref={inputRef}
              id="category-modal-name"
              type="text"
              className={`form-input ${error ? 'form-input--error' : ''}`}
              placeholder="e.g. Return Gifts & Favors"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (error) setError(null)
              }}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'error-category-name' : undefined}
            />
            {error && (
              <span id="error-category-name" className="form-error" role="alert">
                {error}
              </span>
            )}
            <span className="form-hint">Max 60 characters</span>
          </div>

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
              Add Category
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
