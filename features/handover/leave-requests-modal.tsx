"use client";
import * as React from "react";
import { Modal } from "@/components/shared/Modal";
import { profileApi } from "@/features/profile/api";
import { Button } from "@/components/ui/button";
import {
  handoverApi,
  LEAVE_REASONS,
  formatLeaveRange,
  type LeaveRequest,
} from "@/lib/handover-api";

export function LeaveRequestsModal({
  isOpen,
  onClose,
  classId,
}: {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
}) {
  const [leaves, setLeaves] = React.useState<LeaveRequest[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [reload, setReload] = React.useState(0);
  React.useEffect(() => {
    if (!isOpen) return;
    let active = true;
    /* eslint-disable react-hooks/set-state-in-effect -- load on opening the history dialog. */
    setLoading(true);
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    Promise.all([profileApi.me(), handoverApi.listLeaves()])
      .then(([me, rows]) => {
        if (active)
          setLeaves(
            rows.filter(
              (row) =>
                row.trainer_id === me.id &&
                (row.class_id === classId || row.class_id === null),
            ),
          );
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Could not load requests.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isOpen, classId, reload]);
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="My leave requests"
      subtitle="Administrator decisions for this class. Legacy requests without a class are also shown."
      widthClass="max-w-2xl"
    >
      {loading ? (
        <p>Loading leave requests…</p>
      ) : error ? (
        <div>
          <p role="alert">{error}</p>
          <Button onClick={() => setReload((v) => v + 1)}>Retry</Button>
        </div>
      ) : !leaves.length ? (
        <p>You have not sent any leave requests.</p>
      ) : (
        <ul className="space-y-3">
          {leaves.map((leave) => (
            <li
              key={leave.id}
              className="rounded-lg border p-4 text-sm space-y-1"
            >
              <div className="flex justify-between gap-2">
                <strong>
                  {formatLeaveRange(leave.date_from, leave.date_to)}
                </strong>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${leave.status === "accepted" ? "bg-green-50 text-green-800" : leave.status === "rejected" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-800"}`}
                >
                  {leave.status === "accepted"
                    ? "Approved"
                    : leave.status === "pending"
                      ? "Pending admin review"
                      : "Rejected"}
                </span>
              </div>
              <p>{LEAVE_REASONS[leave.reason_type] ?? "Other Reason"}</p>
              {(leave.reason_details || leave.reason) && (
                <p className="whitespace-pre-wrap">
                  {leave.reason_details ?? leave.reason}
                </p>
              )}
              <p className="text-[#6F6F6F]">
                Assistant: {leave.target_trainer_name ?? "None selected"}
              </p>
              {leave.rejection_reason && (
                <p className="text-red-700">
                  Rejection reason: {leave.rejection_reason}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
