// ═══════════════════════════════════════════════════════════
// UtsavFlow AI — Shared TypeScript Types & Zod Schemas
// ═══════════════════════════════════════════════════════════

import { z } from 'zod'

// ── Primitives ─────────────────────────────────────────────

export const EventTypeSchema = z.enum(['wedding', 'birthday', 'community'])
export type EventType = z.infer<typeof EventTypeSchema>

export const BookingStatusSchema = z.enum(['enquiring', 'booked', 'cancelled'])
export type BookingStatus = z.infer<typeof BookingStatusSchema>

export const PaymentStatusSchema = z.enum(['unpaid', 'partial', 'paid'])
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>

export const TaskPrioritySchema = z.enum(['high', 'medium', 'low'])
export type TaskPriority = z.infer<typeof TaskPrioritySchema>

export const IdeaCategorySchema = z.enum([
  'theme', 'decor', 'menu', 'entertainment', 'budget-saving', 'logistics',
])
export type IdeaCategory = z.infer<typeof IdeaCategorySchema>

// ── Budget Types ────────────────────────────────────────────

export const ExpenseItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(120),
  allocated: z.number().int().min(0),
  estimated: z.number().int().min(0),
  actual: z.number().int().min(0),
  vendorId: z.string().optional(),   // if set, actual is managed by vendor
  note: z.string().max(300).default(''),
})
export type ExpenseItem = z.infer<typeof ExpenseItemSchema>

export const BudgetCategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(60),
  items: z.array(ExpenseItemSchema),
})
export type BudgetCategory = z.infer<typeof BudgetCategorySchema>

export const BudgetSectionSchema = z.object({
  categories: z.array(BudgetCategorySchema),
  contingencyPct: z.number().int().min(0).max(30),
})
export type BudgetSection = z.infer<typeof BudgetSectionSchema>

// Computed, never stored
export interface BudgetSummary {
  totalBudget: number
  totalAllocated: number
  totalEstimated: number
  totalActual: number
  contingencyReserve: number
  /** max(0, totalBudget - totalAllocated - contingencyReserve) */
  unallocatedFunds: number
  /** max(0, totalAllocated + contingencyReserve - totalBudget) */
  allocationOverage: number
  remainingBudget: number
  isOverAllocated: boolean
  isOverspent: boolean
}

// ── Vendor Types ────────────────────────────────────────────

export const VendorCategoryValues = [
  'venue', 'catering', 'photography', 'decoration', 'entertainment',
  'logistics', 'music', 'makeup', 'invitations', 'other',
] as const
export const VendorCategorySchema = z.enum(VendorCategoryValues)
export type VendorCategory = z.infer<typeof VendorCategorySchema>

export const VendorSchema = z.object({
  id: z.string().min(1),
  category: VendorCategorySchema,
  name: z.string().min(1).max(120),
  contactInfo: z.string().max(200).default(''),
  quotedCost: z.number().int().min(0),
  /** amountPaid must be <= quotedCost */
  amountPaid: z.number().int().min(0),
  /** refundAmount must be <= amountPaid */
  refundAmount: z.number().int().min(0).optional(),
  bookingStatus: BookingStatusSchema,
  paymentStatus: PaymentStatusSchema,
  linkedBudgetItemId: z.string().optional(),
  notes: z.string().max(500).default(''),
}).refine(
  (v) => v.amountPaid <= v.quotedCost,
  { message: 'Amount paid cannot exceed quoted cost', path: ['amountPaid'] }
).refine(
  (v) => (v.refundAmount ?? 0) <= v.amountPaid,
  { message: 'Refund amount cannot exceed amount paid', path: ['refundAmount'] }
)
export type Vendor = z.infer<typeof VendorSchema>

// ── Timeline Types ──────────────────────────────────────────

export const TimelineTaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(500).default(''),
  /** Days relative to event date (negative = before, e.g. -90 = 90 days before) */
  offsetDays: z.number().int(),
  /** Derived from eventDate + offsetDays; stored as YYYY-MM-DD */
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  priority: TaskPrioritySchema,
  completed: z.boolean().default(false),
  /** false = system generated; true = user added (user-added tasks with explicit dates not recalculated) */
  isUserAdded: z.boolean().default(false),
  /** If true and isUserAdded, task has a manually-set dueDate that may conflict */
  hasDateWarning: z.boolean().default(false),
})
export type TimelineTask = z.infer<typeof TimelineTaskSchema>

// ── AI Idea Types ───────────────────────────────────────────

export const IdeaItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().max(200),
  category: IdeaCategorySchema,
  rationale: z.string().max(600),
  steps: z.array(z.string().max(300)).max(6),
  practicalSteps: z.array(z.string().max(300)).max(6).optional(),
  estimatedCostMin: z.number().int().min(0),
  estimatedCostMax: z.number().int().min(0),
  fitReason: z.string().max(400),
})
export type IdeaItem = z.infer<typeof IdeaItemSchema>

export type IdeasSource = 'gemini' | 'demo'

export interface IdeasResponse {
  ideas: IdeaItem[]
  source: IdeasSource
}

// ── Event Plan (Root Entity) ────────────────────────────────

export const EventPlanSchema = z.object({
  id: z.string().min(1),
  version: z.literal(2),
  type: EventTypeSchema,
  name: z.string().min(1).max(100),
  /** YYYY-MM-DD date string */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  city: z.string().min(1).max(100),
  guestCount: z.number().int().min(1).max(100000),
  budgetTotal: z.number().int().min(0),
  theme: z.string().max(300).default(''),
  dietaryRequirements: z.string().max(300).default(''),
  accessibilityNeeds: z.string().max(300).default(''),
  budget: BudgetSectionSchema,
  timeline: z.array(TimelineTaskSchema),
  vendors: z.array(VendorSchema),
  aiPrivacyConsented: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type EventPlan = z.infer<typeof EventPlanSchema>

// ── Storage Shape ───────────────────────────────────────────

export interface StorageEnvelope {
  version: number
  data: unknown
}

// ── API Types ───────────────────────────────────────────────

export const IdeaRequestSchema = z.object({
  eventType: EventTypeSchema,
  eventName: z.string().max(100).trim(),
  city: z.string().max(100).trim(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guestCount: z.number().int().min(1).max(100000),
  budgetTotal: z.number().int().min(0).max(1_000_000_000),
  theme: z.string().max(300).trim(),
  dietary: z.string().max(300).trim(),
  accessibility: z.string().max(300).trim(),
  idempotencyKey: z.string().max(64).optional(),
})
export type IdeaRequest = z.infer<typeof IdeaRequestSchema>

// Raw Gemini output schema (before adding id)
export const RawIdeaItemSchema = z.object({
  title: z.string().max(200),
  category: IdeaCategorySchema,
  rationale: z.string().max(600),
  steps: z.array(z.string().max(300)).max(6),
  practicalSteps: z.array(z.string().max(300)).max(6).optional(),
  estimatedCostMin: z.number().int().min(0),
  estimatedCostMax: z.number().int().min(0),
  fitReason: z.string().max(400),
})
export const RawIdeasResponseSchema = z.array(RawIdeaItemSchema).min(1).max(10)
