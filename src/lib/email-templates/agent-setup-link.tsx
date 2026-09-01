import * as React from 'react'
import { Text } from '@react-email/components'
import { ActionButton, EmailShell, bodyText, noteText } from './brand'

interface AgentSetupLinkEmailProps {
  hostName?: string
  setupUrl?: string
}

const DEFAULT_SETUP_URL = 'https://checkin-swiftly.lovable.app/agents'

export const AgentSetupLinkEmail = ({
  hostName,
  setupUrl = DEFAULT_SETUP_URL,
}: AgentSetupLinkEmailProps) => (
  <EmailShell
    preview="Connect ChatGPT, Claude, or Cursor to your Attendance HQ account"
    heading="Connect your AI assistant"
  >
    <Text style={bodyText}>
      {hostName ? `Hi ${hostName} — ` : ''}here&apos;s your setup link. Open it on the device where
      you use ChatGPT, Claude, Cursor, or Lovable, and follow the short steps to connect Attendance
      HQ.
    </Text>
    <Text style={bodyText}>
      Once connected, you can ask your assistant to list your organizations and events, pull a live
      head count or attendance roster, and schedule a new event — all as you, with the same access
      you already have.
    </Text>
    <ActionButton href={setupUrl} label="Open agent setup" />
    <Text style={noteText}>
      Your assistant sends you to an Attendance HQ approval screen the first time it connects, so
      nothing is shared until you approve it. You can revoke access at any time.
    </Text>
  </EmailShell>
)

export const template = {
  component: AgentSetupLinkEmail,
  subject: 'Connect your AI assistant to Attendance HQ',
  displayName: 'Agent setup link',
  previewData: { hostName: 'Jordan', setupUrl: DEFAULT_SETUP_URL },
} satisfies import('./registry').TemplateEntry

export default AgentSetupLinkEmail
