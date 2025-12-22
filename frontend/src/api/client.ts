const DEFAULT_BASE_URL = 'http://127.0.0.1:8000/api'
const RETRYABLE_STATUS_CODES = new Set([502, 503, 504])
const RETRY_DELAYS_MS = [5000, 10000, 15000, 20000, 25000, 30000]

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE_URL).replace(
  /\/$/,
  ''
)

export function buildApiUrl(path: string): string {
  if (path.startsWith('http')) {
    return path
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${cleanPath}`
}

export interface RequestOptions extends RequestInit {
  skipJsonParsing?: boolean
  idempotencyKey?: string
}

export const generateIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2)
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const shouldRetryStatus = (status: number) => RETRYABLE_STATUS_CODES.has(status)

const shouldRetryError = (error: unknown) => {
  if (typeof window === 'undefined') {
    return error instanceof Error
  }
  return error instanceof TypeError || (error instanceof Error && error.name === 'TypeError')
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = buildApiUrl(path)
  const { skipJsonParsing, idempotencyKey, headers: customHeaders, ...fetchOptions } = options

  const headers = new Headers({ 'Content-Type': 'application/json' })

  if (customHeaders) {
    new Headers(customHeaders).forEach((value, key) => headers.set(key, value))
  }

  if (idempotencyKey) {
    headers.set('Idempotency-Key', idempotencyKey)
  }

  let response: Response | null = null
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const hasAnotherAttempt = attempt < RETRY_DELAYS_MS.length
    try {
      response = await fetch(url, { ...fetchOptions, headers })
    } catch (error) {
      if (hasAnotherAttempt && shouldRetryError(error)) {
        await delay(RETRY_DELAYS_MS[attempt])
        continue
      }
      throw error instanceof Error ? error : new Error('Network request failed')
    }

    if (!response.ok) {
      if (hasAnotherAttempt && shouldRetryStatus(response.status)) {
        await delay(RETRY_DELAYS_MS[attempt])
        continue
      }
      const errorText = await response.text()
      throw new Error(errorText || `Request failed with status ${response.status}`)
    }
    break
  }

  if (!response) {
    throw new Error('Failed to execute request')
  }

  if (skipJsonParsing || response.status === 204) {
    return undefined as T
  }

  const contentType = response.headers.get('content-type')
  if (contentType && contentType.includes('application/json')) {
    return (await response.json()) as T
  }

  const text = await response.text()
  return text as unknown as T
}
