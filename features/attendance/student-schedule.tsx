"use client";

import * as React from "react";
import {
  CalendarDays,
  CalendarOff,
  Clock,
  ExternalLink,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  StudentSchedule,
  StudentScheduleHoliday,
  StudentScheduleSession,
} from "@/lib/attendance-api";
import {
  AttendanceStatusChip,
  formatDisplayDate,
  formatTimeRange,
  getMonthRange,
} from "./student-attendance-history";
import {
  formatLocalDate,
  getMonday,
  getSunday,
  parseLocalDate,
} from "./attendance-week-picker";

export const SCHEDULE_VIEW_STORAGE_KEY = "student-class-schedule-view";
export type ScheduleView = "week" | "month";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function readStoredScheduleView(): ScheduleView {
  if (typeof window === "undefined") return "week";
  try {
    return window.localStorage.getItem(SCHEDULE_VIEW_STORAGE_KEY) === "month"
      ? "month"
      : "week";
  } catch {
    return "week";
  }
}

export function storeScheduleView(view: ScheduleView): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SCHEDULE_VIEW_STORAGE_KEY, view);
  } catch {
    // Private mode or a disabled storage API must not break the schedule.
  }
}

export function formatMonthKey(dateIso: string): string {
  return dateIso.slice(0, 7);
}

export function formatMonthTitle(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) return month;
  return new Date(year, monthNumber - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function formatWeekdayDate(dateIso: string): string {
  const date = parseLocalDate(dateIso);
  const weekday = WEEKDAY_LABELS[(date.getDay() + 6) % 7];
  return `${weekday} ${dateIso.slice(8, 10)}/${dateIso.slice(5, 7)}`;
}

export function formatFullDate(dateIso: string): string {
  const date = parseLocalDate(dateIso);
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/**
 * Build a stable six-week Monday-first grid. Keeping 42 cells means the month
 * grid never jumps in height when the first weekday or month length changes.
 */
export function buildMonthGrid(month: string): string[] {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) return [];

  const first = new Date(year, monthNumber - 1, 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(year, monthNumber - 1, 1 - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return formatLocalDate(day);
  });
}

export function isDateInMonth(dateIso: string, month: string): boolean {
  return dateIso.startsWith(`${month}-`);
}

export function isWeekend(dateIso: string): boolean {
  const weekday = parseLocalDate(dateIso).getDay();
  return weekday === 0 || weekday === 6;
}

function groupSessionsByDate(
  sessions: StudentScheduleSession[],
): Map<string, StudentScheduleSession[]> {
  const result = new Map<string, StudentScheduleSession[]>();
  for (const session of sessions) {
    const list = result.get(session.date) ?? [];
    list.push(session);
    result.set(session.date, list);
  }
  return result;
}

function groupHolidaysByDate(
  holidays: StudentScheduleHoliday[],
): Map<string, StudentScheduleHoliday> {
  return new Map(holidays.map((holiday) => [holiday.date, holiday]));
}

function weekDates(weekStart: string): string[] {
  const start = parseLocalDate(weekStart);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return formatLocalDate(day);
  });
}

function SessionAttendanceBadge({
  session,
  today,
}: {
  session: StudentScheduleSession;
  today: string;
}) {
  if (session.status === "cancelled") {
    return (
      <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
        Cancelled
      </span>
    );
  }
  if (session.status === "rescheduled") {
    return (
      <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-semibold text-foreground">
        Rescheduled
      </span>
    );
  }
  if (session.date > today) {
    return (
      <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
        Upcoming
      </span>
    );
  }
  return <AttendanceStatusChip status={session.attendance_status} />;
}

function SessionCard({
  session,
  today,
  compact = false,
  meetingUrl,
}: {
  session: StudentScheduleSession;
  today: string;
  compact?: boolean;
  meetingUrl: string | null;
}) {
  return (
    <article
      data-testid={`schedule-session-${session.id}`}
      className={cn(
        "rounded-lg border border-[#E5E5E5] bg-white p-2.5 text-left shadow-2xs",
        session.status === "cancelled" && "border-rose-200 bg-rose-50/40",
        session.status === "rescheduled" && "border-border bg-muted/40",
        compact && "p-2",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-1.5">
        <div className="min-w-0">
          <p
            className={cn(
              "truncate font-semibold text-[#111111]",
              compact ? "text-[11px]" : "text-xs",
            )}
            title={session.subject}
          >
            {session.subject}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-[#5A5A5A]">
            <Clock className="size-3 shrink-0" />
            {formatTimeRange(session.start_at, session.end_at)}
          </p>
        </div>
        <SessionAttendanceBadge session={session} today={today} />
      </div>

      {session.trainer_name && (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-[#5A5A5A]">
          <User className="size-3 shrink-0" />
          {session.trainer_name}
        </p>
      )}

      {session.attendance_note && (
        <p className="mt-1.5 text-[11px] text-[#5A5A5A]">{session.attendance_note}</p>
      )}

      {meetingUrl && session.status !== "cancelled" && (
        <a
          href={meetingUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:underline"
        >
          <ExternalLink className="size-3" />
          Join online class
        </a>
      )}
    </article>
  );
}

function HolidayLabel({ holiday, compact = false }: { holiday: StudentScheduleHoliday; compact?: boolean }) {
  return (
    <p
      data-testid={`holiday-${holiday.date}`}
      className={cn(
        "flex items-start gap-1 rounded-md bg-muted px-1.5 py-1 font-medium text-foreground",
        compact ? "text-[10px] leading-[1.15]" : "text-[11px]",
      )}
      title={`${holiday.name} (${holiday.scope === "class" ? "class holiday" : "public holiday"})`}
    >
      <CalendarOff className="mt-0.5 size-3 shrink-0" />
      <span>{holiday.name}</span>
    </p>
  );
}

export function WeekSchedule({
  data,
  weekStart,
}: {
  data: StudentSchedule;
  weekStart: string;
}) {
  const sessionsByDate = React.useMemo(
    () => groupSessionsByDate(data.sessions),
    [data.sessions],
  );
  const holidaysByDate = React.useMemo(
    () => groupHolidaysByDate(data.holidays),
    [data.holidays],
  );
  const dates = weekDates(weekStart);

  return (
    <div data-testid="week-schedule">
      {/* Desktop: seven parallel day columns. */}
      <div className="hidden gap-2 md:grid md:grid-cols-7">
        {dates.map((date) => {
          const holiday = holidaysByDate.get(date);
          const sessions = sessionsByDate.get(date) ?? [];
          const isToday = date === data.today;

          return (
            <section
              key={date}
              data-testid={`week-day-${date}`}
              className={cn(
                "min-h-[190px] rounded-xl border bg-white p-2",
                holiday
                  ? "border-border bg-muted/60"
                  : isToday
                    ? "border-[#111111]"
                    : "border-[#E5E5E5]",
              )}
            >
              <header className="mb-2 border-b border-[#F0F0F0] pb-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5A5A5A]">
                  {formatWeekdayDate(date)}
                </p>
                {isToday && (
                  <span className="mt-1 inline-flex rounded bg-[#111111] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                    Today
                  </span>
                )}
              </header>

              {holiday && <HolidayLabel holiday={holiday} compact />}

              <div className="mt-1.5 space-y-1.5">
                {sessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    today={data.today}
                    compact
                    meetingUrl={data.meeting_url}
                  />
                ))}
                {sessions.length === 0 && !holiday && (
                  <p className="px-1 py-2 text-[10px] text-[#9A9A9A]">No class</p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* Mobile: a vertical day list is more readable than seven squeezed columns. */}
      <div className="space-y-2 md:hidden">
        {dates.map((date) => {
          const holiday = holidaysByDate.get(date);
          const sessions = sessionsByDate.get(date) ?? [];
          const isToday = date === data.today;

          return (
            <section
              key={date}
              data-testid={`week-mobile-day-${date}`}
              className={cn(
                "rounded-xl border bg-white p-3",
                holiday
                  ? "border-border bg-muted/60"
                  : isToday
                    ? "border-[#111111]"
                    : "border-[#E5E5E5]",
                isWeekend(date) && !holiday && "bg-[#FAFAFA]",
              )}
            >
              <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-[#111111]">
                  {formatWeekdayDate(date)}
                </p>
                {isToday && (
                  <span className="rounded bg-[#111111] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                    Today
                  </span>
                )}
              </header>

              {holiday && <HolidayLabel holiday={holiday} />}

              <div className="mt-1.5 space-y-1.5">
                {sessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    today={data.today}
                    meetingUrl={data.meeting_url}
                  />
                ))}
                {sessions.length === 0 && !holiday && (
                  <p className="text-[11px] text-[#9A9A9A]">No class scheduled.</p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export function MonthSchedule({
  data,
  month,
  selectedDate,
  onSelectDate,
}: {
  data: StudentSchedule;
  month: string;
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}) {
  const cells = React.useMemo(() => buildMonthGrid(month), [month]);
  const sessionsByDate = React.useMemo(
    () => groupSessionsByDate(data.sessions),
    [data.sessions],
  );
  const holidaysByDate = React.useMemo(
    () => groupHolidaysByDate(data.holidays),
    [data.holidays],
  );

  const selectedHoliday = selectedDate ? holidaysByDate.get(selectedDate) : undefined;
  const selectedSessions = selectedDate ? sessionsByDate.get(selectedDate) ?? [] : [];

  return (
    <div data-testid="month-schedule" className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-[#E5E5E5] bg-white">
        <div className="grid grid-cols-7 border-b border-[#E5E5E5] bg-[#FAFAFA]">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="px-1 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-[#5A5A5A] sm:text-[11px]"
            >
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((date) => {
            const inMonth = isDateInMonth(date, month);
            const holiday = holidaysByDate.get(date);
            const sessions = sessionsByDate.get(date) ?? [];
            const selected = selectedDate === date;
            const isToday = date === data.today;

            return (
              <button
                key={date}
                type="button"
                data-testid={`month-day-${date}`}
                aria-label={`${formatFullDate(date)}${holiday ? `, ${holiday.name}` : ""}${
                  sessions.length ? `, ${sessions.length} class${sessions.length === 1 ? "" : "es"}` : ""
                }`}
                aria-pressed={selected}
                onClick={() => onSelectDate(date)}
                className={cn(
                  "relative min-h-[62px] border-b border-r border-[#F0F0F0] p-1 text-left transition-colors last:border-r-0 sm:min-h-[88px] sm:p-1.5",
                  inMonth ? "bg-white hover:bg-[#FAFAFA]" : "bg-[#FAFAFA] text-[#B0B0B0]",
                  holiday && inMonth && "bg-muted hover:bg-muted/80",
                  isWeekend(date) && inMonth && !holiday && "bg-[#FCFCFC]",
                  selected && "z-10 ring-2 ring-inset ring-[#111111]",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold sm:h-6 sm:min-w-6 sm:text-xs",
                    isToday
                      ? "bg-[#111111] text-white"
                      : inMonth
                        ? "text-[#111111]"
                        : "text-[#B0B0B0]",
                  )}
                >
                  {date.slice(8, 10)}
                </span>

                {holiday && inMonth && (
                  <span
                    data-testid={`month-holiday-${date}`}
                    className="mt-0.5 line-clamp-2 block text-[8px] font-medium leading-[1.15] text-muted-foreground sm:text-[9px]"
                    title={holiday.name}
                  >
                    {holiday.name}
                  </span>
                )}

                {sessions.length > 0 && inMonth && (
                  <span className="mt-1 flex flex-wrap items-center gap-0.5">
                    {sessions.slice(0, 3).map((session) => (
                      <span
                        key={session.id}
                        className={cn(
                          "size-1.5 rounded-full sm:size-2",
                          session.status === "cancelled"
                            ? "bg-rose-500"
                            : session.status === "rescheduled"
                              ? "bg-amber-500"
                              : session.date > data.today
                                ? "bg-blue-500"
                                : "bg-emerald-600",
                        )}
                      />
                    ))}
                    {sessions.length > 3 && (
                      <span className="text-[8px] font-semibold text-[#5A5A5A] sm:text-[9px]">
                        +{sessions.length - 3}
                      </span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <section
        data-testid="day-details"
        className="rounded-xl border border-[#E5E5E5] bg-white p-4"
      >
        {!selectedDate ? (
          <p className="flex items-center gap-2 text-xs text-[#5A5A5A]">
            <CalendarDays className="size-4" />
            Select a day to see its classes and attendance status.
          </p>
        ) : (
          <div className="space-y-3">
            <header className="flex flex-wrap items-start justify-between gap-2 border-b border-[#F0F0F0] pb-2">
              <div>
                <h3 className="text-[14px] font-bold text-[#111111]">
                  {formatFullDate(selectedDate)}
                </h3>
                <p className="mt-0.5 text-[11px] text-[#5A5A5A]">
                  {formatDisplayDate(selectedDate)}
                </p>
              </div>
              {selectedHoliday && <HolidayLabel holiday={selectedHoliday} />}
            </header>

            {selectedSessions.length === 0 ? (
              <p className="text-xs text-[#5A5A5A]">
                {selectedHoliday ? "No classes on this holiday." : "No classes scheduled."}
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {selectedSessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    today={data.today}
                    meetingUrl={data.meeting_url}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export function ScheduleViewToggle({
  view,
  onChange,
}: {
  view: ScheduleView;
  onChange: (view: ScheduleView) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Schedule view"
      className="inline-flex rounded-lg border border-[#DADADA] bg-white p-0.5"
    >
      {(["week", "month"] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={view === option}
          data-testid={`schedule-view-${option}`}
          onClick={() => onChange(option)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
            view === option
              ? "bg-[#111111] text-white"
              : "text-[#5A5A5A] hover:bg-[#F5F5F5]",
          )}
        >
          {option === "week" ? "Week" : "Month"}
        </button>
      ))}
    </div>
  );
}

/** Pure helper used by the page's navigation buttons. */
export function scheduleRange(
  view: ScheduleView,
  weekStart: string,
  month: string,
): { from: string; to: string } {
  if (view === "week") {
    return { from: weekStart, to: getSunday(weekStart) };
  }
  return getMonthRange(month);
}

/** Pure helper used by the page when the view or the anchor date changes. */
export function nextWeekStart(anchor: string): string {
  return getMonday(anchor);
}

/** Pure helper used by the page's "Today" action. */
export function todayMonth(today: string): string {
  return formatMonthKey(today);
}


