import React, { useState, useMemo } from 'react'
import { nanoid } from 'nanoid'
import type { EventPlan, TimelineTask, TaskPriority } from '@/types'
import {
  isOverdue,
  formatTaskDueLabel,
  taskCompletionPct,
  recalculateTaskDates,
  generateDefaultTasks,
} from '@/lib/timeline'
import { daysUntilEvent, calendarDaysBetween, parseDateOnly } from '@/lib/dateOnly'
import { TaskModal } from './TaskModal'
import { EventDateModal } from './EventDateModal'
import { ConfirmDialog } from './ConfirmDialog'

interface TimelineTabProps {
  plan: EventPlan
  onToggleTask: (taskId: string) => void
  onUpdatePlan?: (updatedPlan: EventPlan) => void
}

type FilterMode = 'all' | 'pending' | 'completed' | 'high' | 'overdue'
type SortMode = 'date-asc' | 'date-desc' | 'priority'

export function TimelineTab({
  plan,
  onToggleTask,
  onUpdatePlan,
}: TimelineTabProps): React.JSX.Element {
  const [filter, setFilter] = useState<FilterMode>('all')
  const [sortBy, setSortBy] = useState<SortMode>('date-asc')

  // Modals state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<TimelineTask | null>(null)

  const [isDateModalOpen, setIsDateModalOpen] = useState(false)
  const [deleteTaskTarget, setDeleteTaskTarget] = useState<TimelineTask | null>(null)

  const [feedback, setFeedback] = useState<{ type: 'success' | 'info'; message: string } | null>(null)

  const showFeedback = (type: 'success' | 'info', message: string): void => {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 4000)
  }

  // Days until celebration
  let daysRemaining: number | null = null
  try {
    daysRemaining = daysUntilEvent(plan.date)
  } catch {
    daysRemaining = null
  }

  const completionPct = taskCompletionPct(plan.timeline)

  // Counts for filter chips
  const counts = useMemo(() => {
    const all = plan.timeline.length
    const pending = plan.timeline.filter((t) => !t.completed).length
    const completed = plan.timeline.filter((t) => t.completed).length
    const high = plan.timeline.filter((t) => t.priority === 'high').length
    const overdue = plan.timeline.filter((t) => isOverdue(t)).length
    return { all, pending, completed, high, overdue }
  }, [plan.timeline])

  // Apply filter and sort
  const filteredAndSortedTasks = useMemo(() => {
    const list = plan.timeline.filter((task) => {
      if (filter === 'pending') return !task.completed
      if (filter === 'completed') return task.completed
      if (filter === 'high') return task.priority === 'high'
      if (filter === 'overdue') return isOverdue(task)
      return true
    })

    return [...list].sort((a, b) => {
      if (sortBy === 'date-asc') {
        return a.dueDate.localeCompare(b.dueDate)
      }
      if (sortBy === 'date-desc') {
        return b.dueDate.localeCompare(a.dueDate)
      }
      if (sortBy === 'priority') {
        const priorityScore: Record<TaskPriority, number> = { high: 3, medium: 2, low: 1 }
        const diff = priorityScore[b.priority] - priorityScore[a.priority]
        if (diff !== 0) return diff
        return a.dueDate.localeCompare(b.dueDate)
      }
      return 0
    })
  }, [plan.timeline, filter, sortBy])

  // Helper to commit timeline updates to state & storage
  const applyTimelineUpdate = (updatedTimeline: TimelineTask[], actionDesc: string): void => {
    const updatedPlan: EventPlan = {
      ...plan,
      timeline: updatedTimeline,
      updatedAt: new Date().toISOString(),
    }
    if (onUpdatePlan) {
      onUpdatePlan(updatedPlan)
    }
    showFeedback('success', actionDesc)
  }

  // ── Task Actions ──────────────────────────────────────────
  const handleToggle = (taskId: string): void => {
    const target = plan.timeline.find((t) => t.id === taskId)
    const nextCompleted = !target?.completed

    const updatedTimeline = plan.timeline.map((t) =>
      t.id === taskId ? { ...t, completed: nextCompleted } : t
    )

    if (onUpdatePlan) {
      applyTimelineUpdate(
        updatedTimeline,
        target ? `Task "${target.title}" marked as ${nextCompleted ? 'completed' : 'pending'}.` : 'Task updated.'
      )
    } else {
      onToggleTask(taskId)
    }
  }

  const handleOpenAddTask = (): void => {
    setEditingTask(null)
    setIsTaskModalOpen(true)
  }

  const handleOpenEditTask = (task: TimelineTask): void => {
    setEditingTask(task)
    setIsTaskModalOpen(true)
  }

  const handleSaveTask = (taskData: {
    title: string
    description: string
    dueDate: string
    priority: TaskPriority
    completed: boolean
  }): void => {
    let offsetDays = 0
    try {
      offsetDays = calendarDaysBetween(parseDateOnly(plan.date), parseDateOnly(taskData.dueDate))
    } catch {
      offsetDays = 0
    }

    const hasDateWarning = taskData.dueDate > plan.date

    let updatedTimeline: TimelineTask[]

    if (editingTask) {
      // Edit existing task
      updatedTimeline = plan.timeline.map((t) => {
        if (t.id !== editingTask.id) return t
        return {
          ...t,
          title: taskData.title,
          description: taskData.description,
          dueDate: taskData.dueDate,
          priority: taskData.priority,
          completed: taskData.completed,
          offsetDays: t.isUserAdded ? offsetDays : t.offsetDays,
          hasDateWarning: t.isUserAdded ? hasDateWarning : t.hasDateWarning,
        }
      })
      setIsTaskModalOpen(false)
      setEditingTask(null)
      applyTimelineUpdate(updatedTimeline, `Task "${taskData.title}" updated successfully.`)
    } else {
      // Create new user-added task
      const newTask: TimelineTask = {
        id: `task-${nanoid(10)}`,
        title: taskData.title,
        description: taskData.description,
        dueDate: taskData.dueDate,
        priority: taskData.priority,
        completed: taskData.completed,
        offsetDays,
        isUserAdded: true,
        hasDateWarning,
      }
      updatedTimeline = [...plan.timeline, newTask].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      setIsTaskModalOpen(false)
      applyTimelineUpdate(updatedTimeline, `Task "${taskData.title}" added to your celebration timeline.`)
    }
  }

  const handleDeleteTaskConfirm = (): void => {
    if (!deleteTaskTarget) return
    const title = deleteTaskTarget.title
    const updatedTimeline = plan.timeline.filter((t) => t.id !== deleteTaskTarget.id)
    setDeleteTaskTarget(null)
    applyTimelineUpdate(updatedTimeline, `Task "${title}" removed from timeline.`)
  }

  // ── Event Date Update & Smart Recalculation ────────────────
  const handleSaveEventDate = (newDate: string): void => {
    setIsDateModalOpen(false)
    const recalculated = recalculateTaskDates(plan.timeline, newDate)
    const updatedPlan: EventPlan = {
      ...plan,
      date: newDate,
      timeline: recalculated,
      updatedAt: new Date().toISOString(),
    }
    if (onUpdatePlan) {
      onUpdatePlan(updatedPlan)
    }
    showFeedback('success', `Event date changed to ${newDate}. System milestone countdowns recalculated.`)
  }

  // ── Add / Restore Default Milestones Without Duplicates ────
  const handleAddDefaultMilestones = (): void => {
    const templates = generateDefaultTasks(plan.type, plan.date)
    const existingTitles = new Set(plan.timeline.map((t) => t.title.toLowerCase().trim()))

    const newTasks = templates.filter((tpl) => !existingTitles.has(tpl.title.toLowerCase().trim()))

    if (newTasks.length === 0) {
      showFeedback('info', 'All recommended template milestones are already present in your timeline.')
      return
    }

    const merged = [...plan.timeline, ...newTasks].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    applyTimelineUpdate(merged, `Added ${newTasks.length} recommended milestone tasks without duplicates.`)
  }

  const getPriorityBadgeClass = (priority: TaskPriority): string => {
    if (priority === 'high') return 'badge badge--accent'
    if (priority === 'medium') return 'badge badge--warning'
    return 'badge badge--neutral'
  }

  return (
    <div className="flex-col" style={{ gap: 'var(--space-6)' }}>
      {/* ── Feedback Announcement ────────────────────────────── */}
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

      {/* ── Master Countdown & Progress Header ───────────────── */}
      <section className="card card--raised" style={{ padding: 'var(--space-6)' }} aria-label="Timeline Overview & Countdown">
        <div className="flex-between" style={{ marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)', flexWrap: 'wrap' }}>
              <span className="badge badge--brand" style={{ textTransform: 'capitalize' }}>
                {plan.type} Timeline
              </span>
              <span className="badge badge--highlight">
                Event Date: <strong>{plan.date}</strong>
              </span>
              {daysRemaining !== null && (
                <span
                  className={`badge ${
                    daysRemaining < 0
                      ? 'badge--error'
                      : daysRemaining === 0
                      ? 'badge--warning'
                      : 'badge--success'
                  }`}
                >
                  {daysRemaining < 0
                    ? `⚠️ Occurred ${Math.abs(daysRemaining)} days ago`
                    : daysRemaining === 0
                    ? '🎉 Event is Today!'
                    : `⏳ ${daysRemaining} days until event`}
                </span>
              )}
            </div>

            <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--color-plum-800)', fontSize: 'var(--text-2xl)' }}>
              Master Countdown Schedule
            </h2>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Date-aware milestone checklist anchored to your celebration date. System dates auto-recalculate on date changes.
            </p>
          </div>

          {/* Quick Actions */}
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={handleOpenAddTask}
            >
              + Add Task
            </button>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={() => setIsDateModalOpen(true)}
              title="Change event date and recalculate milestones"
            >
              📅 Adjust Event Date
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={handleAddDefaultMilestones}
              title="Add any missing recommended milestones without duplicating existing ones"
            >
              ⚡ Add Default Milestones
            </button>
          </div>
        </div>

        {/* Progress Bar & Stats */}
        <div style={{ marginTop: 'var(--space-3)' }}>
          <div className="flex-between" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>
            <span>
              Overall Preparation Progress: <strong>{completionPct}%</strong>
            </span>
            <span>
              <strong>{counts.completed}</strong> of <strong>{counts.all}</strong> milestones completed
            </span>
          </div>

          <div className="progress-bar">
            <div
              className="progress-bar__fill progress-bar__fill--success"
              style={{ width: `${completionPct}%` }}
              role="progressbar"
              aria-valuenow={completionPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Milestone checklist completion percentage"
            />
          </div>
        </div>
      </section>

      {/* ── Filters and Sorting Controls ─────────────────────── */}
      <div className="flex-between" style={{ flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        {/* Filter Chips */}
        <div className="chip-group" role="group" aria-label="Task filters">
          <button
            type="button"
            className={`chip ${filter === 'all' ? 'chip--active' : ''}`}
            onClick={() => setFilter('all')}
            aria-pressed={filter === 'all'}
          >
            All Tasks ({counts.all})
          </button>
          <button
            type="button"
            className={`chip ${filter === 'pending' ? 'chip--active' : ''}`}
            onClick={() => setFilter('pending')}
            aria-pressed={filter === 'pending'}
          >
            Pending ({counts.pending})
          </button>
          <button
            type="button"
            className={`chip ${filter === 'completed' ? 'chip--active' : ''}`}
            onClick={() => setFilter('completed')}
            aria-pressed={filter === 'completed'}
          >
            Completed ({counts.completed})
          </button>
          <button
            type="button"
            className={`chip ${filter === 'high' ? 'chip--active' : ''}`}
            onClick={() => setFilter('high')}
            aria-pressed={filter === 'high'}
          >
            High Priority ({counts.high})
          </button>
          <button
            type="button"
            className={`chip ${filter === 'overdue' ? 'chip--active' : ''}`}
            onClick={() => setFilter('overdue')}
            aria-pressed={filter === 'overdue'}
            style={
              counts.overdue > 0 && filter !== 'overdue'
                ? { borderColor: 'var(--color-error)', color: 'var(--color-error)' }
                : undefined
            }
          >
            {counts.overdue > 0 ? '⚠️ ' : ''}Overdue ({counts.overdue})
          </button>
        </div>

        {/* Sort Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <label htmlFor="timeline-sort-select" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            Sort by:
          </label>
          <select
            id="timeline-sort-select"
            className="form-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortMode)}
            style={{ fontSize: 'var(--text-xs)', padding: 'var(--space-1) var(--space-3)' }}
          >
            <option value="date-asc">Due Date (Earliest First)</option>
            <option value="date-desc">Due Date (Latest First)</option>
            <option value="priority">Priority (High to Low)</option>
          </select>
        </div>
      </div>

      {/* ── Tasks List ──────────────────────────────────────── */}
      {filteredAndSortedTasks.length === 0 ? (
        <div className="empty-state card card--flat">
          <div className="empty-state__icon" aria-hidden="true">
            {filter === 'overdue' ? '🎉' : filter === 'completed' ? '⏳' : '📋'}
          </div>
          <div className="empty-state__title">
            {filter === 'all' && 'No Tasks in Timeline'}
            {filter === 'pending' && 'All Tasks Completed!'}
            {filter === 'completed' && 'No Completed Tasks Yet'}
            {filter === 'high' && 'No High Priority Tasks'}
            {filter === 'overdue' && 'No Overdue Tasks!'}
          </div>
          <p className="empty-state__body">
            {filter === 'all' && 'Your celebration timeline is currently empty. Add your first custom task or generate recommended milestones.'}
            {filter === 'pending' && 'Congratulations! You have marked all current tasks as complete.'}
            {filter === 'completed' && 'You have not checked off any tasks yet. Click the checkbox on any task when you finish it.'}
            {filter === 'high' && 'None of your tasks are currently marked high priority.'}
            {filter === 'overdue' && 'Great job! You have zero overdue tasks. Everything is on schedule.'}
          </p>
          {filter === 'all' && (
            <div style={{ marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)' }}>
              <button type="button" className="btn btn--primary btn--sm" onClick={handleOpenAddTask}>
                + Add Custom Task
              </button>
              <button type="button" className="btn btn--outline btn--sm" onClick={handleAddDefaultMilestones}>
                ⚡ Generate Milestones
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {filteredAndSortedTasks.map((task) => {
            const overdue = isOverdue(task)

            return (
              <div
                key={task.id}
                data-testid={`task-card-${task.id}`}
                className="card card--raised"
                style={{
                  padding: 'var(--space-4)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--space-4)',
                  background: task.completed
                    ? 'var(--color-bg-subtle)'
                    : overdue
                    ? 'var(--color-error-subtle)'
                    : 'var(--color-bg-card)',
                  borderColor: overdue && !task.completed ? 'var(--color-error-border)' : undefined,
                  transition: 'background var(--duration-fast)',
                }}
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => handleToggle(task.id)}
                  aria-label={`Mark "${task.title}" as ${task.completed ? 'incomplete' : 'complete'}`}
                  style={{
                    width: '20px',
                    height: '20px',
                    marginTop: '2px',
                    accentColor: 'var(--color-brand)',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                />

                {/* Content */}
                <div style={{ flex: 1 }}>
                  <div
                    className="flex-between"
                    style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-2)' }}
                  >
                    <div>
                      <h3
                        style={{
                          fontSize: 'var(--text-base)',
                          fontWeight: 'var(--weight-semibold)',
                          textDecoration: task.completed ? 'line-through' : 'none',
                          color: task.completed ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                        }}
                      >
                        {task.title}
                      </h3>
                    </div>

                    {/* Badges */}
                    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className={getPriorityBadgeClass(task.priority)} style={{ textTransform: 'capitalize' }}>
                        {task.priority} Priority
                      </span>

                      {/* Due Status Badge */}
                      <span
                        className={`badge ${
                          task.completed
                            ? 'badge--success'
                            : overdue
                            ? 'badge--error'
                            : 'badge--neutral'
                        }`}
                      >
                        {task.completed
                          ? '✓ Completed'
                          : overdue
                          ? `⚠️ ${formatTaskDueLabel(task)}`
                          : formatTaskDueLabel(task)}
                      </span>

                      {/* Source Badge */}
                      <span className="badge badge--neutral" style={{ fontSize: '10px' }}>
                        {task.isUserAdded ? '👤 Custom' : '⚙️ Template'}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  {task.description && (
                    <p
                      style={{
                        fontSize: 'var(--text-xs)',
                        color: task.completed ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
                        marginTop: 'var(--space-1)',
                      }}
                    >
                      {task.description}
                    </p>
                  )}

                  {/* Meta Details & Action Buttons Footer */}
                  <div
                    className="flex-between"
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-text-muted)',
                      marginTop: 'var(--space-2)',
                      flexWrap: 'wrap',
                      gap: 'var(--space-2)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                      <span>
                        Due Date: <strong>{task.dueDate}</strong>
                      </span>
                      <span>
                        ({task.offsetDays < 0
                          ? `${Math.abs(task.offsetDays)} days before event`
                          : task.offsetDays === 0
                          ? 'On event day'
                          : `${task.offsetDays} days after event`})
                      </span>
                      {task.hasDateWarning && (
                        <span className="badge badge--warning">
                          ⚠️ Due after event date
                        </span>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <button
                        type="button"
                        className="btn btn--outline btn--sm"
                        style={{ minHeight: '32px', padding: 'var(--space-1) var(--space-3)', fontSize: 'var(--text-xs)' }}
                        onClick={() => handleOpenEditTask(task)}
                        aria-label={`Edit task "${task.title}"`}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn--danger btn--sm"
                        style={{ minHeight: '32px', padding: 'var(--space-1) var(--space-3)', fontSize: 'var(--text-xs)' }}
                        onClick={() => setDeleteTaskTarget(task)}
                        aria-label={`Delete task "${task.title}"`}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modals & Dialogs ─────────────────────────────────── */}
      <TaskModal
        isOpen={isTaskModalOpen}
        eventDate={plan.date}
        initialTask={editingTask}
        onSave={handleSaveTask}
        onClose={() => {
          setIsTaskModalOpen(false)
          setEditingTask(null)
        }}
      />

      <EventDateModal
        isOpen={isDateModalOpen}
        currentDate={plan.date}
        onSave={handleSaveEventDate}
        onClose={() => setIsDateModalOpen(false)}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTaskTarget)}
        title="Delete Milestone Task?"
        message={`Are you sure you want to delete "${deleteTaskTarget?.title}"? This cannot be undone.`}
        confirmText="Delete Task"
        cancelText="Cancel"
        confirmVariant="danger"
        onConfirm={handleDeleteTaskConfirm}
        onCancel={() => setDeleteTaskTarget(null)}
      />
    </div>
  )
}
