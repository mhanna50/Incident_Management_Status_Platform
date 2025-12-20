import { useCallback, useEffect, useMemo, useState } from 'react'

import AdminLayout from '../components/AdminLayout'
import * as incidentsApi from '../api/incidents'
import type { MetricsResponse } from '../api/types'
import { INCIDENT_SEVERITIES, SEVERITY_LABELS } from '../api/types'
import { useToast } from '../components/ToastProvider'
import { useEventStream } from '../hooks/useEventStream'

const buildThreeMonthSeries = <T,>(entries: T[], getDate: (entry: T) => string, getValue: (entry: T) => number) => {
  const totals = new Map<string, number>()
  entries.forEach((entry) => {
    const rawDate = getDate(entry)
    if (!rawDate) return
    const parsed = new Date(rawDate)
    if (Number.isNaN(parsed.getTime())) return
    const key = `${parsed.getFullYear()}-${parsed.getMonth()}`
    const value = getValue(entry) || 0
    totals.set(key, (totals.get(key) ?? 0) + value)
  })
  const now = new Date()
  const series = []
  for (let offset = 2; offset >= 0; offset -= 1) {
    const target = new Date(now.getFullYear(), now.getMonth() - offset, 1)
    const key = `${target.getFullYear()}-${target.getMonth()}`
    series.push({
      label: `${target.toLocaleString('default', { month: 'short' })} ${String(target.getFullYear()).slice(-2)}`,
      value: totals.get(key) ?? 0,
      timestamp: target.getTime(),
    })
  }
  return series
}

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

  const subscriberMonthly = useMemo(() => {
    if (!metrics) return []
    return buildThreeMonthSeries(
      metrics.engagement.subscriber_growth,
      (entry) => entry.date,
      (entry) => entry.count ?? 0
    )
  }, [metrics])

  const viewsMonthly = useMemo(() => {
    if (!metrics) return []
    return buildThreeMonthSeries(
      metrics.engagement.status_page_views,
      (entry) => entry.date,
      (entry) => entry.views ?? 0
    )
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
          <div className="resolution-grid">
            <div className="resolution-stat">
              <span className="resolution-label">Median (P50)</span>
              <strong className="resolution-value">{metrics.resolution_health.percentiles.p50 ?? '—'} hrs</strong>
              <small>Typical resolution window</small>
            </div>
            <div className="resolution-stat">
              <span className="resolution-label">Tail (P90)</span>
              <strong className="resolution-value">{metrics.resolution_health.percentiles.p90 ?? '—'} hrs</strong>
              <small>Long-running incidents</small>
            </div>
            <div className="resolution-visibility">
              <span className="resolution-label">Visibility mix</span>
              <div className="visibility-pill public">
                <span>Public</span>
                <strong>{metrics.resolution_health.visibility_breakdown.public}</strong>
              </div>
              <div className="visibility-pill internal">
                <span>Internal</span>
                <strong>{metrics.resolution_health.visibility_breakdown.internal}</strong>
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
              <p>Subscriber signups (last 3 months)</p>
              {subscriberMonthly.length ? (
                <div className="bar-chart small">
                  {(() => {
                    const max = Math.max(...subscriberMonthly.map((item) => item.value), 1)
                    return subscriberMonthly.map((entry) => (
                      <div key={entry.timestamp} className="bar">
                        <span className="bar-value">{entry.value}</span>
                        <div
                          className="bar-fill"
                          style={{ height: `${(entry.value / max) * 100 || 4}%` }}
                          aria-label={`${entry.label} subscriber growth ${entry.value}`}
                        />
                        <small>{entry.label}</small>
                      </div>
                    ))
                  })()}
                </div>
              ) : (
                <p className="empty">No subscriber data</p>
              )}
            </div>
            <div className="metric-card delivery-card">
              <p>Email delivery</p>
              {(() => {
                const stats = metrics.engagement.email_delivery
                const sent = stats.find((entry) => entry.status === 'SENT')?.count ?? 0
                const failed = stats.find((entry) => entry.status === 'FAILED')?.count ?? 0
                const pending = stats.find((entry) => entry.status === 'PENDING')?.count ?? 0
                const active = sent > 0
                return (
                  <div className={`delivery-status ${active ? 'active' : 'inactive'}`}>
                    <div className="delivery-pulse" aria-label={`Email delivery ${active ? 'active' : 'paused'}`}>
                      {active ? 'Active' : 'Paused'}
                    </div>
                    <p className="subtitle">
                      {active
                        ? 'Subscriber notifications are sending successfully.'
                        : 'No successful deliveries detected recently.'}
                    </p>
                    <div className="delivery-meta">
                      <span>Sent: {sent}</span>
                      <span>Pending: {pending}</span>
                      <span>Failed: {failed}</span>
                    </div>
                  </div>
                )
              })()}
            </div>
            <div className="metric-card area-card">
              <p>Status page views (last 3 months)</p>
              {viewsMonthly.length ? (
                <div className="bar-chart small">
                  {(() => {
                    const max = Math.max(...viewsMonthly.map((item) => item.value), 1)
                    return viewsMonthly.map((entry) => (
                      <div key={entry.timestamp} className="bar">
                        <span className="bar-value">{entry.value}</span>
                        <div
                          className="bar-fill"
                          style={{ height: `${(entry.value / max) * 100 || 4}%` }}
                          aria-label={`${entry.label} status page views ${entry.value}`}
                        />
                        <small>{entry.label}</small>
                      </div>
                    ))
                  })()}
                </div>
              ) : (
                <p className="empty">No view data</p>
              )}
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
                <ul className="list-bulleted">
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
