// ═══════════════════════════════════════════════════════════
// backend/src/config.ts — Environment configuration
// Validated at startup via Zod; the app refuses to start if
// required env vars are invalid.
// ═══════════════════════════════════════════════════════════

import * as dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const EnvSchema = z.object({
  GEMINI_API_KEY:  z.string().optional(),
  GEMINI_MODEL:    z.string().default('gemini-3.8-flash'),
  PORT:            z.coerce.number().int().min(1).max(65535).default(3001),
  CORS_ORIGIN:     z.string().url('CORS_ORIGIN must be a valid URL').default('http://localhost:5173'),
  NODE_ENV:        z.enum(['development', 'production', 'test']).default('development'),
  TRUST_PROXY:     z.string().default('loopback'),
})

const parsed = EnvSchema.safeParse(process.env)

if (!parsed.success) {
  const errors = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n')
  console.error(`[UtsavFlow] Invalid environment configuration:\n${errors}`)
  process.exit(1)
}

export const config = parsed.data

export const isDev  = config.NODE_ENV === 'development'
export const isProd = config.NODE_ENV === 'production'
export const isTest = config.NODE_ENV === 'test'

export const hasGeminiKey = Boolean(config.GEMINI_API_KEY?.trim())
