import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import App from '../App'
import { VendorsTab } from '../components/VendorsTab'
import { createDemoPlan } from '../lib/demoData'
import { clearEventPlan, saveEventPlan } from '../lib/storage'
import { createNewEventPlan } from '../lib/planFactory'
import type { EventPlan, Vendor } from '../types'
import { formatINR } from '../lib/currency'
import { vendorNetPaid, vendorOutstanding, derivePaymentStatus } from '../lib/vendors'

describe('M7 — Vendor Directory & Payment Bridge Test Suite', () => {
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
      name: 'Aditi & Kabir Wedding',
      date: '2027-02-15',
      city: 'Udaipur',
      guestCount: 300,
      budgetTotal: 25_00_000,
      theme: 'Lakeside Royal',
      dietaryRequirements: 'Vegetarian',
      accessibilityNeeds: 'Ramps',
    })
    return { ...base, ...overrides }
  }

  // ── 1. Vendor CRUD Operations ────────────────────────────────
  describe('Vendor Directory CRUD', () => {
    it('allows registering a new vendor and validates all fields', () => {
      const plan = makeTestPlan()
      const onUpdate = vi.fn()

      render(<VendorsTab plan={plan} onUpdatePlan={onUpdate} />)

      // Open Register Vendor modal
      fireEvent.click(screen.getByRole('button', { name: /\+ register vendor/i }))

      const dialog = screen.getByRole('dialog')
      expect(dialog).toBeInTheDocument()
      expect(within(dialog).getByText(/register new vendor/i)).toBeInTheDocument()

      // Fill in fields
      fireEvent.change(within(dialog).getByLabelText(/vendor \/ business name/i), {
        target: { value: 'Marwar Heritage Decorators' },
      })
      fireEvent.change(within(dialog).getByLabelText(/vendor category/i), {
        target: { value: 'decoration' },
      })
      fireEvent.change(within(dialog).getByLabelText(/contact info/i), {
        target: { value: '+91 98290 12345 · contact@marwardecor.example' },
      })
      fireEvent.change(within(dialog).getByLabelText(/quoted cost/i), {
        target: { value: '250000' },
      })
      fireEvent.change(within(dialog).getByLabelText(/amount paid/i), {
        target: { value: '50000' },
      })
      fireEvent.change(within(dialog).getByLabelText(/booking status/i), {
        target: { value: 'booked' },
      })
      fireEvent.change(within(dialog).getByLabelText(/contract terms & notes/i), {
        target: { value: '₹50k advance received via NEFT; balance 7 days before event' },
      })

      // Submit
      fireEvent.click(within(dialog).getByRole('button', { name: /register vendor/i }))

      expect(onUpdate).toHaveBeenCalledTimes(1)
      const updatedPlan = onUpdate.mock.calls[0][0] as EventPlan
      const registered = updatedPlan.vendors.find((v) => v.name === 'Marwar Heritage Decorators')

      expect(registered).toBeDefined()
      expect(registered?.category).toBe('decoration')
      expect(registered?.quotedCost).toBe(250000)
      expect(registered?.amountPaid).toBe(50000)
      expect(registered?.bookingStatus).toBe('booked')
      expect(registered?.paymentStatus).toBe('partial')
    })

    it('rejects invalid inputs: empty name, negative costs, amountPaid > quotedCost, refund > amountPaid', () => {
      const plan = makeTestPlan()
      const onUpdate = vi.fn()

      render(<VendorsTab plan={plan} onUpdatePlan={onUpdate} />)

      fireEvent.click(screen.getByRole('button', { name: /\+ register vendor/i }))
      const dialog = screen.getByRole('dialog')

      // 1. Empty name
      fireEvent.change(within(dialog).getByLabelText(/vendor \/ business name/i), { target: { value: '' } })
      fireEvent.click(within(dialog).getByRole('button', { name: /register vendor/i }))
      expect(within(dialog).getByText(/vendor name is required/i)).toBeInTheDocument()
      expect(onUpdate).not.toHaveBeenCalled()

      // 2. amountPaid > quotedCost
      fireEvent.change(within(dialog).getByLabelText(/vendor \/ business name/i), { target: { value: 'Test Florals' } })
      fireEvent.change(within(dialog).getByLabelText(/quoted cost/i), { target: { value: '100000' } })
      fireEvent.change(within(dialog).getByLabelText(/amount paid/i), { target: { value: '150000' } })
      fireEvent.click(within(dialog).getByRole('button', { name: /register vendor/i }))
      expect(within(dialog).getByText(/amount paid cannot exceed quoted cost/i)).toBeInTheDocument()
      expect(onUpdate).not.toHaveBeenCalled()

      // 3. refundAmount > amountPaid
      fireEvent.change(within(dialog).getByLabelText(/amount paid/i), { target: { value: '50000' } })
      fireEvent.change(within(dialog).getByLabelText(/refund received/i), { target: { value: '60000' } })
      fireEvent.click(within(dialog).getByRole('button', { name: /register vendor/i }))
      expect(within(dialog).getByText(/refund amount cannot exceed amount paid/i)).toBeInTheDocument()
      expect(onUpdate).not.toHaveBeenCalled()
    })

    it('allows editing an existing vendor and recalculates payment status dynamically', () => {
      const plan = makeTestPlan({
        vendors: [
          {
            id: 'v-test',
            category: 'photography',
            name: 'Klick Studio',
            contactInfo: '+91 98000 00000',
            quotedCost: 100000,
            amountPaid: 30000,
            bookingStatus: 'booked',
            paymentStatus: 'partial',
            notes: 'Advance cleared',
          },
        ],
      })
      const onUpdate = vi.fn()

      render(<VendorsTab plan={plan} onUpdatePlan={onUpdate} />)

      // Open Edit Modal
      fireEvent.click(screen.getByRole('button', { name: /edit vendor "klick studio"/i }))

      const dialog = screen.getByRole('dialog')
      expect(dialog).toBeInTheDocument()
      expect(within(dialog).getByDisplayValue('Klick Studio')).toBeInTheDocument()

      // Complete payment (amountPaid = quotedCost = 100000)
      fireEvent.change(within(dialog).getByLabelText(/amount paid/i), { target: { value: '100000' } })
      expect(within(dialog).getByText(/✓ fully paid/i)).toBeInTheDocument()

      // Save
      fireEvent.click(within(dialog).getByRole('button', { name: /save vendor changes/i }))

      expect(onUpdate).toHaveBeenCalledTimes(1)
      const updatedPlan = onUpdate.mock.calls[0][0] as EventPlan
      const edited = updatedPlan.vendors.find((v) => v.id === 'v-test')
      expect(edited?.amountPaid).toBe(100000)
      expect(edited?.paymentStatus).toBe('paid')
    })

    it('prompts confirmation when deleting a vendor and removes safely without deleting budget item', () => {
      const demo = createDemoPlan('2026-11-01')
      const onUpdate = vi.fn()

      render(<VendorsTab plan={demo} onUpdatePlan={onUpdate} />)

      // Delete demo-v3 (Lens & Light Studio)
      const targetVendor = demo.vendors.find((v) => v.id === 'demo-v3')!
      fireEvent.click(screen.getByRole('button', { name: /delete vendor.*lens & light studio/i }))

      const dialog = screen.getByRole('dialog')
      expect(dialog).toBeInTheDocument()
      expect(within(dialog).getByText(/delete vendor profile\?/i)).toBeInTheDocument()

      // Confirm delete
      fireEvent.click(within(dialog).getByRole('button', { name: /delete vendor/i }))

      expect(onUpdate).toHaveBeenCalledTimes(1)
      const updatedPlan = onUpdate.mock.calls[0][0] as EventPlan
      expect(updatedPlan.vendors.some((v) => v.id === targetVendor.id)).toBe(false)

      // Budget expense item (demo-bi-photo) MUST still exist with unlinked status!
      const photoCat = updatedPlan.budget.categories.find((c) => c.id === 'demo-cat-photography')
      const photoItem = photoCat?.items.find((i) => i.id === 'demo-bi-photo')
      expect(photoItem).toBeDefined()
      expect(photoItem?.vendorId).toBeUndefined()
    })
  })

  // ── 2. Booking and Payment Separation ────────────────────────
  describe('Booking vs Payment Status Separation', () => {
    it('correctly derives payment status independently from booking status', () => {
      // 1. Booked but unpaid
      expect(derivePaymentStatus({ quotedCost: 100000, amountPaid: 0 })).toBe('unpaid')

      // 2. Enquiring with zero payment
      expect(derivePaymentStatus({ quotedCost: 100000, amountPaid: 0 })).toBe('unpaid')

      // 3. Partially paid
      expect(derivePaymentStatus({ quotedCost: 100000, amountPaid: 45000 })).toBe('partial')

      // 4. Fully paid
      expect(derivePaymentStatus({ quotedCost: 100000, amountPaid: 100000 })).toBe('paid')
    })

    it('displays separate booking status and payment status badges with text and icons', () => {
      const plan = makeTestPlan({
        vendors: [
          {
            id: 'v-b-unpaid',
            category: 'venue',
            name: 'Heritage Palace',
            contactInfo: '',
            quotedCost: 500000,
            amountPaid: 0,
            bookingStatus: 'booked',
            paymentStatus: 'unpaid',
            notes: '',
          },
        ],
      })

      render(<VendorsTab plan={plan} onUpdatePlan={vi.fn()} />)

      // Must have "✓ Booked" AND "○ Unpaid" badges
      expect(screen.getByText('✓ Booked')).toBeInTheDocument()
      expect(screen.getByText('○ Unpaid')).toBeInTheDocument()
    })
  })

  // ── 3. Cancellation, Refunds, and Historical Payments ────────
  describe('Cancellation and Historical Payments', () => {
    it('clears outstanding quote commitment upon cancellation while preserving paid advance history', () => {
      const vendor: Vendor = {
        id: 'v-cancelled-paid',
        category: 'music',
        name: 'Royal Brass Band',
        contactInfo: '',
        quotedCost: 80000,
        amountPaid: 30000, // advance paid
        bookingStatus: 'cancelled',
        paymentStatus: 'partial',
        notes: 'Cancelled due to acoustic restrictions',
      }

      // Calculations:
      // Outstanding balance MUST be 0 because booking is dropped!
      expect(vendorOutstanding(vendor)).toBe(0)

      // Net paid MUST still be 30,000 (money disbursed is not erased!)
      expect(vendorNetPaid(vendor)).toBe(30000)

      const plan = makeTestPlan({ vendors: [vendor] })
      render(<VendorsTab plan={plan} onUpdatePlan={vi.fn()} />)

      // Card must display cancellation warning noting historical payment
      expect(screen.getByText(/holds ₹30,000 in historical payments/i)).toBeInTheDocument()
      expect(screen.getByText(/outstanding quote commitment cleared/i)).toBeInTheDocument()
    })

    it('deducts recorded refunds from net paid without double counting', () => {
      const vendor: Vendor = {
        id: 'v-refunded',
        category: 'catering',
        name: 'Desert Oasis Feast',
        contactInfo: '',
        quotedCost: 200000,
        amountPaid: 80000,
        refundAmount: 50000, // ₹50k returned by vendor
        bookingStatus: 'cancelled',
        paymentStatus: 'partial',
        notes: 'Partial refund received after cancellation',
      }

      // Net money paid is 80,000 - 50,000 = 30,000
      expect(vendorNetPaid(vendor)).toBe(30000)
      expect(vendorOutstanding(vendor)).toBe(0)

      const plan = makeTestPlan({ vendors: [vendor] })
      render(<VendorsTab plan={plan} onUpdatePlan={vi.fn()} />)

      // Net paid in stat card should be ₹30,000
      const paidStat = screen.getByTestId('vendor-stat-paid')
      expect(paidStat).toHaveTextContent(formatINR(30000))
    })
  })

  // ── 4. Single Source of Truth Budget Linkage ─────────────────
  describe('Budget Linkage Bridge', () => {
    it('links vendor to budget item and unlinks safely preserving expense amounts', () => {
      const plan = makeTestPlan()
      const targetExpense = plan.budget.categories[0].items[0]

      const onUpdate = vi.fn()
      render(<VendorsTab plan={plan} onUpdatePlan={onUpdate} />)

      // 1. Add vendor linked to targetExpense
      fireEvent.click(screen.getByRole('button', { name: /\+ register vendor/i }))
      const dialog = screen.getByRole('dialog')

      fireEvent.change(within(dialog).getByLabelText(/vendor \/ business name/i), { target: { value: 'Grand Banquet' } })
      fireEvent.change(within(dialog).getByLabelText(/quoted cost/i), { target: { value: '400000' } })
      fireEvent.change(within(dialog).getByLabelText(/amount paid/i), { target: { value: '100000' } })
      fireEvent.change(within(dialog).getByLabelText(/booking status/i), { target: { value: 'booked' } })
      fireEvent.change(within(dialog).getByLabelText(/link to budget expense item/i), { target: { value: targetExpense.id } })

      fireEvent.click(within(dialog).getByRole('button', { name: /register vendor/i }))

      expect(onUpdate).toHaveBeenCalledTimes(1)
      let updatedPlan = onUpdate.mock.calls[0][0] as EventPlan

      // Check that budget item has vendorId attached and reflects quote and paid amounts
      let syncedItem = updatedPlan.budget.categories[0].items.find((i) => i.id === targetExpense.id)
      expect(syncedItem?.vendorId).toBeDefined()
      expect(syncedItem?.estimated).toBe(400000)
      expect(syncedItem?.actual).toBe(100000)

      // 2. Now unlink vendor from budget
      render(<VendorsTab plan={updatedPlan} onUpdatePlan={onUpdate} />)
      const unlinkButton = screen.getByRole('button', { name: /unlink/i })
      fireEvent.click(unlinkButton)

      expect(onUpdate).toHaveBeenCalledTimes(2)
      updatedPlan = onUpdate.mock.calls[1][0] as EventPlan

      // Item should be unlinked (vendorId undefined) BUT keep estimated and actual intact!
      syncedItem = updatedPlan.budget.categories[0].items.find((i) => i.id === targetExpense.id)
      expect(syncedItem?.vendorId).toBeUndefined()
      expect(syncedItem?.estimated).toBe(400000)
      expect(syncedItem?.actual).toBe(100000)
    })
  })

  // ── 5. Filtering and Search ──────────────────────────────────
  describe('Filters & Search', () => {
    it('filters vendors by booking status and searches by text query', () => {
      const demo = createDemoPlan('2026-11-01')
      render(<VendorsTab plan={demo} onUpdatePlan={vi.fn()} />)

      // 1. Initial count: all demo vendors
      expect(screen.getByText(/the grand mahal banquet/i)).toBeInTheDocument()
      expect(screen.getByText(/dj beats entertainment/i)).toBeInTheDocument()

      // 2. Filter by Cancelled
      fireEvent.click(screen.getByRole('button', { name: /^cancelled/i }))
      expect(screen.getByText(/dj beats entertainment/i)).toBeInTheDocument()
      expect(screen.queryByText(/the grand mahal banquet/i)).not.toBeInTheDocument()

      // 3. Search query
      fireEvent.click(screen.getByRole('button', { name: /all vendors/i }))
      const searchInput = screen.getByLabelText(/search vendors/i)
      fireEvent.change(searchInput, { target: { value: 'Spice Route' } })

      expect(screen.getByText(/spice route caterers/i)).toBeInTheDocument()
      expect(screen.queryByText(/lens & light studio/i)).not.toBeInTheDocument()
    })
  })

  // ── 6. Overview & Budget Tab Synchronization ─────────────────
  describe('Shared State & Overview Synchronization', () => {
    it('immediately reflects vendor payment updates in the Overview tab and Budget tab', async () => {
      const demo = createDemoPlan('2026-11-01')
      saveEventPlan(demo)

      render(<App />)

      // Open workspace
      fireEvent.click(screen.getByRole('button', { name: /open workspace/i }))

      // Initially on Overview tab
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /overview/i })).toHaveAttribute('aria-selected', 'true')
      })

      // Switch to Vendors tab
      fireEvent.click(screen.getByRole('tab', { name: /vendors/i }))
      expect(screen.getByRole('tab', { name: /vendors/i })).toHaveAttribute('aria-selected', 'true')

      // Edit demo-v2 (Spice Route Caterers): record payment of ₹1,00,000
      fireEvent.click(screen.getByRole('button', { name: /edit vendor "\[demo\] spice route caterers"/i }))
      const dialog = screen.getByRole('dialog')

      fireEvent.change(within(dialog).getByLabelText(/amount paid/i), { target: { value: '100000' } })
      fireEvent.click(within(dialog).getByRole('button', { name: /save vendor changes/i }))

      // Switch back to Overview tab
      fireEvent.click(screen.getByRole('tab', { name: /overview/i }))

      // Overview actual spending was ₹2,03,000; with additional ₹1,00,000 paid to Spice Route, it MUST be ₹3,03,000!
      await waitFor(() => {
        expect(screen.getByText(formatINR(303000))).toBeInTheDocument()
      })
    })
  })
})
