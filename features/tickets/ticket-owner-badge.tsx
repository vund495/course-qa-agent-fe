import { ArrowRightLeft, Clock3, ShieldCheck, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatHandoverTime, handoverReasonLabel } from "@/lib/handover-api";
import type { Ticket } from "./api";

function badgeBase(className?: string): string {
  return cn(
    "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10.5px] font-semibold leading-4",
    className,
  );
}

export function TicketOwnerBadge({
  ticket,
  currentUserId,
  className,
}: {
  ticket: Ticket;
  currentUserId?: string | null;
  className?: string;
}) {
  const ownerLabel = ticket.owner_trainer_id
    ? ticket.owner_trainer_id === currentUserId
      ? "Owner: you"
      : `Owner: ${ticket.owner_trainer_name ?? "another trainer"}`
    : null;
  const showHandover = !ticket.queued_for_admin_at && !!ticket.handover_from_name;

  return (
    <span
      className={cn("inline-flex flex-wrap items-center gap-1.5", className)}
      data-testid="ticket-owner-badge"
    >
      {ownerLabel && (
        <span className={badgeBase("border-[#DADADA] bg-[#F7F7F7] text-[#4D4D4D]")}>
          <ShieldCheck className="size-3" aria-hidden />
          {ownerLabel}
        </span>
      )}
      {ticket.queued_for_admin_at ? (
        <span className={badgeBase("border-[#EBC7BE] bg-[#FDF1EE] text-[#9B3A2A]")}>
          <Clock3 className="size-3" aria-hidden />
          Waiting for admin
        </span>
      ) : showHandover ? (
        <span
          className={badgeBase("border-[#CFE0F7] bg-[#F5F9FF] text-[#1D4ED8]")}
          title={
            ticket.handover_at
              ? `${handoverReasonLabel(ticket.handover_reason ?? "auto_absent")} · ${formatHandoverTime(ticket.handover_at)}`
              : undefined
          }
        >
          <ArrowRightLeft className="size-3" aria-hidden />
          Transferred from {ticket.handover_from_name}
          {ticket.handover_reason ? ` · ${handoverReasonLabel(ticket.handover_reason)}` : ""}
        </span>
      ) : ticket.escalated_to_name ? (
        <span className={badgeBase("border-[#EAD9B7] bg-[#FFF8E7] text-[#8A6414]")}>
          <TriangleAlert className="size-3" aria-hidden />
          Escalated to {ticket.escalated_to_name}
        </span>
      ) : null}
    </span>
  );
}

export function isSystemTicketReply(message: string): boolean {
  return (
    message.startsWith("Ticket transferred from ") ||
    message.startsWith("All trainers are off today;") ||
    message.startsWith("Handover from ")
  );
}
