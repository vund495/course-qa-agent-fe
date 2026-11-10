"use client";

import * as React from "react";
import { CalendarCheck, CircleOff, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { profileApi } from "@/features/profile/api";
import {
  formatDayLabel,
  handoverApi,
  todayIso,
  type DayStatus,
  type TrainerDayStatus,
} from "@/lib/handover-api";

type TrainerDayStatusViewProps = {
  date: string;
  myId: string | null;
  myStatus: DayStatus;
  statuses: TrainerDayStatus[];
  busy?: boolean;
  error?: string | null;
  onSetStatus: (status: DayStatus) => void;
  onRetry?: () => void;
};

function consequenceCopy(status: DayStatus, statuses: TrainerDayStatus[], myId: string | null): string {
  if (status === "present") {
    return "Tickets from your classes stay yours.";
  }
  const otherAvailable = statuses.some(
    (row) => row.trainer_id !== myId && row.status === "present",
  );
  return otherAvailable
    ? "Your open tickets will be handed to an available trainer."
    : "No other trainer is available, so tickets will wait for an administrator.";
}

export function TrainerDayStatusView({
  date,
  myId,
  myStatus,
  statuses,
  busy = false,
  error,
  onSetStatus,
  onRetry,
}: TrainerDayStatusViewProps) {
  const isOff = myStatus === "off";
  const dateLabel = date === todayIso() ? `Today, ${formatDayLabel(date)}` : formatDayLabel(date);

  return (
    <section
      className="rounded-xl border border-[#DADADA] bg-white p-4 shadow-xs"
      data-testid="trainer-day-status"
      aria-label="My availability today"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {isOff ? (
              <CircleOff className="size-4 text-[#B74B3A]" aria-hidden />
            ) : (
              <CalendarCheck className="size-4 text-[#137A4B]" aria-hidden />
            )}
            <p className="text-[13px] font-semibold text-[#111111]">{dateLabel}</p>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                isOff
                  ? "border-[#EBC7BE] bg-[#FDF1EE] text-[#9B3A2A]"
                  : "border-[#BFE3CC] bg-[#ECFDF3] text-[#137A4B]",
              )}
            >
              {isOff ? "Off" : "Present"}
            </span>
          </div>
          <p className="text-sm text-[#5A5A5A]">
            You are marked <span className="font-semibold text-[#111111]">{myStatus.toUpperCase()}</span>.{" "}
            {consequenceCopy(myStatus, statuses, myId)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={isOff ? "outline" : "default"}
            aria-pressed={!isOff}
            disabled={busy}
            onClick={() => onSetStatus("present")}
            className="gap-1.5"
          >
            <CalendarCheck className="size-3.5" />
            I&apos;m present
          </Button>
          <Button
            type="button"
            size="sm"
            variant={isOff ? "default" : "outline"}
            aria-pressed={isOff}
            disabled={busy}
            onClick={() => onSetStatus("off")}
            className="gap-1.5"
          >
            <CircleOff className="size-3.5" />
            I&apos;m off today
          </Button>
        </div>
      </div>

      {error && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-[#F3C9C2] bg-[#FEF4F2] px-3 py-2 text-sm text-[#9B3A2A]">
          <span className="flex-1">{error}</span>
          {onRetry && (
            <Button type="button" size="xs" variant="outline" onClick={onRetry} className="gap-1">
              <RefreshCw className="size-3" />
              Retry
            </Button>
          )}
        </div>
      )}

      {statuses.length > 0 && (
        <div className="mt-4 border-t border-[#F0F0F0] pt-3">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#6F6F6F]">
            <Users className="size-3.5" aria-hidden />
            Class trainers today
          </p>
          <ul className="flex flex-wrap gap-2">
            {statuses.map((row) => {
              const rowIsOff = row.status === "off";
              return (
                <li
                  key={row.trainer_id}
                  className="inline-flex items-center gap-2 rounded-full border border-[#E5E5E5] bg-[#FAFAFA] px-2.5 py-1 text-xs text-[#333333]"
                >
                  <span className="font-medium">
                    {row.trainer_name}
                    {row.trainer_id === myId ? " (you)" : ""}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                      rowIsOff
                        ? "bg-[#FDF1EE] text-[#9B3A2A]"
                        : "bg-[#ECFDF3] text-[#137A4B]",
                    )}
                  >
                    {row.status}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

export function TrainerDayStatus({ classId }: { classId: string }) {
  const date = React.useMemo(() => todayIso(), []);
  const [myId, setMyId] = React.useState<string | null>(null);
  const [myStatus, setMyStatus] = React.useState<DayStatus>("present");
  const [statuses, setStatuses] = React.useState<TrainerDayStatus[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    if (!classId) return;
    let cancelled = false;

    async function load() {
      try {
        setError(null);
        const [me, mine, classRows] = await Promise.all([
          profileApi.me().catch(() => null),
          handoverApi.getMyStatus(date).catch(() => null),
          handoverApi.listClassStatus(classId, date).catch(() => []),
        ]);
        if (cancelled) return;
        const resolvedMine = mine;
        const resolvedId = me?.id ?? resolvedMine?.trainer_id ?? null;
        setMyId(resolvedId);
        setMyStatus(resolvedMine?.status ?? "present");
        const rows = [...classRows];
        if (resolvedMine && !rows.some((row) => row.trainer_id === resolvedMine.trainer_id)) {
          rows.unshift(resolvedMine);
        }
        setStatuses(rows);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Could not load trainer status.");
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [classId, date, reloadKey]);

  async function setStatus(next: DayStatus) {
    if (next === myStatus || busy) return;
    const previous = myStatus;
    setBusy(true);
    setError(null);
    setMyStatus(next);
    setStatuses((rows) =>
      rows.map((row) =>
        row.trainer_id === myId
          ? { ...row, status: next }
          : row,
      ),
    );
    try {
      const saved = await handoverApi.setMyStatus({ date, status: next });
      setMyStatus(saved.status);
      setStatuses((rows) => {
        const existing = rows.some((row) => row.trainer_id === saved.trainer_id);
        return existing
          ? rows.map((row) => (row.trainer_id === saved.trainer_id ? saved : row))
          : [saved, ...rows];
      });
      toast.success(
        next === "off"
          ? "You are off today. Open tickets will be handed over."
          : "You are marked present.",
      );
    } catch (cause) {
      setMyStatus(previous);
      setStatuses((rows) =>
        rows.map((row) => (row.trainer_id === myId ? { ...row, status: previous } : row)),
      );
      const message =
        cause instanceof Error ? cause.message : "Could not save your availability.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <TrainerDayStatusView
      date={date}
      myId={myId}
      myStatus={myStatus}
      statuses={statuses}
      busy={busy}
      error={error}
      onSetStatus={(next) => void setStatus(next)}
      onRetry={() => setReloadKey((value) => value + 1)}
    />
  );
}
