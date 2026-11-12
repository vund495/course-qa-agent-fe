// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import AdminHolidaysPage from "./page";
import { holidayApi } from "@/lib/holiday-api";
vi.mock("@/lib/holiday-api", () => ({
  holidayApi: {
    list: vi
      .fn()
      .mockResolvedValue([
        {
          id: "holiday-1",
          date: "2026-11-20",
          name: "Teacher Day",
          scope: "system",
          type: "admin",
          class_id: null,
        },
      ]),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    remove: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("@/lib/admin-api", () => ({
  adminApi: {
    classes: vi.fn().mockResolvedValue([{ id: "class-1", code: "PY101" }]),
  },
}));
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  vi.clearAllMocks();
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
const click = async (label: string) =>
  act(async () => {
    const button = [...document.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === label,
    );
    expect(button, label).toBeTruthy();
    button!.click();
  });
const change = async (label: string, value: string) =>
  act(async () => {
    const input = document.querySelector<HTMLInputElement>(
      `input[aria-label="${label}"]`,
    )!;
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
it("filters by year, creates, edits and confirms deletion", async () => {
  await act(async () => root.render(<AdminHolidaysPage />));
  expect(host.textContent).toContain("Teacher Day");
  await change("Holiday year", "2027");
  expect(holidayApi.list).toHaveBeenLastCalledWith(2027);
  await click("Add holiday");
  await change("Holiday name", "School break");
  await change("Holiday date", "2027-01-05");
  await act(async () =>
    document
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(holidayApi.create).toHaveBeenCalledWith(
    expect.objectContaining({
      date: "2027-01-05",
      name: "School break",
      scope: "system",
      class_id: null,
    }),
  );
  await click("Edit");
  await change("Holiday name", "Updated holiday");
  await act(async () =>
    document
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(holidayApi.update).toHaveBeenCalledWith(
    "holiday-1",
    expect.objectContaining({ name: "Updated holiday" }),
  );
  await click("Delete");
  expect(holidayApi.remove).not.toHaveBeenCalled();
  await click("Delete holiday");
  expect(holidayApi.remove).toHaveBeenCalledWith("holiday-1");
});
