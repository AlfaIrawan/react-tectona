import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import '@/modules/auth/auth-tour.css'
import type { WorkspaceGuideActionId } from '@/modules/workspace-management/lib/workspaceManagementGuideTypes'
import {
  getWorkspaceGuideTourInitialSteps,
  getWorkspaceGuideTourSteps,
  isDeferredWorkspaceGuideTourStep,
  type WorkspaceGuideTourPrepare,
  type WorkspaceGuideTourStep,
} from '@/modules/workspace-management/lib/workspaceManagementGuideTourSteps'

const WM_GUIDE_WIZARD_TOUR_BODY_CLASS = 'wm-guide-wizard-tour-active'

export type WorkspaceGuideTourPrepareHandlers = {
  openNewWorkspaceWizard?: () => void
  closeNewWorkspaceWizard?: () => void
  showNewWorkspaceWizardStep?: (step: number) => void
}

function resolveStepElement(step: WorkspaceGuideTourStep): Element | null {
  if (!step.element) return null
  if (typeof step.element === 'function') return step.element()
  if (typeof step.element === 'string') return document.querySelector(step.element)
  return step.element
}

function isNewWorkspaceDrawerOpen(): boolean {
  const drawer = document.querySelector('[data-tour-target="wm-new-workspace-drawer"]')
  if (!(drawer instanceof HTMLElement)) return false
  return drawer.classList.contains('translate-x-0') && !drawer.classList.contains('translate-x-full')
}

function isTourElementVisible(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false
  const style = window.getComputedStyle(el)
  if (style.display === 'none' || style.visibility === 'hidden') return false
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 && rect.height <= 0) return false
  if (el.closest('[data-tour-target="wm-new-workspace-drawer"]') && !isNewWorkspaceDrawerOpen()) return false
  return true
}

function setWizardTourLayerActive(active: boolean) {
  document.body.classList.toggle(WM_GUIDE_WIZARD_TOUR_BODY_CLASS, active)
}

function resolveTourSteps(steps: WorkspaceGuideTourStep[]): WorkspaceGuideTourStep[] {
  return steps.filter((step) => {
    if (isDeferredWorkspaceGuideTourStep(step)) return true
    const el = resolveStepElement(step)
    return el instanceof Element && isTourElementVisible(el)
  })
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

async function waitForTourTarget(key: string, maxAttempts = 50, intervalMs = 80): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const el = document.querySelector(`[data-tour-target="${key}"]`)
    if (key === 'wm-new-workspace-wizard-content') {
      if (isNewWorkspaceDrawerOpen() && el instanceof Element && isTourElementVisible(el)) {
        setWizardTourLayerActive(true)
        return
      }
    } else if (el instanceof Element && isTourElementVisible(el)) {
      return
    }
    await sleep(intervalMs)
  }
}

async function runPrepareToken(
  token: WorkspaceGuideTourPrepare,
  prepare?: WorkspaceGuideTourPrepareHandlers,
): Promise<void> {
  switch (token) {
    case 'open-new-workspace-wizard':
      prepare?.openNewWorkspaceWizard?.()
      await waitForTourTarget('wm-new-workspace-wizard-content', 60, 100)
      break
    case 'close-new-workspace-wizard':
      prepare?.closeNewWorkspaceWizard?.()
      setWizardTourLayerActive(false)
      await waitForTourTarget('wm-new-workspace-btn')
      break
    default: {
      if (token.startsWith('new-workspace-wizard-')) {
        if (!isNewWorkspaceDrawerOpen()) {
          prepare?.openNewWorkspaceWizard?.()
          await waitForTourTarget('wm-new-workspace-wizard-content', 60, 100)
        }
        const step = Number.parseInt(token.replace('new-workspace-wizard-', ''), 10)
        if (Number.isFinite(step)) prepare?.showNewWorkspaceWizardStep?.(step)
        await waitForTourTarget('wm-new-workspace-wizard-content', 40, 80)
        setWizardTourLayerActive(true)
      }
      break
    }
  }
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve())
    })
  })
}

async function prepareTourStep(step: WorkspaceGuideTourStep, prepare?: WorkspaceGuideTourPrepareHandlers) {
  if (!step.wmPrepare?.length) return
  for (const token of step.wmPrepare) {
    await runPrepareToken(token, prepare)
  }
}

export function waitForWorkspaceGuideTourTargets(
  action: WorkspaceGuideActionId,
  maxAttempts = 40,
  intervalMs = 100,
): Promise<WorkspaceGuideTourStep[]> {
  const expected = getWorkspaceGuideTourInitialSteps(action)

  return new Promise((resolve) => {
    let attempts = 0
    const tick = () => {
      const resolved = expected.filter((step) => {
        const el = resolveStepElement(step)
        return el instanceof Element && isTourElementVisible(el)
      })
      const ready = resolved.length > 0 && resolved.length === expected.length
      if (ready || attempts >= maxAttempts) {
        resolve(resolved.length > 0 ? resolved : [])
        return
      }
      attempts += 1
      window.setTimeout(tick, intervalMs)
    }
    tick()
  })
}

export function runWorkspaceManagementGuideTour(
  action: WorkspaceGuideActionId,
  steps: WorkspaceGuideTourStep[],
  options?: {
    onDestroyed?: () => void
    prepare?: WorkspaceGuideTourPrepareHandlers
  },
) {
  const tourSteps = resolveTourSteps(steps.length > 0 ? steps : getWorkspaceGuideTourSteps(action))
  if (tourSteps.length === 0) return

  let resizeObserver: ResizeObserver | null = null

  const driverObj = driver({
    showProgress: true,
    allowClose: true,
    overlayOpacity: 0.55,
    stagePadding: 6,
    stageRadius: 8,
    popoverClass: 'tectona-tour-popover',
    nextBtnText: 'Next',
    prevBtnText: 'Previous',
    doneBtnText: 'Done',
    steps: tourSteps,
    onNextClick: (_element, _step, { driver: tourDriver, state }) => {
      void (async () => {
        const nextStep = tourSteps[state.activeIndex + 1]
        if (nextStep) await prepareTourStep(nextStep, options?.prepare)
        tourDriver.moveNext()
        tourDriver.refresh()
      })()
    },
    onPrevClick: (_element, _step, { driver: tourDriver, state }) => {
      void (async () => {
        const currentStep = tourSteps[state.activeIndex]
        if (currentStep && isDeferredWorkspaceGuideTourStep(currentStep)) {
          await runPrepareToken('close-new-workspace-wizard', options?.prepare)
        }
        tourDriver.movePrevious()
        tourDriver.refresh()
      })()
    },
    onHighlightStarted: (_element, _step, { state }) => {
      void (async () => {
        const currentStep = tourSteps[state.activeIndex]
        if (!currentStep || !isDeferredWorkspaceGuideTourStep(currentStep)) return
        await prepareTourStep(currentStep, options?.prepare)
        driverObj.refresh()
      })()
    },
    onHighlighted: (element) => {
      resizeObserver?.disconnect()
      if (element) {
        resizeObserver = new ResizeObserver(() => driverObj.refresh())
        resizeObserver.observe(element)
      }
    },
    onDestroyed: () => {
      resizeObserver?.disconnect()
      resizeObserver = null
      setWizardTourLayerActive(false)
      options?.onDestroyed?.()
    },
  })

  driverObj.drive()
}
