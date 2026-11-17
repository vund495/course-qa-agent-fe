import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TicketMessageText } from "./ticket-rich-text";

describe("TicketMessageText", () => {
  it("renders http(s) links as safe anchors", () => {
    const html = renderToStaticMarkup(
      <TicketMessageText text="See [the docs](https://example.com/a?b=1) for details." />,
    );
    expect(html).toContain('href="https://example.com/a?b=1"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain("the docs");
  });

  it("keeps unsupported link schemes as plain text", () => {
    const html = renderToStaticMarkup(
      <TicketMessageText text="[click](javascript:alert(1))" />,
    );
    expect(html).not.toContain("href=");
    expect(html).toContain("javascript:alert(1)");
  });
});
