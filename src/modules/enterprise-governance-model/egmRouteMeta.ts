import { createElement, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { enterpriseCyanGradientActionButtonClass } from '@/lib/enterpriseButtonClasses'
import { EGM_BASE } from '@/modules/enterprise-governance-model/egmPaths'

export type EgmBreadcrumb = { label: string; href?: string }

export type EgmPageMeta = {
  breadcrumbs: EgmBreadcrumb[]
  title: string
  description: string
  /** Optional header actions (Workspace Management–style chrome) */
  right?: ReactNode
}

const OVERVIEW_CTA_CLASS = enterpriseCyanGradientActionButtonClass()

const TEMPLATE_CTA_CLASS =
  'inline-flex h-10 items-center rounded-2xl border border-slate-200/80 bg-white/80 px-4 text-[13px] font-semibold text-slate-800 shadow-sm hover:bg-white dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-100'

function overviewRight(): ReactNode {
  return createElement(
    Link,
    { to: `${EGM_BASE}/operating-model-builder`, className: OVERVIEW_CTA_CLASS },
    '+ New operating model'
  )
}

function createTemplateRight(): ReactNode {
  return createElement(
    Link,
    { to: `${EGM_BASE}/operating-model-builder`, className: TEMPLATE_CTA_CLASS },
    'Create template'
  )
}

export function getEgmPageMeta(pathname: string): EgmPageMeta {
  const base = { label: 'Enterprise Governance Model', href: `${EGM_BASE}/overview` } satisfies EgmBreadcrumb

  if (pathname.endsWith('/overview') || pathname === EGM_BASE || pathname === `${EGM_BASE}/`) {
    return {
      breadcrumbs: [base, { label: 'Governance Overview' }],
      title: 'Governance Overview',
      description:
        'Define enterprise governance operating models, reusable policies, and compliance standards for controlled execution.',
      right: overviewRight(),
    }
  }
  if (pathname.includes('/templates')) {
    return {
      breadcrumbs: [base, { label: 'Governance Templates' }],
      title: 'Governance Templates',
      description: 'Reusable operating model bundles applied by Workspace Management.',
      right: createTemplateRight(),
    }
  }
  if (pathname.includes('/operating-model-builder')) {
    return {
      breadcrumbs: [base, { label: 'Operating Model Builder' }],
      title: 'Operating Model Builder',
      description: 'Guided wizard to compose a governance operating model from approved policy assets.',
    }
  }
  const policyRegistryCrumb = { label: 'Policy registry', href: `${EGM_BASE}/policies/workflow` } satisfies EgmBreadcrumb

  if (pathname.includes('/policies/workflow')) {
    return {
      breadcrumbs: [base, policyRegistryCrumb, { label: 'Workflow Policies' }],
      title: 'Workflow Policies',
      description: 'Delivery lifecycle and checkpoint standards.',
    }
  }
  if (pathname.includes('/policies/sla')) {
    return {
      breadcrumbs: [base, policyRegistryCrumb, { label: 'SLA Policies' }],
      title: 'SLA Policies',
      description: 'Operational response and delivery SLA standards.',
    }
  }
  if (pathname.includes('/policies/naming')) {
    return {
      breadcrumbs: [base, policyRegistryCrumb, { label: 'Naming Standards' }],
      title: 'Naming Standards',
      description: 'Enterprise naming and coding patterns.',
    }
  }
  if (pathname.includes('/policies/approval')) {
    return {
      breadcrumbs: [base, policyRegistryCrumb, { label: 'Approval Models' }],
      title: 'Approval Models',
      description: 'Decision routing and escalation matrices.',
    }
  }
  if (pathname.includes('/compliance/rules')) {
    return {
      breadcrumbs: [base, { label: 'Compliance Rules' }],
      title: 'Compliance Rules',
      description: 'System-scored rules and dimensions. Workspace compliance score is read-only and server-generated.',
    }
  }
  if (pathname.includes('/compliance/scoring')) {
    return {
      breadcrumbs: [base, { label: 'Scoring Model' }],
      title: 'Scoring Model',
      description: 'How dimension weights combine into a workspace governance score.',
    }
  }
  if (pathname.includes('/compliance/coverage')) {
    return {
      breadcrumbs: [base, { label: 'Policy Coverage' }],
      title: 'Policy Coverage',
      description: 'Cross-template coverage of workflow, SLA, naming, and approval assets.',
    }
  }
  if (pathname.includes('/traceability/usage')) {
    return {
      breadcrumbs: [base, { label: 'Usage & Adoption' }],
      title: 'Usage & Adoption',
      description: 'Where governance assets are applied across the workspace estate.',
    }
  }
  if (pathname.includes('/traceability/history')) {
    return {
      breadcrumbs: [base, { label: 'Change History' }],
      title: 'Change History',
      description: 'Semantic history of governance definitions and registry mutations.',
    }
  }
  if (pathname.includes('/traceability/audit')) {
    return {
      breadcrumbs: [base, { label: 'Audit Trail' }],
      title: 'Audit Trail',
      description: 'Immutable audit entries for governance registry changes and assignments.',
    }
  }

  return {
    breadcrumbs: [base, { label: 'Governance Overview' }],
    title: 'Governance Overview',
    description: 'Define enterprise governance operating models, reusable policies, and compliance standards for controlled execution.',
    right: overviewRight(),
  }
}
