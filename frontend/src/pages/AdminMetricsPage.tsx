import { useCallback, useEffect, useMemo, useState } from 'react'

import AdminLayout from '../components/AdminLayout'
import * as incidentsApi from '../api/incidents'
import type { MetricsResponse } from '../api/types'
import { INCIDENT_SEVERITIES, SEVERITY_LABELS } from '../api/types'
import { useToast } from '../components/ToastProvider'
import { useEventStream } from '../hooks/useEventStream'

const AdminMetricsPage = () => {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { addToast } = useToast()

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true)
      const payload = await incidentsApi.getAdminMetrics()
      setMetrics(payload)
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMetrics()
  }, [fetchMetrics])

  useEventStream('admin', (payload) => {
    if (payload.type.startsWith('INCIDENT')) {
      fetchMetrics()
      addToast('Metrics refreshed from new incident activity')
    }
  })

  const severityEntries = useMemo(() => {
    if (!metrics) return []
    return INCIDENT_SEVERITIES.map((severity) => ({
      severity,
      count: metrics.incident_pulse.severity_breakdown[severity] ?? 0,
    })).filter((entry) => entry.count > 0)
  }, [metrics])

  if (loading) {
    return (
      <AdminLayout title="Metrics dashboard">
        <p>Loading metrics…</p>
      </AdminLayout>
    )
  }

  if (error || !metrics) {
    return (
      <AdminLayout title="Metrics dashboard">
        <p className="error">{error ?? 'Unable to load metrics'}</p>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout
      title="Metrics dashboard"
      subtitle="Digest trends for incidents, resolution health, engagement, and automation."
    >
      <div className="card metrics-grid">
        <section className="metrics-section">
          <header className="section-header">
            <div>
              <h3>Incident pulse</h3>
              <p className="subtitle">Live active incidents for the last 48 hours.</p>
            </div>
          </header>
          <div className="metric-cards">
            <div className="metric-card spotlight">
              <div className="metric-card-header">
                <p>Open incidents</p>
                <span className="metric-pill">SLA ≤ {metrics.incident_pulse.sla_target}</span>
              </div>
              <strong className="metric-value">{metrics.incident_pulse.current_open}</strong>
              <small>
                {metrics.incident_pulse.current_open > metrics.incident_pulse.sla_target
                  ? 'Above desired threshold'
                  : 'Within desired threshold'}
              </small>
              <div className="progress-track" aria-label="SLA progress">
                <div
                  className={`progress-fill ${
                    metrics.incident_pulse.current_open > metrics.incident_pulse.sla_target ? 'warn' : 'ok'
                  }`}
                  style={{
                    width: `${Math.min(
                      (metrics.incident_pulse.current_open / metrics.incident_pulse.sla_target) * 100,
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>
            <div className="metric-card severity-card enhanced">
              <p>Severity mix</p>
              {severityEntries.length ? (
                <div className="severity-stack" role="img" aria-label="Active incidents by severity">
                  {severityEntries.map((entry) => (
                    <div
                      key={entry.severity}
                      className="severity-stack-segment"
                      data-severity={entry.severity}
                      style={{
                        width: `${
                          metrics.incident_pulse.current_open
                            ? (entry.count / metrics.incident_pulse.current_open) * 100
                            : 0
                        }%`,
                      }}
                    >
                      <span>
                        {entry.count}× {entry.severity}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty">No active incidents</p>
              )}
            </div>
          </div>
        </section>

        <section className="metrics-section">
          <header className="section-header">
            <div>
              <h3>Resolution health</h3>
              <p className="subtitle">MTTR trends and percentile performance.</p>
            </div>
          </header>
          <div className="metric-cards compact">
            <div className="metric-card compact">
              <p>P50 resolution</p>
              <strong>{metrics.resolution_health.percentiles.p50 ?? '—'} hrs</strong>
            </div>
            <div className="metric-card compact">
              <p>P90 resolution</p>
              <strong>{metrics.resolution_health.percentiles.p90 ?? '—'} hrs</strong>
            </div>
            <div className="metric-card visibility-card">
              <p>Visibility mix</p>
              <div className="visibility-breakdown">
                <span>Public: {metrics.resolution_health.visibility_breakdown.public}</span>
                <span>Internal: {metrics.resolution_health.visibility_breakdown.internal}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="metrics-section">
          <header className="section-header">
            <div>
              <h3>Engagement signals</h3>
              <p className="subtitle">Customer touch points across email and the status page.</p>
            </div>
          </header>
          <div className="metric-cards graphics">
            <div className="metric-card growth-card">
              <p>Subscriber signups (last 7 days)</p>
              <div className="bar-chart small">
                {metrics.engagement.subscriber_growth.map((entry) => (
                  <div key={entry.date} className="bar">
                    <div
                      className="bar-fill"
                      style={{ height: `${entry.count ? Math.min(entry.count * 25, 100) : 4}%` }}
                      aria-label={`${entry.date} subscribers ${entry.count}`}
                    />
                    <small>{entry.date.slice(5)}</small>
                  </div>
                ))}
              </div>
            </div>
            <div className="metric-card donut-card">
              <p>Email delivery</p>
              <div className="donut-chart">
                <svg viewBox="0 0 36 36">
                  <circle className="donut-ring" cx="18" cy="18" r="15.915" />
                  {metrics.engagement.email_delivery.map((entry, index) => {
                    const total = metrics.engagement.email_delivery.reduce((sum, item) => sum + item.count, 0) || 1
                    const offset = metrics.engagement.email_delivery
                      .slice(0, index)
                      .reduce((sum, item) => sum + (item.count / total) * 100, 0)
                    const circumference = (entry.count / total) * 100
                    return (
                      <circle
                        key={entry.status}
                        className={`donut-segment segment-${index}`}
                        cx="18"
                        cy="18"
                        r="15.915"
                        strokeDasharray={`${circumference} ${100 - circumference}`}
                        strokeDashoffset={100 - offset}
                      />
                    )
                  })}
                </svg>
                <div className="donut-legend">
                  {metrics.engagement.email_delivery.map((entry, index) => (
                    <span key={entry.status}>
                      <span className={`dot segment-${index}`} /> {entry.status}: {entry.count}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="metric-card area-card">
              <p>Status page views</p>
              <div className="area-chart">
                {metrics.engagement.status_page_views.map((entry) => (
                  <div key={entry.date} className="area-step">
                    <div className="area-fill" style={{ height: `${entry.views ?? 0}%` }} />
                    <small>{entry.date.slice(5)}</small>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="metrics-section">
          <header className="section-header">
            <div>
              <h3>Automation watchlist</h3>
              <p className="subtitle">Items that may require manual intervention.</p>
            </div>
          </header>
          <div className="watchlist-grid">
            <div className="watchlist-card">
              <h4>Stale incidents</h4>
              {metrics.automation_watchlist.stale_incidents.length ? (
                <ul className="list-plain">
                  {metrics.automation_watchlist.stale_incidents.map((item) => (
                    <li key={item.id}>
                      <strong>{item.title}</strong>
                      <p>{item.minutes_since_update} minutes since last update</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty">All active incidents are fresh.</p>
              )}
            </div>
            <div className="watchlist-card">
              <h4>Missing postmortems</h4>
              {metrics.automation_watchlist.missing_postmortems.length ? (
                <ul className="list-plain">
                  {metrics.automation_watchlist.missing_postmortems.map((item) => (
                    <li key={item.id}>
                      <strong>{item.title}</strong>
                      <span className="chip">{SEVERITY_LABELS[item.severity]}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty">All resolved incidents have a postmortem.</p>
              )}
            </div>
            <div className="watchlist-card">
              <h4>Overdue action items</h4>
              {metrics.automation_watchlist.overdue_action_items.length ? (
                <ul className="list-plain">
                  {metrics.automation_watchlist.overdue_action_items.map((item) => (
                    <li key={item.id}>
                      <strong>{item.title}</strong>
                      <p>Owner: {item.owner_name}</p>
                      <p>Due {item.due_date}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty">No overdue follow-ups.</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </AdminLayout>
  )
}

export default AdminMetricsPage
