import { afterEach, describe, expect, it, vi } from 'vitest'

import { createClientUuid } from './createClientUuid'

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

describe('createClientUuid', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses crypto.randomUUID when available', () => {
    vi.stubGlobal('crypto', {
      randomUUID: () => '11111111-1111-4111-8111-111111111111',
    })
    expect(createClientUuid()).toBe('11111111-1111-4111-8111-111111111111')
  })

  it('builds a UUID v4 from getRandomValues when randomUUID is missing', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(0)
        return bytes
      },
    })
    expect(createClientUuid()).toMatch(UUID_V4)
  })

  it('does not throw when Web Crypto is unavailable', () => {
    vi.stubGlobal('crypto', undefined)
    expect(createClientUuid()).toMatch(UUID_V4)
  })
})
