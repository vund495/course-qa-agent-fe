"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { LeaveRequestModal } from "@/features/handover/leave-request-modal";
import { LeaveRequestsModal } from "@/features/handover/leave-requests-modal";
import { profileApi } from "@/features/profile/api";

export function ClassLeaveControls({ classId }: { classId: string }) {
  const [view, setView] = React.useState<"create" | "history" | null>(null);
  const [canRequest, setCanRequest] = React.useState(false);
  React.useEffect(() => {
    let active = true;
    profileApi
      .me()
      .then((me) => {
        if (active) setCanRequest(me.role === "trainer");
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  if (!canRequest) return null;
  return (
    <section
      aria-label="Class leave requests"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4"
    >
      <div>
        <h2 className="text-sm font-semibold">Planned leave</h2>
        <p className="text-xs text-[#6F6F6F]">
          Submit a class request and track administrator review.
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setView("history")}>
          My leave requests
        </Button>
        <Button size="sm" onClick={() => setView("create")}>
          Request leave
        </Button>
      </div>
      <LeaveRequestModal
        isOpen={view === "create"}
        onClose={() => setView(null)}
        classId={classId}
      />
      <LeaveRequestsModal
        isOpen={view === "history"}
        onClose={() => setView(null)}
        classId={classId}
      />
    </section>
  );
}
