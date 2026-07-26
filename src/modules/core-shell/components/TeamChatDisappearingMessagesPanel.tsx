import { MessageCircle, Timer } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  formatDisappearingDurationLabel,
  type DisappearingMessagesDuration,
} from '@/lib/chat/chatDisappearingMessagesStorage'

const DURATION_OPTIONS: { value: DisappearingMessagesDuration; label: string }[] = [
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: '90d', label: '90 days' },
  { value: 'off', label: 'Off' },
]

type TeamChatDisappearingMessagesPanelProps = {
  channelId?: string
  value: DisappearingMessagesDuration
  onChange: (duration: DisappearingMessagesDuration) => void
  onLearnMore?: () => void
  onDefaultTimerSettings?: () => void
}

function DisappearingIllustration() {
  return (
    <div className="relative mx-auto flex h-[140px] w-[200px] items-center justify-center" aria-hidden>
      <div className="absolute left-6 top-6 h-10 w-14 rounded-full bg-[#d9fdd3]/70 dark:bg-[#005c4b]/40" />
      <div className="absolute bottom-8 right-4 h-8 w-11 rounded-full bg-[#d9fdd3]/50 dark:bg-[#005c4b]/30" />
      <div className="absolute right-10 top-10 h-6 w-9 rounded-full bg-[#d9fdd3]/40" />
      <div className="relative flex h-[88px] w-[88px] items-center justify-center rounded-full bg-[#d9fdd3] shadow-sm dark:bg-[#005c4b]/60">
        <MessageCircle className="absolute h-10 w-10 text-[#8696a0]/25" strokeWidth={1.25} />
        <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-[#008069] text-white shadow-md">
          <Timer className="h-7 w-7" strokeWidth={2} aria-hidden />
        </div>
      </div>
    </div>
  )
}

function DurationRadio({
  label,
  checked,
  onSelect,
}: {
  label: string
  checked: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className="flex w-full items-center gap-4 px-4 py-3.5 text-left hover:bg-muted/40 active:bg-muted/60"
    >
      <span
        className={cn(
          'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2',
          checked ? 'border-[#008069]' : 'border-[#8696a0]',
        )}
      >
        {checked ? <span className="h-2.5 w-2.5 rounded-full bg-[#008069]" /> : null}
      </span>
      <span className="text-[14px] text-foreground">{label}</span>
    </button>
  )
}

export function TeamChatDisappearingMessagesPanel({
  channelId,
  value,
  onChange,
  onLearnMore,
  onDefaultTimerSettings,
}: TeamChatDisappearingMessagesPanelProps) {
  const handleSelect = (duration: DisappearingMessagesDuration) => {
    if (!channelId) return
    onChange(duration)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain bg-background [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <div className="px-4 pb-2 pt-4">
        <DisappearingIllustration />
        <h3 className="mt-2 text-center text-[15px] font-semibold text-[#111b21] dark:text-[#e9edef]">
          Make messages in this chat disappear
        </h3>
        <p className="mx-auto mt-2 max-w-[320px] text-center text-[12px] leading-relaxed text-[#667781] dark:text-[#8696a0]">
          For more privacy and storage, all new messages will disappear from this chat for everyone
          after the selected duration, except when kept. Anyone in the chat can change this setting.{' '}
          <button
            type="button"
            className="text-[#008069] hover:underline dark:text-[#25d366]"
            onClick={onLearnMore}
          >
            Learn more
          </button>
        </p>
        {!channelId ? (
          <p className="mt-3 text-center text-[11px] text-amber-700 dark:text-amber-400">
            Open a conversation with an active channel to set a timer.
          </p>
        ) : null}
      </div>

      <div className="mt-2 border-t border-border/60" role="radiogroup" aria-label="Message timer">
        {DURATION_OPTIONS.map((opt) => (
          <DurationRadio
            key={opt.value}
            label={opt.label}
            checked={value === opt.value}
            onSelect={() => handleSelect(opt.value)}
          />
        ))}
      </div>

      <p className="px-4 py-6 text-center text-[12px] leading-relaxed text-[#667781] dark:text-[#8696a0]">
        Update your{' '}
        <button
          type="button"
          className="text-[#008069] hover:underline dark:text-[#25d366]"
          onClick={onDefaultTimerSettings}
        >
          default message timer
        </button>{' '}
        in Settings
      </p>

      {channelId && value !== 'off' ? (
        <p className="pb-4 text-center text-[11px] text-muted-foreground">
          Current: {formatDisappearingDurationLabel(value)} — applies to new messages for everyone in
          this chat
        </p>
      ) : null}
    </div>
  )
}
