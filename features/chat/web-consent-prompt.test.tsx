import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/student/class/class-1/agent",
  useParams: () => ({ id: "class-1" }),
}));

import { WebConsentPrompt } from "./web-consent-prompt";

function render(scopeKind: "missing" | "full") {
  return renderToStaticMarkup(
    React.createElement(WebConsentPrompt, {
      offer: {
        id: "offer-1",
        sessionId: "session-1",
        scopeKind,
        question: "What is X and Y?",
        queryScope: scopeKind === "full" ? ["What is X and Y?"] : ["Y"],
        conflictNote: null,
        conflictCitations: [],
        expiresAt: "2026-11-16T10:00:00Z",
        assistantMessageId: "assistant-1",
      },
      onAccept: vi.fn(),
      onDecline: vi.fn(),
    }),
  );
}

describe("WebConsentPrompt", () => {
  it("shows the exact missing scope and explicit accept/decline actions", () => {
    const html = render("missing");
    expect(html).toContain("Some parts need the web");
    expect(html).toContain("<li>Y</li>");
    expect(html).toContain("Search the web");
    expect(html).toContain("No, thanks");
    expect(html).toContain('aria-label="Web search consent"');
  });

  it("shows the full question for a none outcome", () => {
    const html = render("full");
    expect(html).toContain("Course materials are not enough");
    expect(html).toContain("What is X and Y?");
  });

  it("shows Searching and disables both actions while the web stream starts", () => {
    const html = renderToStaticMarkup(
      React.createElement(WebConsentPrompt, {
        offer: {
          id: "offer-1",
          sessionId: "session-1",
          scopeKind: "full",
          question: "What is X and Y?",
          queryScope: ["What is X and Y?"],
          conflictNote: null,
          conflictCitations: [],
          expiresAt: "2026-11-16T10:00:00Z",
          assistantMessageId: "assistant-1",
        },
        busy: true,
        onAccept: vi.fn(),
        onDecline: vi.fn(),
      }),
    );
    expect(html).toContain("Searching the web...");
    expect(html).toContain('aria-busy="true"');
    expect(html.match(/disabled=""/g)?.length).toBe(2);
  });

  it("shows a conflict warning and both conflicting source chips", () => {
    const html = renderToStaticMarkup(
      React.createElement(WebConsentPrompt, {
        offer: {
          id: "offer-1",
          sessionId: "session-1",
          scopeKind: "missing",
          question: "What is X and Y?",
          queryScope: ["Y"],
          conflictNote: "**Source conflict warning:** Source one says early; source two says late.",
          conflictCitations: [
            {
              index: 1,
              kind: "curriculum",
              title: "source-one.pdf",
              url: null,
              snippet: "early",
              documentId: "doc-1",
              page: 1,
              indexes: [1],
              highlights: [],
            },
            {
              index: 2,
              kind: "curriculum",
              title: "source-two.pdf",
              url: null,
              snippet: "late",
              documentId: "doc-2",
              page: 2,
              indexes: [2],
              highlights: [],
            },
          ],
          expiresAt: "2026-11-16T10:00:00Z",
          assistantMessageId: "assistant-1",
        },
        onAccept: vi.fn(),
        onDecline: vi.fn(),
      }),
    );
    expect(html).toContain("Source conflict warning");
    expect(html).toContain("No winner is selected");
    expect(html).toContain("source-one");
    expect(html).toContain("source-two");
    expect(html).toContain("Trang 1");
    expect(html).toContain("Trang 2");
    expect(html).not.toContain(".pdf");
  });
});
