import React, { useState, useRef, useEffect } from 'react'
import type { EventType, EventPlan } from '@/types'
import { isPast } from '@/lib/dateOnly'
import { formatINR, parseINRInput } from '@/lib/currency'
import { createNewEventPlan } from '@/lib/planFactory'
import { EventPlanSchema } from '@/types'

interface EventWizardProps {
  onComplete: (plan: EventPlan) => void
  onCancel: () => void
}

const POPULAR_CITIES = ['Mumbai', 'Delhi NCR', 'Bengaluru', 'Jaipur', 'Hyderabad', 'Pune', 'Udaipur', 'Kolkata']

const THEME_SUGGESTIONS: Record<EventType, string[]> = {
  wedding: ['Royal Heritage & Velvet', 'Marigold & Jasmine Traditional', 'Pastel Blossom Editorial', 'Contemporary Bollywood Sangeet'],
  birthday: ['Tropical Carnival & Gold', 'Retro Bollywood 90s', 'Boho Chic Minimalist', 'Superhero Adventure'],
  community: ['Vibrant Diwali Diya Glow', 'Traditional Navratri Garba', 'Spring Basant Celebration', 'Cultural Folk Showcase'],
}

const DIETARY_SUGGESTIONS = [
  'Full Vegetarian (No onion/garlic on request)',
  'Jain options required',
  'Veg & Non-Veg separate kitchens',
  'Halal certified catering',
  'Nut-free dietary accommodations',
]

const ACCESSIBILITY_SUGGESTIONS = [
  'Wheelchair ramp required at main hall',
  'Priority ground-floor seating for elders',
  'Quiet rest lounge away from loud music',
  'Braille / large-print event itineraries',
]

export function EventWizard({ onComplete, onCancel }: EventWizardProps): React.JSX.Element {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)

  // Form State
  const [eventType, setEventType] = useState<EventType>('wedding')
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [city, setCity] = useState('')
  const [guestCount, setGuestCount] = useState<string>('150')
  const [budgetTotal, setBudgetTotal] = useState<string>('500000')
  const [theme, setTheme] = useState('')
  const [dietaryRequirements, setDietaryRequirements] = useState('')
  const [accessibilityNeeds, setAccessibilityNeeds] = useState('')

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isPastDateWarning, setIsPastDateWarning] = useState(false)

  // Focus management
  const stepHeaderRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    // Focus the step header when step changes for accessibility
    stepHeaderRef.current?.focus()
  }, [step])

  // Real-time check on past date
  useEffect(() => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      try {
        setIsPastDateWarning(isPast(date))
      } catch {
        setIsPastDateWarning(false)
      }
    } else {
      setIsPastDateWarning(false)
    }
  }, [date])

  const validateStep2 = (): boolean => {
    const errs: Record<string, string> = {}
    if (!name.trim()) {
      errs.name = 'Please provide an event name.'
    } else if (name.trim().length > 100) {
      errs.name = 'Event name cannot exceed 100 characters.'
    }

    if (!date.trim()) {
      errs.date = 'Please select an event date.'
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      errs.date = 'Date must be formatted as YYYY-MM-DD.'
    }

    if (!city.trim()) {
      errs.city = 'Please specify a city or location.'
    } else if (city.trim().length > 100) {
      errs.city = 'City cannot exceed 100 characters.'
    }

    const guests = parseInt(guestCount, 10)
    if (isNaN(guests) || guests < 1 || guests > 100000) {
      errs.guestCount = 'Guest count must be between 1 and 100,000.'
    }

    const budget = parseINRInput(budgetTotal)
    if (budget < 0 || isNaN(budget)) {
      errs.budgetTotal = 'Please specify a valid non-negative budget.'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const validateStep3 = (): boolean => {
    const errs: Record<string, string> = {}
    if (theme.length > 300) {
      errs.theme = 'Theme description cannot exceed 300 characters.'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const validateStep4 = (): boolean => {
    const errs: Record<string, string> = {}
    if (dietaryRequirements.length > 300) {
      errs.dietary = 'Dietary requirements cannot exceed 300 characters.'
    }
    if (accessibilityNeeds.length > 300) {
      errs.accessibility = 'Accessibility needs cannot exceed 300 characters.'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleNext = (): void => {
    if (step === 1) {
      setStep(2)
    } else if (step === 2) {
      if (validateStep2()) setStep(3)
    } else if (step === 3) {
      if (validateStep3()) setStep(4)
    } else if (step === 4) {
      if (validateStep4()) setStep(5)
    }
  }

  const handlePrevious = (): void => {
    setErrors({})
    if (step > 1) {
      setStep((prev) => (prev - 1) as 1 | 2 | 3 | 4 | 5)
    }
  }

  const handleCreate = (): void => {
    const input = {
      type: eventType,
      name,
      date,
      city,
      guestCount: parseInt(guestCount, 10) || 1,
      budgetTotal: parseINRInput(budgetTotal),
      theme,
      dietaryRequirements,
      accessibilityNeeds,
    }

    const newPlan = createNewEventPlan(input)
    const validation = EventPlanSchema.safeParse(newPlan)
    if (!validation.success) {
      const msg = validation.error.issues.map((i) => i.message).join('; ')
      setErrors({ form: `Validation error: ${msg}` })
      return
    }

    onComplete(newPlan)
  }

  const stepsList = [
    { num: 1, label: 'Event Type' },
    { num: 2, label: 'Details' },
    { num: 3, label: 'Theme & Style' },
    { num: 4, label: 'Diet & Needs' },
    { num: 5, label: 'Review' },
  ]

  return (
    <div className="container" style={{ maxWidth: '780px', paddingBlock: 'var(--space-8) var(--space-16)' }}>
      {/* ── Stepper Navigation ──────────────────────────────── */}
      <nav aria-label="Event wizard progress">
        <div className="wizard-stepper">
          {stepsList.map((s) => {
            const isCompleted = s.num < step
            const isActive = s.num === step
            const circleClass = isCompleted
              ? 'step-circle step-circle--completed'
              : isActive
              ? 'step-circle step-circle--active'
              : 'step-circle'
            const labelClass = isActive ? 'step-label step-label--active' : 'step-label'

            return (
              <div
                key={s.num}
                className="wizard-stepper-item"
                aria-current={isActive ? 'step' : undefined}
              >
                <div className={circleClass}>
                  {isCompleted ? '✓' : s.num}
                </div>
                <span className={labelClass}>{s.label}</span>
              </div>
            )
          })}
        </div>
      </nav>

      {/* ── Main Step Card ──────────────────────────────────── */}
      <div className="card card--raised" style={{ padding: 'var(--space-8)' }}>
        {/* Step 1: Event Type */}
        {step === 1 && (
          <div>
            <h2
              ref={stepHeaderRef}
              tabIndex={-1}
              style={{ fontFamily: 'var(--font-display)', color: 'var(--color-brand)', marginBottom: 'var(--space-2)', outline: 'none' }}
            >
              Step 1: Choose Your Celebration Type
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>
              Select the format that matches your event. UtsavFlow AI will customize your default budget envelopes and timeline countdown tasks accordingly.
            </p>

            <div className="grid-auto grid-auto--3" role="radiogroup" aria-label="Event Type">
              <div
                className={`option-card ${eventType === 'wedding' ? 'option-card--selected' : ''}`}
                onClick={() => setEventType('wedding')}
                role="radio"
                aria-checked={eventType === 'wedding'}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault()
                    setEventType('wedding')
                  }
                }}
              >
                <div className="option-card__title">
                  <span>💍 Wedding</span>
                  {eventType === 'wedding' && <span className="badge badge--brand">Selected</span>}
                </div>
                <p className="option-card__desc">
                  Multi-day celebrations with Sangeet, Mehendi, Haldi, banquet halls, and ceremonial timelines.
                </p>
              </div>

              <div
                className={`option-card ${eventType === 'birthday' ? 'option-card--selected' : ''}`}
                onClick={() => setEventType('birthday')}
                role="radio"
                aria-checked={eventType === 'birthday'}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault()
                    setEventType('birthday')
                  }
                }}
              >
                <div className="option-card__title">
                  <span>🎂 Birthday</span>
                  {eventType === 'birthday' && <span className="badge badge--brand">Selected</span>}
                </div>
                <p className="option-card__desc">
                  1st birthdays, 21st, 50th golden jubilees, cake arrangements, entertainment, and party favors.
                </p>
              </div>

              <div
                className={`option-card ${eventType === 'community' ? 'option-card--selected' : ''}`}
                onClick={() => setEventType('community')}
                role="radio"
                aria-checked={eventType === 'community'}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault()
                    setEventType('community')
                  }
                }}
              >
                <div className="option-card__title">
                  <span>🪅 Community Utsav</span>
                  {eventType === 'community' && <span className="badge badge--brand">Selected</span>}
                </div>
                <p className="option-card__desc">
                  Diwali, Navratri Garba, Ganesh Mahotsav, society gatherings, prasad catering, and public permits.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Event Details */}
        {step === 2 && (
          <div>
            <h2
              ref={stepHeaderRef}
              tabIndex={-1}
              style={{ fontFamily: 'var(--font-display)', color: 'var(--color-brand)', marginBottom: 'var(--space-2)', outline: 'none' }}
            >
              Step 2: Celebration Details &amp; Budget
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>
              Provide the foundational specs. These define your budget metrics and calendar timeline countdowns.
            </p>

            <div className="flex-col">
              {/* Event Name */}
              <div className="form-group">
                <label htmlFor="wizard-event-name" className="form-label form-label--required">
                  Event Name
                </label>
                <input
                  id="wizard-event-name"
                  type="text"
                  className={`form-input ${errors.name ? 'form-input--error' : ''}`}
                  placeholder={
                    eventType === 'wedding'
                      ? 'e.g. Priya & Arjun’s Wedding'
                      : eventType === 'birthday'
                      ? 'e.g. Aarav’s 1st Birthday Fiesta'
                      : 'e.g. Shanti Vihar Diwali Utsav'
                  }
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? 'error-event-name' : undefined}
                />
                {errors.name && (
                  <span id="error-event-name" className="form-error" role="alert">
                    {errors.name}
                  </span>
                )}
              </div>

              {/* Event Date */}
              <div className="form-group">
                <label htmlFor="wizard-event-date" className="form-label form-label--required">
                  Event Date (YYYY-MM-DD)
                </label>
                <input
                  id="wizard-event-date"
                  type="date"
                  className={`form-input ${errors.date ? 'form-input--error' : ''}`}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  aria-invalid={Boolean(errors.date)}
                  aria-describedby={errors.date ? 'error-event-date' : undefined}
                />
                {errors.date && (
                  <span id="error-event-date" className="form-error" role="alert">
                    {errors.date}
                  </span>
                )}
                {isPastDateWarning && (
                  <div className="alert alert--warning" style={{ marginTop: 'var(--space-2)' }} role="alert">
                    <span>⚠️</span>
                    <div>
                      <strong>Past Date Note:</strong> You have selected a date in the past ({date}). Your timeline tasks may be marked as overdue, but your input will be preserved.
                    </div>
                  </div>
                )}
              </div>

              {/* City */}
              <div className="form-group">
                <label htmlFor="wizard-event-city" className="form-label form-label--required">
                  City / Venue Location
                </label>
                <input
                  id="wizard-event-city"
                  type="text"
                  className={`form-input ${errors.city ? 'form-input--error' : ''}`}
                  placeholder="e.g. Mumbai, Jaipur, Delhi"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  aria-invalid={Boolean(errors.city)}
                  aria-describedby={errors.city ? 'error-event-city' : undefined}
                />
                {errors.city && (
                  <span id="error-event-city" className="form-error" role="alert">
                    {errors.city}
                  </span>
                )}
                <div className="chip-group" aria-label="Suggested cities">
                  {POPULAR_CITIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`chip ${city === c ? 'chip--active' : ''}`}
                      onClick={() => setCity(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Two Column: Guests & Budget */}
              <div className="grid-auto grid-auto--2">
                <div className="form-group">
                  <label htmlFor="wizard-guest-count" className="form-label form-label--required">
                    Approximate Guest Count
                  </label>
                  <input
                    id="wizard-guest-count"
                    type="number"
                    min="1"
                    max="100000"
                    className={`form-input ${errors.guestCount ? 'form-input--error' : ''}`}
                    value={guestCount}
                    onChange={(e) => setGuestCount(e.target.value)}
                    aria-invalid={Boolean(errors.guestCount)}
                    aria-describedby={errors.guestCount ? 'error-guest-count' : undefined}
                  />
                  {errors.guestCount && (
                    <span id="error-guest-count" className="form-error" role="alert">
                      {errors.guestCount}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="wizard-budget-total" className="form-label form-label--required">
                    Total Budget (INR ₹)
                  </label>
                  <input
                    id="wizard-budget-total"
                    type="text"
                    className={`form-input ${errors.budgetTotal ? 'form-input--error' : ''}`}
                    value={budgetTotal}
                    onChange={(e) => setBudgetTotal(e.target.value)}
                    placeholder="e.g. 500000"
                    aria-invalid={Boolean(errors.budgetTotal)}
                    aria-describedby={errors.budgetTotal ? 'error-budget-total' : undefined}
                  />
                  <span className="form-hint">
                    Formatted: <strong>{formatINR(parseINRInput(budgetTotal))}</strong>
                  </span>
                  {errors.budgetTotal && (
                    <span id="error-budget-total" className="form-error" role="alert">
                      {errors.budgetTotal}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Theme & Style Preferences */}
        {step === 3 && (
          <div>
            <h2
              ref={stepHeaderRef}
              tabIndex={-1}
              style={{ fontFamily: 'var(--font-display)', color: 'var(--color-brand)', marginBottom: 'var(--space-2)', outline: 'none' }}
            >
              Step 3: Theme &amp; Style Vision
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>
              Describe the aesthetic atmosphere or color palette you envision for your event.
            </p>

            <div className="form-group">
              <label htmlFor="wizard-theme" className="form-label">
                Theme Description (Optional)
              </label>
              <textarea
                id="wizard-theme"
                className={`form-textarea ${errors.theme ? 'form-textarea--error' : ''}`}
                rows={3}
                placeholder="e.g. Royal Marigold & Terracotta theme with floral arches, fairy light canopies, and traditional brass urlis."
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                maxLength={300}
              />
              <div className="flex-between">
                <span className="form-hint">Inspires future AI suggestions and decor planning.</span>
                <span className="form-hint">{theme.length}/300</span>
              </div>
              {errors.theme && (
                <span className="form-error" role="alert">
                  {errors.theme}
                </span>
              )}

              <div style={{ marginTop: 'var(--space-3)' }}>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--color-text-muted)' }}>
                  Popular themes for {eventType}:
                </span>
                <div className="chip-group">
                  {THEME_SUGGESTIONS[eventType]?.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`chip ${theme === t ? 'chip--active' : ''}`}
                      onClick={() => setTheme(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Dietary & Accessibility Needs */}
        {step === 4 && (
          <div>
            <h2
              ref={stepHeaderRef}
              tabIndex={-1}
              style={{ fontFamily: 'var(--font-display)', color: 'var(--color-brand)', marginBottom: 'var(--space-2)', outline: 'none' }}
            >
              Step 4: Hospitality &amp; Guest Care
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>
              Indian celebrations place hospitality first. Note special dietary constraints and mobility accommodations for your guests.
            </p>

            <div className="flex-col">
              {/* Dietary */}
              <div className="form-group">
                <label htmlFor="wizard-dietary" className="form-label">
                  Dietary Preferences &amp; Allergies
                </label>
                <textarea
                  id="wizard-dietary"
                  className={`form-textarea ${errors.dietary ? 'form-textarea--error' : ''}`}
                  rows={2}
                  placeholder="e.g. Pure vegetarian buffet with 20 Jain plates requested; nut allergy alert."
                  value={dietaryRequirements}
                  onChange={(e) => setDietaryRequirements(e.target.value)}
                  maxLength={300}
                />
                <div className="flex-between">
                  <span className="form-hint">Used to evaluate caterers and food menu items.</span>
                  <span className="form-hint">{dietaryRequirements.length}/300</span>
                </div>
                {errors.dietary && (
                  <span className="form-error" role="alert">
                    {errors.dietary}
                  </span>
                )}
                <div className="chip-group">
                  {DIETARY_SUGGESTIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      className="chip"
                      onClick={() => {
                        setDietaryRequirements((prev) =>
                          prev ? `${prev}; ${d}`.slice(0, 300) : d
                        )
                      }}
                    >
                      + {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Accessibility */}
              <div className="form-group">
                <label htmlFor="wizard-accessibility" className="form-label">
                  Accessibility &amp; Special Accommodations
                </label>
                <textarea
                  id="wizard-accessibility"
                  className={`form-textarea ${errors.accessibility ? 'form-textarea--error' : ''}`}
                  rows={2}
                  placeholder="e.g. Step-free wheelchair access from porch to dining hall; reserved front seating for elderly relatives."
                  value={accessibilityNeeds}
                  onChange={(e) => setAccessibilityNeeds(e.target.value)}
                  maxLength={300}
                />
                <div className="flex-between">
                  <span className="form-hint">Ensures seamless experience for elders and differently-abled guests.</span>
                  <span className="form-hint">{accessibilityNeeds.length}/300</span>
                </div>
                {errors.accessibility && (
                  <span className="form-error" role="alert">
                    {errors.accessibility}
                  </span>
                )}
                <div className="chip-group">
                  {ACCESSIBILITY_SUGGESTIONS.map((a) => (
                    <button
                      key={a}
                      type="button"
                      className="chip"
                      onClick={() => {
                        setAccessibilityNeeds((prev) =>
                          prev ? `${prev}; ${a}`.slice(0, 300) : a
                        )
                      }}
                    >
                      + {a}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Review & Confirmation */}
        {step === 5 && (
          <div>
            <h2
              ref={stepHeaderRef}
              tabIndex={-1}
              style={{ fontFamily: 'var(--font-display)', color: 'var(--color-brand)', marginBottom: 'var(--space-2)', outline: 'none' }}
            >
              Step 5: Review &amp; Create Your Event Plan
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>
              Confirm your event parameters. Once created, UtsavFlow AI will construct your dedicated workspace with initial budget envelopes and milestone timeline tasks.
            </p>

            <div className="card card--flat" style={{ marginBottom: 'var(--space-6)', background: 'var(--color-bg-subtle)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Event Type</div>
                  <div style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--color-text-primary)', textTransform: 'capitalize' }}>
                    {eventType}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Event Name</div>
                  <div style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--color-text-primary)' }}>
                    {name}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Target Date</div>
                  <div style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--color-text-primary)' }}>
                    {date} {isPastDateWarning && <span className="badge badge--warning">Past Date</span>}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>City / Location</div>
                  <div style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--color-text-primary)' }}>
                    {city}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Guests</div>
                  <div style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--color-text-primary)' }}>
                    {guestCount} Attendees
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Total Budget</div>
                  <div style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-brand)', fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)' }}>
                    {formatINR(parseINRInput(budgetTotal))}
                  </div>
                </div>
              </div>

              {theme && (
                <div style={{ marginBottom: 'var(--space-3)', borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-3)' }}>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Theme: </span>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>{theme}</span>
                </div>
              )}

              {dietaryRequirements && (
                <div style={{ marginBottom: 'var(--space-3)' }}>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Dietary: </span>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>{dietaryRequirements}</span>
                </div>
              )}

              {accessibilityNeeds && (
                <div>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Accessibility: </span>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>{accessibilityNeeds}</span>
                </div>
              )}
            </div>

            {/* Generated Perks Info */}
            <div className="alert alert--info" style={{ marginBottom: 'var(--space-6)' }}>
              <span>🚀</span>
              <div>
                <strong>Auto-Provisioned for You:</strong>
                <ul style={{ paddingLeft: 'var(--space-4)', marginTop: 'var(--space-1)', fontSize: 'var(--text-xs)' }}>
                  <li>Curated budget categories with 10% contingency reserve protection</li>
                  <li>Pre-configured countdown timeline tasks aligned with your celebration date</li>
                  <li>Zero data lock-in — export anytime as clean JSON</li>
                </ul>
              </div>
            </div>

            {errors.form && (
              <div className="alert alert--error" style={{ marginBottom: 'var(--space-4)' }} role="alert">
                {errors.form}
              </div>
            )}
          </div>
        )}

        {/* ── Wizard Footer Buttons ───────────────────────────── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 'var(--space-8)',
            borderTop: '1px solid var(--color-border-subtle)',
            paddingTop: 'var(--space-6)',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
          }}
        >
          <div>
            {step === 1 ? (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={onCancel}
              >
                Cancel
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--outline"
                onClick={handlePrevious}
              >
                &larr; Previous
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            {step < 5 ? (
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleNext}
                id="btn-wizard-next"
              >
                Continue &rarr;
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--accent btn--lg"
                onClick={handleCreate}
                id="btn-wizard-submit"
              >
                ✨ Create Event Plan
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
