import type { DirectoryKanbanItem } from '@/modules/task-work-management/components/DirectoryKanbanView'

type Priority = DirectoryKanbanItem['priority']

/** Master blueprint — keep in sync with migration 008 (Banking System use case). */
export const KANBAN_TEMPLATE_BLUEPRINTS: Array<{
  suffix: string
  title: string
  type: string
  status: DirectoryKanbanItem['status']
  priority: Priority
  progress: number
  dueOffset: number
}> = [
  { suffix: 'epic-banking-delivery', title: 'Banking System — vendor to production', type: 'Epic', status: 'Backlog', priority: 'High', progress: 0, dueOffset: 120 },
  { suffix: 'feat-vendor-selection', title: 'Vendor selection & procurement', type: 'Feature', status: 'In Progress', priority: 'High', progress: 55, dueOffset: 28 },
  { suffix: 'feat-kickoff', title: 'Kick-off & squad mobilization', type: 'Feature', status: 'To Do', priority: 'High', progress: 0, dueOffset: 21 },
  { suffix: 'feat-dev-sprint-zero', title: 'Development phase 1 — sprint zero', type: 'Feature', status: 'Backlog', priority: 'Medium', progress: 0, dueOffset: 45 },
  { suffix: 'task-charter', title: 'Project charter & scope approved', type: 'Task', status: 'Done', priority: 'High', progress: 100, dueOffset: -14 },
  { suffix: 'task-business-case', title: 'Business case & budget sign-off', type: 'Task', status: 'Done', priority: 'Medium', progress: 100, dueOffset: -10 },
  { suffix: 'task-rfp-published', title: 'Vendor RFP published to shortlist', type: 'Task', status: 'Done', priority: 'Medium', progress: 100, dueOffset: -7 },
  { suffix: 'task-vendor-evaluation', title: 'Vendor technical evaluation & product demos', type: 'Task', status: 'In Progress', priority: 'High', progress: 62, dueOffset: 14 },
  { suffix: 'task-compliance-assessment', title: 'Security & regulatory compliance assessment', type: 'Task', status: 'In Progress', priority: 'Critical', progress: 48, dueOffset: 12 },
  { suffix: 'task-vendor-contract', title: 'Final vendor contract & SLA review', type: 'Task', status: 'In Review', priority: 'High', progress: 85, dueOffset: 8 },
  { suffix: 'task-sla-draft', title: 'Vendor SLA & penalty clause drafting', type: 'Task', status: 'To Do', priority: 'High', progress: 0, dueOffset: 18 },
  { suffix: 'task-architecture-signoff', title: 'Target architecture blueprint sign-off', type: 'Task', status: 'In Review', priority: 'Medium', progress: 78, dueOffset: 10 },
  { suffix: 'task-kickoff-prep', title: 'Kick-off workshop preparation', type: 'Task', status: 'To Do', priority: 'High', progress: 0, dueOffset: 16 },
  { suffix: 'task-squad-raci', title: 'Delivery squad formation & RACI matrix', type: 'Task', status: 'To Do', priority: 'Medium', progress: 0, dueOffset: 15 },
  { suffix: 'task-dev-env', title: 'Development & sandbox environment setup', type: 'Task', status: 'To Do', priority: 'High', progress: 0, dueOffset: 20 },
  { suffix: 'task-integration-blueprint', title: 'Core banking API integration blueprint', type: 'Task', status: 'To Do', priority: 'Medium', progress: 0, dueOffset: 24 },
  { suffix: 'task-core-ledger', title: 'Core ledger & account module scaffolding', type: 'Task', status: 'Backlog', priority: 'High', progress: 0, dueOffset: 35 },
  { suffix: 'task-payment-hub', title: 'Payment hub — domestic & international rails', type: 'Task', status: 'Backlog', priority: 'High', progress: 0, dueOffset: 42 },
  { suffix: 'task-swift-sepa', title: 'SWIFT / SEPA transfer implementation', type: 'Task', status: 'Backlog', priority: 'Medium', progress: 0, dueOffset: 50 },
  { suffix: 'task-mobile-banking', title: 'Mobile banking channel MVP', type: 'Task', status: 'Backlog', priority: 'Medium', progress: 0, dueOffset: 55 },
  { suffix: 'task-reg-reporting', title: 'Regulatory reporting (OJK / BI)', type: 'Task', status: 'Backlog', priority: 'High', progress: 0, dueOffset: 60 },
  { suffix: 'task-data-migration', title: 'Legacy core data migration strategy', type: 'Task', status: 'Backlog', priority: 'Medium', progress: 0, dueOffset: 48 },
  { suffix: 'bug-vendor-api-gap', title: 'Vendor API gap — standing instruction endpoint missing', type: 'Bug', status: 'Backlog', priority: 'Critical', progress: 12, dueOffset: 6 },
  { suffix: 'task-stakeholder-kickoff', title: 'Joint kick-off meeting', type: 'Task', status: 'To Do', priority: 'High', progress: 0, dueOffset: 22 },
]

/** @deprecated Use KANBAN_TEMPLATE_BLUEPRINTS */
export const KANBAN_UI_UX_TEMPLATE_BLUEPRINTS = KANBAN_TEMPLATE_BLUEPRINTS
