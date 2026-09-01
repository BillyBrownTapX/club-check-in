import * as React from 'react'
import { Text } from '@react-email/components'
import { ActionButton, EmailShell, bodyText, noteText } from './brand'

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  email,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => {
  const previous = oldEmail || email
  return (
    <EmailShell
      preview={`Confirm the new email for your ${siteName} account`}
      heading="Confirm your new email"
      siteName={siteName}
    >
      <Text style={bodyText}>
        You asked to change the email on your {siteName} host account
        {previous ? (
          <>
            {' '}
            from <strong>{previous}</strong>
          </>
        ) : null}
        {newEmail ? (
          <>
            {' '}
            to <strong>{newEmail}</strong>
          </>
        ) : null}
        . Confirm the change to keep signing in and receiving event notifications.
      </Text>
      <ActionButton href={confirmationUrl} label="Confirm new email" />
      <Text style={noteText}>
        If you didn&apos;t request this change, ignore this email and your current address stays in
        place.
      </Text>
    </EmailShell>
  )
}

export default EmailChangeEmail
