// ═══════════════════════════════════════════════════════════
// lib/planFactory.ts — Safe EventPlan creation helper
// ═══════════════════════════════════════════════════════════

import { nanoid } from 'nanoid'
import type { BudgetSection, EventPlan, EventType } from '@/types'
import { generateDefaultTasks } from './timeline'

export interface CreatePlanInput {
  type: EventType
  name: string
  date: string
  city: string
  guestCount: number
  budgetTotal: number
  theme: string
  dietaryRequirements: string
  accessibilityNeeds: string
}

export function createInitialBudget(type: EventType): BudgetSection {
  const categoryTemplates: Record<EventType, string[]> = {
    wedding: [
      'Venue & Accommodations',
      'Catering & Feasts',
      'Photography & Videography',
      'Decor, Floral & Stage',
      'Entertainment & Music',
      'Attire, Jewelry & Favors',
    ],
    birthday: [
      'Venue & Space Rental',
      'Cake & Refreshments',
      'Photography',
      'Decor & Balloon Art',
      'Entertainment & Games',
      'Party Favors & Gifts',
    ],
    community: [
      'Venue & Permissions',
      'Community Feast (Prasad / Food)',
      'Sound, Lights & Stage',
      'Decor & Signage',
      'Logistics & Safety',
      'Performances & Programs',
    ],
  }

  const names = categoryTemplates[type] ?? categoryTemplates.wedding
  return {
    contingencyPct: 10,
    categories: names.map((name) => ({
      id: `cat-${nanoid(6)}`,
      name,
      items: [
        {
          id: `item-${nanoid(6)}`,
          label: `${name} primary envelope`,
          allocated: 0,
          estimated: 0,
          actual: 0,
          note: `Budget allocation for ${name.toLowerCase()}`,
        },
      ],
    })),
  }
}

export function createNewEventPlan(input: CreatePlanInput): EventPlan {
  const now = new Date().toISOString()
  return {
    id: `plan-${nanoid(8)}`,
    version: 2,
    type: input.type,
    name: input.name.trim(),
    date: input.date.trim(),
    city: input.city.trim(),
    guestCount: Math.max(1, Math.floor(input.guestCount)),
    budgetTotal: Math.max(0, Math.floor(input.budgetTotal)),
    theme: input.theme.trim(),
    dietaryRequirements: input.dietaryRequirements.trim(),
    accessibilityNeeds: input.accessibilityNeeds.trim(),
    budget: createInitialBudget(input.type),
    timeline: generateDefaultTasks(input.type, input.date.trim()),
    vendors: [],
    aiPrivacyConsented: false,
    createdAt: now,
    updatedAt: now,
  }
}
