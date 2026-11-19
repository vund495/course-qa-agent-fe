# features/chat — E4 frontend (student chat, SSE)

| Jira | Story | Assignee | Notes |
|---|---|---|---|
| AI-59 | Student Chat Interface | Nguyễn Chí Trung | main `/chat` screen: message list, input, streaming render |
| AI-69 | Processing Status & System Errors | Unassigned | loading/thinking indicator, error states, retry |

**Key notes:**
- Consume **SSE** from `POST /api/chat` (streamed answer tokens).
- A `consent` event renders an explicit web-search prompt. The client calls
  `POST /api/chat/consent/{offer_id}` only after the user accepts; decline/no
  action never searches. The accepted answer appears as a separate
  **Web Search Answer** bubble with web-only citations.
- History detail restores `pending_consent`, so the offer survives reload and
  session switching. Internet-sourced answers show a **distinct "Web Sources"
  label** and are never mixed with curriculum citations.
- Curriculum markers render short inline labels built from real metadata
  (`Dsa · Mục 1.1 · Trang 12`), with the full original title, section path and
  page in the accessible label. The answer footer keeps the original horizontal
  **Course Materials** chips. Activating either form fetches the original source
  and opens the cited page, without PDF highlighting; syllabus/spreadsheet
  citations open Syllabus. Web markers keep their existing labels and the
  separate Web Sources list.
- Follow-up questions keep conversation context (AI-63 backend).
- Student cannot choose class - class comes from their account.

**Planned files:** `chat-window.tsx`, `message-bubble.tsx`, `chat-input.tsx`, `streaming-indicator.tsx`.
Route: `/chat`.
