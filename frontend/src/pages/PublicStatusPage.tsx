import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import * as incidentsApi from '../api/incidents'
import * as publicApi from '../api/public'
import { INCIDENT_SEVERITIES, type IncidentSeverity, type PublicStatusResponse } from '../api/types'
import PublicLayout from '../components/PublicLayout'
import SeverityBadge from '../components/SeverityBadge'
import StatusBadge from '../components/StatusBadge'
import { useEventStream } from '../hooks/useEventStream'
import { useToast } from '../components/ToastProvider'
import { formatDateTime } from '../utils/incidents'

const PublicStatusPage = () => {
  const [status, setStatus] = useState<PublicStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [subscriberEmail, setSubscriberEmail] = useState('')
  const [lastRefreshed, setLastRefreshed] = useState<string>('')
  const { addToast } = useToast()

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const statusResponse = await publicApi.getPublicStatus()
      setStatus(statusResponse)
      setLastRefreshed(new Date().toLocaleString())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEventStream('public', () => {
    fetchData()
    addToast('Status updated live')
  })

  const handleSubscribe = async (event: FormEvent) => {
    event.preventDefault()
    if (!subscriberEmail) return
    try {
      await incidentsApi.subscribe({
        email: subscriberEmail,
        scope: 'GLOBAL',
      })
      setSubscriberEmail('')
      addToast('Subscribed successfully')
    } catch (err) {
      addToast((err as Error).message)
    }
  }

  const subscribeFooter = (
    <div className="footer-subscribe">
      <h3>Subscribe for updates</h3>
      <p className="subtitle">We only email during real incidents.</p>
      <form className="form-inline" onSubmit={handleSubscribe}>
        <label className="sr-only" htmlFor="subscriber-email">
          Email address
        </label>
        <input
          id="subscriber-email"
          type="email"
          required
          placeholder="you@example.com"
          value={subscriberEmail}
          onChange={(event) => setSubscriberEmail(event.target.value)}
        />
        <button className="primary">Subscribe</button>
      </form>
    </div>
  )

  const activeCount = status?.active_incidents.length ?? 0
  const severityBreakdown = useMemo(() => {
    if (!status) return []
    const counts: Record<IncidentSeverity, number> = {
      SEV1: 0,
      SEV2: 0,
      SEV3: 0,
      SEV4: 0,
    }
    status.active_incidents.forEach((incident) => {
      counts[incident.severity] = (counts[incident.severity] ?? 0) + 1
    })
    return INCIDENT_SEVERITIES.map((severity) => ({
      severity,
      count: counts[severity] ?? 0,
    })).filter((entry) => entry.count > 0)
  }, [status])

  const heroSummary = activeCount
    ? `We're actively working on ${activeCount} incident${activeCount === 1 ? '' : 's'}.`
    : 'All services are operating normally.'
  const heroSubtle = activeCount
    ? 'Follow this page for live updates while our engineers mitigate impact.'
    : 'We continually monitor our platform and report transparently.'
  const bannerTone = activeCount ? 'alert' : 'ok'

  return (
    <PublicLayout
      title="Status & Trust Center"
      description="Live transparency and clear communications."
      footerContent={subscribeFooter}
    >
      <div className="card page-block">
        <section className={`status-banner ${bannerTone}`} aria-live="polite">
          <div className="status-banner-header">
            <p className="eyebrow">Current</p>
            <span className={`status-pill ${bannerTone}`}>
              {status?.overall_status || 'Loading status…'}
            </span>
          </div>
          <h2>{heroSummary}</h2>
          <p>{heroSubtle}</p>
          {activeCount > 0 && (
            <div className="status-breakdown-wrapper">
              <p className="subtitle">Focus areas</p>
              <ul className="status-breakdown">
                {severityBreakdown.map((entry) => (
                  <li key={entry.severity}>
                    <span className="status-dot" data-severity={entry.severity} />
                    {entry.count}× {entry.severity}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section>
          <header className="section-header">
            <div>
              <h3>Active incidents</h3>
              <p className="subtitle">Streaming from the admin SSE feed.</p>
            </div>
            <small>{lastRefreshed || 'Refreshing…'}</small>
          </header>
          {loading && <p>Loading…</p>}
          <div className="incident-grid">
            {status?.active_incidents.map((incident) => (
              <article key={incident.id} className="incident-card">
                <header>
                  <SeverityBadge severity={incident.severity} />
                  <StatusBadge status={incident.status} />
                </header>
                <h4>{incident.title}</h4>
                <div className="incident-card-body">
                  <p>{incident.summary}</p>
                  <div className="incident-owner">
                    <span className="incident-owner-label">Engineer</span>
                    <strong>{incident.created_by_name || 'Unassigned'}</strong>
                  </div>
                  <div className="latest-update">
                    <strong>Latest update:</strong>
                    {incident.latest_update ? (
                      <>
                        <p>{incident.latest_update.message}</p>
                        <small>
                          Sent by {incident.latest_update.created_by_name || 'System'} at{' '}
                          {formatDateTime(incident.latest_update.created_at)}
                        </small>
                      </>
                    ) : (
                      <p>No updates yet.</p>
                    )}
                  </div>
                </div>
                <Link className="link" to={`/status/incidents/${incident.id}`}>
                  View details
                </Link>
              </article>
            ))}
            {!loading && !status?.active_incidents.length && (
              <p className="empty">All systems operational.</p>
            )}
          </div>
        </section>
      </div>
    </PublicLayout>
  )
}

export default PublicStatusPage
