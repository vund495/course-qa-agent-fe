import { cn } from "@/lib/utils";
import type { Ticket } from "./api";

const STATUS_META: Record<
  Ticket["status"],
  { label: string; className: string; headerClassName: string }
> = {
  OPEN: {
    label: "Open",
    className: "border-[#E8D5A4] bg-[#FFF8E7] text-[#8A6414]",
    headerClassName: "border-[#F0E2BC] bg-[#FFF9EA]",
  },
  ANSWERED: {
    label: "Answered",
    className: "border-[#BFD7F5] bg-[#EFF6FF] text-[#1D4ED8]",
    headerClassName: "border-[#CCE0F8] bg-[#F1F7FF]",
  },
  RESOLVED: {
    label: "Resolved",
    className: "border-[#BFE3CC] bg-[#ECFDF3] text-[#137A4B]",
    headerClassName: "border-[#C4E7D2] bg-[#EFFBF4]",
  },
  EXPIRED: {
    label: "Expired",
    className: "border-[#DADADA] bg-[#F7F7F7] text-[#6F6F6F]",
    headerClassName: "border-[#E3E3E3] bg-[#F8F8F8]",
  },
};

/** Pale status tint for the ticket detail header. */
export function getTicketStatusTheme(status: Ticket["status"]) {
  return STATUS_META[status];
}

export function TicketStatusBadge({
  status,
  className,
}: {
  status: Ticket["status"];
  className?: string;
}) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        meta.className,
        className,
      )}
    >
      {meta.label}
    </span>
  );
}

export function formatTicketDate(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ArchivedClassBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border border-[#DADADA] bg-[#F7F7F7] px-2 py-0.5 text-[11px] font-semibold text-[#5A5A5A]",
        className,
      )}
    >
      Archived class
    </span>
  );
}
