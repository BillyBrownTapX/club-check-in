import * as React from 'react'
import { Text } from '@react-email/components'
import { EmailShell, bodyText, codeStyle, noteText } from './brand'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <EmailShell preview="Your Attendance HQ verification code" heading="Your verification code">
    <Text style={bodyText}>
      Enter this code in Attendance HQ to confirm it&apos;s really you.
    </Text>
    <Text style={codeStyle}>{token}</Text>
    <Text style={noteText}>
      The code expires shortly. If you didn&apos;t request it, ignore this email — no changes were
      made to your account.
    </Text>
  </EmailShell>
)

export default ReauthenticationEmail
