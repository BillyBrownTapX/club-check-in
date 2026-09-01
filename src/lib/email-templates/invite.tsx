import * as React from 'react'
import { Text } from '@react-email/components'
import { ActionButton, EmailShell, bodyText, noteText } from './brand'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ siteName, siteUrl, confirmationUrl }: InviteEmailProps) => (
  <EmailShell
    preview={`You've been invited to help run check-in on ${siteName}`}
    heading="You've been invited"
    siteName={siteName}
    siteUrl={siteUrl}
  >
    <Text style={bodyText}>
      Someone on your team invited you to {siteName} as a host. Accept the invitation to see your
      organization&apos;s events, run live check-in, and pull attendance reports.
    </Text>
    <ActionButton href={confirmationUrl} label="Accept invitation" />
    <Text style={noteText}>
      If you weren&apos;t expecting this invitation, you can safely ignore this email.
    </Text>
  </EmailShell>
)

export default InviteEmail
