/** Unknown access is not evidence that the user needs a new workspace. */
export function OnboardingUnavailable({ onRetry, retrying = false }: {
  onRetry: () => void
  retrying?: boolean
}) {
  return (
    <section role="alert" className="mx-auto max-w-lg space-y-4 p-8">
      <h1 className="text-lg font-semibold">Workspace access temporarily unavailable</h1>
      <p>We could not verify your existing workspace access. No workspace setup is required while this check is unavailable. Your saved work has not been changed.</p>
      <button type="button" className="rounded border px-4 py-2" disabled={retrying} onClick={onRetry}>
        {retrying ? 'Checking access...' : 'Retry access check'}
      </button>
    </section>
  )
}
