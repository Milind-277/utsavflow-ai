// ═══════════════════════════════════════════════════════════
// backend/src/index.ts — Express application entry point
// Security-hardened: Helmet, CORS, 8KB body limit, proxy trust,
// rate limiting, health checks, safe error boundaries.
// ═══════════════════════════════════════════════════════════

import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { config, isDev } from './config'
import aiRouter from './routes/ai'

const app = express()

// ── Proxy Configuration ──────────────────────────────────────
// Configurable proxy trust prevents IP spoofing in standalone deployments
// while correctly resolving client IPs behind reverse proxies.
if (config.TRUST_PROXY === 'false') {
  app.set('trust proxy', false)
} else if (config.TRUST_PROXY === 'true') {
  app.set('trust proxy', true)
} else {
  const num = parseInt(config.TRUST_PROXY, 10)
  app.set('trust proxy', Number.isFinite(num) ? num : config.TRUST_PROXY)
}

// ── Security Headers ────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:    ["'self'"],
      scriptSrc:     ["'self'"],
      styleSrc:      ["'self'", "'unsafe-inline'"],
      connectSrc:    ["'self'", 'https://generativelanguage.googleapis.com'],
    },
  },
  crossOriginResourcePolicy: { policy: 'same-site' },
}))

// ── CORS ─────────────────────────────────────────────────────
app.use(cors({
  origin: config.CORS_ORIGIN,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: false,
}))

// ── Body Parsing (strict 8 KB limit) ─────────────────────────
app.use(express.json({ limit: '8kb' }))

// ── Rate Limiting ────────────────────────────────────────────
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.NODE_ENV === 'test',
  handler: (_req, res) => {
    res.status(429).json({
      error: 'Too many requests. Please wait a moment before generating more ideas.',
    })
  },
})

// ── Health Check (exposing no secrets) ───────────────────────
const healthHandler: express.RequestHandler = (_req, res) => {
  res.json({ ok: true, status: 'healthy', env: config.NODE_ENV })
}
app.get('/health', healthHandler)
app.get('/api/health', healthHandler)

// ── Routes ───────────────────────────────────────────────────
app.use('/api/ai', aiLimiter, aiRouter)

// ── 404 ──────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found.' })
})

// ── Error Handler ─────────────────────────────────────────────
app.use((err: Error & { status?: number; publicMessage?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err.status ?? 500
  const message = err.publicMessage ?? 'An unexpected error occurred.'
  // Never expose stack traces, keys, or internal details
  const detail = isDev && status !== 500 ? err.message : undefined
  res.status(status).json({ error: message, ...(detail && { detail }) })
})

// ── Start ─────────────────────────────────────────────────────
if (config.NODE_ENV !== 'test') {
  app.listen(config.PORT, () => {
    console.log(`[UtsavFlow] Backend running on http://localhost:${config.PORT}`)
    console.log(`[UtsavFlow] AI mode: ${config.GEMINI_API_KEY ? 'Gemini' : 'Demo (no API key)'}`)
    console.log(`[UtsavFlow] Configured model: ${config.GEMINI_MODEL}`)
  })
}

export default app
