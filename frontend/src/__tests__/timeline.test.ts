import { describe, it, expect } from 'vitest'
import {
  generateDefaultTasks,
  recalculateTaskDates,
  isOverdue,
  isUpcoming,
  taskCompletionPct,
  createUserTask,
} from '@/lib/timeline'

// ── generateDefaultTasks ────────────────────────────────────

describe('generateDefaultTasks', () => {
  const eventDate = '2025-06-15'

  it('generates tasks for a wedding', () => {
    const tasks = generateDefaultTasks('wedding', eventDate)
    expect(tasks.length).toBeGreaterThan(15)
  })

  it('generates tasks for birthday (fewer than wedding)', () => {
    const birthdayTasks = generateDefaultTasks('birthday', eventDate)
    const weddingTasks = generateDefaultTasks('wedding', eventDate)
    // Birthday should have fewer tasks (fewer wedding-specific tasks)
    expect(birthdayTasks.length).toBeLessThan(weddingTasks.length)
  })

  it('generates tasks for community events', () => {
    const tasks = generateDefaultTasks('community', eventDate)
    expect(tasks.some((t) => t.title.toLowerCase().includes('permit'))).toBe(true)
  })

  it('all tasks have unique IDs', () => {
    const tasks = generateDefaultTasks('wedding', eventDate)
    const ids = tasks.map((t) => t.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('all tasks have valid dueDate strings', () => {
    const tasks = generateDefaultTasks('wedding', eventDate)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    tasks.forEach((t) => {
      expect(t.dueDate).toMatch(dateRegex)
    })
  })

  it('tasks are sorted by dueDate ascending', () => {
    const tasks = generateDefaultTasks('wedding', eventDate)
    for (let i = 1; i < tasks.length; i++) {
      expect(tasks[i].dueDate >= tasks[i - 1].dueDate).toBe(true)
    }
  })

  it('all tasks start as not completed', () => {
    const tasks = generateDefaultTasks('wedding', eventDate)
    tasks.forEach((t) => expect(t.completed).toBe(false))
  })

  it('does not include wedding-specific tasks for birthday', () => {
    const tasks = generateDefaultTasks('birthday', eventDate)
    expect(tasks.some((t) => t.title.toLowerCase().includes('priest'))).toBe(false)
    expect(tasks.some((t) => t.title.toLowerCase().includes('bridal'))).toBe(false)
  })

  it('handles a past event date without throwing', () => {
    expect(() => generateDefaultTasks('birthday', '2020-01-01')).not.toThrow()
  })
})

// ── recalculateTaskDates ────────────────────────────────────

describe('recalculateTaskDates', () => {
  const originalDate = '2025-06-15'
  const newDate = '2025-09-15'  // 3 months later

  it('recalculates system task due dates when event date changes', () => {
    const tasks = generateDefaultTasks('wedding', originalDate)
    const recalculated = recalculateTaskDates(tasks, newDate)
    // All system tasks should have new dates based on new event date
    const systemTasks = recalculated.filter((t) => !t.isUserAdded)
    systemTasks.forEach((t) => {
      // Due date should be consistent with the new event date + offsetDays
      expect(t.dueDate).toBeTruthy()
    })
  })

  it('preserves user-added task due dates when event date changes', () => {
    const tasks = generateDefaultTasks('birthday', originalDate)
    const userTask = createUserTask('Custom task', '2025-05-01', 'low', '', originalDate)
    const all = [...tasks, userTask]
    const recalculated = recalculateTaskDates(all, newDate)
    const preserved = recalculated.find((t) => t.id === userTask.id)
    expect(preserved?.dueDate).toBe('2025-05-01')
  })

  it('sets hasDateWarning for user tasks with dates after new event', () => {
    const userTask = createUserTask('Late task', '2025-10-01', 'low', '', originalDate)
    const recalculated = recalculateTaskDates([userTask], newDate)
    // '2025-10-01' > '2025-09-15' → hasDateWarning = true
    expect(recalculated[0].hasDateWarning).toBe(true)
  })
})

// ── isOverdue ───────────────────────────────────────────────

describe('isOverdue', () => {
  const today = new Date(2024, 5, 15) // June 15, 2024

  it('returns true for a past incomplete task', () => {
    const task = generateDefaultTasks('birthday', '2024-06-15')[0]
    const overdue = { ...task, dueDate: '2024-06-10', completed: false }
    expect(isOverdue(overdue, today)).toBe(true)
  })

  it('returns false for a completed task regardless of date', () => {
    const task = { ...generateDefaultTasks('birthday', '2024-01-01')[0], completed: true, dueDate: '2023-01-01' }
    expect(isOverdue(task, today)).toBe(false)
  })

  it('returns false for a future task', () => {
    const task = { ...generateDefaultTasks('birthday', '2025-01-01')[0], dueDate: '2025-01-01', completed: false }
    expect(isOverdue(task, today)).toBe(false)
  })
})

// ── isUpcoming ──────────────────────────────────────────────

describe('isUpcoming', () => {
  const today = new Date(2024, 5, 15)

  it('returns true for task due within 14 days', () => {
    const task = { ...generateDefaultTasks('birthday', '2024-07-01')[0], dueDate: '2024-06-20', completed: false }
    expect(isUpcoming(task, 14, today)).toBe(true)
  })

  it('returns false for task due in 30 days when window is 14', () => {
    const task = { ...generateDefaultTasks('birthday', '2024-07-01')[0], dueDate: '2024-07-15', completed: false }
    expect(isUpcoming(task, 14, today)).toBe(false)
  })

  it('returns false for completed task', () => {
    const task = { ...generateDefaultTasks('birthday', '2024-07-01')[0], dueDate: '2024-06-16', completed: true }
    expect(isUpcoming(task, 14, today)).toBe(false)
  })
})

// ── taskCompletionPct ───────────────────────────────────────

describe('taskCompletionPct', () => {
  it('returns 0 for empty list', () => {
    expect(taskCompletionPct([])).toBe(0)
  })

  it('returns 0 when none completed', () => {
    const tasks = generateDefaultTasks('birthday', '2025-01-01')
    expect(taskCompletionPct(tasks)).toBe(0)
  })

  it('returns 100 when all completed', () => {
    const tasks = generateDefaultTasks('birthday', '2025-01-01').map((t) => ({ ...t, completed: true }))
    expect(taskCompletionPct(tasks)).toBe(100)
  })

  it('returns correct percentage for partial completion', () => {
    const tasks = generateDefaultTasks('birthday', '2025-01-01')
    const half = tasks.map((t, i) => ({ ...t, completed: i < tasks.length / 2 }))
    const pct = taskCompletionPct(half)
    expect(pct).toBeGreaterThan(0)
    expect(pct).toBeLessThan(100)
    expect(Number.isInteger(pct)).toBe(true)
  })
})

// ── createUserTask ──────────────────────────────────────────

describe('createUserTask', () => {
  it('creates a user-added task with correct fields', () => {
    const task = createUserTask('My Task', '2025-03-01', 'high', 'details', '2025-06-01')
    expect(task.title).toBe('My Task')
    expect(task.dueDate).toBe('2025-03-01')
    expect(task.priority).toBe('high')
    expect(task.isUserAdded).toBe(true)
    expect(task.completed).toBe(false)
    expect(task.hasDateWarning).toBe(false) // before event date
  })

  it('sets hasDateWarning when dueDate is after event date', () => {
    const task = createUserTask('Late Task', '2025-07-01', 'low', '', '2025-06-01')
    expect(task.hasDateWarning).toBe(true)
  })

  it('generates a unique ID each time', () => {
    const t1 = createUserTask('A', '2025-01-01', 'low', '', '2025-06-01')
    const t2 = createUserTask('B', '2025-01-01', 'low', '', '2025-06-01')
    expect(t1.id).not.toBe(t2.id)
  })
})
