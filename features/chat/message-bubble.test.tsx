import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MessageBubble } from "./message-bubble";
import type { ChatCitation } from "@/lib/sse";

const ERROR_TEXT = "The answer could not be generated. Please try again.";

function render(props: Partial<React.ComponentProps<typeof MessageBubble>> = {}) {
  return renderToStaticMarkup(
    React.createElement(MessageBubble, {
      role: "ai",
      content: ERROR_TEXT,
      renderMarkdown: false,
      ...props,
    })
  );
}

describe("MessageBubble curriculum footer", () => {
  const dsa = (index: number, page: number, section: string): ChatCitation => ({
    index,
    kind: "curriculum",
    title: "Dsa.pdf",
    url: null,
    snippet: "Passage",
    documentId: "doc-dsa",
    page,
    pages: [page],
    pageLabel: String(page),
    section,
    indexes: [index],
    highlights: [],
  });

  it("keeps the original horizontal Course Materials chips", () => {
    const html = render({
      content: "Answer",
      citations: [
        dsa(1, 12, "Dsa.pdf > 1.1 Introduction"),
        dsa(2, 12, "Dsa.pdf > 1.2 Abstract Data Types"),
        {
          index: 3,
          kind: "internet",
          title: "Web Docs",
          url: "https://example.com/docs",
          snippet: "Web snippet",
          documentId: null,
          page: null,
          indexes: [3],
          highlights: [],
        },
      ],
    });

    expect(html).toContain("Course Materials");
    expect(html).toContain('aria-label="Course Materials"');
    expect(html).toContain("flex flex-wrap gap-2");
    expect(html).toContain("[1]");
    expect(html).toContain("[2]");
    expect(html).toContain("1.1 Introduction");
    expect(html).toContain("1.2 Abstract Data Types");
    expect(html).toContain("Web Sources");
    expect(html).toContain("Web Docs");
    expect(html).not.toContain("Nguồn tài liệu");
  });
});

describe("MessageBubble error retry", () => {
  it("offers a retry action on an error bubble", () => {
    const html = render({ isError: true, onRetry: vi.fn() });

    expect(html).toContain(ERROR_TEXT);
    expect(html).toContain('aria-label="Retry question"');
  });

  it("omits the retry action when no handler is wired", () => {
    const html = render({ isError: true });

    expect(html).toContain(ERROR_TEXT);
    expect(html).not.toContain('aria-label="Retry question"');
  });

  it("never shows a retry action on a successful answer", () => {
    const html = render({ content: "Here is the answer.", onRetry: vi.fn() });

    expect(html).not.toContain('aria-label="Retry question"');
  });

  it("hides the reasoning trace on an error bubble", () => {
    const html = render({
      isError: true,
      onRetry: vi.fn(),
      trace: ["Searching class materials", "Synthesizing answer"],
      traceCompleted: false,
    });

    expect(html).not.toContain("Thought process");
    expect(html).toContain('aria-label="Retry question"');
  });

  it("keeps the response time visible after the answer completes", () => {
    const html = render({ content: "Here is the answer.", thinkingMs: 4300 });

    expect(html).toContain("Thought for 4.3s");
  });

  it("does not show a response time on an error bubble", () => {
    const html = render({ isError: true, thinkingMs: 4300, onRetry: vi.fn() });

    expect(html).not.toContain("Thought for 4.3s");
  });
});
