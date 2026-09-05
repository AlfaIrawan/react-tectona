export type ProposedNavigateAction = {
  action_code: string
  payload?: Record<string, unknown>
}

const WORKSPACE_RE = /\bworkspaces?\b|workspace-?nya|\bws\b/i
const EXEC_RE = /e?x+c?e?cut(?:ive)?|excutive|eksekutif|executive/i
const SUMMARY_RE = /summary|ringkasan|overview|dashboard|control\s*tower|intelligence/i
const PAIR_RE =
  /(summary|ringkasan|dashboard|overview|control\s*tower).{0,32}workspace|workspace.{0,32}(summary|ringkasan|dashboard|overview|control\s*tower|intelligence)/i

export function isWorkspaceManagementNavigateAction(action: ProposedNavigateAction): boolean {
  if (action.action_code !== 'app.navigate') return false
  const pathname = String(action.payload?.pathname ?? '')
  return pathname.includes('/workspace-management')
}

export function isWorkspaceUiChoicePrompt(text: string): boolean {
  return /buka langsung di ui|pilih di kartu|cukup aku jelaskan|mau aku buka|kartu di bawah|open it (directly )?in the ui|explain in chat/i.test(
    text,
  )
}

function textLooksLikeWorkspaceIntelligence(text: string): boolean {
  const value = text.trim()
  if (!value || !WORKSPACE_RE.test(value)) return false
  if (PAIR_RE.test(value)) return true
  return EXEC_RE.test(value) && SUMMARY_RE.test(value)
}

export function shouldOpenWorkspaceIntelligence(input: {
  userText: string
  assistantText?: string
  proposedActions?: ProposedNavigateAction[]
}): boolean {
  if (input.proposedActions?.some(isWorkspaceManagementNavigateAction)) return true
  return textLooksLikeWorkspaceIntelligence(input.userText) || textLooksLikeWorkspaceIntelligence(input.assistantText ?? '')
}
