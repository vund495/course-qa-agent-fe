// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { handoverApi } from "@/lib/handover-api";
import { TrainerLeaveNotifications } from "./trainer-leave-notifications";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/handover-api", () => ({
  handoverApi: { listLeaves: vi.fn() },
  formatLeaveRange: () => "12/11/2026",
}));

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  window.localStorage.clear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  vi.mocked(handoverApi.listLeaves).mockResolvedValue([
    {
      id: "leave-1",
      trainer_id: "trainer-1",
      trainer_name: "Trainer One",
      date_from: "2026-11-12",
      date_to: "2026-11-12",
      class_id: "class-1",
      class_name: "Class A",
      reason_type: "annual_leave",
      reason_details: null,
      rejection_reason: null,
      target_trainer_id: null,
      target_trainer_name: null,
      reason: null,
      status: "accepted",
      responded_by: "admin-1",
      responded_at: "2026-11-12T03:00:00Z",
      created_at: "2026-11-11T03:00:00Z",
    },
  ]);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.clearAllMocks();
});

it("notifies the trainer when an administrator approves leave", async () => {
  await act(async () => {
    root.render(<TrainerLeaveNotifications enabled />);
  });

  expect(toast.success).toHaveBeenCalledWith(
    "Leave request approved",
    expect.objectContaining({ description: expect.stringContaining("Class A") }),
  );
});

it("does not notify the same reviewed decision twice", async () => {
  await act(async () => {
    root.render(<TrainerLeaveNotifications enabled />);
  });
  expect(toast.success).toHaveBeenCalledTimes(1);

  await act(async () => {
    window.dispatchEvent(new Event("focus"));
  });
  expect(toast.success).toHaveBeenCalledTimes(1);
});

it("shows the administrator reason when leave is rejected", async () => {
  vi.mocked(handoverApi.listLeaves).mockResolvedValueOnce([
    {
      id: "leave-2",
      trainer_id: "trainer-1",
      trainer_name: "Trainer One",
      class_id: "class-1",
      class_name: "Class A",
      date_from: "2026-11-12",
      date_to: "2026-11-12",
      reason_type: "annual_leave",
      reason_details: null,
      rejection_reason: "Coverage is unavailable",
      target_trainer_id: null,
      target_trainer_name: null,
      reason: null,
      status: "rejected",
      responded_by: "admin-1",
      responded_at: "2026-11-12T04:00:00Z",
      created_at: "2026-11-11T03:00:00Z",
    },
  ]);

  await act(async () => {
    root.render(<TrainerLeaveNotifications enabled />);
  });

  expect(toast.error).toHaveBeenCalledWith(
    "Leave request rejected",
    expect.objectContaining({
      description: expect.stringContaining("Coverage is unavailable"),
    }),
  );
});
