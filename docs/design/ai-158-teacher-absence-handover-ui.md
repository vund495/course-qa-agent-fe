# AI-158 — Teacher absence and ticket handover UI design

> **Ticket:** [AI-158](https://ai03.atlassian.net/browse/AI-158) (Epic AI-145: Class Schedule & Attendance)
> **Priority:** High | **Story Points:** 13 SP
> **Sprint:** Sprint 4 — Quiz & Attendance (2026-11-01 → 2026-11-13)
> **Status:** Design (not implemented)
> **Target branch:** `features/Implementation_TeacherAbsenceHandover`
> **Backend contract:** `course-qa-agent-be/docs/design/ai-158-teacher-absence-handover.md`
> **Related:** AI-83 (trainer inbox), AI-87 (unread replies), AI-89 (lifecycle + counts), AI-136 (attendance UI), AI-137 (escalation badge)

Everything below was verified against the frontend on branch
`features/Implementation_TeacherAbsenceHandover` (2026-11-09). The UI reuses the existing
app language (English), the existing `TicketsInboxLayout`, `ClassPageHeader`, `Table`,
`Modal`, `Alert`, `EmptyState`, `Button`, `AppSelect`, `Spinner`, `SkeletonLine` and
`toast` primitives. **No new design system.**

### Mapping to the planning document (`ke_hoach_task_AI-158.md`, step 0.4)

| Required | Where |
|---|---|
| ASCII wireframes | §4 (teacher day-status, ticket badges, admin queue, leave modal) |
| State matrix (loading / empty / error / success) | §5 |
| English copy | §6 |

---

## 1. Purpose

Give three roles the surfaces AI-158 needs, and nothing more:

- **Teacher** — say whether they are working today, ask for planned leave, and answer a
  handover that was pushed to them.
- **Trainer inbox (existing pages)** — show **who owns the ticket**, whether it is **waiting
  for an admin**, and **who transferred it and why**.
- **Admin** — a queue of tickets nobody can answer, with the ability to reply directly or
  assign them by hand.

### 1.1 Scope boundaries

- No new ticket status is rendered. The existing `OPEN / ANSWERED / RESOLVED / EXPIRED`
  pills in `ticket-status-badge.tsx` stay unchanged; AI-158 adds **separate** markers.
- No admin class-detail page: everything lands on the new queue page or a modal.
- No email/push UI. Notifications are the existing in-app unread reply mechanism.
- No real-time polling beyond what the inbox already does.
- No drag-and-drop, no calendar drag, no bulk assignment.

---

## 2. Routes and navigation

### 2.1 New route — admin ticket queue

| Route | File |
|---|---|
| `/admin/tickets/queue` | `app/(shell)/admin/tickets/queue/page.tsx` |

Menu entry in `components/ui/nav-config.ts` (`NAV_ITEMS`), admin-only:

```ts
{ href: "/admin/tickets/queue", label: "Ticket Queue", roles: ["admin"], icon: Inbox }
```

`canAccessRoute()` already falls through for unlisted paths, so the route works without this
entry — but without it the page is undiscoverable, and the comment in that file states
"Adding a menu item = one entry here". `Inbox` must also be added to that file's existing
`lucide-react` import list.

### 2.2 Edited route — teacher attendance

| Route | File |
|---|---|
| `/teacher/class/[id]/attendance` | `app/(shell)/teacher/class/[id]/attendance/page.tsx` **[EDIT]** |

The day-status control is a **header strip on the existing attendance page**, not a new tab:

- Header `actions` slot gets a `TrainerDayStatusControl` (two-segment toggle + status text).
- It sits beside the existing "Week" picker so the teacher's "am I working?" answer is
  visible exactly where they mark students.
- No tab is added; the tab row already holds eight items (AI-136 note about 1024 px).

### 2.3 Edited surfaces — trainer ticket inbox

| Route | File |
|---|---|
| `/teacher/class/[id]/tickets` | `features/tickets/ticket-inbox.tsx` **[EDIT]** |
| `/student/class/[id]/tickets` | `features/tickets/student-tickets.tsx` **[EDIT — badges only]** |

Badges are added inside the existing left-hand row and the existing detail header. The
two-pane layout, filters, pagination and search are untouched.

### 2.4 New surface — handover inbox for the recipient

A **card at the top of the trainer inbox**, above the two-pane layout, visible only when the
caller is the target of a pending handover or the target of a pending leave request. A
separate page would be a dead end with zero entries most days.

---

## 3. Component map

```text
lib/
├── handover-api.ts                         [NEW] types + fetch client
└── handover-api.test.ts                    [NEW]

features/handover/
├── trainer-day-status-control.tsx          [NEW] present/off toggle
├── handover-badge.tsx                       [NEW] Owner / Waiting for admin / Transferred
├── handover-request-card.tsx                [NEW] recipient accept/reject (handover + leave)
├── admin-ticket-queue.tsx                   [NEW] queue list + detail + reply + assign
├── assign-ticket-modal.tsx                  [NEW] admin manual assign
├── leave-request-modal.tsx                  [NEW] teacher planned leave
├── leave-request-list.tsx                   [NEW] my sent / received leaves
└── *.test.tsx                               [NEW]

app/(shell)/
├── admin/tickets/queue/page.tsx             [NEW]
└── teacher/class/[id]/attendance/page.tsx   [EDIT] add day-status control
```

`features/handover/` is a new folder rather than an expansion of `features/tickets/`,
because only `handover-badge.tsx` is ticket-shaped; the rest is availability and leave.

Primitive paths for reference: `components/ui/empty-state.tsx` (`EmptyState`),
`components/shared/Modal.tsx` (`Modal`), `components/ui/app-select.tsx` (`AppSelect`),
`components/shared/TicketsInboxLayout.tsx` (`TicketsInboxLayout`).

### 3.1 `lib/handover-api.ts`

Follow `lib/attendance-api.ts` exactly: `AUTH_TOKEN_KEY` from `components/ui/nav-config`,
`NEXT_PUBLIC_API_URL` fallback `http://localhost:8000`, bearer token from `localStorage`,
throw an error carrying the backend `detail`, plain `snake_case` types.

```ts
export type DayStatus = "present" | "off";

export type TrainerDayStatus = {
  trainer_id: string;
  trainer_name: string;
  date: string;                 // "2026-11-09"
  status: DayStatus;
  note: string | null;
  recorded_by: string | null;
  updated_at: string;
};

export type Handover = {
  id: string;
  ticket_id: string;
  ticket_question: string;
  from_trainer_id: string;
  from_trainer_name: string;
  to_trainer_id: string;
  to_trainer_name: string;
  reason: "auto_absent" | "manual_transfer";
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  responded_at: string | null;
};

export type LeaveRequest = {
  id: string;
  trainer_id: string;
  trainer_name: string;
  date_from: string;
  date_to: string;
  target_trainer_id: string;
  target_trainer_name: string;
  reason: string | null;
  status: "pending" | "accepted" | "rejected";
  responded_by: string | null;
  responded_at: string | null;
  created_at: string;
};

export type AdminQueueItem = TicketInboxItem & {
  absent_trainers: string[];
  queued_for_admin_at: string | null;
};

export const handoverApi = {
  getMyDayStatus: (date?: string) => ...,
  setMyDayStatus: (body: { date?: string; status: DayStatus }) => ...,
  getClassDayStatus: (classId: string, date?: string) => ...,
  listMyHandovers: () => ...,
  acceptHandover: (id: string) => ...,
  rejectHandover: (id: string) => ...,
  listMyLeaves: () => ...,
  createLeave: (body: { date_from: string; date_to: string; target_trainer_id: string; reason?: string }) => ...,
  acceptLeave: (id: string) => ...,
  rejectLeave: (id: string) => ...,
  adminQueue: () => ...,
  assignTicket: (ticketId: string, toTrainerId: string) => ...,
};
```

`features/tickets/api.ts` gains the AI-158 fields on `Ticket` (additive, optional):

```ts
owner_trainer_id?: string | null;
owner_trainer_name?: string | null;
queued_for_admin_at?: string | null;
handover_from_id?: string | null;
handover_from_name?: string | null;
handover_reason?: "auto_absent" | "manual_transfer" | null;
handover_at?: string | null;
```

---

## 4. Wireframes

### 4.1 Teacher — day-status control (attendance page header)

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  Class: PY101-FA26-001 — Python Fundamentals          [◀ Week]  Nov 09 – 15 ▶ │
│  Attendance                                                                   │
│                                                                              │
│   ┌───────────────────────────────────────────────────────────────────┐      │
│   │  Today, Sat Nov 09            [ I'm present ][  I'm off  ]        │      │
│   │  You are marked PRESENT.    Tickets from your classes stay yours. │      │
│   └───────────────────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────────────────┘
```

After switching to **I'm off** (optimistic → replaced by server value):

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│   ┌───────────────────────────────────────────────────────────────────┐      │
│   │  Today, Sat Nov 09            [ I'm present ][●I'm off  ]         │      │
│   │  You are marked OFF.      3 open tickets were handed to Teacher Two│      │
│   └───────────────────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────────────────┘
```

Rules:

- Two buttons, not a switch: the current state is always spelled out in text, so colour is
  never the only signal.
- The control renders **only for a trainer** (`/teacher/...` routes). Admins set another
  trainer's status from the admin queue page (§4.4), never here.
- The consequence line is required copy, not decoration: it tells the teacher what just
  happened to their tickets.
- If the class has no other trainer, the consequence line changes to the "waiting for an
  administrator" variant (§6).

### 4.2 Trainer inbox — badges on the row and in the detail header

Row (left list, existing layout, one new line under the question):

```text
┌────────────────────────────────────────────────────────────┐
│  OPEN   Nov 09, 09:12                        Tran Thi Binh │
│  How do I read a CSV file with pandas?                      │
│  ────────────────────────────────────────────────────────  │
│  [Owner: you]   [Transferred from Academic Trainer]        │
└────────────────────────────────────────────────────────────┘
```

Row for a ticket nobody can answer:

```text
┌────────────────────────────────────────────────────────────┐
│  OPEN   Nov 09, 09:12                        Tran Thi Binh │
│  Why does my loop stop after one row?                       │
│  ────────────────────────────────────────────────────────  │
│  [Owner: Academic Trainer]   [Waiting for admin]           │
└────────────────────────────────────────────────────────────┘
```

Detail header (right pane, beside the existing status pill):

```text
┌──────────────────────────────────────────────────────────────────────┐
│  Why does my loop stop after one row?              [OPEN]            │
│  Tran Thi Binh · PY101-FA26-001 · Nov 09, 09:12                      │
│  ──────────────────────────────────────────────────────────────────  │
│  Owner            Teacher Two                                        │
│  Handover         from Academic Trainer · auto_absent · Nov 09, 09:30│
└──────────────────────────────────────────────────────────────────────┘
```

Badge vocabulary (three fixed badges, no fourth):

| Badge | Condition | Meaning |
|---|---|---|
| `Owner: you` | `owner_trainer_id === currentUser.id` | You are responsible |
| `Owner: {name}` | owner is somebody else | Read-only context for a class-scoped viewer |
| `Waiting for admin` | `queued_for_admin_at != null` | Nobody on the class can answer |
| `Transferred from {name}` | latest accepted handover exists | Shown with `· {reason} · {date}` |

Badges are never shown to students except the existing unread reply marker.

### 4.3 Recipient — pending handover / leave card above the inbox

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  Needs your answer                                            (2 items)  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ TICKET HANDOVER · auto_absent                                       │  │
│  │ "How do I read a CSV file with pandas?"                             │  │
│  │ From Academic Trainer · Nov 09, 09:30                               │  │
│  │                              [ Accept ticket ]   [ Reject ]         │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ LEAVE REQUEST · Nov 10 – Nov 12                                     │  │
│  │ Academic Trainer is asking you to cover 3 days.                     │  │
│  │ Reason: Family trip                                                 │  │
│  │                              [ Accept cover ]    [ Reject ]         │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

Reject opens a confirm dialog because it re-runs the automatic flow:

```text
┌───────────────────────────────────────────────────────────────┐
│  Reject this handover?                                        │
│                                                               │
│  The ticket will not come back to you. It returns to the      │
│  automatic rule and goes to another available trainer, or     │
│  waits for an administrator.                                  │
│                                                               │
│                              [ Cancel ]   [ Reject handover ] │
└───────────────────────────────────────────────────────────────┘
```

### 4.4 Admin — ticket queue page

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  Ticket Queue                                    [ 7 waiting ]               │
│  Tickets no trainer can answer right now.                                    │
│                                                                              │
│  [ Search tickets ]        [ All ][ Nobody marked off ][ Holiday ]           │
│                                                                              │
│ ┌──────────────────────────────┬───────────────────────────────────────────┐ │
│ │ 1h ago  OPEN                 │  Why does my loop stop after one row?     │ │
│ │ Tran Thi Binh · PY101-…      │  Tran Thi Binh · PY101-FA26-001           │ │
│ │ [Owner: Academic Trainer]    │  Nov 09, 09:12 · OPEN                     │ │
│ │ [Waiting for admin]          │  ───────────────────────────────────────  │ │
│ ├──────────────────────────────┤  All trainers of this class are off:      │ │
│ │ 3h ago  OPEN                 │  Academic Trainer (off), Teacher Two (off)│ │
│ │ Le Van Nam · CS101-…         │                                           │ │
│ │ [Owner: Academic Trainer]    │  Question                                 │ │
│ │ [Waiting for admin]          │  Why does my loop stop after one row?     │ │
│ ├──────────────────────────────┤  ───────────────────────────────────────  │ │
│ │ 1d ago  OPEN                 │  Conversation                             │ │
│ │ …                            │  Binh: Why does my loop stop…             │ │
│ │                              │  [system] All trainers are off today; the │ │
│ │                              │  ticket is waiting for an administrator.  │ │
│ │                              │  ───────────────────────────────────────  │ │
│ │                              │  [ Write a reply…                    ]    │ │
│ │                              │              [ Reply ]  [ Assign… ]       │ │
│ └──────────────────────────────┴───────────────────────────────────────────┘ │
│  Showing 1–20 of 7                                        [ 1 ] [ 2 ] [ ▶ ] │
└──────────────────────────────────────────────────────────────────────────────┘
```

- Reuses `TicketsInboxLayout` (title, `titleBadge` = waiting count, search, filters, left
  list, right detail) so the page is visually identical to the trainer inbox.
- Filters here are **not** ticket statuses; every queued ticket is `OPEN` by definition.
  Filters are `All`, `Nobody marked off` (queued but no `trainer_day_status='off'` row —
  a data smell worth surfacing) and `Holiday` (queued on a holiday date).
- Sorted by `queued_for_admin_at ASC` — oldest first, because oldest waits the longest.
- **Reply** sends the existing `POST /api/tickets/{id}/replies`; on success the row leaves
  the queue and a toast confirms it.
- **Assign…** opens the modal in §4.5.

The empty queue is a success state, not an error:

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                          ✓                                                   │
│              No tickets are waiting for an administrator.                     │
│              Every open ticket has a trainer who can answer it.               │
│                                                                              │
│                                                  [ Refresh ]                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.5 Admin — assign ticket modal

```text
┌───────────────────────────────────────────────────────────────┐
│  Assign this ticket                                           │
│  "Why does my loop stop after one row?"                       │
│                                                               │
│  Assign to                                                    │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Teacher Two                            4 open   ✓       │  │
│  │ Academic Trainer (currently off)       2 open           │  │
│  │ Nguyen Van Ba                          0 open           │  │
│  └─────────────────────────────────────────────────────────┘  │
│  Only trainers of PY101-FA26-001 are listed.                  │
│  Trainers marked off today are shown but cannot be chosen.    │
│                                                               │
│  The current owner is notified in the ticket thread.           │
│                                                               │
│                                     [ Cancel ]  [ Assign ]    │
└───────────────────────────────────────────────────────────────┘
```

- Disabled rows carry the reason `(currently off)` inline — never a tooltip only.
- `Assign` is disabled until a valid trainer is chosen.
- Conflict (`409`) keeps the modal open and prints the `detail` under the list.

### 4.6 Teacher — planned leave modal

Opened from a `Request leave` button on the attendance page header (next to the day-status
control) and from `My leaves`.

```text
┌───────────────────────────────────────────────────────────────────────┐
│  Request planned leave                                        [ × ]   │
│                                                                       │
│  From                            To                                   │
│  ┌─────────────────────────┐     ┌─────────────────────────┐          │
│  │ 2026-11-10       [cal]  │     │ 2026-11-12       [cal]  │          │
│  └─────────────────────────┘     └─────────────────────────┘          │
│  Range covers 3 days and 2 class sessions.                            │
│                                                                       │
│  Ask this trainer to cover                                           │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │ Teacher Two                            PY101-FA26-001, CS101-…  │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│  Only trainers who teach your classes are listed.                     │
│                                                                       │
│  Reason (optional)                                                    │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │ Family trip                                                     │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  If they accept, your open tickets move to them for these dates.      │
│  If they reject, tickets follow the automatic rule.                   │
│                                                                       │
│                                        [ Cancel ]  [ Send request ]   │
└───────────────────────────────────────────────────────────────────────┘
```

Validation is inline under the offending field, not a toast:

| Field | Rule | Message |
|---|---|---|
| From | required | "Choose a start date." |
| From | not more than 7 days in the past | "You can only request leave from the last 7 days onward." |
| To | `>= From` | "The end date cannot be before the start date." |
| Cover | required | "Choose a trainer to cover your classes." |
| Cover | must teach one of your classes | "That trainer does not teach your classes." |

### 4.7 Teacher — my leaves list

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  My leaves                                                                   │
│                                                                              │
│  Date range          Cover for        Status      Answered                   │
│  ─────────────────────────────────────────────────────────────────────────   │
│  Nov 10 – Nov 12     Teacher Two      PENDING     —                          │
│  Oct 28 – Oct 29     Teacher Two      ACCEPTED    Oct 27 by Teacher Two      │
│  Oct 20 – Oct 20     Nguyen Van Ba    REJECTED    Oct 19 by Nguyen Van Ba    │
│                                                                              │
│  Rejected requests fall back to the automatic rule, so your tickets still    │
│  reach another trainer when one is available.                                │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.8 Student — the only visible change

Nothing new. The student thread already shows a system reply, which the existing unread
logic turns into the existing badge:

```text
  [system]  Ticket transferred from Academic Trainer to Teacher Two (auto_absent).
            Nov 09, 09:30
```

Copy is authored by the backend (§5.5 of the BE design); the frontend renders replies
verbatim and must **not** special-case them.

---

## 5. State matrix

Every surface must define all four states before it is considered done. `SkeletonLine` is
the project's existing shimmer placeholder; `Spinner` is used inside buttons only.

### 5.1 Teacher day-status control

| State | Trigger | What renders |
|---|---|---|
| **Loading** | first `getMyDayStatus` in flight | Two buttons disabled, `Spinner` inside the left button, helper line `Checking today's status…` |
| **Empty** | no row for today (server default) | Treated as **success** with `present`: `You are marked PRESENT.` and no badge, because "no row" means present by definition |
| **Error** | `getMyDayStatus` fails | `Alert` below the header: *Could not load your status today.* + `Retry`; both buttons stay disabled so a stale state can never be saved |
| **Success (present)** | `status === "present"` | `I'm present` is the current segment; helper: `Tickets from your classes stay yours.` |
| **Success (off)** | `status === "off"` | Helper names the outcome: `3 open tickets were handed to Teacher Two.` or `All open tickets are waiting for an administrator.` |
| **Saving** | `PUT` in flight | Chosen segment shows `Spinner`, both segments disabled, no optimistic flip of the *other* segment |
| **Save error** | `PUT` fails | Revert to the server value, `toast.error(detail)`, helper returns to the previous text |
| **Past date** | date older than today | Same states; helper appends `(Nov 07)` so the date is never ambiguous |

### 5.2 Trainer inbox badges

| State | Trigger | What renders |
|---|---|---|
| **Loading** | list in flight | Existing skeleton rows; badges area stays blank (no placeholder badges) |
| **Empty** | no fields present | No badge row at all — an unowned legacy row must not render `Owner: null` |
| **Error** | list fails | Existing inbox error block; badges irrelevant |
| **Success** | `owner_trainer_name` present | `Owner: you` or `Owner: {name}` |
| **Success (queued)** | `queued_for_admin_at != null` | Adds `Waiting for admin`; if `owner` is also set, both show, owner first |
| **Success (transferred)** | `handover_from_name` present | Adds `Transferred from {name}` with `· {reason} · {date}` in the detail header |

### 5.3 Pending handover / leave card

| State | Trigger | What renders |
|---|---|---|
| **Loading** | `listMyHandovers` / `listMyLeaves` in flight | Compact `SkeletonLine`, fixed height 96 px, so the inbox below does not jump |
| **Empty** | no pending items | **Card is not rendered at all** (no empty box on a normal day) |
| **Error** | request fails | One-line `Alert`: *Could not load items waiting for you.* + `Retry`; the inbox below still works |
| **Success** | 1..n pending | Cards with `Accept` / `Reject`; header count `(2 items)` |
| **Busy** | accept/reject in flight | Both buttons of that card disabled, `Spinner` on the pressed one, other cards stay interactive |
| **Conflict (409)** | already answered elsewhere | Card is removed, `toast.error('This request was already answered.')`, list refetched |
| **Forbidden (403)** | not the target | Card is removed silently and the list refetched — the row was stale |

### 5.4 Admin ticket queue

| State | Trigger | What renders |
|---|---|---|
| **Loading** | first page | Header count shows `…`, left list shows 6 skeleton rows, right pane shows the *Select a ticket* hint |
| **Empty** | `items.length === 0` | Centered success block (§4.4): `No tickets are waiting for an administrator.` + `Refresh` |
| **Error** | `adminQueue()` fails | Full-page `Alert` with `Try again`; **no** empty-state, to avoid implying the queue is clear |
| **Success** | ≥1 item | Two-pane layout, oldest first, count badge = `total` |
| **Detail empty** | no row selected | `Select a ticket to read the conversation.` (same instruction as the trainer inbox) |
| **Reply busy** | `POST /replies` in flight | `Reply` disabled + `Spinner`; textarea disabled; row stays selected |
| **Reply success** | 201 | Row leaves the list, count decrements, next row auto-selected if any, `toast.success('Reply sent.')` |
| **Reply conflict (409)** | ticket no longer `OPEN` | `toast.error(detail)`, queue refetched |
| **Assign success** | 200 | Modal closes, row leaves the list, `toast.success('Ticket assigned to {name}.')` |
| **Assign conflict (409)** | already belongs to that trainer | Modal stays open, inline error under the list |

### 5.5 Leave request modal

| State | Trigger | What renders |
|---|---|---|
| **Loading** | trainer options in flight | `Cover` select disabled with `Loading trainers…` |
| **Empty** | no same-class colleague exists | `Alert`: *You are the only trainer on these classes, so there is nobody to cover your leave.*; `Send request` disabled |
| **Error** | options fail | Inline `Alert` + `Retry` inside the modal; form values are kept |
| **Success** | `POST` 201 | Modal closes, `toast.success('Leave request sent.')`, `My leaves` refetched with the new PENDING row |
| **Validation error** | client rules (§4.6) | Field-level message, focus moves to the first invalid field |
| **Server error (400/409)** | e.g. target no longer teaches the class | Error banner at the top of the modal, form kept, `detail` shown verbatim |

### 5.6 My leaves list

| State | Trigger | What renders |
|---|---|---|
| **Loading** | fetch in flight | 3 skeleton rows |
| **Empty** | no requests | `You have not requested leave yet.` + `Request leave` button |
| **Error** | fetch fails | `Alert` + `Retry` |
| **Success** | rows | Table as in §4.7; PENDING rows are the only ones with an action hint |

### 5.7 Cross-cutting states

| Situation | Behaviour everywhere |
|---|---|
| `403` on load | Replace the surface with *You do not have access to this page.* No retry button — retrying cannot help |
| `404` on leave/handover | Remove the row, refetch, `toast.error('That request no longer exists.')` |
| Network error | `toast.error('Network error. Check your connection.')` and keep the last good data on screen |
| Role switch mid-session | The queue page and day-status control re-check the role from `AUTH_ROLE_KEY`; a student or trainer never renders admin controls |

---

## 6. Copy deck (English)

The app is English-only (`AI-121 UI foundation`). Use these strings verbatim so tests and
screenshots stay stable.

### 6.1 Day status

| Key | Text |
|---|---|
| `dayStatus.title` | `Today, {EEE MMM dd}` |
| `dayStatus.present` | `I'm present` |
| `dayStatus.off` | `I'm off` |
| `dayStatus.checking` | `Checking today's status…` |
| `dayStatus.presentHelp` | `You are marked PRESENT. Tickets from your classes stay yours.` |
| `dayStatus.offHelp.handed` | `You are marked OFF. {n} open tickets were handed to {name}.` |
| `dayStatus.offHelp.queued` | `You are marked OFF. All open tickets are waiting for an administrator.` |
| `dayStatus.offHelp.none` | `You are marked OFF. You have no open tickets right now.` |
| `dayStatus.loadError` | `Could not load your status today.` |

Pluralisation: `1 open ticket was handed to {name}.` / `{n} open tickets were handed to {name}.`

### 6.2 Ticket badges

| Key | Text |
|---|---|
| `badge.ownerYou` | `Owner: you` |
| `badge.owner` | `Owner: {name}` |
| `badge.waitingAdmin` | `Waiting for admin` |
| `badge.transferred` | `Transferred from {name}` |
| `badge.transferredMeta` | `{reason} · {date}` where `reason` is `auto absence` or `manual transfer` |
| `detail.owner` | `Owner` |
| `detail.handover` | `Handover` |

Reason labels are humanised in the UI (`auto_absent` → `auto absence`); the raw enum is
never shown.

### 6.3 Handover / leave cards

| Key | Text |
|---|---|
| `card.header` | `Needs your answer` |
| `card.count` | `({n} items)` |
| `card.handoverKicker` | `TICKET HANDOVER · {reason}` |
| `card.handoverMeta` | `From {name} · {date}` |
| `card.leaveKicker` | `LEAVE REQUEST · {from} – {to}` |
| `card.leaveBody` | `{name} is asking you to cover {n} days.` |
| `card.leaveReason` | `Reason: {reason}` |
| `card.acceptTicket` | `Accept ticket` |
| `card.acceptCover` | `Accept cover` |
| `card.reject` | `Reject` |
| `card.rejectTitle` | `Reject this handover?` |
| `card.rejectBody` | `The ticket will not come back to you. It returns to the automatic rule and goes to another available trainer, or waits for an administrator.` |
| `card.rejectConfirm` | `Reject handover` |
| `card.loadError` | `Could not load items waiting for you.` |
| `card.cancel` | `Cancel` |

### 6.4 Admin queue

| Key | Text |
|---|---|
| `queue.title` | `Ticket Queue` |
| `queue.subtitle` | `Tickets no trainer can answer right now.` |
| `queue.waiting` | `{n} waiting` |
| `queue.empty.title` | `No tickets are waiting for an administrator.` |
| `queue.empty.body` | `Every open ticket has a trainer who can answer it.` |
| `queue.empty.action` | `Refresh` |
| `queue.filter.all` | `All` |
| `queue.filter.noAbsence` | `Nobody marked off` |
| `queue.filter.holiday` | `Holiday` |
| `queue.absentLine` | `All trainers of this class are off: {names}` |
| `queue.absentSince` | `Waiting since {date}` |
| `queue.replyPlaceholder` | `Write a reply…` |
| `queue.reply` | `Reply` |
| `queue.replySent` | `Reply sent.` |
| `queue.assign` | `Assign…` |
| `queue.selectHint` | `Select a ticket to read the conversation.` |
| `queue.error` | `Could not load the ticket queue.` |

### 6.5 Assign modal

| Key | Text |
|---|---|
| `assign.title` | `Assign this ticket` |
| `assign.label` | `Assign to` |
| `assign.scopeNote` | `Only trainers of {classCode} are listed.` |
| `assign.offNote` | `Trainers marked off today are shown but cannot be chosen.` |
| `assign.offSuffix` | `(currently off)` |
| `assign.openCount` | `{n} open` |
| `assign.notifyNote` | `The current owner is notified in the ticket thread.` |
| `assign.confirm` | `Assign` |
| `assign.success` | `Ticket assigned to {name}.` |

### 6.6 Leave

| Key | Text |
|---|---|
| `leave.request` | `Request leave` |
| `leave.title` | `Request planned leave` |
| `leave.from` | `From` |
| `leave.to` | `To` |
| `leave.rangeSummary` | `Range covers {n} days and {m} class sessions.` |
| `leave.coverLabel` | `Ask this trainer to cover` |
| `leave.coverNote` | `Only trainers who teach your classes are listed.` |
| `leave.reason` | `Reason (optional)` |
| `leave.consequence` | `If they accept, your open tickets move to them for these dates. If they reject, tickets follow the automatic rule.` |
| `leave.send` | `Send request` |
| `leave.sent` | `Leave request sent.` |
| `leave.mine` | `My leaves` |
| `leave.empty` | `You have not requested leave yet.` |
| `leave.col.range` | `Date range` |
| `leave.col.cover` | `Cover for` |
| `leave.col.status` | `Status` |
| `leave.col.answered` | `Answered` |
| `leave.rejectedNote` | `Rejected requests fall back to the automatic rule, so your tickets still reach another trainer when one is available.` |
| `leave.err.from` | `Choose a start date.` |
| `leave.err.past` | `You can only request leave from the last 7 days onward.` |
| `leave.err.order` | `The end date cannot be before the start date.` |
| `leave.err.cover` | `Choose a trainer to cover your classes.` |
| `leave.err.sameClass` | `That trainer does not teach your classes.` |
| `leave.err.onlyTrainer` | `You are the only trainer on these classes, so there is nobody to cover your leave.` |
| `leave.status.pending` | `PENDING` |
| `leave.status.accepted` | `ACCEPTED` |
| `leave.status.rejected` | `REJECTED` |

### 6.7 Shared

| Key | Text |
|---|---|
| `common.refresh` | `Refresh` |
| `common.retry` | `Try again` |
| `common.noAccess` | `You do not have access to this page.` |
| `common.network` | `Network error. Check your connection.` |
| `common.gone` | `That request no longer exists.` |
| `common.alreadyAnswered` | `This request was already answered.` |

---

## 7. Permissions in the UI

Client-side checks are **UX only**; the backend is the boundary (AI-27).

| Surface | Shown when | Hidden otherwise |
|---|---|---|
| Day-status control | route is `/teacher/…` **and** role is `trainer` | Trainer assistant (`teaching_assistant`) and admin do not get it |
| `Request leave` | role is `trainer` | — |
| Handover/leave card | role is `trainer` | Students and admins never fetch it |
| `Owner` / `Waiting for admin` badges | role is `trainer` or `admin` | Students do not see ownership (they keep only the unread marker) |
| `Ticket Queue` nav item + page | role is `admin` | Trainer sees a 403 block if they deep-link |
| `Assign…` | role is `admin` | — |
| Reject confirm dialog | caller is the handover target | — |

Role is read from `AUTH_ROLE_KEY` (`components/ui/nav-config.ts`), the same key the sidebar
uses — not from a new store.

---

## 8. Accessibility and responsive behaviour

- The two-button day-status control is a `radiogroup` with two `role="radio"` buttons and
  `aria-checked`; arrow keys move the selection. It is not a checkbox, because "off" is a
  positive choice, not the absence of one.
- Badges always carry text; no meaning is colour-only. `Waiting for admin` must be readable
  at AA contrast on the pale amber background used by `OPEN`.
- The assign modal is a focus trap (`Modal` already provides it): focus lands on the first
  selectable trainer, `Esc` closes, focus returns to the `Assign…` button.
- The leave modal validates on submit, then moves focus to the first invalid field.
- The queue list is keyboard-navigable like the trainer inbox (`TicketsInboxLayout`), with
  `aria-live="polite"` on the count badge so a queue shrinking after a reply is announced.
- Under `lg` (1024 px) the two-pane inbox collapses to list → detail with a back button; the
  day-status strip wraps to two lines and the helper text stays on its own line.
- The leave modal is a single column under `sm`; the date inputs stack.

---

## 9. Test plan

Vitest + Testing Library, matching the existing `*.test.tsx` convention.

| File | Covers |
|---|---|
| `lib/handover-api.test.ts` | URLs and verbs for all 12 calls, bearer header, `detail` thrown as an error message |
| `features/handover/trainer-day-status-control.test.tsx` | default `present`, toggle to `off` calls the API once, consequence copy switches, save error reverts |
| `features/handover/handover-badge.test.tsx` | none / owner-you / owner-other / queued / transferred / both-badges order |
| `features/handover/handover-request-card.test.tsx` | renders nothing when empty, accept calls API, reject opens confirm, 409 removes the card |
| `features/handover/admin-ticket-queue.test.tsx` | loading skeleton, empty success block, error block (not empty), reply removes the row, 409 toast |
| `features/handover/assign-ticket-modal.test.tsx` | off-trainer rows disabled with `(currently off)`, submit disabled until selection, 409 inline error |
| `features/handover/leave-request-modal.test.tsx` | field validation messages, payload shape, only-trainer empty case, success closes + toasts |
| `features/tickets/ticket-inbox.test.tsx` [EDIT] | new fields do not break the existing render; badges absent when fields are absent |

Required negative assertions:

- A ticket without `owner_trainer_name` renders **no** owner badge (no `Owner: undefined`).
- A queue fetch failure must **not** render the empty success block.
- `Reject` must not call the API until the confirm dialog is accepted.

---

## 10. Out of scope

- Bulk assign, drag-and-drop between trainers, calendar views of leave.
- Push/email notification UI and a notification centre.
- Admin editing a trainer's status from the class page (admin queue page only).
- Half-day leave, hourly leave, substitute-teacher assignment per session.
- Cross-class assignment (backend rejects it in this phase; the modal only lists same-class
  trainers).
- Redesigning the ticket inbox, status pills or the student ticket page.
