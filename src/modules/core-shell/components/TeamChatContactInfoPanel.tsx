import { useMemo, useState, type ReactNode } from 'react'
import {
  Bell,
  ChevronDown,
  Eraser,
  FileText,
  Heart,
  Image as ImageIcon,
  ListPlus,
  Lock,
  Search,
  Shield,
  Star,
  ThumbsDown,
  Timer,
  Trash2,
  UsersRound,
  Ban,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { isChannelMuted, setChannelMuted } from '@/lib/chat/chatMuteStorage'
import type { ChatContact } from '@/lib/chat/chatContactDirectory'

export type GroupInCommon = {
  id: string
  title: string
  memberPreview: string
}

export type ContactMediaItem = {
  id: string
  url: string
  kind: 'image' | 'document' | 'audio' | 'video' | 'contact' | 'poll' | 'event'
  name: string
}

type TeamChatContactInfoPanelProps = {
  avatar: ReactNode
  contact: ChatContact
  channelId?: string
  isFavorite?: boolean
  groupsInCommon: GroupInCommon[]
  mediaItems: ContactMediaItem[]
  onSearch: () => void
  onToggleFavorite: () => void
  onAddToList: () => void
  onClearChat: () => void
  onBlock: () => void
  onDeleteChat: () => void
  onOpenDisappearingMessages?: () => void
  disappearingSubtitle?: string
  isChatLocked?: boolean
  onToggleChatLock?: () => void
  onFeatureSoon: (label: string) => void
}

function InfoRowButton({
  icon,
  title,
  subtitle,
  onClick,
  right,
  destructive,
}: {
  icon: ReactNode
  title: string
  subtitle?: string
  onClick?: () => void
  right?: ReactNode
  destructive?: boolean
}) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors',
        onClick && 'hover:bg-muted/60 active:bg-muted/80',
        destructive && 'text-red-700 dark:text-red-400',
      )}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground [&_svg]:h-4 [&_svg]:w-4">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] leading-snug">{title}</span>
        {subtitle ? (
          <span className="mt-0.5 block text-[11px] leading-tight text-muted-foreground">{subtitle}</span>
        ) : null}
      </span>
      {right ? <span className="shrink-0">{right}</span> : null}
    </Comp>
  )
}

function MediaThumb({ item }: { item: ContactMediaItem }) {
  if (item.kind === 'image') {
    return (
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
        <img src={item.url} alt="" className="h-full w-full object-cover" />
      </div>
    )
  }
  return (
    <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-md bg-muted/80 px-1">
      {item.kind === 'document' ? (
        <FileText className="h-5 w-5 text-muted-foreground" aria-hidden />
      ) : (
        <ImageIcon className="h-5 w-5 text-muted-foreground" aria-hidden />
      )}
      <span className="mt-0.5 line-clamp-1 w-full text-center text-[8px] text-muted-foreground">{item.name}</span>
    </div>
  )
}

export function TeamChatContactInfoPanel({
  avatar,
  contact,
  channelId,
  isFavorite,
  groupsInCommon,
  mediaItems,
  onSearch,
  onToggleFavorite,
  onAddToList,
  onClearChat,
  onBlock,
  onDeleteChat,
  onOpenDisappearingMessages,
  disappearingSubtitle = 'Off',
  isChatLocked = false,
  onToggleChatLock,
  onFeatureSoon,
}: TeamChatContactInfoPanelProps) {
  const [groupsExpanded, setGroupsExpanded] = useState(false)
  const [muted, setMuted] = useState(() => (channelId ? isChannelMuted(channelId) : false))

  const visibleGroups = useMemo(() => {
    if (groupsExpanded) return groupsInCommon
    return groupsInCommon.slice(0, 5)
  }, [groupsExpanded, groupsInCommon])

  const hiddenGroupCount = Math.max(0, groupsInCommon.length - 5)

  const secondaryLine = contact.subtitle?.trim() || '—'

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain bg-background [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex flex-col items-center px-4 pb-4 pt-2">
        <div className="mb-2 [&_.relative]:h-24 [&_.relative]:w-24 [&_img]:object-cover">{avatar}</div>
        <p className="text-center text-base font-semibold tracking-tight text-foreground">{contact.name}</p>
        <p className="mt-0.5 text-center text-[11px] text-muted-foreground">{secondaryLine}</p>
        <p className="mt-1 text-center text-[10px] text-muted-foreground/80">
          Profil dari Identity Lite — tidak dapat diedit di chat.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-3 h-auto min-w-[4.75rem] flex-col gap-0.5 rounded-lg border-border/80 px-4 py-2"
          onClick={onSearch}
        >
          <Search className="h-4 w-4 text-emerald-600" aria-hidden />
          <span className="text-[11px] font-medium text-foreground">Search</span>
        </Button>
      </div>

      <div className="border-t border-border/80">
        <button
          type="button"
          className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/50"
          onClick={() => onFeatureSoon('Media, links and docs')}
        >
          <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="flex-1 text-[13px]">Media, links and docs</span>
          <span className="text-[11px] text-muted-foreground">{mediaItems.length}</span>
        </button>
        {mediaItems.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {mediaItems.slice(0, 4).map((item) => (
              <MediaThumb key={item.id} item={item} />
            ))}
          </div>
        ) : null}
      </div>

      <div className="border-t border-border/80">
        <InfoRowButton
          icon={<Star className="text-muted-foreground" />}
          title="Starred messages"
          onClick={() => onFeatureSoon('Starred messages')}
        />
        <InfoRowButton
          icon={<Bell className="text-muted-foreground" />}
          title="Mute notifications"
          right={
            <Switch
              checked={muted}
              disabled={!channelId}
              onCheckedChange={(checked) => {
                if (!channelId) return
                setMuted(checked)
                setChannelMuted(channelId, checked)
              }}
              aria-label="Mute notifications"
            />
          }
        />
        <InfoRowButton
          icon={<Timer className="text-muted-foreground" />}
          title="Disappearing messages"
          subtitle={disappearingSubtitle}
          onClick={onOpenDisappearingMessages}
        />
        {onToggleChatLock ? (
          <InfoRowButton
            icon={<Lock className="text-muted-foreground" />}
            title={isChatLocked ? 'Unlock chat' : 'Lock chat'}
            subtitle={
              isChatLocked
                ? 'Nonaktifkan lock dan hapus kode rahasia'
                : 'Kode rahasia diperlukan untuk membuka chat'
            }
            onClick={onToggleChatLock}
          />
        ) : null}
        <InfoRowButton
          icon={<Shield className="text-muted-foreground" />}
          title="Advanced chat privacy"
          subtitle="Off"
          onClick={() => onFeatureSoon('Advanced chat privacy')}
        />
        <InfoRowButton
          icon={<Lock className="text-muted-foreground" />}
          title="Encryption"
          subtitle="Messages are end-to-end encrypted. Click to verify."
          onClick={() => onFeatureSoon('Encryption')}
        />
      </div>

      {groupsInCommon.length > 0 ? (
        <div className="border-t border-border/80 py-2">
          <p className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {groupsInCommon.length} group{groupsInCommon.length === 1 ? '' : 's'} in common
          </p>
          {visibleGroups.map((g) => (
            <button
              key={g.id}
              type="button"
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/50"
              onClick={() => onFeatureSoon('Open group')}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-200">
                <UsersRound className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-foreground">{g.title}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{g.memberPreview}</span>
              </span>
            </button>
          ))}
          {!groupsExpanded && hiddenGroupCount > 0 ? (
            <button
              type="button"
              className="flex w-full items-center justify-center gap-1 py-1.5 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => setGroupsExpanded(true)}
            >
              {hiddenGroupCount} more
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="border-t border-border/80 pb-2">
        <InfoRowButton
          icon={
            <Heart
              className={cn(isFavorite && 'fill-rose-500 text-rose-500')}
              aria-hidden
            />
          }
          title={isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
          onClick={onToggleFavorite}
        />
        <InfoRowButton
          icon={<ListPlus className="text-muted-foreground" />}
          title="Add to list"
          onClick={onAddToList}
        />
        <InfoRowButton
          icon={<Eraser className="text-red-700 dark:text-red-400" />}
          title="Clear chat"
          destructive
          onClick={onClearChat}
        />
        <InfoRowButton
          icon={<Ban className="text-red-700 dark:text-red-400" />}
          title={`Block ${contact.name}`}
          destructive
          onClick={onBlock}
        />
        <InfoRowButton
          icon={<ThumbsDown className="text-red-700 dark:text-red-400" />}
          title={`Report ${contact.name}`}
          destructive
          onClick={() => onFeatureSoon('Report')}
        />
        <InfoRowButton
          icon={<Trash2 className="text-red-700 dark:text-red-400" />}
          title="Delete chat"
          destructive
          onClick={onDeleteChat}
        />
      </div>
    </div>
  )
}
