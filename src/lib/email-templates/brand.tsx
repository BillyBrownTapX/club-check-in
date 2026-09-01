import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

// Attendance HQ brand values, converted from the app's design tokens to hex
// so every email client renders them (oklch() is not supported in email).
export const brand = {
  navy: '#0B1F44',
  blue: '#1F5BD8',
  blueLight: '#3F82F5',
  gold: '#E0A32A',
  ink: '#1B2540',
  body: '#4E5872',
  muted: '#8A93AB',
  card: '#F4F6FB',
  border: '#E2E7F1',
  white: '#ffffff',
}

const fontStack =
  '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, Helvetica, sans-serif'

const main = { backgroundColor: brand.white, fontFamily: fontStack, margin: '0', padding: '0' }
const outer = { padding: '24px 12px 40px', maxWidth: '600px' }
const header = {
  backgroundColor: brand.navy,
  borderRadius: '20px 20px 0 0',
  padding: '26px 28px 24px',
}
const wordmark = {
  color: brand.white,
  fontFamily: fontStack,
  fontSize: '20px',
  fontWeight: 800 as const,
  letterSpacing: '-0.01em',
  margin: '0',
}
const tagline = {
  color: '#B9C7E6',
  fontSize: '12px',
  fontWeight: 600 as const,
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
  margin: '6px 0 0',
}
const goldRule = { backgroundColor: brand.gold, fontSize: '1px', lineHeight: '3px', height: '3px' }
const card = {
  backgroundColor: brand.card,
  border: `1px solid ${brand.border}`,
  borderTop: 'none',
  borderRadius: '0 0 20px 20px',
  padding: '30px 28px 32px',
}
const h1 = {
  color: brand.ink,
  fontFamily: fontStack,
  fontSize: '24px',
  fontWeight: 800 as const,
  lineHeight: '1.25',
  margin: '0 0 14px',
}
const paragraph = {
  color: brand.body,
  fontSize: '15px',
  lineHeight: '1.6',
  margin: '0 0 18px',
}
const button = {
  backgroundColor: brand.blue,
  borderRadius: '14px',
  color: brand.white,
  display: 'inline-block',
  fontSize: '15px',
  fontWeight: 700 as const,
  padding: '14px 26px',
  textDecoration: 'none',
}
const fallbackLabel = {
  color: brand.muted,
  fontSize: '12px',
  lineHeight: '1.5',
  margin: '22px 0 4px',
}
const fallbackLink = {
  color: brand.blue,
  fontSize: '12px',
  lineHeight: '1.6',
  wordBreak: 'break-all' as const,
}
const note = {
  color: brand.muted,
  fontSize: '13px',
  lineHeight: '1.6',
  margin: '18px 0 0',
}
const footer = {
  color: brand.muted,
  fontSize: '12px',
  lineHeight: '1.6',
  margin: '22px 0 0',
  textAlign: 'center' as const,
  padding: '0 12px',
}
const footerLink = { color: brand.blue, textDecoration: 'none' }
const codeBox = {
  backgroundColor: brand.white,
  border: `1px solid ${brand.border}`,
  borderRadius: '14px',
  color: brand.navy,
  fontFamily: '"SFMono-Regular", Menlo, Consolas, monospace',
  fontSize: '30px',
  fontWeight: 700 as const,
  letterSpacing: '0.18em',
  margin: '0 0 18px',
  padding: '18px 20px',
  textAlign: 'center' as const,
}

export const bodyText = paragraph
export const noteText = note
export const codeStyle = codeBox

// Rendered as a text child, which React may HTML-escape: keep this CSS free of >, &, and quotes.
const darkModeCss = `
  @media (prefers-color-scheme: dark) {
    .dm-btn { background-color: #3F82F5 !important; color: #ffffff !important; }
  }
  [data-ogsc] .dm-btn { background-color: #3F82F5 !important; color: #ffffff !important; }
  [data-ogsb] .dm-btn { background-color: #3F82F5 !important; color: #ffffff !important; }
`

export function ActionButton({ href, label }: { href: string; label: string }) {
  return (
    <>
      <Button className="dm-btn" style={button} href={href}>
        {label}
      </Button>
      <Text style={fallbackLabel}>Button not working? Paste this link into your browser:</Text>
      <Link href={href} style={fallbackLink}>
        {href}
      </Link>
    </>
  )
}

export function EmailShell({
  preview,
  heading,
  siteName = 'Attendance HQ',
  siteUrl = 'https://attendance-hq.com',
  children,
}: {
  preview: string
  heading: string
  siteName?: string
  siteUrl?: string
  children: React.ReactNode
}) {
  return (
    <Html lang="en" dir="ltr">
      <Head>
        <style>{darkModeCss}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={outer}>
          <Section style={header}>
            <Text style={wordmark}>{siteName}</Text>
            <Text style={tagline}>Campus event check-in in seconds</Text>
          </Section>
          <Section style={goldRule}>&nbsp;</Section>
          <Section style={card}>
            <Heading style={h1}>{heading}</Heading>
            {children}
          </Section>
          <Text style={footer}>
            {siteName} · QR check-in, live head counts, and semester attendance reports.
            <br />
            <Link href={siteUrl} style={footerLink}>
              attendance-hq.com
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
