import { describe, expect, it } from 'vitest'
import {
  WORKFLOW_ACTION_CATALOG,
  WORKFLOW_ACTION_DOMAINS,
  WORKFLOW_KIND_META,
  WORKFLOW_TRIGGER_DOMAINS,
  WORKFLOW_TRIGGER_EVENT_CATALOG,
  workflowActionEntities,
  workflowActionOperations,
  workflowTriggerEntities,
  workflowTriggerEvents,
} from './workflowNodeKinds'

describe('workflow catalogs', () => {
  it('exposes a non-empty trigger catalog for every Tectona domain', () => {
    expect(WORKFLOW_TRIGGER_DOMAINS.length).toBeGreaterThan(0)

    WORKFLOW_TRIGGER_DOMAINS.forEach((domain) => {
      const entities = workflowTriggerEntities(domain)
      expect(entities.length, `${domain} should have entities`).toBeGreaterThan(0)
      entities.forEach((entity) => {
        expect(workflowTriggerEvents(domain, entity).length, `${domain}/${entity} should have events`).toBeGreaterThan(0)
      })
    })
  })

  it('exposes a non-empty action catalog for every Tectona domain', () => {
    expect(WORKFLOW_ACTION_DOMAINS.length).toBeGreaterThan(0)

    WORKFLOW_ACTION_DOMAINS.forEach((domain) => {
      const entities = workflowActionEntities(domain)
      expect(entities.length, `${domain} should have entities`).toBeGreaterThan(0)
      entities.forEach((entity) => {
        expect(workflowActionOperations(domain, entity).length, `${domain}/${entity} should have operations`).toBeGreaterThan(0)
      })
    })
  })

  it('keeps the trigger and action metadata aligned with the catalogs', () => {
    expect(WORKFLOW_KIND_META.trigger.defaultConfig.triggerDomain).toBe(WORKFLOW_TRIGGER_DOMAINS[0])
    expect(WORKFLOW_KIND_META.action.defaultConfig.actionDomain).toBe(WORKFLOW_ACTION_DOMAINS[0])
    expect(Object.keys(WORKFLOW_TRIGGER_EVENT_CATALOG).length).toBe(WORKFLOW_TRIGGER_DOMAINS.length)
    expect(Object.keys(WORKFLOW_ACTION_CATALOG).length).toBe(WORKFLOW_ACTION_DOMAINS.length)
  })
})
