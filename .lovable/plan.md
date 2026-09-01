# Update AI assistant list: add MANUS, remove Cursor and Lovable

Replace Cursor and Lovable with MANUS everywhere the app lists supported AI assistants, keeping the existing Attendance HQ branding and MCP setup flow.

## Files to change

1. `src/routes/agents.tsx`
   - Replace the `CLIENTS` array: keep ChatGPT and Claude, add MANUS, remove Cursor and Lovable.
   - Update the page subtitle, meta description, and any other visible assistant list to read "ChatGPT, Claude, or MANUS".
   - Use standard MANUS MCP setup steps unless exact copy is provided.

2. `src/routes/settings.tsx`
   - Update the AI assistants row detail text from "Connect ChatGPT, Claude, or Cursor" to include MANUS and exclude Cursor/Lovable.

3. `src/routes/clubs.$clubId.tsx`
   - Update the AI assistants section description to list ChatGPT, Claude, and MANUS only.

4. `src/lib/email-templates/agent-setup-link.tsx`
   - Update the email preview line and body copy so it mentions ChatGPT, Claude, and MANUS instead of Cursor/Lovable.

## Verification

- Typecheck passes.
- `/agents` renders ChatGPT, Claude, and MANUS cards only.
- Settings and club detail pages reference the updated list.
- Email preview text no longer includes Cursor or Lovable.
