import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Building2, Check, ChevronDown, Loader2, Search, UserRound } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useTenantContext } from '@/auth/TenantContext'
import { useWorkspaceNavigate } from '@/hooks/useWorkspaceNavigate'
import { isAllWorkspacesSelection } from '@/lib/tenantWorkspaceScope'
import { legacyAppPathFromLocation } from '@/lib/workspaceRouting'
import { useUserWorkspaceOptions, type UserWorkspaceOption } from '../hooks/useUserWorkspaceOptions'

const WORKSPACE_LIST_MAX_HEIGHT_CLASS = 'max-h-64'

function workspaceKindLabel(option: UserWorkspaceOption): string {
  return option.tenantMode === 'personal' ? 'Personal workspace' : 'Organization workspace'
}

interface WorkspaceSwitcherProps {
  compact?: boolean
  menuAlign?: 'start' | 'end'
}

export function WorkspaceSwitcher({ compact = false, menuAlign = 'start' }: WorkspaceSwitcherProps) {
  const location = useLocation()
  const { workspaceId, displayName, setActiveTenant } = useTenantContext()
  const workspaceNavigate = useWorkspaceNavigate()
  const { options, loading, fallbackOrgName } = useUserWorkspaceOptions()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const currentAppPath = useMemo(() => {
    const path = legacyAppPathFromLocation(location.pathname, location.search, location.hash)
    return path && path !== '' ? path : '/projects'
  }, [location.hash, location.pathname, location.search])

  const activeOption = useMemo(() => {
    if (workspaceId && !isAllWorkspacesSelection(workspaceId)) {
      return options.find((option) => option.workspaceId === workspaceId) ?? null
    }
    return options[0] ?? null
  }, [options, workspaceId])

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((option) => {
      const haystack = [
        option.workspaceName,
        option.organizationName,
        option.slug ?? '',
        workspaceKindLabel(option),
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [options, query])

  const groupedOptions = useMemo(() => {
    const groups = new Map<string, UserWorkspaceOption[]>()
    for (const option of filteredOptions) {
      const key = option.organizationName || fallbackOrgName
      const bucket = groups.get(key) ?? []
      bucket.push(option)
      groups.set(key, bucket)
    }
    return Array.from(groups.entries())
  }, [fallbackOrgName, filteredOptions])

  const triggerLabel =
    activeOption?.workspaceName
    ?? displayName
    ?? activeOption?.organizationName
    ?? fallbackOrgName

  const selectWorkspace = (option: UserWorkspaceOption) => {
    setActiveTenant({
      workspaceId: option.workspaceId,
      orgId: option.organizationId || null,
      slug: option.slug,
      tenantMode: option.tenantMode,
      displayName: option.workspaceName,
      selectedWorkspaceIds: undefined,
    })
    workspaceNavigate(currentAppPath, {
      slug: option.slug,
      workspaceId: option.workspaceId,
    })
    setOpen(false)
    setQuery('')
  }

  if (loading && !displayName?.trim() && options.length === 0) {
    const loadingLabel = 'Workspace…'
    if (compact) {
      return (
        <div className="flex h-8 items-center gap-1.5 rounded-md border border-slate-200/80 bg-white/90 px-3 text-xs font-medium text-slate-600 shadow-sm backdrop-blur-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          {loadingLabel}
        </div>
      )
    }

    return (
      <span className="topbar-tenant-name inline-flex items-center gap-2 text-base font-medium text-slate-700 whitespace-nowrap">
        <Loader2 className="h-4 w-4 animate-spin text-slate-500" aria-hidden />
        {loadingLabel}
      </span>
    )
  }

  if (options.length <= 1) {
    if (compact) return null

    return (
      <span className="topbar-tenant-name text-base font-medium text-slate-700 whitespace-nowrap">
        {triggerLabel}
      </span>
    )
  }

  const triggerClassName = compact
    ? cn(
        'inline-flex h-8 max-w-[12rem] items-center gap-1 rounded-md border border-slate-200/80 bg-white/90 px-3',
        'text-xs font-medium text-slate-800 shadow-sm backdrop-blur-sm transition-colors hover:bg-white',
      )
    : cn(
        'topbar-tenant-name inline-flex max-w-[min(24rem,calc(100vw-28rem))] items-center gap-1.5 rounded-md px-1.5 py-1',
        'text-base font-medium text-slate-700 transition-colors hover:bg-slate-100/80',
      )

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) setQuery('')
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={triggerClassName}
          aria-label="Switch workspace"
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronDown
            className={cn('shrink-0 text-slate-500', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')}
            aria-hidden
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={menuAlign}
        className="z-[200] w-80 overflow-hidden border border-slate-200 bg-white p-0 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="px-3 pt-2.5 pb-2">
          <DropdownMenuLabel className="px-0 pb-2">Workspace</DropdownMenuLabel>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="Search workspace…"
              className="h-8 pl-8 text-xs"
              aria-label="Search workspaces"
            />
          </div>
        </div>
        <DropdownMenuSeparator className="my-0" />
        <div className={cn('overflow-y-auto pb-3 pt-1', WORKSPACE_LIST_MAX_HEIGHT_CLASS)}>
          {groupedOptions.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              No workspace matches “{query.trim()}”.
            </div>
          ) : (
            groupedOptions.map(([organizationName, organizationOptions], groupIndex) => (
              <div key={organizationName}>
                {groupIndex > 0 ? <DropdownMenuSeparator /> : null}
                <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {organizationName}
                </DropdownMenuLabel>
                {organizationOptions.map((option) => {
                  const isActive = activeOption?.workspaceId === option.workspaceId
                  const Icon = option.tenantMode === 'personal' ? UserRound : Building2
                  return (
                    <DropdownMenuItem
                      key={option.workspaceId}
                      onSelect={() => selectWorkspace(option)}
                      className="flex cursor-pointer items-start gap-2 py-2"
                    >
                      <Check
                        className={cn(
                          'mt-0.5 h-4 w-4 shrink-0 text-primary',
                          isActive ? 'opacity-100' : 'opacity-0',
                        )}
                        aria-hidden
                      />
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-foreground">{option.workspaceName}</div>
                        <div className="text-xs text-muted-foreground">{workspaceKindLabel(option)}</div>
                      </div>
                    </DropdownMenuItem>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
