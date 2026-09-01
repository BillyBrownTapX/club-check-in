import * as React from 'react'
import { Text } from '@react-email/components'
import { ActionButton, EmailShell, bodyText, noteText } from './brand'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <EmailShell
    preview={`Confirm your ${siteName} account and get your first event live`}
    heading="Confirm your host account"
    siteName={siteName}
    siteUrl={siteUrl}
  >
    <Text style={bodyText}>
      Welcome to {siteName}. Confirm <strong>{recipient}</strong> and you can create your
      organization, schedule your first event, and start checking students in with a QR code.
    </Text>
    <ActionButton href={confirmationUrl} label="Confirm my account" />
    <Text style={noteText}>
      This link expires in 24 hours. If you didn&apos;t create an account, you can safely ignore
      this email.
    </Text>
  </EmailShell>
)

export default SignupEmail
