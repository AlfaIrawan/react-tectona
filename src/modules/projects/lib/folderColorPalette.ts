export const FOLDER_COLOR_PALETTE = [
  '#3b82f6',
  '#a855f7',
  '#10b981',
  '#f97316',
  '#ec4899',
  '#06b6d4',
  '#6366f1',
  '#14b8a6',
  '#f43f5e',
  '#f59e0b',
  '#84cc16',
  '#8b5cf6',
] as const

export const DEFAULT_FOLDER_COLOR = FOLDER_COLOR_PALETTE[0]

export type FolderColor = (typeof FOLDER_COLOR_PALETTE)[number]

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace('#', '').trim()
  if (normalized.length !== 6) return null
  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  if ([r, g, b].some((n) => Number.isNaN(n))) return null
  return { r, g, b }
}

function mixWithWhite(hex: string, amount: number): string {
  const rgb = hexToRgb(hex) ?? { r: 59, g: 130, b: 246 }
  return `rgb(${clampChannel(rgb.r + (255 - rgb.r) * amount)}, ${clampChannel(rgb.g + (255 - rgb.g) * amount)}, ${clampChannel(rgb.b + (255 - rgb.b) * amount)})`
}

function rgbaFromHex(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex) ?? { r: 59, g: 130, b: 246 }
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
}

export function buildFolderCardThemeVariables(
  accentColor: string,
  hasProjects = false,
): Record<string, string> {
  const accent = accentColor.trim() || DEFAULT_FOLDER_COLOR
  const bodyTop = mixWithWhite(accent, hasProjects ? 0.72 : 0.78)
  const bodyMid = mixWithWhite(accent, hasProjects ? 0.62 : 0.68)
  const bodyBottom = mixWithWhite(accent, hasProjects ? 0.54 : 0.6)
  const tabTop = mixWithWhite(accent, 0.84)
  const tabBottom = mixWithWhite(accent, hasProjects ? 0.58 : 0.64)
  const lipTop = mixWithWhite(accent, 0.9)
  const lipBottom = mixWithWhite(accent, 0.75)

  return {
    '--folder-border': rgbaFromHex(accent, hasProjects ? 0.4 : 0.28),
    '--folder-border-soft': rgbaFromHex(accent, 0.18),
    '--folder-border-strong': rgbaFromHex(accent, hasProjects ? 0.55 : 0.5),
    '--folder-body-bg': `linear-gradient(180deg, ${bodyTop} 0%, ${bodyMid} 45%, ${bodyBottom} 100%)`,
    '--folder-tab-bg': `linear-gradient(180deg, ${tabTop} 0%, ${mixWithWhite(accent, 0.72)} 55%, ${tabBottom} 100%)`,
    '--folder-lip-bg': `linear-gradient(180deg, ${lipTop} 0%, ${lipBottom} 100%)`,
    '--folder-selected-bg': `linear-gradient(180deg, ${mixWithWhite(accent, 0.76)} 0%, ${mixWithWhite(accent, 0.58)} 55%, ${mixWithWhite(accent, 0.52)} 100%)`,
    '--folder-drag-bg': `linear-gradient(180deg, ${mixWithWhite(accent, 0.8)} 0%, ${mixWithWhite(accent, 0.62)} 55%, ${mixWithWhite(accent, 0.56)} 100%)`,
    '--folder-drag-overlay': rgbaFromHex(accent, 0.06),
    '--folder-drag-text': rgbaFromHex(accent, 0.95),
  }
}
