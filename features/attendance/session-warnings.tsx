import type { ClassSession } from "@/lib/attendance-api";

export function SessionWarnings({
  session,
}: {
  session: Pick<
    ClassSession,
    "is_holiday" | "holiday_name" | "trainer_on_leave" | "trainer_leave"
  >;
}) {
  return (
    <span className="flex flex-wrap gap-1 text-[11px]">
      {session.is_holiday && (
        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-800">
          Holiday: {session.holiday_name ?? "Holiday"}
        </span>
      )}
      {session.trainer_on_leave && (
        <span
          className="rounded bg-orange-50 px-1.5 py-0.5 text-orange-800"
          title={session.trainer_leave?.reason_details ?? undefined}
        >
          Trainer on approved leave
          {session.trainer_leave?.target_trainer_name
            ? ` · ${session.trainer_leave.target_trainer_name} covers`
            : ""}
        </span>
      )}
    </span>
  );
}
