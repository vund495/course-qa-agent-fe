// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import AdminLeavesPage from "./page";
import { handoverApi, LEAVE_REASONS } from "@/lib/handover-api";
const request = vi.hoisted(
  (): import("@/lib/handover-api").LeaveRequest => ({
    id: "leave-1",
    trainer_id: "trainer-1",
    trainer_name: "Trainer One",
    class_id: "class-1",
    class_name: "Python Fundamentals",
    date_from: "2026-11-12",
    date_to: "2026-11-13",
    reason_type: "sick_leave",
    reason_details: "Medical appointment",
    rejection_reason: null,
    target_trainer_id: "trainer-2",
    target_trainer_name: "Assigned Assistant",
    reason: null,
    status: "pending",
    responded_by: null,
    responded_at: null,
    created_at: "2026-11-11T00:00:00Z",
  }),
);
vi.mock("@/lib/handover-api", async (original) => {
  const actual = await original<typeof import("@/lib/handover-api")>();
  return {
    ...actual,
    handoverApi: {
      ...actual.handoverApi,
      listAdminLeaves: vi.fn().mockResolvedValue([request]),
      reviewLeave: vi.fn().mockResolvedValue({}),
    },
  };
});
let root: Root;
let host: HTMLDivElement;
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
const click = async (text: string) =>
  act(async () => {
    const button = [...document.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === text,
    );
    expect(button).toBeTruthy();
    button!.click();
  });
it("shows pending review context, all reason labels, approves and rejects with reason", async () => {
  await act(async () => root.render(<AdminLeavesPage />));
  expect(handoverApi.listAdminLeaves).toHaveBeenCalledWith("pending");
  for (const value of [
    "Python Fundamentals",
    "Trainer One",
    "Medical appointment",
    "Assigned Assistant",
    "Sick / Medical Leave",
  ])
    expect(host.textContent).toContain(value);
  expect(Object.keys(LEAVE_REASONS)).toHaveLength(11);
  await click("Approve");
  await click("Approve leave");
  expect(handoverApi.reviewLeave).toHaveBeenCalledWith(
    "leave-1",
    true,
    undefined,
  );
  await click("Reject");
  const input = document.querySelector<HTMLTextAreaElement>(
    'textarea[aria-label="Rejection reason"]',
  )!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )!.set!.call(input, "Please revise dates");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click("Reject leave");
  expect(handoverApi.reviewLeave).toHaveBeenCalledWith(
    "leave-1",
    false,
    "Please revise dates",
  );
  const filter = host.querySelector<HTMLSelectElement>(
    'select[aria-label="Request status"]',
  )!;
  await act(async () => {
    filter.value = "all";
    filter.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(handoverApi.listAdminLeaves).toHaveBeenLastCalledWith(undefined);
});

it("allows an admin to change a completed leave decision", async () => {
  vi.mocked(handoverApi.listAdminLeaves).mockResolvedValueOnce([
    { ...request, status: "accepted" },
  ]);
  await act(async () => root.render(<AdminLeavesPage />));

  await click("Change decision");
  expect(document.body.textContent).toContain(
    "Tickets already transferred stay with their current owner.",
  );
  await click("Change to rejected");
  expect(handoverApi.reviewLeave).toHaveBeenCalledWith(
    "leave-1",
    false,
    undefined,
  );
});

it("allows an admin to approve a previously rejected leave", async () => {
  vi.mocked(handoverApi.listAdminLeaves).mockResolvedValueOnce([
    { ...request, status: "rejected" },
  ]);
  await act(async () => root.render(<AdminLeavesPage />));

  await click("Change decision");
  expect(document.body.textContent).toContain(
    "Change decision to approved?",
  );
  await click("Change to approved");
  expect(handoverApi.reviewLeave).toHaveBeenCalledWith(
    "leave-1",
    true,
    undefined,
  );
});
