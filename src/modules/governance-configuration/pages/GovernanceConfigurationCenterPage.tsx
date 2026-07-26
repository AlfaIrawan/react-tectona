import { Navigate } from 'react-router-dom'

/** @deprecated Bookmarks — use Enterprise Governance Model (`/enterprise-governance-model`). */
export function GovernanceConfigurationCenterPage() {
  return <Navigate to="/enterprise-governance-model/overview" replace />
}
