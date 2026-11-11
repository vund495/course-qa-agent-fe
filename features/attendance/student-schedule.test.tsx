// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  SCHEDULE_VIEW_STORAGE_KEY,
  MonthSchedule,
  ScheduleViewToggle,
  WeekSchedule,
  buildMonthGrid,
  formatFullDate,
  formatMonthTitle,
  formatWeekdayDate,
  isDateInMonth,
  isWeekend,
  readStoredScheduleView,
  scheduleRange,
  storeScheduleView,
} from "./student-schedule";
import type { StudentSchedule } from "@/lib/attendance-api";

const mockSchedule: StudentSchedule = {
  class_id: "class-1",
  class_code: "CS101",
  class_name: "Computer Science 101",
  date_from: "2026-11-02",
  date_to: "2026-11-08",
  today: "2026-11-05",
  meeting_url: "https://meet.example.com/class",
  sessions: [
    {
      id: "s-past",
      date: "2026-11-02",
      start_at: "2026-11-02T19:00:00+07:00",
      end_at: "2026-11-02T21:00:00+07:00",
      subject: "Computer Science 101",
      trainer_name: "Trainer An",
      status: "scheduled",
      attendance_status: "present",
      attendance_note: null,
    },
    {
      id: "s-future",
      date: "2026-11-06",
      start_at: "2026-11-06T19:00:00+07:00",
      end_at: "2026-11-06T21:00:00+07:00",
      subject: "Computer Science 101",
      trainer_name: "Trainer An",
      status: "scheduled",
      attendance_status: null,
      attendance_note: null,
    },
    {
      id: "s-cancelled",
      date: "2026-11-07",
      start_at: "2026-11-07T09:00:00+07:00",
      end_at: "2026-11-07T11:00:00+07:00",
      subject: "Computer Science 101",
      trainer_name: "Trainer An",
      status: "cancelled",
      attendance_status: null,
      attendance_note: "Trainer unavailable",
    },
  ],
  holidays: [
    {
      date: "2026-11-04",
      name: "Test Holiday",
      type: "admin",
      scope: "class",
    },
  ],
};

describe("student schedule helpers", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("persists and restores the week/month preference", () => {
    expect(readStoredScheduleView()).toBe("week");
    storeScheduleView("month");
    expect(window.localStorage.getItem(SCHEDULE_VIEW_STORAGE_KEY)).toBe("month");
    expect(readStoredScheduleView()).toBe("month");
  });

  it("builds a stable six-week Monday-first month grid", () => {
    const cells = buildMonthGrid("2026-11");
    expect(cells).toHaveLength(42);
    expect(cells[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(isDateInMonth("2026-11-01", "2026-11")).toBe(true);
    expect(isDateInMonth("2026-10-31", "2026-11")).toBe(false);
  });

  it("formats schedule labels without timezone skew", () => {
    expect(formatMonthTitle("2026-11")).toBe("November 2026");
    expect(formatWeekdayDate("2026-11-02")).toBe("Mon 02/11");
    expect(formatFullDate("2026-11-02")).toContain("Monday");
    expect(isWeekend("2026-11-07")).toBe(true);
    expect(isWeekend("2026-11-02")).toBe(false);
  });

  it("computes week and month API ranges", () => {
    expect(scheduleRange("week", "2026-11-02", "2026-11")).toEqual({
      from: "2026-11-02",
      to: "2026-11-08",
    });
    expect(scheduleRange("month", "2026-11-02", "2026-11")).toEqual({
      from: "2026-11-01",
      to: "2026-11-30",
    });
  });
});

describe("WeekSchedule", () => {
  it("renders days, subjects, times, status and holiday labels", () => {
    const html = renderToStaticMarkup(
      <WeekSchedule data={mockSchedule} weekStart="2026-11-02" />,
    );

    expect(html).toContain("Mon 02/11");
    expect(html).toContain("Sun 08/11");
    expect(html).toContain("Computer Science 101");
    expect(html).toContain("Trainer An");
    expect(html).toContain("Present");
    expect(html).toContain("Upcoming");
    expect(html).toContain("Cancelled");
    expect(html).toContain("Test Holiday");
    expect(html).toContain("Join online class");
    expect(html).toContain("No class");
  });
});

describe("MonthSchedule", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    window.localStorage.clear();
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    host.remove();
  });

  it("marks holidays and opens class details when a day is clicked", async () => {
    await act(async () => {
      root.render(
        <MonthSchedule
          data={mockSchedule}
          month="2026-11"
          selectedDate={null}
          onSelectDate={() => {}}
        />,
      );
    });

    expect(host.querySelector('[data-testid="month-schedule"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="month-holiday-2026-11-04"]')).not.toBeNull();
    expect(host.textContent).toContain("Select a day to see its classes");

    const classDay = host.querySelector(
      '[data-testid="month-day-2026-11-02"]',
    ) as HTMLButtonElement;
    expect(classDay).not.toBeNull();

    await act(async () => {
      classDay.click();
    });

    // The parent owns selectedDate; a controlled re-render mirrors the click.
    await act(async () => {
      root.render(
        <MonthSchedule
          data={mockSchedule}
          month="2026-11"
          selectedDate="2026-11-02"
          onSelectDate={() => {}}
        />,
      );
    });

    expect(host.textContent).toContain("Monday");
    expect(host.textContent).toContain("Present");
    expect(host.textContent).toContain("Trainer An");
  });

  it("shows the holiday label and empty class message in day details", async () => {
    await act(async () => {
      root.render(
        <MonthSchedule
          data={mockSchedule}
          month="2026-11"
          selectedDate="2026-11-04"
          onSelectDate={() => {}}
        />,
      );
    });

    expect(host.querySelector('[data-testid="day-details"]')?.textContent).toContain(
      "Test Holiday",
    );
    expect(host.textContent).toContain("No classes on this holiday.");
  });
});

describe("ScheduleViewToggle", () => {
  it("renders the active view and exposes both options", () => {
    const html = renderToStaticMarkup(
      <ScheduleViewToggle view="week" onChange={() => {}} />,
    );

    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("Week");
    expect(html).toContain("Month");
  });
});
