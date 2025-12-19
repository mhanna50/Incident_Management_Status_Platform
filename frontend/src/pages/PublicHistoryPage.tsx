import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import * as incidentsApi from '../api/incidents'
import {
  INCIDENT_SEVERITIES,
  type Incident,
  type IncidentSeverity,
} from '../api/types'
import PublicLayout from '../components/PublicLayout'
import SeverityBadge from '../components/SeverityBadge'
import StatusBadge from '../components/StatusBadge'
import { useEventStream } from '../hooks/useEventStream'
import { useToast } from '../components/ToastProvider'
import { formatDateTime } from '../utils/incidents'

const PublicHistoryPage = () => {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [severityFilter, setSeverityFilter] = useState<IncidentSeverity | ''>('')
  const [search, setSearch] = useState('')
  const { addToast } = useToast()

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true)
      const data = await incidentsApi.listIncidents()
      setIncidents(
        data.filter((incident) => incident.is_public && incident.status === 'RESOLVED')
      )
    } catch (err) {
      addToast((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  useEventStream('public', () => {
    fetchHistory()
    addToast('History updated')
  })

  const handleSearch = (event: ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value)
  }

  const filtered = useMemo(() => {
    return incidents.filter((incident) => {
      const severityMatch = severityFilter ? incident.severity === severityFilter : true
      const query = search.trim().toLowerCase()
      const searchMatch = query
        ? `${incident.title} ${incident.summary}`.toLowerCase().includes(query)
        : true
      return severityMatch && searchMatch
    })
  }, [incidents, severityFilter, search])

  return (
    <PublicLayout
      title="Incident history"
      description="Explore every public incident after it has been fully resolved."
    >
      <div className="card page-block">
        <div className="filters">
          <label>
            Search
            <input
              type="search"
              value={search}
              onChange={handleSearch}
              placeholder="Search incidents"
            />
          </label>
          <label>
            Severity
            <select
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value as IncidentSeverity | '')}
            >
              <option value="">All</option>
              {INCIDENT_SEVERITIES.map((severity) => (
                <option key={severity} value={severity}>
                  {severity}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading && <p>Loading history…</p>}

        <div className="incident-grid">
          {filtered.map((incident) => {
            const latestUpdate = incident.latest_update
            const resolvedAt = incident.resolved_at || incident.updated_at
            return (
              <article key={incident.id} className="incident-card">
                <header>
                  <SeverityBadge severity={incident.severity} />
                  <StatusBadge status={incident.status} />
                </header>
                <h4>{incident.title}</h4>
                <div className="incident-card-body">
                  <p>{incident.summary}</p>
                  <div className="metadata">
                    <span>Opened {formatDateTime(incident.created_at)}</span>
                    <span>Resolved {formatDateTime(resolvedAt)}</span>
                  </div>
                  {latestUpdate && (
                    <div className="history-update">
                      <strong>{latestUpdate.created_by_name || 'System'}</strong>
                      <p>{latestUpdate.message}</p>
                      <small>Sent {formatDateTime(latestUpdate.created_at)}</small>
                    </div>
                  )}
                </div>
                <Link className="link" to={`/status/incidents/${incident.id}`}>
                  View details
                </Link>
              </article>
            )
          })}
          {!loading && !filtered.length && <p className="empty">No incidents match the filters.</p>}
        </div>
      </div>
    </PublicLayout>
  )
}

export default PublicHistoryPage
