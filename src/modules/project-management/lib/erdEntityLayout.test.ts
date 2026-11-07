import { describe, expect, it } from 'vitest'
import { erdDisplayLabel, erdEntityDefaultSize } from './erdEntityLayout'
describe('ERD default compartment sizing', () => {
 it('sizes the complete imported qa_child column including NOT NULL', () => {
  const labels = ['*id : INTEGER', 'parent_id : INTEGER NOT NULL <<FK>>']
  const size = erdEntityDefaultSize('qa_child', labels)
  expect(size.width).toBeGreaterThan(168)
  expect(size.width - 24).toBeGreaterThanOrEqual(erdDisplayLabel(labels[1]).length * 6.8)
  expect(size.height).toBeGreaterThanOrEqual(20 + 2 * 18 + 28)
  expect(erdDisplayLabel(labels[1])).toBe('parent_id : INTEGER NOT NULL')
 })
 it('accounts for wrapping after a bounded maximum width and for long titles', () => {
  const short = erdEntityDefaultSize('entity', ['id : INT'])
  const long = erdEntityDefaultSize('Entity'.repeat(30), ['very_long_name'.repeat(15) + ' : DECIMAL(12,2) NOT NULL'])
  expect(long.width).toBe(360); expect(long.height).toBeGreaterThan(short.height); expect(long.height).toBeLessThanOrEqual(640)
 })
 it('keeps huge imported definitions bounded with overflow handled by the compartment', () => {
  expect(erdEntityDefaultSize('Wide', Array.from({ length: 1000 }, (_, i) => `column_${i} : VARCHAR(255) NOT NULL`)).height).toBe(640)
  expect(erdEntityDefaultSize('', [])).toEqual({ width: 168, height: 66 })
 })
})
