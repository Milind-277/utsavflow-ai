import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import App from '../App'
import { BudgetTab } from '../components/BudgetTab'
import { createDemoPlan } from '../lib/demoData'
import { clearEventPlan, saveEventPlan } from '../lib/storage'
import { createNewEventPlan } from '../lib/planFactory'
import type { EventPlan, BudgetSection } from '../types'
import { formatINR } from '../lib/currency'

describe('M5 — Budget Guard Functional Test Suite', () => {
  beforeEach(() => {
    clearEventPlan()
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    clearEventPlan()
  })

  // Helper to create a clean test plan
  const makeTestPlan = (overrides: Partial<EventPlan> = {}): EventPlan => {
    const base = createNewEventPlan({
      type: 'wedding',
      name: 'Simran & Raj Wedding',
      date: '2026-11-20',
      city: 'Delhi',
      guestCount: 200,
      budgetTotal: 10_00_000, // ₹10 Lakh
      theme: 'Royal Heritage',
      dietaryRequirements: 'Vegetarian',
      accessibilityNeeds: 'Wheelchair access',
    })
    return { ...base, ...overrides }
  }

  // ── 1. Budget Overview & 8 Metrics ───────────────────────────
  describe('Budget Overview Display', () => {
    it('renders all 8 budget metrics calculated from actual EventPlan data', () => {
      const plan = makeTestPlan()
      render(<BudgetTab plan={plan} onUpdatePlan={vi.fn()} />)

      // 1. Total Budget
      const totalCard = screen.getByTestId('metric-total-budget')
      expect(totalCard).toHaveTextContent(formatINR(10_00_000))

      // 2. Allocated
      const allocatedCard = screen.getByTestId('metric-allocated')
      expect(allocatedCard).toHaveTextContent(formatINR(0))

      // 3. Estimated
      const estimatedCard = screen.getByTestId('metric-estimated')
      expect(estimatedCard).toHaveTextContent(formatINR(0))

      // 4. Actual
      const actualCard = screen.getByTestId('metric-actual')
      expect(actualCard).toHaveTextContent(formatINR(0))

      // 5. Contingency Reserve (10% of 10L = 1L)
      const contingencyCard = screen.getByTestId('metric-contingency')
      expect(contingencyCard).toHaveTextContent(formatINR(1_00_000))

      // 6. Unallocated Funds (10L - 0 - 1L = 9L)
      const unallocatedCard = screen.getByTestId('metric-unallocated')
      expect(unallocatedCard).toHaveTextContent(formatINR(9_00_000))

      // 7. Allocation Overage (0)
      const overageCard = screen.getByTestId('metric-overage')
      expect(overageCard).toHaveTextContent(formatINR(0))

      // 8. Remaining Budget (10L - 0 - 1L = 9L)
      const remainingCard = screen.getByTestId('metric-remaining')
      expect(remainingCard).toHaveTextContent(formatINR(9_00_000))

      // Status banner should be healthy
      expect(screen.getByRole('status')).toHaveTextContent(/budget guard healthy/i)
    })
  })

  // ── 2. Accounting Guard: Over-allocation vs Over-spending ────
  describe('Accounting Correctness & Guard Deficits', () => {
    it('shows over-allocation warning and calculates allocation overage when allocations exceed ceiling', () => {
      const plan = makeTestPlan()
      // Over-allocate: budget ceiling 10L, contingency 1L (10%).
      // Allocate 9.5L across items -> Total allocated (9.5L) + Reserve (1L) = 10.5L > 10L.
      // Overage should be 50,000. Unallocated funds should be 0.
      const overAllocatedBudget: BudgetSection = {
        ...plan.budget,
        contingencyPct: 10,
        categories: [
          {
            id: 'cat-test',
            name: 'Grand Venue',
            items: [
              {
                id: 'item-1',
                label: 'Hall Rental',
                allocated: 9_50_000,
                estimated: 9_00_000,
                actual: 5_00_000,
                note: '',
              },
            ],
          },
        ],
      }
      const overPlan = { ...plan, budget: overAllocatedBudget }

      render(<BudgetTab plan={overPlan} onUpdatePlan={vi.fn()} />)

      // Check metrics
      expect(screen.getByTestId('metric-overage')).toHaveTextContent(formatINR(50_000))
      expect(screen.getByTestId('metric-unallocated')).toHaveTextContent(formatINR(0))

      // Over-allocation warning banner
      expect(screen.getByRole('alert')).toHaveTextContent(/over-allocation warning/i)
      expect(screen.getByRole('alert')).toHaveTextContent(formatINR(50_000))
    })

    it('shows negative remaining budget and deficit warning without clamping to zero when overspent', () => {
      const plan = makeTestPlan()
      // Total budget = 10L, reserve = 1L. Available spending = 9L.
      // Actual spent = 11L.
      // Remaining budget = 10L - 11L - 1L = -2L (-₹2,00,000).
      const overspentBudget: BudgetSection = {
        ...plan.budget,
        contingencyPct: 10,
        categories: [
          {
            id: 'cat-test',
            name: 'Catering',
            items: [
              {
                id: 'item-1',
                label: 'Royal Buffet',
                allocated: 8_00_000,
                estimated: 8_50_000,
                actual: 11_00_000,
                note: '',
              },
            ],
          },
        ],
      }
      const overspentPlan = { ...plan, budget: overspentBudget }

      render(<BudgetTab plan={overspentPlan} onUpdatePlan={vi.fn()} />)

      // Remaining budget must be negative and NOT clamped to zero
      const remainingCard = screen.getByTestId('metric-remaining')
      expect(remainingCard).toHaveTextContent(formatINR(-2_00_000))

      // Overspending alert banner
      expect(screen.getByRole('alert')).toHaveTextContent(/overspending deficit warning/i)
    })
  })

  // ── 3. Contingency Reserve Adjustment ─────────────────────────
  describe('Contingency Reserve Adjustment', () => {
    it('allows adjusting contingency percentage and recalculates reserve immediately', () => {
      const plan = makeTestPlan()
      const onUpdate = vi.fn()

      render(<BudgetTab plan={plan} onUpdatePlan={onUpdate} />)

      const pctInput = screen.getByLabelText(/contingency percentage/i)
      expect(pctInput).toHaveValue(10)

      // Change contingency to 15%
      fireEvent.change(pctInput, { target: { value: '15' } })

      expect(onUpdate).toHaveBeenCalledTimes(1)
      const updatedPlan = onUpdate.mock.calls[0][0] as EventPlan
      expect(updatedPlan.budget.contingencyPct).toBe(15)
    })
  })

  // ── 4. Expense Management: Add, Edit, Delete ─────────────────
  describe('Expense Item CRUD Operations', () => {
    it('allows adding a new expense item and updates allocations and unallocated funds', () => {
      const plan = makeTestPlan()
      const onUpdate = vi.fn()

      render(<BudgetTab plan={plan} onUpdatePlan={onUpdate} />)

      // Find the first category's "+ Add Expense" button
      const addButtons = screen.getAllByRole('button', { name: /\+ add expense/i })
      fireEvent.click(addButtons[0])

      // Modal opens
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText(/add new expense item/i)).toBeInTheDocument()

      // Fill in fields
      fireEvent.change(screen.getByLabelText(/expense label/i), { target: { value: 'Floral Mandap Decor' } })
      fireEvent.change(screen.getByLabelText(/planned allocation/i), { target: { value: '75000' } })
      fireEvent.change(screen.getByLabelText(/estimated cost/i), { target: { value: '70000' } })
      fireEvent.change(screen.getByLabelText(/actual spending/i), { target: { value: '25000' } })
      fireEvent.change(screen.getByLabelText(/notes/i), { target: { value: 'Advance paid for marigold strings' } })

      // Save
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /add expense/i }))

      expect(onUpdate).toHaveBeenCalledTimes(1)
      const updatedPlan = onUpdate.mock.calls[0][0] as EventPlan
      const firstCat = updatedPlan.budget.categories[0]
      const addedItem = firstCat.items.find((i) => i.label === 'Floral Mandap Decor')
      expect(addedItem).toBeDefined()
      expect(addedItem?.allocated).toBe(75000)
      expect(addedItem?.estimated).toBe(70000)
      expect(addedItem?.actual).toBe(25000)
      expect(addedItem?.note).toBe('Advance paid for marigold strings')
    })

    it('allows editing an existing expense item and rejects invalid inputs', () => {
      const plan = makeTestPlan({
        budget: {
          contingencyPct: 10,
          categories: [
            {
              id: 'cat-photo',
              name: 'Photography',
              items: [
                {
                  id: 'item-photo-1',
                  label: 'Traditional Photographer',
                  allocated: 80000,
                  estimated: 75000,
                  actual: 20000,
                  note: 'Deposit cleared',
                },
              ],
            },
          ],
        },
      })
      const onUpdate = vi.fn()

      render(<BudgetTab plan={plan} onUpdatePlan={onUpdate} />)

      // Click Edit on the item
      fireEvent.click(screen.getByRole('button', { name: /edit expense traditional photographer/i }))

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Traditional Photographer')).toBeInTheDocument()
      expect(screen.getByDisplayValue('80000')).toBeInTheDocument()

      // Test validation: clear label and submit
      fireEvent.change(screen.getByLabelText(/expense label/i), { target: { value: '' } })
      fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
      expect(screen.getByText(/expense label is required/i)).toBeInTheDocument()
      expect(onUpdate).not.toHaveBeenCalled()

      // Test validation: negative amount
      fireEvent.change(screen.getByLabelText(/expense label/i), { target: { value: 'Candid Wedding Photography' } })
      fireEvent.change(screen.getByLabelText(/planned allocation/i), { target: { value: '-500' } })
      fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
      expect(screen.getByText(/must be a whole non-negative integer/i)).toBeInTheDocument()
      expect(onUpdate).not.toHaveBeenCalled()

      // Correct values
      fireEvent.change(screen.getByLabelText(/planned allocation/i), { target: { value: '95000' } })
      fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

      expect(onUpdate).toHaveBeenCalledTimes(1)
      const updatedPlan = onUpdate.mock.calls[0][0] as EventPlan
      const item = updatedPlan.budget.categories[0].items[0]
      expect(item.label).toBe('Candid Wedding Photography')
      expect(item.allocated).toBe(95000)
    })

    it('prompts confirmation when deleting an expense item and deletes on confirmation', () => {
      const plan = makeTestPlan({
        budget: {
          contingencyPct: 10,
          categories: [
            {
              id: 'cat-misc',
              name: 'Miscellaneous',
              items: [
                {
                  id: 'item-misc-1',
                  label: 'Disposable Cutlery',
                  allocated: 5000,
                  estimated: 4000,
                  actual: 4000,
                  note: '',
                },
              ],
            },
          ],
        },
      })
      const onUpdate = vi.fn()

      render(<BudgetTab plan={plan} onUpdatePlan={onUpdate} />)

      // Click Delete
      fireEvent.click(screen.getByRole('button', { name: /delete expense disposable cutlery/i }))

      // Confirmation dialog should appear
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText(/delete expense item\?/i)).toBeInTheDocument()

      // Confirm deletion
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /delete expense/i }))

      expect(onUpdate).toHaveBeenCalledTimes(1)
      const updatedPlan = onUpdate.mock.calls[0][0] as EventPlan
      expect(updatedPlan.budget.categories[0].items.length).toBe(0)
    })
  })

  // ── 5. Vendor-Linked Expense Restrictions ───────────────────
  describe('Vendor-Linked Expenses Bridge', () => {
    it('disables estimated and actual inputs for vendor-linked expense items and protects single source of truth', () => {
      const demoPlan = createDemoPlan()
      render(<BudgetTab plan={demoPlan} onUpdatePlan={vi.fn()} />)

      // demoVendors[0] is linked to 'demo-bi-venue' (Main banquet hall)
      // The badge should indicate vendor linkage
      expect(screen.getByText(/🔒 linked: \[demo\] the grand mahal banquet/i)).toBeInTheDocument()

      // Click Edit on the vendor-linked item
      fireEvent.click(screen.getByRole('button', { name: /edit expense main banquet hall/i }))

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText(/vendor-linked expense/i)).toBeInTheDocument()

      // Label and Allocation are editable
      const labelInput = screen.getByLabelText(/expense label/i)
      const allocatedInput = screen.getByLabelText(/planned allocation/i)
      expect(labelInput).not.toBeDisabled()
      expect(allocatedInput).not.toBeDisabled()

      // Estimated and Actual MUST be disabled!
      const estimatedInput = screen.getByLabelText(/estimated cost/i)
      const actualInput = screen.getByLabelText(/actual spending/i)
      expect(estimatedInput).toBeDisabled()
      expect(actualInput).toBeDisabled()
    })

    it('unlinks vendor when a vendor-linked expense is deleted without altering vendor payment records', () => {
      const demoPlan = createDemoPlan()
      const onUpdate = vi.fn()

      render(<BudgetTab plan={demoPlan} onUpdatePlan={onUpdate} />)

      // Delete the vendor-linked venue item
      fireEvent.click(screen.getByRole('button', { name: /delete expense main banquet hall/i }))

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText(/this expense is currently linked to a vendor/i)).toBeInTheDocument()

      // Confirm delete
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /delete expense/i }))

      expect(onUpdate).toHaveBeenCalledTimes(1)
      const updatedPlan = onUpdate.mock.calls[0][0] as EventPlan

      // Item should be deleted from budget
      const venueCat = updatedPlan.budget.categories.find((c) => c.id === 'demo-cat-venue')
      expect(venueCat?.items.some((i) => i.id === 'demo-bi-venue')).toBe(false)

      // Linked vendor MUST still exist with unlinkedBudgetItemId set to undefined, preserving payments!
      const linkedVendor = updatedPlan.vendors.find((v) => v.id === 'demo-v1')
      expect(linkedVendor).toBeDefined()
      expect(linkedVendor?.linkedBudgetItemId).toBeUndefined()
      expect(linkedVendor?.quotedCost).toBe(350000)
      expect(linkedVendor?.amountPaid).toBe(100000) // Unchanged!
    })
  })

  // ── 6. Category Management ──────────────────────────────────
  describe('Category Management', () => {
    it('allows creating a new budget category', () => {
      const plan = makeTestPlan()
      const onUpdate = vi.fn()

      render(<BudgetTab plan={plan} onUpdatePlan={onUpdate} />)

      // Click + Add Category
      fireEvent.click(screen.getByRole('button', { name: /\+ add category/i }))

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText(/add budget category/i)).toBeInTheDocument()

      // Fill in name
      fireEvent.change(screen.getByLabelText(/category name/i), { target: { value: 'Pooja & Rituals' } })
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /add category/i }))

      expect(onUpdate).toHaveBeenCalledTimes(1)
      const updatedPlan = onUpdate.mock.calls[0][0] as EventPlan
      const addedCat = updatedPlan.budget.categories.find((c) => c.name === 'Pooja & Rituals')
      expect(addedCat).toBeDefined()
      expect(addedCat?.items).toEqual([])
    })
  })

  // ── 7. Shared State & Overview Tab Synchronization ─────────
  describe('Shared State & Overview Synchronization', () => {
    it('immediately reflects budget expense updates in the Overview tab and persists to storage', async () => {
      // Save initial plan to storage so App loads it
      const plan = makeTestPlan()
      saveEventPlan(plan)

      render(<App />)

      // Navigate to Workspace
      fireEvent.click(screen.getByRole('button', { name: /open workspace/i }))

      // Initially on Overview tab
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /overview/i })).toHaveAttribute('aria-selected', 'true')
      })

      // Switch to Budget tab
      fireEvent.click(screen.getByRole('tab', { name: /budget/i }))
      expect(screen.getByRole('tab', { name: /budget/i })).toHaveAttribute('aria-selected', 'true')

      // Add an expense: 2,00,000 allocated, 1,50,000 actual
      const addButtons = screen.getAllByRole('button', { name: /\+ add expense/i })
      fireEvent.click(addButtons[0])

      fireEvent.change(screen.getByLabelText(/expense label/i), { target: { value: 'Banquets Deposit' } })
      fireEvent.change(screen.getByLabelText(/planned allocation/i), { target: { value: '200000' } })
      fireEvent.change(screen.getByLabelText(/estimated cost/i), { target: { value: '200000' } })
      fireEvent.change(screen.getByLabelText(/actual spending/i), { target: { value: '150000' } })
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /add expense/i }))

      // Modal closes, Budget tab reflects updated allocated & actual
      await waitFor(() => {
        expect(screen.getByTestId('metric-actual')).toHaveTextContent(formatINR(150000))
      })

      // Switch back to Overview tab
      fireEvent.click(screen.getByRole('tab', { name: /overview/i }))

      // Overview tab MUST immediately show actual spending of ₹1,50,000!
      expect(screen.getByText(formatINR(150000))).toBeInTheDocument()
    })
  })
})
