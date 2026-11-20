"use client";

import { MarkdownContent } from "@/components/shared/MarkdownContent";
import { cn } from "@/lib/utils";

/**
 * Read-only snapshot of the AI answer attached to a ticket.
 *
 * Only a ticket created from a saved chat answer has ``source_message_id``;
 * that answer is Markdown and gets the same code-block surface as chat. A
 * selection-created ticket stores the selected plain text in the same field,
 * so it must stay literal (Markdown characters, indentation and HTML-looking
 * text included). When the source chat message is deleted the FK is SET NULL,
 * so the ticket falls back to the same plain-text rendering.
 */
export function TicketAgentAnswer({
  content,
  sourceMessageId,
  className,
}: {
  content: string;
  sourceMessageId?: string | null;
  className?: string;
}) {
  if (!sourceMessageId) {
    return (
      <div
        className={cn(
          "max-h-44 overflow-y-auto rounded-lg border border-[#E5E5E5] bg-white p-3 text-sm leading-relaxed text-[#5A5A5A]",
          className,
        )}
      >
        <p className="whitespace-pre-wrap break-words">{content}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "max-h-44 overflow-y-auto overflow-x-auto rounded-lg border border-[#E5E5E5] bg-white p-3",
        className,
      )}
    >
      <MarkdownContent content={content} allowImages={false} />
    </div>
  );
}
