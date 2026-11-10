// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StudentSchedulePage from "./page";
import { attendanceApi, type StudentSchedule } from "@/lib/attendance-api";
import {
  SCHEDULE_VIEW_STORAGE_KEY,
  formatMonthTitle,
} from "@/features/attendance/student-schedule";
import {
  getMonday,
  getSunday,
} from "@/features/attendance/attendance-week-picker";
import { getMonthRange } from "@/features/attendance/student-attendance-history";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "class-schedule-1" }),
}));

function makeSchedule(): StudentSchedule {
  const weekStart = getMonday();
  return {
    class_id: "class-schedule-1",
    class_code: "CS101",
    class_name: "Computer Science 101",
    date_from: weekStart,
    date_to: getSunday(weekStart),
    today: weekStart,
    meeting_url: "https://meet.example.com/class",
    sessions: [
      {
        id: "session-1",
        date: weekStart,
        start_at: `${weekStart}T19:00:00+07:00`,
        end_at: `${weekStart}T21:00:00+07:00`,
        subject: "Computer Science 101",
        trainer_name: "Trainer An",
        status: "scheduled",
        attendance_status: "present",
        attendance_note: null,
      },
    ],
    holidays: [],
  };
}

describe("StudentSchedulePage", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    if (!Element.prototype.animate) {
      Element.prototype.animate = () =>
        ({
          finished: Promise.resolve(),
          cancel: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as Animation;
    }
    window.localStorage.clear();
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    host.remove();
  });

  it("loads the current week schedule and renders class details", async () => {
    const spy = vi.spyOn(attendanceApi, "mySchedule").mockResolvedValue(makeSchedule());

    await act(async () => {
      root.render(<StudentSchedulePage />);
    });

    const weekStart = getMonday();
    expect(spy).toHaveBeenCalledWith(
      "class-schedule-1",
      weekStart,
      getSunday(weekStart),
    );
    expect(host.textContent).toContain("My Schedule");
    expect(host.textContent).toContain("Computer Science 101");
    expect(host.textContent).toContain("Trainer An");
    expect(host.textContent).toContain("Present");
    expect(host.querySelector('[data-testid="week-schedule"]')).not.toBeNull();
  });

  it("toggles to month view, persists the preference and opens day details", async () => {
    const spy = vi.spyOn(attendanceApi, "mySchedule").mockResolvedValue(makeSchedule());

    await act(async () => {
      root.render(<StudentSchedulePage />);
    });

    const monthButton = host.querySelector(
      '[data-testid="schedule-view-month"]',
    ) as HTMLButtonElement;
    expect(monthButton).not.toBeNull();

    await act(async () => {
      monthButton.click();
    });

    const month = getMonday().slice(0, 7);
    const range = getMonthRange(month);
    expect(spy).toHaveBeenLastCalledWith("class-schedule-1", range.from, range.to);
    expect(window.localStorage.getItem(SCHEDULE_VIEW_STORAGE_KEY)).toBe("month");
    expect(host.textContent).toContain(formatMonthTitle(month));
    expect(host.querySelector('[data-testid="month-schedule"]')).not.toBeNull();

    const dayButton = host.querySelector(
      `[data-testid="month-day-${getMonday()}"]`,
    ) as HTMLButtonElement;
    expect(dayButton).not.toBeNull();

    await act(async () => {
      dayButton.click();
    });

    expect(host.querySelector('[data-testid="day-details"]')?.textContent).toContain(
      "Computer Science 101",
    );
  });

  it("restores a stored month preference on mount", async () => {
    window.localStorage.setItem(SCHEDULE_VIEW_STORAGE_KEY, "month");
    const spy = vi.spyOn(attendanceApi, "mySchedule").mockResolvedValue(makeSchedule());

    await act(async () => {
      root.render(<StudentSchedulePage />);
    });

    const month = getMonday().slice(0, 7);
    const range = getMonthRange(month);
    expect(spy).toHaveBeenCalledWith("class-schedule-1", range.from, range.to);
    expect(host.querySelector('[data-testid="month-schedule"]')).not.toBeNull();
    expect(
      host
        .querySelector('[data-testid="schedule-view-month"]')
        ?.getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("shows an error and retries the request", async () => {
    const spy = vi
      .spyOn(attendanceApi, "mySchedule")
      .mockRejectedValueOnce(new Error("Network down"))
      .mockResolvedValueOnce(makeSchedule());

    await act(async () => {
      root.render(<StudentSchedulePage />);
    });

    expect(host.querySelector('[data-testid="schedule-error-state"]')).not.toBeNull();
    expect(host.textContent).toContain("Network down");

    const retry = Array.from(host.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Retry"),
    );
    expect(retry).toBeDefined();

    await act(async () => {
      retry?.click();
    });

    expect(spy).toHaveBeenCalledTimes(2);
    expect(host.querySelector('[data-testid="week-schedule"]')).not.toBeNull();
  });
});
