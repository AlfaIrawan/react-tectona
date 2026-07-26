import { Timer } from 'lucide-react'

import {
  disappearingNoticeDurationPhrase,
  type DisappearingNoticeKind,
} from '@/lib/chat/chatDisappearingNoticesStorage'
import type { DisappearingMessagesDuration } from '@/lib/chat/chatDisappearingMessagesStorage'

type DisappearingMessagesThreadNoticeProps = {
  kind: DisappearingNoticeKind
  duration: DisappearingMessagesDuration
  onClickChange?: () => void
}

function noticeBody(kind: DisappearingNoticeKind, duration: DisappearingMessagesDuration): string {
  if (kind === 'disabled') {
    return 'You turned off disappearing messages.'
  }
  const phrase = disappearingNoticeDurationPhrase(duration)
  const lead =
    kind === 'enabled'
      ? 'You turned on disappearing messages.'
      : 'You changed the message timer.'
  return `${lead} New messages will disappear from this chat ${phrase} after they're sent, except when kept.`
}

export function DisappearingMessagesThreadNotice({
  kind,
  duration,
  onClickChange,
}: DisappearingMessagesThreadNoticeProps) {
  return (
    <div className="mx-auto flex w-full max-w-[min(100%,340px)] justify-center rounded-lg border border-[#e9edef] bg-white px-4 py-2.5 shadow-sm dark:border-[#233138] dark:bg-[#202c33]">
      <div className="flex max-w-full items-start gap-2.5">
        <span
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-dashed border-[#8696a0] bg-white dark:bg-[#202c33]"
          aria-hidden
        >
          <Timer className="h-3 w-3 text-[#54656f] dark:text-[#aebac1]" strokeWidth={2.25} />
        </span>
        <p className="max-w-[260px] text-center text-[12.5px] leading-[1.45] text-[#667781] dark:text-[#8696a0]">
        {noticeBody(kind, duration)}
        {kind !== 'disabled' && onClickChange ? (
          <>
            {' '}
            <button
              type="button"
              className="inline text-[#008069] hover:underline dark:text-[#25d366]"
              onClick={onClickChange}
            >
              Click to change.
            </button>
          </>
        ) : null}
        </p>
      </div>
    </div>
  )
}
