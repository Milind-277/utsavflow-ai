// ═══════════════════════════════════════════════════════════
// lib/validate.ts — Zod schemas for AI request/response
// Strict validation, bounds checking, and privacy minimization
// ═══════════════════════════════════════════════════════════

import { z } from 'zod'

export const IdeaCategorySchema = z.enum([
  'theme', 'decor', 'menu', 'entertainment', 'budget-saving', 'logistics',
])
export type IdeaCategory = z.infer<typeof IdeaCategorySchema>

// ── Inbound request (from browser) ─────────────────────────
// Privacy-first: exact budget, exact date, eventName, and vendor
// details are NOT required and NOT forwarded to AI providers.

export const IdeaRequestSchema = z.object({
  eventType:      z.enum(['wedding', 'birthday', 'community']),
  city:           z.string().min(1, 'City is required').max(100).trim(),
  season:         z.string().max(100).trim().optional(),
  guestCount:     z.number().int().min(1, 'Guest count must be at least 1').max(100_000).optional(),
  budgetBand:     z.string().max(100).trim().optional(),
  theme:          z.string().max(300).trim().optional(),
  dietary:        z.string().max(300).trim().optional(),
  accessibility:  z.string().max(300).trim().optional(),
  idempotencyKey: z.string().max(64).optional(),

  // Compatibility / optional fields (validated if present, never forwarded to Gemini)
  eventName:      z.string().max(100).trim().optional(),
  date:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  budgetTotal:    z.number().int().min(0).max(1_000_000_000).optional(),
})
export type IdeaRequest = z.infer<typeof IdeaRequestSchema>

// ── Outbound individual idea ────────────────────────────────

export const IdeaItemSchema = z.object({
  id:               z.string().optional(),
  title:            z.string().min(2).max(200),
  category:         IdeaCategorySchema,
  rationale:        z.string().min(5).max(600),
  steps:            z.array(z.string().min(1).max(300)).min(1).max(10),
  practicalSteps:   z.array(z.string().min(1).max(300)).min(1).max(10).optional(),
  estimatedCostMin: z.number().int().min(0),
  estimatedCostMax: z.number().int().min(0),
  fitReason:        z.string().min(5).max(400),
}).refine(
  (item) => item.estimatedCostMin <= item.estimatedCostMax,
  {
    message: 'estimatedCostMin must be less than or equal to estimatedCostMax',
    path: ['estimatedCostMax'],
  }
)
export type IdeaItem = z.infer<typeof IdeaItemSchema>

/** Validate raw Gemini output before returning to client */
export const RawIdeasSchema = z.array(IdeaItemSchema).min(1).max(8)

// ── API response ────────────────────────────────────────────

export type IdeasSource = 'gemini' | 'demo'

export interface IdeasApiResponse {
  ideas: IdeaItem[]
  source: IdeasSource
  disclaimer: string
}

// ── Privacy & Data Minimization Helpers ──────────────────────

export function deriveBudgetBand(budgetTotal?: number): string {
  if (budgetTotal === undefined || budgetTotal === null) return 'Budget Tier: Flexible'
  if (budgetTotal < 100_000) return 'Under ₹1 Lakh (Modest)'
  if (budgetTotal < 500_000) return '₹1 Lakh - ₹5 Lakhs (Pocket-friendly)'
  if (budgetTotal < 1_500_000) return '₹5 Lakhs - ₹15 Lakhs (Mid-range)'
  if (budgetTotal < 5_000_000) return '₹15 Lakhs - ₹50 Lakhs (Premium)'
  return '₹50 Lakhs+ (Grand/Luxury)'
}

export function deriveSeason(dateStr?: string): string {
  if (!dateStr) return 'Flexible season'
  const match = dateStr.match(/^\d{4}-(\d{2})-\d{2}$/)
  if (!match) return 'Flexible season'
  const month = parseInt(match[1], 10)
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]
  const monthName = monthNames[month - 1] || ''
  if (month === 12 || month === 1 || month === 2) return `Winter (${monthName})`
  if (month >= 3 && month <= 5) return `Summer/Spring (${monthName})`
  if (month >= 6 && month <= 9) return `Monsoon (${monthName})`
  return `Autumn/Post-Monsoon (${monthName})`
}
