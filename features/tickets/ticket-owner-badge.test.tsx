import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TicketOwnerBadge, isSystemTicketReply } from "./ticket-owner-badge";
import type { Ticket } from "./api";

const baseTicket: Ticket = {
  id: "ticket-1",
  class_id: "class-1",
  student_id: "student-1",
  question: "Why does my loop stop after one row?",
  citations: [],
  status: "OPEN",
  created_at: "2026-11-09T09:12:00+07:00",
};

describe("TicketOwnerBadge", () => {
  it("shows the current owner", () => {
    const html = renderToStaticMarkup(
      <TicketOwnerBadge
        ticket={{ ...baseTicket, owner_trainer_id: "trainer-1", owner_trainer_name: "Teacher One" }}
        currentUserId="trainer-1"
      />,
    );
    expect(html).toContain("Owner: you");
  });

  it("prioritises the admin queue marker over the handover badge", () => {
    const html = renderToStaticMarkup(
      <TicketOwnerBadge
        ticket={{
          ...baseTicket,
          owner_trainer_id: "trainer-1",
          owner_trainer_name: "Teacher One",
          queued_for_admin_at: "2026-11-09T10:00:00+07:00",
          handover_from_name: "Academic Trainer",
          handover_reason: "auto_absent",
        }}
        currentUserId="trainer-2"
      />,
    );
    expect(html).toContain("Owner: Teacher One");
    expect(html).toContain("Waiting for admin");
    expect(html).not.toContain("Transferred from Academic Trainer");
  });

  it("shows the transfer context when the ticket is not queued", () => {
    const html = renderToStaticMarkup(
      <TicketOwnerBadge
        ticket={{
          ...baseTicket,
          owner_trainer_id: "trainer-2",
          owner_trainer_name: "Teacher Two",
          handover_from_name: "Academic Trainer",
          handover_reason: "manual_transfer",
          handover_at: "2026-11-09T10:00:00+07:00",
        }}
        currentUserId="trainer-2"
      />,
    );
    expect(html).toContain("Owner: you");
    expect(html).toContain("Transferred from Academic Trainer");
    expect(html).toContain("manual transfer");
  });

  it("recognises system replies used by the thread view", () => {
    expect(isSystemTicketReply("Ticket transferred from A to B (auto_absent).")).toBe(true);
    expect(
      isSystemTicketReply("All trainers are off today; the ticket is waiting for an administrator."),
    ).toBe(true);
    expect(isSystemTicketReply("Handover from A was rejected; the ticket returns to the automatic queue.")).toBe(true);
    expect(isSystemTicketReply("Regular reply")).toBe(false);
  });
});
