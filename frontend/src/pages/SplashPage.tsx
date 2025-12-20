import { Link } from 'react-router-dom'

const endpointCards = [
  {
    title: 'Customer status',
    path: '/status',
    summary: 'Live status dashboard and real-time stream of active incidents.',
    details:
      'See ongoing work, severity, owners, and communication cadence exactly how customers would consume it.',
  },
  {
    title: 'Incident history',
    path: '/status/history',
    summary: 'Public archive of resolved incidents.',
    details: 'Browse the post-incident narrative and confirm that remediation work has been communicated.',
  },
  {
    title: 'Admin · Incidents',
    path: '/admin/incidents',
    summary: 'Ops console to declare, triage, and update incidents.',
    details: 'Create records, push timeline updates, and coordinate engineering/customer messaging.',
  },
  {
    title: 'Admin · Metrics',
    path: '/admin/metrics',
    summary: 'Operational pulse and automation watchlist.',
    details: 'Track MTTR, SLA drift, engagement signals, and automation gaps that need human attention.',
  },
  {
    title: 'Admin · Audit trail',
    path: '/admin/audit',
    summary: 'Single source of truth for communications.',
    details: 'Validate when updates were sent, who triggered them, and how the audit log reflects customer impact.',
  },
]

const apiEndpoints = [
  {
    method: 'GET',
    path: '/api/health/',
    summary: 'Simple heartbeat to confirm the Django stack is responding.',
  },
  {
    method: 'GET',
    path: '/api/incidents/',
    summary: 'List incidents that power the customer feed and admin grid.',
  },
  {
    method: 'POST',
    path: '/api/incidents/',
    summary: 'Declare an incident (title, summary, severity, visibility).',
  },
  {
    method: 'POST',
    path: '/api/incidents/{id}/updates/',
    summary: 'Publish a timeline update that fan-outs to the public page and subscribers.',
  },
  {
    method: 'POST',
    path: '/api/incidents/{id}/transition/',
    summary: 'Advance state (ACK, RESOLVE, CLOSE) and trigger audit logging.',
  },
  {
    method: 'GET',
    path: '/api/metrics/',
    summary: 'Same dataset driving the metrics dashboard, including automation alerts.',
  },
]

const demoLimitations = [
  'Authentication, SSO, RBAC, and audit-grade approvals are intentionally disabled so the demo is one click to explore.',
  '3rd-party delivery hooks (email/webhook/SMS) are mocked; wire your own provider keys before going beyond a sandbox.',
  'Data retention, multi-tenant isolation, and production observability tooling are simplified so the experience stays lightweight.',
]

const SplashPage = () => {
  return (
    <div className="splash-page">
      <div className="splash-shell">
        <section className="demo-callout">
          <h3>Heads up — this is a demo environment</h3>
          <p>
            The goal is to showcase product depth without gatekeeping access. Before production use, add the controls
            companies expect from a full incident platform.
          </p>
          <p className="splash-note">
            This demo runs on free Vercel + Northflank instances, so cold starts or refresh delays may occur while
            workers spin up.
          </p>
          <ul className="splash-list">
            {demoLimitations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="splash-hero">
          <p className="splash-eyebrow">Incident Management Status Platform</p>
          <h1>Operational command center for outages, comms, and customer trust.</h1>
          <div className="splash-actions">
            <Link to="/status" className="splash-button primary">
              View customer status page
            </Link>
            <Link to="/admin/incidents" className="splash-button ghost">
              Explore admin workspace
            </Link>
          </div>
        </section>

        <section className="splash-grid">
          <article className="splash-card span-full">
            <h3>Endpoints you can explore</h3>
            <p className="splash-card-subtitle">
              Each view mirrors a workflow: public trust, internal response, metrics, and audits. Pick a destination to
              jump straight in.
            </p>
            <div className="splash-endpoint-list">
              {endpointCards.map((card) => (
                <Link key={card.path} to={card.path} className="endpoint-card">
                  <div>
                    <p className="endpoint-label">{card.title}</p>
                    <strong>{card.summary}</strong>
                    <p>{card.details}</p>
                  </div>
                  <span aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          </article>
          <article className="splash-card span-full">
            <h3>Backend API endpoints</h3>
            <p>
              Everything on the frontend calls into the same public REST surface. Use curl, Postman, or your own scripts
              to exercise these endpoints and observe how UI + SSE feeds react.
            </p>
            <ul className="api-endpoint-list">
              {apiEndpoints.map((api) => (
                <li key={api.path}>
                  <div>
                    <span className="api-method">{api.method}</span>
                    <code>{api.path}</code>
                  </div>
                  <p>{api.summary}</p>
                </li>
              ))}
            </ul>
          </article>
          <div className="trio-grid">
            <article className="splash-card">
              <h3>Why I built it</h3>
              <p>
                Modern incident programs demand more than a status page. I wanted a portfolio piece that demonstrates
                product thinking across reliability ops, tooling, analytics, and customer trust.
              </p>
              <ul className="splash-list">
                <li>Showcase an always-on workflow, not just CRUD screens.</li>
                <li>Highlight how engineering, support, and leadership collaborate.</li>
                <li>Prove I can own UX, API design, automation, and storytelling.</li>
              </ul>
            </article>
            <article className="splash-card">
              <h3>How it was built</h3>
              <ul className="splash-list">
                <li>Django REST backend with Celery hooks, SSE streams, and analytics services.</li>
                <li>React + Vite frontend with themed layouts, admin/public shells, and manual SVG graphics.</li>
                <li>Structured CSS tokens for dark/light mode, accessible components, and toast-driven feedback.</li>
              </ul>
            </article>
            <article className="splash-card">
              <h3>Impact & scenarios</h3>
              <p>
                This demo mirrors an ops command center so hiring teams can see how I think about automation, auditability,
                and customer empathy. It can underpin portfolio talks, technical interviews, or case-study blog posts.
              </p>
              <p>
                Want to extend it? Plug in real monitoring, add RBAC, or connect notification providers to role-play a
                real on-call rotation.
              </p>
            </article>
          </div>
        </section>

        <footer className="splash-footer">
          <p>
            Built end-to-end across frontend, backend, and ops automation. Dive into the code, fork it, or message me if
            you want to pair on reliability tooling.
          </p>
        </footer>
      </div>
    </div>
  )
}

export default SplashPage
