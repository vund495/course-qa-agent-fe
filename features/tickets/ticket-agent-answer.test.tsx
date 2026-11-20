import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MarkdownContent } from "@/components/shared/MarkdownContent";
import { TicketAgentAnswer } from "./ticket-agent-answer";

const CPP_ANSWER = [
  "Here is the standard C++ program [1]:",
  "",
  "```cpp",
  "#include <iostream>",
  "",
  "int main() {",
  '    std::cout << "Hello, World!" << std::endl;',
  "    return 0;",
  "}",
  "```",
].join("\n");

describe("TicketAgentAnswer", () => {
  it("renders a fenced C++ answer as a code block when the ticket has a source message", () => {
    const html = renderToStaticMarkup(
      <TicketAgentAnswer content={CPP_ANSWER} sourceMessageId="message-1" />,
    );

    expect(html).toContain("#include");
    expect(html).toContain("std::cout");
    expect(html).toContain("Hello, World!");
    expect(html).toContain("Copy");
    expect(html).not.toContain("```");
    expect(html).toContain("<pre");
  });

  it("keeps a selection ticket literal, including Markdown characters and indentation", () => {
    const selection = [
      "int main() {",
      "    // literal #include <iostream> should stay visible",
      '    std::cout << "[1] *not emphasis*";',
      "}",
    ].join("\n");

    const html = renderToStaticMarkup(
      <TicketAgentAnswer content={selection} sourceMessageId={null} />,
    );

    expect(html).toContain("&lt;iostream&gt;");
    expect(html).toContain("[1] *not emphasis*");
    expect(html).toContain("    // literal");
    expect(html).not.toContain("<pre");
    expect(html).not.toContain("<code");
  });

  it("falls back to literal text when a deleted source message sets the FK to null", () => {
    const html = renderToStaticMarkup(
      <TicketAgentAnswer content={CPP_ANSWER} sourceMessageId={null} />,
    );

    expect(html).toContain("```");
    expect(html).toContain("&lt;iostream&gt;");
    expect(html).not.toContain("<pre");
  });

  it("does not load remote Markdown images or execute raw HTML on ticket screens", () => {
    const html = renderToStaticMarkup(
      <TicketAgentAnswer
        content={'<script>alert("x")</script>\n\n![diagram](https://evil.example/x.png)'}
        sourceMessageId="message-1"
      />,
    );

    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).toContain("diagram");
  });

  it("keeps the existing MarkdownContent image default for chat callers", () => {
    const html = renderToStaticMarkup(
      <MarkdownContent content={"![diagram](https://example.com/x.png)"} />,
    );

    expect(html).toContain("<img");
  });
});
