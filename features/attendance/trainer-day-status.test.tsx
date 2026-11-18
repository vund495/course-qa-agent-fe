// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TrainerDayStatusView } from "./trainer-day-status";
import type { TrainerDayStatus } from "@/lib/handover-api";

const statuses: TrainerDayStatus[] = [
  {
    trainer_id: "trainer-1",
    trainer_name: "Teacher One",
    date: "2026-11-09",
    status: "present",
    note: null,
    recorded_by: null,
    updated_at: null,
  },
  {
    trainer_id: "trainer-2",
    trainer_name: "Teacher Two",
    date: "2026-11-09",
    status: "off",
    note: null,
    recorded_by: null,
    updated_at: null,
  },
];

describe("TrainerDayStatusView", () => {
  it("spells out the current state and lists class trainers", () => {
    const html = renderToStaticMarkup(
      <TrainerDayStatusView
        date="2026-11-09"
        myId="trainer-1"
        myStatus="present"
        statuses={statuses}
        onSetStatus={() => {}}
      />,
    );

    expect(html).toContain("h-7");
    expect(html).toContain("role=\"group\"");
    expect(html).toContain("You are marked");
    expect(html).toContain("PRESENT");
    expect(html).toContain("Tickets from your classes stay yours.");
    expect(html).toContain("Class trainers today");
    expect(html).toContain("Teacher One (you)");
    expect(html).toContain("Teacher Two");
    expect(html).toContain("off");
  });

  it("explains the handover consequence and the queue fallback", () => {
    const handoverCopy = renderToStaticMarkup(
      <TrainerDayStatusView
        date="2026-11-09"
        myId="trainer-1"
        myStatus="off"
        statuses={[
          { ...statuses[0], status: "off" },
          { ...statuses[1], status: "present" },
        ]}
        onSetStatus={() => {}}
      />,
    );
    expect(handoverCopy).toContain("handed to an available trainer");

    const queueCopy = renderToStaticMarkup(
      <TrainerDayStatusView
        date="2026-11-09"
        myId="trainer-1"
        myStatus="off"
        statuses={[{ ...statuses[0], status: "off" }, statuses[1]]}
        onSetStatus={() => {}}
      />,
    );
    expect(queueCopy).toContain("wait for an administrator");
  });

  it("calls onSetStatus from the two-button control", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const host = document.createElement("div");
    document.body.append(host);
    const root: Root = createRoot(host);
    const onSetStatus = vi.fn();

    await act(async () => {
      root.render(
        <TrainerDayStatusView
          date="2026-11-09"
          myId="trainer-1"
          myStatus="present"
          statuses={statuses}
          onSetStatus={onSetStatus}
        />,
      );
    });

    const offButton = Array.from(host.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("I'm off today"),
    ) as HTMLButtonElement | undefined;
    expect(offButton).not.toBeUndefined();

    await act(async () => {
      offButton?.click();
    });

    expect(onSetStatus).not.toHaveBeenCalled();
    const confirm = Array.from(document.querySelectorAll("button")).find(button => button.textContent === "Confirm off");
    await act(async () => confirm?.click());
    expect(onSetStatus).toHaveBeenCalledWith("off");

    act(() => {
      root.unmount();
    });
    host.remove();
  });

  it("uses soft selected colors and smooth interaction feedback", () => {
    const presentHost = document.createElement("div");
    presentHost.innerHTML = renderToStaticMarkup(
      <TrainerDayStatusView
        date="2026-11-09"
        myId="trainer-1"
        myStatus="present"
        statuses={statuses}
        onSetStatus={() => {}}
      />,
    );
    const presentButton = Array.from(
      presentHost.querySelectorAll("button"),
    ).find((button) => button.textContent?.includes("I'm present"));

    expect(presentButton?.className).toContain("bg-[#ECFDF3]");
    expect(presentButton?.className).not.toContain("bg-emerald-700");
    expect(presentButton?.className).toContain("active:scale-[0.98]");

    const offHost = document.createElement("div");
    offHost.innerHTML = renderToStaticMarkup(
      <TrainerDayStatusView
        date="2026-11-09"
        myId="trainer-1"
        myStatus="off"
        statuses={statuses}
        onSetStatus={() => {}}
      />,
    );
    const offButton = Array.from(offHost.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("I'm off today"),
    );

    expect(offButton?.className).toContain("bg-[#FDF1EE]");
    expect(offButton?.className).not.toContain("bg-[#A94332]");
    expect(offButton?.className).toContain("active:scale-[0.98]");
  });
});
