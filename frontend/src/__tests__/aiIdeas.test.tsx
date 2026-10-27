import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AIIdeasTab } from '../components/AIIdeasTab'
import { deriveClientBudgetBand, deriveClientSeason } from '../lib/aiPrivacy'
import { createDemoPlan } from '../lib/demoData'
import type { EventPlan } from '../types'

describe('AI Privacy Minimization Helpers', () => {
  it('deriveClientBudgetBand maps raw numbers to broad categories', () => {
    expect(deriveClientBudgetBand(75_000)).toContain('Under ₹1 Lakh')
    expect(deriveClientBudgetBand(300_000)).toContain('₹1 Lakh - ₹5 Lakhs')
    expect(deriveClientBudgetBand(1_200_000)).toContain('₹5 Lakhs - ₹15 Lakhs')
    expect(deriveClientBudgetBand(4_000_000)).toContain('₹15 Lakhs - ₹50 Lakhs')
    expect(deriveClientBudgetBand(10_000_000)).toContain('₹50 Lakhs+')
    expect(deriveClientBudgetBand(undefined)).toContain('Flexible')
  })

  it('deriveClientSeason extracts season and month without transmitting exact day', () => {
    expect(deriveClientSeason('2026-12-15')).toContain('Winter (December)')
    expect(deriveClientSeason('2026-07-20')).toContain('Monsoon (July)')
    expect(deriveClientSeason('2026-04-05')).toContain('Summer/Spring (April)')
    expect(deriveClientSeason('2026-10-18')).toContain('Autumn/Post-Monsoon (October)')
    expect(deriveClientSeason(undefined)).toBe('Flexible timing')
  })
})

describe('AIIdeasTab Component — Consent Gate & Privacy Rules', () => {
  let mockPlan: EventPlan

  beforeEach(() => {
    mockPlan = {
      ...createDemoPlan(),
      name: 'SuperSecret Royal Wedding',
      budgetTotal: 2_500_000,
      date: '2026-11-28',
      aiPrivacyConsented: false,
    }
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('renders privacy disclosure card when consent is not yet granted', () => {
    render(<AIIdeasTab plan={mockPlan} />)

    expect(screen.getByRole('heading', { name: /ai celebration ideas assistant/i })).toBeInTheDocument()
    expect(screen.getByText(/transmitted to google gemini/i)).toBeInTheDocument()
    expect(screen.getByText(/kept strictly browser-local/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /i agree & grant consent/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /explore offline demo ideas instead/i })).toBeInTheDocument()
  })

  it('never makes an HTTP request before consent is granted', () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
    render(<AIIdeasTab plan={mockPlan} />)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('allows exploring offline demo ideas without granting consent and without network calls', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
    render(<AIIdeasTab plan={mockPlan} />)

    const demoBtn = screen.getByRole('button', { name: /explore offline demo ideas instead/i })
    fireEvent.click(demoBtn)

    await waitFor(() => {
      expect(screen.getByText(/curated inspiration \(offline demo\)/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/boutique marigold & jasmine floral mandap/i)).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('grants consent and persists it via onUpdatePlan callback', () => {
    const handleUpdatePlan = vi.fn()
    render(<AIIdeasTab plan={mockPlan} onUpdatePlan={handleUpdatePlan} />)

    const consentBtn = screen.getByRole('button', { name: /i agree & grant consent/i })
    fireEvent.click(consentBtn)

    expect(handleUpdatePlan).toHaveBeenCalledWith(
      expect.objectContaining({
        aiPrivacyConsented: true,
      })
    )
    expect(screen.getByText(/consent granted/i)).toBeInTheDocument()
    const generateBtns = screen.getAllByRole('button', { name: /generate ai ideas/i })
    expect(generateBtns.length).toBeGreaterThan(0)
  })

  it('allows revoking consent easily from privacy settings', () => {
    const handleUpdatePlan = vi.fn()
    const consentedPlan: EventPlan = { ...mockPlan, aiPrivacyConsented: true }
    render(<AIIdeasTab plan={consentedPlan} onUpdatePlan={handleUpdatePlan} />)

    // Open privacy settings
    fireEvent.click(screen.getByRole('button', { name: /privacy settings/i }))

    // Click revoke consent
    const revokeBtn = screen.getByRole('button', { name: /revoke consent/i })
    fireEvent.click(revokeBtn)

    expect(handleUpdatePlan).toHaveBeenCalledWith(
      expect.objectContaining({
        aiPrivacyConsented: false,
      })
    )
    expect(screen.getByRole('button', { name: /i agree & grant consent/i })).toBeInTheDocument()
  })
})

describe('AIIdeasTab Component — End-to-End API Mapping & Safety', () => {
  let mockPlan: EventPlan

  beforeEach(() => {
    mockPlan = {
      ...createDemoPlan(),
      name: 'Confidential Wedding Name',
      date: '2026-12-25',
      budgetTotal: 1_200_000,
      aiPrivacyConsented: true,
    }
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('maps request body strictly to approved minimal context, excluding sensitive data', async () => {
    let capturedBody: Record<string, unknown> | null = null

    vi.spyOn(global, 'fetch').mockImplementationOnce(async (_url, init) => {
      if (init && init.body) {
        capturedBody = JSON.parse(init.body as string)
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ideas: [
            {
              id: 'idea-1',
              title: 'Eco Floral Stage',
              category: 'decor',
              rationale: 'Sustainable styling.',
              steps: ['Step 1'],
              estimatedCostMin: 10_000,
              estimatedCostMax: 20_000,
              fitReason: 'Great fit.',
            },
          ],
          source: 'gemini',
        }),
      } as Response
    })

    render(<AIIdeasTab plan={mockPlan} />)
    const generateBtn = screen.getAllByRole('button', { name: /generate ai ideas/i })[0]
    fireEvent.click(generateBtn)

    await waitFor(() => {
      expect(capturedBody).not.toBeNull()
    })

    // Confirm transmitted fields
    expect(capturedBody).toMatchObject({
      eventType: mockPlan.type,
      city: mockPlan.city,
      season: expect.stringContaining('Winter'),
      budgetBand: expect.stringContaining('₹5 Lakhs - ₹15 Lakhs'),
      guestCount: mockPlan.guestCount,
    })

    // Confirm excluded fields
    const serialized = JSON.stringify(capturedBody)
    expect(serialized).not.toContain('Confidential Wedding Name')
    expect(serialized).not.toContain('2026-12-25')
    expect(serialized).not.toContain('1200000')
    expect(serialized).not.toContain('vendors')
    expect(serialized).not.toContain('timeline')
    expect(serialized).not.toContain('amountPaid')
  })

  it('renders validated Gemini ideas with unambiguous AI attribution and disclaimer', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ideas: [
          {
            id: 'gemini-real-1',
            title: 'Heritage Courtyard Sangeet with Brass Lamps',
            category: 'entertainment',
            rationale: 'Creates an authentic acoustic setting with live sitar.',
            steps: ['Book classical artists', 'Arrange floor seating'],
            estimatedCostMin: 35_000,
            estimatedCostMax: 65_000,
            fitReason: 'Tailored for festive celebrations.',
          },
        ],
        source: 'gemini',
        disclaimer: 'These suggestions are generated by AI. All costs are rough estimates.',
      }),
    } as Response)

    render(<AIIdeasTab plan={mockPlan} />)
    const generateBtn = screen.getAllByRole('button', { name: /generate ai ideas/i })[0]
    fireEvent.click(generateBtn)

    await waitFor(() => {
      expect(screen.getByText(/heritage courtyard sangeet with brass lamps/i)).toBeInTheDocument()
    })

    expect(screen.getByText(/✨ ai generated \(google gemini\)/i)).toBeInTheDocument()
    expect(screen.getByText(/₹35,000 – ₹65,000/i)).toBeInTheDocument()
    expect(screen.getByText(/these suggestions are generated by ai/i)).toBeInTheDocument()
  })

  it('renders hostile HTML strings safely as plain text without execution', async () => {
    const maliciousScript = '<script>alert("xss")</script>'
    const maliciousImage = '<img src="x" onerror="window.pwned=true">'

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ideas: [
          {
            id: 'hostile-idea-1',
            title: maliciousScript,
            category: 'decor',
            rationale: maliciousImage,
            steps: [maliciousScript],
            estimatedCostMin: 1_000,
            estimatedCostMax: 2_000,
            fitReason: 'Testing XSS sanitization.',
          },
        ],
        source: 'gemini',
      }),
    } as Response)

    render(<AIIdeasTab plan={mockPlan} />)
    const generateBtn = screen.getAllByRole('button', { name: /generate ai ideas/i })[0]
    fireEvent.click(generateBtn)

    await waitFor(() => {
      expect(screen.getAllByText(maliciousScript).length).toBeGreaterThan(0)
    })

    // Ensure elements are text nodes and NOT executed as DOM elements
    expect(document.querySelector('script[src]')).toBeNull()
    expect((window as unknown as { pwned?: boolean }).pwned).toBeUndefined()
  })

  it('disables the generate button during loading and prevents duplicate requests', async () => {
    let resolveFetch: (val: Response) => void
    const pendingPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve
    })

    const fetchSpy = vi.spyOn(global, 'fetch').mockReturnValueOnce(pendingPromise)

    render(<AIIdeasTab plan={mockPlan} />)
    const generateBtn = screen.getAllByRole('button', { name: /generate ai ideas/i })[0]

    // First click
    fireEvent.click(generateBtn)

    // Button should be disabled during flight
    expect(generateBtn).toBeDisabled()
    expect(generateBtn).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('status')).toBeInTheDocument()

    // Second click while loading should be ignored
    fireEvent.click(generateBtn)
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    // Resolve the promise
    resolveFetch!({
      ok: true,
      status: 200,
      json: async () => ({
        ideas: [
          {
            id: 'id-1',
            title: 'Sample Idea',
            category: 'theme',
            rationale: 'Rationale',
            steps: ['Step 1'],
            estimatedCostMin: 100,
            estimatedCostMax: 200,
            fitReason: 'Fit',
          },
        ],
        source: 'gemini',
      }),
    } as Response)

    await waitFor(() => {
      expect(generateBtn).not.toBeDisabled()
    })
  })

  it('handles invalid response shapes defensively by falling back to verified demo ideas', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        corrupted: true, // Missing ideas array and source
      }),
    } as Response)

    render(<AIIdeasTab plan={mockPlan} />)
    const generateBtn = screen.getAllByRole('button', { name: /generate ai ideas/i })[0]
    fireEvent.click(generateBtn)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    expect(screen.getByText(/invalid response format/i)).toBeInTheDocument()
    expect(screen.getByText(/curated inspiration \(offline demo\)/i)).toBeInTheDocument()
  })

  it('handles HTTP 400 validation error gracefully', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 400,
    } as Response)

    render(<AIIdeasTab plan={mockPlan} />)
    const generateBtn = screen.getAllByRole('button', { name: /generate ai ideas/i })[0]
    fireEvent.click(generateBtn)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    expect(screen.getByText(/invalid request parameters/i)).toBeInTheDocument()
  })

  it('handles HTTP 429/503 rate-limiting with Retry-After and explicit demo fallback', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: new Headers({ 'Retry-After': '90' }),
    } as Response)

    render(<AIIdeasTab plan={mockPlan} />)
    const generateBtn = screen.getAllByRole('button', { name: /generate ai ideas/i })[0]
    fireEvent.click(generateBtn)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    expect(screen.getByText(/temporarily rate-limited/i)).toBeInTheDocument()
    expect(screen.getByText(/90 seconds/i)).toBeInTheDocument()

    // Switch to demo button
    const switchDemoBtn = screen.getByRole('button', { name: /switch to demo/i })
    fireEvent.click(switchDemoBtn)

    await waitFor(() => {
      expect(screen.getByText(/curated inspiration \(offline demo\)/i)).toBeInTheDocument()
    })
  })

  it('handles HTTP 500 server errors by alerting and falling back to demo ideas', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response)

    render(<AIIdeasTab plan={mockPlan} />)
    const generateBtn = screen.getAllByRole('button', { name: /generate ai ideas/i })[0]
    fireEvent.click(generateBtn)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    expect(screen.getByText(/server error/i)).toBeInTheDocument()
    expect(screen.getByText(/curated inspiration \(offline demo\)/i)).toBeInTheDocument()
  })

  it('handles network fetch failures with a polite offline fallback announcement', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Failed to fetch'))

    render(<AIIdeasTab plan={mockPlan} />)
    const generateBtn = screen.getAllByRole('button', { name: /generate ai ideas/i })[0]
    fireEvent.click(generateBtn)

    await waitFor(() => {
      expect(screen.getByText(/backend service unreachable/i)).toBeInTheDocument()
    })

    expect(screen.getByText(/curated inspiration \(offline demo\)/i)).toBeInTheDocument()
  })
})
