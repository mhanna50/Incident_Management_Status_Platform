import { STATUS_LABELS, type IncidentStatus } from '../api/types'
import { getStatusClass } from '../utils/incidents'

const StatusBadge = ({ status }: { status: IncidentStatus }) => (
  <span className={getStatusClass(status)}>{STATUS_LABELS[status]}</span>
)

export default StatusBadge
