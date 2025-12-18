import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import * as incidentsApi from '../api/incidents'
import {
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
  type Incident,
  type IncidentSeverity,
  type IncidentStatus,
} from '../api/types'
import { useEventStream } from '../hooks/useEventStream'
import { formatDateTime } from '../utils/incidents'
import AdminLayout from '../components/AdminLayout'
import Modal from '../components/Modal'
import SeverityBadge from '../components/SeverityBadge'
import StatusBadge from '../components/StatusBadge'
import { useToast } from '../components/ToastProvider'

const defaultForm = (): incidentsApi.CreateIncidentPayload => ({
  title: '',
  summary: '',
  severity: 'SEV3',
  status: 'INVESTIGATING',
  is_public: true,
  created_by_name: '',
})

const INCIDENT_TEMPLATES: Array<{ id: string; label: string; values: incidentsApi.CreateIncidentPayload }> = [
  {
    id: 'major-outage',
    label: 'SEV1 – Major outage',
    values: {
      title: 'Major outage impacting API',
      summary: 'Users cannot call the public API. We are mitigating with traffic shaping.',
      severity: 'SEV1',
      status: 'INVESTIGATING',
      is_public: true,
      created_by_name: '',
    },
  },
  {
    id: 'degraded-ui',
    label: 'SEV2 – Degraded performance',
    values: {
      title: 'Dashboard latency is elevated',
      summary: 'Admins see slow loads for analytics dashboards. Investigation underway.',
      severity: 'SEV2',
      status: 'IDENTIFIED',
      is_public: true,
      created_by_name: '',
    },
  },
  {
    id: 'internal-maintenance',
    label: 'SEV3 – Internal maintenance',
    values: {
      title: 'Planned maintenance for billing sync',
      summary: 'Back-office billing sync is paused while we deploy a fix.',
      severity: 'SEV3',
      status: 'MONITORING',
      is_public: false,
      created_by_name: '',
    },
  },
]

const TAG_OPTIONS: Array<{ label: string; predicate: (incident: Incident) => boolean }> = [
  { label: 'Customer-facing', predicate: (incident) => incident.is_public },
  { label: 'Internal-only', predicate: (incident) => !incident.is_public },
  { label: 'Active', predicate: (incident) => incident.active },
  { label: 'Resolved', predicate: (incident) => !incident.active },
]

const deriveTags = (incident: Incident) => {
  const tags: string[] = []
  tags.push(`Severity ${incident.severity}`)
  tags.push(incident.is_public ? 'Customer-facing' : 'Internal-only')
  tags.push(incident.active ? 'Active' : 'Resolved')
  return tags
}

const AdminIncidentsPage = () => {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<{ severity: IncidentSeverity | ''; status: IncidentStatus | '' }>(
    { severity: '', status: '' }
  )
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [analytics, setAnalytics] = useState<incidentsApi.IncidentAnalytics | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTags, setActiveTags] = useState<string[]>([])
  const { addToast } = useToast()

  const fetchIncidents = useCallback(async () => {
    try {
      setLoading(true)
      const data = await incidentsApi.listIncidents()
      setIncidents(data)
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchAnalytics = useCallback(async () => {
    try {
      const data = await incidentsApi.getIncidentAnalytics()
      setAnalytics(data)
    } catch (err) {
      console.error('Failed to load analytics', err)
    }
  }, [])

  useEffect(() => {
    fetchIncidents()
    fetchAnalytics()
  }, [fetchIncidents, fetchAnalytics])

  useEventStream('admin', (payload) => {
    if (payload.type.startsWith('INCIDENT')) {
      fetchIncidents()
      fetchAnalytics()
      addToast('New incident update received')
    }
  })

  const filteredIncidents = useMemo(() => {
    return incidents.filter((incident) => {
      const severityMatch = filters.severity ? incident.severity === filters.severity : true
      const statusMatch = filters.status ? incident.status === filters.status : true
      const searchMatch = searchTerm
        ? `${incident.title} ${incident.summary}`.toLowerCase().includes(searchTerm.toLowerCase())
        : true
      const tagMatch = activeTags.length
        ? activeTags.every((tag) => TAG_OPTIONS.find((option) => option.label === tag)?.predicate(incident))
        : true
      return severityMatch && statusMatch && searchMatch && tagMatch
    })
  }, [incidents, filters, searchTerm, activeTags])

  const handleCreateIncident = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    try {
      await incidentsApi.createIncident(form)
      setShowCreateModal(false)
      setForm(defaultForm)
      await fetchIncidents()
      addToast('Incident created')
    } catch (err) {
      addToast((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId)
    if (!templateId) {
      setForm(defaultForm())
      return
    }
    const template = INCIDENT_TEMPLATES.find((entry) => entry.id === templateId)
    if (template) {
      setForm((prev) => ({ ...prev, ...template.values }))
    }
  }

  const toggleTag = (tag: string) => {
    setActiveTags((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]))
  }

  return (
    <AdminLayout
      title="Incidents"
      subtitle="Search, template, and track every customer-facing moment."
      onSearch={setSearchTerm}
      searchValue={searchTerm}
      actions={
        <button className="primary" onClick={() => setShowCreateModal(true)}>
          + Create incident
        </button>
      }
    >
      <div className="card page-block">

      {analytics && (
        <div className="analytics-grid">
          <div className="analytics-card">
            <p>Active incidents</p>
            <strong>{analytics.active_incidents}</strong>
          </div>
          <div className="analytics-card">
            <p>MTTR</p>
            <strong>{analytics.mttr_hours !== null ? `${analytics.mttr_hours} hrs` : '—'}</strong>
          </div>
          <div className="analytics-card">
            <p>Resolved last 7 days</p>
            <strong>{analytics.resolved_last_7_days}</strong>
          </div>
          <div className="analytics-card">
            <p>Severity distribution</p>
            <div className="severity-distribution" role="list">
              {INCIDENT_SEVERITIES.map((severity) => (
                <div className="severity-chip" role="listitem" key={severity}>
                  <span className="severity-chip-label">{severity}</span>
                  <span className="severity-chip-value">
                    {analytics.incidents_per_severity[severity] ?? 0}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="filters">
        <label>
          Severity
          <select
            value={filters.severity}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, severity: event.target.value as IncidentSeverity | '' }))
            }
          >
            <option value="">All</option>
            {INCIDENT_SEVERITIES.map((severity) => (
              <option key={severity} value={severity}>
                {severity}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select
            value={filters.status}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, status: event.target.value as IncidentStatus | '' }))
            }
          >
            <option value="">All</option>
            {INCIDENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="tag-filter">
        {TAG_OPTIONS.map((tag) => (
          <button
            type="button"
            key={tag.label}
            className={activeTags.includes(tag.label) ? 'tag-chip active' : 'tag-chip'}
            onClick={() => toggleTag(tag.label)}
            aria-pressed={activeTags.includes(tag.label)}
          >
            {tag.label}
          </button>
        ))}
      </div>

      {loading && <p>Loading incidents…</p>}
      {error && <p className="error">{error}</p>}

      <div className="incident-grid">
        {filteredIncidents.map((incident) => (
          <article key={incident.id} className="incident-card">
            <header>
              <SeverityBadge severity={incident.severity} />
              <StatusBadge status={incident.status} />
            </header>
            <h3>{incident.title}</h3>
            <p>{incident.summary}</p>
            <div className="tag-list" aria-label="Incident tags">
              {deriveTags(incident).map((tag) => (
                <span key={tag} className="tag-chip subtle">
                  {tag}
                </span>
              ))}
            </div>
            <div className="incident-meta">
              <span>{incident.is_public ? 'Public' : 'Internal'}</span>
              <span>{formatDateTime(incident.created_at)}</span>
            </div>
            <Link className="link" to={`/admin/incidents/${incident.id}`}>
              View details →
            </Link>
          </article>
        ))}
        {!loading && !filteredIncidents.length && <p className="empty">No incidents match filters.</p>}
      </div>

      <Modal open={showCreateModal} title="Create incident" onClose={() => setShowCreateModal(false)}>
        <form className="form-grid" onSubmit={handleCreateIncident}>
          <label>
            Template
            <select value={selectedTemplate} onChange={(event) => handleTemplateSelect(event.target.value)}>
              <option value="">Blank incident</option>
              {INCIDENT_TEMPLATES.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Title
            <input
              required
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            />
          </label>
          <label>
            Summary
            <textarea
              required
              value={form.summary}
              onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))}
            />
          </label>
          <label>
            Severity
            <select
              value={form.severity}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, severity: event.target.value as IncidentSeverity }))
              }
            >
              {INCIDENT_SEVERITIES.map((severity) => (
                <option key={severity} value={severity}>
                  {severity}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              value={form.status}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, status: event.target.value as IncidentStatus }))
              }
            >
              {INCIDENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.is_public}
              onChange={(event) => setForm((prev) => ({ ...prev, is_public: event.target.checked }))}
            />
            Public incident
          </label>
          <label>
            Your name
            <input
              required
              value={form.created_by_name}
              onChange={(event) => setForm((prev) => ({ ...prev, created_by_name: event.target.value }))}
            />
          </label>
          <button className="primary" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create'}
          </button>
        </form>
      </Modal>
      </div>
    </AdminLayout>
  )
}

export default AdminIncidentsPage
