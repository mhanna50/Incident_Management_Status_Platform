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
})
