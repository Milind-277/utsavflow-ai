import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import App from '../App'
import { TimelineTab } from '../components/TimelineTab'
import { createDemoPlan } from '../lib/demoData'
import { clearEventPlan, saveEventPlan } from '../lib/storage'
import { createNewEventPlan } from '../lib/planFactory'
import type { EventPlan, TimelineTask } from '../types'
import { addCalendarDays, todayString } from '../lib/dateOnly'

describe('M6 — Smart Timeline Functional Test Suite', () => {
  beforeEach(() => {
    clearEventPlan()
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    clearEventPlan()
  })

  const makeTestPlan = (overrides: Partial<EventPlan> = {}): EventPlan => {
    const base = createNewEventPlan({
      type: 'wedding',
      name: 'Priya & Arjun Wedding',
      date: '2026-12-15',
      city: 'Jaipur',
      guestCount: 250,
      budgetTotal: 15_00_000,
      theme: 'Royal Rajputana',
      dietaryRequirements: 'Vegetarian',
      accessibilityNeeds: 'Wheelchair access',
    })
    return { ...base, ...overrides }
  }

  // ── 1. Task Management: Add, Edit, Complete, Uncomplete, Delete ──
  describe('Task Management (CRUD)', () => {
    it('allows adding a new user-created milestone task', () => {
      const plan = makeTestPlan()
      const onUpdate = vi.fn()

      render(<TimelineTab plan={plan} onToggleTask={vi.fn()} onUpdatePlan={onUpdate} />)

      // Open Add Task modal
      fireEvent.click(screen.getByRole('button', { name: /\+ add task/i }))

      const dialog = screen.getByRole('dialog')
      expect(dialog).toBeInTheDocument()
      expect(within(dialog).getByText(/add new milestone task/i)).toBeInTheDocument()

      // Fill in fields
      fireEvent.change(within(dialog).getByLabelText(/task title/i), {
        target: { value: 'Book Shehnai & Dhol Troupe' },
      })
      fireEvent.change(within(dialog).getByLabelText(/due date/i), {
        target: { value: '2026-10-15' },
      })
      fireEvent.change(within(dialog).getByLabelText(/priority/i), {
        target: { value: 'high' },
      })
      fireEvent.change(within(dialog).getByLabelText(/description/i), {
        target: { value: 'Traditional welcome troupe for baraat entry' },
      })

      // Submit
      fireEvent.click(within(dialog).getByRole('button', { name: /add task/i }))

      expect(onUpdate).toHaveBeenCalledTimes(1)
      const updatedPlan = onUpdate.mock.calls[0][0] as EventPlan
      const created = updatedPlan.timeline.find((t) => t.title === 'Book Shehnai & Dhol Troupe')

      expect(created).toBeDefined()
      expect(created?.dueDate).toBe('2026-10-15')
      expect(created?.priority).toBe('high')
      expect(created?.isUserAdded).toBe(true)
      expect(created?.completed).toBe(false)
      expect(created?.hasDateWarning).toBe(false)
    })

    it('validates task input and rejects empty titles or invalid calendar dates', () => {
      const plan = makeTestPlan()
      const onUpdate = vi.fn()

      render(<TimelineTab plan={plan} onToggleTask={vi.fn()} onUpdatePlan={onUpdate} />)

      fireEvent.click(screen.getByRole('button', { name: /\+ add task/i }))
      const dialog = screen.getByRole('dialog')

      // 1. Submit with empty title
      fireEvent.change(within(dialog).getByLabelText(/task title/i), { target: { value: '' } })
      fireEvent.click(within(dialog).getByRole('button', { name: /add task/i }))

      expect(within(dialog).getByText(/task title is required/i)).toBeInTheDocument()
      expect(onUpdate).not.toHaveBeenCalled()

      // 2. Submit with empty due date
      fireEvent.change(within(dialog).getByLabelText(/task title/i), { target: { value: 'Valid Title' } })
      fireEvent.change(within(dialog).getByLabelText(/due date/i), { target: { value: '' } })
      fireEvent.click(within(dialog).getByRole('button', { name: /add task/i }))

      expect(within(dialog).getByText(/due date is required/i)).toBeInTheDocument()
      expect(onUpdate).not.toHaveBeenCalled()
    })

    it('allows editing an existing task', () => {
      const plan = makeTestPlan()
      const onUpdate = vi.fn()

      render(<TimelineTab plan={plan} onToggleTask={vi.fn()} onUpdatePlan={onUpdate} />)

      const firstTask = plan.timeline[0]
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`edit task "${firstTask.title}"`, 'i') }))

      const dialog = screen.getByRole('dialog')
      expect(dialog).toBeInTheDocument()
      expect(within(dialog).getByText(/edit milestone task/i)).toBeInTheDocument()

      // Update title and priority
      fireEvent.change(within(dialog).getByLabelText(/task title/i), {
        target: { value: `${firstTask.title} [Updated]` },
      })
      fireEvent.change(within(dialog).getByLabelText(/priority/i), {
        target: { value: 'high' },
      })

      fireEvent.click(within(dialog).getByRole('button', { name: /save task changes/i }))

      expect(onUpdate).toHaveBeenCalledTimes(1)
      const updatedPlan = onUpdate.mock.calls[0][0] as EventPlan
      const edited = updatedPlan.timeline.find((t) => t.id === firstTask.id)
      expect(edited?.title).toBe(`${firstTask.title} [Updated]`)
      expect(edited?.priority).toBe('high')
    })

    it('completes and uncompletes tasks via checkbox toggle', () => {
      const plan = makeTestPlan()
      const onUpdate = vi.fn()

      render(<TimelineTab plan={plan} onToggleTask={vi.fn()} onUpdatePlan={onUpdate} />)

      const firstTask = plan.timeline[0]
      const checkbox = screen.getByLabelText(new RegExp(`mark "${firstTask.title}" as complete`, 'i'))
      expect(checkbox).not.toBeChecked()

      // Toggle to complete
      fireEvent.click(checkbox)

      expect(onUpdate).toHaveBeenCalledTimes(1)
      let updatedPlan = onUpdate.mock.calls[0][0] as EventPlan
      expect(updatedPlan.timeline.find((t) => t.id === firstTask.id)?.completed).toBe(true)

      // Re-render with completed task and toggle back to incomplete
      render(<TimelineTab plan={updatedPlan} onToggleTask={vi.fn()} onUpdatePlan={onUpdate} />)
      const uncompleteCheckbox = screen.getAllByLabelText(new RegExp(`mark "${firstTask.title}" as incomplete`, 'i'))[0]
      fireEvent.click(uncompleteCheckbox)

      expect(onUpdate).toHaveBeenCalledTimes(2)
      updatedPlan = onUpdate.mock.calls[1][0] as EventPlan
      expect(updatedPlan.timeline.find((t) => t.id === firstTask.id)?.completed).toBe(false)
    })

    it('prompts confirmation when deleting a task and deletes upon confirmation', () => {
      const plan = makeTestPlan()
      const onUpdate = vi.fn()

      render(<TimelineTab plan={plan} onToggleTask={vi.fn()} onUpdatePlan={onUpdate} />)

      const target = plan.timeline[0]
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`delete task "${target.title}"`, 'i') }))

      // Confirmation modal
      const dialog = screen.getByRole('dialog')
      expect(dialog).toBeInTheDocument()
      expect(within(dialog).getByText(/delete milestone task\?/i)).toBeInTheDocument()

      // Confirm deletion
      fireEvent.click(within(dialog).getByRole('button', { name: /delete task/i }))

      expect(onUpdate).toHaveBeenCalledTimes(1)
      const updatedPlan = onUpdate.mock.calls[0][0] as EventPlan
      expect(updatedPlan.timeline.some((t) => t.id === target.id)).toBe(false)
    })
  })

  // ── 2. Filters & Overdue Handling ─────────────────────────────
  describe('Filters & Overdue Accounting', () => {
    it('filters tasks by All, Pending, Completed, High Priority, and Overdue', () => {
      const pastDate = addCalendarDays(todayString(), -10) // 10 days ago
      const futureDate = addCalendarDays(todayString(), 20) // 20 days in future

      const customTasks: TimelineTask[] = [
        {
          id: 't-overdue',
          title: 'Past Incomplete Task',
          description: '',
          offsetDays: -10,
          dueDate: pastDate,
          priority: 'medium',
          completed: false,
          isUserAdded: true,
          hasDateWarning: false,
        },
        {
          id: 't-completed-past',
          title: 'Past Completed Task',
          description: '',
          offsetDays: -15,
          dueDate: addCalendarDays(todayString(), -15),
          priority: 'high',
          completed: true, // completed! Should NOT appear in Overdue filter!
          isUserAdded: true,
          hasDateWarning: false,
        },
        {
          id: 't-future-high',
          title: 'Future High Priority Task',
          description: '',
          offsetDays: 20,
          dueDate: futureDate,
          priority: 'high',
          completed: false,
          isUserAdded: true,
          hasDateWarning: false,
        },
      ]

      const plan = makeTestPlan({ timeline: customTasks })
      render(<TimelineTab plan={plan} onToggleTask={vi.fn()} onUpdatePlan={vi.fn()} />)

      // 1. All Tasks
      expect(screen.getByText('Past Incomplete Task')).toBeInTheDocument()
      expect(screen.getByText('Past Completed Task')).toBeInTheDocument()
      expect(screen.getByText('Future High Priority Task')).toBeInTheDocument()

      // 2. Pending Tasks Filter
      fireEvent.click(screen.getByRole('button', { name: /pending/i }))
      expect(screen.getByText('Past Incomplete Task')).toBeInTheDocument()
      expect(screen.getByText('Future High Priority Task')).toBeInTheDocument()
      expect(screen.queryByText('Past Completed Task')).not.toBeInTheDocument()

      // 3. Completed Tasks Filter
      fireEvent.click(screen.getByRole('button', { name: /^completed/i }))
      expect(screen.getByText('Past Completed Task')).toBeInTheDocument()
      expect(screen.queryByText('Past Incomplete Task')).not.toBeInTheDocument()
      expect(screen.queryByText('Future High Priority Task')).not.toBeInTheDocument()

      // 4. High Priority Filter
      fireEvent.click(screen.getByRole('button', { name: /high priority/i }))
      expect(screen.getByText('Past Completed Task')).toBeInTheDocument()
      expect(screen.getByText('Future High Priority Task')).toBeInTheDocument()
      expect(screen.queryByText('Past Incomplete Task')).not.toBeInTheDocument()

      // 5. Overdue Filter: Past incomplete task MUST appear, but completed past task MUST NOT appear!
      fireEvent.click(screen.getByRole('button', { name: /overdue/i }))
      expect(screen.getByText('Past Incomplete Task')).toBeInTheDocument()
      expect(screen.queryByText('Past Completed Task')).not.toBeInTheDocument()
      expect(screen.queryByText('Future High Priority Task')).not.toBeInTheDocument()
    })

    it('renders descriptive empty state when a filter has 0 matching tasks', () => {
      // Plan with no overdue tasks
      const futureDate = addCalendarDays(todayString(), 30)
      const plan = makeTestPlan({
        timeline: [
          {
            id: 't1',
            title: 'Future Task',
            description: '',
            offsetDays: 30,
            dueDate: futureDate,
            priority: 'medium',
            completed: false,
            isUserAdded: true,
            hasDateWarning: false,
          },
        ],
      })

      render(<TimelineTab plan={plan} onToggleTask={vi.fn()} onUpdatePlan={vi.fn()} />)

      // Click Overdue filter
      fireEvent.click(screen.getByRole('button', { name: /overdue/i }))

      expect(screen.getByText(/no overdue tasks!/i)).toBeInTheDocument()
      expect(screen.getByText(/you have zero overdue tasks/i)).toBeInTheDocument()
    })
  })

  // ── 3. Date Changes & Smart Recalculation ─────────────────────
  describe('Event Date Changes & Smart Recalculation', () => {
    it('recalculates system milestone due dates when event date moves while preserving user task dates', () => {
      const plan = makeTestPlan({
        date: '2026-12-15',
        timeline: [
          {
            id: 'sys-1',
            title: 'Final walk-through with venue',
            description: '',
            offsetDays: -14, // 14 days before event
            dueDate: '2026-12-01',
            priority: 'high',
            completed: false,
            isUserAdded: false,
            hasDateWarning: false,
          },
          {
            id: 'user-1',
            title: 'Personal Astrologer Consultation',
            description: '',
            offsetDays: 0,
            dueDate: '2026-11-01',
            priority: 'medium',
            completed: false,
            isUserAdded: true,
            hasDateWarning: false,
          },
        ],
      })
      const onUpdate = vi.fn()

      render(<TimelineTab plan={plan} onToggleTask={vi.fn()} onUpdatePlan={onUpdate} />)

      // Click Adjust Event Date
      fireEvent.click(screen.getByRole('button', { name: /adjust event date/i }))

      const dialog = screen.getByRole('dialog')
      expect(within(dialog).getByText(/adjust celebration date/i)).toBeInTheDocument()

      // Move event to 2027-01-20 (new event date)
      fireEvent.change(within(dialog).getByLabelText(/new event date/i), {
        target: { value: '2027-01-20' },
      })
      fireEvent.click(within(dialog).getByRole('button', { name: /update date & recalculate/i }))

      expect(onUpdate).toHaveBeenCalledTimes(1)
      const updatedPlan = onUpdate.mock.calls[0][0] as EventPlan
      expect(updatedPlan.date).toBe('2027-01-20')

      // System task due date MUST be recalculated to 2027-01-20 - 14 days = 2027-01-06
      const systemTask = updatedPlan.timeline.find((t) => t.id === 'sys-1')
      expect(systemTask?.dueDate).toBe('2027-01-06')

      // User task due date MUST be strictly preserved as 2026-11-01!
      const userTask = updatedPlan.timeline.find((t) => t.id === 'user-1')
      expect(userTask?.dueDate).toBe('2026-11-01')
      expect(userTask?.hasDateWarning).toBe(false)
    })

    it('sets date warning when event date moves before a user task due date', () => {
      const plan = makeTestPlan({
        date: '2026-12-15',
        timeline: [
          {
            id: 'user-late',
            title: 'Pre-wedding photoshoot',
            description: '',
            offsetDays: 0,
            dueDate: '2026-11-15',
            priority: 'medium',
            completed: false,
            isUserAdded: true,
            hasDateWarning: false,
          },
        ],
      })
      const onUpdate = vi.fn()

      render(<TimelineTab plan={plan} onToggleTask={vi.fn()} onUpdatePlan={onUpdate} />)

      fireEvent.click(screen.getByRole('button', { name: /adjust event date/i }))
      const dialog = screen.getByRole('dialog')

      // Move event date to 2026-10-01 (BEFORE the user task's 2026-11-15 date!)
      fireEvent.change(within(dialog).getByLabelText(/new event date/i), {
        target: { value: '2026-10-01' },
      })
      fireEvent.click(within(dialog).getByRole('button', { name: /update date & recalculate/i }))

      expect(onUpdate).toHaveBeenCalledTimes(1)
      const updatedPlan = onUpdate.mock.calls[0][0] as EventPlan
      const userTask = updatedPlan.timeline.find((t) => t.id === 'user-late')
      expect(userTask?.dueDate).toBe('2026-11-15') // Preserved!
      expect(userTask?.hasDateWarning).toBe(true) // Warning flagged!
    })

    it('handles leap year boundaries correctly during task date recalculation', () => {
      // Event on March 15, 2024 (2024 is a leap year)
      const plan = makeTestPlan({
        date: '2024-03-15',
        timeline: [
          {
            id: 'sys-leap',
            title: 'Day before setup',
            description: '',
            offsetDays: -15, // 15 days before March 15 in leap year 2024 -> Feb 29, 2024!
            dueDate: '2024-02-29',
            priority: 'high',
            completed: false,
            isUserAdded: false,
            hasDateWarning: false,
          },
        ],
      })
      const onUpdate = vi.fn()

      render(<TimelineTab plan={plan} onToggleTask={vi.fn()} onUpdatePlan={onUpdate} />)

      fireEvent.click(screen.getByRole('button', { name: /adjust event date/i }))
      const dialog = screen.getByRole('dialog')

      // Change event date to 2024-03-16 (+1 day)
      fireEvent.change(within(dialog).getByLabelText(/new event date/i), {
        target: { value: '2024-03-16' },
      })
      fireEvent.click(within(dialog).getByRole('button', { name: /update date & recalculate/i }))

      expect(onUpdate).toHaveBeenCalledTimes(1)
      const updatedPlan = onUpdate.mock.calls[0][0] as EventPlan
      // 2024-03-16 minus 15 days = March 1, 2024
      expect(updatedPlan.timeline[0].dueDate).toBe('2024-03-01')
    })
  })

  // ── 4. Task Generation Without Duplicates ─────────────────────
  describe('Task Generation & Duplicate Prevention', () => {
    it('adds missing default milestone tasks without duplicating existing tasks', () => {
      const plan = makeTestPlan()
      const initialCount = plan.timeline.length
      const onUpdate = vi.fn()

      render(<TimelineTab plan={plan} onToggleTask={vi.fn()} onUpdatePlan={onUpdate} />)

      // Click Add Default Milestones when all defaults already exist
      fireEvent.click(screen.getByRole('button', { name: /add default milestones/i }))

      // Should announce that all template milestones already exist and NOT duplicate
      expect(screen.getByText(/all recommended template milestones are already present/i)).toBeInTheDocument()
      expect(onUpdate).not.toHaveBeenCalled()

      // Now test with a plan having 1 task deleted
      const partialPlan = { ...plan, timeline: plan.timeline.slice(1) }
      render(<TimelineTab plan={partialPlan} onToggleTask={vi.fn()} onUpdatePlan={onUpdate} />)

      const addButtons = screen.getAllByRole('button', { name: /add default milestones/i })
      fireEvent.click(addButtons[addButtons.length - 1])

      expect(onUpdate).toHaveBeenCalledTimes(1)
      const updatedPlan = onUpdate.mock.calls[0][0] as EventPlan
      expect(updatedPlan.timeline.length).toBe(initialCount)
    })
  })

  // ── 5. Shared State, Overview Sync, and Persistence ───────────
  describe('Shared State & Overview Synchronization', () => {
    it('immediately reflects task completion in the Overview tab progress bar and persists across reloads', async () => {
      const demoPlan = createDemoPlan()
      saveEventPlan(demoPlan)

      render(<App />)

      // Open workspace
      fireEvent.click(screen.getByRole('button', { name: /open workspace/i }))

      // Initially on Overview tab
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /overview/i })).toHaveAttribute('aria-selected', 'true')
      })

      // Get initial task progress percentage text
      const initialProgressCard = screen.getByText(/tasks completed/i).closest('.stat-card')
      expect(initialProgressCard).toBeInTheDocument()

      // Switch to Timeline tab
      fireEvent.click(screen.getByRole('tab', { name: /timeline/i }))
      expect(screen.getByRole('tab', { name: /timeline/i })).toHaveAttribute('aria-selected', 'true')

      // Complete the first uncompleted task
      const firstTask = demoPlan.timeline.find((t) => !t.completed)!
      const checkbox = screen.getByLabelText(new RegExp(`mark "${firstTask.title}" as complete`, 'i'))
      fireEvent.click(checkbox)

      // Switch back to Overview tab
      fireEvent.click(screen.getByRole('tab', { name: /overview/i }))

      // Verify that completed count incremented in Overview tab
      const expectedCompletedCount = demoPlan.timeline.filter((t) => t.completed).length + 1
      expect(
        screen.getByText(new RegExp(`${expectedCompletedCount} of ${demoPlan.timeline.length} tasks completed`, 'i'))
      ).toBeInTheDocument()
    })
  })

  // ── 6. Accessibility ──────────────────────────────────────────
  describe('Accessibility & Keyboard Interactions', () => {
    it('closes the task modal when Escape is pressed', () => {
      const plan = makeTestPlan()
      render(<TimelineTab plan={plan} onToggleTask={vi.fn()} onUpdatePlan={vi.fn()} />)

      fireEvent.click(screen.getByRole('button', { name: /\+ add task/i }))
      expect(screen.getByRole('dialog')).toBeInTheDocument()

      fireEvent.keyDown(window, { key: 'Escape' })
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})
