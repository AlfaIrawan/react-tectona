import { describe, expect, it } from 'vitest'
import { htmlErrorPageMessage, oacContentSha256, parseApiErrorMessage, parseOacSignedPathPrefixes } from './httpClient'

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

describe('CloudFront OAC body hash', () => {
  const prefixes = ['/user-preferences', '/api-catalog']
  const EMPTY = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

  it('parses the prefix list from env', () => {
    expect(parseOacSignedPathPrefixes(' /user-preferences/, api-catalog ,,')).toEqual(['/user-preferences', '/api-catalog'])
    expect(parseOacSignedPathPrefixes(undefined)).toEqual([])
  })

  it('hashes JSON bodies sent to signed prefixes', async () => {
    const hash = await oacContentSha256('/user-preferences/api/user-preferences/v1/users/u1/ui-preferences', { method: 'PATCH', body: 'abc' }, prefixes)
    expect(hash).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(await oacContentSha256('/api-catalog/v1/products', { method: 'POST' }, prefixes)).toBe(EMPTY)
  })

  it('leaves other requests alone', async () => {
    expect(await oacContentSha256('/user-preferences/x', { method: 'GET' }, prefixes)).toBeNull()
    expect(await oacContentSha256('/api/idea-backlog/v1/ideas', { method: 'POST', body: '{}' }, prefixes)).toBeNull()
    expect(await oacContentSha256('/user-preferences-other/x', { method: 'POST', body: '{}' }, prefixes)).toBeNull()
    expect(await oacContentSha256('https://elsewhere.example/user-preferences/x', { method: 'POST', body: '{}' }, prefixes)).toBeNull()
    expect(await oacContentSha256('/user-preferences/x', { method: 'POST', body: '{}' }, [])).toBeNull()
  })
})
