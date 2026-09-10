import { describe, expect, it } from 'vitest'
import { isStaleChunkError } from './lazyWithReload'

describe('isStaleChunkError', () => {
  it('matches Vite dynamic import 404s after a new frontend deploy', () => {
    expect(
      isStaleChunkError(
        new TypeError(
          'Failed to fetch dynamically imported module: https://tectona-dev.adira.co.id/assets/DocumentKnowledgeManagementPage-oaAFvfGBI.js',
        ),
      ),
    ).toBe(true)
  })

  it('matches CSS preload failures for hashed assets', () => {
    expect(isStaleChunkError(new TypeError('Unable to preload CSS for /assets/index-Bx-qXeGc.css'))).toBe(true)
  })

  it('does not treat ordinary render errors as stale chunks', () => {
    expect(isStaleChunkError(new Error('Cannot read properties of null'))).toBe(false)
  })
})
