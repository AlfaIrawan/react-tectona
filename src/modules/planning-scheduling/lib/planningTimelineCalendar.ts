/** Local calendar date key (YYYY-MM-DD). */
export function localDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isWeekend(date: Date): boolean {
  const weekday = date.getDay()
  return weekday === 0 || weekday === 6
}

/**
 * Indonesia national holidays (libur nasional) for timeline shading.
 * Sources: SKB libur nasional 2025–2027; fixed dates extrapolated for 2028 scroll range.
 */
const INDONESIA_PUBLIC_HOLIDAY_KEYS = new Set<string>([
  // 2025
  '2025-01-01',
  '2025-01-27',
  '2025-01-28',
  '2025-03-29',
  '2025-03-31',
  '2025-04-01',
  '2025-04-18',
  '2025-05-01',
  '2025-05-12',
  '2025-05-29',
  '2025-06-01',
  '2025-06-06',
  '2025-08-17',
  '2025-09-05',
  // 2026
  '2026-01-01',
  '2026-01-16',
  '2026-03-19',
  '2026-04-03',
  '2026-05-01',
  '2026-05-14',
  '2026-05-27',
  '2026-05-28',
  '2026-06-01',
  '2026-08-17',
  '2026-08-25',
  '2026-09-16',
  // 2027
  '2027-01-01',
  '2027-01-05',
  '2027-03-09',
  '2027-03-26',
  '2027-05-01',
  '2027-05-06',
  '2027-05-13',
  '2027-05-17',
  '2027-05-18',
  '2027-06-01',
  '2027-08-17',
  '2027-08-05',
  '2027-09-05',
  // 2028 — fixed national dates for far-scroll timeline
  '2028-01-01',
  '2028-05-01',
  '2028-06-01',
  '2028-08-17',
])

export function isPublicHoliday(date: Date): boolean {
  return INDONESIA_PUBLIC_HOLIDAY_KEYS.has(localDateKey(date))
}

export type DayColumnTone = 'today' | 'holiday' | 'weekend' | null

/** Day view column tone; today wins over holiday, holiday over weekend. */
export function dayColumnTone(date: Date, today: Date): DayColumnTone {
  const columnDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  if (columnDay.getTime() === todayDay.getTime()) return 'today'
  if (isPublicHoliday(columnDay)) return 'holiday'
  if (isWeekend(columnDay)) return 'weekend'
  return null
}
