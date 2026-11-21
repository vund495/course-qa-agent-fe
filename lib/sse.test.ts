import { describe, expect, it } from "vitest";

import { createSseParser, type ChatStreamEvent } from "./sse";

describe("createSseParser", () => {
  it("parses multiple typed events", () => {
    const events: ChatStreamEvent[] = [];
    const parser = createSseParser((event) => events.push(event));

    parser.push(
      'event: token\ndata: {"text":"Hello "}\n\n' +
        'event: citation\ndata: {"index":1,"kind":"curriculum","title":"lesson.pdf","url":null,"snippet":"Evidence","document_id":"doc-1","page":2}\n\n' +
        'event: done\ndata: {"source":"curriculum","used_web_search":false,"threshold":0.8,"top_score":0.91,"session_id":"session-1","user_message_id":"user-1","assistant_message_id":"assistant-1"}\n\n',
    );

    expect(events).toEqual([
      { type: "token", text: "Hello " },
      {
        type: "citation",
        citation: {
          index: 1,
          kind: "curriculum",
          title: "lesson.pdf",
          url: null,
          snippet: "Evidence",
          documentId: "doc-1",
          page: 2,
          section: null,
          indexes: [],
          highlights: [],
        },
      },
      {
        type: "done",
        source: "curriculum",
        usedWebSearch: false,
        threshold: 0.8,
        topScore: 0.91,
        sessionId: "session-1",
        userMessageId: "user-1",
        assistantMessageId: "assistant-1",
      },
    ]);
  });

  it("fills missing conversation ids on the done event with null", () => {
    const events: ChatStreamEvent[] = [];
    const parser = createSseParser((event) => events.push(event));

    parser.push(
      'event: done\ndata: {"source":"none","used_web_search":false,"threshold":0.8,"top_score":null}\n\n',
    );

    expect(events).toEqual([
      {
        type: "done",
        source: "none",
        usedWebSearch: false,
        threshold: 0.8,
        topScore: null,
        sessionId: null,
        userMessageId: null,
        assistantMessageId: null,
        suggestedQuestions: undefined,
      },
    ]);
  });

  it("parses suggestions event (AI-125)", () => {
    const events: ChatStreamEvent[] = [];
    const parser = createSseParser((event) => events.push(event));

    parser.push(
      'event: suggestions\ndata: {"questions":["How does backpropagation work?","Why use ReLU?"]}\n\n',
    );

    expect(events).toEqual([
      {
        type: "suggestions",
        questions: ["How does backpropagation work?", "Why use ReLU?"],
      },
    ]);
  });

  it("parses suggested questions in done event (AI-125)", () => {
    const events: ChatStreamEvent[] = [];
    const parser = createSseParser((event) => events.push(event));

    parser.push(
      'event: done\ndata: {"source":"curriculum","used_web_search":false,"threshold":0.8,"top_score":0.95,"suggested_questions":["What is gradient descent?"]}\n\n',
    );

    expect(events).toEqual([
      {
        type: "done",
        source: "curriculum",
        usedWebSearch: false,
        threshold: 0.8,
        topScore: 0.95,
        sessionId: null,
        userMessageId: null,
        assistantMessageId: null,
        suggestedQuestions: ["What is gradient descent?"],
      },
    ]);
  });

  it("keeps an incomplete event until the next network chunk", () => {
    const events: ChatStreamEvent[] = [];
    const parser = createSseParser((event) => events.push(event));

    parser.push('event: token\ndata: {"text":"Neu');
    expect(events).toEqual([]);

    parser.push('ral network"}\n\n');
    expect(events).toEqual([{ type: "token", text: "Neural network" }]);
  });

  it("supports CRLF event separators", () => {
    const events: ChatStreamEvent[] = [];
    const parser = createSseParser((event) => events.push(event));

    parser.push('event: error\r\ndata: {"message":"Try again."}\r\n\r\n');

    expect(events).toEqual([{ type: "error", message: "Try again." }]);
  });

  it("rejects malformed JSON instead of silently hanging", () => {
    const parser = createSseParser(() => undefined);

    expect(() => parser.push("event: token\ndata: not-json\n\n")).toThrow(
      "Invalid SSE data",
    );
  });

  it("keeps CRLF separators intact when a network chunk splits them", () => {
    const events: ChatStreamEvent[] = [];
    const parser = createSseParser((event) => events.push(event));

    parser.push("event: token\r");
    parser.push('\ndata: {"text":"Split"}\r\n\r');
    parser.push("\n");

    expect(events).toEqual([{ type: "token", text: "Split" }]);
  });

  it("ignores unknown event types instead of failing the stream", () => {
    const events: ChatStreamEvent[] = [];
    const parser = createSseParser((event) => events.push(event));

    parser.push(
      'event: heartbeat\ndata: {"at":123}\n\n' +
        'event: token\ndata: {"text":"Still here"}\n\n',
    );

    expect(events).toEqual([{ type: "token", text: "Still here" }]);
  });

  it("parses a typed consent offer for reload-safe web consent", () => {
    const events: ChatStreamEvent[] = [];
    const parser = createSseParser((event) => events.push(event));

    parser.push(
      'event: consent\ndata: {"id":"offer-1","session_id":"session-1","scope_kind":"missing","question":"What is X and Y?","query_scope":["Y"],"expires_at":"2026-11-16T10:00:00Z","assistant_message_id":"assistant-1"}\n\n',
    );

    expect(events).toEqual([
      {
        type: "consent",
        offer: {
          id: "offer-1",
          sessionId: "session-1",
          scopeKind: "missing",
          question: "What is X and Y?",
          queryScope: ["Y"],
          conflictNote: null,
          conflictCitations: [],
          expiresAt: "2026-11-16T10:00:00Z",
          assistantMessageId: "assistant-1",
        },
      },
    ]);
  });

  it("parses conflict warnings and both-side citations on a consent offer", () => {
    const events: ChatStreamEvent[] = [];
    const parser = createSseParser((event) => events.push(event));

    parser.push(
      'event: consent\ndata: {"id":"offer-1","session_id":"session-1","scope_kind":"missing","question":"What is X and Y?","query_scope":["Y"],"conflict_note":"Source 1 says early; source 2 says late.","conflict_citations":[{"index":1,"kind":"curriculum","title":"one.pdf","snippet":"early"},{"index":2,"kind":"curriculum","title":"two.pdf","snippet":"late"}],"expires_at":"2026-11-16T10:00:00Z"}\n\n',
    );

    expect(events).toHaveLength(1);
    const consent = events[0];
    if (consent.type !== "consent") throw new Error("expected consent");
    expect(consent.offer.conflictNote).toContain("Source 1 says early");
    expect(consent.offer.conflictCitations.map((citation) => citation.title)).toEqual([
      "one.pdf",
      "two.pdf",
    ]);
  });

  it("rejects malformed consent offers", () => {
    const parser = createSseParser(() => undefined);
    expect(() =>
      parser.push('event: consent\ndata: {"id":"offer-1","scope_kind":"missing"}\n\n'),
    ).toThrow("Invalid SSE data");
  });

  it("flushes a final event that arrived without a blank line", () => {
    const events: ChatStreamEvent[] = [];
    const parser = createSseParser((event) => events.push(event));

    parser.push('event: token\ndata: {"text":"Last"}');
    parser.finish();

    expect(events).toEqual([{ type: "token", text: "Last" }]);
  });

  it("fills optional citation fields with null defaults", () => {
    const events: ChatStreamEvent[] = [];
    const parser = createSseParser((event) => events.push(event));

    parser.push(
      'event: citation\ndata: {"index":2,"kind":"internet","title":"Docs","snippet":"Text"}\n\n',
    );

    expect(events).toEqual([
      {
        type: "citation",
        citation: {
          index: 2,
          kind: "internet",
          title: "Docs",
          url: null,
          snippet: "Text",
          documentId: null,
          page: null,
          section: null,
          indexes: [],
          highlights: [],
        },
      },
    ]);
  });

  it("parses the curriculum section locator on a citation", () => {
    const events: ChatStreamEvent[] = [];
    const parser = createSseParser((event) => events.push(event));

    parser.push(
      'event: citation\ndata: {"index":1,"kind":"curriculum","title":"lesson.pdf","snippet":"Text","document_id":"doc-1","page":8,"section":"Chapter 2 > Transport","indexes":[1],"highlights":["Text"]}\n\n',
    );

    expect(events[0]).toMatchObject({
      type: "citation",
      citation: { section: "Chapter 2 > Transport", page: 8 },
    });
  });

  it("decodes live multi-page range labels on a citation", () => {
    const events: ChatStreamEvent[] = [];
    const parser = createSseParser((event) => events.push(event));

    parser.push(
      'event: citation\ndata: {"index":1,"kind":"curriculum","title":"lesson.pdf","snippet":"Text","document_id":"doc-1","page":8,"pages":[8,9],"page_label":"8-9","indexes":[1],"highlights":["Text"]}\n\n',
    );

    expect(events[0]).toMatchObject({
      type: "citation",
      citation: { page: 8, pages: [8, 9], pageLabel: "8-9" },
    });
  });

  it("parses a restart event so the client can clear partial text", () => {
    const events: ChatStreamEvent[] = [];
    const parser = createSseParser((event) => events.push(event));

    parser.push(
      'event: restart\ndata: {"message":"Switching to the next Gemini key."}\n\n',
    );

    expect(events).toEqual([
      { type: "restart", message: "Switching to the next Gemini key." },
    ]);
  });

  it("parses progress events with optional message", () => {
    const events: ChatStreamEvent[] = [];
    const parser = createSseParser((event) => events.push(event));

    parser.push(
      'event: progress\ndata: {"stage":"searching","message":"Searching class materials"}\n\n' +
        'event: progress\ndata: {"stage":"drafting"}\n\n',
    );

    expect(events).toEqual([
      { type: "progress", stage: "searching", message: "Searching class materials" },
      { type: "progress", stage: "drafting", message: undefined },
    ]);
  });
});
