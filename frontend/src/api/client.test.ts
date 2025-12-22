import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildApiUrl, request } from './client'

describe('buildApiUrl', () => {
  it('uses base url for relative paths', () => {
    expect(buildApiUrl('/incidents')).toMatch(/\/api\/incidents$/)
  })

  it('returns absolute paths unchanged', () => {
    const url = 'https://example.com/custom'
    expect(buildApiUrl(url)).toEqual(url)
  })
})

describe('request', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ result: 'ok' }),
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('performs json requests and returns parsed payload', async () => {
    const response = await request<{ result: string }>('/incidents')
    expect(response.result).toEqual('ok')
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/incidents'), expect.any(Object))
  })

  it('throws when response is not ok', async () => {
    const mockedFetch = fetch as unknown as ReturnType<typeof vi.fn>
    mockedFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: () => Promise.resolve('bad request'),
      headers: new Headers(),
    })

    await expect(request('/broken')).rejects.toThrow(/bad request/)
  })

  it('adds idempotency key header when provided', async () => {
    await request('/incidents', { method: 'POST', body: '{}', idempotencyKey: 'key-123' })
    const [, options] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    const headers = options?.headers as Headers
    expect(headers.get('Idempotency-Key')).toEqual('key-123')
  })

  it('retries when the first attempt is a network error', async () => {
    vi.useFakeTimers()
    try {
      const mockedFetch = fetch as unknown as ReturnType<typeof vi.fn>
      mockedFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
      mockedFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ result: 'ok-after-retry' }),
      })

      const pending = request<{ result: string }>('/incidents')
      await vi.runAllTimersAsync()
      const result = await pending

      expect(result.result).toEqual('ok-after-retry')
      expect(mockedFetch).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('retries on retryable status codes', async () => {
    vi.useFakeTimers()
    try {
      const mockedFetch = fetch as unknown as ReturnType<typeof vi.fn>
      mockedFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: () => Promise.resolve('bad gateway'),
        headers: new Headers(),
      })
      mockedFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ recovered: true }),
      })

      const pending = request<{ recovered: boolean }>('/incidents')
      await vi.runAllTimersAsync()
      const response = await pending

      expect(response.recovered).toBe(true)
      expect(mockedFetch).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('throws after exhausting retries', async () => {
    vi.useFakeTimers()
    try {
      const mockedFetch = fetch as unknown as ReturnType<typeof vi.fn>
      mockedFetch.mockRejectedValue(new TypeError('Still down'))

      const pending = request('/incidents')
      const expectation = expect(pending).rejects.toThrow('Still down')
      await vi.runAllTimersAsync()
      await expectation
      expect(mockedFetch).toHaveBeenCalledTimes(7)
    } finally {
      vi.useRealTimers()
    }
  })
})
