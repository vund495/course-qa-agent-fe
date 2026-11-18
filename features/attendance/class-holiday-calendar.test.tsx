// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { holidayApi } from "@/lib/holiday-api";
import { ClassHolidayCalendar } from "./class-holiday-calendar";

vi.mock("@/lib/holiday-api", () => ({
  holidayApi: {
    listClass: vi.fn(),
  },
}));

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  vi.mocked(holidayApi.listClass).mockResolvedValue([
    {
      id: "holiday-jan",
      date: "2026-01-01",
      name: "New Year's Day",
      type: "admin",
      scope: "system",
      class_id: null,
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "holiday-1",
      date: "2026-11-20",
      name: "Vietnamese Teachers' Day",
      type: "admin",
      scope: "class",
      class_id: "class-1",
      created_at: "2026-01-01T00:00:00Z",
    },
  ]);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.clearAllMocks();
});

it("shows holidays for one selected month with DD/MM/YYYY dates", async () => {
  await act(async () => {
    root.render(
      <ClassHolidayCalendar
        classId="class-1"
        initialDate={new Date(2026, 10, 12)}
      />,
    );
  });

  expect(host.textContent).toContain("Holiday calendar");
  expect(host.textContent).toContain("November 2026");
  expect(host.textContent).toContain("Vietnamese Teachers' Day");
  expect(host.textContent).toContain("20/11/2026");
  expect(host.textContent).toContain("Class holiday");
  expect(host.textContent).not.toContain("Public holiday");

  await act(async () => {
    host.querySelector<HTMLButtonElement>('button[aria-label="Next month"]')?.click();
  });
  expect(host.textContent).toContain("December 2026");
  expect(host.textContent).toContain("No holidays this month");
  expect(host.textContent).not.toContain("Vietnamese Teachers' Day");
});
