import React, { useState } from 'react'
import type { EventPlan } from '@/types'
import { ConfirmDialog } from './ConfirmDialog'

interface LandingPageProps {
  existingPlan: EventPlan | null
  onCreateEvent: () => void
  onExploreDemo: () => void
  onOpenWorkspace: () => void
}

export function LandingPage({
  existingPlan,
  onCreateEvent,
  onExploreDemo,
  onOpenWorkspace,
}: LandingPageProps): React.JSX.Element {
  const [showDemoConfirm, setShowDemoConfirm] = useState(false)

  const handleDemoClick = (): void => {
    if (existingPlan && !existingPlan.id.startsWith('demo-')) {
      setShowDemoConfirm(true)
    } else {
      onExploreDemo()
    }
  }

  const handleConfirmDemo = (): void => {
    setShowDemoConfirm(false)
    onExploreDemo()
  }

  return (
    <div className="container" style={{ paddingBlock: 'var(--space-6) var(--space-16)' }}>
      {/* ── Top Navigation Bar ──────────────────────────────── */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBlock: 'var(--space-4)',
          borderBottom: '1px solid var(--color-border-subtle)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-lg)',
              background: 'linear-gradient(135deg, var(--color-plum-700), var(--color-terracotta-500))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-ivory)',
              fontSize: '1.25rem',
              boxShadow: 'var(--shadow-sm)',
            }}
            aria-hidden="true"
          >
            🪔
          </div>
          <div>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-xl)',
                fontWeight: 'var(--weight-bold)',
                color: 'var(--color-brand)',
                letterSpacing: '-0.02em',
              }}
            >
              UtsavFlow AI
            </span>
            <span
              className="badge badge--highlight"
              style={{ marginLeft: 'var(--space-2)', verticalAlign: 'middle' }}
            >
              Celebration Planner
            </span>
          </div>
        </div>

        <div>
          {existingPlan && (
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={onOpenWorkspace}
            >
              Open Workspace &rarr;
            </button>
          )}
        </div>
      </header>

      {/* ── Active Plan Banner (if saved plan exists) ───────── */}
      {existingPlan && (
        <section
          className="alert alert--info"
          style={{ marginBottom: 'var(--space-8)', justifyContent: 'space-between', alignItems: 'center' }}
          aria-label="Active plan notification"
        >
          <div>
            <strong>Active Plan Detected:</strong> {existingPlan.name} ({existingPlan.city}) &bull;{' '}
            {existingPlan.date}
          </div>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={onOpenWorkspace}
          >
            Resume Planning
          </button>
        </section>
      )}

      {/* ── Hero Section ────────────────────────────────────── */}
      <section className="landing-hero">
        <span
          className="badge badge--accent"
          style={{ marginBottom: 'var(--space-4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}
        >
          Intelligent Event Architecture
        </span>
        <h1 className="landing-title">
          Plan Indian Celebrations with Flawless Joy and Precision
        </h1>
        <p className="landing-subtitle">
          From lavish multi-day weddings and vibrant milestone birthdays to community utsavs,
          UtsavFlow AI orchestrates every rupee, timeline milestone, vendor contract, and creative detail.
        </p>

        {/* ── Call-To-Action Buttons ────────────────────────── */}
        <div className="hero-actions">
          <button
            type="button"
            className="btn btn--accent btn--lg"
            onClick={onCreateEvent}
            id="btn-create-event-hero"
          >
            ✨ Create my event
          </button>
          <button
            type="button"
            className="btn btn--outline btn--lg"
            onClick={handleDemoClick}
            id="btn-explore-demo-hero"
          >
            🪷 Explore demo plan
          </button>
        </div>

        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
          100% private in-browser storage &bull; No credit card or account registration required &bull; Tailored for India
        </p>
      </section>

      {/* ── Three Celebration Pillars ───────────────────────── */}
      <section style={{ marginBottom: 'var(--space-12)' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--color-brand)', marginBottom: 'var(--space-2)' }}>
            Tailored for Every Memorable Milestone
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', maxWidth: '540px', marginInline: 'auto' }}>
            Built specifically around Indian cultural traditions, dietary customs, and complex vendor networks.
          </p>
        </div>

        <div className="grid-auto grid-auto--3">
          <article className="card card--raised" style={{ borderTop: '4px solid var(--color-brand)' }}>
            <div style={{ fontSize: '2rem', marginBottom: 'var(--space-3)' }} aria-hidden="true">
              💍
            </div>
            <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>
              Weddings &amp; Sangeets
            </h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 'var(--leading-relaxed)' }}>
              Coordinate Mehendi, Haldi, Sangeet and Pheras. Keep muhurat timelines intact, balance venue and catering envelopes, and manage photographer retainers.
            </p>
          </article>

          <article className="card card--raised" style={{ borderTop: '4px solid var(--color-accent)' }}>
            <div style={{ fontSize: '2rem', marginBottom: 'var(--space-3)' }} aria-hidden="true">
              🎂
            </div>
            <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>
              Milestone Birthdays
            </h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 'var(--leading-relaxed)' }}>
              First birthdays, 50th golden jubilees, or surprise parties. Plan balloon decor, customized themes, entertainment, cakes, and return favors effortlessly.
            </p>
          </article>

          <article className="card card--raised" style={{ borderTop: '4px solid var(--color-highlight)' }}>
            <div style={{ fontSize: '2rem', marginBottom: 'var(--space-3)' }} aria-hidden="true">
              🪅
            </div>
            <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>
              Community Utsavs
            </h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 'var(--leading-relaxed)' }}>
              Diwali gatherings, Ganesh Utsav, Navratri Garba, and apartment association celebrations with community prasad catering, sound permits, and crowd safety.
            </p>
          </article>
        </div>
      </section>

      {/* ── Feature Highlights ──────────────────────────────── */}
      <section className="card card--flat" style={{ padding: 'var(--space-8)', marginBottom: 'var(--space-12)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--color-brand)', marginBottom: 'var(--space-6)', textAlign: 'center' }}>
          Why Organizers Trust UtsavFlow AI
        </h2>

        <div className="grid-auto grid-auto--4">
          <div>
            <div style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-plum-700)', marginBottom: 'var(--space-1)' }}>
              ₹ Rupee-Accurate Budgeting
            </div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: 'var(--leading-normal)' }}>
              Mathematically sound envelopes with contingency reserves. Eliminates double counting between vendor estimates and actuals.
            </p>
          </div>

          <div>
            <div style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-plum-700)', marginBottom: 'var(--space-1)' }}>
              📅 Countdown Timelines
            </div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: 'var(--leading-normal)' }}>
              Pre-calculated milestones with calendar-safe math. Automatically warns if tasks conflict with event dates.
            </p>
          </div>

          <div>
            <div style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-plum-700)', marginBottom: 'var(--space-1)' }}>
              🤝 Vendor Payment Bridge
            </div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: 'var(--leading-normal)' }}>
              Track quotes, advance payments, and booking states. Prevents overpayment and duplicate assignments.
            </p>
          </div>

          <div>
            <div style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-plum-700)', marginBottom: 'var(--space-1)' }}>
              🤖 AI Celebration Assistant
            </div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: 'var(--leading-normal)' }}>
              Powered by Google Gemini 2.0 Flash to tailor menu concepts, decor motifs, and cost-saving ideas to your specific city and guest size.
            </p>
          </div>
        </div>
      </section>

      {/* ── Bottom Callout ──────────────────────────────────── */}
      <section
        style={{
          textAlign: 'center',
          padding: 'var(--space-10) var(--space-4)',
          background: 'var(--color-brand-subtle)',
          borderRadius: 'var(--radius-2xl)',
          border: '1px solid var(--color-plum-100)',
        }}
      >
        <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--color-brand)', marginBottom: 'var(--space-3)' }}>
          Ready to make your celebration memorable?
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)', maxWidth: '520px', marginInline: 'auto' }}>
          Step through our 5-minute setup wizard or view our fully-budgeted Mumbai wedding demo plan.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn--accent"
            onClick={onCreateEvent}
          >
            Start Event Wizard
          </button>
          <button
            type="button"
            className="btn btn--outline"
            onClick={handleDemoClick}
          >
            Explore Sample Plan
          </button>
        </div>
      </section>

      {/* ── Demo Replacement Confirmation Modal ─────────────── */}
      <ConfirmDialog
        isOpen={showDemoConfirm}
        title="Load Sample Demo Plan?"
        message={`You currently have a saved event plan ("${existingPlan?.name || 'Untitled'}"). Loading the sample demo plan will replace your current workspace. Would you like to proceed?`}
        confirmText="Load Demo Plan"
        cancelText="Keep My Event"
        confirmVariant="accent"
        onConfirm={handleConfirmDemo}
        onCancel={() => setShowDemoConfirm(false)}
      />
    </div>
  )
}
