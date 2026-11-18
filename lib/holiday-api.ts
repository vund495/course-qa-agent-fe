import { handoverFetch } from "@/lib/handover-api";

export type HolidayBody = {
  date: string;
  name: string;
  type: "solar" | "lunar" | "admin";
  scope: "system" | "class";
  class_id: string | null;
};
export type Holiday = HolidayBody & { id: string; created_at: string };
export const holidayApi = {
  list: (year: number): Promise<Holiday[]> =>
    handoverFetch(`/api/admin/holidays?year=${year}`),
  listClass: (classId: string, year: number): Promise<Holiday[]> =>
    handoverFetch(
      `/api/classes/${encodeURIComponent(classId)}/holidays?year=${year}`,
    ),
  create: (body: HolidayBody): Promise<Holiday> =>
    handoverFetch("/api/admin/holidays", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: string, body: HolidayBody): Promise<Holiday> =>
    handoverFetch(`/api/admin/holidays/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  remove: (id: string): Promise<void> =>
    handoverFetch(`/api/admin/holidays/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
};
