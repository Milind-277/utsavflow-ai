// ═══════════════════════════════════════════════════════════
// Backend route tests — POST /api/ai/ideas & GET /health
// Uses Supertest + Vitest. Mocks the Gemini service at the
// lib/gemini.ts boundary (the only external dependency).
// ═══════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import app from '../index'
import { config } from '../config'
import { deriveBudgetBand, deriveSeason } from '../lib/validate'
import type { IdeaItem } from '../lib/validate'

// ── Mock Gemini at the module boundary ─────────────────────
vi.mock('../lib/gemini', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/gemini')>()
  return {
    ...actual,
    generateIdeas: vi.fn(),
  }
})

const { generateIdeas, buildUserPrompt } = await import('../lib/gemini')
const generateIdeasMock = vi.mocked(generateIdeas)

// ── Valid request fixtures ──────────────────────────────────

const validLegacyBody = {
  eventType: 'wedding',
  eventName: 'Test Wedding',
  city: 'Mumbai',
  date: '2025-06-15',
  guestCount: 100,
  budgetTotal: 1_000_000,
  theme: 'Floral',
  dietary: 'Vegetarian',
  accessibility: 'Wheelchair access',
}

const validMinimizedBody = {
  eventType: 'birthday',
  city: 'Bengaluru',
  season: 'Monsoon (July)',
  guestCount: 50,
  budgetBand: '₹1 Lakh - ₹5 Lakhs (Pocket-friendly)',
  theme: 'Tropical Jungle',
  dietary: 'Pure Vegetarian',
  accessibility: 'Ramp required',
}

const sampleGeminiIdea: IdeaItem = {
  id: 'idea-12345',
  title: 'Boutique Marigold Mandap with Brass Accents',
  category: 'decor',
  rationale: 'Creates an authentic, high-impact cultural stage with sustainable floral decor.',
  steps: [
    'Partner with local flower market decorators',
    'Procure reusable brass oil lamps for the walkway',
    'Set up ambient warm spotlighting',
  ],
  practicalSteps: [
    'Partner with local flower market decorators',
    'Procure reusable brass oil lamps for the walkway',
    'Set up ambient warm spotlighting',
  ],
  estimatedCostMin: 45_000,
  estimatedCostMax: 85_000,
  fitReason: 'Perfect fit for mid-range festive aesthetic in Mumbai.',
}

describe('POST /api/ai/ideas — Demo mode (no API key configured)', () => {
  const originalKey = config.GEMINI_API_KEY

  beforeEach(() => {
    config.GEMINI_API_KEY = ''
    generateIdeasMock.mockReset()
  })

  afterEach(() => {
    config.GEMINI_API_KEY = originalKey
  })

  it('returns 200 with demo ideas when no API key is configured', async () => {
    const res = await request(app)
      .post('/api/ai/ideas')
      .send(validLegacyBody)
      .set('Content-Type', 'application/json')

    expect(res.status).toBe(200)
    expect(res.body.source).toBe('demo')
    expect(Array.isArray(res.body.ideas)).toBe(true)
    expect(res.body.ideas.length).toBeGreaterThan(0)
    expect(res.body.disclaimer).toBeTruthy()
    expect(generateIdeasMock).not.toHaveBeenCalled()
  })

  it('works with privacy-minimized payload (no eventName, date, or budgetTotal)', async () => {
    const res = await request(app)
      .post('/api/ai/ideas')
      .send(validMinimizedBody)
      .set('Content-Type', 'application/json')

    expect(res.status).toBe(200)
    expect(res.body.source).toBe('demo')
    expect(Array.isArray(res.body.ideas)).toBe(true)
    expect(res.body.ideas.length).toBeGreaterThan(0)
    // Check schema compliance of returned ideas
    for (const idea of res.body.ideas) {
      expect(idea.estimatedCostMin).toBeLessThanOrEqual(idea.estimatedCostMax)
      expect(idea.estimatedCostMin).toBeGreaterThanOrEqual(0)
      expect(idea.title).toBeTruthy()
      expect(idea.category).toBeTruthy()
    }
  })
})

describe('POST /api/ai/ideas — Request validation', () => {
  it('returns 400 for missing required eventType', async () => {
    const { eventType: _, ...noType } = validLegacyBody
    void _
    const res = await request(app).post('/api/ai/ideas').send(noType)
    expect(res.status).toBe(400)
    expect(res.body.error).toBeTruthy()
  })

  it('returns 400 for missing required city', async () => {
    const { city: _, ...noCity } = validLegacyBody
    void _
    const res = await request(app).post('/api/ai/ideas').send(noCity)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid eventType', async () => {
    const res = await request(app)
      .post('/api/ai/ideas')
      .send({ ...validLegacyBody, eventType: 'festival-rave' })
    expect(res.status).toBe(400)
  })

  it('returns 400 for negative guestCount', async () => {
    const res = await request(app)
      .post('/api/ai/ideas')
      .send({ ...validLegacyBody, guestCount: -5 })
    expect(res.status).toBe(400)
  })

  it('returns 400 for guestCount of 0', async () => {
    const res = await request(app)
      .post('/api/ai/ideas')
      .send({ ...validLegacyBody, guestCount: 0 })
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid date format when date is supplied', async () => {
    const res = await request(app)
      .post('/api/ai/ideas')
      .send({ ...validLegacyBody, date: '15-06-2025' })
    expect(res.status).toBe(400)
  })

  it('returns 413 or 400 for oversized payload (> 8KB)', async () => {
    const res = await request(app)
      .post('/api/ai/ideas')
      .send({ ...validLegacyBody, theme: 'x'.repeat(20_000) })
    expect([400, 413]).toContain(res.status)
  })

  it('returns 400 when theme exceeds max 300 characters', async () => {
    const res = await request(app)
      .post('/api/ai/ideas')
      .send({ ...validLegacyBody, theme: 'x'.repeat(301) })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/ai/ideas — Gemini provider routing (with mocked API key)', () => {
  const originalKey = config.GEMINI_API_KEY

  beforeEach(() => {
    config.GEMINI_API_KEY = 'test-gemini-key'
    generateIdeasMock.mockReset()
  })

  afterEach(() => {
    config.GEMINI_API_KEY = originalKey
  })

  it('returns 200 with source=gemini when provider succeeds', async () => {
    generateIdeasMock.mockResolvedValueOnce({
      ok: true,
      ideas: [sampleGeminiIdea],
    })

    const res = await request(app)
      .post('/api/ai/ideas')
      .send(validMinimizedBody)

    expect(res.status).toBe(200)
    expect(res.body.source).toBe('gemini')
    expect(res.body.ideas).toHaveLength(1)
    expect(res.body.ideas[0].title).toBe(sampleGeminiIdea.title)
    expect(res.body.ideas[0].estimatedCostMin).toBeLessThanOrEqual(res.body.ideas[0].estimatedCostMax)
    expect(generateIdeasMock).toHaveBeenCalledTimes(1)
  })

  it('returns 503 with Retry-After header when provider is rate-limited (429)', async () => {
    generateIdeasMock.mockResolvedValueOnce({
      ok: false,
      reason: 'rate-limited',
      retryAfterSecs: 45,
    })

    const res = await request(app)
      .post('/api/ai/ideas')
      .send(validMinimizedBody)

    expect(res.status).toBe(503)
    expect(res.headers['retry-after']).toBe('45')
    expect(res.body.error).toContain('rate-limited')
  })

  it('returns 502 without leaking secrets when provider returns authentication error', async () => {
    generateIdeasMock.mockResolvedValueOnce({
      ok: false,
      reason: 'auth-error',
    })

    const res = await request(app)
      .post('/api/ai/ideas')
      .send(validMinimizedBody)

    expect(res.status).toBe(502)
    expect(res.body.error).toContain('AI service configuration error')
    // Ensure no secrets or API key leaked in response
    const bodyStr = JSON.stringify(res.body)
    expect(bodyStr).not.toContain('test-gemini-key')
    expect(bodyStr).not.toContain('stack')
  })

  it('falls back to demo ideas when provider output fails schema validation', async () => {
    generateIdeasMock.mockResolvedValueOnce({
      ok: false,
      reason: 'invalid-output',
    })

    const res = await request(app)
      .post('/api/ai/ideas')
      .send(validMinimizedBody)

    expect(res.status).toBe(200)
    expect(res.body.source).toBe('demo')
    expect(res.body.ideas.length).toBeGreaterThan(0)
    expect(res.body.source).not.toBe('gemini')
  })

  it('falls back to demo ideas on transient network / 5xx error after retries', async () => {
    generateIdeasMock.mockResolvedValueOnce({
      ok: false,
      reason: 'transient',
      status: 503,
    })

    const res = await request(app)
      .post('/api/ai/ideas')
      .send(validMinimizedBody)

    expect(res.status).toBe(200)
    expect(res.body.source).toBe('demo')
    expect(res.body.ideas.length).toBeGreaterThan(0)
  })
})

describe('POST /api/ai/ideas — Idempotency check', () => {
  it('rejects duplicate idempotency key within TTL with 429', async () => {
    const key = `idem-key-${Date.now()}-${Math.random()}`
    const res1 = await request(app)
      .post('/api/ai/ideas')
      .send({ ...validLegacyBody, idempotencyKey: key })
    expect(res1.status).toBe(200)

    const res2 = await request(app)
      .post('/api/ai/ideas')
      .send({ ...validLegacyBody, idempotencyKey: key })
    expect(res2.status).toBe(429)
    expect(res2.body.error).toContain('Duplicate request detected')
  })
})

describe('Health & Security Endpoints', () => {
  it('GET /health returns 200 with status=healthy and no secrets', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.status).toBe('healthy')
    expect(res.body.env).toBe('test')
    const bodyStr = JSON.stringify(res.body)
    expect(bodyStr).not.toContain('GEMINI')
    expect(bodyStr).not.toContain('key')
  })

  it('GET /api/health returns 200 with status=healthy and no secrets', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.status).toBe('healthy')
  })

  it('GET /api/unknown returns 404', async () => {
    const res = await request(app).get('/api/unknown')
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Not found.')
  })
})

describe('Privacy & Data Minimization Verification', () => {
  it('deriveBudgetBand maps raw INR totals to broad tiers', () => {
    expect(deriveBudgetBand(50_000)).toContain('Under ₹1 Lakh')
    expect(deriveBudgetBand(250_000)).toContain('₹1 Lakh - ₹5 Lakhs')
    expect(deriveBudgetBand(1_000_000)).toContain('₹5 Lakhs - ₹15 Lakhs')
    expect(deriveBudgetBand(3_500_000)).toContain('₹15 Lakhs - ₹50 Lakhs')
    expect(deriveBudgetBand(7_500_000)).toContain('₹50 Lakhs+')
    expect(deriveBudgetBand(undefined)).toContain('Flexible')
  })

  it('deriveSeason maps ISO dates to month/season without exact date', () => {
    expect(deriveSeason('2025-12-25')).toContain('Winter (December)')
    expect(deriveSeason('2025-07-15')).toContain('Monsoon (July)')
    expect(deriveSeason('2025-04-10')).toContain('Summer/Spring (April)')
    expect(deriveSeason('2025-10-05')).toContain('Autumn/Post-Monsoon (October)')
    expect(deriveSeason(undefined)).toBe('Flexible season')
  })

  it('buildUserPrompt NEVER includes event name, exact date, or exact budget', () => {
    const req = {
      eventType: 'wedding' as const,
      eventName: 'TopSecret Confidential Wedding',
      city: 'Udaipur',
      date: '2025-11-20',
      guestCount: 250,
      budgetTotal: 4_500_000,
      theme: 'Royal Rajasthani',
      dietary: 'Strict Jain',
      accessibility: 'Wheelchair ramp',
    }

    const prompt = buildUserPrompt(req)

    // MUST NOT contain sensitive details
    expect(prompt).not.toContain('TopSecret Confidential Wedding')
    expect(prompt).not.toContain('2025-11-20')
    expect(prompt).not.toContain('4500000')
    expect(prompt).not.toContain('4,500,000')

    // MUST contain sanitized broad parameters
    expect(prompt).toContain('wedding')
    expect(prompt).toContain('Udaipur')
    expect(prompt).toContain('Royal Rajasthani')
    expect(prompt).toContain('Strict Jain')
    expect(prompt).toContain('Wheelchair ramp')
  })
})
