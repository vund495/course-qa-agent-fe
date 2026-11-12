"use client";

import * as React from "react";
import { RefreshCw, Send, UserCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { TicketsInboxLayout } from "@/components/shared/TicketsInboxLayout";
import { Button } from "@/components/ui/button";
import { addTicketReply } from "@/features/tickets/api";
import {
  TicketOwnerBadge,
  isSystemTicketReply,
} from "@/features/tickets/ticket-owner-badge";
import {
  formatTicketDate,
  TicketStatusBadge,
} from "@/features/tickets/ticket-status-badge";
import { cn } from "@/lib/utils";
import { handoverApi, type AdminQueueItem } from "@/lib/handover-api";
import { AssignTicketModal } from "./assign-ticket-modal";

const FILTERS = [
  { id: "all", label: "All waiting" },
  { id: "unmarked", label: "Nobody marked off" },
];

function formatWaiting(value: string | null): string {
  if (!value) return "just now";
  const started = new Date(value).getTime();
  if (Number.isNaN(started)) return "just now";
  const minutes = Math.max(1, Math.floor((Date.now() - started) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function AdminTicketQueue() {
  const [items, setItems] = React.useState<AdminQueueItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [reply, setReply] = React.useState("");
  const [replyBusy, setReplyBusy] = React.useState(false);
  const [replyError, setReplyError] = React.useState<string | null>(null);
  const [assignItem, setAssignItem] = React.useState<AdminQueueItem | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reload fetch; rows arrive after await.
    setLoading(true);
    setError(null);
    handoverApi
      .adminQueue()
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Could not load the admin queue.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const query = search.trim().toLowerCase();
  const visible = items.filter((item) => {
    if (filter === "unmarked" && item.absent_trainers.length > 0) return false;
    if (!query) return true;
    return [
      item.id,
      item.question,
      item.student_name,
      item.class_code,
      item.owner_trainer_name ?? "",
    ].some((value) => value.toLowerCase().includes(query));
  });
  const selected = visible.find((item) => item.id === selectedId) ?? visible[0] ?? null;

  async function sendReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !reply.trim()) return;
    setReplyBusy(true);
    setReplyError(null);
    try {
      await addTicketReply(selected.id, reply.trim());
      setReply("");
      toast.success("Reply sent. The ticket left the queue.");
      setReloadKey((value) => value + 1);
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Could not send the reply.";
      setReplyError(message);
      toast.error(message);
    } finally {
      setReplyBusy(false);
    }
  }

  const leftContent = (
    <>
      {loading ? (
        <div role="status" aria-label="Loading admin queue" aria-busy="true" className="space-y-3 p-4">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-24 animate-pulse rounded-lg bg-[#F7F7F7]" />
          ))}
        </div>
      ) : error ? (
        <div className="space-y-3 p-4">
          <p role="alert" className="text-sm text-[#9B3A2A]">
            {error}
          </p>
          <Button size="sm" variant="outline" onClick={() => setReloadKey((value) => value + 1)}>
            Retry
          </Button>
        </div>
      ) : visible.length === 0 ? (
        <div className="p-5 text-sm text-[#6F6F6F]">
          <p className="font-medium text-[#111111]">No tickets are waiting for an administrator.</p>
          <p className="mt-1">Every open ticket has a trainer who can answer it.</p>
        </div>
      ) : (
        visible.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={selected?.id === item.id}
            onClick={() => {
              setSelectedId(item.id);
              setReply("");
              setReplyError(null);
            }}
            className={cn(
              "flex w-full flex-col gap-1 border-b border-l-[3px] border-b-[#F0F0F0] px-4 py-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px]",
              selected?.id === item.id
                ? "border-l-[#111111] bg-[#FAFAFA]"
                : "border-l-transparent hover:bg-[#FAFAFA]",
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <TicketStatusBadge status={item.status} />
                <span className="text-[11px] font-medium text-[#9B3A2A]">
                  {formatWaiting(item.queued_for_admin_at)}
                </span>
              </span>
              <time dateTime={item.created_at} className="text-[11px] text-[#6F6F6F]">
                {formatTicketDate(item.created_at)}
              </time>
            </span>
            <span className="mt-1 line-clamp-2 break-words text-sm font-medium text-[#111111]">
              {item.question}
            </span>
            <span className="mt-0.5 text-[11.5px] text-[#5A5A5A]">
              {item.student_name} · {item.class_code}
            </span>
            <TicketOwnerBadge ticket={item} className="mt-1" />
          </button>
        ))
      )}
    </>
  );

  return (
    <div className="flex w-full flex-col gap-4 p-4 md:p-6">
      <TicketsInboxLayout
        title="Ticket Queue"
        subtitle="Tickets no trainer can answer right now. Oldest waits first."
        titleBadge={
          !loading && !error ? (
            <span className="text-xs text-[#DEE8F2]">
              {items.length} waiting
            </span>
          ) : undefined
        }
        headerActions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => setReloadKey((value) => value + 1)}
            disabled={loading}
            className="gap-1 border-[#DEE8F2]/50 bg-transparent text-[#F5F9FF] hover:bg-white/10 hover:text-white"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        }
        searchValue={search}
        searchPlaceholder="Search waiting tickets"
        onSearchChange={setSearch}
        filters={FILTERS}
        activeFilter={filter}
        onFilterChange={setFilter}
        leftListContent={leftContent}
        rightDetailContent={
          selected ? (
            <article className="flex h-full min-h-0 flex-col">
              <header className="border-b border-[#F0E2BC] bg-[#FFF9EA] px-5 py-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <TicketStatusBadge status={selected.status} />
                  <span className="text-xs text-[#5A5A5A]">
                    {selected.class_code} · {selected.class_name}
                  </span>
                  <span className="text-xs text-[#6F6F6F]">by {selected.student_name}</span>
                  <time dateTime={selected.created_at} className="text-xs text-[#6F6F6F]">
                    {formatTicketDate(selected.created_at)}
                  </time>
                </div>
                <h2 className="mt-2 text-lg font-semibold leading-snug text-[#7A5710]">
                  {selected.question}
                </h2>
                <TicketOwnerBadge ticket={selected} className="mt-2" />
                {selected.absent_trainers.length > 0 && (
                  <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-[#8A6414]">
                    <Users className="size-3.5" aria-hidden />
                    All trainers of this class are off:{" "}
                    {selected.absent_trainers.join(", ")}
                  </p>
                )}
              </header>

              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                {selected.agent_answer && (
                  <section className="space-y-1.5">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#6F6F6F]">
                      Agent answer
                    </h3>
                    <blockquote className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-[#E5E5E5] bg-white p-3 text-sm text-[#5A5A5A]">
                      {selected.agent_answer}
                    </blockquote>
                  </section>
                )}

                <section className="space-y-3">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#6F6F6F]">
                    Conversation
                  </h3>
                  {selected.replies.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-[#DADADA] p-3 text-sm text-[#6F6F6F]">
                      No replies yet. You can answer the student directly.
                    </p>
                  ) : (
                    selected.replies.map((item) => {
                      if (isSystemTicketReply(item.message)) {
                        return (
                          <div
                            key={item.id}
                            className="mx-auto max-w-[95%] rounded-lg border border-dashed border-[#D6C48A] bg-[#FFF9EA] px-3.5 py-2.5 text-sm"
                          >
                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#8A6414]">
                              System update
                            </p>
                            <p className="whitespace-pre-wrap break-words text-[#5A4A1F]">
                              {item.message}
                            </p>
                          </div>
                        );
                      }
                      const fromStudent = item.user_id === selected.student_id;
                      return (
                        <div
                          key={item.id}
                          className={cn(
                            "max-w-[85%] rounded-lg border px-3.5 py-2.5 text-sm",
                            fromStudent
                              ? "border-[#E5E5E5] bg-[#F7F7F7]"
                              : "ml-auto border-[#CFE0F7] bg-[#F5F9FF]",
                          )}
                        >
                          <p className="mb-1 text-[11px] font-semibold text-[#5A5A5A]">
                            {fromStudent ? "Student" : "Staff"}
                          </p>
                          <p className="whitespace-pre-wrap break-words text-[#111111]">
                            {item.message}
                          </p>
                          <time
                            dateTime={item.created_at}
                            className="mt-1 block text-[10px] text-[#6F6F6F]"
                          >
                            {formatTicketDate(item.created_at)}
                          </time>
                        </div>
                      );
                    })
                  )}

                  <form
                    className="space-y-2 rounded-lg border border-[#DADADA] p-3"
                    onSubmit={sendReply}
                  >
                    <label
                      className="block space-y-1 text-sm font-medium text-[#111111]"
                      htmlFor="admin-ticket-reply"
                    >
                      Reply to student
                      <textarea
                        id="admin-ticket-reply"
                        rows={3}
                        maxLength={10000}
                        value={reply}
                        onChange={(event) => setReply(event.target.value)}
                        placeholder="Write a reply…"
                        className="mt-1 w-full resize-y rounded-md border border-[#DADADA] px-3 py-2 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      />
                    </label>
                    {replyError && (
                      <p role="alert" className="text-sm text-[#9B3A2A]">
                        {replyError}
                      </p>
                    )}
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setAssignItem(selected)}
                        className="gap-1.5"
                      >
                        <UserCheck className="size-3.5" />
                        Assign…
                      </Button>
                      <Button type="submit" disabled={replyBusy || !reply.trim()} className="gap-1.5">
                        <Send className="size-3.5" />
                        {replyBusy ? "Sending…" : "Reply"}
                      </Button>
                    </div>
                  </form>
                </section>
              </div>

              <footer className="border-t border-[#E5E5E5] bg-white px-5 py-3 text-xs text-[#6F6F6F]">
                Queued {formatWaiting(selected.queued_for_admin_at)}. Replying answers the student
                and clears the queue flag.
              </footer>
            </article>
          ) : (
            <div className="p-6 text-sm text-[#6F6F6F]">
              Select a queued ticket to read it.
            </div>
          )
        }
      />

      <AssignTicketModal
        isOpen={!!assignItem}
        onClose={() => setAssignItem(null)}
        item={assignItem}
        onAssigned={() => setReloadKey((value) => value + 1)}
      />
    </div>
  );
}
