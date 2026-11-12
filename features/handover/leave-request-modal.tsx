"use client";

import * as React from "react";
import { toast } from "sonner";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/ui/button";
import { AppSelect, type AppSelectOption } from "@/components/ui/app-select";
import { DateInput } from "@/components/ui/date-input";
import {
  handoverApi,
  todayIso,
  validateLeaveRange,
  LEAVE_REASONS,
  type LeaveReason,
  type ClassAssistant,
} from "@/lib/handover-api";

type LeaveRequestModalProps = {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
  classLabel?: string;
  onCreated?: () => void;
};
const fieldClass =
  "mt-1 w-full rounded-md border border-[#DADADA] bg-white px-3 py-2 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring/50";
const dropdownMotionClass =
  "duration-[250ms] ease-out data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 motion-reduce:animate-none";
const reasonOptions: AppSelectOption[] = Object.entries(LEAVE_REASONS).map(
  ([value, label]) => ({ value, label }),
);

export function LeaveRequestModal({
  isOpen,
  onClose,
  classId,
  classLabel,
  onCreated,
}: LeaveRequestModalProps) {
  const [dateFrom, setDateFrom] = React.useState(todayIso());
  const [dateTo, setDateTo] = React.useState(todayIso());
  const [targetId, setTargetId] = React.useState("");
  const [reasonType, setReasonType] =
    React.useState<LeaveReason>("annual_leave");
  const [details, setDetails] = React.useState("");
  const [assistants, setAssistants] = React.useState<ClassAssistant[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [assistantError, setAssistantError] = React.useState<string | null>(
    null,
  );
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!isOpen) return;
    let active = true;
    /* eslint-disable react-hooks/set-state-in-effect -- reset and load when the dialog opens. */
    setDateFrom(todayIso());
    setDateTo(todayIso());
    setTargetId("");
    setDetails("");
    setReasonType("annual_leave");
    setError(null);
    setAssistantError(null);
    setAssistants([]);
    if (!classId) return;
    setLoading(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    handoverApi
      .listClassAssistants(classId)
      .then((rows) => {
        if (active) setAssistants(rows);
      })
      .catch((cause) => {
        if (active)
          setAssistantError(
            cause instanceof Error
              ? cause.message
              : "Could not load assistants. You can still request leave without one.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [classId, isOpen]);
  const validation =
    validateLeaveRange(dateFrom, dateTo) ??
    (reasonType === "other" && !details.trim()
      ? "Provide details for Other Reason."
      : null);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (validation || !classId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await handoverApi.createLeave({
        class_id: classId,
        date_from: dateFrom,
        date_to: dateTo,
        reason_type: reasonType,
        reason_details: details.trim() || null,
        target_trainer_id: targetId || null,
      });
      toast.success("Leave request sent for admin review.");
      onCreated?.();
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not create the leave request.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      isOpen={isOpen}
      onClose={busy ? () => {} : onClose}
      title="Request planned leave"
      subtitle={`Request administrator approval${classLabel ? ` for ${classLabel}` : " for this class"}.`}
      widthClass="max-w-lg"
    >
      <form onSubmit={submit} className="space-y-4">
        {!classId && <p role="alert">Select a class Attendance page first.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium" htmlFor="leave-date-from">
            From
            <DateInput
              id="leave-date-from"
              aria-label="From"
              className={fieldClass}
              value={dateFrom}
              onChange={setDateFrom}
              required
            />
          </label>
          <label className="text-sm font-medium" htmlFor="leave-date-to">
            To
            <DateInput
              id="leave-date-to"
              aria-label="To"
              className={fieldClass}
              value={dateTo}
              min={dateFrom}
              onChange={setDateTo}
              required
            />
          </label>
        </div>
        <label className="block text-sm font-medium" htmlFor="leave-reason">
          Reason
          <AppSelect
            id="leave-reason"
            aria-label="Leave reason"
            value={reasonType}
            onValueChange={(value) => setReasonType(value as LeaveReason)}
            options={reasonOptions}
            triggerClassName={fieldClass}
            contentClassName={`w-[var(--radix-select-trigger-width)] min-w-0 ${dropdownMotionClass}`}
          />
        </label>
        <label className="block text-sm font-medium">
          Reason details {reasonType !== "other" && "(optional)"}
          <textarea
            aria-label="Reason details"
            className={fieldClass}
            rows={3}
            maxLength={1000}
            value={details}
            required={reasonType === "other"}
            onChange={(e) => setDetails(e.target.value)}
          />
        </label>
        {loading ? (
          <p className="text-sm text-[#6F6F6F]">Loading assigned assistants…</p>
        ) : assistants.length ? (
          <label className="block text-sm font-medium" htmlFor="leave-cover-assistant">
            Cover assistant (optional)
            <AppSelect
              id="leave-cover-assistant"
              aria-label="Cover assistant"
              value={targetId}
              onValueChange={setTargetId}
              options={[
                { value: "", label: "No assistant selected" },
                ...assistants.map((assistant) => ({
                  value: assistant.id,
                  label: assistant.name,
                  description: assistant.email,
                  initials: assistant.name.slice(0, 2).toUpperCase(),
                })),
              ]}
              triggerClassName={fieldClass}
              contentClassName={`w-[var(--radix-select-trigger-width)] min-w-0 ${dropdownMotionClass}`}
            />
          </label>
        ) : (
          <p className="text-sm text-[#6F6F6F]">
            No teaching assistants assigned. You can still request leave.
          </p>
        )}
        {assistantError && (
          <p role="alert" className="text-sm text-amber-700">
            {assistantError} You can submit without an assistant.
          </p>
        )}
        {(validation || error) && (
          <p role="alert" className="text-sm text-red-700">
            {error ?? validation}
          </p>
        )}
        <p className="text-xs text-[#6F6F6F]">
          An administrator reviews your request before you are marked off.
          Approved leave may transfer tickets to the selected assistant.
        </p>
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={busy || !classId || !!validation}>
            {busy ? "Sending…" : "Send request"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
