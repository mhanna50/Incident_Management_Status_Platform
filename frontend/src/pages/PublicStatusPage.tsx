import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import * as incidentsApi from '../api/incidents'
import * as publicApi from '../api/public'
import type { Incident, PublicStatusResponse } from '../api/types'
import PublicLayout from '../components/PublicLayout'
import SeverityBadge from '../components/SeverityBadge'
import StatusBadge from '../components/StatusBadge'
import Timeline from '../components/Timeline'
import { useEventStream } from '../hooks/useEventStream'
import { useToast } from '../components/ToastProvider'
import { formatDateTime } from '../utils/incidents'

const PublicStatusPage = () => {
  const [status, setStatus] = useState<PublicStatusResponse | null>(null)
  const [history, setHistory] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [subscriberEmail, setSubscriberEmail] = useState('')
  const { addToast } = useToast()

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [statusResponse, incidents] = await Promise.all([
        publicApi.getPublicStatus(),
        incidentsApi.listIncidents(),
      ])
      setStatus(statusResponse)
      setHistory(incidents.filter((incident) => incident.is_public))
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
      await incidentsApi.subscribe({ email: subscriberEmail, scope: 'GLOBAL' })
      setSubscriberEmail('')
      addToast('Subscribed successfully')
    } catch (err) {
      addToast((err as Error).message)
    }
  }

  return (
    <PublicLayout title="Status & Trust Center" description="Live transparency and clear communications.">
      <div className="card page-block">
        <section className="status-banner" aria-live="polite">
          <p className="eyebrow">Current</p>
          <h2>{status?.overall_status || 'Loading status…'}</h2>
          <p>Realtime insight backed by the same console the ops team uses.</p>
        </section>

        <section>
          <header className="section-header">
            <div>
              <h3>Active incidents</h3>
              <p className="subtitle">Streaming from the admin SSE feed.</p>
            </div>
            <small>{new Date().toLocaleString()}</small>
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
                <p>{incident.summary}</p>
                {incident.latest_update && (
                  <div className="latest-update">
                    <strong>Latest update:</strong>
                    <p>{incident.latest_update.message}</p>
                    <small>{formatDateTime(incident.latest_update.created_at)}</small>
                  </div>
                )}
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

        <section>
          <header className="section-header">
            <div>
              <h3>Incident history</h3>
              <p className="subtitle">Public timeline for transparency.</p>
            </div>
          </header>
          <div className="incident-grid">
            {history.map((incident) => {
              const latestUpdate = incident.latest_update
              return (
                <article key={incident.id} className="incident-card compact">
                  <header>
                    <SeverityBadge severity={incident.severity} />
                    <StatusBadge status={incident.status} />
                  </header>
                  <h4>{incident.title}</h4>
                  <p>{incident.summary}</p>
                  {latestUpdate && <Timeline updates={[latestUpdate]} />}
                  <Link className="link" to={`/status/incidents/${incident.id}`}>
                    View detail
                  </Link>
                </article>
              )
            })}
          </div>
        </section>

        <section>
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
        </section>
      </div>
    </PublicLayout>
  )
}

export default PublicStatusPage
