"use client";

import * as React from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/ui/button";
import { profileApi } from "@/features/profile/api";
import {
  formatHandoverTime,
  formatLeaveRange,
  handoverApi,
  type LeaveRequest,
  type LeaveStatus,
} from "@/lib/handover-api";

const STATUS_CLASS: Record<LeaveStatus, string> = {
  pending: "border-[#EAD9B7] bg-[#FFF8E7] text-[#8A6414]",
  accepted: "border-[#BFE3CC] bg-[#ECFDF3] text-[#137A4B]",
  rejected: "border-[#E5E5E5] bg-[#F7F7F7] text-[#6F6F6F]",
};

function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase ${STATUS_CLASS[status]}`}
    >
      {status}
    </span>
  );
}

export function LeaveRequestsModal({
  isOpen,
  onClose,
  onChanged,
}: {
  isOpen: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [leaves, setLeaves] = React.useState<LeaveRequest[]>([]);
  const [meId, setMeId] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<"mine" | "incoming">("mine");
  const [loading, setLoading] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- modal-open fetch; rows arrive after await.
    setLoading(true);
    setError(null);
    Promise.all([profileApi.me().catch(() => null), handoverApi.listLeaves()])
      .then(([me, rows]) => {
        if (cancelled) return;
        setMeId(me?.id ?? null);
        setLeaves(rows);
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Could not load leave requests.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, reloadKey]);

  const mine = leaves.filter((leave) => leave.trainer_id === meId);
  const incoming = leaves.filter((leave) => leave.target_trainer_id === meId);
  const visible = tab === "mine" ? mine : incoming;

  async function respond(item: LeaveRequest, action: "accept" | "reject") {
    setBusyId(item.id);
    try {
      await handoverApi.respondLeave(item.id, action);
      toast.success(action === "accept" ? "Leave accepted." : "Leave rejected.");
      setReloadKey((value) => value + 1);
      onChanged?.();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not answer the leave request.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Leave requests"
      subtitle="Requests you sent and requests waiting for your answer."
      widthClass="max-w-2xl"
    >
      <div className="mb-4 flex items-center gap-2 border-b border-[#F0F0F0] pb-2">
        <button
          type="button"
          onClick={() => setTab("mine")}
          aria-pressed={tab === "mine"}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            tab === "mine" ? "bg-[#F7F7F7] text-[#111111]" : "text-[#5A5A5A] hover:text-[#111111]"
          }`}
        >
          My requests ({mine.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("incoming")}
          aria-pressed={tab === "incoming"}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            tab === "incoming"
              ? "bg-[#F7F7F7] text-[#111111]"
              : "text-[#5A5A5A] hover:text-[#111111]"
          }`}
        >
          Incoming ({incoming.length})
        </button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-[#6F6F6F]">Loading leave requests…</p>
      ) : error ? (
        <div className="space-y-3 py-6 text-center text-sm text-[#9B3A2A]">
          <p role="alert">{error}</p>
          <Button size="sm" variant="outline" onClick={() => setReloadKey((value) => value + 1)}>
            Retry
          </Button>
        </div>
      ) : visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[#DADADA] p-6 text-center text-sm text-[#6F6F6F]">
          {tab === "mine" ? "You have not sent any leave requests." : "No leave requests need your answer."}
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((item) => (
            <li key={item.id} className="rounded-lg border border-[#E5E5E5] p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold text-[#111111]">
                    {formatLeaveRange(item.date_from, item.date_to)}
                  </p>
                  <p className="text-xs text-[#5A5A5A]">
                    {tab === "mine"
                      ? `Cover requested from ${item.target_trainer_name ?? "a class trainer"}`
                      : `Requested by ${item.trainer_name ?? "a class trainer"}`}
                    {item.created_at ? ` · ${formatHandoverTime(item.created_at)}` : ""}
                  </p>
                  {item.reason && (
                    <p className="text-xs italic text-[#5A5A5A]">“{item.reason}”</p>
                  )}
                </div>
                <LeaveStatusBadge status={item.status} />
              </div>
              {tab === "incoming" && item.status === "pending" && (
                <div className="mt-3 flex justify-end gap-2">
                  <Button
                    size="sm"
                    disabled={busyId === item.id}
                    onClick={() => void respond(item, "accept")}
                    className="gap-1"
                  >
                    <Check className="size-3.5" />
                    Accept cover
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === item.id}
                    onClick={() => void respond(item, "reject")}
                  >
                    <X className="size-3.5" />
                    Reject
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
