import { useCallback, useEffect, useState } from 'react'

import * as incidentsApi from '../api/incidents'
import type { AuditEvent } from '../api/types'
import AdminLayout from '../components/AdminLayout'
import { useEventStream } from '../hooks/useEventStream'
import { useToast } from '../components/ToastProvider'
import { formatDateTime } from '../utils/incidents'

const AdminAuditPage = () => {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const { addToast } = useToast()

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true)
      const data = await incidentsApi.listAuditEvents()
      setEvents(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  useEventStream('admin', () => {
    fetchEvents()
    addToast('Audit log updated')
  })

  return (
    <AdminLayout title="Audit log" subtitle="Immutable record of every important change.">
      <div className="card page-block">
        <div className="page-block-header">
          <div>
            <h2>Recent actions</h2>
            <p>Streaming directly from the audit API.</p>
          </div>
          <button onClick={fetchEvents}>Refresh</button>
        </div>
        {loading && <p>Loading…</p>}
        <ul className="audit-list" aria-live="polite">
          {events.map((event) => (
            <li key={event.id}>
              <div>
                <strong>{event.action}</strong> by {event.actor_name}
              </div>
              <small>{formatDateTime(event.created_at)}</small>
            </li>
          ))}
        </ul>
      </div>
    </AdminLayout>
  )
}

export default AdminAuditPage
