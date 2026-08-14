export type StickyNoteTheme = {
  bg: string
  bgGradient: string
  border: string
  text: string
  muted: string
  line: string
  tape: string
}

/** Classic post-it palette — stable per note id. */
export const STICKY_NOTE_THEMES: StickyNoteTheme[] = [
  {
    bg: '#fff9b1',
    bgGradient: 'linear-gradient(165deg, #fffef0 0%, #fff9b1 42%, #f5e642 100%)',
    border: '#e8dc2a',
    text: '#3d3200',
    muted: '#6b5f00',
    line: 'rgba(61, 50, 0, 0.08)',
    tape: 'rgba(255, 255, 255, 0.55)',
  },
  {
    bg: '#ffd6e8',
    bgGradient: 'linear-gradient(165deg, #fff5fa 0%, #ffd6e8 42%, #ffb3d1 100%)',
    border: '#ff9ec4',
    text: '#4a1030',
    muted: '#7a3050',
    line: 'rgba(74, 16, 48, 0.08)',
    tape: 'rgba(255, 255, 255, 0.5)',
  },
  {
    bg: '#cfe8ff',
    bgGradient: 'linear-gradient(165deg, #f0f8ff 0%, #cfe8ff 42%, #9fd0ff 100%)',
    border: '#7eb8ff',
    text: '#102a4a',
    muted: '#305070',
    line: 'rgba(16, 42, 74, 0.08)',
    tape: 'rgba(255, 255, 255, 0.55)',
  },
  {
    bg: '#c8f5d4',
    bgGradient: 'linear-gradient(165deg, #f0fff4 0%, #c8f5d4 42%, #86efac 100%)',
    border: '#6ee7a0',
    text: '#103a20',
    muted: '#306040',
    line: 'rgba(16, 58, 32, 0.08)',
    tape: 'rgba(255, 255, 255, 0.5)',
  },
  {
    bg: '#ffe0b8',
    bgGradient: 'linear-gradient(165deg, #fff8f0 0%, #ffe0b8 42%, #fdba74 100%)',
    border: '#fdba74',
    text: '#4a2800',
    muted: '#705030',
    line: 'rgba(74, 40, 0, 0.08)',
    tape: 'rgba(255, 255, 255, 0.52)',
  },
  {
    bg: '#e8d5ff',
    bgGradient: 'linear-gradient(165deg, #faf5ff 0%, #e8d5ff 42%, #c4b5fd 100%)',
    border: '#a78bfa',
    text: '#2e1065',
    muted: '#5b3d8a',
    line: 'rgba(46, 16, 101, 0.08)',
    tape: 'rgba(255, 255, 255, 0.5)',
  },
]

export const DEFAULT_COMPOSER_THEME = STICKY_NOTE_THEMES[0]

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export function getStickyNoteTheme(noteId: string): StickyNoteTheme {
  return STICKY_NOTE_THEMES[hashString(noteId) % STICKY_NOTE_THEMES.length]
}

/** Slight tilt per note — deterministic from id. Kept subtle so cards stay readable. */
export function getStickyNoteRotation(noteId: string): number {
  const rotations = [-1.4, -0.7, 0.4, 0.9, 1.2, -0.3, 1, -1]
  return rotations[hashString(noteId) % rotations.length]
}

export function stickyNoteThemeToCssVars(theme: StickyNoteTheme): Record<string, string> {
  return {
    '--sticky-bg': theme.bg,
    '--sticky-bg-gradient': theme.bgGradient,
    '--sticky-border': theme.border,
    '--sticky-text': theme.text,
    '--sticky-muted': theme.muted,
    '--sticky-line': theme.line,
    '--sticky-tape': theme.tape,
  }
}
