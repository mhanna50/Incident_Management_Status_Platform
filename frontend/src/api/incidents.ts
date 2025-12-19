import { generateIdempotencyKey, request } from './client'
import type {
  ActionItem,
  AuditEvent,
  Incident,
  IncidentSeverity,
  IncidentStatus,
  IncidentUpdate,
  MetricsResponse,
  Postmortem,
} from './types'

export interface CreateIncidentPayload {
  title: string
  summary: string
  severity: Incident['severity']
  status?: IncidentStatus
  is_public: boolean
  created_by_name: string
}

export interface UpdateIncidentPayload {
  title?: string
  summary?: string
  severity?: Incident['severity']
  status?: IncidentStatus
  is_public?: boolean
  created_by_name?: string
}

export interface TransitionPayload {
  status: IncidentStatus
  actor_name: string
  message?: string
}

export interface IncidentUpdatePayload {
  message: string
  status_at_time?: IncidentStatus
  created_by_name: string
}

export interface PostmortemPayload {
  summary?: string
  impact?: string
  root_cause?: string
  detection?: string
  resolution?: string
  lessons_learned?: string
}

export interface ActionItemPayload {
  title: string
  owner_name: string
  due_date?: string | null
  status?: ActionItem['status']
}

export interface SubscriberPayload {
  email: string
  scope: 'GLOBAL' | 'INCIDENT'
  incident?: string | null
}

export interface IncidentAnalytics {
  mttr_hours: number | null
  active_incidents: number
  resolved_last_7_days: number
  incidents_per_severity: Record<IncidentSeverity, number>
}

export const getIncidentAnalytics = () =>
  request<IncidentAnalytics>('/incidents/analytics')

export const getAdminMetrics = () =>
  request<MetricsResponse>('/metrics')

export const listIncidents = () => request<Incident[]>('/incidents')

export const getIncident = (id: string) => request<Incident>(`/incidents/${id}`)

export const createIncident = (payload: CreateIncidentPayload) =>
  request<Incident>('/incidents', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const updateIncident = (id: string, payload: UpdateIncidentPayload) =>
  request<Incident>(`/incidents/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

export const transitionIncident = (id: string, payload: TransitionPayload) =>
  request<{ incident: Incident; update: IncidentUpdate }>(`/incidents/${id}/transition`, {
    method: 'POST',
    body: JSON.stringify(payload),
    idempotencyKey: generateIdempotencyKey(),
  })

export const listUpdates = (incidentId: string) =>
  request<IncidentUpdate[]>(`/incidents/${incidentId}/updates`)

export const postUpdate = (incidentId: string, payload: IncidentUpdatePayload) =>
  request<IncidentUpdate>(`/incidents/${incidentId}/updates`, {
    method: 'POST',
    body: JSON.stringify(payload),
    idempotencyKey: generateIdempotencyKey(),
  })

export const getPostmortem = (incidentId: string) =>
  request<Postmortem>(`/incidents/${incidentId}/postmortem`)

export const createPostmortem = (incidentId: string, payload: PostmortemPayload) =>
  request<Postmortem>(`/incidents/${incidentId}/postmortem`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const updatePostmortem = (incidentId: string, payload: PostmortemPayload) =>
  request<Postmortem>(`/incidents/${incidentId}/postmortem`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

export const publishPostmortem = (incidentId: string, actorName: string) =>
  request<Postmortem>(`/incidents/${incidentId}/postmortem/publish`, {
    method: 'POST',
    body: JSON.stringify({ actor_name: actorName }),
  })

export const exportPostmortemMarkdown = (incidentId: string) =>
  request<string>(`/incidents/${incidentId}/postmortem/export`, { skipJsonParsing: true })

export const listAuditEvents = () => request<AuditEvent[]>('/audit')

export const subscribe = (payload: SubscriberPayload) =>
  request('/subscribers', {
    method: 'POST',
    body: JSON.stringify(payload),
    idempotencyKey: generateIdempotencyKey(),
  })

export const listActionItems = (incidentId: string) =>
  request<ActionItem[]>(`/incidents/${incidentId}/postmortem/action-items`)

export const createActionItem = (incidentId: string, payload: ActionItemPayload) =>
  request<ActionItem>(`/incidents/${incidentId}/postmortem/action-items`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const updateActionItem = (
  incidentId: string,
  actionItemId: string,
  payload: Partial<ActionItemPayload>
) =>
  request<ActionItem>(
    `/incidents/${incidentId}/postmortem/action-items/${actionItemId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }
  )
