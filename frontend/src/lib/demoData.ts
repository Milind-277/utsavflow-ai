// ═══════════════════════════════════════════════════════════
// lib/demoData.ts — Fully populated demo event plan
// Clearly labelled as DEMO data throughout
// ═══════════════════════════════════════════════════════════

import { nanoid } from 'nanoid'
import { generateDefaultTasks } from './timeline'
import { derivePaymentStatus } from './vendors'
import { addCalendarDays, formatDateOnly } from './dateOnly'
import type { EventPlan, Vendor, BudgetSection } from '@/types'

/**
 * Returns a sensible future celebration date for the demo plan (~120 days ahead).
 * Can accept an injectable referenceDate (Date or string YYYY-MM-DD) for deterministic testing.
 */
export function getDemoEventDate(referenceDate: Date | string = new Date()): string {
  const refStr = typeof referenceDate === 'string'
    ? referenceDate
    : formatDateOnly(referenceDate)
  return addCalendarDays(refStr, 120)
}

const DEMO_BUDGET = 15_00_000 // ₹15 lakh

const demoVendors: Vendor[] = [
  {
    id: 'demo-v1',
    category: 'venue',
    name: '[DEMO] The Grand Mahal Banquet, Mumbai',
    contactInfo: '+91 98200 00001 · events@grandmahal.example',
    quotedCost: 3_50_000,
    amountPaid: 1_00_000,
    bookingStatus: 'booked',
    paymentStatus: 'partial',
    linkedBudgetItemId: 'demo-bi-venue',
    notes: 'Advance paid. Balance due 7 days before event.',
  },
  {
    id: 'demo-v2',
    category: 'catering',
    name: '[DEMO] Spice Route Caterers',
    contactInfo: '+91 98200 00002',
    quotedCost: 2_80_000,
    amountPaid: 0,
    bookingStatus: 'booked',
    paymentStatus: 'unpaid',
    linkedBudgetItemId: 'demo-bi-catering',
    notes: 'North Indian + South Indian buffet for 200 guests. Vegetarian options confirmed.',
  },
  {
    id: 'demo-v3',
    category: 'photography',
    name: '[DEMO] Lens & Light Studio',
    contactInfo: '+91 98200 00003',
    quotedCost: 85_000,
    amountPaid: 85_000,
    bookingStatus: 'booked',
    paymentStatus: 'paid',
    linkedBudgetItemId: 'demo-bi-photo',
    notes: 'Full day coverage + 200 edited photos. Fully paid.',
  },
  {
    id: 'demo-v4',
    category: 'decoration',
    name: '[DEMO] Petal & Bloom Florals',
    contactInfo: '+91 98200 00004',
    quotedCost: 1_20_000,
    amountPaid: 0,
    bookingStatus: 'enquiring',
    paymentStatus: 'unpaid',
    linkedBudgetItemId: 'demo-bi-decor',
    notes: 'Awaiting revised quote for marigold and jasmine theme.',
  },
  {
    id: 'demo-v5',
    category: 'music',
    name: '[DEMO] DJ Beats Entertainment',
    contactInfo: '+91 98200 00005',
    quotedCost: 45_000,
    amountPaid: 0,
    bookingStatus: 'cancelled',
    paymentStatus: 'unpaid',
    linkedBudgetItemId: undefined,
    notes: 'Cancelled — switching to a live band.',
  },
]

// Derive paymentStatus from amounts (enforces consistency)
const vendorsNormalized: Vendor[] = demoVendors.map((v) => ({
  ...v,
  paymentStatus: derivePaymentStatus(v),
}))

const demoBudget: BudgetSection = {
  contingencyPct: 8,
  categories: [
    {
      id: 'demo-cat-venue',
      name: 'Venue',
      items: [
        {
          id: 'demo-bi-venue',
          label: 'Main banquet hall',
          allocated: 4_00_000,
          estimated: 3_50_000,   // synced from vendor.quotedCost (booked)
          actual:    1_00_000,   // synced from vendor.amountPaid
          vendorId: 'demo-v1',
          note: '',
        },
      ],
    },
    {
      id: 'demo-cat-catering',
      name: 'Catering',
      items: [
        {
          id: 'demo-bi-catering',
          label: 'Full catering service (200 guests)',
          allocated: 3_00_000,
          estimated: 2_80_000,   // vendor booked, no payment yet
          actual: 0,
          vendorId: 'demo-v2',
          note: '',
        },
        {
          id: 'demo-bi-dessert',
          label: 'Dessert station',
          allocated: 50_000,
          estimated: 45_000,
          actual: 0,
          note: 'To be arranged separately.',
        },
      ],
    },
    {
      id: 'demo-cat-photography',
      name: 'Photography & Video',
      items: [
        {
          id: 'demo-bi-photo',
          label: 'Photography (full day)',
          allocated: 1_00_000,
          estimated: 85_000,
          actual: 85_000,   // fully paid
          vendorId: 'demo-v3',
          note: '',
        },
        {
          id: 'demo-bi-video',
          label: 'Videography',
          allocated: 80_000,
          estimated: 0,
          actual: 0,
          note: 'Still shortlisting vendors.',
        },
      ],
    },
    {
      id: 'demo-cat-decoration',
      name: 'Decoration',
      items: [
        {
          id: 'demo-bi-decor',
          label: 'Floral and decoration',
          allocated: 1_50_000,
          estimated: 1_20_000,   // enquiring vendor — shows quote as estimate
          actual: 0,
          vendorId: 'demo-v4',
          note: '',
        },
      ],
    },
    {
      id: 'demo-cat-entertainment',
      name: 'Entertainment',
      items: [
        {
          id: 'demo-bi-entertainment',
          label: 'Live band / music',
          allocated: 80_000,
          estimated: 0,
          actual: 0,
          note: 'Shortlisting live bands after DJ cancellation.',
        },
      ],
    },
    {
      id: 'demo-cat-logistics',
      name: 'Logistics & Miscellaneous',
      items: [
        {
          id: 'demo-bi-invites',
          label: 'Invitations & printing',
          allocated: 20_000,
          estimated: 18_000,
          actual: 18_000,
          note: '',
        },
        {
          id: 'demo-bi-transport',
          label: 'Guest transport',
          allocated: 30_000,
          estimated: 25_000,
          actual: 0,
          note: '',
        },
        {
          id: 'demo-bi-misc',
          label: 'Miscellaneous / contingency items',
          allocated: 40_000,
          estimated: 30_000,
          actual: 0,
          note: '',
        },
      ],
    },
  ],
}

export function createDemoPlan(referenceDate?: Date | string): EventPlan {
  const now = new Date().toISOString()
  const eventDate = getDemoEventDate(referenceDate)
  return {
    id: `demo-${nanoid(8)}`,
    version: 2,
    type: 'wedding',
    name: '[DEMO] Priya & Arjun\'s Wedding',
    date: eventDate,
    city: 'Mumbai',
    guestCount: 200,
    budgetTotal: DEMO_BUDGET,
    theme: 'Marigold & Jasmine — traditional Indian with a modern editorial touch',
    dietaryRequirements: 'Full vegetarian; Jain options required for 20 guests',
    accessibilityNeeds: 'Wheelchair access needed for 3 guests; large-print menus',
    budget: demoBudget,
    timeline: generateDefaultTasks('wedding', eventDate),
    vendors: vendorsNormalized,
    aiPrivacyConsented: false,
    createdAt: now,
    updatedAt: now,
  }
}
