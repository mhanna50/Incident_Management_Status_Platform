export type IncidentSeverity = 'SEV1' | 'SEV2' | 'SEV3' | 'SEV4'
export type IncidentStatus = 'INVESTIGATING' | 'IDENTIFIED' | 'MONITORING' | 'RESOLVED'

export interface Incident {
  id: string
  title: string
  summary: string
  severity: IncidentSeverity
  status: IncidentStatus
  is_public: boolean
  created_by_name: string
  created_at: string
  updated_at: string
  resolved_at: string | null
  latest_update?: IncidentUpdate | null
  active: boolean
}

export interface IncidentUpdate {
  id: string
  incident: string
  message: string
  status_at_time: IncidentStatus
  created_by_name: string
  created_at: string
}

export interface Postmortem {
  id: string
  incident: string
  summary: string
  impact: string
  root_cause: string
  detection: string
  resolution: string
  lessons_learned: string
  published: boolean
  published_at: string | null
  created_at: string
  updated_at: string
  action_items: ActionItem[]
}

export interface ActionItem {
  id: string
  postmortem: string
  title: string
  owner_name: string
  due_date: string | null
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE'
}

export interface AuditEvent {
  id: string
  actor_name: string
  action: string
  incident: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface Subscriber {
  id: string
  email: string
  scope: 'GLOBAL' | 'INCIDENT'
  incident?: string | null
  is_active: boolean
  created_at: string
}

export interface PublicStatusResponse {
  overall_status: string
  active_incidents: Incident[]
}

export type SSEEventType =
  | 'INCIDENT_CREATED'
  | 'INCIDENT_UPDATED'
  | 'INCIDENT_STATUS_CHANGED'
  | 'INCIDENT_UPDATE_POSTED'
  | 'POSTMORTEM_PUBLISHED'

export interface SSEPayload {
  type: SSEEventType
  data: unknown
}

export const INCIDENT_STATUSES: IncidentStatus[] = [
  'INVESTIGATING',
  'IDENTIFIED',
  'MONITORING',
  'RESOLVED',
]

export const INCIDENT_SEVERITIES: IncidentSeverity[] = ['SEV1', 'SEV2', 'SEV3', 'SEV4']

export const STATUS_LABELS: Record<IncidentStatus, string> = {
  INVESTIGATING: 'Investigating',
  IDENTIFIED: 'Identified',
  MONITORING: 'Monitoring',
  RESOLVED: 'Resolved',
}

export const SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  SEV1: 'SEV1 - Critical',
  SEV2: 'SEV2 - High',
  SEV3: 'SEV3 - Medium',
  SEV4: 'SEV4 - Low',
}

export interface MetricsTimelinePoint {
  timestamp: string
  count: number
}

export interface MetricsWeeklyPoint {
  week_start: string
  mttr_hours: number | null
}

export interface MetricsWatchlistIncident {
  id: string
  title: string
  minutes_since_update: number
}

export interface MetricsWatchlistPostmortem {
  id: string
  title: string
  severity: IncidentSeverity
}

export interface MetricsWatchlistActionItem {
  id: string
  title: string
  owner_name: string
  due_date: string
}

export interface MetricsResponse {
  incident_pulse: {
    timeline: MetricsTimelinePoint[]
    current_open: number
    sla_target: number
    severity_breakdown: Record<IncidentSeverity, number>
  }
  resolution_health: {
    weekly_mttr: {
      all: MetricsWeeklyPoint[]
      public: MetricsWeeklyPoint[]
      internal: MetricsWeeklyPoint[]
    }
    percentiles: { p50: number | null; p90: number | null }
    resolved_by_severity: Array<{ severity: IncidentSeverity; count: number }>
    visibility_breakdown: { public: number; internal: number }
  }
  engagement: {
    subscriber_growth: Array<{ date: string; count: number }>
    email_delivery: Array<{ status: string; count: number }>
    status_page_views: Array<{ date: string; views: number | null }>
  }
  automation_watchlist: {
    stale_incidents: MetricsWatchlistIncident[]
    missing_postmortems: MetricsWatchlistPostmortem[]
    overdue_action_items: MetricsWatchlistActionItem[]
  }
}
