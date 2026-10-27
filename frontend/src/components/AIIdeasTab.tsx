import React, { useState } from 'react'
import { z } from 'zod'
import { IdeaItemSchema } from '@/types'
import type { EventPlan, IdeaItem, IdeasSource } from '@/types'
import { formatINR } from '@/lib/currency'
import { deriveClientBudgetBand, deriveClientSeason } from '@/lib/aiPrivacy'

interface AIIdeasTabProps {
  plan: EventPlan
  onUpdatePlan?: (updatedPlan: EventPlan) => void
}

// ── Client-side Defensive Response Validation ─────────────────

const ClientIdeasResponseSchema = z.object({
  ideas: z.array(IdeaItemSchema).min(1),
  source: z.enum(['gemini', 'demo']),
  disclaimer: z.string().optional(),
})

// Client-side fallback suggestions if backend server is offline
const CLIENT_FALLBACK_IDEAS: Record<string, IdeaItem[]> = {
  wedding: [
    {
      id: 'fb-w-1',
      title: 'Boutique Marigold & Jasmine Floral Mandap',
      category: 'theme',
      rationale: 'Combines traditional fragrant blossoms with minimalist brass elements for an elegant, photogenic stage.',
      steps: [
        'Shortlist local florists specialising in marigold and jasmine arches',
        'Incorporate brass floor urlis with floating candles along the aisle',
        'Coordinate palette with bridal attire',
      ],
      practicalSteps: [
        'Shortlist local florists specialising in marigold and jasmine arches',
        'Incorporate brass floor urlis with floating candles along the aisle',
        'Coordinate palette with bridal attire',
      ],
      estimatedCostMin: 40_000,
      estimatedCostMax: 90_000,
      fitReason: 'Timeless cultural resonance suited for intimate and mid-range weddings.',
    },
    {
      id: 'fb-w-2',
      title: 'Live Classical Sarangi & Flute Ensemble',
      category: 'entertainment',
      rationale: 'Elevates ceremonial atmosphere without overpowering conversations or requiring heavy amplification.',
      steps: [
        'Inquire with local classical music academies',
        'Review ceremony sequence to match ragas with rituals',
        'Set up a low acoustic seating stage',
      ],
      practicalSteps: [
        'Inquire with local classical music academies',
        'Review ceremony sequence to match ragas with rituals',
        'Set up a low acoustic seating stage',
      ],
      estimatedCostMin: 25_000,
      estimatedCostMax: 55_000,
      fitReason: 'Intimate, sophisticated cultural entertainment.',
    },
    {
      id: 'fb-w-3',
      title: 'Curated Thali-Style Dining Experience',
      category: 'menu',
      rationale: 'Controls per-head catering costs and food waste compared to expansive buffets while offering regional hospitality.',
      steps: [
        'Finalize 4-course regional specialty menu with caterer',
        'Ensure dedicated Jain and vegan options per course',
        'Set up a live sweet counter for hot jalebis or gulab jamuns',
      ],
      practicalSteps: [
        'Finalize 4-course regional specialty menu with caterer',
        'Ensure dedicated Jain and vegan options per course',
        'Set up a live sweet counter for hot jalebis or gulab jamuns',
      ],
      estimatedCostMin: 700,
      estimatedCostMax: 1_400,
      fitReason: 'Manageable per-head cost and authentic banquet experience.',
    },
  ],
  birthday: [
    {
      id: 'fb-b-1',
      title: 'Botanical & Terracotta Garden Party Décor',
      category: 'theme',
      rationale: 'Eco-friendly party setup using potted monstera and terracotta accents that guests can take home.',
      steps: [
        'Rent potted foliage from local nurseries',
        'Use warm fairy lighting and woven jute table runners',
        'Set up an instant polaroid photo wall',
      ],
      practicalSteps: [
        'Rent potted foliage from local nurseries',
        'Use warm fairy lighting and woven jute table runners',
        'Set up an instant polaroid photo wall',
      ],
      estimatedCostMin: 15_000,
      estimatedCostMax: 35_000,
      fitReason: 'Vibrant, sustainable, and budget-conscious styling.',
    },
  ],
  community: [
    {
      id: 'fb-c-1',
      title: 'Community Open Stage & Talent Showcase',
      category: 'entertainment',
      rationale: 'Involves local neighborhood talents, fosters community pride, and eliminates costly commercial performers.',
      steps: [
        'Announce registration form 4 weeks prior to celebration',
        'Schedule 5-minute performance slots with a volunteer emcee',
        'Award token certificates or eco-trophies to participants',
      ],
      practicalSteps: [
        'Announce registration form 4 weeks prior to celebration',
        'Schedule 5-minute performance slots with a volunteer emcee',
        'Award token certificates or eco-trophies to participants',
      ],
      estimatedCostMin: 5_000,
      estimatedCostMax: 15_000,
      fitReason: 'High community participation and engagement at minimal cost.',
    },
  ],
}

export function AIIdeasTab({ plan, onUpdatePlan }: AIIdeasTabProps): React.JSX.Element {
  // Local consent tracking (synced with plan.aiPrivacyConsented)
  const [hasConsent, setHasConsent] = useState<boolean>(() => {
    if (plan.aiPrivacyConsented) return true
    try {
      return localStorage.getItem(`utsavflow_ai_consent_${plan.id}`) === 'true'
    } catch {
      return false
    }
  })

  const [ideas, setIdeas] = useState<IdeaItem[]>([])
  const [source, setSource] = useState<IdeasSource | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [disclaimer, setDisclaimer] = useState<string | null>(null)
  const [showConsentDetails, setShowConsentDetails] = useState(false)

  const derivedSeason = deriveClientSeason(plan.date)
  const derivedBudgetBand = deriveClientBudgetBand(plan.budgetTotal)

  const handleGrantConsent = () => {
    setHasConsent(true)
    try {
      localStorage.setItem(`utsavflow_ai_consent_${plan.id}`, 'true')
    } catch {
      // LocalStorage fallback
    }
    if (onUpdatePlan) {
      onUpdatePlan({
        ...plan,
        aiPrivacyConsented: true,
        updatedAt: new Date().toISOString(),
      })
    }
  }

  const handleRevokeConsent = () => {
    setHasConsent(false)
    setIdeas([])
    setSource(null)
    setErrorMessage(null)
    try {
      localStorage.removeItem(`utsavflow_ai_consent_${plan.id}`)
    } catch {
      // LocalStorage fallback
    }
    if (onUpdatePlan) {
      onUpdatePlan({
        ...plan,
        aiPrivacyConsented: false,
        updatedAt: new Date().toISOString(),
      })
    }
  }

  const fetchIdeas = async (forceDemo = false) => {
    if (loading) return // Prevent accidental duplicate in-flight requests

    setLoading(true)
    setErrorMessage(null)

    // Build strictly privacy-minimized payload
    const payload = {
      eventType: plan.type,
      city: plan.city,
      season: derivedSeason,
      guestCount: plan.guestCount,
      budgetBand: derivedBudgetBand,
      ...(plan.theme?.trim() ? { theme: plan.theme.trim() } : {}),
      ...(plan.dietaryRequirements?.trim() ? { dietary: plan.dietaryRequirements.trim() } : {}),
      ...(plan.accessibilityNeeds?.trim() ? { accessibility: plan.accessibilityNeeds.trim() } : {}),
      idempotencyKey: `utsav-${plan.id}-${Date.now()}`,
    }

    try {
      // If user chose demo mode without consent, or if requested
      if (forceDemo) {
        const fallback = CLIENT_FALLBACK_IDEAS[plan.type] || CLIENT_FALLBACK_IDEAS.wedding
        setIdeas(fallback)
        setSource('demo')
        setDisclaimer('Curated offline demo inspiration. All costs are rough estimates — verify with vendors.')
        setLoading(false)
        return
      }

      // Configurable endpoint via Vite dev proxy (/api) or optional env override
      const apiBaseUrl = ((import.meta.env.VITE_API_BASE_URL as string | undefined) || '').replace(/\/+$/, '')
      const endpoint = `${apiBaseUrl}/api/ai/ideas`

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (response.status === 400) {
        setErrorMessage('Invalid request parameters. Please check your event details and try again.')
        setLoading(false)
        return
      }

      if (response.status === 429 || response.status === 503) {
        const retryAfter = response.headers.get('Retry-After') || '60'
        setErrorMessage(
          `Google Gemini service is temporarily rate-limited. Please wait ${retryAfter} seconds before trying again, or explore offline demo ideas.`
        )
        setLoading(false)
        return
      }

      if (response.status >= 500) {
        setErrorMessage(
          'AI service configuration or server error. Showing verified offline demo suggestions.'
        )
        const fallback = CLIENT_FALLBACK_IDEAS[plan.type] || CLIENT_FALLBACK_IDEAS.wedding
        setIdeas(fallback)
        setSource('demo')
        setLoading(false)
        return
      }

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`)
      }

      const rawJson = await response.json()

      // Defensively validate untrusted response shape with Zod on client
      const validated = ClientIdeasResponseSchema.safeParse(rawJson)
      if (!validated.success) {
        setErrorMessage(
          'Received an invalid response format from AI service. Reverting to verified offline demo suggestions.'
        )
        const fallback = CLIENT_FALLBACK_IDEAS[plan.type] || CLIENT_FALLBACK_IDEAS.wedding
        setIdeas(fallback)
        setSource('demo')
        setLoading(false)
        return
      }

      setIdeas(validated.data.ideas)
      setSource(validated.data.source)
      setDisclaimer(validated.data.disclaimer || null)
    } catch {
      // Backend offline or network fetch failed — graceful client demo fallback
      const fallback = CLIENT_FALLBACK_IDEAS[plan.type] || CLIENT_FALLBACK_IDEAS.wedding
      setIdeas(fallback)
      setSource('demo')
      setDisclaimer(
        'Backend service unreachable on /api. Loaded offline curated inspiration. Start Express backend to connect Gemini.'
      )
    } finally {
      setLoading(false)
    }
  }

  // ── 1. Privacy Disclosure & Explicit Consent Gate ──────────
  if (!hasConsent) {
    return (
      <div className="flex-col" style={{ gap: 'var(--space-6)' }}>
        <section
          className="card card--raised"
          style={{
            padding: 'var(--space-8)',
            border: '2px solid var(--color-plum-300)',
            background: 'linear-gradient(135deg, var(--color-plum-50), var(--color-marigold-50))',
          }}
        >
          <div style={{ maxWidth: '780px', margin: '0 auto' }}>
            <span className="badge badge--brand" style={{ marginBottom: 'var(--space-3)' }}>
              🛡️ Privacy-First AI Architecture
            </span>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--color-plum-900)',
                fontSize: 'var(--text-2xl)',
                marginBottom: 'var(--space-2)',
              }}
            >
              AI Celebration Ideas Assistant
            </h2>
            <div
              className="alert alert--info"
              style={{
                marginBottom: 'var(--space-4)',
                background: 'var(--color-bg-card)',
                borderColor: 'var(--color-brand)',
              }}
            >
              <span>ℹ️</span>
              <div>
                <strong>Upcoming Backend Integration:</strong> The AI generation engine connects to the Express + Gemini backend service (`/api/ai/ideas`).
                Explicit consent is required before any data is sent.
              </div>
            </div>
            <p
              style={{
                color: 'var(--color-text-secondary)',
                lineHeight: 'var(--leading-relaxed)',
                fontSize: 'var(--text-sm)',
                marginBottom: 'var(--space-6)',
              }}
            >
              UtsavFlow AI stores all your celebration data strictly in your local browser. Before sending an AI request,
              we require your informed consent. Below is the full disclosure of what leaves your browser and what stays strictly private.
            </p>

            <div className="grid-auto grid-auto--2" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
              {/* Sanitized fields transmitted */}
              <div
                className="card card--flat"
                style={{
                  background: 'var(--color-bg-card)',
                  padding: 'var(--space-5)',
                  borderLeft: '4px solid var(--color-brand)',
                }}
              >
                <div style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-brand)', marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
                  📤 Transmitted to Google Gemini
                </div>
                <ul style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', paddingLeft: 'var(--space-4)', lineHeight: '1.7' }}>
                  <li><strong>Event Type:</strong> {plan.type}</li>
                  <li><strong>City:</strong> {plan.city}</li>
                  <li><strong>Season / Timing:</strong> {derivedSeason} (derived from date)</li>
                  <li><strong>Guest Count:</strong> {plan.guestCount} guests</li>
                  <li><strong>Budget Tier:</strong> {derivedBudgetBand} (broad tier)</li>
                  <li><strong>Theme / Style:</strong> {plan.theme || 'None specified'}</li>
                  <li><strong>Dietary &amp; Accessibility:</strong> {plan.dietaryRequirements || 'Standard'}</li>
                </ul>
              </div>

              {/* Private data kept strictly local */}
              <div
                className="card card--flat"
                style={{
                  background: 'var(--color-bg-card)',
                  padding: 'var(--space-5)',
                  borderLeft: '4px solid var(--color-sage-600)',
                }}
              >
                <div style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-sage-700)', marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
                  🔒 Kept Strictly Browser-Local (Never Sent)
                </div>
                <ul style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', paddingLeft: 'var(--space-4)', lineHeight: '1.7' }}>
                  <li><strong>Exact Event Name:</strong> &ldquo;{plan.name}&rdquo; stays in browser</li>
                  <li><strong>Exact Date:</strong> Specific day is never transmitted</li>
                  <li><strong>Exact Budget:</strong> Specific figures &amp; reserves stay private</li>
                  <li><strong>Vendor Records:</strong> Quotes, contracts, contact info</li>
                  <li><strong>Payment Details:</strong> Advances, balances, invoices</li>
                  <li><strong>Countdown Tasks:</strong> Private checklist items</li>
                </ul>
              </div>
            </div>

            <div className="flex-between" style={{ flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              <div className="flex" style={{ gap: 'var(--space-3)' }}>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={handleGrantConsent}
                  style={{ padding: 'var(--space-3) var(--space-6)' }}
                >
                  ✓ I Agree &amp; Grant Consent
                </button>
                <button
                  type="button"
                  className="btn btn--outline"
                  onClick={() => fetchIdeas(true)}
                  style={{ padding: 'var(--space-3) var(--space-5)' }}
                >
                  Explore Offline Demo Ideas Instead
                </button>
              </div>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', alignSelf: 'center' }}>
                Consent is stored locally and can be revoked anytime.
              </span>
            </div>
          </div>
        </section>

        {/* If user clicked explore offline demo ideas without consenting */}
        {ideas.length > 0 && (
          <IdeaResultsView
            ideas={ideas}
            source={source}
            disclaimer={disclaimer}
            onRefresh={() => fetchIdeas(true)}
            loading={loading}
          />
        )}
      </div>
    )
  }

  // ── 2. Consented Active Ideation View ───────────────────────
  return (
    <div className="flex-col" style={{ gap: 'var(--space-6)' }}>
      {/* ── Status Header ───────────────────────────────────── */}
      <section
        className="card card--raised"
        style={{
          padding: 'var(--space-6)',
          background: 'linear-gradient(135deg, var(--color-plum-50), var(--color-marigold-50))',
          border: '1.5px solid var(--color-plum-200)',
        }}
      >
        <div className="flex-between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <div>
            <div className="flex" style={{ gap: 'var(--space-2)', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
              <span className="badge badge--brand">AI Ideas Assistant</span>
              <span className="badge badge--success">✓ Consent Granted</span>
              <span className="badge badge--neutral">Configured: gemini-3.8-flash</span>
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--color-plum-800)', fontSize: 'var(--text-2xl)' }}>
              Celebration Inspiration Engine
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', maxWidth: '640px', lineHeight: 'var(--leading-relaxed)', fontSize: 'var(--text-sm)' }}>
              Generates culturally resonant concepts for <strong>{plan.city}</strong> in <strong>{derivedSeason}</strong> adhering to your <strong>{derivedBudgetBand}</strong>.
            </p>
          </div>

          <div className="flex" style={{ gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => fetchIdeas(false)}
              disabled={loading}
              aria-busy={loading}
              style={{ padding: 'var(--space-3) var(--space-5)' }}
            >
              {loading ? 'Consulting Gemini...' : '✨ Generate AI Ideas'}
            </button>
            <button
              type="button"
              className="btn btn--outline"
              onClick={() => fetchIdeas(true)}
              disabled={loading}
              style={{ padding: 'var(--space-3) var(--space-4)' }}
            >
              📋 Load Demo Ideas
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setShowConsentDetails((prev) => !prev)}
              style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}
            >
              🛡️ Privacy Settings
            </button>
          </div>
        </div>

        {/* Parameter Chips */}
        <div
          className="flex"
          style={{
            gap: 'var(--space-2)',
            flexWrap: 'wrap',
            paddingTop: 'var(--space-3)',
            borderTop: '1px solid var(--color-plum-200)',
            fontSize: 'var(--text-xs)',
          }}
        >
          <span className="tag">📍 {plan.city}</span>
          <span className="tag">🗓️ {derivedSeason}</span>
          <span className="tag">👥 {plan.guestCount} Guests</span>
          <span className="tag">💰 {derivedBudgetBand}</span>
          {plan.theme && <span className="tag">🎨 {plan.theme}</span>}
          {plan.dietaryRequirements && <span className="tag">🍲 {plan.dietaryRequirements}</span>}
        </div>

        {/* Collapsible Privacy Details */}
        {showConsentDetails && (
          <div
            style={{
              marginTop: 'var(--space-4)',
              padding: 'var(--space-4)',
              background: 'var(--color-bg-card)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-plum-200)',
              fontSize: 'var(--text-xs)',
            }}
          >
            <div className="flex-between" style={{ marginBottom: 'var(--space-2)' }}>
              <strong>Active Data Minimization Guarantee:</strong>
              <button
                type="button"
                className="btn btn--danger-subtle"
                onClick={handleRevokeConsent}
                style={{ fontSize: 'var(--text-xs)', padding: 'var(--space-1) var(--space-2)' }}
              >
                Revoke Consent
              </button>
            </div>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
              Only sanitized parameters above are sent to Express backend (localhost:3001) which proxies requests to Google Gemini. Your exact budget numbers, event name, vendor quotes, and payment history remain safely in your browser.
            </p>
          </div>
        )}
      </section>

      {/* ── Error Banner ────────────────────────────────────── */}
      {errorMessage && (
        <div
          role="alert"
          aria-live="assertive"
          className="alert alert--warning"
          style={{ background: 'var(--color-bg-card)' }}
        >
          <span>⚠️</span>
          <div style={{ flex: 1 }}>
            <strong>Service Notice:</strong> {errorMessage}
          </div>
          <div className="flex" style={{ gap: 'var(--space-2)' }}>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => fetchIdeas(false)}
              disabled={loading}
              style={{ fontSize: 'var(--text-xs)', padding: 'var(--space-1) var(--space-3)' }}
            >
              Try Again
            </button>
            <button
              type="button"
              className="btn btn--outline"
              onClick={() => fetchIdeas(true)}
              style={{ fontSize: 'var(--text-xs)', padding: 'var(--space-1) var(--space-3)' }}
            >
              Switch to Demo
            </button>
          </div>
        </div>
      )}

      {/* ── Loading Spinner ─────────────────────────────────── */}
      {loading && (
        <div
          role="status"
          aria-live="polite"
          className="card card--flat"
          style={{
            padding: 'var(--space-12)',
            textAlign: 'center',
            background: 'var(--color-bg-card)',
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-3)' }}>✨</div>
          <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--color-brand)', marginBottom: 'var(--space-1)' }}>
            Consulting Celebration Planning Assistant...
          </h3>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            Synthesizing cultural decor, dining recommendations, and budget-saving concepts.
          </p>
        </div>
      )}

      {/* ── Results Grid ────────────────────────────────────── */}
      {!loading && ideas.length > 0 && (
        <IdeaResultsView
          ideas={ideas}
          source={source}
          disclaimer={disclaimer}
          onRefresh={() => fetchIdeas(false)}
          loading={loading}
        />
      )}

      {/* ── Empty State Prompt ──────────────────────────────── */}
      {!loading && ideas.length === 0 && !errorMessage && (
        <div
          className="card card--flat"
          style={{
            padding: 'var(--space-10)',
            textAlign: 'center',
            background: 'var(--color-bg-card)',
            border: '1.5px dashed var(--color-plum-200)',
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-2)' }}>💡</div>
          <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--color-plum-800)', marginBottom: 'var(--space-2)' }}>
            Ready to Discover Fresh Ideas?
          </h3>
          <p style={{ color: 'var(--color-text-secondary)', maxWidth: '520px', margin: '0 auto var(--space-4)', fontSize: 'var(--text-sm)' }}>
            Click <strong>&ldquo;Generate AI Ideas&rdquo;</strong> to receive structured ideas with INR cost estimates, execution steps, and tailored fits for {plan.city}.
          </p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => fetchIdeas(false)}
            disabled={loading}
          >
            ✨ Generate AI Ideas Now
          </button>
        </div>
      )}
    </div>
  )
}

// ── Shared Results Component ──────────────────────────────────

interface IdeaResultsViewProps {
  ideas: IdeaItem[]
  source: IdeasSource | null
  disclaimer: string | null
  onRefresh: () => void
  loading: boolean
}

function IdeaResultsView({
  ideas,
  source,
  disclaimer,
  onRefresh,
  loading,
}: IdeaResultsViewProps): React.JSX.Element {
  return (
    <div className="flex-col" style={{ gap: 'var(--space-4)' }}>
      {/* Source & Attribution Banner */}
      <div className="flex-between" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <div className="flex" style={{ gap: 'var(--space-2)', alignItems: 'center' }}>
          {source === 'gemini' ? (
            <span
              className="badge"
              style={{
                background: 'linear-gradient(135deg, var(--color-plum-600), var(--color-plum-800))',
                color: '#fff',
                fontWeight: 'var(--weight-bold)',
              }}
            >
              ✨ AI Generated (Google Gemini)
            </span>
          ) : (
            <span
              className="badge"
              style={{
                background: 'var(--color-neutral-100)',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-neutral-300)',
              }}
            >
              📋 Curated Inspiration (Offline Demo)
            </span>
          )}
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            {ideas.length} ideas curated
          </span>
        </div>

        <button
          type="button"
          className="btn btn--ghost"
          onClick={onRefresh}
          disabled={loading}
          style={{ fontSize: 'var(--text-xs)' }}
        >
          🔄 Refresh Suggestions
        </button>
      </div>

      {disclaimer && (
        <div
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-muted)',
            fontStyle: 'italic',
            padding: 'var(--space-2) var(--space-3)',
            background: 'var(--color-bg-card)',
            borderRadius: 'var(--radius-sm)',
            borderLeft: '3px solid var(--color-marigold-400)',
          }}
        >
          {disclaimer}
        </div>
      )}

      {/* Cards Grid */}
      <div className="grid-auto grid-auto--2" style={{ gap: 'var(--space-4)' }}>
        {ideas.map((idea, index) => {
          const steps: string[] = (idea.practicalSteps ?? idea.steps) ?? []
          return (
            <div
              key={idea.id || `idea-${index}`}
              className="card card--raised flex-col"
              style={{
                padding: 'var(--space-5)',
                justifyContent: 'space-between',
                background: 'var(--color-bg-card)',
                borderTop: '3px solid var(--color-brand)',
              }}
            >
              <div>
                <div className="flex-between" style={{ alignItems: 'flex-start', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                  <span
                    className="badge"
                    style={{
                      background: 'var(--color-plum-100)',
                      color: 'var(--color-plum-800)',
                      fontSize: 'var(--text-xs)',
                      textTransform: 'uppercase',
                    }}
                  >
                    {idea.category}
                  </span>
                  <div
                    style={{
                      fontWeight: 'var(--weight-bold)',
                      color: 'var(--color-brand)',
                      fontSize: 'var(--text-sm)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatINR(idea.estimatedCostMin)} &ndash; {formatINR(idea.estimatedCostMax)}
                  </div>
                </div>

                {/* Securely rendered plain text title */}
                <h3
                  style={{
                    fontFamily: 'var(--font-display)',
                    color: 'var(--color-text-primary)',
                    fontSize: 'var(--text-base)',
                    marginBottom: 'var(--space-2)',
                    lineHeight: 'var(--leading-snug)',
                  }}
                >
                  {idea.title}
                </h3>

                {/* Securely rendered plain text rationale */}
                <p
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-text-secondary)',
                    lineHeight: 'var(--leading-relaxed)',
                    marginBottom: 'var(--space-3)',
                  }}
                >
                  {idea.rationale}
                </p>

                {idea.fitReason && (
                  <div
                    style={{
                      padding: 'var(--space-2) var(--space-3)',
                      background: 'var(--color-plum-50)',
                      borderRadius: 'var(--radius-sm)',
                      marginBottom: 'var(--space-3)',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-plum-900)',
                    }}
                  >
                    <strong>Why it fits:</strong> {idea.fitReason}
                  </div>
                )}

                {steps.length > 0 && (
                  <div>
                    <div
                      style={{
                        fontSize: 'var(--text-xs)',
                        fontWeight: 'var(--weight-bold)',
                        color: 'var(--color-text-primary)',
                        marginBottom: 'var(--space-1)',
                      }}
                    >
                      Practical Steps:
                    </div>
                    <ol
                      style={{
                        paddingLeft: 'var(--space-4)',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--color-text-secondary)',
                        lineHeight: '1.6',
                        margin: 0,
                      }}
                    >
                      {steps.map((step: string, sIdx: number) => (
                        <li key={sIdx}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
