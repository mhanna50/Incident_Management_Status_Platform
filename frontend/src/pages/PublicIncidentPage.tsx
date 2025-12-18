import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import * as incidentsApi from '../api/incidents'
import * as publicApi from '../api/public'
import type { Incident, IncidentUpdate, Postmortem } from '../api/types'
import PublicLayout from '../components/PublicLayout'
import SeverityBadge from '../components/SeverityBadge'
import StatusBadge from '../components/StatusBadge'
import Timeline from '../components/Timeline'
import { useEventStream } from '../hooks/useEventStream'
import { useToast } from '../components/ToastProvider'
import { formatDateTime } from '../utils/incidents'

const extractIncidentId = (data: unknown): string | null => {
  if (!data || typeof data !== 'object') {
    return null
  }
  const record = data as { id?: string; incident?: { id?: string } }
  if (record.incident && typeof record.incident.id === 'string') {
    return record.incident.id
  }
  if (typeof record.id === 'string') {
    return record.id
  }
  return null
}

const PublicIncidentPage = () => {
  const { id = '' } = useParams()
  const [incident, setIncident] = useState<Incident | null>(null)
  const [updates, setUpdates] = useState<IncidentUpdate[]>([])
  const [postmortem, setPostmortem] = useState<Postmortem | null>(null)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const { addToast } = useToast()

  const fetchData = useCallback(async () => {
    if (!id) return
    try {
      setLoading(true)
      const [incidentData, updatesData] = await Promise.all([
        publicApi.getPublicIncident(id),
        incidentsApi.listUpdates(id),
      ])
      setIncident(incidentData)
      setUpdates(updatesData)
      try {
        const postmortemData = await publicApi.getPublicPostmortem(id)
        setPostmortem(postmortemData)
      } catch {
        setPostmortem(null)
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEventStream('public', (payload) => {
    const payloadIncidentId = extractIncidentId(payload.data)
    if (payloadIncidentId && payloadIncidentId === id) {
      fetchData()
      addToast('Incident updated')
    }
  })

  const handleSubscribe = async (event: FormEvent) => {
    event.preventDefault()
    if (!id || !email) return
    try {
      await incidentsApi.subscribe({ email, scope: 'INCIDENT', incident: id })
      setEmail('')
      addToast('Subscribed to incident')
    } catch (err) {
      addToast((err as Error).message)
    }
  }

  if (loading) {
    return (
      <PublicLayout title="Incident detail">
        <p>Loading incident…</p>
      </PublicLayout>
    )
  }

  if (!incident) {
    return (
      <PublicLayout title="Incident detail">
        <p className="error">Incident not found.</p>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout title={incident.title} description={incident.summary}>
      <div className="card incident-detail">
        <Link className="link" to="/status">
          ← Back to status
        </Link>
        <header className="incident-detail-header">
          <div>
            <h2>{incident.title}</h2>
            <p>{incident.summary}</p>
          </div>
          <div className="badges">
            <SeverityBadge severity={incident.severity} />
            <StatusBadge status={incident.status} />
          </div>
        </header>
        <div className="metadata">
          <span>Opened {formatDateTime(incident.created_at)}</span>
          <span>Latest activity {formatDateTime(incident.updated_at)}</span>
        </div>

        <section>
          <h3>Timeline</h3>
          <Timeline updates={updates} />
        </section>

        <section>
          <h3>Subscribe to this incident</h3>
          <form className="form-inline" onSubmit={handleSubscribe}>
            <label className="sr-only" htmlFor="incident-email">
              Email address
            </label>
            <input
              id="incident-email"
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <button className="primary">Subscribe</button>
          </form>
        </section>

        {postmortem && (
          <section className="postmortem-template">
            <h3>Postmortem</h3>
            <p>Published {postmortem.published_at ? formatDateTime(postmortem.published_at) : ''}</p>
            <div className="postmortem-section">
              <h4>Summary</h4>
              <p>{postmortem.summary || 'TBD'}</p>
            </div>
            <div className="postmortem-section">
              <h4>Impact</h4>
              <p>{postmortem.impact || 'TBD'}</p>
            </div>
            <div className="postmortem-section">
              <h4>Root cause</h4>
              <p>{postmortem.root_cause || 'TBD'}</p>
            </div>
            <div className="postmortem-section">
              <h4>Detection</h4>
              <p>{postmortem.detection || 'TBD'}</p>
            </div>
            <div className="postmortem-section">
              <h4>Resolution</h4>
              <p>{postmortem.resolution || 'TBD'}</p>
            </div>
            <div className="postmortem-section">
              <h4>Lessons learned</h4>
              <p>{postmortem.lessons_learned || 'TBD'}</p>
            </div>
            <div className="postmortem-section">
              <h4>Corrective actions</h4>
              <ul>
                {postmortem.action_items.map((item) => (
                  <li key={item.id}>
                    <strong>{item.title}</strong> — {item.status} (Owner: {item.owner_name})
                  </li>
                ))}
                {!postmortem.action_items.length && <p>Action items in progress.</p>}
              </ul>
            </div>
          </section>
        )}
      </div>
    </PublicLayout>
  )
}

export default PublicIncidentPage
