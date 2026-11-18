"use client";

import { cn } from "@/lib/utils";
import { isSystemReply } from "@/lib/handover-api";
import { TicketAttachmentList } from "./ticket-attachment-list";
import { TicketMessageText } from "./ticket-rich-text";
import type { TicketAttachment } from "./api";

/**
 * Helpdesk-style thread used by both the student and the teacher ticket pages.
 * Presentation only: callers keep their existing fetch/send handlers and just
 * hand over the messages (plus status for the closed notice).
 */

type TicketThreadTone = "requester" | "staff";

export type TicketThreadEntry = {
  id: string;
  authorName: string;
  createdAt: string;
  message: string;
  attachments?: TicketAttachment[];
  /** Requester = blue header, staff reply = green header. */
  tone: TicketThreadTone;
};

const TONE: Record<TicketThreadTone, { header: string; avatar: string }> = {
  requester: {
    header: "bg-[#3B7DBE]",
    avatar: "bg-[#E4EFF9] text-[#2A5D8F]",
  },
  staff: {
    header: "bg-[#3E9A55]",
    avatar: "bg-[#E7F5EB] text-[#2C7A43]",
  },
};

/** dd/MM/yyyy HH:mm, the stamp used in the design. */
function formatThreadStamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function initialsForName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[words.length - 2][0]}${words[words.length - 1][0]}`.toUpperCase();
}

function ThreadAvatar({ name, tone }: { name: string; tone: TicketThreadTone }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "mt-[3px] flex size-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold",
        TONE[tone].avatar,
      )}
    >
      {initialsForName(name)}
    </span>
  );
}

function SystemReply({ entry }: { entry: TicketThreadEntry }) {
  return (
    <div className="mx-auto w-fit max-w-[95%] rounded-2xl border border-dashed border-[#D6C48A] bg-[#FFF9EA] px-3.5 py-2.5 text-sm">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#8A6414]">
        System update
      </p>
      <p className="whitespace-pre-wrap break-words text-[#5A4A1F]">{entry.message}</p>
      <time dateTime={entry.createdAt} className="mt-1 block text-[10px] text-[#8A7A55]">
        {formatThreadStamp(entry.createdAt)}
      </time>
    </div>
  );
}

function TicketThreadMessage({
  entry,
  closedBy,
  showClosedNotice = false,
}: {
  entry: TicketThreadEntry;
  closedBy?: string | null;
  showClosedNotice?: boolean;
}) {
  if (isSystemReply(entry.message)) return <SystemReply entry={entry} />;

  const tone = TONE[entry.tone];
  return (
    <div className="flex items-start gap-3">
      <ThreadAvatar name={entry.authorName} tone={entry.tone} />
      <div className="min-w-0 flex-1">
        <div className="overflow-hidden rounded-sm border border-[#E0E0E0] bg-white">
          <div
            className={cn(
              "flex flex-wrap items-baseline gap-x-2 px-4 py-2 text-[13px] font-semibold text-white",
              tone.header,
            )}
          >
            <span className="break-words">{entry.authorName}</span>
            <span className="text-[12px] font-normal text-white/85">
              sent {formatThreadStamp(entry.createdAt)}
            </span>
          </div>
          <div className="px-4 py-3">
            <TicketMessageText text={entry.message} className="text-[#222222]" />
            <TicketAttachmentList attachments={entry.attachments} compact />
          </div>
        </div>
        {showClosedNotice && (
          <div className="mt-1 rounded-sm border border-[#E5E5E5] bg-[#F7F7F7] px-4 py-2 text-[12.5px] text-[#5A5A5A]">
            Closed{closedBy ? ` by ${closedBy}` : ""} · Status:{" "}
            <span className="font-semibold text-[#111111]">Closed</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function TicketThread({
  entries,
  emptyText,
  closedBy,
  closed = false,
}: {
  entries: TicketThreadEntry[];
  emptyText?: string;
  closedBy?: string | null;
  /** The gray "Closed · Status: Closed" bar sits under the last message. */
  closed?: boolean;
}) {
  const visible = entries.filter((entry) => entry.message.trim().length > 0 || entry.attachments?.length);
  if (visible.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-[#DADADA] p-3 text-sm text-[#6F6F6F]">
        {emptyText ?? "No messages yet."}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {visible.map((entry, index) => (
        <TicketThreadMessage
          key={entry.id}
          entry={entry}
          closedBy={closedBy}
          showClosedNotice={closed && index === visible.length - 1}
        />
      ))}
    </div>
  );
}
