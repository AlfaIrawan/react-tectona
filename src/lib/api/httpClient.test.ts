import { describe, expect, it } from 'vitest'
import { htmlErrorPageMessage, parseApiErrorMessage } from './httpClient'

// 26 Oct 2026: a failed idea delete printed nginx's whole "405 Not Allowed" page in red.
const NGINX_405 = '<html>\r\n<head><title>405 Not Allowed</title></head>\r\n<body>\r\n<center><h1>405 Not Allowed</h1></center>\r\n<hr><center>nginx</center>\r\n</body>\r\n</html>\r\n<!-- a padding to disable MSIE and Chrome friendly error page -->'

describe('API error messages', () => {
  it('turns a web server error page into a readable message naming it', () => {
    const message = parseApiErrorMessage(NGINX_405, 'HTTP 405')
    expect(message).toContain('405 Not Allowed')
    expect(message).toContain('Reload the page')
    expect(message).not.toContain('<')
  })

  it('leaves JSON and plain text errors as they were', () => {
    expect(parseApiErrorMessage('{"detail":"idea not found"}')).toBe('idea not found')
    expect(parseApiErrorMessage('{"error":{"message":"invalid token"}}')).toBe('invalid token')
    expect(parseApiErrorMessage('Service unavailable')).toBe('Service unavailable')
    expect(htmlErrorPageMessage('a < b is not a page')).toBeNull()
  })

  it('handles a page without a title', () => {
    expect(htmlErrorPageMessage('<!DOCTYPE html><html><body>oops</body></html>')).toContain('The server returned an error page instead')
  })
})
