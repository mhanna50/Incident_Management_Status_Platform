import { SEVERITY_LABELS, type IncidentSeverity } from '../api/types'
import { getSeverityClass } from '../utils/incidents'

const SeverityBadge = ({ severity }: { severity: IncidentSeverity }) => (
  <span className={getSeverityClass(severity)}>{SEVERITY_LABELS[severity]}</span>
)

export default SeverityBadge
