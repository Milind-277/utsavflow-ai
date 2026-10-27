import React, { useState, useEffect, useRef } from 'react'
import type { TimelineTask, TaskPriority } from '@/types'
import { parseDateOnly } from '@/lib/dateOnly'

interface TaskModalProps {
  isOpen: boolean
  eventDate: string
  initialTask?: TimelineTask | null
  onSave: (taskData: {
    title: string
    description: string
    dueDate: string
    priority: TaskPriority
    completed: boolean
  }) => void
  onClose: () => void
}

export function TaskModal({
  isOpen,
  eventDate,
  initialTask,
  onSave,
  onClose,
}: TaskModalProps): React.JSX.Element | null {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [completed, setCompleted] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      if (initialTask) {
        setTitle(initialTask.title)
        setDescription(initialTask.description || '')
        setDueDate(initialTask.dueDate)
        setPriority(initialTask.priority)
        setCompleted(initialTask.completed)
      } else {
        setTitle('')
        setDescription('')
        // Default due date: eventDate or empty
        setDueDate(eventDate || '')
        setPriority('medium')
        setCompleted(false)
      }
      setErrors({})
      setTimeout(() => titleInputRef.current?.focus(), 50)
    }
  }, [isOpen, initialTask, eventDate])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const isAfterEvent = Boolean(dueDate && eventDate && dueDate > eventDate)

  const validate = (): boolean => {
    const errs: Record<string, string> = {}

    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      errs.title = 'Task title is required.'
    } else if (trimmedTitle.length > 200) {
      errs.title = 'Task title cannot exceed 200 characters.'
    }

    const trimmedDate = dueDate.trim()
    if (!trimmedDate) {
      errs.dueDate = 'Due date is required.'
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
      errs.dueDate = 'Due date must be in YYYY-MM-DD format.'
    } else {
      try {
        parseDateOnly(trimmedDate)
      } catch {
        errs.dueDate = 'Invalid calendar date. Please enter a valid date.'
      }
    }

    if (description.length > 500) {
      errs.description = 'Description cannot exceed 500 characters.'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (!validate()) return

    onSave({
      title: title.trim(),
      description: description.trim(),
      dueDate: dueDate.trim(),
      priority,
      completed,
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
        aria-labelledby="task-modal-title"
        style={{ maxWidth: '520px' }}
      >
        <div className="flex-between" style={{ marginBottom: 'var(--space-4)' }}>
          <div>
            <h2
              id="task-modal-title"
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--color-plum-800)',
                fontSize: 'var(--text-xl)',
              }}
            >
              {initialTask ? 'Edit Milestone Task' : 'Add New Milestone Task'}
            </h2>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Celebration Countdown anchored to <strong>{eventDate}</strong>
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

        {isAfterEvent && (
          <div
            className="alert alert--warning"
            style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--text-xs)' }}
          >
            <span aria-hidden="true">⚠️</span>
            <div>
              <strong>Date Warning:</strong> This milestone is scheduled after the event date ({eventDate}). Make sure this is intended (e.g. post-event thank-you notes or return gifts).
            </div>
          </div>
        )}

        <form noValidate onSubmit={handleSubmit} className="flex-col" style={{ gap: 'var(--space-3)' }}>
          {/* Title */}
          <div className="form-group">
            <label htmlFor="task-modal-title-input" className="form-label form-label--required">
              Task Title
            </label>
            <input
              ref={titleInputRef}
              id="task-modal-title-input"
              type="text"
              className={`form-input ${errors.title ? 'form-input--error' : ''}`}
              placeholder="e.g. Finalize bridal henna artist and design"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                if (errors.title) setErrors((prev) => ({ ...prev, title: '' }))
              }}
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? 'error-task-title' : undefined}
            />
            {errors.title && (
              <span id="error-task-title" className="form-error" role="alert">
                {errors.title}
              </span>
            )}
          </div>

          {/* Due Date & Priority */}
          <div className="grid-auto grid-auto--2">
            <div className="form-group">
              <label htmlFor="task-modal-duedate-input" className="form-label form-label--required">
                Due Date
              </label>
              <input
                id="task-modal-duedate-input"
                type="date"
                className={`form-input ${errors.dueDate ? 'form-input--error' : ''}`}
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value)
                  if (errors.dueDate) setErrors((prev) => ({ ...prev, dueDate: '' }))
                }}
                aria-invalid={Boolean(errors.dueDate)}
                aria-describedby={errors.dueDate ? 'error-task-duedate' : undefined}
              />
              {errors.dueDate && (
                <span id="error-task-duedate" className="form-error" role="alert">
                  {errors.dueDate}
                </span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="task-modal-priority-select" className="form-label">
                Priority
              </label>
              <select
                id="task-modal-priority-select"
                className="form-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
              >
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div className="form-group">
            <label htmlFor="task-modal-desc-input" className="form-label">
              Description &amp; Checklist Notes
            </label>
            <textarea
              id="task-modal-desc-input"
              className={`form-textarea ${errors.description ? 'form-textarea--error' : ''}`}
              rows={3}
              placeholder="e.g. Confirm rates, required setup space, and timing."
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
                if (errors.description) setErrors((prev) => ({ ...prev, description: '' }))
              }}
              maxLength={500}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={errors.description ? 'error-task-desc' : undefined}
            />
            <div className="flex-between">
              <span className="form-hint">Max 500 characters</span>
              <span className="form-hint">{description.length}/500</span>
            </div>
            {errors.description && (
              <span id="error-task-desc" className="form-error" role="alert">
                {errors.description}
              </span>
            )}
          </div>

          {/* Completed Checkbox (when editing) */}
          {initialTask && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
              <input
                id="task-modal-completed-checkbox"
                type="checkbox"
                checked={completed}
                onChange={(e) => setCompleted(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--color-brand)', cursor: 'pointer' }}
              />
              <label htmlFor="task-modal-completed-checkbox" style={{ fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
                Mark this task as completed
              </label>
            </div>
          )}

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
              {initialTask ? 'Save Task Changes' : 'Add Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
