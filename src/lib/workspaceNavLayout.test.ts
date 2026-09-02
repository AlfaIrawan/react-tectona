import { describe, expect, it } from 'vitest'

import {
  computeWorkspaceMainPanelViewportHeightPx,
  measureEnterpriseNavHeightFromMainPanel,
  workspaceAsideClass,
} from '@/lib/workspaceNavLayout'

describe('workspaceNavLayout', () => {
  it('measureEnterpriseNavHeightFromMainPanel spans nav top to main panel bottom', () => {
    const navEl = {
      getBoundingClientRect: () => ({ top: 280, bottom: 680, height: 400 }),
    } as HTMLElement
    const mainPanelEl = {
      getBoundingClientRect: () => ({ top: 360, bottom: 980, height: 620 }),
    } as HTMLElement

    expect(measureEnterpriseNavHeightFromMainPanel(navEl, mainPanelEl)).toBe(700)
  })

  it('measureEnterpriseNavHeightFromMainPanel enforces minimum height', () => {
    const navEl = {
      getBoundingClientRect: () => ({ top: 500, bottom: 590, height: 90 }),
    } as HTMLElement
    const mainPanelEl = {
      getBoundingClientRect: () => ({ top: 520, bottom: 600, height: 80 }),
    } as HTMLElement

    expect(measureEnterpriseNavHeightFromMainPanel(navEl, mainPanelEl)).toBe(220)
  })

  it('computeWorkspaceMainPanelViewportHeightPx uses viewport bottom padding', () => {
    const originalInnerHeight = window.innerHeight
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 })

    try {
      const height = computeWorkspaceMainPanelViewportHeightPx(300)
      expect(height).toBeGreaterThanOrEqual(240)
      expect(height).toBe(900 - 300 - 66 + 20 + 15)
    } finally {
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalInnerHeight })
    }
  })

  it('docks enterprise nav to the main canvas offset instead of the viewport edge', () => {
    const docked = workspaceAsideClass(true, false, 'default')
    expect(docked).toContain('--app-main-canvas-left')
    expect(docked).not.toContain('xl:left-0')
  })
})
