import type { ChangeEvent, RefObject } from 'react'
import {
  BarChart2,
  CalendarDays,
  FileText,
  Headphones,
  Images,
  Mic,
  Plus,
  Send,
  Smile,
  User,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export type PendingAttachment = {
  id: string
  kind: string
  name: string
  url: string
}

type PeopleChatComposerProps = {
  draft: string
  setDraft: (value: string) => void
  pendingAttachments: PendingAttachment[]
  removePendingAttachment: (id: string) => void
  onPreviewImage: (attachment: PendingAttachment) => void
  isRecordingVoice: boolean
  onSend: () => void
  onToggleVoiceRecording: () => void
  appendEmojiToDraft: (emoji: string) => void
  imageInputRef: RefObject<HTMLInputElement | null>
  docInputRef: RefObject<HTMLInputElement | null>
  mediaPickRef: RefObject<HTMLInputElement | null>
  audioFileInputRef: RefObject<HTMLInputElement | null>
  onPickImages: (e: ChangeEvent<HTMLInputElement>) => void
  onPickDocuments: (e: ChangeEvent<HTMLInputElement>) => void
  onPickPhotosAndVideos: (e: ChangeEvent<HTMLInputElement>) => void
  onPickAudioFiles: (e: ChangeEvent<HTMLInputElement>) => void
  onOpenContactAttach: () => void
  onOpenPollAttach: () => void
  onOpenEventAttach: () => void
}

export function PeopleChatComposer({
  draft,
  setDraft,
  pendingAttachments,
  removePendingAttachment,
  onPreviewImage,
  isRecordingVoice,
  onSend,
  onToggleVoiceRecording,
  appendEmojiToDraft,
  imageInputRef,
  docInputRef,
  mediaPickRef,
  audioFileInputRef,
  onPickImages,
  onPickDocuments,
  onPickPhotosAndVideos,
  onPickAudioFiles,
  onOpenContactAttach,
  onOpenPollAttach,
  onOpenEventAttach,
}: PeopleChatComposerProps) {
  const canSend = !!draft.trim() || pendingAttachments.length > 0

  return (
    <div className="shrink-0 border-t border-[#d1d7db] bg-[#f0f2f5] px-2 py-2 dark:border-white/10 dark:bg-[#202c33]">
      <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={onPickImages} aria-hidden />
      <input
        ref={docInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt,.md,.csv,.xlsx,.xls,.pptx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
        multiple
        className="hidden"
        onChange={onPickDocuments}
        aria-hidden
      />
      <input ref={mediaPickRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={onPickPhotosAndVideos} aria-hidden />
      <input ref={audioFileInputRef} type="file" accept="audio/*" multiple className="hidden" onChange={onPickAudioFiles} aria-hidden />

      {pendingAttachments.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-2 px-0.5">
          {pendingAttachments.map((a) =>
            a.kind === 'image' ? (
              <div key={a.id} className="relative inline-flex">
                <button
                  type="button"
                  onClick={() => onPreviewImage(a)}
                  className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-[#d1d7db] bg-white"
                  aria-label={`Preview ${a.name}`}
                >
                  <img src={a.url} alt="" className="h-full w-full object-cover" />
                </button>
                <button
                  type="button"
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[#54656f] shadow"
                  onClick={() => removePendingAttachment(a.id)}
                  aria-label={`Remove ${a.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <span
                key={a.id}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#d1d7db] bg-white py-1 pl-2 pr-1 text-[11px] text-[#111b21]"
              >
                <span className="truncate">{a.name}</span>
                <button
                  type="button"
                  className="rounded-full p-0.5 text-[#54656f] hover:bg-[#f0f2f5]"
                  onClick={() => removePendingAttachment(a.id)}
                  aria-label={`Remove ${a.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ),
          )}
        </div>
      ) : null}

      <div className="flex items-center gap-1">
        <div className="inline-flex shrink-0 items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-full text-[#54656f] hover:bg-black/[0.06] dark:text-[#aebac1] dark:hover:bg-white/10"
                aria-label="Attach"
              >
                <Plus className="h-5 w-5 stroke-[2.5]" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-64 py-2">
              <DropdownMenuItem className="gap-3 px-2.5 py-2.5" onClick={() => docInputRef.current?.click()}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500 text-white">
                  <FileText className="h-4 w-4" aria-hidden />
                </span>
                <span className="font-medium">Document</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-3 px-2.5 py-2.5" onClick={() => mediaPickRef.current?.click()}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500 text-white">
                  <Images className="h-4 w-4" aria-hidden />
                </span>
                <span className="font-medium">Photos &amp; videos</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-3 px-2.5 py-2.5" onClick={() => audioFileInputRef.current?.click()}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-500 text-white">
                  <Headphones className="h-4 w-4" aria-hidden />
                </span>
                <span className="font-medium">Audio</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-3 px-2.5 py-2.5" onClick={onOpenContactAttach}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500 text-white">
                  <User className="h-4 w-4" aria-hidden />
                </span>
                <span className="font-medium">Contact</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-3 px-2.5 py-2.5" onClick={onOpenPollAttach}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white">
                  <BarChart2 className="h-4 w-4" aria-hidden />
                </span>
                <span className="font-medium">Poll</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-3 px-2.5 py-2.5" onClick={onOpenEventAttach}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-500 text-white">
                  <CalendarDays className="h-4 w-4" aria-hidden />
                </span>
                <span className="font-medium">Event</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-full text-[#54656f] hover:bg-black/[0.06] dark:text-[#aebac1] dark:hover:bg-white/10"
                aria-label="Emoji"
              >
                <Smile className="h-5 w-5" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-auto min-w-[9.5rem] p-2">
              <div className="flex max-w-[9.5rem] flex-wrap gap-1">
                {['😊', '👍', '❤️', '🎉', '🙏', '😂', '🔥', '✨'].map((em) => (
                  <DropdownMenuItem
                    key={em}
                    className="h-9 w-9 shrink-0 justify-center p-0 text-lg"
                    onClick={() => appendEmojiToDraft(em)}
                  >
                    <span aria-hidden>{em}</span>
                  </DropdownMenuItem>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex min-h-[42px] min-w-0 flex-1 items-center rounded-full border border-[#e9edef] bg-white shadow-sm dark:border-white/10 dark:bg-[#2a3942]">
          <Textarea
            placeholder="Type a message"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={1}
            className={cn(
              'max-h-24 min-h-[38px] flex-1 resize-none border-0 bg-transparent py-2 pl-4 pr-1 text-sm leading-snug shadow-none',
              'placeholder:text-[#8696a0] focus-visible:ring-0 focus-visible:ring-offset-0',
            )}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                onSend()
              }
            }}
          />
          <Button
            type="button"
            variant={canSend ? 'default' : isRecordingVoice ? 'destructive' : 'ghost'}
            size="icon"
            className={cn(
              'mr-1.5 h-9 w-9 shrink-0 rounded-full',
              canSend && 'bg-[#00a884] text-white hover:bg-[#008f72] dark:bg-[#00a884]',
              !canSend && 'text-[#54656f] hover:bg-[#f0f2f5] dark:text-[#aebac1]',
            )}
            onClick={() => {
              if (!canSend) {
                void onToggleVoiceRecording()
                return
              }
              onSend()
            }}
            aria-label={canSend ? 'Send message' : isRecordingVoice ? 'Stop recording' : 'Record voice'}
          >
            {canSend ? <Send className="h-[17px] w-[17px]" aria-hidden /> : <Mic className="h-5 w-5" aria-hidden />}
          </Button>
        </div>
      </div>
    </div>
  )
}
