const DEFAULT_BASE_URL = 'http://127.0.0.1:8000/api'

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

  const response = await fetch(url, { ...fetchOptions, headers })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || `Request failed with status ${response.status}`)
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
