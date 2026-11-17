"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { insertTextIntoTextarea } from "./text-insert";
import { TicketReplyToolbar } from "./ticket-rich-text";
import { TicketAttachmentComposer, type PendingTicketAttachment } from "./ticket-attachment-composer";

/**
 * The reply box from the support-thread design: formatting rail, composer,
 * file hint and the send row. Everything it sends still goes through the
 * existing `addTicketReply` call — this component is presentation plus local
 * draft state only.
 */
export function TicketReplyPanel({
  ticketId,
  heading = "Post a reply",
  hint = "To get the best support, please be as specific and detailed as possible.",
  value,
  onChange,
  pendingAttachments,
  onAttachmentsChange,
  busy = false,
  error,
  submitLabel,
  busyLabel = "Sending reply…",
  onSubmit,
}: {
  ticketId: string;
  heading?: string;
  hint?: string;
  value: string;
  onChange: (next: string) => void;
  pendingAttachments: PendingTicketAttachment[];
  onAttachmentsChange: (next: PendingTicketAttachment[]) => void;
  busy?: boolean;
  error?: string | null;
  submitLabel: string;
  busyLabel?: string;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [attachmentUploading, setAttachmentUploading] = React.useState(false);

  function insertFormatting(textarea: HTMLTextAreaElement, before: string, after: string) {
    const { selectionStart, selectionEnd, value: current } = textarea;
    const selected = current.slice(selectionStart ?? 0, selectionEnd ?? 0);
    const inserted = `${before}${selected}${after}`;
    if (!insertTextIntoTextarea(textarea, inserted)) return;
    // Keep a selection wrapped, otherwise drop the caret between the markers.
    if (selected) {
      textarea.setSelectionRange(
        (selectionStart ?? 0) + before.length,
        (selectionStart ?? 0) + before.length + selected.length,
      );
    } else if (after) {
      const caret = (selectionStart ?? 0) + before.length;
      textarea.setSelectionRange(caret, caret);
    }
    onChange(textarea.value);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 border-t border-[#E5E5E5] pt-5"
      aria-busy={busy}
    >
      <div>
        <h3 className="text-[21px] font-semibold leading-tight text-[#111111]">{heading}</h3>
        <p className="mt-1 text-[13px] italic text-[#5A5A5A]">{hint}</p>
      </div>

      <div className="overflow-hidden rounded-sm border border-[#CFCFCF] bg-white focus-within:border-[#8A8A8A]">
        <TicketReplyToolbar textareaRef={textareaRef} onInsert={insertFormatting} />
        <textarea
          ref={textareaRef}
          rows={7}
          maxLength={10000}
          value={value}
          disabled={busy}
          onChange={(event) => onChange(event.target.value)}
          className="block w-full resize-y border-0 px-3 py-3 text-sm leading-relaxed outline-none disabled:bg-[#FAFAFA]"
          aria-label={heading}
        />
        <div className="border-t border-dashed border-[#DADADA] bg-[#FAFAFA] px-3 py-2 text-[12.5px] text-[#8A8A8A]">
          Attach up to 3 images · PNG, JPEG, WEBP or GIF · max 5 MB each
        </div>
      </div>

      <TicketAttachmentComposer
        ticketId={ticketId}
        value={pendingAttachments}
        onChange={onAttachmentsChange}
        disabled={busy}
        compact
        onUploadingChange={setAttachmentUploading}
      />

      <p className="text-[13px] text-[#5A5A5A]">Your reply will reopen the message thread</p>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="submit"
          disabled={
            busy || attachmentUploading || (!value.trim() && pendingAttachments.length === 0)
          }
          className={cn(
            "rounded-sm bg-[#3E9A55] px-4 py-1.5 text-[13px] font-semibold text-white transition-colors",
            "hover:bg-[#348748] focus-visible:outline-2 focus-visible:outline-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {busy ? busyLabel : attachmentUploading ? "Uploading image…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
