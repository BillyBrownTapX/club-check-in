import * as React from 'react'
import { Text } from '@react-email/components'
import { ActionButton, EmailShell, bodyText, noteText } from './brand'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ siteName, confirmationUrl }: MagicLinkEmailProps) => (
  <EmailShell
    preview={`Your ${siteName} sign-in link`}
    heading="Your sign-in link"
    siteName={siteName}
  >
    <Text style={bodyText}>
      Tap the button below to sign in to {siteName} — no password needed. It works best on the phone
      you use to run check-in.
    </Text>
    <ActionButton href={confirmationUrl} label="Sign in to Attendance HQ" />
    <Text style={noteText}>
      This link can be used once and expires shortly. If you didn&apos;t ask to sign in, you can
      ignore this email.
    </Text>
  </EmailShell>
)

export default MagicLinkEmail
