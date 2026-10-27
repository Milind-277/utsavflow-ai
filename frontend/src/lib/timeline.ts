// ═══════════════════════════════════════════════════════════
// lib/timeline.ts — Task generation and timeline management
// ═══════════════════════════════════════════════════════════

import { nanoid } from 'nanoid'
import { addCalendarDays, daysUntilEvent, isPast } from './dateOnly'
import type { EventType, TimelineTask, TaskPriority } from '@/types'

interface TaskTemplate {
  title: string
  description: string
  offsetDays: number   // days before event (negative)
  priority: TaskPriority
  forTypes: EventType[] | 'all'
}

const TASK_TEMPLATES: TaskTemplate[] = [
  // ── Universal (all event types) ─────────────────────────
  {
    title: 'Confirm event date and venue',
    description: 'Lock in the primary venue; get written confirmation.',
    offsetDays: -180, priority: 'high', forTypes: 'all',
  },
  {
    title: 'Set overall budget',
    description: 'Agree on total budget and allocation per category.',
    offsetDays: -170, priority: 'high', forTypes: 'all',
  },
  {
    title: 'Create guest list (first draft)',
    description: 'Enumerate all confirmed and likely attendees.',
    offsetDays: -150, priority: 'high', forTypes: 'all',
  },
  {
    title: 'Book catering / food service',
    description: 'Request quotes; confirm menu and dietary requirements.',
    offsetDays: -120, priority: 'high', forTypes: 'all',
  },
  {
    title: 'Book photographer / videographer',
    description: 'Review portfolios; sign contract and pay deposit.',
    offsetDays: -120, priority: 'high', forTypes: 'all',
  },
  {
    title: 'Send save-the-date notifications',
    description: 'Digital or physical, depending on formality.',
    offsetDays: -120, priority: 'medium', forTypes: 'all',
  },
  {
    title: 'Confirm decorations and floral',
    description: 'Decide on theme colours, table arrangements, and centrepieces.',
    offsetDays: -90, priority: 'medium', forTypes: 'all',
  },
  {
    title: 'Book entertainment / DJ / music',
    description: 'Share playlist preferences and event schedule.',
    offsetDays: -90, priority: 'medium', forTypes: 'all',
  },
  {
    title: 'Send formal invitations',
    description: 'Include venue address, RSVP deadline, and dietary form.',
    offsetDays: -60, priority: 'high', forTypes: 'all',
  },
  {
    title: 'Confirm final guest count with caterer',
    description: 'Update headcount based on RSVPs received.',
    offsetDays: -30, priority: 'high', forTypes: 'all',
  },
  {
    title: 'Final walk-through with venue',
    description: 'Confirm layout, AV setup, accessibility arrangements.',
    offsetDays: -14, priority: 'high', forTypes: 'all',
  },
  {
    title: 'Prepare vendor payment schedule',
    description: 'List all outstanding balances and payment deadlines.',
    offsetDays: -14, priority: 'medium', forTypes: 'all',
  },
  {
    title: 'Day-before setup and dry run',
    description: 'Arrange furniture, test AV, brief event coordinators.',
    offsetDays: -1, priority: 'high', forTypes: 'all',
  },
  {
    title: 'Final vendor payments',
    description: 'Settle all outstanding balances; collect receipts.',
    offsetDays: 1, priority: 'medium', forTypes: 'all',
  },
  {
    title: 'Send thank-you notes',
    description: 'Thank guests and vendors within a week of the event.',
    offsetDays: 7, priority: 'low', forTypes: 'all',
  },

  // ── Wedding-specific ─────────────────────────────────────
  {
    title: 'Book priest / officiant',
    description: 'Confirm ceremony style and any religious requirements.',
    offsetDays: -180, priority: 'high', forTypes: ['wedding'],
  },
  {
    title: 'Book bridal / groom attire and tailoring',
    description: 'Allow time for multiple fittings and alterations.',
    offsetDays: -150, priority: 'high', forTypes: ['wedding'],
  },
  {
    title: 'Book makeup and hair artists',
    description: 'Include trial session well before the event.',
    offsetDays: -120, priority: 'medium', forTypes: ['wedding'],
  },
  {
    title: 'Plan mehendi / sangeet ceremony',
    description: 'Book venue, artist, and music for pre-wedding events.',
    offsetDays: -90, priority: 'medium', forTypes: ['wedding'],
  },
  {
    title: 'Book honeymoon / post-wedding travel',
    description: 'Book flights, hotels, and travel insurance.',
    offsetDays: -90, priority: 'low', forTypes: ['wedding'],
  },
  {
    title: 'Final bridal fittings',
    description: 'Last round of alterations; confirm full look.',
    offsetDays: -14, priority: 'high', forTypes: ['wedding'],
  },

  // ── Birthday-specific ────────────────────────────────────
  {
    title: 'Book birthday cake',
    description: 'Confirm design, flavour, dietary requirements, and delivery.',
    offsetDays: -30, priority: 'high', forTypes: ['birthday'],
  },
  {
    title: 'Organise games and activities',
    description: 'Plan age-appropriate games; confirm equipment rental.',
    offsetDays: -21, priority: 'medium', forTypes: ['birthday'],
  },
  {
    title: 'Prepare party favours / return gifts',
    description: 'Source, pack, and label favour bags.',
    offsetDays: -14, priority: 'low', forTypes: ['birthday'],
  },

  // ── Community event-specific ─────────────────────────────
  {
    title: 'Obtain event permits and licences',
    description: 'Municipal, noise, and food-serving permits as applicable.',
    offsetDays: -120, priority: 'high', forTypes: ['community'],
  },
  {
    title: 'Recruit and brief volunteers',
    description: 'Assign roles: registration, logistics, AV, first aid.',
    offsetDays: -60, priority: 'high', forTypes: ['community'],
  },
  {
    title: 'Set up online registration / ticketing',
    description: 'Configure form, payment gateway, and confirmation emails.',
    offsetDays: -60, priority: 'medium', forTypes: ['community'],
  },
  {
    title: 'Arrange public liability insurance',
    description: 'Confirm coverage for the event date and guest count.',
    offsetDays: -45, priority: 'high', forTypes: ['community'],
  },
  {
    title: 'Brief all speakers and performers',
    description: 'Share schedule, stage cues, and AV requirements.',
    offsetDays: -7, priority: 'medium', forTypes: ['community'],
  },
]

// ── Generation ─────────────────────────────────────────────

/**
 * Generate the default task list for a given event type and date.
 * Returns tasks sorted by dueDate ascending.
 */
export function generateDefaultTasks(
  eventType: EventType,
  eventDateIso: string,
): TimelineTask[] {
  const applicable = TASK_TEMPLATES.filter(
    (t) => t.forTypes === 'all' || t.forTypes.includes(eventType),
  )

  return applicable
    .map((t): TimelineTask => ({
      id: nanoid(10),
      title: t.title,
      description: t.description,
      offsetDays: t.offsetDays,
      dueDate: addCalendarDays(eventDateIso, t.offsetDays),
      priority: t.priority,
      completed: false,
      isUserAdded: false,
      hasDateWarning: false,
    }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

// ── Event-date change ──────────────────────────────────────

/**
 * Recalculate due dates when the event date changes.
 * - System tasks: dueDate = newEventDate + offsetDays (always recalculated)
 * - User-added tasks: dueDate preserved; hasDateWarning set if dueDate > newEventDate
 */
export function recalculateTaskDates(
  tasks: TimelineTask[],
  newEventDateIso: string,
  _today: Date = new Date(),
): TimelineTask[] {
  return tasks.map((task): TimelineTask => {
    if (!task.isUserAdded) {
      // System task: recalculate from offsetDays
      return {
        ...task,
        dueDate: addCalendarDays(newEventDateIso, task.offsetDays),
        hasDateWarning: false,
      }
    }
    // User-added task: preserve date, but warn if it's after the event
    const hasDateWarning = task.dueDate > newEventDateIso
    return { ...task, hasDateWarning }
  }).filter(Boolean)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

// ── Task filters ───────────────────────────────────────────

export function isOverdue(task: TimelineTask, today: Date = new Date()): boolean {
  if (task.completed) return false
  return isPast(task.dueDate, today)
}

export function isUpcoming(task: TimelineTask, daysAhead = 14, today: Date = new Date()): boolean {
  if (task.completed) return false
  const days = daysUntilEvent(task.dueDate, today)
  return days >= 0 && days <= daysAhead
}

// ── Progress ───────────────────────────────────────────────

export function taskCompletionPct(tasks: TimelineTask[]): number {
  if (tasks.length === 0) return 0
  const done = tasks.filter((t) => t.completed).length
  return Math.round((done / tasks.length) * 100)
}

// ── New user-added task factory ────────────────────────────

export function createUserTask(
  title: string,
  dueDate: string,
  priority: TaskPriority,
  description = '',
  eventDateIso: string,
): TimelineTask {
  return {
    id: nanoid(10),
    title: title.trim(),
    description: description.trim(),
    offsetDays: 0,        // not meaningful for user-added tasks
    dueDate,
    priority,
    completed: false,
    isUserAdded: true,
    hasDateWarning: dueDate > eventDateIso,
  }
}

// ── Format helpers ─────────────────────────────────────────

export function formatTaskDueLabel(task: TimelineTask, today: Date = new Date()): string {
  const days = daysUntilEvent(task.dueDate, today)
  if (task.completed) return 'Completed'
  if (days < 0)  return `${Math.abs(days)} days overdue`
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  if (days <= 7)  return `Due in ${days} days`
  // Format as readable date
  const d = new Date(task.dueDate.split('-').map(Number).reduce((_, v, i) =>
    i === 0 ? v : i === 1 ? new Date(_, v - 1, 1).getMonth() : v, 0))
  void d
  return `Due ${new Date(
    Number(task.dueDate.split('-')[0]),
    Number(task.dueDate.split('-')[1]) - 1,
    Number(task.dueDate.split('-')[2]),
  ).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
}
