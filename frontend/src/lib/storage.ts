// ═══════════════════════════════════════════════════════════
// lib/storage.ts — Versioned localStorage with migration and
// safe recovery for malformed data
// ═══════════════════════════════════════════════════════════

import { EventPlanSchema } from '@/types'
import type { EventPlan } from '@/types'

const STORAGE_KEY = 'utsavflow_plan'
export const CURRENT_VERSION = 2
const QUARANTINE_KEY = 'utsavflow_corrupted_backup'

export type StorageResult =
  | { ok: true; plan: EventPlan }
  | { ok: false; reason: 'empty' }
  | { ok: false; reason: 'corrupted'; raw: string }
  | { ok: false; reason: 'schema_error'; detail: string }

// ── Read ────────────────────────────────────────────────────

export function loadEventPlan(): StorageResult {
  let raw: string | null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    return { ok: false, reason: 'corrupted', raw: '' }
  }

  if (raw === null) return { ok: false, reason: 'empty' }

  // Parse JSON
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    quarantine(raw)
    return { ok: false, reason: 'corrupted', raw }
  }

  // Try current version first
  const result = EventPlanSchema.safeParse(parsed)
  if (result.success) return { ok: true, plan: result.data }

  // Try migration
  const migrated = tryMigrate(parsed)
  if (migrated) {
    // Save migrated version back
    saveEventPlan(migrated)
    return { ok: true, plan: migrated }
  }

  // Unrecoverable — quarantine and report
  quarantine(raw)
  const detail = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
  return { ok: false, reason: 'schema_error', detail }
}

// ── Write ───────────────────────────────────────────────────

export function saveEventPlan(plan: EventPlan): void {
  // Always validate before writing — never persist an invalid plan
  const result = EventPlanSchema.safeParse(plan)
  if (!result.success) {
    const detail = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(`saveEventPlan: validation failed — ${detail}`)
  }

  const updated: EventPlan = { ...result.data, updatedAt: new Date().toISOString() }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
}

// ── Delete ──────────────────────────────────────────────────

export function clearEventPlan(): void {
  localStorage.removeItem(STORAGE_KEY)
}

// ── Quarantine ──────────────────────────────────────────────

function quarantine(raw: string): void {
  try {
    sessionStorage.setItem(QUARANTINE_KEY, raw)
  } catch {
    // Session storage unavailable — ignore
  }
}

/** Retrieve quarantined data for "download original" recovery flow */
export function getQuarantinedData(): string | null {
  try {
    return sessionStorage.getItem(QUARANTINE_KEY)
  } catch {
    return null
  }
}

// ── Migration ───────────────────────────────────────────────

function tryMigrate(parsed: unknown): EventPlan | null {
  if (typeof parsed !== 'object' || parsed === null) return null
  const obj = parsed as Record<string, unknown>

  // v1 → v2: add missing fields with defaults
  if (obj['version'] === 1) {
    try {
      const migrated = migrateV1ToV2(obj)
      const result = EventPlanSchema.safeParse(migrated)
      return result.success ? result.data : null
    } catch {
      return null
    }
  }

  return null
}

function migrateV1ToV2(v1: Record<string, unknown>): unknown {
  return {
    ...v1,
    version: CURRENT_VERSION,
    // v1 had a flat budget; v2 uses categories array
    budget: v1['budget'] ?? {
      categories: [],
      contingencyPct: 5,
    },
    aiPrivacyConsented: false,
    dietaryRequirements: v1['dietary'] ?? '',
    accessibilityNeeds: v1['accessibility'] ?? '',
    updatedAt: v1['updatedAt'] ?? new Date().toISOString(),
  }
}

// ── Export ──────────────────────────────────────────────────

/**
 * Produce a validated, secret-free JSON export blob.
 * Throws if the plan does not pass schema validation.
 * API keys are NEVER stored in EventPlan; this is a safety assertion.
 */
export function exportPlanAsJSON(plan: EventPlan): string {
  const validated = EventPlanSchema.parse(plan)  // throws if invalid
  // Confirmed: EventPlan contains no API keys or secrets by schema design
  return JSON.stringify(validated, null, 2)
}

/** Trigger browser download of the plan JSON */
export function downloadPlanJSON(plan: EventPlan, filename?: string): void {
  const json = exportPlanAsJSON(plan)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename ?? `utsavflow-${plan.name.replace(/\s+/g, '-').toLowerCase()}.json`
  a.click()
  URL.revokeObjectURL(url)
}
