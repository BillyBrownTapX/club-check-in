import * as React from 'react'
import { Text } from '@react-email/components'
import { ActionButton, EmailShell, bodyText, noteText } from './brand'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ siteName, confirmationUrl }: RecoveryEmailProps) => (
  <EmailShell
    preview={`Reset your ${siteName} password`}
    heading="Reset your password"
    siteName={siteName}
  >
    <Text style={bodyText}>
      We got a request to reset the password for your {siteName} host account. Choose a new one and
      you&apos;ll be back to your events in a moment.
    </Text>
    <ActionButton href={confirmationUrl} label="Choose a new password" />
    <Text style={noteText}>
      <strong>Didn&apos;t request this?</strong> Ignore this email — your password stays exactly as
      it is, and nobody can change it without this link.
    </Text>
  </EmailShell>
)

export default RecoveryEmail
