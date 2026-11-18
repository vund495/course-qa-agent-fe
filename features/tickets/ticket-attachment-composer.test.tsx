// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("./api", () => ({
  TICKET_ATTACHMENT_LIMIT: 3,
  TICKET_IMAGE_MAX_BYTES: 5 * 1024 * 1024,
  TICKET_IMAGE_TYPES: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  uploadTicketAttachments: vi.fn(),
  deleteTicketAttachment: vi.fn(),
}));

import type { PendingTicketAttachment } from "./ticket-attachment-composer";
import { TicketAttachmentComposer } from "./ticket-attachment-composer";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function Harness() {
  const [message, setMessage] = React.useState("");
  const [attachments] = React.useState<PendingTicketAttachment[]>([]);
  return (
    <form>
      <textarea
        aria-label="message"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
      />
      <TicketAttachmentComposer
        ticketId="ticket-1"
        value={attachments}
        onChange={() => undefined}
        compact
      />
    </form>
  );
}

describe("TicketAttachmentComposer emoji panel", () => {
  it("opens a panel and inserts the picked emoji into the reply text", async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    // animate-ui's anchored popover reads the OS reduced-motion preference.
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<Harness />);
    });

    const textarea = container.querySelector("textarea");
    if (!textarea) throw new Error("textarea did not render");
    textarea.setSelectionRange(0, 0);

    const emojiTrigger = container.querySelector<HTMLButtonElement>('[title="Insert emoji"]');
    expect(emojiTrigger).not.toBeNull();
    await act(async () => {
      emojiTrigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // The panel mirrors the Windows picker: recent row + category tabs + grid.
    expect(document.body.textContent).toContain("Recent");
    expect(document.body.textContent).toContain("Smileys & emotion");

    const pick = document.querySelector<HTMLButtonElement>('[title="😀"]');
    expect(pick).not.toBeNull();
    await act(async () => {
      pick?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(textarea.value).toBe("😀");
    expect(textarea.selectionStart).toBe(2);
    expect(document.activeElement).toBe(textarea);
    expect(
      document.querySelector('[data-slot="popover-content"]')?.getAttribute("data-state"),
    ).toBe("closed");

    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });
});
