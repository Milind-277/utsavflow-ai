import React from 'react'
import type { EventPlan } from '@/types'
import { computeBudgetSummary } from '@/lib/budget'
import { formatINR } from '@/lib/currency'
import { taskCompletionPct, isUpcoming, isOverdue, formatTaskDueLabel } from '@/lib/timeline'
import { daysUntilEvent } from '@/lib/dateOnly'

interface OverviewTabProps {
  plan: EventPlan
  onToggleTask: (taskId: string) => void
  onSwitchTab: (tab: 'budget' | 'timeline' | 'vendors' | 'ideas') => void
}

export function OverviewTab({ plan, onToggleTask, onSwitchTab }: OverviewTabProps): React.JSX.Element {
  const budgetSummary = computeBudgetSummary(plan.budget, plan.budgetTotal)
  const completionPct = taskCompletionPct(plan.timeline)

  let daysRemaining: number | null = null
  try {
    daysRemaining = daysUntilEvent(plan.date)
  } catch {
    daysRemaining = null
  }

  // Filter tasks that need attention: overdue or due in next 14 days
  const upcomingTasks = plan.timeline.filter((t) => isOverdue(t) || isUpcoming(t, 14))

  return (
    <div className="flex-col" style={{ gap: 'var(--space-6)' }}>
      {/* ── Top Four Stat Cards ─────────────────────────────── */}
      <section aria-label="Key Celebration Metrics">
        <div className="grid-auto grid-auto--4">
          {/* Total Budget */}
          <div className="stat-card">
            <span className="stat-card__label">Total Budget</span>
            <span className="stat-card__value" style={{ color: 'var(--color-brand)' }}>
              {formatINR(budgetSummary.totalBudget)}
            </span>
            <span className="stat-card__sub">
              Contingency Reserve: {formatINR(budgetSummary.contingencyReserve)} ({plan.budget.contingencyPct}%)
            </span>
          </div>

          {/* Actual Spending */}
          <div className="stat-card">
            <span className="stat-card__label">Actual Spent</span>
            <span className="stat-card__value">
              {formatINR(budgetSummary.totalActual)}
            </span>
            <span className="stat-card__sub">
              {budgetSummary.totalBudget > 0
                ? `${Math.round((budgetSummary.totalActual / budgetSummary.totalBudget) * 100)}% of total budget`
                : 'No budget allocated'}
            </span>
          </div>

          {/* Remaining Budget */}
          <div className="stat-card">
            <span className="stat-card__label">Remaining Budget</span>
            <span
              className="stat-card__value"
              style={{
                color: budgetSummary.isOverspent ? 'var(--color-error)' : 'var(--color-sage-600)',
              }}
            >
              {formatINR(budgetSummary.remainingBudget)}
            </span>
            <span className="stat-card__sub">
              {budgetSummary.isOverspent ? '⚠️ Overspent beyond reserve' : 'Available spending envelope'}
            </span>
          </div>

          {/* Task Progress */}
          <div className="stat-card">
            <span className="stat-card__label">Task Progress</span>
            <span className="stat-card__value" style={{ color: 'var(--color-accent)' }}>
              {completionPct}%
            </span>
            <div className="progress-bar" style={{ marginTop: 'var(--space-1)', marginBottom: 'var(--space-1)' }}>
              <div
                className="progress-bar__fill progress-bar__fill--success"
                style={{ width: `${completionPct}%` }}
              />
            </div>
            <span className="stat-card__sub">
              {plan.timeline.filter((t) => t.completed).length} of {plan.timeline.length} tasks completed
            </span>
          </div>
        </div>
      </section>

      {/* ── Two Column Layout: Event Profile & Urgent Tasks ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-6)' }}>
        {/* Left Column: Event Profile & Budget Health */}
        <div className="flex-col">
          {/* Profile Card */}
          <section className="card card--raised">
            <div className="flex-between" style={{ marginBottom: 'var(--space-4)' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--color-brand)', fontSize: 'var(--text-xl)' }}>
                Celebration Profile
              </h2>
              <span className="badge badge--brand" style={{ textTransform: 'capitalize' }}>
                {plan.type}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-4)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: 'var(--text-xs)', textTransform: 'uppercase' }}>
                  Event Date
                </span>
                <strong>{plan.date}</strong>
                {daysRemaining !== null && (
                  <span
                    className={`badge ${daysRemaining < 0 ? 'badge--error' : daysRemaining <= 7 ? 'badge--warning' : 'badge--highlight'}`}
                    style={{ marginLeft: 'var(--space-2)' }}
                  >
                    {daysRemaining < 0
                      ? `${Math.abs(daysRemaining)}d ago`
                      : daysRemaining === 0
                      ? 'Today!'
                      : `In ${daysRemaining} days`}
                  </span>
                )}
              </div>

              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: 'var(--text-xs)', textTransform: 'uppercase' }}>
                  City / Location
                </span>
                <strong>{plan.city}</strong>
              </div>

              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: 'var(--text-xs)', textTransform: 'uppercase' }}>
                  Guest Count
                </span>
                <strong>{plan.guestCount.toLocaleString('en-IN')} Attendees</strong>
              </div>

              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: 'var(--text-xs)', textTransform: 'uppercase' }}>
                  Total Budget
                </span>
                <strong style={{ color: 'var(--color-brand)' }}>{formatINR(plan.budgetTotal)}</strong>
              </div>
            </div>

            {plan.theme && (
              <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'block' }}>
                  Theme &amp; Decor
                </span>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-body)' }}>{plan.theme}</p>
              </div>
            )}

            {plan.dietaryRequirements && (
              <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'block' }}>
                  Dietary Accommodations
                </span>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-body)' }}>{plan.dietaryRequirements}</p>
              </div>
            )}

            {plan.accessibilityNeeds && (
              <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-3)' }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'block' }}>
                  Accessibility Needs
                </span>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-body)' }}>{plan.accessibilityNeeds}</p>
              </div>
            )}
          </section>

          {/* Budget Health Card */}
          <section className="card card--raised">
            <div className="flex-between" style={{ marginBottom: 'var(--space-4)' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--color-brand)', fontSize: 'var(--text-xl)' }}>
                Budget Allocation Health
              </h2>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => onSwitchTab('budget')}
              >
                View Full Budget &rarr;
              </button>
            </div>

            {budgetSummary.isOverAllocated && (
              <div className="alert alert--error" style={{ marginBottom: 'var(--space-3)' }}>
                <span>⚠️</span>
                <div>
                  <strong>Over-Allocated Envelope:</strong> Total allocations exceed available budget by{' '}
                  {formatINR(budgetSummary.allocationOverage)}.
                </div>
              </div>
            )}

            {budgetSummary.isOverspent && (
              <div className="alert alert--warning" style={{ marginBottom: 'var(--space-3)' }}>
                <span>🚨</span>
                <div>
                  <strong>Budget Limit Reached:</strong> Current actual spending has consumed your contingency buffer.
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div>
                <div className="flex-between" style={{ fontSize: 'var(--text-xs)', marginBottom: 'var(--space-1)' }}>
                  <span>Allocated to Categories</span>
                  <span>{formatINR(budgetSummary.totalAllocated)}</span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-bar__fill"
                    style={{
                      width: `${Math.min(100, Math.round((budgetSummary.totalAllocated / (budgetSummary.totalBudget || 1)) * 100))}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex-between" style={{ fontSize: 'var(--text-xs)', marginBottom: 'var(--space-1)' }}>
                  <span>Unallocated Remaining Slack</span>
                  <span style={{ color: 'var(--color-sage-600)', fontWeight: 'var(--weight-semibold)' }}>
                    {formatINR(budgetSummary.unallocatedFunds)}
                  </span>
                </div>
              </div>

              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-3)' }}>
                {plan.budget.categories.length} active budget categories configured.
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Upcoming Tasks & Vendor Quick Glance */}
        <div className="flex-col">
          {/* Upcoming Tasks Card */}
          <section className="card card--raised">
            <div className="flex-between" style={{ marginBottom: 'var(--space-4)' }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--color-brand)', fontSize: 'var(--text-xl)' }}>
                  Upcoming Countdown Tasks
                </h2>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                  Immediate tasks due within 14 days or overdue
                </p>
              </div>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => onSwitchTab('timeline')}
              >
                All Tasks ({plan.timeline.length}) &rarr;
              </button>
            </div>

            {upcomingTasks.length === 0 ? (
              <div className="empty-state" style={{ padding: 'var(--space-8) var(--space-4)' }}>
                <div className="empty-state__icon" aria-hidden="true">
                  🗓️
                </div>
                <div className="empty-state__title">All Clear for Now</div>
                <p className="empty-state__body">
                  No pending tasks due in the next 14 days. You can review your master countdown schedule in the Timeline tab.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {upcomingTasks.slice(0, 6).map((task) => {
                  const overdue = isOverdue(task)
                  return (
                    <div
                      key={task.id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 'var(--space-3)',
                        padding: 'var(--space-3)',
                        borderRadius: 'var(--radius-lg)',
                        background: task.completed
                          ? 'var(--color-bg-subtle)'
                          : overdue
                          ? 'var(--color-error-subtle)'
                          : 'var(--color-bg-card)',
                        border: '1px solid var(--color-border-subtle)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => onToggleTask(task.id)}
                        aria-label={`Mark task ${task.title} as ${task.completed ? 'incomplete' : 'complete'}`}
                        style={{ marginTop: '2px', width: '18px', height: '18px', accentColor: 'var(--color-brand)', cursor: 'pointer' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontSize: 'var(--text-sm)',
                            fontWeight: 'var(--weight-semibold)',
                            textDecoration: task.completed ? 'line-through' : 'none',
                            color: task.completed ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                          }}
                        >
                          {task.title}
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', marginTop: 'var(--space-1)' }}>
                          <span
                            className={`badge ${overdue ? 'badge--error' : 'badge--neutral'}`}
                            style={{ fontSize: '0.7rem' }}
                          >
                            {formatTaskDueLabel(task)}
                          </span>
                          <span
                            className={`badge ${task.priority === 'high' ? 'badge--accent' : 'badge--neutral'}`}
                            style={{ fontSize: '0.7rem', textTransform: 'capitalize' }}
                          >
                            {task.priority}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Vendors Quick Glance */}
          <section className="card card--raised">
            <div className="flex-between" style={{ marginBottom: 'var(--space-4)' }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--color-brand)', fontSize: 'var(--text-xl)' }}>
                  Vendor Contracts
                </h2>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                  Summary of booked and enquiring services
                </p>
              </div>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => onSwitchTab('vendors')}
              >
                Manage ({plan.vendors.length}) &rarr;
              </button>
            </div>

            {plan.vendors.length === 0 ? (
              <div className="empty-state" style={{ padding: 'var(--space-6) var(--space-4)' }}>
                <div className="empty-state__icon" aria-hidden="true">
                  🤝
                </div>
                <div className="empty-state__title">No Vendors Added</div>
                <p className="empty-state__body">
                  Track caterers, venues, decorators, and photographers in the Vendors tab.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <div className="flex-between" style={{ fontSize: 'var(--text-sm)', paddingBottom: 'var(--space-2)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <span>Total Quoted Commitments:</span>
                  <strong>
                    {formatINR(plan.vendors.reduce((s, v) => s + (v.bookingStatus !== 'cancelled' ? v.quotedCost : 0), 0))}
                  </strong>
                </div>
                <div className="flex-between" style={{ fontSize: 'var(--text-sm)', paddingBottom: 'var(--space-2)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <span>Total Advance Paid:</span>
                  <strong style={{ color: 'var(--color-sage-600)' }}>
                    {formatINR(plan.vendors.reduce((s, v) => s + v.amountPaid, 0))}
                  </strong>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 'var(--space-1)' }}>
                  <span className="badge badge--success">
                    {plan.vendors.filter((v) => v.bookingStatus === 'booked').length} Booked
                  </span>
                  <span className="badge badge--warning">
                    {plan.vendors.filter((v) => v.bookingStatus === 'enquiring').length} Enquiring
                  </span>
                  <span className="badge badge--neutral">
                    {plan.vendors.filter((v) => v.paymentStatus === 'paid').length} Fully Paid
                  </span>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
