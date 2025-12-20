# Incident Management & Public Status Platform

![Backend Coverage](https://img.shields.io/badge/backend%20coverage-82%25-brightgreen?style=flat)
![Test Stack](https://img.shields.io/badge/tests-pytest%20%E2%80%A2%20vitest%20%E2%80%A2%20playwright-0b5fff?style=flat)

## Problem Statement
Every on-call engineer eventually needs a consistent way to declare incidents, communicate with customers, coordinate remediation, and publish postmortems. SaaS tools such as Statuspage or Atlassian Opsgenie solve this, but they are expensive and can’t easily be customized for a portfolio demo. This project recreates the “mini Statuspage + incident workflow” experience with production-grade patterns (transactions, SSE, emails, rate limiting, idempotency keys, Celery workers) so you can demo operational depth.

## Feature Highlights
- **Two first-class experiences**
  - **Admin Console**: create incidents, transition the lifecycle, post timeline updates, write postmortems, manage action items, view an audit log, and see live updates via SSE.
  - **Public Status Page**: shows real-time overall status, active incidents, history, public postmortems, and opt-in email subscriptions.
- **Stateful incident workflow** with strict transitions (`Investigating → Identified → Monitoring → Resolved`, with an optional reopen).
- **Transactional writes**: incident updates, timeline entries, and audit events commit atomically with `transaction.atomic()` and `transaction.on_commit()` hooks.
- **Notifications with delivery tracking**: every subscriber email creates an `EmailDelivery` record that a Celery task sends + retries with exponential backoff.
- **Real-time updates**: SSE streams for admin and public audiences emit typed events with IDs, replay support, and heartbeat packets.
- **Reliability guardrails**: idempotency keys on critical POST endpoints, rate limiting for subscription spam mitigation, caching for `/api/public/status`, and DB indexes for common queries.
- **Observability & analytics**: Structured JSON logging (Structlog), OpenTelemetry traces, Prometheus metrics (`/metrics`) for Grafana, a `/healthz` endpoint, and in-app MTTR/severity analytics for operators.

## Architecture Overview

```
                ┌──────────────────────────────────┐
                │          React Frontend          │
                │  - Admin routes (/admin/…)       │
                │  - Public status (/status/…)     │
                │  - EventSource to /api/stream/*  │
                └──────────────┬───────────────────┘
                               │ HTTPS (REST + SSE)
               ┌───────────────▼───────────────────┐
               │  Django + DRF (backend/config)    │
               │  - incidents app                  │
               │  - DRF serializers/views          │
               │  - Idempotency + rate limit mixin │
               │  - Cache + SSE broadcaster        │
               └───────────────┬───────────────────┘
                       DB/API  │ Celery tasks
┌───────────────────────▼──────▼──────┐     ┌────────────────────────┐
│        SQLite (dev) / Postgres       │     │   Celery worker(s)     │
│  - Incident, IncidentUpdate, Audit   │<────│ send_email_delivery    │
│  - Postmortem, ActionItem, Delivery  │     │ broker = Redis         │
└──────────────────────────────────────┘     └────────────────────────┘
```

> _Production note_: swap SQLite for Postgres, configure Redis for both caching and Celery, and point `EMAIL_BACKEND` to SendGrid’s SMTP.

## State Machine

| Current Status  | Allowed Next Statuses        |
|-----------------|-----------------------------|
| INVESTIGATING   | IDENTIFIED, MONITORING, RESOLVED |
| IDENTIFIED      | MONITORING, RESOLVED        |
| MONITORING      | RESOLVED                    |
| RESOLVED        | INVESTIGATING (reopen)      |

Transitions execute inside a single DB transaction. Audit events + timeline entries are recorded atomically, then SSE/email notifications fire inside `transaction.on_commit` callbacks to avoid notifying on rolled-back writes.

## SSE Implementation
- **Channels**: `/api/stream/admin` and `/api/stream/public`.
- **Event types**: `INCIDENT_CREATED`, `INCIDENT_UPDATED`, `INCIDENT_STATUS_CHANGED`, `INCIDENT_UPDATE_POSTED`, `POSTMORTEM_PUBLISHED`.
- **Event IDs & replay**: each event increments a global counter. Clients automatically replay missed events by reconnecting with the `Last-Event-ID` header or `?last_event_id=` query.
- **Heartbeats**: when no events arrive for ~15 seconds, the server emits `: heartbeat` comments to keep connections alive.
- **Frontend handling**: React subscribes with `EventSource` wrappers that listen for the named event types and refetch relevant data or patch local state, showing a toast “New incident update received”.

## Observability & Monitoring
- **Structured logging**: Django routes all logs through Structlog, producing JSON you can ingest into ELK/Sumo/etc.
- **Tracing**: OpenTelemetry auto-instruments Django. Set `OTEL_EXPORTER_OTLP_ENDPOINT` + `OTEL_SERVICE_NAME` to stream spans to Tempo/Jaeger and visualize alongside Grafana dashboards.
- **Metrics**: `django-prometheus` exposes `/metrics` for Prometheus → Grafana dashboards (requests, DB latency, Celery timings, etc.).
- **Health check**: `/healthz` tests database + cache connectivity and returns uptime seconds. Point any uptime monitor (Better Uptime, Pingdom) at it.
- **Operator analytics**: the admin incidents page now shows MTTR, active counts, resolved-in-7-days, and per-severity distribution computed server-side.

## Accessibility & UX Polish
- **Keyboard-first modals**: the shared `Modal` component traps focus, announces itself via `role="dialog"` + `aria-labelledby`, and exposes close hotkeys so every create/edit flow is keyboard accessible.
- **ARIA-rich components**: navigation landmarks, status badges (`role="status"`), and toast notifications provide screen-reader hints, while timelines add `aria-label` annotations for chronological context.
- **Dark-mode toggle + responsive layout**: CSS custom properties power both light (default) and dark palettes; Tailwind-like utility classes (via plain CSS) ensure cards collapse into a single column under 768px for mobile readability.
- **Real-world polish**: timeline avatars (initials bubble), incident search, status/severity filters, tagging chips, and draftable “incident templates” make the UI feel like an internal tool instead of a toy.
- **What to avoid**: no loud gradients, over-animated transitions, novelty fonts, or rainbow color palettes. Buttons/components share a single rounded style with consistent spacing so the UI reads as calm and professional.

### Layout Blueprint (copy for new screens)
1. **App shell** with a persistent left sidebar for admin routes and a top bar containing search plus a primary “Create Incident” button.
2. **Main content** uses cards with generous padding, subtle dividers, and responsive grids. Admin pages lean into an internal-tools vibe; the public status page emphasizes trust with marketing-tier typography and whitespace.

### Color & Typography Rules
- Base palette: light-gray background, white cards, dark-gray text, muted borders. Reserve saturated colors for status/severity/alerts to keep the focus on operational data.
- Status colors (consistent across badges + charts):
  - Operational / Resolved → green
  - Degraded / Monitoring → amber
  - Partial outage / Identified → orange
  - Major outage / Investigating → red
- Severity chips:
  - **SEV1** red
  - **SEV2** orange
  - **SEV3** yellow
  - **SEV4** blue-gray
- Buttons follow the same neutral palette with one accent (teal) for primary actions to avoid mismatched styling.

## Email Notification Rules
| Trigger | Recipients | Email Body |
|---------|------------|------------|
| Incident created | Global + incident subscribers | Title, severity, initial summary |
| Status change | Subscribers linked to incident | Actor + status change message |
| Timeline update | Incident subscribers | Author + update text |
| Postmortem published | Incident subscribers | Summary and direct link |

Deliveries are stored in `EmailDelivery` rows with status (`PENDING`, `SENT`, `FAILED`), attempt counts, timestamps, and last error text. The Celery worker (`incidents.tasks.send_email_delivery`) retries with exponential backoff until it either succeeds or marks the row as `FAILED`. You can inspect these rows via the Django admin or a future dashboard.

## Getting Started

### Prerequisites
- Python 3.13+
- Node.js 20+
- Redis (for Celery in production; In dev we run Celery in eager mode by default)
- (Optional) Docker to spin up Redis quickly

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# Apply migrations
python manage.py migrate
# Seed demo data (optional)
python manage.py seed_demo

# (Optional) run Redis -> celery worker for background emails
docker run -p 6379:6379 redis:7
export CELERY_TASK_ALWAYS_EAGER=false
celery -A config worker -l info  # use a separate terminal

# Start API server
python manage.py runserver
```

#### Resetting demo data / clearing the audit log
- **Reset to curated demo content (recommended)**  
  ```bash
  python manage.py seed_demo
  ```  
  This wipes incidents, timeline updates, postmortems, action items, and the audit log before reseeding showcase data so every admin/public view has meaningful scenarios.
- **Start from a blank database**  
  ```bash
  python manage.py flush
  python manage.py migrate
  ```  
  Optionally rerun `python manage.py seed_demo` if you want the curated incidents back after testing.

Environment variables (set via `.env` or export):
- `CELERY_BROKER_URL` / `CELERY_RESULT_BACKEND` – defaults to `redis://127.0.0.1:6379/0`.
- `CELERY_TASK_ALWAYS_EAGER` – defaults to `true` for local dev (emails send inline); set to `false` when running a worker.
- `DEFAULT_FROM_EMAIL`, `EMAIL_BACKEND` – configure for SendGrid/SMTP in prod.

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
# Build or lint
npm run build
npm run test -- --run
```
`frontend/.env` already points `VITE_API_BASE_URL` to `http://127.0.0.1:8000/api`.

## Testing & Quality Gates
- **Backend integration + coverage**: `cd backend && source venv/bin/activate && pytest --cov --ds=config.settings`.  
  Uses DRF’s `APIClient` fixtures in `backend/tests/` to exercise the real endpoints (incident CRUD, transitions, analytics, SSE buffers). Coverage reports emit to `.coverage` + `htmlcov/`.
- **Frontend unit coverage**: `cd frontend && npm run test -- --run` for fast feedback. Enable coverage with `npm run test -- --run --coverage` (install `@vitest/coverage-v8` once you’re back online) to generate reports in `frontend/coverage/unit`.
- **Playwright smoke tests**: `cd frontend && npx playwright install && npm run dev` (pane 1), `cd backend && python manage.py runserver` (pane 2), then `cd frontend && npm run test:e2e`. These specs (`frontend/playwright/status.spec.ts`) verify that `/status` and `/admin/incidents` render while the servers stream live data. Override `PLAYWRIGHT_BASE_URL` to target a deployed frontend.
- **Type checks / build**: `npm run build` (runs `tsc -b` + Vite) and `npm run lint` to enforce React/Vite best practices.

The backend suite includes the new DRF integration coverage to prove API conformance, the frontend Vitest suite guards shared helpers + API clients, and Playwright gives you a repeatable smoke test for demos or CI.

## Screenshots / Demo
- `frontend/docs/screenshots/admin-incidents.png` – Admin incidents grid with live filters (placeholder, add your screenshot)
- `frontend/docs/screenshots/public-status.png` – Public status page showing real-time incidents
- `frontend/docs/screenshots/postmortem.png` – Postmortem editor with action items

Add GIFs or Loom links here to elevate the README when presenting to interviewers.

## Key Endpoints (DRF)
| Method | Path | Purpose |
|--------|------|---------|
| GET /api/incidents | List incidents for admin console |
| POST /api/incidents | Create incident (idempotent + rate limited) |
| GET /api/incidents/analytics | MTTR + severity distribution for admin dashboard |
| GET /api/incidents/:id | Incident details |
| PATCH /api/incidents/:id | Update fields (partially) |
| POST /api/incidents/:id/transition | Transition state machine (idempotent) |
| GET/POST /api/incidents/:id/updates | Timeline listing + new updates (idempotent POST) |
| GET/POST/PATCH /api/incidents/:id/postmortem | Draft + update postmortem |
| POST /api/incidents/:id/postmortem/publish | Publish + notify subscribers |
| GET /api/incidents/:id/postmortem/export | Download Markdown export (action items + timeline) |
| GET /api/incidents/:id/postmortem/action-items | List action items |
| POST/PATCH action items | Manage corrective actions |
| GET /api/audit | Latest audit trail |
| POST /api/subscribers | Subscribe globally or per-incident (rate limited + idempotent) |
| GET /api/public/status | Cached aggregate status for public page |
| GET /api/public/incidents/:id | Public incident details |
| GET /api/public/incidents/:id/postmortem | Published postmortem |
| GET /api/stream/admin | SSE stream (admin events) |
| GET /api/stream/public | SSE stream (public-safe events) |
| GET /healthz | Health probe (DB, cache, uptime) |
| GET /metrics | Prometheus metrics for Grafana/Prometheus |

## Future Work / Roadmap
1. **Auth & RBAC** – add admin authentication (Django session or JWT) and per-action permissions.
2. **Distributed SSE** – replace in-memory broadcaster with Redis pub/sub so multiple Gunicorn workers or app instances stay in sync.
3. **Background workers at scale** – move long-running tasks (Markdown export, subscriber CSV import) onto Celery + beat schedules.
4. **Advanced analytics** – forecasting, SLO burn-rate widgets, and CSV exports on top of the existing MTTR/severity cards.
5. **Subscriber preferences** – digest vs immediate alerts, SMS push, Slack webhooks.
6. **Infrastructure as Code / Deployment** – Terraform for Render/Fly/Railway + Vercel, and integrate CI (GitHub Actions) that runs the test/build suites automatically.

## Inspiration & Why It Matters
This repository is designed to show recruiters/interviewers that you understand:
- How to model real operational workflows in Django.
- Why transactions, idempotency, and rate limits are critical for incident tooling.
- How to build a modern, TypeScript-based SPA that consumes SSE feeds and surfaces the right UX affordances (filters, modals, tabs, toasts).
- How to integrate Celery, Redis, and email delivery to move side effects off the request path.

Clone it, run it locally, deploy it to Vercel + Render/Fly, and include screenshots + metrics in your portfolio to stand out. Happy building! 
