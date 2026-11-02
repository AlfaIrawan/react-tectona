export function ideaDocsFolderErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  if (/workspace access control unavailable|check-access failed|service token is not configured/i.test(message)) {
    return 'Folder access could not be verified. The Project service cannot complete its workspace permission check. Existing documents remain available; folder actions require the service configuration to be restored.'
  }
  if (/workspace access forbidden|403/i.test(message)) {
    return 'You do not have permission to access this idea folder. Existing documents are shown only where document access is allowed.'
  }
  return 'The idea folder could not be loaded. Existing documents remain available. Try again or contact the administrator.'
}
