import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from '../App'
import { LandingPage } from '../components/LandingPage'
import { EventWizard } from '../components/EventWizard'
import { Workspace } from '../components/Workspace'
import { createDemoPlan } from '../lib/demoData'
import { clearEventPlan } from '../lib/storage'
import { createNewEventPlan } from '../lib/planFactory'

describe('UtsavFlow AI — UI & Workflow Test Suite', () => {
  beforeEach(() => {
    clearEventPlan()
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    clearEventPlan()
  })

  // ── 1. Landing Page ──────────────────────────────────────────
  describe('Landing Page', () => {
    it('renders hero title, feature pillars, and primary functional action buttons', () => {
      const onCreate = vi.fn()
      const onDemo = vi.fn()
      const onWorkspace = vi.fn()

      render(
        <LandingPage
          existingPlan={null}
          onCreateEvent={onCreate}
          onExploreDemo={onDemo}
          onOpenWorkspace={onWorkspace}
        />
      )

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/plan indian celebrations/i)
      expect(screen.getByRole('button', { name: /create my event/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /explore demo plan/i })).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /create my event/i }))
      expect(onCreate).toHaveBeenCalledTimes(1)

      fireEvent.click(screen.getByRole('button', { name: /explore demo plan/i }))
      expect(onDemo).toHaveBeenCalledTimes(1)
    })

    it('shows active plan banner when plan exists in storage', () => {
      const demoPlan = createDemoPlan()
      render(
        <LandingPage
          existingPlan={demoPlan}
          onCreateEvent={vi.fn()}
          onExploreDemo={vi.fn()}
          onOpenWorkspace={vi.fn()}
        />
      )

      expect(screen.getByLabelText(/active plan notification/i)).toBeInTheDocument()
      expect(screen.getByText(/priya & arjun's wedding/i)).toBeInTheDocument()
    })

    it('prompts confirmation when exploring demo if a custom plan exists', () => {
      const customPlan = createNewEventPlan({
        type: 'wedding',
        name: 'My Special Wedding',
        date: '2026-12-25',
        city: 'Jaipur',
        guestCount: 200,
        budgetTotal: 1000000,
        theme: '',
        dietaryRequirements: '',
        accessibilityNeeds: '',
      })
      const onDemo = vi.fn()

      render(
        <LandingPage
          existingPlan={customPlan}
          onCreateEvent={vi.fn()}
          onExploreDemo={onDemo}
          onOpenWorkspace={vi.fn()}
        />
      )

      // Click explore demo
      fireEvent.click(screen.getByRole('button', { name: /explore demo plan/i }))

      // Confirmation modal should appear
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText(/load sample demo plan\?/i)).toBeInTheDocument()

      // Cancel keeps the plan
      fireEvent.click(screen.getByRole('button', { name: /keep my event/i }))
      expect(onDemo).not.toHaveBeenCalled()

      // Click again and confirm
      fireEvent.click(screen.getByRole('button', { name: /explore demo plan/i }))
      fireEvent.click(screen.getByRole('button', { name: /load demo plan/i }))
      expect(onDemo).toHaveBeenCalledTimes(1)
    })
  })

  // ── 2. Five-Step Event Wizard ────────────────────────────────
  describe('Event Creation Wizard', () => {
    it('progresses through steps with validation, preserves inputs, and creates valid EventPlan', () => {
      const onComplete = vi.fn()
      const onCancel = vi.fn()

      render(<EventWizard onComplete={onComplete} onCancel={onCancel} />)

      // Step 1: Event Type
      expect(screen.getByText(/step 1: choose your celebration type/i)).toBeInTheDocument()
      fireEvent.click(screen.getByRole('radio', { name: /birthday/i }))
      fireEvent.click(screen.getByRole('button', { name: /continue/i }))

      // Step 2: Details & Validation
      expect(screen.getByText(/step 2: celebration details/i)).toBeInTheDocument()

      // Clicking continue with empty fields triggers inline errors
      fireEvent.click(screen.getByRole('button', { name: /continue/i }))
      expect(screen.getByText(/please provide an event name/i)).toBeInTheDocument()
      expect(screen.getByText(/please select an event date/i)).toBeInTheDocument()

      // Fill in fields
      fireEvent.change(screen.getByLabelText(/event name/i), { target: { value: "Rohan's 30th Birthday" } })
      fireEvent.change(screen.getByLabelText(/event date/i), { target: { value: '2027-05-10' } })
      fireEvent.change(screen.getByLabelText(/city \/ venue location/i), { target: { value: 'Bengaluru' } })
      fireEvent.change(screen.getByLabelText(/approximate guest count/i), { target: { value: '75' } })
      fireEvent.change(screen.getByLabelText(/total budget/i), { target: { value: '350000' } })

      fireEvent.click(screen.getByRole('button', { name: /continue/i }))

      // Step 3: Theme Vision
      expect(screen.getByText(/step 3: theme & style vision/i)).toBeInTheDocument()
      // Click a suggestion chip
      const chip = screen.getByRole('button', { name: /tropical carnival & gold/i })
      fireEvent.click(chip)
      expect(screen.getByLabelText(/theme description/i)).toHaveValue('Tropical Carnival & Gold')

      fireEvent.click(screen.getByRole('button', { name: /continue/i }))

      // Step 4: Hospitality & Dietary
      expect(screen.getByText(/step 4: hospitality & guest care/i)).toBeInTheDocument()
      fireEvent.change(screen.getByLabelText(/dietary preferences/i), {
        target: { value: 'Vegetarian and Jain options' },
      })
      fireEvent.change(screen.getByLabelText(/accessibility/i), {
        target: { value: 'Ground floor venue' },
      })

      // Test Previous button preserves values
      fireEvent.click(screen.getByRole('button', { name: /previous/i }))
      expect(screen.getByText(/step 3: theme & style vision/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/theme description/i)).toHaveValue('Tropical Carnival & Gold')

      // Advance to step 5
      fireEvent.click(screen.getByRole('button', { name: /continue/i }))
      fireEvent.click(screen.getByRole('button', { name: /continue/i }))

      // Step 5: Review
      expect(screen.getByText(/step 5: review & create your event plan/i)).toBeInTheDocument()
      expect(screen.getByText("Rohan's 30th Birthday")).toBeInTheDocument()
      expect(screen.getByText(/bengaluru/i)).toBeInTheDocument()

      // Submit
      fireEvent.click(screen.getByRole('button', { name: /create event plan/i }))

      expect(onComplete).toHaveBeenCalledTimes(1)
      const createdPlan = onComplete.mock.calls[0][0]
      expect(createdPlan.name).toBe("Rohan's 30th Birthday")
      expect(createdPlan.type).toBe('birthday')
      expect(createdPlan.city).toBe('Bengaluru')
      expect(createdPlan.budgetTotal).toBe(350000)
      expect(createdPlan.timeline.length).toBeGreaterThan(0)
      expect(createdPlan.budget.categories.length).toBeGreaterThan(0)
    })

    it('warns when a past event date is entered without altering input', () => {
      render(<EventWizard onComplete={vi.fn()} onCancel={vi.fn()} />)
      fireEvent.click(screen.getByRole('button', { name: /continue/i }))

      // Step 2
      const dateInput = screen.getByLabelText(/event date/i)
      fireEvent.change(dateInput, { target: { value: '2020-01-01' } })

      expect(screen.getByRole('alert')).toHaveTextContent(/past date note/i)
      expect(dateInput).toHaveValue('2020-01-01')
    })
  })

  // ── 3. Planner Workspace Shell & Tabs ────────────────────────
  describe('Planner Workspace Shell', () => {
    it('renders event details, metrics, and allows navigation between all 5 tabs', () => {
      const demoPlan = createDemoPlan()
      const onToggle = vi.fn()
      const onReset = vi.fn()
      const onHome = vi.fn()

      render(
        <Workspace
          plan={demoPlan}
          isDemo={true}
          onToggleTask={onToggle}
          onResetPlan={onReset}
          onReturnHome={onHome}
          onCreateNewEvent={vi.fn()}
        />
      )

      // Check header and demo banner
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(demoPlan.name)
      expect(screen.getByLabelText(/demo mode notice/i)).toBeInTheDocument()

      // Default tab is Overview
      expect(screen.getByRole('tab', { name: /overview/i })).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByText(/celebration profile/i)).toBeInTheDocument()
      expect(screen.getByText(/budget allocation health/i)).toBeInTheDocument()

      // Navigate to Budget tab
      fireEvent.click(screen.getByRole('tab', { name: /budget/i }))
      expect(screen.getByRole('tab', { name: /budget/i })).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByRole('tab', { name: /overview/i })).toHaveAttribute('aria-selected', 'false')
      expect(screen.getByText(/category envelopes & expenses/i)).toBeInTheDocument()

      // Navigate to Timeline tab
      fireEvent.click(screen.getByRole('tab', { name: /timeline/i }))
      expect(screen.getByRole('tab', { name: /timeline/i })).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByText(/master countdown schedule/i)).toBeInTheDocument()

      // Navigate to Vendors tab
      fireEvent.click(screen.getByRole('tab', { name: /vendors/i }))
      expect(screen.getByRole('tab', { name: /vendors/i })).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByText(/vendor directory/i)).toBeInTheDocument()

      // Navigate to AI Ideas tab
      fireEvent.click(screen.getByRole('tab', { name: /ai ideas/i }))
      expect(screen.getByRole('tab', { name: /ai ideas/i })).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByRole('heading', { name: /ai celebration ideas assistant/i })).toBeInTheDocument()
      expect(screen.getAllByText(/upcoming backend integration/i).length).toBeGreaterThan(0)
    })

    it('supports keyboard navigation across tabs via ArrowRight and ArrowLeft', () => {
      const demoPlan = createDemoPlan()

      render(
        <Workspace
          plan={demoPlan}
          isDemo={false}
          onToggleTask={vi.fn()}
          onResetPlan={vi.fn()}
          onReturnHome={vi.fn()}
          onCreateNewEvent={vi.fn()}
        />
      )

      const overviewTab = screen.getByRole('tab', { name: /overview/i })
      overviewTab.focus()

      fireEvent.keyDown(overviewTab, { key: 'ArrowRight' })
      expect(screen.getByRole('tab', { name: /budget/i })).toHaveAttribute('aria-selected', 'true')

      const budgetTab = screen.getByRole('tab', { name: /budget/i })
      fireEvent.keyDown(budgetTab, { key: 'ArrowLeft' })
      expect(screen.getByRole('tab', { name: /overview/i })).toHaveAttribute('aria-selected', 'true')
    })

    it('toggles task completion when checkbox is clicked', () => {
      const demoPlan = createDemoPlan()
      const onToggle = vi.fn()

      render(
        <Workspace
          plan={demoPlan}
          isDemo={true}
          onToggleTask={onToggle}
          onResetPlan={vi.fn()}
          onReturnHome={vi.fn()}
          onCreateNewEvent={vi.fn()}
        />
      )

      // Go to timeline tab
      fireEvent.click(screen.getByRole('tab', { name: /timeline/i }))
      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes.length).toBeGreaterThan(0)

      fireEvent.click(checkboxes[0])
      expect(onToggle).toHaveBeenCalledTimes(1)
    })

    it('prompts confirmation when reset button is clicked', () => {
      const demoPlan = createDemoPlan()
      const onReset = vi.fn()

      render(
        <Workspace
          plan={demoPlan}
          isDemo={false}
          onToggleTask={vi.fn()}
          onResetPlan={onReset}
          onReturnHome={vi.fn()}
          onCreateNewEvent={vi.fn()}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /reset/i }))
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText(/reset celebration plan\?/i)).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /yes, reset plan/i }))
      expect(onReset).toHaveBeenCalledTimes(1)
    })
  })

  // ── 4. End-to-End App Flow ──────────────────────────────────
  describe('Full App Integration Flow', () => {
    it('allows exploring demo plan, viewing workspace, and returning home', async () => {
      render(<App />)

      // Initially on Landing Page
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/plan indian celebrations/i)

      // Click Explore demo plan
      fireEvent.click(screen.getByRole('button', { name: /explore demo plan/i }))

      // Workspace should render with demo plan
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/priya & arjun/i)
      })
      expect(screen.getByLabelText(/demo mode notice/i)).toBeInTheDocument()

      // Click Home button to return to Landing Page
      fireEvent.click(screen.getByRole('button', { name: /home/i }))
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/plan indian celebrations/i)
      expect(screen.getByText(/active plan detected/i)).toBeInTheDocument()
    })

    it('persists newly created plan to storage and renders in workspace', async () => {
      render(<App />)

      // Click Create my event
      fireEvent.click(screen.getByRole('button', { name: /create my event/i }))

      // Step 1
      fireEvent.click(screen.getByRole('button', { name: /continue/i }))

      // Step 2
      fireEvent.change(screen.getByLabelText(/event name/i), { target: { value: 'Diwali Society Utsav' } })
      fireEvent.change(screen.getByLabelText(/event date/i), { target: { value: '2026-11-01' } })
      fireEvent.change(screen.getByLabelText(/city/i), { target: { value: 'Pune' } })
      fireEvent.change(screen.getByLabelText(/guest count/i), { target: { value: '300' } })
      fireEvent.change(screen.getByLabelText(/total budget/i), { target: { value: '150000' } })
      fireEvent.click(screen.getByRole('button', { name: /continue/i }))

      // Step 3
      fireEvent.click(screen.getByRole('button', { name: /continue/i }))

      // Step 4
      fireEvent.click(screen.getByRole('button', { name: /continue/i }))

      // Step 5: Review & Submit
      fireEvent.click(screen.getByRole('button', { name: /create event plan/i }))

      // Workspace should load
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Diwali Society Utsav')
      })
      expect(screen.getAllByText(/pune/i).length).toBeGreaterThan(0)
      expect(screen.getByText(/300 attendees/i)).toBeInTheDocument()
    })
  })
})
