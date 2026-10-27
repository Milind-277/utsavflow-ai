// ═══════════════════════════════════════════════════════════
// Backend unit tests — lib/gemini.ts
// Tests SDK isolation, timeout, bounded retry, JSON/schema parsing,
// and error categorization.
// ═══════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateIdeas } from '../lib/gemini'
import { config } from '../config'
import type { IdeaRequest } from '../lib/validate'

// Mock the GoogleGenAI SDK constructor and generateContent method
const mockGenerateContent = vi.fn()

vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: class MockGoogleGenAI {
      models = {
        generateContent: mockGenerateContent,
      }
    },
  }
})

describe('lib/gemini.ts — generateIdeas unit tests', () => {
  const originalKey = config.GEMINI_API_KEY
  const originalModel = config.GEMINI_MODEL

  const sampleRequest: IdeaRequest = {
    eventType: 'wedding',
    city: 'Jaipur',
    season: 'Winter (December)',
    guestCount: 150,
    budgetBand: '₹15 Lakhs - ₹50 Lakhs (Premium)',
    theme: 'Heritage Royal',
    dietary: 'Vegetarian',
    accessibility: 'Elderly seating',
  }

  const validIdeasJson = JSON.stringify([
    {
      title: 'Heritage Courtyard Sangeet with Folk Dancers',
      category: 'entertainment',
      rationale: 'Engages guests with authentic Rajasthani folk artists while keeping sound controlled.',
      steps: [
        'Contact vetted folk artist guilds in Jaipur',
        'Arrange acoustic sound setup and raised wooden platform',
        'Coordinate evening lighting with heritage lamps',
      ],
      estimatedCostMin: 40_000,
      estimatedCostMax: 75_000,
      fitReason: 'Suits a heritage wedding in Jaipur perfectly.',
    },
    {
      title: 'Traditional Clay Kulhad Chai Welcome Bar',
      category: 'menu',
      rationale: 'Cost-effective, highly Instagrammable and warmly hospitable welcome element.',
      steps: [
        'Source handmade terracotta kulhads from local potters',
        'Provide masala chai and ginger tea options with traditional cookies',
        'Set up a rustic wooden cart stall at the entrance',
      ],
      estimatedCostMin: 8_000,
      estimatedCostMax: 15_000,
      fitReason: 'Delightful low-cost festive touch.',
    },
  ])

  beforeEach(() => {
    config.GEMINI_API_KEY = 'valid-test-key'
    config.GEMINI_MODEL = 'gemini-3.8-flash'
    mockGenerateContent.mockReset()
  })

  afterEach(() => {
    config.GEMINI_API_KEY = originalKey
    config.GEMINI_MODEL = originalModel
  })

  it('returns auth-error immediately when GEMINI_API_KEY is not set', async () => {
    config.GEMINI_API_KEY = ''
    const result = await generateIdeas(sampleRequest)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('auth-error')
    }
    expect(mockGenerateContent).not.toHaveBeenCalled()
  })

  it('successfully parses valid JSON output and returns validated ideas with IDs', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: `\`\`\`json\n${validIdeasJson}\n\`\`\``,
    })

    const result = await generateIdeas(sampleRequest)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.ideas).toHaveLength(2)
      expect(result.ideas[0].title).toBe('Heritage Courtyard Sangeet with Folk Dancers')
      expect(result.ideas[0].id).toBeTruthy()
      expect(result.ideas[0].practicalSteps).toHaveLength(3)
      expect(result.ideas[0].estimatedCostMin).toBeLessThanOrEqual(result.ideas[0].estimatedCostMax)
    }
  })

  it('parses valid JSON embedded inside conversational preamble and postamble', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: `Certainly! Here are some ideas for your event:\n\`\`\`json\n${validIdeasJson}\n\`\`\`\nHope this helps you plan!`,
    })

    const result = await generateIdeas(sampleRequest)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.ideas).toHaveLength(2)
      expect(result.ideas[0].title).toBe('Heritage Courtyard Sangeet with Folk Dancers')
    }
  })

  it('returns rate-limited immediately when provider returns status 429 without retrying', async () => {
    const error429 = new Error('Resource exhausted') as Error & { status: number; headers: Record<string, string> }
    error429.status = 429
    error429.headers = { 'retry-after': '30' }
    mockGenerateContent.mockRejectedValue(error429)

    const result = await generateIdeas(sampleRequest)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('rate-limited')
      expect((result as any).retryAfterSecs).toBe(30)
    }
    // Should NOT retry 429
    expect(mockGenerateContent).toHaveBeenCalledTimes(1)
  })

  it('returns auth-error immediately when provider returns 401/403 without retrying', async () => {
    const error401 = new Error('Invalid API key') as Error & { status: number }
    error401.status = 401
    mockGenerateContent.mockRejectedValue(error401)

    const result = await generateIdeas(sampleRequest)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('auth-error')
    }
    expect(mockGenerateContent).toHaveBeenCalledTimes(1)
  })

  it('returns invalid-output immediately when output is not valid JSON without retrying', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: 'Sorry, I cannot help with that.',
    })

    const result = await generateIdeas(sampleRequest)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('invalid-output')
    }
    expect(mockGenerateContent).toHaveBeenCalledTimes(1)
  })

  it('returns invalid-output immediately when output violates Zod schema (e.g. minCost > maxCost)', async () => {
    const invalidSchemaJson = JSON.stringify([
      {
        title: 'Broken Cost Idea',
        category: 'decor',
        rationale: 'Cost min is greater than max which breaks schema.',
        steps: ['Step 1'],
        estimatedCostMin: 100_000,
        estimatedCostMax: 50_000, // Invalid: max < min
        fitReason: 'Fits nicely.',
      },
    ])

    mockGenerateContent.mockResolvedValueOnce({
      text: invalidSchemaJson,
    })

    const result = await generateIdeas(sampleRequest)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('invalid-output')
    }
    expect(mockGenerateContent).toHaveBeenCalledTimes(1)
  })

  it('retries transient 5xx errors up to 2 times (3 total attempts)', async () => {
    const error503 = new Error('Service Unavailable') as Error & { status: number }
    error503.status = 503
    mockGenerateContent.mockRejectedValue(error503)

    const result = await generateIdeas(sampleRequest)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('transient')
    }
    // Initial attempt + 2 retries = 3 attempts total
    expect(mockGenerateContent).toHaveBeenCalledTimes(3)
  }, 10_000)

  it('uses GEMINI_MODEL from config and does not hardcode model identifier', async () => {
    config.GEMINI_MODEL = 'custom-gemini-model-override'

    mockGenerateContent.mockResolvedValueOnce({
      text: validIdeasJson,
    })

    await generateIdeas(sampleRequest)

    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'custom-gemini-model-override',
      })
    )
  })
})
