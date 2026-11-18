# AI-140: Holiday calendar and trainer leave UI

AI-140 adds the administration and class-facing interfaces for yearly holidays
and admin-reviewed trainer leave. The UI consumes the existing AI-158 leave
workflow instead of introducing a second leave-request concept.

## Navigation and roles

- Administrators manage holidays at `/admin/holidays` and review leave at
  `/admin/leaves`. The admin sidebar shows the pending leave count and links to
  the pending queue.
- Administrators assign active teaching assistants from the class management
  page. A teaching assistant can only cover tickets for classes where the
  account has an active assignment.
- Trainers use the top-level `/teacher/attendance` workspace and filter by
  class. The legacy class attendance URL redirects to this workspace.
- Students use the mirrored top-level `/student/attendance` workspace with the
  same class filter and month controls (read-only). The legacy class attendance
  URL redirects there, and the class tab row no longer has an Attendance tab.
- Students read applicable holidays and session warnings from their class
  Schedule page. Students never receive holiday or leave management controls.

## Holiday calendar

The admin holiday page supports year filtering and create, edit, and delete
actions for system-wide or class-scoped holidays. Trainer Attendance and
student Schedule render a compact month calendar containing the system and
class holidays applicable to the selected class.

Existing sessions expose `Holiday: holiday_name` when an administrator adds a
holiday after the session was materialised. Recurring session generation keeps
the existing AI-156 behavior and skips dates that are already holidays. The
calendar still identifies those dates even when no session card is generated.

## Trainer leave

The Attendance workspace contains `Request leave` and `My leave requests`.
Ticket Inbox no longer owns these actions. A request includes an inclusive date
range, one of the eleven supported reason codes, optional details, and an
optional teaching assistant assigned to the selected class. Details are
required for `Other Reason`; the request remains valid when the class has no
assistant or the trainer selects none.

The request history shows pending, approved, and rejected decisions, including
the administrator's rejection reason. The application polls for reviewed
requests while a trainer session is active and displays a one-time toast for
each new or changed decision.

## Admin review and ticket coverage

The admin leave queue shows the trainer, class, date range, reason details, and
selected assistant. Administrators can approve, reject, or change an existing
decision in either direction. Changing an approved request to rejected does not
reclaim tickets that have already moved.

During active approved leave, class tickets prefer the selected assistant.
Available trainers remain the fallback, and tickets wait in the admin queue
when no replacement is available. Assigned assistants can view and reply to
their class tickets but cannot access another class.

## Attendance behavior

The compact `I'm present` and `I'm off today` controls use confirmation dialogs
before updating availability. Marking off explains that tickets may be moved or
queued. Approved leave cannot be overridden by marking the trainer present.

Session cards display independent holiday and approved-leave warnings. If both
conditions apply, both warnings remain visible. Date fields in Attendance use
the `DD/MM/YYYY` display format while API payloads retain ISO `YYYY-MM-DD`.

Editable student attendance uses the two primary actions `Present` and
`Unexcused`. Historical API values remain readable and are not removed from the
backend contract.
