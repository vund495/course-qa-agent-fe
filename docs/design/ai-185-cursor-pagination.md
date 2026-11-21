# UI/UX Design & Interaction Specs — Cursor Pagination for Chat History (AI-185)

> **Ticket:** [AI-185](https://ai03.atlassian.net/browse/AI-185)
> **Epic:** AI-93 (Chat History & Memory)
> **Repo:** `course-qa-agent-fe`
> **Target branch:** `features/Design_ChatHistoryCursorPagination`
> **Status:** Design

This document defines the sidebar interaction, component contracts, state machine,
and test plan for **AI-185: replace offset pagination with cursor pagination for
chat history**.

The backend contract is specified in `course-qa-agent-be/docs/design/ai-185-cursor-pagination.md`.
This document covers only the client side.

> **Figma note:** no new screen was issued. The change reuses the existing
> `ChatHistorySidebar` layout, tokens, and Lucide icons; the only new visual
> element is a "Load more" button at the end of the Recent block.

---

## 1. Problem

`ChatHistorySidebar` currently calls `getSessions(classId)` once and renders the
whole list. The backend returns every session with `OFFSET` pagination, so a
student with a long history pays for a full sort on every load and the sidebar
renders hundreds of rows at once.

The sidebar already renders two blocks with **opposite** sort directions:

| Block | Order | Source today |
|---|---|---|
| Pinned | `pinned_at` ascending (oldest pin on top) | `sortSessionsWithPinned()` |
| Recent | `updated_at` descending (newest first) | `sortSessionsWithPinned()` |

Because the two blocks sort differently, one cursor cannot serve both. The
backend exposes two sections (`section=pinned`, `section=recent`), each with its
own cursor, and the client keeps one cursor per block.

---

## 2. UX flow

### 2.1 Desktop sidebar

```text
+--------------------------------------------------+
|  Chat History                         [12] [<]   |
+--------------------------------------------------+
|  PINNED                                          |
|  +--------------------------------------------+  |
|  | Explain the A* search algorithm?      ...  |  |
|  +--------------------------------------------+  |
|  | Midterm logistics review              ...  |  |
|  +--------------------------------------------+  |
|                                                  |
|  RECENT                                          |
|  +--------------------------------------------+  |
|  | Dijkstra vs Bellman-Ford              ...  |  |
|  +--------------------------------------------+  |
|  | ... 18 more rows ...                       |  |
|  +--------------------------------------------+  |
|  +--------------------------------------------+  |
|  |              Load more                     |  |
|  +--------------------------------------------+  |
+--------------------------------------------------+
```

Rules:

1. **Pinned** block loads first with `limit=50` and is **not** paginated in this
   ticket. A student rarely pins more than a few dozen chats, and the block sits
   above the fold. If `next_cursor` comes back non-null the client still stores
   it, so a future ticket can add a second button without an API change.
2. **Recent** block loads with `limit=20`. A "Load more" button appears at the
   bottom of the block while `recentCursor !== null`.
3. The badge next to "Chat History" shows `totalCount` (pinned + recent totals
   from the server), not the number of rows currently rendered.
4. When the Recent block is exhausted (`next_cursor === null`) the button
   disappears; there is no "end of list" label.
5. The button is a plain `<button type="button">`, not an `IntersectionObserver`
   sentinel. Reason: the same component renders inside the desktop column and
   inside the mobile drawer, and the two have different scroll containers. An
   explicit button is testable in jsdom and behaves identically in both.

### 2.2 Mobile drawer

The drawer renders the same `states()` output, so "Load more" appears there with
no extra code. The drawer scroll container is the panel body; the button sits at
the end of the Recent block and is reachable by normal scrolling.

### 2.3 Interaction with existing row actions

| Action | Effect on the two lists |
|---|---|
| Pin / unpin | `loadSessions()` — refetch both sections and reset both cursors. The row moves between blocks, so a local splice would leave the other block's cursor pointing at a stale position. |
| Rename | Patch the row in place in whichever block holds it. Order does not change (`updated_at` is untouched by rename). |
| Delete | Filter the row out of both blocks and decrement `totalCount`. |
| New chat / send message | Existing `refreshTrigger` refetches both sections from page 1. |

---

## 3. Component scope & file changes

### 3.1 New files

| File | Purpose |
|---|---|
| `features/history/merge-sessions.ts` | `mergeSessionPages(existing, incoming)` — append a page, dropping ids already present |
| `features/history/merge-sessions.test.ts` | Unit tests for the merge helper |
| `features/history/cursor-api.test.ts` | Unit tests for the query string built by `getSessionsPage()` |

### 3.2 Modified files

| File | Change |
|---|---|
| `features/history/types.ts` | add `ChatHistorySection`, `ChatSessionPageQuery`; add `next_cursor?: string \| null` to `ChatSessionListResponse` |
| `features/history/api.ts` | add `getSessionsPage()`; keep `getSessions()` untouched for callers that still want the full list; add it to the `historyApi` object |
| `features/history/chat-history-sidebar.tsx` | split `sessions` into `pinnedSessions` + `recentSessions`, add two cursors, `totalCount`, `isLoadingMore`, `loadMoreError`; render the button; route pin/rename/delete through the new state |

### 3.3 Untouched

`sortSessionsWithPinned()`, `session-rail.ts`, `search-*`, `history-prefs.ts`,
`use-history-panel.ts`. The search panel keeps its own offset pagination — this
ticket is scoped to the session list only.

---

## 4. State machine

### 4.1 State

```tsx
const [pinnedSessions, setPinnedSessions] = React.useState<ChatSessionItem[]>([]);
const [recentSessions, setRecentSessions] = React.useState<ChatSessionItem[]>([]);
const [pinnedCursor, setPinnedCursor] = React.useState<string | null>(null);
const [recentCursor, setRecentCursor] = React.useState<string | null>(null);
const [totalCount, setTotalCount] = React.useState(0);
const [isLoadingMore, setIsLoadingMore] = React.useState(false);
const [loadMoreError, setLoadMoreError] = React.useState<string | null>(null);
```

`sessions` becomes derived, so the badge, the pinned rail, and the existing
handlers keep working without a rewrite:

```tsx
const sessions = React.useMemo(
  () => [...pinnedSessions, ...recentSessions],
  [pinnedSessions, recentSessions],
);
```

### 4.2 States

| State | Trigger | UI |
|---|---|---|
| `initial` | first mount, no data yet | existing skeleton rows |
| `loading` | `loadSessions()` in flight | existing skeleton rows |
| `loaded` | both sections resolved | Pinned block (if any) + Recent block + badge |
| `empty` | `totalCount === 0` | existing "No conversations yet" panel |
| `loading-more` | `loadMoreRecent()` in flight | button label becomes `Loading.`, button disabled |
| `load-more-error` | `loadMoreRecent()` rejected | inline `role="alert"` message under the button; already-loaded rows stay on screen; button stays enabled for retry |
| `error` | initial load rejected | existing error panel with Retry |

The distinction that matters: a **load-more** failure must never clear the list.
Only the initial load may replace the panel with the error state.

### 4.3 Transitions

```text
initial ──loadSessions()──▶ loading ──ok──▶ loaded
                                   └─err──▶ error ──Retry──▶ loading

loaded ──Load more──▶ loading-more ──ok──▶ loaded (rows appended, cursor advanced)
                                   └─err──▶ load-more-error ──Load more──▶ loading-more

loaded ──pin/unpin/rename/delete/new chat──▶ loading (refetch or local patch)
```

`loadMoreRecent()` guards on `!recentCursor || isLoadingMore`, so a double click
cannot fire two requests for the same cursor.

---

## 5. API contract

### 5.1 Request

```http
GET /api/history?class_id=<uuid>&section=recent&limit=20&cursor=<opaque>
```

| Param | Values | Notes |
|---|---|---|
| `section` | `recent` \| `pinned` | omit for the legacy offset path |
| `cursor` | opaque string | echo `next_cursor` verbatim; never build one client-side |
| `limit` | 1..100 | client uses 20 for recent, 50 for pinned |

### 5.2 Response

```json
{
  "items": [ { "id": "...", "title": "...", "updated_at": "...", "is_pinned": false } ],
  "total": 137,
  "next_cursor": "eyJ2IjoxLCJzIjoicmVjZW50IiwidCI6..."
}
```

`next_cursor` is `null` on the last page and **always** `null` in legacy offset
mode. `total` is the count for the requested section, so the badge sums the two
sections' totals.

### 5.3 Client helper

```ts
export async function getSessionsPage({
  classId, section, cursor, limit = 20,
}: ChatSessionPageQuery): Promise<ChatSessionListResponse> {
  const params = new URLSearchParams({
    class_id: classId, section, limit: String(limit),
  });
  if (cursor) params.set('cursor', cursor);
  return apiFetch<ChatSessionListResponse>(`/api/history?${params.toString()}`);
}
```

`cursor` is omitted entirely when null — sending `cursor=` would reach the
backend as an empty string and be rejected as malformed.

### 5.4 Backward compatibility

`getSessions()` keeps calling `/api/history?class_id=...` with no `section`, so
the backend runs the untouched offset path. Any other caller of `getSessions()`
sees the same rows, the same order, and the same `total` as before. The new
`next_cursor` field defaults to `null` and is ignored by existing consumers.

---

## 6. Test plan

### 6.1 Unit — `merge-sessions.test.ts`

| Case | Expectation |
|---|---|
| append a page | existing order preserved, new rows appended in server order |
| incoming page repeats an id | duplicate dropped, first occurrence kept |
| incoming page is empty | the same array reference is returned |

### 6.2 Unit — `cursor-api.test.ts`

| Case | Expectation |
|---|---|
| `cursor` provided | query string contains `cursor=<value>` |
| `cursor` null / undefined | query string has no `cursor` key |
| always | `section` and `limit` are present; `class_id` is URL-encoded |

### 6.3 Build & lint

```bash
npm run build
npm test -- history
npx eslint features/history/chat-history-sidebar.tsx features/history/api.ts features/history/merge-sessions.ts
```

### 6.4 Manual E2E

1. Open the sidebar — Pinned and Recent render, badge shows the true total.
2. Create more than 20 sessions — scroll to the end of Recent, "Load more" appears.
3. Click "Load more" — more rows appear, no duplicates.
4. Click until the last page — the button disappears.
5. Pin a session — it moves to the Pinned block, FIFO order preserved.
6. Rename — the row stays in place.
7. Delete — the row disappears and the badge drops by one.
8. Mobile drawer — "Load more" works there too.
9. Go offline, click "Load more" — an inline error appears, loaded rows stay.
10. Reconnect, click again — the next page loads normally.

---

## 7. Risks & decisions

### 7.1 Deviation from AC-01

AC-01 describes the cursor as `(created_at, id)`. The list is sorted by
`updated_at`, so a cursor on `created_at` would not identify a position in the
sort order. The cursor therefore encodes `(updated_at, id)` for `recent` and
`(pinned_at, id)` for `pinned`. This is recorded in the backend design doc §1.4
and does not change the observable behaviour: paging still returns every session
exactly once, in the same order the sidebar already displayed.

### 7.2 `updated_at` is mutable

Sending a message bumps `updated_at`, which moves a session to the top of the
Recent block. A session that moves **above** the current cursor position will
not appear again while paging down — it is already on screen or was skipped by
the user's own action. A session that moves **below** the cursor can appear
twice; `mergeSessionPages()` drops the duplicate by id. Neither case loses a
session permanently: the next `loadSessions()` (new chat, pin, refresh) starts
from page 1.

### 7.3 Pinning resets both cursors

Pinning changes which section a row belongs to, which invalidates both cursors.
The client refetches instead of splicing locally. This costs one round trip per
pin but keeps the two blocks consistent; a local splice would leave the other
block's cursor pointing at a row that no longer exists there.

### 7.4 Pinned block is not paginated

`limit=50` covers realistic pin counts. The cursor is still stored, so adding a
button later needs no API change. If a student exceeds 50 pins the extra rows are
simply not shown until that follow-up lands — an acceptable trade for this
ticket's scope.

### 7.5 Button instead of infinite scroll

An `IntersectionObserver` sentinel would need a different root element for the
desktop column and the mobile drawer, and is awkward to assert in jsdom. An
explicit button is one code path, testable, and accessible by keyboard by
default. If the product later wants auto-loading, the same `loadMoreRecent()`
can be wired to an observer without changing the data layer.

### 7.6 Badge semantics change

The badge used to show `sessions.length` (rows rendered). It now shows
`totalCount` (rows that exist). This is the correct meaning for a paginated list
and matches what a student expects, but it is a visible change worth calling out
in review.

---

## 8. Collapsed rail (follow-up, MR !154)

### 8.1 Problem

The collapsed rail listed **pinned sessions only**. A user who never pinned a
conversation saw an empty rail — which reads as "my history is gone", not as
"nothing is pinned". The rail is the only history affordance visible when the
sidebar is collapsed, so an empty rail is a data-loss signal.

### 8.2 Decision — pinned plus the newest recent

```ts
const RAIL_RECENT_LIMIT = 8;
const railPinned = sessions.filter((s) => s.is_pinned);
const railRecent = sessions.filter((s) => !s.is_pinned);
const railSessions = [...railPinned, ...railRecent.slice(0, RAIL_RECENT_LIMIT)];
const railHiddenCount = Math.max(0, railRecent.length - RAIL_RECENT_LIMIT);
```

Pinned first (they are the user's explicit choices), then the eight most
recently updated. When more recent sessions exist, a dashed `+N` tile expands
the sidebar. Eight keeps the rail within one screen height at 36px per tile
plus the new-chat and expand controls.

### 8.3 Tile content — one character plus a hue

```ts
function railInitial(session) {
  const title = session.title?.trim();
  return title ? title[0].toUpperCase() : '';
}
```

The tile shows **exactly one character** — "C++ là gì" renders `C`. A title that
is empty falls back to the `MessageSquare` icon.

One letter cannot distinguish two conversations that start with the same
letter, so each tile also carries a background/text pair chosen by a stable
hash of the session id:

```ts
const RAIL_TINTS = [
  'bg-[#E8EEF6] text-[#294D72]', 'bg-[#EDF3EA] text-[#3F6B3A]',
  'bg-[#F6EDE8] text-[#8A4B2F]', 'bg-[#F0EAF6] text-[#5B3F7A]',
  'bg-[#E9F2F3] text-[#2F6B70]', 'bg-[#F6EFE4] text-[#7A5A2A]',
];
```

The same session id always gets the same hue, so the tile is a stable landmark
rather than a random colour. The active session overrides the tint with the
brand fill and white text.

### 8.4 Rail states

| State | Render |
|---|---|
| No sessions at all | `No chats yet` in 9px muted text |
| Sessions, none pinned | Recent tiles only |
| Sessions, some pinned | Pinned tiles (with pin badge) then recent tiles |
| More than 8 recent | `+N` dashed tile that expands the sidebar |
| Active session | Brand fill, white text, `aria-current="true"` |

### 8.5 Stale list after a failed stream

`startNewChat` now calls `loadSessions()` after clearing the composer. A turn
that fails mid-stream never fires `onTurnComplete`, so `historyRefresh` never
increments and the sidebar kept a list missing the conversation the user just
had. Pulling the server's copy before the empty composer appears removes that
window.

### 8.6 Acceptance

1. Collapse the sidebar with no pinned sessions → recent tiles are visible.
2. A conversation titled "C++ là gì" shows `C`.
3. Two conversations starting with the same letter have different tile colours.
4. With more than 8 recent sessions, `+N` appears and expands the sidebar.
5. Empty account shows `No chats yet`, not a blank strip.
6. The active conversation is visually distinct from its tint.
