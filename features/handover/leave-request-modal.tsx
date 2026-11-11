"use client";

import * as React from "react";
import { CalendarDays, Send } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/shared/Modal";
import { AppSelect, type AppSelectOption } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { profileApi } from "@/features/profile/api";
import {
  handoverApi,
  todayIso,
  validateLeaveRange,
  type TrainerDayStatus,
} from "@/lib/handover-api";

type LeaveRequestModalProps = {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
  classLabel?: string;
  onCreated?: () => void;
};

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
  const [reason, setReason] = React.useState("");
  const [trainers, setTrainers] = React.useState<TrainerDayStatus[]>([]);
  const [loadingTrainers, setLoadingTrainers] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen || !classId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear options when the modal closes.
      setTrainers([]);
      return;
    }
    let cancelled = false;
    setLoadingTrainers(true);
    setError(null);
    Promise.all([
      profileApi.me().catch(() => null),
      handoverApi.listClassStatus(classId, todayIso()).catch(() => []),
    ])
      .then(([me, rows]) => {
        if (cancelled) return;
        setTrainers(rows.filter((row) => row.trainer_id !== me?.id));
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Could not load class trainers.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingTrainers(false);
      });
    return () => {
      cancelled = true;
    };
  }, [classId, isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    /* eslint-disable react-hooks/set-state-in-effect -- reset the form each time the modal opens. */
    setDateFrom(todayIso());
    setDateTo(todayIso());
    setTargetId("");
    setReason("");
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen]);

  const rangeError = validateLeaveRange(dateFrom, dateTo);
  const canSubmit = !!classId && !!targetId && !rangeError && !busy;

  const targetOptions: AppSelectOption[] = trainers.map((row) => ({
    value: row.trainer_id,
    label: row.trainer_name,
    description: row.status === "off" ? "Marked off today" : "Available today",
  }));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await handoverApi.createLeave({
        date_from: dateFrom,
        date_to: dateTo,
        target_trainer_id: targetId,
        reason: reason.trim() || null,
      });
      toast.success("Leave request sent.");
      onCreated?.();
      onClose();
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Could not create the leave request.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Request planned leave"
      subtitle={
        classLabel
          ? `Ask a class trainer to cover your tickets for ${classLabel}.`
          : "Ask a class trainer to cover your tickets."
      }
      widthClass="max-w-lg"
    >
      <form className="space-y-4" onSubmit={submit}>
        {!classId && (
          <p className="rounded-lg border border-[#EAD9B7] bg-[#FFF8E7] p-3 text-sm text-[#8A6414]">
            Select a class in the ticket inbox first.
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-medium text-[#111111]">
            From
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="mt-1 w-full rounded-md border border-[#DADADA] px-3 py-2 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </label>
          <label className="space-y-1 text-sm font-medium text-[#111111]">
            To
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(event) => setDateTo(event.target.value)}
              className="mt-1 w-full rounded-md border border-[#DADADA] px-3 py-2 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </label>
        </div>

        <label className="block space-y-1 text-sm font-medium text-[#111111]">
          Cover trainer
          <AppSelect
            value={targetId}
            onValueChange={setTargetId}
            options={targetOptions}
            placeholder={loadingTrainers ? "Loading trainers…" : "Choose a class trainer"}
            disabled={loadingTrainers || !classId || targetOptions.length === 0}
            aria-label="Trainer who will cover your tickets"
          />
        </label>
        {!loadingTrainers && classId && targetOptions.length === 0 && (
          <p className="text-sm text-[#9B3A2A]">
            This class has no other trainer to receive the request.
          </p>
        )}

        <label className="block space-y-1 text-sm font-medium text-[#111111]">
          Reason <span className="font-normal text-[#6F6F6F]">(optional)</span>
          <textarea
            rows={3}
            maxLength={1000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Family trip, conference, medical appointment…"
            className="mt-1 w-full resize-y rounded-md border border-[#DADADA] px-3 py-2 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </label>

        {(rangeError || error) && (
          <p role="alert" className="text-sm text-[#9B3A2A]">
            {rangeError ?? error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#F0F0F0] pt-4">
          <p className="flex items-center gap-1.5 text-xs text-[#6F6F6F]">
            <CalendarDays className="size-3.5" aria-hidden />
            The receiving trainer accepts before your day is marked off.
          </p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit} className="gap-1.5">
              <Send className="size-3.5" />
              {busy ? "Sending…" : "Send request"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
