import { redirect } from "next/navigation";

export default async function LegacyClassAttendancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/student/attendance?classId=${encodeURIComponent(id)}`);
}
