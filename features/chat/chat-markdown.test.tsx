import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ChatMarkdown } from "./chat-markdown";
import type { ChatCitation } from "@/lib/sse";

vi.mock("next/navigation", () => ({
  usePathname: () => "/student/class/c1/agent",
  useParams: () => ({ id: "c1" }),
}));

function citation(overrides: Partial<ChatCitation> = {}): ChatCitation {
  return {
    index: 1,
    kind: "curriculum",
    title: "Dsa.pdf",
    url: null,
    snippet: "Passage",
    documentId: "doc-1",
    page: 12,
    section: "Dsa.pdf > 1.1 Introduction",
    indexes: [1],
    highlights: ["Passage"],
    ...overrides,
  };
}

describe("ChatMarkdown inline citations", () => {
  it("renders a short real-metadata label with the full source in its tooltip", () => {
    const html = renderToStaticMarkup(
      React.createElement(ChatMarkdown, {
        content: "A fact [1].",
        citations: [citation()],
      }),
    );

    expect(html).toContain(">Dsa · Mục 1.1 · Trang 12<");
    expect(html).toContain("Dsa.pdf");
    expect(html).toContain("1.1 Introduction");
    expect(html).toContain("Trang 12");
    expect(html).not.toContain("<u>");
    expect(html).not.toContain("<i>");
    expect(html).toContain("<button");
    expect(html).not.toContain("<em");
    expect(html).not.toContain("<strong");
  });

  it("keeps web citation labels and does not turn them into source buttons", () => {
    const html = renderToStaticMarkup(
      React.createElement(ChatMarkdown, {
        content: "A fact [1].",
        citations: [
          citation({
            kind: "internet",
            title: "Web Docs",
            url: "https://example.com/docs",
            documentId: null,
            page: null,
            section: null,
            indexes: [1],
            highlights: [],
          }),
        ],
      }),
    );

    expect(html).toContain("Web Docs");
    expect(html).toContain("<em");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("#citation-1");
  });
});
