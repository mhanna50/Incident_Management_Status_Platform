import type { IncidentUpdate } from '../api/types'
import { formatDateTime } from '../utils/incidents'
import StatusBadge from './StatusBadge'

interface TimelineProps {
  updates: IncidentUpdate[]
}

const getInitials = (name: string) => {
  if (!name) return '—'
  const [first, second] = name.trim().split(/\s+/)
  if (!second) {
    return first.charAt(0).toUpperCase()
  }
  return `${first.charAt(0)}${second.charAt(0)}`.toUpperCase()
}

const Timeline = ({ updates }: TimelineProps) => {
  if (!updates.length) {
    return <p className="empty">No updates yet.</p>
  }

  return (
    <ul className="timeline">
      {updates.map((update) => (
        <li key={update.id}>
          <div className="timeline-meta">
            <div className="timeline-avatar" aria-hidden="true">
              {getInitials(update.created_by_name)}
            </div>
            <div>
              <strong>{update.created_by_name || 'Unknown'}</strong>
              <div className="timeline-sub">
                <StatusBadge status={update.status_at_time} />
                <span>{formatDateTime(update.created_at)}</span>
              </div>
            </div>
          </div>
          <p>{update.message}</p>
        </li>
      ))}
    </ul>
  )
}

export default Timeline
