// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LeaveRequestModal } from "./leave-request-modal";
import { handoverApi } from "@/lib/handover-api";
import { LeaveRequestsModal } from "./leave-requests-modal";
import { SessionWarnings } from "@/features/attendance/session-warnings";
import {
  TrainerDayStatus,
  TrainerDayStatusView,
} from "@/features/attendance/trainer-day-status";

vi.mock("@/lib/handover-api", async (original) => {
  const actual = await original<typeof import("@/lib/handover-api")>();
  return {
    ...actual,
    handoverApi: {
      ...actual.handoverApi,
      listClassAssistants: vi.fn().mockResolvedValue([]),
      createLeave: vi.fn().mockResolvedValue({}),
      listLeaves: vi.fn().mockResolvedValue([]),
      getMyStatus: vi
        .fn()
        .mockResolvedValue({
          trainer_id: "trainer-1",
          trainer_name: "Teacher",
          status: "present",
        }),
      listClassStatus: vi.fn().mockResolvedValue([]),
      setMyStatus: vi.fn(),
    },
  };
});
vi.mock("@/features/profile/api", () => ({
  profileApi: {
    me: vi.fn().mockResolvedValue({ id: "trainer-1", role: "trainer" }),
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, {
    IS_REACT_ACT_ENVIRONMENT: true,
    SVGGeometryElement: SVGElement,
    matchMedia: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
    ResizeObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  });
  if (!Element.prototype.animate) {
    Element.prototype.animate = () => ({
      finished: Promise.resolve(),
      cancel: () => {},
      finish: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    }) as unknown as Animation;
  }
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  }
  if (!Element.prototype.getAnimations) {
    Element.prototype.getAnimations = () => [];
  }
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  vi.clearAllMocks();
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = "";
});
const click = async (label: string) => {
  await act(async () => {
    const button = [...document.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === label,
    );
    expect(button, label).toBeTruthy();
    button!.click();
  });
};
const openSelect = async (label: string) => {
  const trigger = document.querySelector<HTMLElement>(
    `[role="combobox"][aria-label="${label}"]`,
  );
  expect(trigger, label).toBeTruthy();
  await act(async () => trigger!.click());
  return [...document.querySelectorAll<HTMLElement>('[role="option"]')];
};
const selectOption = async (label: string, optionLabel: string) => {
  const options = await openSelect(label);
  const option = options.find((item) => item.textContent?.includes(optionLabel));
  expect(option, optionLabel).toBeTruthy();
  await act(async () => option!.click());
};
describe("AI140 Attendance leave workflow", () => {
  it("submits a class-scoped leave with eleven reasons and no assistant", async () => {
    await act(async () =>
      root.render(
        <LeaveRequestModal isOpen classId="class-1" onClose={() => {}} />,
      ),
    );
    expect(document.body.textContent).toContain(
      "No teaching assistants assigned",
    );
    const reasonOptions = await openSelect("Leave reason");
    expect(reasonOptions).toHaveLength(11);
    await act(async () => reasonOptions[0].click());
    await click("Send request");
    expect(handoverApi.createLeave).toHaveBeenCalledWith(
      expect.objectContaining({
        class_id: "class-1",
        reason_type: "annual_leave",
        target_trainer_id: null,
      }),
    );
  });
  it("requires confirmation for either status and cancellation makes no update", async () => {
    const update = vi.fn();
    await act(async () =>
      root.render(
        <TrainerDayStatusView
          date="2026-11-12"
          myId="trainer"
          myStatus="present"
          statuses={[]}
          onSetStatus={update}
        />,
      ),
    );
    await click("I'm off today");
    expect(update).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("transferred or queued");
    await click("Cancel");
    expect(update).not.toHaveBeenCalled();
    await click("I'm present");
    await click("Confirm present");
    expect(update).toHaveBeenCalledWith("present");
    await click("I'm off today");
    await click("Confirm off");
    expect(update).toHaveBeenCalledWith("off");
  });
});

it("offers only class assistants, allows omitting one and requires other details", async () => {
  vi.mocked(handoverApi.listClassAssistants).mockResolvedValueOnce([
    { id: "assistant-1", name: "Assigned TA", email: "ta@example.com" },
  ]);
  await act(async () =>
    root.render(
      <LeaveRequestModal isOpen classId="class-1" onClose={() => {}} />,
    ),
  );
  expect(handoverApi.listClassAssistants).toHaveBeenCalledWith("class-1");
  const assistantOptions = await openSelect("Cover assistant");
  expect(assistantOptions).toHaveLength(2);
  await act(async () => assistantOptions[0].click());
  await click("Send request");
  expect(handoverApi.createLeave).toHaveBeenLastCalledWith(
    expect.objectContaining({ target_trainer_id: null }),
  );
  await selectOption("Cover assistant", "Assigned TA");
  await selectOption("Leave reason", "Other Reason");
  expect(document.body.textContent).toContain(
    "Provide details for Other Reason.",
  );
  const button = [...document.querySelectorAll("button")].find(
    (b) => b.textContent === "Send request",
  )!;
  expect(button.disabled).toBe(true);
  const details = document.querySelector<HTMLTextAreaElement>(
    'textarea[aria-label="Reason details"]',
  )!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )!.set!.call(details, "Personal event");
    details.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click("Send request");
  expect(handoverApi.createLeave).toHaveBeenLastCalledWith(
    expect.objectContaining({
      target_trainer_id: "assistant-1",
      reason_type: "other",
      reason_details: "Personal event",
    }),
  );
});
it("shows own class history and rejection reason without peer review", async () => {
  const base = {
    id: "leave-1",
    trainer_id: "trainer-1",
    class_id: "class-1",
    date_from: "2026-11-12",
    date_to: "2026-11-13",
    reason_type: "sick_leave",
    reason_details: "Own details",
    status: "rejected",
    rejection_reason: "Wrong date",
    target_trainer_name: null,
  };
  vi.mocked(handoverApi.listLeaves).mockResolvedValueOnce([
    base,
    {
      ...base,
      id: "other",
      trainer_id: "trainer-2",
      reason_details: "Peer details",
    },
    {
      ...base,
      id: "another-class",
      class_id: "class-2",
      reason_details: "Other class details",
    },
  ] as never);
  await act(async () =>
    root.render(
      <LeaveRequestsModal isOpen classId="class-1" onClose={() => {}} />,
    ),
  );
  expect(document.body.textContent).toContain("Wrong date");
  expect(document.body.textContent).toContain("Own details");
  expect(document.body.textContent).not.toContain("Peer details");
  expect(document.body.textContent).not.toContain("Other class details");
  expect(document.body.textContent).not.toContain("Accept cover");
});
it("restores the prior status if confirmed availability update fails", async () => {
  vi.mocked(handoverApi.setMyStatus).mockRejectedValueOnce(
    new Error("Save failed"),
  );
  await act(async () => root.render(<TrainerDayStatus classId="class-1" />));
  await click("I'm off today");
  expect(handoverApi.setMyStatus).not.toHaveBeenCalled();
  await click("Confirm off");
  expect(document.body.textContent).toContain("Save failed");
  expect(
    [...document.querySelectorAll("button")]
      .find((b) => b.textContent?.includes("I'm present"))
      ?.getAttribute("aria-pressed"),
  ).toBe("true");
});
it("shows holiday and approved leave session warnings", async () => {
  await act(async () =>
    root.render(
      <SessionWarnings
        session={{
          is_holiday: true,
          holiday_name: "National Day",
          trainer_on_leave: true,
          trainer_leave: {
            id: "leave",
            date_from: "2026-11-12",
            date_to: "2026-11-13",
            reason_type: "annual_leave",
            reason_details: null,
            target_trainer_id: "ta",
            target_trainer_name: "Assigned TA",
          },
        }}
      />,
    ),
  );
  expect(host.textContent).toContain("Holiday: National Day");
  expect(host.textContent).toContain(
    "Trainer on approved leave · Assigned TA covers",
  );
});
