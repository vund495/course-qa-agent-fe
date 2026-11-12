// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AdminLeaveNav } from "./admin-leave-nav";
import { ClassAssistantManager } from "./class-assistant-manager";
import { handoverApi } from "@/lib/handover-api";
vi.mock("@/lib/handover-api", async (original) => {
  const actual = await original<typeof import("@/lib/handover-api")>();
  return {
    ...actual,
    handoverApi: {
      ...actual.handoverApi,
      listAdminLeaves: vi.fn().mockResolvedValue([{ id: "pending-1" }]),
      listClassAssistants: vi
        .fn()
        .mockResolvedValue([
          {
            id: "assigned",
            name: "Assigned TA",
            email: "assigned@example.com",
          },
        ]),
      addClassAssistant: vi.fn().mockResolvedValue([]),
      removeClassAssistant: vi.fn().mockResolvedValue(undefined),
    },
  };
});
vi.mock("@/lib/admin-api", () => ({
  adminApi: {
    users: vi.fn().mockResolvedValue([
      {
        id: "assigned",
        role: "teaching_assistant",
        username: "Assigned TA",
        is_active: true,
      },
      {
        id: "available",
        role: "teaching_assistant",
        username: "Available TA",
        email: "available@example.com",
        is_active: true,
      },
      { id: "trainer", role: "trainer", username: "Trainer", is_active: true },
      {
        id: "inactive",
        role: "teaching_assistant",
        username: "Inactive TA",
        is_active: false,
      },
    ]),
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
it("links pending notification to review and refreshes after a decision", async () => {
  await act(async () => root.render(<AdminLeaveNav />));
  expect(host.querySelector("a")?.getAttribute("href")).toBe("/admin/leaves");
  expect(host.querySelector("a span.ml-auto")?.className).toContain("border-amber-300");
  expect(host.querySelector("a span.ml-auto")?.className).toContain("tabular-nums");
  expect(host.querySelector("a")?.getAttribute("aria-label")).toBe(
    "Leave requests (1 pending)",
  );
  vi.mocked(handoverApi.listAdminLeaves).mockResolvedValueOnce([]);
  await act(async () =>
    window.dispatchEvent(new Event("admin-leaves-changed")),
  );
  expect(host.querySelector("a")?.getAttribute("aria-label")).toBe(
    "Leave requests (0 pending)",
  );
});
it("manages only active assistant assignments for the selected class", async () => {
  await act(async () =>
    root.render(<ClassAssistantManager classId="class-1" />),
  );
  expect(handoverApi.listClassAssistants).toHaveBeenCalledWith("class-1");
  const select = host.querySelector("select")!;
  expect([...select.options].map((option) => option.value)).toEqual([
    "",
    "available",
  ]);
  await act(async () => {
    select.value = "available";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(async () =>
    [...host.querySelectorAll("button")]
      .find((b) => b.textContent === "Assign")!
      .click(),
  );
  expect(handoverApi.addClassAssistant).toHaveBeenCalledWith(
    "class-1",
    "available",
  );
  await act(async () =>
    host
      .querySelector<HTMLButtonElement>(
        'button[aria-label="Remove assistant Assigned TA"]',
      )!
      .click(),
  );
  expect(handoverApi.removeClassAssistant).toHaveBeenCalledWith(
    "class-1",
    "assigned",
  );
});
