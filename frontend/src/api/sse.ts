import { API_BASE_URL } from './client'
import type { SSEEventType, SSEPayload } from './types'

type Channel = 'admin' | 'public'

export type SSEHandler = (payload: SSEPayload) => void

const STREAM_BASE = `${API_BASE_URL}/stream`
const EVENT_TYPES: SSEEventType[] = [
  'INCIDENT_CREATED',
  'INCIDENT_UPDATED',
  'INCIDENT_STATUS_CHANGED',
  'INCIDENT_UPDATE_POSTED',
  'POSTMORTEM_PUBLISHED',
]

export const buildStreamUrl = (channel: Channel) => `${STREAM_BASE}/${channel}`

const createStream = (channel: Channel, handler: SSEHandler) => {
  const source = new EventSource(buildStreamUrl(channel))

  const parseEvent = (event: MessageEvent<string>) => {
    try {
      const data = JSON.parse(event.data) as SSEPayload['data']
      handler({ type: event.type as SSEEventType, data })
    } catch (error) {
      console.error('Failed to parse SSE payload', error)
    }
  }

  EVENT_TYPES.forEach((eventType) => {
    source.addEventListener(eventType, parseEvent as EventListener)
  })

  source.onerror = (error) => {
    console.error('SSE connection error', error)
  }

  return source
}

export const createAdminStream = (handler: SSEHandler) => createStream('admin', handler)

export const createPublicStream = (handler: SSEHandler) => createStream('public', handler)
