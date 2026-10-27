import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  loadEventPlan,
  saveEventPlan,
  clearEventPlan,
  exportPlanAsJSON,
} from '@/lib/storage'
import type { EventPlan } from '@/types'
import { EventPlanSchema } from '../types'

// ── Test factory ────────────────────────────────────────────

function makeValidPlan(overrides: Partial<EventPlan> = {}): EventPlan {
  const now = new Date().toISOString()
  return {
    id: 'test-plan-001',
    version: 2,
    type: 'birthday',
    name: 'Test Birthday',
    date: '2025-06-15',
    city: 'Delhi',
    guestCount: 50,
    budgetTotal: 200_000,
    theme: 'Tropical',
    dietaryRequirements: 'None',
    accessibilityNeeds: 'None',
    budget: {
      contingencyPct: 5,
      categories: [
        {
          id: 'cat-1',
          name: 'Venue',
          items: [
            { id: 'item-1', label: 'Hall', allocated: 50_000, estimated: 45_000, actual: 45_000, note: '' },
          ],
        },
      ],
    },
    timeline: [],
    vendors: [],
    aiPrivacyConsented: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

// ── Setup / Teardown ────────────────────────────────────────

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

// ── loadEventPlan ───────────────────────────────────────────

describe('loadEventPlan', () => {
  it('returns empty when localStorage has no plan', () => {
    const result = loadEventPlan()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('empty')
  })

  it('returns the plan when stored correctly', () => {
    const plan = makeValidPlan()
    saveEventPlan(plan)
    const result = loadEventPlan()
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plan.id).toBe('test-plan-001')
      expect(result.plan.name).toBe('Test Birthday')
    }
  })

  it('returns corrupted when JSON is malformed', () => {
    localStorage.setItem('utsavflow_plan', '{ invalid json !!!')
    const result = loadEventPlan()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('corrupted')
  })

  it('quarantines corrupted data to sessionStorage', () => {
    const raw = '{ bad json'
    localStorage.setItem('utsavflow_plan', raw)
    loadEventPlan()
    const quarantined = sessionStorage.getItem('utsavflow_corrupted_backup')
    expect(quarantined).toBe(raw)
  })

  it('returns schema_error for structurally invalid data', () => {
    localStorage.setItem('utsavflow_plan', JSON.stringify({ version: 2, id: 'x' })) // missing required fields
    const result = loadEventPlan()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(['schema_error', 'corrupted']).toContain(result.reason)
    }
  })

  it('migrates a v1 plan to v2', () => {
    const v1Plan = {
      version: 1,
      id: 'old-plan',
      type: 'birthday',
      name: 'Old Party',
      date: '2025-01-01',
      city: 'Mumbai',
      guestCount: 30,
      budgetTotal: 50_000,
      theme: '',
      dietary: 'veg',      // v1 field name
      accessibility: '',
      budget: { categories: [], contingencyPct: 5 },
      timeline: [],
      vendors: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    localStorage.setItem('utsavflow_plan', JSON.stringify(v1Plan))
    const result = loadEventPlan()
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plan.version).toBe(2)
    }
  })
})

// ── saveEventPlan ───────────────────────────────────────────

describe('saveEventPlan', () => {
  it('persists and retrieves round-trip correctly', () => {
    const plan = makeValidPlan()
    saveEventPlan(plan)
    const result = loadEventPlan()
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plan.guestCount).toBe(50)
      expect(result.plan.budgetTotal).toBe(200_000)
    }
  })

  it('updates updatedAt on every save', () => {
    const plan = makeValidPlan({ updatedAt: '2020-01-01T00:00:00.000Z' })
    saveEventPlan(plan)
    const result = loadEventPlan()
    if (result.ok) {
      expect(result.plan.updatedAt).not.toBe('2020-01-01T00:00:00.000Z')
    }
  })

  it('throws when saving an invalid plan (no id)', () => {
    const invalid = { ...makeValidPlan(), id: '' }
    expect(() => saveEventPlan(invalid)).toThrow()
  })

  it('throws when saving a plan with invalid version', () => {
    const invalid = { ...makeValidPlan(), version: 1 as unknown as 2 }
    expect(() => saveEventPlan(invalid)).toThrow()
  })
})

// ── clearEventPlan ──────────────────────────────────────────

describe('clearEventPlan', () => {
  it('removes the plan from localStorage', () => {
    saveEventPlan(makeValidPlan())
    clearEventPlan()
    const result = loadEventPlan()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('empty')
  })
})

// ── exportPlanAsJSON ────────────────────────────────────────

describe('exportPlanAsJSON', () => {
  it('produces valid JSON', () => {
    const plan = makeValidPlan()
    const json = exportPlanAsJSON(plan)
    expect(() => JSON.parse(json)).not.toThrow()
  })

  it('exported JSON passes schema validation', () => {
    const plan = makeValidPlan()
    const json = exportPlanAsJSON(plan)
    const parsed = JSON.parse(json)
    const result = EventPlanSchema.safeParse(parsed)
    expect(result.success).toBe(true)
  })

  it('does not include any API key field', () => {
    const plan = makeValidPlan()
    const json = exportPlanAsJSON(plan)
    expect(json).not.toContain('api_key')
    expect(json).not.toContain('apiKey')
    expect(json).not.toContain('GEMINI')
  })

  it('throws for invalid plan', () => {
    const invalid = { ...makeValidPlan(), version: 99 as unknown as 2 }
    expect(() => exportPlanAsJSON(invalid)).toThrow()
  })
})
