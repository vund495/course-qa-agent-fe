// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { AssignTicketModal } from "./assign-ticket-modal";
import { handoverApi, type AdminQueueItem } from "@/lib/handover-api";
import type { AppSelectOption } from "@/components/ui/app-select";
vi.mock("@/components/ui/app-select", () => ({
  AppSelect: ({
    options,
    value,
    onValueChange,
  }: {
    options: AppSelectOption[];
    value: string;
    onValueChange: (value: string) => void;
  }) => (
    <select
      aria-label="Ticket recipient"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
    >
      <option value="">Choose recipient</option>
      {options.map((option) => (
        <option
          key={option.value}
          value={option.value}
          disabled={option.disabled}
        >
          {option.label}
        </option>
      ))}
    </select>
  ),
}));
vi.mock("@/lib/handover-api", async (original) => {
  const actual = await original<typeof import("@/lib/handover-api")>();
  return {
    ...actual,
    handoverApi: {
      ...actual.handoverApi,
      listClassStatus: vi.fn().mockResolvedValue([
        {
          trainer_id: "owner",
          trainer_name: "Current Owner",
          status: "present",
        },
        {
          trainer_id: "trainer-off",
          trainer_name: "Absent Trainer",
          status: "off",
        },
        {
          trainer_id: "trainer-present",
          trainer_name: "Available Trainer",
          status: "present",
        },
      ]),
      listClassAssistants: vi
        .fn()
        .mockResolvedValue([
          {
            id: "assistant-1",
            name: "Assigned Assistant",
            email: "ta@example.com",
          },
        ]),
      assignTicket: vi.fn().mockResolvedValue({}),
    },
  };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const item = {
  id: "ticket-1",
  class_id: "class-1",
  class_code: "PY101",
  student_name: "Student",
  question: "Help",
  owner_trainer_id: "owner",
} as AdminQueueItem;
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
it("offers assigned assistants alongside available trainers and submits the assistant", async () => {
  const onAssigned = vi.fn();
  await act(async () =>
    root.render(
      <AssignTicketModal
        isOpen
        item={item}
        onClose={() => {}}
        onAssigned={onAssigned}
      />,
    ),
  );
  expect(handoverApi.listClassAssistants).toHaveBeenCalledWith("class-1");
  const select = host.querySelector("select")!;
  expect(
    [...select.options].find((option) => option.value === "assistant-1")
      ?.textContent,
  ).toContain("Assigned Assistant");
  expect(
    [...select.options].find((option) => option.value === "owner")?.disabled,
  ).toBe(true);
  expect(
    [...select.options].find((option) => option.value === "trainer-off")
      ?.disabled,
  ).toBe(true);
  expect(
    [...select.options].find((option) => option.value === "trainer-present")
      ?.disabled,
  ).toBe(false);
  await act(async () => {
    select.value = "assistant-1";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(async () =>
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(handoverApi.assignTicket).toHaveBeenCalledWith(
    "ticket-1",
    "assistant-1",
  );
  expect(onAssigned).toHaveBeenCalledOnce();
});
it("does not offer the assistant who already owns the ticket", async () => {
  await act(async () =>
    root.render(
      <AssignTicketModal
        isOpen
        item={{ ...item, owner_trainer_id: "assistant-1" }}
        onClose={() => {}}
      />,
    ),
  );
  const option = [...host.querySelectorAll("option")].find(
    (option) => option.value === "assistant-1",
  );
  expect(option).toBeTruthy();
  expect(option?.disabled).toBe(true);
});
