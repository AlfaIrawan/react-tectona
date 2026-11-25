export type AccentColor = 'gradient' | 'tectona-silver' | 'tectona-steel' | 'tectona-slate' | 'tectona-midnight'

export const TECTONA_THEMES = [
  { id: 'gradient', label: 'Default', description: 'Original Tectona', swatch: 'linear-gradient(90deg,#D1D5DB,#9CA3AF)', video: '/images/background-1.mp4', poster: '/images/background-1.png', type: 'video/mp4' },
  { id: 'tectona-silver', label: 'Tectona Silver', description: 'Flowing Pearl – Silver', swatch: 'linear-gradient(135deg,#fcfcfa,#c4c6c8,#85888c)', video: '/images/themes/tectona-silver-feather-loop-v1.webm', poster: '/images/themes/tectona-silver-feather-loop-v1.webp', type: 'video/webm', seamless: true },
  { id: 'tectona-steel', label: 'Tectona Steel', description: 'Glass Sphere · Blue Satin', swatch: 'linear-gradient(135deg,#dff4ff,#8ac5df,#5485a4)', video: '/images/themes/tectona-steel-glass-orb-loop-v1.webm', poster: '/images/themes/tectona-steel-glass-orb-loop-v1.webp', type: 'video/webm', seamless: true },
  { id: 'tectona-slate', label: 'Tectona Slate', description: 'Slate Gray · Deep Blue', swatch: 'linear-gradient(135deg,#475569,#174b96)', video: '/images/themes/tectona-slate-botanical-v1.webm', poster: '/images/themes/tectona-slate-botanical-v1.webp', type: 'video/webm', seamless: true },
  { id: 'tectona-midnight', label: 'Tectona Midnight', description: 'Charcoal · Midnight blue', swatch: 'linear-gradient(135deg,#1f2937,#102c60)', video: '/images/themes/tectona-midnight.webm', poster: '/images/themes/tectona-midnight.png', type: 'video/webm' },
] as const

const LEGACY_THEMES: Record<string, AccentColor> = {
  'frosted-steel': 'tectona-silver',
  'indigo-command': 'tectona-steel',
  'blue-granite': 'tectona-slate',
  'deep-cosmic': 'tectona-midnight',
}

export function normalizeAccent(value: unknown): AccentColor {
  if (typeof value !== 'string') return 'gradient'
  if (Object.prototype.hasOwnProperty.call(LEGACY_THEMES, value)) return LEGACY_THEMES[value]
  return TECTONA_THEMES.some(theme => theme.id === value) ? value as AccentColor : 'gradient'
}

export function getTectonaTheme(value: unknown) {
  const id = normalizeAccent(value)
  return TECTONA_THEMES.find(theme => theme.id === id)!
}
