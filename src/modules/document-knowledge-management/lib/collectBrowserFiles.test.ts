import { describe, expect, it } from 'vitest'
import { collectBrowserFiles } from './collectBrowserFiles'

describe('collectBrowserFiles', () => {
  it('keeps named files with a size and skips empty entries', () => {
    const kept = new File(['hello'], 'a.pdf', { type: 'application/pdf' })
    const empty = new File([], '', { type: '' })
    expect(collectBrowserFiles([kept, empty]).map((file) => file.name)).toEqual(['a.pdf'])
  })
})
