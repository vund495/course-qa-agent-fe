import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TicketInbox, ticketInboxEmptyCopy } from "@/features/tickets/ticket-inbox";

describe("owner-scoped trainer ticket inbox", () => {
  it("tells the trainer the inbox only holds tickets sent to them", () => {
    const html = renderToStaticMarkup(<TicketInbox />);

    expect(html).toContain("Student questions sent to you.");
    expect(html).not.toContain("Student questions for your assigned classes.");
  });

  it("explains an empty inbox instead of blaming the filters", () => {
    expect(ticketInboxEmptyCopy({ search: "", filter: "all", total: 0 })).toEqual({
      title: "No tickets have been sent to you yet.",
      hint:
        "Student questions go to the trainer they were sent to. A ticket appears here after it is handed over to you.",
    });
    // The default filter is Open, so the counts decide that nothing was ever
    // sent to this trainer.
    expect(
      ticketInboxEmptyCopy({ search: "", filter: "OPEN", total: 0, ownedTotal: 0 }),
    ).toEqual({
      title: "No tickets have been sent to you yet.",
      hint:
        "Student questions go to the trainer they were sent to. A ticket appears here after it is handed over to you.",
    });
  });

  it("keeps the filter and search copy once tickets exist", () => {
    expect(ticketInboxEmptyCopy({ search: "", filter: "OPEN", total: 0, ownedTotal: 2 })).toEqual({
      title: "No tickets match this filter.",
    });
    expect(ticketInboxEmptyCopy({ search: "", filter: "OPEN", total: 0 })).toEqual({
      title: "No tickets match this filter.",
    });
    expect(ticketInboxEmptyCopy({ search: " quiz ", filter: "all", total: 3 })).toEqual({
      title: "No tickets match this search on this page.",
    });
  });
});
