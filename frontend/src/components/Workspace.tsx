import React, { useState } from 'react'
import type { EventPlan } from '@/types'
import { downloadPlanJSON } from '@/lib/storage'
import { daysUntilEvent } from '@/lib/dateOnly'
import { OverviewTab } from './OverviewTab'
import { BudgetTab } from './BudgetTab'
import { TimelineTab } from './TimelineTab'
import { VendorsTab } from './VendorsTab'
import { AIIdeasTab } from './AIIdeasTab'
import { ConfirmDialog } from './ConfirmDialog'

export type WorkspaceTab = 'overview' | 'budget' | 'timeline' | 'vendors' | 'ideas'

interface WorkspaceProps {
  plan: EventPlan
  isDemo: boolean
  onToggleTask: (taskId: string) => void
  onUpdatePlan?: (updatedPlan: EventPlan) => void
  onResetPlan: () => void
  onReturnHome: () => void
  onCreateNewEvent: () => void
}

export function Workspace({
  plan,
  isDemo,
  onToggleTask,
  onUpdatePlan,
  onResetPlan,
  onReturnHome,
  onCreateNewEvent,
}: WorkspaceProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview')
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  let daysRemaining: number | null = null
  try {
    daysRemaining = daysUntilEvent(plan.date)
  } catch {
    daysRemaining = null
  }

  const handleExport = (): void => {
    downloadPlanJSON(plan)
  }

  const tabs: { id: WorkspaceTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'budget', label: 'Budget', icon: '💰' },
    { id: 'timeline', label: 'Timeline', icon: '📅' },
    { id: 'vendors', label: 'Vendors', icon: '🤝' },
    { id: 'ideas', label: 'AI Ideas', icon: '✨' },
  ]

  const handleTabKeyDown = (e: React.KeyboardEvent, index: number): void => {
    if (e.key === 'ArrowRight') {
      const nextIndex = (index + 1) % tabs.length
      setActiveTab(tabs[nextIndex].id)
    } else if (e.key === 'ArrowLeft') {
      const prevIndex = (index - 1 + tabs.length) % tabs.length
      setActiveTab(tabs[prevIndex].id)
    }
  }

  return (
    <div className="container" style={{ paddingBlock: 'var(--space-6) var(--space-16)' }}>
      {/* ── Demo Mode Banner ────────────────────────────────── */}
      {isDemo && (
        <aside className="demo-banner" aria-label="Demo mode notice">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span aria-hidden="true">🪷</span>
            <span>
              <strong>Sample Demo Plan:</strong> You are exploring a pre-populated celebration plan. All changes stay in this session.
            </span>
          </div>
          <button
            type="button"
            className="btn btn--accent btn--sm"
            onClick={onCreateNewEvent}
          >
            Create My Own Event &rarr;
          </button>
        </aside>
      )}

      {/* ── Workspace Header ────────────────────────────────── */}
      <header className="workspace-header">
        <div className="flex-between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)', flexWrap: 'wrap' }}>
              <span className="badge badge--brand" style={{ textTransform: 'capitalize' }}>
                {plan.type}
              </span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                📍 {plan.city}
              </span>
              {daysRemaining !== null && (
                <span className={`badge ${daysRemaining < 0 ? 'badge--error' : daysRemaining <= 7 ? 'badge--warning' : 'badge--highlight'}`}>
                  {daysRemaining < 0
                    ? `${Math.abs(daysRemaining)} days ago`
                    : daysRemaining === 0
                    ? 'Today!'
                    : `${daysRemaining} days away`}
                </span>
              )}
            </div>

            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(1.5rem, 3.5vw, 2.25rem)',
                color: 'var(--color-plum-800)',
                lineHeight: 'var(--leading-tight)',
              }}
            >
              {plan.name}
            </h1>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={onReturnHome}
              title="Return to Landing Page"
            >
              🏠 Home
            </button>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={handleExport}
              title="Download Plan JSON Backup"
            >
              📥 Export JSON
            </button>
            <button
              type="button"
              className="btn btn--danger btn--sm"
              onClick={() => setShowResetConfirm(true)}
              title="Reset and clear current plan"
            >
              🗑️ Reset
            </button>
          </div>
        </div>

        {/* ── Navigation Tabs ───────────────────────────────── */}
        <div className="nav-tab-container">
          <div className="tab-list" role="tablist" aria-label="Planner Workspace Sections">
            {tabs.map((tab, idx) => {
              const isSelected = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  id={`tab-${tab.id}`}
                  type="button"
                  role="tab"
                  className="tab-item"
                  aria-selected={isSelected}
                  aria-controls={`panel-${tab.id}`}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => setActiveTab(tab.id)}
                  onKeyDown={(e) => handleTabKeyDown(e, idx)}
                >
                  <span aria-hidden="true">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </header>

      {/* ── Tab Panels ──────────────────────────────────────── */}
      <main id={`panel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
        {activeTab === 'overview' && (
          <OverviewTab
            plan={plan}
            onToggleTask={onToggleTask}
            onSwitchTab={setActiveTab}
          />
        )}
        {activeTab === 'budget' && (
          <BudgetTab plan={plan} onUpdatePlan={onUpdatePlan} />
        )}
        {activeTab === 'timeline' && (
          <TimelineTab plan={plan} onToggleTask={onToggleTask} onUpdatePlan={onUpdatePlan} />
        )}
        {activeTab === 'vendors' && <VendorsTab plan={plan} onUpdatePlan={onUpdatePlan} />}
        {activeTab === 'ideas' && <AIIdeasTab plan={plan} onUpdatePlan={onUpdatePlan} />}
      </main>

      {/* ── Reset Plan Confirmation Modal ───────────────────── */}
      <ConfirmDialog
        isOpen={showResetConfirm}
        title="Reset Celebration Plan?"
        message="Are you sure you want to reset this plan? All budget entries, vendor contracts, and countdown tasks will be removed from your browser. You can export a JSON backup first if you want to keep your data."
        confirmText="Yes, Reset Plan"
        cancelText="Keep My Plan"
        confirmVariant="danger"
        onConfirm={() => {
          setShowResetConfirm(false)
          onResetPlan()
        }}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  )
}
