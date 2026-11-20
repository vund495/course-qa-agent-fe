"use client";

import * as React from "react";
import { TicketCitations } from './ticket-citations';
import { TicketAgentAnswer } from './ticket-agent-answer';
import { TicketsInboxLayout } from "@/components/shared/TicketsInboxLayout";
import { AppSelect, type AppSelectOption } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { studentApi, type StudentClass } from "@/lib/student-api";
import { cn } from "@/lib/utils";
import { formatHandoverTime, handoverReasonLabel } from "@/lib/handover-api";
import { profileApi } from "@/features/profile/api";
import { HandoverInbox } from "@/features/handover/handover-inbox";
import { TicketOwnerBadge } from "./ticket-owner-badge";
import {
  addTicketReply,
  getTicket,
  getTicketCounts,
  listTickets,
  reopenTicket,
  resolveTicket,
  type Ticket,
  type TicketCounts,
  type TicketInboxItem,
  type TicketList,
} from "./api";
import {
  ArchivedClassBadge,
  formatTicketDate,
  getTicketStatusTheme,
  TicketStatusBadge,
} from "./ticket-status-badge";
import { type PendingTicketAttachment } from "./ticket-attachment-composer";
import { TicketReplyPanel } from "./ticket-reply-panel";
import { TicketThread, type TicketThreadEntry } from "./ticket-thread";

const FILTERS = [
  { id: "OPEN", label: "Open" },
  { id: "ANSWERED", label: "Answered" },
  { id: "RESOLVED", label: "Resolved" },
  { id: "EXPIRED", label: "Expired" },
  { id: "all", label: "All" },
];

type ClassOption = {
  id: string;
  code: string;
  name: string;
  status?: string;
  openCount?: number;
  completedCount?: number;
};

function classCountText(option: ClassOption): string | undefined {
  const parts: string[] = [];
  if (option.status === "ARCHIVED") parts.push("Archived");
  if (option.openCount !== undefined) {
    parts.push(`${option.openCount} open · ${option.completedCount ?? 0} completed`);
  }
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

/**
 * Empty-inbox copy. The trainer inbox is owner-scoped (AI-83), so an empty
 * list usually means nothing was sent to this trainer yet — not that a filter
 * hid the rows. `ownedTotal` is the sum of the trainer's own class counts and
 * lets the empty state stay truthful under a status filter such as Open.
 */
export function ticketInboxEmptyCopy({
  search,
  filter,
  total,
  ownedTotal,
}: {
  search: string;
  filter: Ticket["status"] | "all";
  total: number;
  ownedTotal?: number;
}): { title: string; hint?: string } {
  if (search.trim()) {
    return { title: "No tickets match this search on this page." };
  }
  const nothingOwned = (ownedTotal ?? (filter === "all" ? total : undefined)) === 0;
  if (nothingOwned) {
    return {
      title: "No tickets have been sent to you yet.",
      hint:
        "Student questions go to the trainer they were sent to. A ticket appears here after it is handed over to you.",
    };
  }
  return { title: "No tickets match this filter." };
}

export function TicketInbox() {
  const [classes, setClasses] = React.useState<StudentClass[]>([]);
  const [classId, setClassId] = React.useState("");
  const [classesLoaded, setClassesLoaded] = React.useState(false);
  // A bell notification links to ?ticket_id=…, which may point at an answered or
  // resolved ticket; default to "All" so that ticket is actually in the list.
  const [filter, setFilter] = React.useState<Ticket["status"] | "all">(() =>
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("ticket_id")
      ? "all"
      : "OPEN",
  );
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<TicketList | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [classError, setClassError] = React.useState<string | null>(null);
  const [retry, setRetry] = React.useState(0);
  const [search, setSearch] = React.useState("");
  const [reply, setReply] = React.useState("");
  const [pendingAttachments, setPendingAttachments] = React.useState<PendingTicketAttachment[]>([]);
  const [replyBusy, setReplyBusy] = React.useState(false);
  const [replyError, setReplyError] = React.useState<string | null>(null);
  const [counts, setCounts] = React.useState<TicketCounts | null>(null);
  const [countsError, setCountsError] = React.useState<string | null>(null);
  const [statusBusy, setStatusBusy] = React.useState(false);
  const [statusError, setStatusError] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("ticket_id"),
  );
  // A linked ticket is kept around when it is not on the current list page
  // (bell link to an older ticket), so the detail pane still shows it.
  const [linkedTicket, setLinkedTicket] = React.useState<TicketInboxItem | null>(null);
  // Who closed the ticket during this session; unknown after a reload, and an
  // invented name would be worse than none.
  const [resolvedBy, setResolvedBy] = React.useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);

  function clearPendingAttachments() {
    setPendingAttachments((current) => {
      current.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      return [];
    });
  }

  React.useEffect(() => {
    let cancelled = false;
    profileApi
      .me()
      .then((me) => {
        if (!cancelled) setCurrentUserId(me.id);
      })
      .catch(() => {
        // The owner badge falls back to the owner's name when /me is unavailable.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    studentApi
      .classes()
      .then((result) => {
        if (!cancelled) {
          setClasses(result);
          setClassError(null);
          // An archived class is no longer selectable; keep the picker on a
          // live class (or "all") instead of showing a stale URL class.
          setClassId((current) =>
            result.some((item) => item.id === current && item.status !== "ARCHIVED")
              ? current
              : "",
          );
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setClassError(cause instanceof Error ? cause.message : "Could not load classes.");
        }
      })
      .finally(() => {
        if (!cancelled) setClassesLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [retry]);

  React.useEffect(() => {
    // Wait until archived classes have been filtered out of the URL state so
    // we never request the inbox for a class the trainer can no longer see.
    if (!classesLoaded) return;
    let cancelled = false;
    listTickets({
      class_id: classId || undefined,
      status: filter === "all" ? undefined : filter,
      page,
    })
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Could not load tickets.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [classId, filter, page, retry, classesLoaded]);

  React.useEffect(() => {
    let cancelled = false;
    getTicketCounts()
      .then((result) => {
        if (!cancelled) {
          setCounts(result);
          setCountsError(null);
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setCountsError(
            cause instanceof Error ? cause.message : "Could not load ticket counts.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [retry]);

  // The trainer inbox has no other refresh path (the manual Refresh button is
  // gone), so poll lightly and refresh when the tab regains focus.
  React.useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") setRetry((value) => value + 1);
    };
    const timer = window.setInterval(refresh, 25_000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  function startRequest({ soft = false }: { soft?: boolean } = {}) {
    // Filter/search refreshes keep the previous rows on screen so switching
    // tabs does not flash a skeleton. Only error retries reload from scratch.
    if (!soft) setLoading(true);
    setError(null);
    setSelectedId(null);
    setLinkedTicket(null);
    setResolvedBy(null);
    setSearch("");
    setStatusError(null);
  }

  const classOptions: ClassOption[] = React.useMemo(() => {
    if (counts?.items.length) {
      return counts.items.map((item) => ({
        id: item.class_id,
        code: item.class_code,
        name: item.class_name,
        status: item.class_status,
        openCount: item.open_count,
        completedCount: item.completed_count,
      }));
    }
    return classes
      .filter((item) => item.status !== "ARCHIVED")
      .map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        status: item.status,
      }));
  }, [counts, classes]);


  const query = search.trim().toLowerCase();
  const ownedTotal = counts
    ? counts.items.reduce(
        (sum, item) => sum + item.open_count + item.completed_count + item.expired_count,
        0,
      )
    : undefined;
  const emptyCopy = ticketInboxEmptyCopy({ search, filter, total: data?.total ?? 0, ownedTotal });
  const visible = error
    ? []
    : (data?.items ?? []).filter(
        (ticket) =>
          !query ||
          [ticket.id, ticket.question, ticket.student_name, ticket.class_code].some((value) =>
            value.toLowerCase().includes(query),
          ),
      );
  // A bell link can point at a ticket that is not on this page/filter; fetch it
  // directly instead of silently falling back to the first row.
  React.useEffect(() => {
    if (!selectedId || !data || data.items.some((ticket) => ticket.id === selectedId)) return;
    let cancelled = false;
    void getTicket(selectedId)
      .then((ticket) => {
        if (cancelled) return;
        const clazz = classes.find((item) => item.id === ticket.class_id);
        setLinkedTicket({
          ...ticket,
          student_name: "",
          class_name: clazz?.name ?? "",
          class_code: clazz?.code ?? "",
          class_status: clazz?.status ?? "ACTIVE",
        });
      })
      .catch(() => {
        if (!cancelled) setLinkedTicket(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, data, classes]);

  const selected = selectedId
    ? (visible.find((ticket) => ticket.id === selectedId) ??
      (linkedTicket?.id === selectedId ? linkedTicket : undefined))
    : visible[0];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.page_size ?? 20)));
  const classSelectOptions: AppSelectOption[] = React.useMemo(
    () => [
      {
        value: "",
        label: "All assigned classes",
        description: counts
          ? `${counts.open_total} open · ${counts.completed_total} completed`
          : undefined,
      },
      ...classOptions.map((item) => ({
        value: item.id,
        label: `${item.code} · ${item.name}`,
        description: classCountText(item),
      })),
    ],
    [classOptions, counts],
  );
  // Archived classes are removed from the picker; fall back to "all" if the
  // current URL still points at one.
  const classSelectValue = classSelectOptions.some((item) => item.value === classId)
    ? classId
    : "";

  const studentName = selected?.student_name?.trim() || "Student";
  const staffName =
    selected?.owner_trainer_name?.trim() ||
    selected?.escalated_to_name?.trim() ||
    "Support teacher";

  async function changeStatus(action: "resolve" | "reopen") {
    if (!selected) return;
    setStatusBusy(true);
    setStatusError(null);
    try {
      if (action === "resolve") {
        await resolveTicket(selected.id);
        setResolvedBy(staffName);
      } else {
        await reopenTicket(selected.id);
        setResolvedBy(null);
      }
      // Keep the ticket in view after its status changes.
      if (filter !== "all") {
        setFilter(action === "resolve" ? "RESOLVED" : "ANSWERED");
        setPage(1);
      }
      setRetry((value) => value + 1);
    } catch (cause) {
      setStatusError(cause instanceof Error ? cause.message : "Could not update the ticket.");
    } finally {
      setStatusBusy(false);
    }
  }

  const threadEntries: TicketThreadEntry[] = selected
    ? [
        {
          id: `ticket-${selected.id}`,
          authorName: studentName,
          createdAt: selected.created_at,
          message: selected.question,
          tone: "requester",
        },
        ...selected.replies.map((item) => {
          const fromStudent = item.user_id === selected.student_id;
          return {
            id: item.id,
            authorName:
              item.author_name?.trim() || (fromStudent ? studentName : staffName),
            createdAt: item.created_at,
            message: item.message,
            attachments: item.attachments,
            tone: fromStudent ? ("requester" as const) : ("staff" as const),
          };
        }),
      ]
    : [];

  const leftContent = (
    <>
      {loading ? (
        <div role="status" aria-label="Loading tickets" aria-busy="true" className="space-y-3 p-4">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-24 animate-pulse rounded-lg bg-[#F7F7F7]" />
          ))}
        </div>
      ) : error ? (
        <div className="space-y-3 p-4">
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
          <Button
            variant="outline"
            onClick={() => {
              startRequest();
              setRetry((value) => value + 1);
            }}
          >
            Retry
          </Button>
        </div>
      ) : visible.length === 0 ? (
        <div role="status" className="space-y-1 p-4 text-sm text-[#6F6F6F]">
          <p className={emptyCopy.hint ? "font-medium text-[#111111]" : undefined}>
            {emptyCopy.title}
          </p>
          {emptyCopy.hint ? <p>{emptyCopy.hint}</p> : null}
        </div>
      ) : (
        visible.map((ticket) => (
          <button
            key={ticket.id}
            type="button"
            aria-pressed={selected?.id === ticket.id}
            onClick={() => {
              setSelectedId(ticket.id);
              setLinkedTicket(null);
              setResolvedBy(null);
              setReply("");
              clearPendingAttachments();
              setReplyError(null);
              setStatusError(null);
            }}
            className={cn(
              "flex w-full flex-col gap-1 border-b border-l-[3px] border-b-[#F0F0F0] px-4 py-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px]",
              selected?.id === ticket.id
                ? "border-l-[#111111] bg-[#FAFAFA]"
                : "border-l-transparent hover:bg-[#FAFAFA]",
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <TicketStatusBadge status={ticket.status} />
              <time dateTime={ticket.created_at} className="text-[11px] text-[#6F6F6F]">
                {formatTicketDate(ticket.created_at)}
              </time>
            </span>
            <span className="mt-1 line-clamp-2 break-words text-sm font-medium text-[#111111]">
              {ticket.question}
            </span>
            <span className="mt-0.5 text-[11.5px] text-[#5A5A5A]">
              {ticket.student_name} · {ticket.class_code}
              {ticket.class_status === "ARCHIVED" ? " · Archived" : ""} ·{" "}
              {ticket.replies.length} {ticket.replies.length === 1 ? "message" : "messages"}
            </span>
            <TicketOwnerBadge
              ticket={ticket}
              currentUserId={currentUserId}
              className="mt-1"
            />
          </button>
        ))
      )}
      <nav
        aria-label="Ticket pagination"
        className="flex flex-wrap items-center justify-between gap-2 border-t border-[#F0F0F0] p-3"
      >
        <Button
          size="sm"
          variant="outline"
          disabled={loading || !!error || page <= 1}
          onClick={() => {
            startRequest({ soft: true });
            setPage((value) => value - 1);
          }}
        >
          Previous
        </Button>
        <span role="status" className="text-xs text-[#5A5A5A]">
          Page {page} of {totalPages}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={loading || !!error || page >= totalPages}
          onClick={() => {
            startRequest({ soft: true });
            setPage((value) => value + 1);
          }}
        >
          Next
        </Button>
      </nav>
    </>
  );

  return (
    <div className="flex flex-1 flex-col gap-4">
      {(classError || countsError) && (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-red-700">
          {classError || countsError}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              startRequest();
              setRetry((value) => value + 1);
            }}
          >
            Retry
          </Button>
        </div>
      )}
      <HandoverInbox onAnswered={() => setRetry((value) => value + 1)} />
      <TicketsInboxLayout
        title="Class Tickets"
        subtitle="Student questions sent to you. Newest first."
        titleBadge={
          !loading && !error && data ? (
            <span className="text-xs text-[#DEE8F2]">
              {data.total} {data.total === 1 ? "ticket" : "tickets"}
            </span>
          ) : undefined
        }
        headerActions={
          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor="inbox-class"
              className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-[#DEE8F2]"
            >
              Class
              <AppSelect
                id="inbox-class"
                value={classSelectValue}
                onValueChange={(value) => {
                  startRequest({ soft: true });
                  setClassId(value);
                  setPage(1);
                }}
                options={classSelectOptions}
                placeholder="All assigned classes"
                aria-label="Filter tickets by class"
                size="sm"
                triggerClassName="w-[420px] max-w-full"
                contentClassName="w-[var(--radix-select-trigger-width)] min-w-0"
                renderValue={(option) =>
                  option ? (
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="whitespace-nowrap">{option.label}</span>
                      {option.description ? (
                        <span className="shrink-0 text-[11px] font-normal text-[#6F6F6F]">
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                  ) : undefined
                }
              />
            </label>
          </div>
        }
        searchValue={search}
        searchPlaceholder="Search this page"
        onSearchChange={setSearch}
        filters={FILTERS}
        activeFilter={filter}
        onFilterChange={(value) => {
          if (value === filter) return;
          startRequest({ soft: true });
          setFilter(value as Ticket["status"] | "all");
          setPage(1);
        }}
        leftListContent={leftContent}
        rightDetailContent={
          selected ? (
            <article className="flex h-full min-h-0 flex-col">
              <header
                className={cn(
                  "border-b px-5 py-4",
                  getTicketStatusTheme(selected.status).headerClassName,
                )}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <TicketStatusBadge status={selected.status} />
                  <span className="text-xs text-[#5A5A5A]">
                    {selected.class_code} · {selected.class_name}
                  </span>
                  {selected.class_status === "ARCHIVED" && <ArchivedClassBadge />}
                  {selected.student_name && (
                    <span className="text-xs text-[#6F6F6F]">by {selected.student_name}</span>
                  )}
                  <time dateTime={selected.created_at} className="text-xs text-[#6F6F6F]">
                    {formatTicketDate(selected.created_at)}
                  </time>
                  <span className="ml-auto break-all font-mono text-[10px] text-[#6F6F6F]">
                    Ticket {selected.id}
                  </span>
                </div>
                <div className="mt-2 space-y-1 text-xs text-[#5A5A5A]">
                  {selected.owner_trainer_name && (
                    <p>
                      <span className="font-semibold text-[#111111]">Owner</span>{" "}
                      {selected.owner_trainer_id === currentUserId
                        ? "you"
                        : selected.owner_trainer_name}
                    </p>
                  )}
                  {selected.queued_for_admin_at && (
                    <p className="font-semibold text-[#9B3A2A]">
                      Waiting for an administrator since{" "}
                      {formatTicketDate(selected.queued_for_admin_at)}
                    </p>
                  )}
                  {selected.handover_from_name && (
                    <p>
                      <span className="font-semibold text-[#111111]">Handover</span> from{" "}
                      {selected.handover_from_name}
                      {selected.handover_reason
                        ? ` · ${handoverReasonLabel(selected.handover_reason)}`
                        : ""}
                      {selected.handover_at
                        ? ` · ${formatHandoverTime(selected.handover_at)}`
                        : ""}
                    </p>
                  )}
                  {selected.escalated_to_name && !selected.owner_trainer_name && (
                    <p className="text-muted-foreground">Escalated to {selected.escalated_to_name}</p>
                  )}
                </div>
              </header>

              <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
                {selected.original_question && (
                  <section className="space-y-1.5">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#6F6F6F]">
                      Student&apos;s original question
                    </h3>
                    <p className="whitespace-pre-wrap break-words rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] p-3 text-sm text-[#333333]">
                      {selected.original_question}
                    </p>
                  </section>
                )}

                <TicketCitations citations={selected.citations} />
                {selected.agent_answer && (
                  <section className="space-y-1.5">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#6F6F6F]">
                      Agent answer
                    </h3>
                    <TicketAgentAnswer content={selected.agent_answer} sourceMessageId={selected.source_message_id} />
                  </section>
                )}

                <section className="space-y-4">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#6F6F6F]">
                    Conversation
                  </h3>
                  <TicketThread
                    entries={threadEntries}
                    closed={selected.status === "RESOLVED"}
                    closedBy={resolvedBy}
                    emptyText="No replies yet. Write the first answer."
                  />

                  {(selected.status === "OPEN" || selected.status === "ANSWERED") && (
                    <TicketReplyPanel
                      ticketId={selected.id}
                      heading="Answer the student"
                      hint="Add details or attachments. You can keep replying until the student confirms it is resolved."
                      value={reply}
                      onChange={setReply}
                      pendingAttachments={pendingAttachments}
                      onAttachmentsChange={setPendingAttachments}
                      busy={replyBusy}
                      error={replyError}
                      submitLabel="Send answer"
                      onSubmit={async (event) => {
                        event.preventDefault();
                        const message = reply.trim();
                        const attachmentIds = pendingAttachments.map((item) => item.id);
                        if (!message && attachmentIds.length === 0) return;
                        setReplyBusy(true);
                        setReplyError(null);
                        try {
                          await addTicketReply(selected.id, message, attachmentIds);
                          setReply("");
                          clearPendingAttachments();
                          // Keep the answered ticket visible in the inbox.
                          if (filter === "OPEN") {
                            setFilter("ANSWERED");
                            setPage(1);
                          }
                          setRetry((value) => value + 1);
                        } catch (cause) {
                          setReplyError(
                            cause instanceof Error ? cause.message : "Could not send your answer.",
                          );
                        } finally {
                          setReplyBusy(false);
                        }
                      }}
                    />
                  )}
                </section>
              </div>

              <footer className="border-t border-[#E5E5E5] bg-white px-5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-[#6F6F6F]">
                    {selected.status === "OPEN" &&
                      (selected.queued_for_admin_at
                        ? "Waiting for an administrator to pick this up."
                        : "Waiting for your answer.")}
                    {selected.status === "ANSWERED" &&
                      "Answered. Keep replying if the student needs more, or mark it resolved when they no longer need help."}
                    {selected.status === "RESOLVED" && "This ticket is completed."}
                    {selected.status === "EXPIRED" &&
                      "This ticket expired after seven days without an answer."}
                  </p>
                  <div className="flex items-center gap-2">
                    {(selected.status === "OPEN" || selected.status === "ANSWERED") && (
                      <Button
                        type="button"
                        disabled={statusBusy}
                        onClick={() => void changeStatus("resolve")}
                      >
                        {statusBusy ? "Saving…" : "Mark resolved"}
                      </Button>
                    )}
                    {selected.status === "RESOLVED" && (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={statusBusy}
                        onClick={() => void changeStatus("reopen")}
                      >
                        {statusBusy ? "Saving…" : "Reopen ticket"}
                      </Button>
                    )}
                  </div>
                </div>
                {statusError && (
                  <p role="alert" className="mt-2 text-sm text-red-700">
                    {statusError}
                  </p>
                )}
              </footer>
            </article>
          ) : (
            <div className="p-6 text-sm text-[#6F6F6F]">
              Select a ticket from the list to read it.
            </div>
          )
        }
      />
    </div>
  );
}
