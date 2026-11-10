// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import AdminTicketQueuePage from "./page";

const queueItem = {
  id: "ticket-1",
  class_id: "class-1",
  student_id: "student-1",
  question: "Why does my loop stop after one row?",
  original_question: null,
  agent_answer: null,
  citations: [],
  source_message_id: null,
  status: "OPEN",
  created_at: "2026-11-09T09:12:00+07:00",
  escalated_to_id: null,
  escalated_at: null,
  escalated_to_name: null,
  student_seen_at: null,
  owner_trainer_id: "trainer-1",
  owner_trainer_name: "Academic Trainer",
  queued_for_admin_at: new Date().toISOString(),
  handover_from_id: null,
  handover_from_name: null,
  handover_reason: null,
  handover_at: null,
  student_name: "Tran Thi Binh",
  class_name: "Python Fundamentals",
  class_code: "PY101-FA26-001",
  class_status: "ACTIVE",
  replies: [
    {
      id: "reply-1",
      ticket_id: "ticket-1",
      user_id: "trainer-1",
      message:
        "All trainers are off today; the ticket is waiting for an administrator.",
      created_at: "2026-11-09T09:20:00+07:00",
    },
  ],
  absent_trainers: ["Academic Trainer", "Teacher Two"],
};

describe("AdminTicketQueuePage", () => {
  let host: HTMLDivElement;
  let root: Root;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    host.remove();
    globalThis.fetch = originalFetch;
  });

  it("renders queued tickets, the absent trainers and the admin actions", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify([queueItem]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;

    await act(async () => {
      root.render(<AdminTicketQueuePage />);
    });

    expect(host.textContent).toContain("Ticket Queue");
    expect(host.textContent).toContain("Why does my loop stop after one row?");
    expect(host.textContent).toContain("Waiting for admin");
    expect(host.textContent).toContain("All trainers of this class are off");
    expect(host.textContent).toContain("Assign…");
    expect(host.textContent).toContain("Reply");
  });

  it("treats an empty queue as a success state", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;

    await act(async () => {
      root.render(<AdminTicketQueuePage />);
    });

    expect(host.textContent).toContain("No tickets are waiting for an administrator.");
    expect(host.textContent).toContain("Every open ticket has a trainer who can answer it.");
  });
});
