"use client";

import * as React from "react";
import { ArrowRightLeft, CalendarRange, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/ui/button";
import { profileApi } from "@/features/profile/api";
import {
  formatHandoverTime,
  formatLeaveRange,
  handoverApi,
  handoverReasonLabel,
  type Handover,
  type LeaveRequest,
} from "@/lib/handover-api";

type RejectTarget =
  | { kind: "handover"; item: Handover }
  | { kind: "leave"; item: LeaveRequest };

function dayCount(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00`).getTime();
  const end = new Date(`${to}T00:00:00`).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.max(1, Math.round((end - start) / 86_400_000) + 1);
}

export function HandoverInbox({ onAnswered }: { onAnswered?: () => void }) {
  const [handovers, setHandovers] = React.useState<Handover[]>([]);
  const [leaves, setLeaves] = React.useState<LeaveRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [rejectTarget, setRejectTarget] = React.useState<RejectTarget | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount/reload fetch; rows arrive after await.
    setLoading(true);
    setError(null);
    Promise.all([
      profileApi.me().catch(() => null),
      handoverApi.listHandovers().catch(() => []),
      handoverApi.listLeaves().catch(() => []),
    ])
      .then(([me, pendingHandovers, myLeaves]) => {
        if (cancelled) return;
        setHandovers(pendingHandovers);
        setLeaves(
          me
            ? myLeaves.filter(
                (leave) =>
                  leave.status === "pending" && leave.target_trainer_id === me.id,
              )
            : [],
        );
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Could not load your requests.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const total = handovers.length + leaves.length;

  async function respondHandover(item: Handover, action: "accept" | "reject") {
    setBusyId(item.id);
    try {
      if (action === "accept") await handoverApi.acceptHandover(item.id);
      else await handoverApi.rejectHandover(item.id);
      toast.success(action === "accept" ? "Ticket accepted." : "Handover rejected.");
      setRejectTarget(null);
      setReloadKey((value) => value + 1);
      onAnswered?.();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not answer the handover.");
    } finally {
      setBusyId(null);
    }
  }

  async function respondLeave(item: LeaveRequest, action: "accept" | "reject") {
    setBusyId(item.id);
    try {
      await handoverApi.respondLeave(item.id, action);
      toast.success(
        action === "accept"
          ? "Leave accepted. Open tickets will be handed over."
          : "Leave rejected. The automatic handover rule will run.",
      );
      setRejectTarget(null);
      setReloadKey((value) => value + 1);
      onAnswered?.();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not answer the leave request.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-[#DADADA] bg-white p-4 text-sm text-[#6F6F6F]">
        Loading handovers and leave requests…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#F3C9C2] bg-[#FEF4F2] p-4 text-sm text-[#9B3A2A]">
        <span className="flex-1">{error}</span>
        <Button size="sm" variant="outline" onClick={() => setReloadKey((value) => value + 1)}>
          Retry
        </Button>
      </div>
    );
  }

  if (total === 0) return null;

  return (
    <section className="space-y-3" aria-label="Requests that need your answer">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[#111111]">Needs your answer</h2>
        <span className="rounded-full border border-[#E5E5E5] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#5A5A5A]">
          {total} {total === 1 ? "item" : "items"}
        </span>
      </div>

      {handovers.map((item) => (
        <article
          key={item.id}
          className="rounded-xl border border-[#CFE0F7] bg-[#F5F9FF] p-4"
          data-testid="pending-handover-card"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#1D4ED8]">
                <ArrowRightLeft className="size-3.5" aria-hidden />
                Ticket handover · {handoverReasonLabel(item.reason)}
              </p>
              <p className="break-words text-sm font-medium text-[#111111]">
                “{item.ticket_question ?? "Ticket question"}”
              </p>
              <p className="text-xs text-[#5A5A5A]">
                From {item.from_trainer_name ?? "a class trainer"}
                {item.created_at ? ` · ${formatHandoverTime(item.created_at)}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                size="sm"
                disabled={busyId === item.id}
                onClick={() => void respondHandover(item, "accept")}
                className="gap-1"
              >
                <Check className="size-3.5" />
                Accept ticket
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busyId === item.id}
                onClick={() => setRejectTarget({ kind: "handover", item })}
              >
                Reject
              </Button>
            </div>
          </div>
        </article>
      ))}

      {leaves.map((item) => (
        <article
          key={item.id}
          className="rounded-xl border border-[#EAD9B7] bg-[#FFF9EA] p-4"
          data-testid="pending-leave-card"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#8A6414]">
                <CalendarRange className="size-3.5" aria-hidden />
                Leave request · {formatLeaveRange(item.date_from, item.date_to)}
              </p>
              <p className="text-sm font-medium text-[#111111]">
                {item.trainer_name ?? "A class trainer"} is asking you to cover{" "}
                {dayCount(item.date_from, item.date_to)}{" "}
                {dayCount(item.date_from, item.date_to) === 1 ? "day" : "days"}.
              </p>
              {item.reason && (
                <p className="text-xs text-[#5A5A5A]">Reason: {item.reason}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                size="sm"
                disabled={busyId === item.id}
                onClick={() => void respondLeave(item, "accept")}
                className="gap-1"
              >
                <Check className="size-3.5" />
                Accept cover
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busyId === item.id}
                onClick={() => setRejectTarget({ kind: "leave", item })}
              >
                Reject
              </Button>
            </div>
          </div>
        </article>
      ))}

      <Modal
        isOpen={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title={rejectTarget?.kind === "leave" ? "Reject this leave request?" : "Reject this handover?"}
        widthClass="max-w-md"
      >
        <p className="text-sm leading-relaxed text-[#5A5A5A]">
          {rejectTarget?.kind === "leave"
            ? "The requesting trainer's day will stay present. Their open tickets will still follow the automatic handover rule."
            : "The ticket will not come back to you. It returns to the automatic rule and goes to another available trainer, or waits for an administrator."}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setRejectTarget(null)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!!busyId}
            onClick={() => {
              if (!rejectTarget) return;
              if (rejectTarget.kind === "leave") {
                void respondLeave(rejectTarget.item, "reject");
              } else {
                void respondHandover(rejectTarget.item, "reject");
              }
            }}
            className="gap-1.5"
          >
            <X className="size-3.5" />
            {rejectTarget?.kind === "leave" ? "Reject request" : "Reject handover"}
          </Button>
        </div>
      </Modal>
    </section>
  );
}
