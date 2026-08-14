import { useEffect, useState } from 'react'
import { Eye, EyeOff, Lock, MessageCircle, Smile } from 'lucide-react'

export type ChatLockPanelMode = 'set' | 'open' | 'remove'

type TeamChatLockPanelProps = {
  mode: ChatLockPanelMode
  contactLabel: string
  loading?: boolean
  errorMessage?: string | null
  onCancel: () => void
  onSubmit: (password: string) => void
}

function LockIllustration() {
  return (
    <div className="relative mx-auto flex h-[140px] w-[200px] items-center justify-center" aria-hidden>
      <div className="absolute left-6 top-6 h-10 w-14 rounded-full bg-[#d9fdd3]/70 dark:bg-[#005c4b]/40" />
      <div className="absolute bottom-8 right-4 h-8 w-11 rounded-full bg-[#d9fdd3]/50 dark:bg-[#005c4b]/30" />
      <div className="absolute right-10 top-10 h-6 w-9 rounded-full bg-[#d9fdd3]/40" />
      <div className="relative flex h-[88px] w-[88px] items-center justify-center rounded-full bg-[#d9fdd3] shadow-sm dark:bg-[#005c4b]/60">
        <MessageCircle className="absolute h-10 w-10 text-[#8696a0]/25" strokeWidth={1.25} />
        <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-[#008069] text-white shadow-md">
          <Lock className="h-6 w-6" strokeWidth={2.25} aria-hidden />
        </div>
      </div>
    </div>
  )
}

function SecretCodeField({
  id,
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  autoFocus?: boolean
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative border-b-2 border-[#008069] pb-1.5 dark:border-[#25d366]">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        autoComplete="off"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent pr-[4.5rem] text-[15px] text-[#111b21] outline-none placeholder:text-[#8696a0] dark:text-[#e9edef]"
      />
      <div className="absolute right-0 top-1/2 flex -translate-y-1/2 items-center gap-2.5">
        <button
          type="button"
          className="text-[#54656f] hover:text-[#111b21] dark:text-[#aebac1] dark:hover:text-[#e9edef]"
          aria-label={visible ? 'Hide secret code' : 'Show secret code'}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
        </button>
        <Smile className="h-5 w-5 text-[#8696a0]/70" aria-hidden />
      </div>
    </div>
  )
}

export function TeamChatLockPanel({
  mode,
  contactLabel,
  loading = false,
  errorMessage,
  onCancel,
  onSubmit,
}: TeamChatLockPanelProps) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    setPassword('')
    setConfirmPassword('')
  }, [mode, contactLabel])

  const isSet = mode === 'set'
  const isRemove = mode === 'remove'
  const tooShort = password.length > 0 && password.length < 4
  const localMismatch = isSet && confirmPassword.length > 0 && password !== confirmPassword
  const canSubmit =
    !loading &&
    password.length >= 4 &&
    (!isSet || (confirmPassword.length >= 4 && password === confirmPassword))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    onSubmit(password)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain bg-background [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="flex flex-1 flex-col px-5 pb-4 pt-6">
        <LockIllustration />
        <h3 className="mt-4 text-center text-[17px] font-semibold text-[#111b21] dark:text-[#e9edef]">
          {isSet
            ? 'Create your secret code'
            : isRemove
              ? 'Remove chat lock'
              : 'Enter your secret code'}
        </h3>
        <p className="mx-auto mt-2 max-w-[300px] text-center text-[12px] leading-relaxed text-[#667781] dark:text-[#8696a0]">
          {isSet ? (
            <>
              Protect messages with{' '}
              <span className="font-medium text-[#111b21] dark:text-[#e9edef]">{contactLabel}</span>.
              Stored securely in your account and synced across all your devices.
            </>
          ) : isRemove ? (
            <>
              Enter your secret code to turn off the lock on the chat with{' '}
              <span className="font-medium text-[#111b21] dark:text-[#e9edef]">{contactLabel}</span>.
            </>
          ) : (
            <>
              Enter your secret code to open the chat with{' '}
              <span className="font-medium text-[#111b21] dark:text-[#e9edef]">{contactLabel}</span>.
            </>
          )}
        </p>

        <div className="mx-auto mt-8 w-full max-w-[320px] space-y-6">
          <SecretCodeField
            id="chat-lock-secret-code"
            value={password}
            onChange={setPassword}
            placeholder="Secret code"
            autoFocus
          />
          {isSet ? (
            <SecretCodeField
              id="chat-lock-secret-code-confirm"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="Confirm secret code"
            />
          ) : null}
          {tooShort ? (
            <p className="text-[11px] text-amber-700 dark:text-amber-400">Minimum 4 characters.</p>
          ) : null}
          {localMismatch ? (
            <p className="text-[11px] text-red-600 dark:text-red-400">Codes don't match.</p>
          ) : null}
          {errorMessage ? (
            <p className="text-[12px] font-medium text-red-600 dark:text-red-400" role="alert">
              {errorMessage}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-border/60 px-5 py-4">
        <button
          type="button"
          className="text-[15px] font-semibold text-[#008069] hover:underline dark:text-[#25d366]"
          disabled={loading}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-full bg-[#008069] px-8 py-2.5 text-[15px] font-medium text-white shadow-sm transition-opacity hover:bg-[#006e5a] disabled:cursor-not-allowed disabled:opacity-45 dark:bg-[#008069]"
        >
          {loading ? 'Processing…' : 'Continue'}
        </button>
      </div>
    </form>
  )
}
