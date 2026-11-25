import { expect, it } from 'vitest'
import { extractKbStructuredHtmlFromAnswer, parseStrictJsonObjectFromAnswer } from './kbStructuredAnswer'

const fence = (format: string, text: string) => '```' + format + '\n' + text + '\n```'

it('tries fenced JSON, then a complete object, then an embedded object', () => {
  expect(parseStrictJsonObjectFromAnswer('Ignored {"title":"outer"}\n' + fence('json', '{"title":"fenced"}')))
    .toEqual({ title: 'fenced' })
  expect(parseStrictJsonObjectFromAnswer(' {"title":"direct"} ')).toEqual({ title: 'direct' })
  expect(parseStrictJsonObjectFromAnswer('prefix {"title":"embedded"} suffix')).toEqual({ title: 'embedded' })
  expect(parseStrictJsonObjectFromAnswer('[1,2]')).toBeNull()
  expect(parseStrictJsonObjectFromAnswer('{"title":}')).toBeNull()
  expect(parseStrictJsonObjectFromAnswer(' ')).toBeNull()
})

it('keeps HTML field precedence, nested envelopes, and fallback formats', () => {
  const nested = JSON.stringify({ body: '<p>Nested</p>' })
  expect(extractKbStructuredHtmlFromAnswer(JSON.stringify({ content_html: nested, html: '<p>Later</p>' })))
    .toBe(nested)
  const escapedNested = nested.replaceAll('<', '\\u003c')
  expect(extractKbStructuredHtmlFromAnswer(JSON.stringify({ content_html: escapedNested, html: '<p>Later</p>' })))
    .toBe('<p>Nested</p>')
  expect(extractKbStructuredHtmlFromAnswer(JSON.stringify({ content_html: ' ', text: '<p>Last field</p>' })))
    .toBe('<p>Last field</p>')
  expect(extractKbStructuredHtmlFromAnswer(fence('html', '<p>Fenced HTML</p>'))).toBe('<p>Fenced HTML</p>')
  expect(extractKbStructuredHtmlFromAnswer('  <p>Direct HTML</p>  ')).toBe('<p>Direct HTML</p>')
  expect(extractKbStructuredHtmlFromAnswer('No HTML here')).toBe('')
})
