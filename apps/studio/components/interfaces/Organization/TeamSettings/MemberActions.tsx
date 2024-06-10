import { PermissionAction } from '@supabase/shared-types/out/constants'
import { MoreVertical, Trash } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

import { useParams } from 'common'
import { useOrganizationRolesV2Query } from 'data/organization-members/organization-roles-query'
import { useOrganizationMemberDeleteMutation } from 'data/organizations/organization-member-delete-mutation'
import { useOrganizationMemberInviteCreateMutation } from 'data/organizations/organization-member-invite-create-mutation'
import { useOrganizationMemberInviteDeleteMutation } from 'data/organizations/organization-member-invite-delete-mutation'
import type { OrganizationMember } from 'data/organizations/organization-members-query'
import { usePermissionsQuery } from 'data/permissions/permissions-query'
import { useCheckPermissions, useIsFeatureEnabled, useSelectedOrganization } from 'hooks'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  TooltipContent_Shadcn_,
  TooltipTrigger_Shadcn_,
  Tooltip_Shadcn_,
} from 'ui'
import ConfirmationModal from 'ui-patterns/Dialogs/ConfirmationModal'
import { useGetRolesManagementPermissions } from './TeamSettings.utils'
import { UpdateRolesPanel } from './UpdateRolesPanel/UpdateRolesPanel'

interface MemberActionsProps {
  member: OrganizationMember
}

export const MemberActions = ({ member }: MemberActionsProps) => {
  const { slug } = useParams()
  const [showAccessModal, setShowAccessModal] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const organizationMembersDeletionEnabled = useIsFeatureEnabled('organization_members:delete')

  const selectedOrganization = useSelectedOrganization()
  const { data: permissions } = usePermissionsQuery()
  const { data: allRoles } = useOrganizationRolesV2Query({ slug })

  const orgScopedRoles = allRoles?.org_scoped_roles ?? []
  const projectScopedRoles = allRoles?.project_scoped_roles ?? []
  const isPendingInviteAcceptance = !!member.invited_id

  const { rolesRemovable } = useGetRolesManagementPermissions(
    selectedOrganization?.id,
    orgScopedRoles.concat(projectScopedRoles),
    permissions ?? []
  )

  const roleId = member.role_ids?.[0] ?? -1
  const canRemoveMember = member.role_ids.every((id) => rolesRemovable.includes(id))
  const canResendInvite = useCheckPermissions(PermissionAction.CREATE, 'user_invites', {
    resource: { role_id: roleId },
  })
  const canRevokeInvite = useCheckPermissions(PermissionAction.DELETE, 'user_invites', {
    resource: { role_id: roleId },
  })

  const { mutate: deleteOrganizationMember, isLoading: isDeletingMember } =
    useOrganizationMemberDeleteMutation({
      onSuccess: () => {
        toast.success(`Successfully removed ${member.primary_email}`)
        setIsDeleteModalOpen(false)
      },
    })

  const { mutate: createOrganizationMemberInvite, isLoading: isCreatingInvite } =
    useOrganizationMemberInviteCreateMutation({
      onSuccess: () => {
        toast.success('Resent the invitation.')
      },
      onError: (error) => {
        toast.error(`Failed to resend invitation: ${error.message}`)
      },
    })

  const { mutate: asyncDeleteMemberInvite, isLoading: isDeletingInvite } =
    useOrganizationMemberInviteDeleteMutation()

  const isLoading = isDeletingMember || isDeletingInvite || isCreatingInvite

  const handleMemberDelete = async () => {
    if (!slug) return console.error('slug is required')
    if (!member.gotrue_id) return console.error('gotrue_id is required')
    deleteOrganizationMember({ slug, gotrueId: member.gotrue_id })
  }

  const handleResendInvite = async (member: OrganizationMember) => {
    const roleId = (member?.role_ids ?? [])[0]
    const invitedId = member.invited_id

    if (!slug) return console.error('Slug is required')
    if (!invitedId) return console.error('Member invited ID is required')

    asyncDeleteMemberInvite(
      { slug, invitedId, invalidateDetail: false },
      {
        onSuccess: () => {
          createOrganizationMemberInvite({
            slug,
            invitedEmail: member.primary_email!,
            ownerId: invitedId,
            roleId: roleId,
          })
        },
      }
    )
  }

  const handleRevokeInvitation = async (member: OrganizationMember) => {
    const invitedId = member.invited_id
    if (!slug) return console.error('Slug is required')
    if (!invitedId) return console.error('Member invited ID is required')

    asyncDeleteMemberInvite(
      { slug, invitedId },
      {
        onSuccess: () => {
          toast.success('Successfully revoked the invitation.')
        },
      }
    )
  }

  if (!canRemoveMember || (isPendingInviteAcceptance && !canResendInvite && !canRevokeInvite)) {
    return (
      <div className="flex items-center justify-end">
        <Tooltip_Shadcn_>
          <TooltipTrigger_Shadcn_ asChild>
            <Button type="text" icon={<MoreVertical size={18} />} />
          </TooltipTrigger_Shadcn_>
          <TooltipContent_Shadcn_ side="bottom">
            You need additional permissions to manage this team member
          </TooltipContent_Shadcn_>
        </Tooltip_Shadcn_>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-end gap-x-2">
        <Tooltip_Shadcn_>
          <TooltipTrigger_Shadcn_ asChild>
            <Button
              type="default"
              disabled={isPendingInviteAcceptance || !canRemoveMember}
              onClick={() => setShowAccessModal(true)}
            >
              Manage access
            </Button>
          </TooltipTrigger_Shadcn_>
          {!canRemoveMember && (
            <TooltipContent_Shadcn_ side="bottom">
              You need additional permissions to manage this team member
            </TooltipContent_Shadcn_>
          )}
          {isPendingInviteAcceptance && (
            <TooltipContent_Shadcn_ side="bottom">
              Role can only be changed after the user has accepted the invite
            </TooltipContent_Shadcn_>
          )}
        </Tooltip_Shadcn_>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="text"
              className="px-1.5"
              disabled={isLoading}
              loading={isLoading}
              icon={<MoreVertical />}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="end">
            <>
              {isPendingInviteAcceptance ? (
                <>
                  {canRevokeInvite && (
                    <DropdownMenuItem onClick={() => handleRevokeInvitation(member)}>
                      <div className="flex flex-col">
                        <p>Cancel invitation</p>
                        <p className="text-foreground-lighter">Revoke this invitation.</p>
                      </div>
                    </DropdownMenuItem>
                  )}
                  {canResendInvite && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleResendInvite(member)}>
                        <div className="flex flex-col">
                          <p>Resend invitation</p>
                          <p className="text-foreground-lighter">Invites expire after 24hrs.</p>
                        </div>
                      </DropdownMenuItem>
                    </>
                  )}
                </>
              ) : (
                organizationMembersDeletionEnabled && (
                  <DropdownMenuItem
                    className="space-x-2 items-start"
                    disabled={!canRemoveMember}
                    onClick={() => {
                      setIsDeleteModalOpen(true)
                    }}
                  >
                    <Trash size={16} />
                    <div className="flex flex-col">
                      <p>Remove member</p>
                      {!canRemoveMember && (
                        <p className="text-foreground-lighter">Additional permissions required</p>
                      )}
                    </div>
                  </DropdownMenuItem>
                )
              )}
            </>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ConfirmationModal
        visible={isDeleteModalOpen}
        title="Confirm to remove"
        confirmLabel="Remove"
        onCancel={() => setIsDeleteModalOpen(false)}
        onConfirm={() => {
          handleMemberDelete()
        }}
      >
        <p className="text-sm text-foreground-light">
          This is permanent! Are you sure you want to remove {member.primary_email}
        </p>
      </ConfirmationModal>

      <UpdateRolesPanel
        visible={showAccessModal}
        member={member}
        onClose={() => setShowAccessModal(false)}
      />
    </>
  )
}
