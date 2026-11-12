// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { attendanceApi } from "@/lib/attendance-api";
import { AttendanceScheduleManager } from "./attendance-schedule-manager";

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  if (!Element.prototype.animate) {
    Element.prototype.animate = () => ({
      finished: Promise.resolve(),
      cancel: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    }) as unknown as Animation;
  }
  vi.spyOn(attendanceApi, "listSchedules").mockResolvedValue([]);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

it("uses the shared weekday dropdown and keeps the optional end-date guidance", async () => {
  await act(async () => {
    root.render(
      <AttendanceScheduleManager isOpen onClose={vi.fn()} classId="class-1" />,
    );
  });

  const addWeekly = Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent?.includes("Add Weekly"),
  );
  await act(async () => addWeekly?.click());

  expect(document.querySelector('[role="combobox"][aria-label="Weekday"]')).not.toBeNull();
  expect(document.querySelector<HTMLInputElement>('#schedule-effective-from')?.className).toContain("rounded-md");
  expect(document.querySelector<HTMLInputElement>('#schedule-start-time')?.className).toContain("rounded-md");
  expect(document.body.textContent).toContain("Optional");
  expect(document.body.textContent).toContain("Leave blank to keep this schedule ongoing.");
});
