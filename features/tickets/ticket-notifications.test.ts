import { describe, expect, it } from "vitest";
import { ticketNotificationHref } from "./ticket-notifications";

describe("ticketNotificationHref", () => {
  it("opens the teacher ticket inbox with the ticket selected", () => {
    expect(ticketNotificationHref({ id: "ticket-2" }))
      .toBe("/teacher/tickets?ticket_id=ticket-2");
  });
  it("opens the student's ticket from the bell", () => {
    expect(ticketNotificationHref({ id: "ticket-2" }, "student"))
      .toBe("/student/tickets?ticket_id=ticket-2");
  });
});
