import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TicketInbox } from "@/features/tickets/ticket-inbox";
import { LeaveRequestModal } from "./leave-request-modal";
import { validateLeaveRange } from "@/lib/handover-api";

describe("leave request UI", () => {
  it("keeps planned leave controls out of the ticket inbox", () => {
    const html = renderToStaticMarkup(<TicketInbox initialClassId="class-1" />);
    expect(html).not.toContain("Request leave");
    expect(html).not.toContain("Leave requests");
  });
  it("validates the date range before sending", () => {
    expect(validateLeaveRange("2026-11-12", "2026-11-10")).toBe(
      "The end date must be on or after the start date.",
    );
    expect(validateLeaveRange("2026-11-10", "2026-11-10")).toBeNull();
    expect(validateLeaveRange("2026-11-10", "2026-11-12")).toBeNull();
  });

  it("explains when no class is selected", () => {
    const html = renderToStaticMarkup(
      <LeaveRequestModal
        isOpen
        onClose={() => {}}
        classId=""
        onCreated={() => {}}
      />,
    );

    expect(html).toContain("Request planned leave");
    expect(html).toContain("Select a class Attendance page first.");
    expect(html).toContain("Send request");
  });

  it("renders the class label and leave fields when a class is selected", () => {
    const html = renderToStaticMarkup(
      <LeaveRequestModal
        isOpen
        onClose={() => {}}
        classId="class-1"
        classLabel="PY101-FA26-001 · Python Fundamentals"
        onCreated={() => {}}
      />,
    );

    expect(html).toContain("PY101-FA26-001 · Python Fundamentals");
    expect(html).toContain("No teaching assistants assigned");
    expect(html).toContain("Reason");
  });
});
