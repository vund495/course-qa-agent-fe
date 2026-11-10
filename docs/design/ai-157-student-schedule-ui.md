# AI-157 - Student Weekly & Monthly Schedule UI

> **Ticket:** [AI-157](https://ai03.atlassian.net/browse/AI-157) (Epic AI-145: Class Schedule & Attendance)
> **Status:** Implemented
> **Target Branch:** `features/Implementation_StudentSchedule`
> **Backend contract:** `GET /api/student/classes/{class_id}/schedule?from=&to=`
> **Related:** AI-136 (student attendance history), AI-156 (holiday labels)

---

## 1. What students get

A new class-workspace tab, **Schedule**, at:

```text
/student/class/[id]/schedule
```

The page has two views over the same API payload:

* **Week** - seven days (Monday-Sunday), previous/next week, today marker,
  holiday labels, and each session's subject, time, trainer, online link, and
  attendance status.
* **Month** - a Monday-first six-week grid. Class days show coloured dots,
  holidays get an amber cell and label, clicking any day opens a detail panel
  with that day's sessions and attendance status.

The existing **Attendance** tab is unchanged; it remains the historical rate and
session table.

---

## 2. Files

| File | Change |
|---|---|
| `app/(shell)/student/class/[id]/schedule/page.tsx` | New page: fetch, view state, range navigation, loading/error states. |
| `features/attendance/student-schedule.tsx` | Week view, month grid, day details, status badges, view toggle, date helpers. |
| `app/(shell)/student/class/[id]/layout.tsx` | Adds the **Schedule** tab before **Attendance**. |
| `lib/attendance-api.ts` | Adds `StudentSchedule*` types and `attendanceApi.mySchedule`. |
| `lib/attendance-api.test.ts` | Verifies the student schedule URL and query params. |
| `features/attendance/student-schedule.test.tsx` | Helper, week render, month interaction, holiday and toggle tests. |
| `app/(shell)/student/class/[id]/schedule/page.test.tsx` | Week load, month toggle + persistence, restore preference, retry. |

---

## 3. View preference (AC-03)

`localStorage["student-class-schedule-view"]` stores `"week"` or `"month"`.

The page starts in week mode for hydration safety and restores the preference
inside the first mount effect. The toggle writes immediately, so the next visit
opens in the same view.

Switching views keeps a sensible anchor:

* Week -> Month uses the current week's month.
* Month -> Week uses the selected day, today, or the first of the month.

---

## 4. Status labels

| Backend state | UI |
|---|---|
| `status = cancelled` | Red **Cancelled** badge |
| `status = rescheduled` | Amber **Rescheduled** badge |
| `date > today` | Blue **Upcoming** badge |
| Past and marked | Reuses the AI-136 **Present / Late / Excused / Unexcused** chip |
| Past and unmarked | Grey **Not marked** chip |

Using the server-provided `today` prevents a wrong browser timezone from
labeling tomorrow's class as unmarked.

---

## 5. Mobile behaviour (AC-04)

* **Week:** seven-column layout at `md` and above; below `md`, the same seven
  days render as a vertical list so subject names and status chips stay legible.
* **Month:** the calendar remains a compact seven-column grid (day numbers,
  holiday names, class dots). Day details open below the grid instead of in a
  cramped popover.
* Toolbar wraps to two rows on narrow screens; navigation buttons stay 36px+
  touch targets.

---

## 6. Verification

```powershell
npm test -- --run lib/attendance-api.test.ts features/attendance/student-schedule.test.tsx "app/(shell)/student/class/[id]/schedule/page.test.tsx"
npm run lint
npm run build
```
