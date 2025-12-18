import type { Incident, IncidentSeverity, IncidentStatus } from '../api/types'

const STATUS_COLORS: Record<IncidentStatus, string> = {
  INVESTIGATING: 'badge investigating',
  IDENTIFIED: 'badge identified',
  MONITORING: 'badge monitoring',
  RESOLVED: 'badge resolved',
}

const SEVERITY_COLORS: Record<IncidentSeverity, string> = {
  SEV1: 'sev sev1',
  SEV2: 'sev sev2',
  SEV3: 'sev sev3',
  SEV4: 'sev sev4',
}

const ALLOWED_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  INVESTIGATING: ['IDENTIFIED', 'MONITORING', 'RESOLVED'],
  IDENTIFIED: ['MONITORING', 'RESOLVED'],
  MONITORING: ['RESOLVED'],
  RESOLVED: ['INVESTIGATING'],
}

export const getStatusClass = (status: IncidentStatus) => STATUS_COLORS[status]

export const getSeverityClass = (severity: IncidentSeverity) => SEVERITY_COLORS[severity]

export const getAllowedTransitions = (status: IncidentStatus) => ALLOWED_TRANSITIONS[status] || []

export const formatDateTime = (timestamp: string) =>
  new Date(timestamp).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

export const hasPublishedPostmortem = (incident: Incident | null) =>
  Boolean(incident && incident.latest_update && incident.active === false)
