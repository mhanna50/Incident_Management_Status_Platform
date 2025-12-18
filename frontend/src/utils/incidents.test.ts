import { describe, expect, it } from 'vitest'

import { getAllowedTransitions } from './incidents'

describe('getAllowedTransitions', () => {
  it('allows full flow from investigating', () => {
    expect(getAllowedTransitions('INVESTIGATING')).toEqual([
      'IDENTIFIED',
      'MONITORING',
      'RESOLVED',
    ])
  })

  it('only allows reopen from resolved', () => {
    expect(getAllowedTransitions('RESOLVED')).toEqual(['INVESTIGATING'])
  })
})
