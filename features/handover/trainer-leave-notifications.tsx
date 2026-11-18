"use client";

import * as React from "react";
import { toast } from "sonner";
import { formatLeaveRange, handoverApi, type LeaveRequest } from "@/lib/handover-api";

const STORAGE_KEY = "trainer-leave-decisions-seen-v1";

function decisionKey(leave: LeaveRequest): string | null {
  if (leave.status === "pending" || !leave.responded_at) return null;
  return `${leave.status}:${leave.responded_at}`;
}

function readSeen(): Record<string, string> {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function notifyDecision(leave: LeaveRequest) {
  const classLabel = leave.class_name ?? "Your class";
  const range = formatLeaveRange(leave.date_from, leave.date_to);
  if (leave.status === "accepted") {
    toast.success("Leave request approved", {
      description: `${classLabel} · ${range}`,
    });
    return;
  }
  toast.error("Leave request rejected", {
    description: `${classLabel} · ${range}${leave.rejection_reason ? ` · ${leave.rejection_reason}` : ""}`,
  });
}

export function TrainerLeaveNotifications({ enabled }: { enabled: boolean }) {
  const requestId = React.useRef(0);

  const refresh = React.useCallback(async () => {
    if (!enabled) return;
    const currentRequest = ++requestId.current;
    try {
      const leaves = await handoverApi.listLeaves();
      if (currentRequest !== requestId.current) return;
      const seen = readSeen();
      let changed = false;
      for (const leave of leaves
        .filter((item) => item.status !== "pending" && item.responded_at)
        .sort((a, b) => Date.parse(a.responded_at ?? "") - Date.parse(b.responded_at ?? ""))) {
        const key = decisionKey(leave);
        if (!key || seen[leave.id] === key) continue;
        notifyDecision(leave);
        seen[leave.id] = key;
        changed = true;
      }
      if (changed) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
    } catch {
      // Ticket and leave pages expose retry states; background notices stay quiet.
    }
  }, [enabled]);

  React.useEffect(() => {
    if (!enabled) return;
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    const interval = window.setInterval(onFocus, 30_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(interval);
    };
  }, [enabled, refresh]);

  return null;
}
