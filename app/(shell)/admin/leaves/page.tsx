"use client";
import * as React from "react";
import {
  AdminPageShell,
  ADMIN_CARD,
  ADMIN_INPUT,
} from "@/components/shared/AdminPageShell";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/ui/button";
import {
  handoverApi,
  LEAVE_REASONS,
  formatLeaveRange,
  type LeaveRequest,
  type LeaveStatus,
} from "@/lib/handover-api";

export default function AdminLeavesPage() {
  const [status, setStatus] = React.useState<LeaveStatus | "all">("pending");
  const [rows, setRows] = React.useState<LeaveRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [reload, setReload] = React.useState(0);
  const [review, setReview] = React.useState<{
    item: LeaveRequest;
    approve: boolean;
  } | null>(null);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [reviewError, setReviewError] = React.useState<string | null>(null);
  React.useEffect(() => {
    let active = true;
    /* eslint-disable react-hooks/set-state-in-effect -- reload the selected request queue. */
    setLoading(true);
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    handoverApi
      .listAdminLeaves(status === "all" ? undefined : status)
      .then((data) => {
        if (active) setRows(data);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load leave requests.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [status, reload]);
  function openReview(item: LeaveRequest, approve: boolean) {
    setReview({ item, approve });
    setReason("");
    setReviewError(null);
  }
  async function submitReview() {
    if (!review || busy) return;
    setBusy(true);
    setReviewError(null);
    try {
      await handoverApi.reviewLeave(
        review.item.id,
        review.approve,
        review.approve ? undefined : reason.trim() || undefined,
      );
      setReview(null);
      setReload((v) => v + 1);
      window.dispatchEvent(new Event("admin-leaves-changed"));
    } catch (cause) {
      setReviewError(
        cause instanceof Error ? cause.message : "Could not review request.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <AdminPageShell
      title="Leave requests"
      subtitle="Review trainer leave and class assistant coverage."
      actions={
        <Button
          variant="outline"
          disabled={loading}
          onClick={() => setReload((v) => v + 1)}
        >
          Refresh
        </Button>
      }
    >
      <label className="flex max-w-xs items-center gap-3 text-sm">
        Status
        <select
          aria-label="Request status"
          value={status}
          onChange={(e) => setStatus(e.target.value as LeaveStatus | "all")}
          className={ADMIN_INPUT}
        >
          <option value="pending">Pending</option>
          <option value="all">All requests</option>
          <option value="accepted">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </label>
      {loading ? (
        <p role="status">Loading leave requests…</p>
      ) : error ? (
        <div role="alert" className="text-red-700">
          {error}
          <Button variant="outline" onClick={() => setReload((v) => v + 1)}>
            Retry
          </Button>
        </div>
      ) : !rows.length ? (
        <p className={`${ADMIN_CARD} p-6 text-sm`}>
          No {status === "all" ? "" : status} leave requests.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((item) => (
            <article key={item.id} className={`${ADMIN_CARD} p-5 space-y-2`}>
              <div className="flex flex-wrap justify-between gap-2">
                <h2 className="text-sm font-semibold">
                  {item.trainer_name ?? item.trainer_id}
                </h2>
                <span className="rounded-full bg-[#F7F7F7] px-2 py-0.5 text-xs font-medium">
                  {item.status === "accepted" ? "Approved" : item.status}
                </span>
              </div>
              <p className="text-sm">
                {formatLeaveRange(item.date_from, item.date_to)} · Class:{" "}
                {item.class_name ??
                  (item.class_id
                    ? "Class leave request"
                    : "Legacy request (all classes)")}
              </p>
              <p className="text-sm font-medium">
                {LEAVE_REASONS[item.reason_type] ?? "Other Reason"}
              </p>
              {(item.reason_details || item.reason) && (
                <p className="whitespace-pre-wrap text-sm text-[#5A5A5A]">
                  {item.reason_details ?? item.reason}
                </p>
              )}
              <p className="text-sm">
                Assistant:{" "}
                {item.target_trainer_name ??
                  "None selected — automatic fallback"}
              </p>
              {item.rejection_reason && (
                <p className="text-sm text-red-700">
                  Rejection reason: {item.rejection_reason}
                </p>
              )}
              {item.status === "pending" && (
                <div className="flex gap-2 pt-2">
                  <Button size="sm" onClick={() => openReview(item, true)}>
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openReview(item, false)}
                  >
                    Reject
                  </Button>
                </div>
              )}
              {item.status !== "pending" && (
                <div className="pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      openReview(item, item.status === "rejected")
                    }
                  >
                    Change decision
                  </Button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      <ConfirmDialog
        isOpen={!!review?.approve}
        title={
          review?.item.status === "rejected"
            ? "Change decision to approved?"
            : "Approve this leave?"
        }
        description={
          <>
            <p>
              The trainer will be marked off for this date range. Open tickets
              in this class may move to the selected assistant or automatic
              fallback queue.
            </p>
            {reviewError && (
              <p role="alert" className="mt-2 text-red-700">
                {reviewError}
              </p>
            )}
          </>
        }
        confirmLabel={
          review?.item.status === "rejected"
            ? "Change to approved"
            : "Approve leave"
        }
        onCancel={() => setReview(null)}
        onConfirm={submitReview}
      />
      <Modal
        isOpen={review !== null && !review.approve}
        onClose={busy ? () => {} : () => setReview(null)}
        title={
          review?.item.status === "accepted"
            ? "Change decision to rejected?"
            : "Reject this leave?"
        }
        widthClass="max-w-lg"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submitReview();
          }}
          className="space-y-4"
        >
          <label className="block text-sm">
            Rejection reason (optional)
            <textarea
              aria-label="Rejection reason"
              rows={3}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={ADMIN_INPUT}
            />
          </label>
          <p className="text-xs text-[#6F6F6F]">
            {review?.item.status === "accepted" ? (
              <>
                This leave will no longer mark the trainer off. Tickets already
                transferred stay with their current owner.
              </>
            ) : (
              <>
                The trainer can see this explanation. The leave will not affect
                attendance or ticket routing.
              </>
            )}
          </p>
          {reviewError && (
            <p role="alert" className="text-sm text-red-700">
              {reviewError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setReview(null)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={busy}>
              {busy
                ? "Rejecting…"
                : review?.item.status === "accepted"
                  ? "Change to rejected"
                  : "Reject leave"}
            </Button>
          </div>
        </form>
      </Modal>
    </AdminPageShell>
  );
}
