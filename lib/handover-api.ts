/**
 * AI-158 — trainer availability, planned leave, ticket handover API client.
 *
 * Mirrors the backend contract in
 * `course-qa-agent-be/docs/design/ai-158-teacher-absence-handover.md`.
 * Plain `snake_case` types; bearer token comes from the same localStorage key
 * used by the rest of the app.
 */

import { AUTH_TOKEN_KEY } from "@/components/ui/nav-config";
import type { TicketInboxItem } from "@/features/tickets/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type DayStatus = "present" | "off";
export type HandoverReason = "auto_absent" | "manual_transfer";
export type HandoverStatus = "pending" | "accepted" | "rejected";
export type LeaveStatus = "pending" | "accepted" | "rejected";

export type TrainerDayStatus = {
  trainer_id: string;
  trainer_name: string;
  date: string;
  status: DayStatus;
  note: string | null;
  recorded_by: string | null;
  updated_at: string | null;
};

export type Handover = {
  id: string;
  ticket_id: string;
  ticket_question: string | null;
  from_trainer_id: string;
  from_trainer_name: string | null;
  to_trainer_id: string;
  to_trainer_name: string | null;
  reason: HandoverReason;
  status: HandoverStatus;
  created_at: string;
  responded_at: string | null;
};

export type LeaveRequest = {
  id: string;
  trainer_id: string;
  trainer_name: string | null;
  date_from: string;
  date_to: string;
  target_trainer_id: string;
  target_trainer_name: string | null;
  reason: string | null;
  status: LeaveStatus;
  responded_by: string | null;
  responded_at: string | null;
  created_at: string;
};

export type AdminQueueItem = TicketInboxItem & {
  absent_trainers: string[];
  queued_for_admin_at: string | null;
};

export type SetDayStatusBody = {
  date?: string;
  status: DayStatus;
  note?: string | null;
};

export type CreateLeaveBody = {
  date_from: string;
  date_to: string;
  target_trainer_id: string;
  reason?: string | null;
};

function token(): string | null {
  return typeof window === "undefined" ? null : window.localStorage.getItem(AUTH_TOKEN_KEY);
}

async function responseError(response: Response): Promise<Error & { detail?: unknown }> {
  const body = await response.json().catch(() => ({}));
  const detail = (body as { detail?: unknown }).detail;
  const message =
    typeof detail === "string"
      ? detail
      : `Request failed with status ${response.status}`;
  const error = new Error(message) as Error & { detail?: unknown };
  error.detail = detail;
  return error;
}

export async function handoverFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const authToken = token();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw await responseError(response);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function dateQuery(date?: string): string {
  return date ? `?date=${encodeURIComponent(date)}` : "";
}

export const handoverApi = {
  getMyStatus: (date?: string): Promise<TrainerDayStatus> =>
    handoverFetch<TrainerDayStatus>(`/api/trainer-status${dateQuery(date)}`),

  setMyStatus: (body: SetDayStatusBody): Promise<TrainerDayStatus> =>
    handoverFetch<TrainerDayStatus>("/api/trainer-status", {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  listClassStatus: (classId: string, date?: string): Promise<TrainerDayStatus[]> =>
    handoverFetch<TrainerDayStatus[]>(
      `/api/classes/${encodeURIComponent(classId)}/trainer-status${dateQuery(date)}`,
    ),

  listHandovers: (): Promise<Handover[]> =>
    handoverFetch<Handover[]>("/api/handovers/mine"),

  acceptHandover: (id: string): Promise<Handover> =>
    handoverFetch<Handover>(`/api/handovers/${encodeURIComponent(id)}/accept`, {
      method: "POST",
    }),

  rejectHandover: (id: string): Promise<Handover> =>
    handoverFetch<Handover>(`/api/handovers/${encodeURIComponent(id)}/reject`, {
      method: "POST",
    }),

  listLeaves: (): Promise<LeaveRequest[]> =>
    handoverFetch<LeaveRequest[]>("/api/leave-requests/mine"),

  createLeave: (body: CreateLeaveBody): Promise<LeaveRequest> =>
    handoverFetch<LeaveRequest>("/api/leave-requests", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  acceptLeave: (id: string): Promise<LeaveRequest> =>
    handoverFetch<LeaveRequest>(`/api/leave-requests/${encodeURIComponent(id)}/accept`, {
      method: "POST",
    }),

  rejectLeave: (id: string): Promise<LeaveRequest> =>
    handoverFetch<LeaveRequest>(`/api/leave-requests/${encodeURIComponent(id)}/reject`, {
      method: "POST",
    }),

  respondLeave: (id: string, action: "accept" | "reject"): Promise<LeaveRequest> =>
    action === "accept"
      ? handoverApi.acceptLeave(id)
      : handoverApi.rejectLeave(id),

  adminQueue: (): Promise<AdminQueueItem[]> =>
    handoverFetch<AdminQueueItem[]>("/api/admin/tickets/queue"),

  assignTicket: (ticketId: string, toTrainerId: string): Promise<unknown> =>
    handoverFetch<unknown>(`/api/tickets/${encodeURIComponent(ticketId)}/handover`, {
      method: "POST",
      body: JSON.stringify({ to_trainer_id: toTrainerId }),
    }),
};

/** Today's calendar date in the backend's Vietnam timezone. */
export function todayIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function formatDayLabel(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatLeaveRange(dateFrom: string, dateTo: string): string {
  if (dateFrom === dateTo) return formatDayLabel(dateFrom);
  return `${formatDayLabel(dateFrom)} – ${formatDayLabel(dateTo)}`;
}

export function formatHandoverTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function handoverReasonLabel(reason: HandoverReason): string {
  return reason === "auto_absent" ? "auto absent" : "manual transfer";
}

const SYSTEM_REPLY_PREFIXES = [
  "Ticket transferred from ",
  "All trainers are off today;",
  "Handover from ",
];

export function isSystemReply(message: string): boolean {
  return SYSTEM_REPLY_PREFIXES.some((prefix) => message.startsWith(prefix));
}

export function validateLeaveRange(dateFrom: string, dateTo: string): string | null {
  if (!dateFrom || !dateTo) return "Choose both dates.";
  if (dateFrom > dateTo) return "The end date must be on or after the start date.";
  return null;
}
