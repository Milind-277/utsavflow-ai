# UtsavFlow AI — Celebration & Event Planner

> **AI-Powered Celebration & Event Planner** for weddings, milestone birthdays, and community festivals. Built for **PromptWars Problem Statement 5 (Celebration & Event Planner)**.

[![Tests](https://img.shields.io/badge/tests-254%20passed-brightgreen.svg)](#testing--verification)
[![Frontend Tests](https://img.shields.io/badge/frontend%20tests-223%20passed-brightgreen.svg)](#frontend-tests)
[![Backend Tests](https://img.shields.io/badge/backend%20tests-31%20passed-brightgreen.svg)](#backend-tests)
[![Audit](https://img.shields.io/badge/npm%20audit-0%20vulnerabilities-brightgreen.svg)](#security-audit)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](#architecture)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## Table of Contents
1. [Product Overview & Target Users](#product-overview--target-users)
2. [Problem Statement 5 Capabilities](#problem-statement-5-capabilities)
3. [Architecture & Data Flow](#architecture--data-flow)
4. [Prerequisites & Quick Start](#prerequisites--quick-start)
5. [Scripts & Commands (Windows PowerShell & Bash)](#scripts--commands-windows-powershell--bash)
6. [Environment Configuration & Gemini Setup](#environment-configuration--gemini-setup)
7. [Privacy Consent & Security Architecture](#privacy-consent--security-architecture)
8. [End-to-End User Guide](#end-to-end-user-guide)
9. [Production Deployment Guide](#production-deployment-guide)
10. [Demo Walkthrough & Pre-Flight Checklist](#demo-walkthrough--pre-flight-checklist)
11. [Testing & Verification Results](#testing--verification-results)
12. [Known Limitations](#known-limitations)

---

## Product Overview & Target Users

Planning large celebrations—such as multi-day Indian weddings (*Vivaha*, *Sangeet*, *Mehendi*), landmark birthdays, and neighborhood cultural festivals (*Diwali*, *Durga Puja*, *Ganesh Utsav*)—is notoriously stressful. Planners juggle complex budgets across diverse vendor categories, strict vendor advance and milestone payment schedules, non-linear preparation timelines, and creative theme/decor ideation.

**UtsavFlow AI** provides a privacy-first, zero-infrastructure event planning workspace designed specifically for:
- **Couples & Families** planning Indian weddings or milestone family celebrations who need clear budget boundaries and vendor payment tracking.
- **Independent Event Organizers & Friends** coordinating community gatherings, reunions, and club celebrations.
- **Budget-Conscious Hosts** who want financial peace of mind with automatic reserve allocation and overage alerts.

---

## Problem Statement 5 Capabilities

UtsavFlow AI delivers all six core capabilities required for Problem Statement 5:

| # | Capability | Implementation Highlights |
|---|---|---|
| **1** | **Multi-Step Event Wizard** | 5-step guided flow: Event Type & Basics → Date & Venue City → Guest Count & Scale → Budget & Reserve Allocation → Cultural Preferences & Accessibility. Form validation via strict Zod schemas with accessible error states and smart defaults. |
| **2** | **Budget Guard & Financial Invariants** | Pure arithmetic calculations (`lib/budget.ts`): Allocated Budget, Estimated Costs, Actual Expenses, Contingency Reserve (`floor(total × pct / 100)`), Unallocated Funds, Allocation Overage, and Remaining Balance. Never allows rounding drift; prevents overspend with visual and accessible `role="alert"` warnings. |
| **3** | **Smart Timeline Engine** | Timezone-safe calendar date-only arithmetic (`lib/dateOnly.ts`) preventing UTC midnight off-by-one errors. Milestone generation tied to event dates, task priority filters, custom task creation, and two-way progress completion sync. |
| **4** | **Vendor Directory & Payment Bridge** | Two-dimensional vendor accounting: `bookingStatus` (`enquiring`, `booked`, `cancelled`) and `paymentStatus` (`unpaid`, `partial`, `paid`). Paid amounts automatically bridge to actual budget expenses; quotes bridge to estimated costs. Deletions and cancellations safely preserve financial invariants without double-counting. |
| **5** | **AI Ideas Studio** | Integration with Google Gemini (`@google/genai` official SDK, configurable `GEMINI_MODEL: default('gemini-3.8-flash')`). Governed by an explicit, informed consent gate, data minimization contract (exact budgets, exact dates, and vendor details are never transmitted), rate limiting, bounded retry with `Retry-After`, and automatic offline demo fallback. |
| **6** | **Plan Export & Lifecycle** | Complete plan export to sanitized JSON backups, printer-friendly CSS stylesheet (`@media print`), deterministic demo plan loader with future-relative dates, and safe plan reset. |

---

## Architecture & Data Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                          CLIENT (BROWSER)                              │
│                                                                        │
│   React 18 + TypeScript + Vite  ───  Vanilla CSS Design Tokens        │
│   ├── Event Creation Wizard (5 Steps)                                 │
│   ├── Overview & Health Dashboard                                      │
│   ├── Budget Guard (Pure Math Invariants)                             │
│   ├── Smart Timeline (Date-Only Arithmetic)                           │
│   ├── Vendor Directory & Payment Bridge                                │
│   └── AI Ideas Studio (Informed Consent Gate)                          │
│                                                                        │
│   Storage: Versioned localStorage (EventPlanSchema v1 validation)      │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                   Informed Consent: │ POST /api/ai/ideas
                   Minimized Payload │ (Only: eventType, city, season,
                   (No Private Data) │  guestCount, budgetBand, theme)
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        BACKEND SERVER (EXPRESS)                        │
│                                                                        │
│   ├── Helmet CSP & CORP Headers                                        │
│   ├── CORS Origin Allowlist Validation                                 │
│   ├── Request Size Boundary: 8 KB JSON Limit                           │
│   ├── Express Rate Limiter: 10 requests / minute / IP                  │
│   ├── Configurable Proxy Trust (TRUST_PROXY: loopback / 1)             │
│   ├── Zod Schema Inbound Validation (IdeaRequestSchema)               │
│   └── In-Memory Idempotency Cache (1,000 entries max with LRU eviction)│
│                                                                        │
│               ┌───────────────────┴───────────────────┐                │
│               │                                       │                │
│         GEMINI_API_KEY set?                      No Key / Demo         │
│               ▼                                       ▼                │
│   ┌───────────────────────┐               ┌───────────────────────┐    │
│   │ Google Gemini 3.8     │               │ Deterministic Demo    │    │
│   │ Official SDK (@google/│               │ Generator             │    │
│   │ genai)                │               │ (Wedding/Birthday/    │    │
│   │ Timeout: 15s          │               │  Community)           │    │
│   │ Bounded Retries: 2x   │               └───────────┬───────────┘    │
│   └───────────┬───────────┘                           │                │
│               │                                       │                │
│               ▼                                       │                │
│   ┌───────────────────────┐                           │                │
│   │ Strict Zod Validation │                           │                │
│   │ (RawIdeasSchema: min  │                           │                │
│   │ <= max cost check)    │                           │                │
│   └───────────┬───────────┘                           │                │
│               └───────────────────┬───────────────────┘                │
│                                   ▼                                    │
│                 Response: { ideas, source, disclaimer }                │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites & Quick Start

### System Requirements
- **Node.js**: `v20.x` or later (tested on Node.js v20+)
- **npm**: `v10.x` or later
- **Operating System**: Windows 10/11, macOS, or Linux

### Installation
Clone or navigate to the project directory:

```powershell
# Windows PowerShell
cd d:\Prompt_War_Program\UtsavFlow_AI

# Install all dependencies (or run individually in frontend/ and backend/)
cd backend ; npm.cmd install ; cd ..\frontend ; npm.cmd install ; cd ..
```

---

## Scripts & Commands (Windows PowerShell & Bash)

Root `package.json` provides unified commands for convenience:

### Unified Commands (Run from Project Root)

| Command (PowerShell) | Action |
|---|---|
| `npm.cmd run typecheck` | Run TypeScript type checks across both backend and frontend |
| `npm.cmd run lint` | Run ESLint across both backend and frontend with zero-warning enforcement |
| `npm.cmd test` | Run all 254 Vitest unit and integration tests across backend and frontend |
| `npm.cmd run build` | Build backend (`tsc`) and frontend (`vite build`) for production |

### Individual Workspace Commands

#### Frontend (`frontend/`)
```powershell
cd frontend
npm.cmd run dev              # Start Vite dev server on http://localhost:5173
npm.cmd run typecheck        # TypeScript check
npm.cmd run lint             # ESLint (0 warnings allowed)
npm.cmd test                 # Run 223 Vitest tests
npm.cmd run build            # Production build to dist/
npm.cmd audit                # Security audit (0 vulnerabilities)
```

#### Backend (`backend/`)
```powershell
cd backend
npm.cmd run dev              # Start Express backend with tsx watch on http://localhost:3001
npm.cmd run typecheck        # TypeScript check
npm.cmd run lint             # ESLint (0 warnings allowed)
npm.cmd test                 # Run 31 Vitest + Supertest tests
npm.cmd run build            # Compile TypeScript to dist/
npm.cmd run start            # Run compiled production server
npm.cmd audit                # Security audit (0 vulnerabilities)
```

---

## Environment Configuration & Gemini Setup

### Backend Configuration (`backend/.env`)

Copy `backend/.env.example` to `backend/.env`:

```powershell
cd backend
Copy-Item .env.example .env
```

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `GEMINI_API_KEY` | **Optional** | *(empty)* | Google Gemini API key. If unset, backend operates smoothly in deterministic **Demo Mode**. |
| `GEMINI_MODEL` | No | `gemini-3.8-flash` | The Gemini model identifier. Overridable without modifying code. Never use deprecated models. |
| `PORT` | No | `3001` | Express server port. |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Allowed frontend origin for CORS headers. In production, set to your static frontend domain. |
| `NODE_ENV` | No | `development` | Set to `production` in live deployments to suppress dev error details. |
| `TRUST_PROXY` | No | `loopback` | Reverse proxy trust setting: `'loopback'` for local reverse proxies, `'false'` for direct connections, or `'1'` for Render/AWS ALB. |

> **Security Rule**: NEVER commit `backend/.env` or expose API keys. The `.gitignore` files at root and subfolders enforce this.

### Frontend Configuration (`frontend/.env`)

In local development, no `.env` file is needed—Vite's proxy automatically routes `/api/*` to `http://localhost:3001`.

For production static deployments, configure:
```env
VITE_API_BASE_URL=https://your-backend-service.onrender.com
```

---

## Privacy Consent & Security Architecture

### Data Minimization Contract

When requesting AI ideas, UtsavFlow strictly respects user privacy:

| Data Field | Sent to Google Gemini? | Reason |
|---|:---:|---|
| Event Type (`wedding`, `birthday`, `community`) | **YES** | Essential for theme and tradition context |
| Venue City (e.g. `Jaipur`, `Bengaluru`) | **YES** | Local seasonal and cultural context |
| Season (e.g. `Winter (December)`) | **YES** | Derived from date; weather and floral suitability |
| Guest Count Scale (e.g. `150`) | **YES** | Venue size and catering tier |
| Budget Band (e.g. `₹15 Lakhs - ₹50 Lakhs (Premium)`) | **YES** | Broad tier only; prevents unrealistic ideas |
| Theme & Cultural Preferences | **YES** | Aesthetic alignment |
| Dietary & Accessibility Needs | **YES** | Inclusivity requirements |
| **Exact Budget Amount** (e.g. `₹25,00,000`) | **NO** | Kept private in browser localStorage |
| **Exact Event Date** (e.g. `2027-02-14`) | **NO** | Replaced by generalized season string |
| **Event Name / Couple Names** | **NO** | Kept strictly private on client |
| **Vendor Names, Contacts & Contracts** | **NO** | Kept private in browser localStorage |
| **Payment History & Transaction Details** | **NO** | Kept private in browser localStorage |
| **Timeline Task List** | **NO** | Kept private in browser localStorage |

### Consent Control
- **Explicit Opt-in**: AI generation is gated behind an explicit consent checkbox.
- **Instant Revocation**: Users can revoke consent anytime with one click, instantly reverting to offline demo inspiration.
- **Transparent Source Tagging**: Every idea displays a badge clearly showing its source: `Gemini AI` or `Demo Idea`.

### Application Security Controls
- **Rate Limiting**: 10 requests / minute per IP on `/api/ai/*` to protect provider quotas.
- **8 KB Request Limit**: Prevents payload inflation attacks.
- **Idempotency Protection**: In-memory cache handles network retries safely without incurring duplicate provider costs.
- **XSS Prevention**: All AI text is rendered as safe text content; never evaluated with `dangerouslySetInnerHTML`.
- **Zero Secrets in Frontend**: `GEMINI_API_KEY` is strictly confined to the backend server.

---

## End-to-End User Guide

1. **Landing Page**: Launch the app at `http://localhost:5173`. Click **"Explore Demo Plan"** to load a pre-configured celebration, or **"Create My Event"** to start fresh.
2. **5-Step Wizard**:
   - Step 1: Choose event type (Wedding, Birthday, Community Festival) and title.
   - Step 2: Set future celebration date and city.
   - Step 3: Specify guest count and formality.
   - Step 4: Define total budget in INR (₹) and contingency reserve percentage (default 10%).
   - Step 5: Specify theme, dietary, and accessibility needs.
3. **Overview**: View celebration countdown, budget health meter, timeline completion progress, and quick actions.
4. **Budget Guard**: Inspect categories (Venue, Catering, Photography, etc.). Add custom expense items, allocate funds, monitor reserve, and review overage warnings.
5. **Smart Timeline**: Review chronological milestones. Add tasks, toggle completion status, filter by priority, and watch completion percentages update in real time.
6. **Vendor Directory**: Manage quotes, update booking status, log advance and milestone payments. Notice how logged payments immediately bridge into actual expenses in Budget Guard.
7. **AI Ideas Studio**:
   - Read the privacy disclosure.
   - Click "Explore Offline Demo Ideas" for instant ideas without network transmission.
   - Or check the consent box and click "Generate Ideas" to query the backend service.
   - Click "Add to Timeline" on any idea to convert it directly into a scheduled task.
8. **Export**: Export complete plan as formatted JSON, or trigger print layout (`Ctrl+P`) for physical checklists.

---

## Production Deployment Guide

UtsavFlow AI is configured for dual-tier hosting:
- **Frontend**: Static Web Hosting (Render Static Site, Vercel, Netlify, or Cloudflare Pages).
- **Backend**: Node.js Web Service (Render Web Service, Railway, or Fly.io).

### Automated Render Deployment via Blueprint

A complete `render.yaml` specification is included in the project root:

1. Push your repository to GitHub or GitLab.
2. Log in to [Render](https://render.com) and click **New > Blueprint**.
3. Connect your repository. Render reads `render.yaml` and provisions:
   - `utsavflow-backend`: Node.js web service running `npm install && npm run build` -> `npm run start`.
   - `utsavflow-frontend`: Static site running `npm install && npm run build` publishing `dist/`.
4. In Render Dashboard for `utsavflow-backend`:
   - Add environment secret `GEMINI_API_KEY` with your Google AI Studio key.
   - Set `CORS_ORIGIN` to your frontend static URL (e.g. `https://utsavflow-frontend.onrender.com`).
5. In Render Dashboard for `utsavflow-frontend`:
   - Set `VITE_API_BASE_URL` to your backend URL (e.g. `https://utsavflow-backend.onrender.com`).
6. Trigger a build. Both services will deploy and connect automatically.

### Production Health Check
The backend provides a public health check endpoint that exposes no secrets:
```
GET /api/health
Response: { "ok": true, "status": "healthy", "env": "production" }
```

---

## Demo Walkthrough & Pre-Flight Checklist

### 2–3 Minute Evaluator Walkthrough

1. **Landing & Demo Load (0:00–0:30)**:
   - Navigate to `http://localhost:5173`.
   - Click **"Explore Demo Plan"**.
   - Note the immediate load of "Aarav & Meera's Royal Jaipur Wedding" with valid future dates, categorized budget, milestone tasks, and registered vendors.
2. **Budget Guard & Math Invariants (0:30–1:00)**:
   - Switch to the **Budget** tab.
   - Highlight the top KPI bar: Total Budget (₹25,00,000), Allocated, Contingency Reserve (₹2,50,000), Unallocated, and Remaining Balance.
   - Edit an allocation or add an expense; observe instant, zero-lag recalculation without floating-point rounding errors.
3. **Timeline & Task Management (1:00–1:30)**:
   - Switch to the **Timeline** tab.
   - Check off a high-priority task (e.g. "Finalize Venue Contract").
   - Observe the progress bar advance and return to **Overview** to confirm two-way completion sync.
4. **Vendor Directory & Payment Bridge (1:30–2:00)**:
   - Switch to the **Vendors** tab.
   - Select a vendor (e.g. "Royal Palace Caterers").
   - Add a payment of ₹50,000. Observe `paymentStatus` update to `partial`.
   - Return to **Budget** tab and verify the Catering actual spend increased by exactly ₹50,000.
5. **AI Ideas Studio & Privacy Consent (2:00–2:45)**:
   - Switch to **AI Ideas** tab.
   - Note the informed consent gate and transparent privacy minimization table.
   - Click "Explore Offline Demo Ideas" or check consent and click "Generate Ideas".
   - Notice the honest source badge (`Gemini AI` or `Demo Idea`) and disclaimer.
   - Click "Add to Timeline" on an idea card to verify cross-tab integration.
6. **Export & Reset (2:45–3:00)**:
   - Click **Export JSON** to download a sanitized backup.
   - Click **Print / PDF** to verify clean print styling without UI chrome.

### Pre-Flight Checklist

- [x] **Desktop & Mobile Responsiveness**: Verified across 375px (iPhone SE), 390px (iPhone 14/15), 768px (iPad), and 1440px desktop.
- [x] **Keyboard Navigation**: Full Tab focus order across wizard, tab navigation, modals, and task checkboxes. Focus trap active in modals; `Escape` key closes dialogs.
- [x] **Screen-Reader Semantics**: Landmarks (`main`, `nav`, `header`), explicit `htmlFor`/`id` field labeling, `role="progressbar"`, `aria-busy` during fetch, and `role="alert"` for overage alerts.
- [x] **Refresh Persistence**: Validated browser reload restores complete `EventPlan` state from versioned `localStorage`.
- [x] **Graceful Error Handling**: 400 (validation), 429 (rate-limit with `Retry-After`), 502/503 (provider error), and network offline states all degrade gracefully to friendly user messages and offline demo ideas.

---

## Testing & Verification Results

### Test Suite Summary

```
========================================================================
UTILITY / SUITE                 TESTS     RESULT    NOTES
========================================================================
Frontend Unit & Component:
  - dateOnly.test.ts               30     PASS      Local-midnight arithmetic
  - budget.test.ts                 36     PASS      Reserve, overage & math invariants
  - currency.test.ts               28     PASS      INR formatting, words & parsing
  - timeline.test.ts               25     PASS      Milestones & task recalculation
  - vendors.test.ts                27     PASS      Double-count prevention & bridge
  - storage.test.ts                15     PASS      Schema migrations & corruption safety
  - aiIdeas.test.tsx               16     PASS      Consent, offline fallback, XSS safety
  - vendorDirectory.test.tsx       11     PASS      Vendor CRUD & payment UI
  - ui.test.tsx                    11     PASS      Wizard validation & step flow
  - budgetGuard.test.tsx           11     PASS      Category editing & overage alert
  - smartTimeline.test.tsx         13     PASS      Task completion & filtering
------------------------------------------------------------------------
Frontend Total:                   223     PASS      0 failures, 0 warnings
========================================================================
Backend Unit & Integration:
  - gemini.test.ts                  9     PASS      SDK provider, retries & error mapping
  - ai.test.ts                     22     PASS      Rate limits, idempotency & Zod schema
------------------------------------------------------------------------
Backend Total:                     31     PASS      0 failures, 0 warnings
========================================================================
GRAND TOTAL:                      254     PASS      100% passing across 13 suites
========================================================================
```

### Production Build Asset Accounting

Frontend production build (`npm.cmd run build` via Vite + Rollup):

| Asset Chunk | Raw Size | Gzipped Size | Purpose |
|---|---|---|---|
| `dist/index.html` | 1.11 kB | 0.58 kB | Entry HTML with semantic markup & preload tags |
| `dist/assets/index-DTzpO1gR.css` | 21.42 kB | 4.87 kB | Complete design system, tokens & print styles |
| `dist/assets/vendor-C3K92kjh.js` | 141.78 kB | 45.51 kB | React 18, React DOM, React Router, Zod |
| `dist/assets/index-DBWeHidw.js` | 248.73 kB | 61.95 kB | Application components, wizards & business logic |
| **Total JavaScript** | **390.51 kB** | **107.46 kB** | Combined vendor + application JS |
| **Total Production Assets** | **413.04 kB** | **112.91 kB** | Complete emitted production bundle |

### Security & Dependency Audit
- **Frontend `npm audit`**: 0 vulnerabilities.
- **Backend `npm audit`**: 0 vulnerabilities.

---

## Known Limitations

1. **Live Gemini Provider Smoke Test**: Marked **Pending** until an operator supplies a live Google Gemini API key in `backend/.env`. All automated tests use deterministic Vitest mocks, and the application includes complete, high-quality offline fallback ideas for all event types.
2. **Local Storage Single-User Scope**: Event plans are stored locally in the browser's `localStorage`. Multi-device real-time collaboration or multi-user access is out of scope for this serverless client architecture.
3. **Estimated vs. Contractual Pricing**: All budget estimates and AI suggested cost bands represent indicative market ranges for Indian metropolitan celebrations; final pricing must always be contracted directly with vendors.

---

## License

MIT License. Developed for PromptWars Problem Statement 5 (Celebration & Event Planner).
