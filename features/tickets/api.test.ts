import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addTicketReply,
  createTicket,
  deleteTicketAttachment,
  fetchTicketAttachmentBlob,
  getTicketCounts,
  listMyTickets,
  listTickets,
  markTicketSeen,
  reopenTicket,
  resolveTicket,
  uploadTicketAttachments,
} from "./api";

describe("ticket API", () => {
  afterEach(() => vi.restoreAllMocks());

  it("creates a ticket with the selected class, question, and optional details", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "ticket-1", status: "OPEN" }), { status: 201 }),
    );

    await createTicket({ class_id: "class-1", question: "Why?", details: "Please explain." });

    expect(fetchMock.mock.calls[0][0]).toContain("/api/tickets");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      class_id: "class-1",
      question: "Why?",
      details: "Please explain.",
    });
  });

  it("posts a follow-up to the selected ticket", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "reply-1" }), { status: 201 }),
    );

    await addTicketReply("ticket-1", "Could you give another example?");

    expect(fetchMock.mock.calls[0][0]).toContain("/api/tickets/ticket-1/replies");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      message: "Could you give another example?",
      attachment_ids: [],
    });
  });

  it("binds uploaded image and emoji ids to a follow-up", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "reply-1", attachments: [] }), { status: 201 }),
    );

    await addTicketReply("ticket-1", "", ["att-1", "att-2"]);

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      message: "",
      attachment_ids: ["att-1", "att-2"],
    });
  });

  it("uploads images and emojis as multipart form data", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ id: "att-1", kind: "IMAGE" }]), { status: 201 }),
    );

    const file = new File([new Uint8Array([1, 2, 3])], "shot.png", { type: "image/png" });
    const uploaded = await uploadTicketAttachments("ticket-1", {
      files: [file],
      emojis: ["😀"],
    });

    expect(uploaded[0]).toMatchObject({ id: "att-1", kind: "IMAGE" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/tickets/ticket-1/attachments");
    expect(init?.method).toBe("POST");
    // The browser must add the multipart boundary itself.
    expect(new Headers(init?.headers).get("Content-Type")).toBeNull();
    const body = init?.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("files")).toBeInstanceOf(File);
    expect(body.get("emojis")).toBe("😀");
  });

  it("deletes an unsent attachment and loads media with the bearer token", async () => {
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => (key === "qa.auth.token" ? "test-token" : null),
    });
    vi.stubGlobal("window", globalThis);
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(new Blob(["png"]), { status: 200 }));

    await deleteTicketAttachment("att-1");
    const blob = await fetchTicketAttachmentBlob("att-1");

    expect(blob).toBeInstanceOf(Blob);
    expect(fetchMock.mock.calls[0][0]).toContain("/api/tickets/attachments/att-1");
    expect(fetchMock.mock.calls[0][1]?.method).toBe("DELETE");
    expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get("Authorization")).toBe(
      "Bearer test-token",
    );
    vi.unstubAllGlobals();
  });

  it("confirms an answered ticket as resolved", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "ticket-1", status: "RESOLVED" })),
    );
    await resolveTicket("ticket-1");
    expect(fetchMock.mock.calls[0][0]).toContain("/api/tickets/ticket-1/resolve");
    expect(fetchMock.mock.calls[0][1]?.method).toBe("POST");
  });

  it("reopens a resolved ticket", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "ticket-1", status: "ANSWERED" })),
    );
    expect(await reopenTicket("ticket-1")).toMatchObject({ status: "ANSWERED" });
    expect(fetchMock.mock.calls[0][0]).toContain("/api/tickets/ticket-1/reopen");
    expect(fetchMock.mock.calls[0][1]?.method).toBe("POST");
  });

  it("lists the student's own tickets for the My Tickets page", async () => {
    const response = { items: [], total: 0, page: 1, page_size: 20 };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(response)),
    );
    expect(await listMyTickets({ class_id: "class-1", status: "ANSWERED" })).toEqual(response);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe("/api/tickets/mine");
    expect(url.searchParams.get("class_id")).toBe("class-1");
    expect(url.searchParams.get("status")).toBe("ANSWERED");
    expect(fetchMock.mock.calls[0][1]?.method).toBeUndefined();
  });

  it("filters unread replies and marks a ticket seen", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [], total: 0, page: 1, page_size: 5 })))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    await listMyTickets({ unread: true, page_size: 5 });
    expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get("unread")).toBe("true");
    await expect(markTicketSeen("ticket-1")).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[1][0]).toContain("/api/tickets/ticket-1/seen");
    expect(fetchMock.mock.calls[1][1]?.method).toBe("POST");
  });

  it("loads per-class open and completed ticket counts", async () => {
    const response = { items: [], open_total: 0, completed_total: 0 };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(response)),
    );
    expect(await getTicketCounts("class-1")).toEqual(response);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe("/api/tickets/counts");
    expect(url.searchParams.get("class_id")).toBe("class-1");
    expect(fetchMock.mock.calls[0][1]?.method).toBeUndefined();
  });

  it("sends the original chat question separately from the teacher question and agent answer", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "ticket-1", status: "OPEN" }), { status: 201 }),
    );
    await createTicket({
      class_id: "class-1", question: "Can you explain this condition?",
      original_question: "What does this condition do?",
      agent_answer: "Only matching items are included.",
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      class_id: "class-1", question: "Can you explain this condition?",
      original_question: "What does this condition do?",
      agent_answer: "Only matching items are included.",
    });
  });

  it("requests class/status filters and the selected page from the server", async () => {
    const response = { items: [], total: 0, page: 2, page_size: 20 };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(response)),
    );
    expect(await listTickets({ class_id: "class-1", status: "ANSWERED", page: 2 })).toEqual(response);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe("/api/tickets");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      class_id: "class-1", status: "ANSWERED", page: "2", page_size: "20",
    });
  });

  it("requests the latest unanswered tickets across assigned classes", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ items: [], total: 3, page: 1, page_size: 5 })),
    );
    await listTickets({ status: "OPEN", page: 1, page_size: 5 });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(Object.fromEntries(url.searchParams)).toEqual({
      status: "OPEN", page: "1", page_size: "5",
    });
  });

  it("omits optional filters for all assigned classes and all statuses", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ items: [], total: 0, page: 1, page_size: 20 })),
    );
    await listTickets({});
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.has("class_id")).toBe(false);
    expect(url.searchParams.has("status")).toBe(false);
    expect(url.searchParams.get("page")).toBe("1");
  });

  it("surfaces authorization errors instead of substituting mock tickets", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "You are not assigned to this class." }), { status: 403 }),
    );
    await expect(listTickets({ class_id: "private" })).rejects.toThrow();
  });
});
