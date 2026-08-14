import { describe, expect, it } from 'vitest'
import {
  DIRECT_KB_SERVICE_BASE,
  GATEWAY_KB_SERVICE_BASE,
  resolveKbServiceBaseUrl,
} from './kbConfig'

describe('resolveKbServiceBaseUrl', () => {
  it('uses direct Vite proxy in dev when config still points at gateway-runtime', () => {
    expect(resolveKbServiceBaseUrl(GATEWAY_KB_SERVICE_BASE)).toBe(DIRECT_KB_SERVICE_BASE)
    expect(resolveKbServiceBaseUrl('http://host.docker.internal:8415')).toBe(DIRECT_KB_SERVICE_BASE)
  })

  it('keeps custom absolute URLs in dev', () => {
    expect(resolveKbServiceBaseUrl('https://kb.example.com/api/tectona-kb')).toBe(
      'https://kb.example.com/api/tectona-kb',
    )
  })
})
