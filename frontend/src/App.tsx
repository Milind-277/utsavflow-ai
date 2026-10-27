import React, { useState } from 'react'
import type { EventPlan } from '@/types'
import { useEventPlan } from './hooks/useEventPlan'
import { LandingPage } from './components/LandingPage'
import { EventWizard } from './components/EventWizard'
import { Workspace } from './components/Workspace'

type AppView = 'landing' | 'wizard' | 'workspace'

export default function App(): React.JSX.Element {
  const { plan, loading, isDemo, save, loadDemo, clear, toggleTask } = useEventPlan()
  const [view, setView] = useState<AppView>('landing')

  // Show a simple spinner while reading initial localStorage state
  if (loading) {
    return (
      <div
        className="container"
        style={{
          minHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-4)',
        }}
      >
        <div className="spinner spinner--lg" aria-hidden="true" />
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
          Loading your celebration planner...
        </p>
      </div>
    )
  }

  const handleCreateEventClick = (): void => {
    setView('wizard')
  }

  const handleExploreDemoClick = (): void => {
    loadDemo()
    setView('workspace')
  }

  const handleOpenWorkspace = (): void => {
    setView('workspace')
  }

  const handleWizardComplete = (newPlan: EventPlan): void => {
    save(newPlan)
    setView('workspace')
  }

  const handleWizardCancel = (): void => {
    setView(plan ? 'workspace' : 'landing')
  }

  const handleResetPlan = (): void => {
    clear()
    setView('landing')
  }

  const handleReturnHome = (): void => {
    setView('landing')
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <main style={{ flex: 1 }}>
        {view === 'landing' && (
          <LandingPage
            existingPlan={plan}
            onCreateEvent={handleCreateEventClick}
            onExploreDemo={handleExploreDemoClick}
            onOpenWorkspace={handleOpenWorkspace}
          />
        )}

        {view === 'wizard' && (
          <EventWizard
            onComplete={handleWizardComplete}
            onCancel={handleWizardCancel}
          />
        )}

        {view === 'workspace' && plan && (
          <Workspace
            plan={plan}
            isDemo={isDemo}
            onToggleTask={toggleTask}
            onUpdatePlan={save}
            onResetPlan={handleResetPlan}
            onReturnHome={handleReturnHome}
            onCreateNewEvent={handleCreateEventClick}
          />
        )}
      </main>

      {/* ── Global Footer ─────────────────────────────────── */}
      <footer
        style={{
          borderTop: '1px solid var(--color-border-subtle)',
          padding: 'var(--space-6) var(--space-4)',
          textAlign: 'center',
          fontSize: 'var(--text-xs)',
          color: 'var(--color-text-muted)',
          background: 'var(--color-bg-subtle)',
        }}
      >
        <p>
          <strong>UtsavFlow AI</strong> &bull; Celebration &amp; Event Planning Assistant for Weddings, Birthdays &amp; Community Utsavs.
        </p>
        <p style={{ marginTop: 'var(--space-1)' }}>
          Browser-local storage &bull; Zero secrets transmitted &bull; Built with respect for Indian festive traditions.
        </p>
      </footer>
    </div>
  )
}
