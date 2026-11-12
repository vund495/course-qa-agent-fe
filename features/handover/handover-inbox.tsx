"use client";

import * as React from "react";
import { ArrowRightLeft, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/ui/button";
import {
  formatHandoverTime,
  handoverApi,
  handoverReasonLabel,
  type Handover,
} from "@/lib/handover-api";

type RejectTarget = { kind: "handover"; item: Handover };

export function HandoverInbox({ onAnswered }: { onAnswered?: () => void }) {
  const [handovers, setHandovers] = React.useState<Handover[]>([]);
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
    handoverApi.listHandovers()
      .then((rows) => { if (!cancelled) setHandovers(rows); })
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

  const total = handovers.length;

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

  // Nothing to show yet: this block is supplementary, so reserving space for it
  // would push the ticket inbox down and then snap back when it turns out empty.
  if (loading) return null;

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

      <Modal
        isOpen={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title="Reject this handover?"
        widthClass="max-w-md"
      >
        <p className="text-sm leading-relaxed text-[#5A5A5A]">
          The ticket returns to the automatic rule and goes to another available trainer, or waits for an administrator.
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
              void respondHandover(rejectTarget.item, "reject");
            }}
            className="gap-1.5"
          >
            <X className="size-3.5" />
            Reject handover
          </Button>
        </div>
      </Modal>
    </section>
  );
}
