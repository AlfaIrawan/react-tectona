export type ProjectTemplateBadge = 'recommended' | 'premium'

export type ProjectTemplateCategoryId =
  | 'software-development'
  | 'service-management'
  | 'work-management'
  | 'product-management'
  | 'personal'

export interface ProjectTemplateFeature {
  title: string
  body: string
  learnMoreLabel?: string
  imageSrc?: string
}

export interface ProjectTemplateWorkType {
  label: string
  tone: 'violet' | 'emerald' | 'rose' | 'sky' | 'cyan'
}

export interface ProjectTemplateCategory {
  id: ProjectTemplateCategoryId
  label: string
  description: string
  enterprise?: boolean
}

export interface ProjectTemplate {
  id: string
  categoryId: ProjectTemplateCategoryId
  name: string
  summary: string
  /** Default description when user leaves the field empty at project creation. */
  defaultDescription?: string
  /** Ringkas untuk kartu drawer / preview; detail panjang tetap di `summary`. */
  cardSummary?: string
  thumbnailImage: string
  badge?: ProjectTemplateBadge
  recommendedFor: string[]
  workTypes: ProjectTemplateWorkType[]
  workflow: string[]
  features: ProjectTemplateFeature[]
  iconName?: string
  borderColor?: string
}

export const PROJECT_TEMPLATE_CATEGORIES: ProjectTemplateCategory[] = [
  {
    id: 'software-development',
    label: 'Software development',
    description:
      'Kick-start engineering delivery on Tectona with boards, backlogs, and release-oriented workflows your squad can run on day one.',
  },
  {
    id: 'service-management',
    label: 'Service management',
    description:
      'Structure intake, ownership, and resolution paths for operational requests without losing SLA visibility.',
  },
  {
    id: 'work-management',
    label: 'Work management',
    description:
      'Coordinate day-to-day execution, hand-offs, and approvals when work spans people and functions.',
  },
  {
    id: 'product-management',
    label: 'Product management',
    description:
      'Shape discovery, roadmap, and launch readiness in workspaces tuned for product-led teams.',
  },
  {
    id: 'personal',
    label: 'Personal',
    description:
      'Stay on top of personal goals and weekly priorities with a lightweight structure that stays out of your way.',
  },
]

const KANBAN_FEATURES: ProjectTemplateFeature[] = [
  {
    title: 'See progress on a shared board',
    body:
      'Every item appears as a card on a column-based board that reflects your delivery stages. Teammates see the same live status without chasing updates in chat or separate spreadsheets. Drag cards forward as work advances, attach owners and due dates, and scan the board in stand-ups or planning sessions to agree on what is blocked, in flight, or ready to release.',
    imageSrc: '/images/project-templates/kanban/see-progress-on-a-shared-board.png',
  },
  {
    title: 'Protect focus with WIP limits',
    body:
      'Set a maximum number of cards allowed in each in-progress column so the team finishes current work before starting new tasks. When a column hits its limit, the board surfaces the constraint immediately—helping leads reassign capacity, defer lower-priority items, or swarm blocked cards. The result is steadier flow, fewer context switches, and hand-offs that stakeholders can trust.',
    imageSrc: '/images/project-templates/kanban/protect-focus-with-wip-limits.png',
  },
  {
    title: 'Spot bottlenecks early',
    body:
      'Flow metrics highlight where cards stall: aging items in a column, spikes in work entering a stage, or columns that never clear. Review cycle time and throughput during retrospectives to decide whether to add people, split work, or change policies. Catching congestion early keeps release dates realistic and prevents one overloaded stage from silently slowing the entire pipeline.',
    imageSrc: '/images/project-templates/kanban/spot-bottlenecks-early.png',
  },
]

function defaultFeatures(summary: string, templateName: string): ProjectTemplateFeature[] {
  return [
    {
      title: 'Ready-to-run workspace',
      body:
        `${summary} Boards, fields, and views are preconfigured so your team can create the first item minutes after the project is created—without admin setup, blank columns, or guesswork about which structure to use first.`,
    },
    {
      title: 'Preset work types and stages',
      body:
        `The ${templateName} template ships with work types and lifecycle stages tuned to this way of working. Assignees, priorities, and status transitions follow a predictable path from day one, while still leaving room to adjust labels, columns, and automation as your process matures.`,
    },
  ]
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'kanban',
    categoryId: 'software-development',
    name: 'Kanban',
    summary:
      'Run continuous delivery on a visual board with explicit WIP limits and clear hand-offs between stages. Built for pull-based teams that want one shared view of waiting, active, and finished work—with guardrails that protect focus and signals that expose bottlenecks before dates slip.',
    cardSummary: 'Visual board with WIP limits for pull-based teams optimizing delivery flow.',
    defaultDescription:
      'Banking System delivery workspace — vendor selection and procurement, regulatory compliance, joint kick-off, and sprint-zero development toward core banking go-live.',
    thumbnailImage: '/images/project-templates/kanban.png',
    badge: 'recommended',
    recommendedFor: ['Teams that pull work from a shared queue', 'Squads optimizing flow over fixed sprints'],
    workTypes: [
      { label: 'Epic', tone: 'violet' },
      { label: 'Story', tone: 'emerald' },
      { label: 'Bug', tone: 'rose' },
      { label: 'Task', tone: 'sky' },
      { label: 'Sub-task', tone: 'cyan' },
    ],
    workflow: ['BACKLOG', 'TO DO', 'IN PROGRESS', 'IN REVIEW', 'DONE'],
    features: KANBAN_FEATURES,
    iconName: 'bar-chart-3',
    borderColor: '#3b82f6',
  },
  {
    id: 'scrum',
    categoryId: 'software-development',
    name: 'Scrum',
    summary: 'Plan iteration goals, groom a backlog, and review outcomes in a cadence built for cross-functional squads.',
    cardSummary: 'Sprint cadence with backlog grooming and review rituals for product squads.',
    thumbnailImage: '/images/project-templates/scrum.png',
    recommendedFor: ['Sprint-based product teams', 'Squads that run regular planning and review rituals'],
    workTypes: [
      { label: 'Epic', tone: 'violet' },
      { label: 'Story', tone: 'emerald' },
      { label: 'Bug', tone: 'rose' },
      { label: 'Task', tone: 'sky' },
    ],
    workflow: ['BACKLOG', 'IN SPRINT', 'DONE'],
    features: defaultFeatures(
      'Plan iteration goals, groom a backlog, and review outcomes in a cadence built for cross-functional squads.',
      'Scrum'
    ),
    iconName: 'rocket',
    borderColor: '#6366f1',
  },
  {
    id: 'top-level-planning',
    categoryId: 'software-development',
    name: 'Top-level planning',
    summary: 'Line up initiatives, milestones, and cross-program dependencies without losing portfolio-level context.',
    cardSummary: 'Program-level view of initiatives, milestones, and cross-team dependencies.',
    thumbnailImage: '/images/project-templates/top-level-planning.png',
    badge: 'premium',
    recommendedFor: ['Program leads', 'Portfolio coordination teams'],
    workTypes: [
      { label: 'Initiative', tone: 'violet' },
      { label: 'Milestone', tone: 'sky' },
      { label: 'Dependency', tone: 'rose' },
    ],
    workflow: ['PLANNED', 'IN FLIGHT', 'COMPLETE'],
    features: defaultFeatures(
      'Line up initiatives, milestones, and cross-program dependencies without losing portfolio-level context.',
      'Top-level planning'
    ),
    iconName: 'trending-up',
    borderColor: '#8b5cf6',
  },
  {
    id: 'cross-team-planning',
    categoryId: 'software-development',
    name: 'Cross-team planning',
    summary: 'Align commitments, owners, and timelines when multiple squads ship toward the same outcome.',
    cardSummary: 'Shared planning when several squads deliver toward one outcome.',
    thumbnailImage: '/images/project-templates/cross-team-planning.png',
    badge: 'premium',
    recommendedFor: ['Multi-squad programs', 'Release coordination roles'],
    workTypes: [
      { label: 'Feature', tone: 'emerald' },
      { label: 'Risk', tone: 'rose' },
      { label: 'Decision', tone: 'sky' },
    ],
    workflow: ['DRAFT', 'COMMITTED', 'DELIVERED'],
    features: defaultFeatures(
      'Align commitments, owners, and timelines when multiple squads ship toward the same outcome.',
      'Cross-team planning'
    ),
    iconName: 'package',
    borderColor: '#06b6d4',
  },
  {
    id: 'development-requests',
    categoryId: 'software-development',
    name: 'Development requests',
    summary: 'Channel internal build asks through intake, triage, and fulfillment with accountable turnaround targets.',
    cardSummary: 'Intake and triage for internal development requests with clear ownership.',
    thumbnailImage: '/images/project-templates/development-request.png',
    recommendedFor: ['Platform engineering', 'Internal enablement desks'],
    workTypes: [
      { label: 'Request', tone: 'sky' },
      { label: 'Bug', tone: 'rose' },
      { label: 'Enhancement', tone: 'emerald' },
    ],
    workflow: ['NEW', 'TRIAGE', 'IN PROGRESS', 'DONE'],
    features: defaultFeatures(
      'Channel internal build asks through intake, triage, and fulfillment with accountable turnaround targets.',
      'Development requests'
    ),
    iconName: 'code',
    borderColor: '#14b8a6',
  },
  {
    id: 'product-discovery',
    categoryId: 'software-development',
    name: 'Product discovery',
    summary: 'Capture assumptions, run experiments, and record learning before delivery scope is locked in.',
    cardSummary: 'Hypothesis-led discovery before delivery scope is committed.',
    thumbnailImage: '/images/project-templates/ideas.png',
    recommendedFor: ['Discovery squads', 'Innovation or incubation teams'],
    workTypes: [
      { label: 'Hypothesis', tone: 'violet' },
      { label: 'Experiment', tone: 'cyan' },
      { label: 'Insight', tone: 'emerald' },
    ],
    workflow: ['IDEA', 'TESTING', 'VALIDATED'],
    features: defaultFeatures(
      'Capture assumptions, run experiments, and record learning before delivery scope is locked in.',
      'Product discovery'
    ),
    iconName: 'sparkles',
    borderColor: '#ec4899',
  },
  {
    id: 'product-roadmap',
    categoryId: 'software-development',
    name: 'Product roadmap',
    summary: 'Lay out themes, releases, and expected outcomes on a timeline stakeholders can scan quickly.',
    cardSummary: 'Release themes and outcomes on a timeline stakeholders can scan.',
    thumbnailImage: '/images/project-templates/product-roadmap.png',
    recommendedFor: ['Product managers', 'Release and roadmap owners'],
    workTypes: [
      { label: 'Theme', tone: 'violet' },
      { label: 'Outcome', tone: 'emerald' },
      { label: 'Release', tone: 'sky' },
    ],
    workflow: ['NOW', 'NEXT', 'LATER'],
    features: defaultFeatures(
      'Lay out themes, releases, and expected outcomes on a timeline stakeholders can scan quickly.',
      'Product roadmap'
    ),
    iconName: 'trending-up',
    borderColor: '#f97316',
  },
  {
    id: 'prioritization',
    categoryId: 'software-development',
    name: 'Prioritization',
    summary: 'Compare value, effort, and strategic fit so the backlog reflects what should move next.',
    cardSummary: 'Rank backlog candidates by value, effort, and strategic alignment.',
    thumbnailImage: '/images/project-templates/prioritization.png',
    recommendedFor: ['Product owners', 'Delivery leads balancing demand'],
    workTypes: [
      { label: 'Candidate', tone: 'sky' },
      { label: 'Scored item', tone: 'emerald' },
      { label: 'Deferred', tone: 'rose' },
    ],
    workflow: ['CANDIDATE', 'SCORED', 'COMMITTED'],
    features: defaultFeatures(
      'Compare value, effort, and strategic fit so the backlog reflects what should move next.',
      'Prioritization'
    ),
    iconName: 'zap',
    borderColor: '#f59e0b',
  },
  {
    id: 'portfolio-roadmap',
    categoryId: 'software-development',
    name: 'Portfolio roadmap',
    summary:
      'Rank initiatives across programs by goal alignment, expected impact, and delivery effort so investment stays visible at portfolio scale.',
    cardSummary: 'Portfolio view to rank initiatives by goals, impact, and effort.',
    thumbnailImage: '/images/project-templates/portfolio-roadmap.png',
    recommendedFor: ['Portfolio owners', 'Program managers balancing multiple streams'],
    workTypes: [
      { label: 'Initiative', tone: 'violet' },
      { label: 'Goal', tone: 'emerald' },
      { label: 'Bet', tone: 'sky' },
    ],
    workflow: ['ON TRACK', 'AT RISK', 'PENDING'],
    features: defaultFeatures(
      'Rank initiatives across programs by goal alignment, expected impact, and delivery effort so investment stays visible at portfolio scale.',
      'Portfolio roadmap'
    ),
    iconName: 'trending-up',
    borderColor: '#f97316',
  },
  {
    id: 'hierarchy',
    categoryId: 'software-development',
    name: 'Hierarchy',
    summary:
      'Link product ideas to the outcomes, opportunities, and solutions they support so delivery choices trace back to customer value.',
    cardSummary: 'Trace ideas from outcomes through opportunities to solutions.',
    thumbnailImage: '/images/project-templates/hierarchy.png',
    badge: 'premium',
    recommendedFor: ['Product discovery teams', 'Outcome-oriented product squads'],
    workTypes: [
      { label: 'Outcome', tone: 'violet' },
      { label: 'Opportunity', tone: 'emerald' },
      { label: 'Solution', tone: 'sky' },
    ],
    workflow: ['NOW', 'NEXT', 'LATER'],
    features: defaultFeatures(
      'Link product ideas to the outcomes, opportunities, and solutions they support so delivery choices trace back to customer value.',
      'Hierarchy'
    ),
    iconName: 'package',
    borderColor: '#22c55e',
  },
  {
    id: 'bug-tracking',
    categoryId: 'software-development',
    name: 'Bug tracking',
    summary:
      'Record defects, set severity and ownership, and drive fixes from report through verification without losing audit context.',
    cardSummary: 'Defect intake, prioritization, and fix verification for engineering teams.',
    thumbnailImage: '/images/project-templates/bug-tracking.png',
    recommendedFor: ['QA and engineering teams', 'Release managers guarding production quality'],
    workTypes: [
      { label: 'Bug', tone: 'rose' },
      { label: 'Regression', tone: 'violet' },
      { label: 'Task', tone: 'sky' },
    ],
    workflow: ['OPEN', 'IN PROGRESS', 'RESOLVED'],
    features: defaultFeatures(
      'Record defects, set severity and ownership, and drive fixes from report through verification without losing audit context.',
      'Bug tracking'
    ),
    iconName: 'code',
    borderColor: '#ef4444',
  },
  {
    id: 'service-request',
    categoryId: 'service-management',
    name: 'Service request',
    summary: 'Track incidents, changes, and service tickets with priority, ownership, and resolution status in one place.',
    cardSummary: 'Service desk flow for incidents, requests, and changes.',
    thumbnailImage: '/images/project-templates/development-request.png',
    recommendedFor: ['Service desks', 'Shared operations teams'],
    workTypes: [
      { label: 'Incident', tone: 'rose' },
      { label: 'Request', tone: 'sky' },
      { label: 'Change', tone: 'violet' },
    ],
    workflow: ['NEW', 'IN PROGRESS', 'RESOLVED'],
    features: defaultFeatures(
      'Track incidents, changes, and service tickets with priority, ownership, and resolution status in one place.',
      'Service request'
    ),
    iconName: 'database',
    borderColor: '#0ea5e9',
  },
  {
    id: 'work-management-basic',
    categoryId: 'work-management',
    name: 'Task execution',
    summary: 'Assign owners, due dates, and status on straightforward task lists built for everyday follow-through.',
    cardSummary: 'Everyday task lists with owners, dates, and clear status.',
    thumbnailImage: '/images/project-templates/cross-team-planning.png',
    recommendedFor: ['Operations teams', 'Shared service coordinators'],
    workTypes: [
      { label: 'Task', tone: 'sky' },
      { label: 'Sub-task', tone: 'cyan' },
    ],
    workflow: ['OPEN', 'IN PROGRESS', 'DONE'],
    features: defaultFeatures(
      'Assign owners, due dates, and status on straightforward task lists built for everyday follow-through.',
      'Task execution'
    ),
    iconName: 'file-text',
    borderColor: '#10b981',
  },
  {
    id: 'product-lifecycle',
    categoryId: 'product-management',
    name: 'Product lifecycle',
    summary: 'Follow a product from early discovery through build and launch without splitting context across tools.',
    cardSummary: 'Discovery through launch in one product workspace.',
    thumbnailImage: '/images/project-templates/product-roadmap.png',
    recommendedFor: ['Product teams', 'Launch readiness coordinators'],
    workTypes: [
      { label: 'Feature', tone: 'emerald' },
      { label: 'Launch item', tone: 'violet' },
      { label: 'Bug', tone: 'rose' },
    ],
    workflow: ['DISCOVERY', 'BUILD', 'LAUNCH'],
    features: defaultFeatures(
      'Follow a product from early discovery through build and launch without splitting context across tools.',
      'Product lifecycle'
    ),
    iconName: 'shopping-cart',
    borderColor: '#a855f7',
  },
  {
    id: 'personal-planner',
    categoryId: 'personal',
    name: 'Personal planner',
    summary: 'Organize personal goals, weekly focus areas, and tasks with minimal overhead.',
    cardSummary: 'Lightweight planner for personal goals and weekly tasks.',
    thumbnailImage: '/images/project-templates/prioritization.png',
    recommendedFor: ['Individual contributors', 'Personal productivity use cases'],
    workTypes: [
      { label: 'Goal', tone: 'violet' },
      { label: 'Task', tone: 'sky' },
    ],
    workflow: ['PLANNED', 'DOING', 'DONE'],
    features: defaultFeatures(
      'Organize personal goals, weekly focus areas, and tasks with minimal overhead.',
      'Personal planner'
    ),
    iconName: 'file-text',
    borderColor: '#64748b',
  },
]

export const DEFAULT_PROJECT_TEMPLATE_CATEGORY_ID: ProjectTemplateCategoryId = 'software-development'

export function getProjectTemplateCategory(id: ProjectTemplateCategoryId): ProjectTemplateCategory | undefined {
  return PROJECT_TEMPLATE_CATEGORIES.find((category) => category.id === id)
}

export function getProjectTemplatesByCategory(categoryId: ProjectTemplateCategoryId): ProjectTemplate[] {
  return PROJECT_TEMPLATES.filter((template) => template.categoryId === categoryId)
}

export function getProjectTemplateById(id: string): ProjectTemplate | undefined {
  return PROJECT_TEMPLATES.find((template) => template.id === id)
}

export function getProjectTemplateCardSummary(template: ProjectTemplate): string {
  return template.cardSummary ?? template.summary
}

export function projectTemplateTag(templateId: string): string {
  return templateId
}
