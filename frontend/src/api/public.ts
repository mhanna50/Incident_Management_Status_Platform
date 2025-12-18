import { request } from './client'
import type { Incident, Postmortem, PublicStatusResponse } from './types'

export const getPublicStatus = () => request<PublicStatusResponse>('/public/status')

export const getPublicIncident = (id: string) =>
  request<Incident>(`/public/incidents/${id}`)

export const getPublicPostmortem = (id: string) =>
  request<Postmortem>(`/public/incidents/${id}/postmortem`)
