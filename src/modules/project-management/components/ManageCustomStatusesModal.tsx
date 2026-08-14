import { ManageActionControlListModal } from '@/modules/project-management/components/ManageActionControlListModal'

export type ManageCustomStatusesModalProps = {
  open: boolean
  onClose: () => void
  customStatuses: string[]
  reservedStatuses?: string[]
  onCreateStatus: (label: string) => void
  onUpdateStatus: (previousLabel: string, nextLabel: string) => void
  onDeleteStatus: (label: string) => void
}

export function ManageCustomStatusesModal(props: ManageCustomStatusesModalProps) {
  return (
    <ManageActionControlListModal
      open={props.open}
      onClose={props.onClose}
      title="Manage Custom Statuses"
      description="Add, rename, or delete custom status options for Action & Control."
      placeholder="New status (e.g., Pending Legal, Awaiting Sponsor)..."
      emptyMessage="No custom statuses yet. Add one above to extend the default status list."
      footerNote="Note: custom statuses are stored locally for this idea. Default statuses (New Submission, Under Review, etc.) remain available in the dropdown and cannot be edited here."
      items={props.customStatuses}
      reservedItems={props.reservedStatuses}
      onCreateItem={props.onCreateStatus}
      onUpdateItem={props.onUpdateStatus}
      onDeleteItem={props.onDeleteStatus}
    />
  )
}
