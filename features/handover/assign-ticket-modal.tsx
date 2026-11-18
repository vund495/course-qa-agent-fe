"use client";

import * as React from "react";
import { UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/shared/Modal";
import { AppSelect, type AppSelectOption } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import {
  handoverApi,
  todayIso,
  type AdminQueueItem,
  type ClassAssistant,
  type TrainerDayStatus,
} from "@/lib/handover-api";

export function AssignTicketModal({
  isOpen,
  onClose,
  item,
  onAssigned,
}: {
  isOpen: boolean;
  onClose: () => void;
  item: AdminQueueItem | null;
  onAssigned?: () => void;
}) {
  const [trainers, setTrainers] = React.useState<TrainerDayStatus[]>([]);
  const [assistants, setAssistants] = React.useState<ClassAssistant[]>([]);
  const [targetId, setTargetId] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen || !item) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- modal-open fetch; rows arrive after await.
    setLoading(true);
    setError(null);
    setTargetId("");
    setTrainers([]);
    setAssistants([]);
    Promise.all([
      handoverApi.listClassStatus(item.class_id, todayIso()),
      handoverApi.listClassAssistants(item.class_id),
    ])
      .then(([rows, assignedAssistants]) => {
        if (!cancelled) {
          setTrainers(rows);
          setAssistants(assignedAssistants);
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load class staff.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, item]);

  const options: AppSelectOption[] = [
    ...trainers.map((row) => {
      const isCurrentOwner = row.trainer_id === item?.owner_trainer_id;
      const isOff = row.status === "off";
      return {
        value: row.trainer_id,
        label: `${row.trainer_name}${isCurrentOwner ? " (current owner)" : ""}`,
        description: isOff
          ? "Off today"
          : isCurrentOwner
            ? "Already owns this ticket"
            : "Available today",
        disabled: isOff || isCurrentOwner,
      };
    }),
    ...assistants
      .filter(
        (assistant) =>
          !trainers.some((trainer) => trainer.trainer_id === assistant.id),
      )
      .map((assistant) => {
        const isCurrentOwner = assistant.id === item?.owner_trainer_id;
        return {
          value: assistant.id,
          label: `${assistant.name}${isCurrentOwner ? " (current owner)" : ""}`,
          description: isCurrentOwner
            ? "Already owns this ticket"
            : "Assigned teaching assistant",
          disabled: isCurrentOwner,
        };
      }),
  ];

  async function assign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !item ||
      !targetId ||
      busy ||
      loading ||
      !options.some((option) => option.value === targetId && !option.disabled)
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await handoverApi.assignTicket(item.id, targetId);
      toast.success("Ticket assigned.");
      onAssigned?.();
      onClose();
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Could not assign the ticket.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={busy ? () => {} : onClose}
      title="Assign this ticket"
      subtitle={item ? `${item.class_code} · ${item.student_name}` : undefined}
      widthClass="max-w-md"
    >
      <form className="space-y-4" onSubmit={assign}>
        <p className="break-words rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] p-3 text-sm text-[#333333]">
          “{item?.question}”
        </p>

        <label className="block space-y-1 text-sm font-medium text-[#111111]">
          Assign to
          <AppSelect
            value={targetId}
            onValueChange={setTargetId}
            options={options}
            placeholder={
              loading ? "Loading class staff…" : "Choose a trainer or assistant"
            }
            disabled={loading || options.every((option) => option.disabled)}
            aria-label="Trainer or assistant to assign this ticket to"
          />
        </label>

        <p className="text-xs text-[#6F6F6F]">
          Only trainers and assigned teaching assistants of{" "}
          {item?.class_code ?? "this class"} are listed. Trainers marked off
          today and the current owner cannot be chosen.
        </p>

        {!loading && options.length === 0 && (
          <p className="text-sm text-[#9B3A2A]">
            This class has no trainer or assigned assistant available for a
            manual assignment.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-[#9B3A2A]">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-[#F0F0F0] pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!targetId || busy || loading}
            className="gap-1.5"
          >
            <UserCheck className="size-3.5" />
            {busy ? "Assigning…" : "Assign ticket"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
