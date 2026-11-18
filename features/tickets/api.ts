import { apiFetch, adminApi } from "@/lib/admin-api";
import type { ChatMessageCitation } from "@/features/history/types";

export type Ticket = {
  id: string;
  class_id: string;
  student_id: string;
  question: string;
  original_question?: string | null;
  agent_answer?: string | null;
  citations?: ChatMessageCitation[];
  source_message_id?: string | null;
  status: "OPEN" | "ANSWERED" | "RESOLVED" | "EXPIRED";
  created_at: string;
  escalated_to_id?: string | null;
  escalated_at?: string | null;
  escalated_to_name?: string | null;
  student_seen_at?: string | null;
  // AI-158 — ownership and handover context (additive; older responses omit it).
  owner_trainer_id?: string | null;
  owner_trainer_name?: string | null;
  queued_for_admin_at?: string | null;
  handover_from_id?: string | null;
  handover_from_name?: string | null;
  handover_reason?: "auto_absent" | "manual_transfer" | null;
  handover_at?: string | null;
};

export type TicketReply = {
  id: string;
  ticket_id: string;
  user_id: string;
  /** Display name of the reply author (trainer, TA or administrator). */
  author_name?: string | null;
  message: string;
  created_at: string;
  attachments?: TicketAttachment[];
};

export type TicketAttachment = {
  id: string;
  ticket_id: string;
  reply_id?: string | null;
  kind: "IMAGE" | "EMOJI";
  file_name?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
  emoji?: string | null;
  created_at: string;
};

// Mirrors the backend limits so the picker fails fast without a round trip.
export const TICKET_ATTACHMENT_LIMIT = 3;
export const TICKET_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const TICKET_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export type TicketThread = Ticket & { replies: TicketReply[] };

export type TicketInboxItem = Ticket & {
  student_name: string;
  class_name: string;
  class_code: string;
  class_status?: "ACTIVE" | "ARCHIVED" | string;
  replies: TicketReply[];
};

export type TicketList = {
  items: TicketInboxItem[];
  total: number;
  page: number;
  page_size: number;
};

type TicketClassCounts = {
  class_id: string;
  class_code: string;
  class_name: string;
  class_status?: "ACTIVE" | "ARCHIVED" | string;
  open_count: number;
  completed_count: number;
  expired_count: number;
};

export type TicketCounts = {
  items: TicketClassCounts[];
  open_total: number;
  completed_total: number;
};

export function listTickets(input: {
  class_id?: string;
  status?: Ticket["status"];
  page?: number;
  page_size?: number;
}): Promise<TicketList> {
  const query = new URLSearchParams({
    page: String(input.page ?? 1),
    page_size: String(input.page_size ?? 20),
  });
  if (input.class_id) query.set("class_id", input.class_id);
  if (input.status) query.set("status", input.status);
  return apiFetch<TicketList>(`/api/tickets?${query}`);
}

export function listMyTickets(input: {
  class_id?: string;
  status?: Ticket["status"];
  unread?: boolean;
  page?: number;
  page_size?: number;
}): Promise<TicketList> {
  const query = new URLSearchParams({
    page: String(input.page ?? 1),
    page_size: String(input.page_size ?? 20),
  });
  if (input.class_id) query.set("class_id", input.class_id);
  if (input.status) query.set("status", input.status);
  if (input.unread) query.set("unread", "true");
  return apiFetch<TicketList>(`/api/tickets/mine?${query}`);
}

export function markTicketSeen(ticketId: string): Promise<void> {
  return apiFetch<void>(`/api/tickets/${encodeURIComponent(ticketId)}/seen`, { method: "POST" });
}

export function createTicket(input: {
  class_id: string;
  question: string;
  original_question?: string;
  agent_answer?: string;
  details?: string;
}): Promise<Ticket> {
  return apiFetch<Ticket>("/api/tickets", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function createAnswerTicket(messageId: string, details: string): Promise<Ticket> {
  return apiFetch<Ticket>(`/api/chat/messages/${messageId}/ticket`, {
    method: "POST", body: JSON.stringify({ confirmed: true, details }),
  });
}

export function addTicketReply(
  ticketId: string,
  message: string,
  attachmentIds: string[] = [],
): Promise<TicketReply> {
  return apiFetch<TicketReply>(`/api/tickets/${ticketId}/replies`, {
    method: "POST",
    body: JSON.stringify({ message, attachment_ids: attachmentIds }),
  });
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function ticketMediaHeaders(): HeadersInit {
  const token = adminApi.authToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Upload images and/or emojis the next reply will carry. */
export async function uploadTicketAttachments(
  ticketId: string,
  input: { files?: File[]; emojis?: string[] },
): Promise<TicketAttachment[]> {
  const form = new FormData();
  (input.files ?? []).forEach((file) => form.append("files", file));
  (input.emojis ?? []).forEach((emoji) => form.append("emojis", emoji));

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/tickets/${ticketId}/attachments`, {
      method: "POST",
      headers: ticketMediaHeaders(),
      body: form,
    });
  } catch {
    throw new Error(
      `Cannot reach backend at ${API_URL} — check "docker compose up -d --build" and the backend logs, then Retry.`,
    );
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? `Upload failed (${res.status})`);
  }
  return (await res.json()) as TicketAttachment[];
}

/** Remove an attachment that has not been sent with a reply yet. */
export async function deleteTicketAttachment(attachmentId: string): Promise<void> {
  await apiFetch<void>(`/api/tickets/attachments/${attachmentId}`, { method: "DELETE" });
}

/** Authenticated media fetch: <img src> cannot carry the bearer token. */
export async function fetchTicketAttachmentBlob(attachmentId: string): Promise<Blob> {
  const res = await fetch(`${API_URL}/api/tickets/attachments/${attachmentId}`, {
    headers: ticketMediaHeaders(),
  });
  if (!res.ok) throw new Error(`Could not load the attachment (${res.status}).`);
  return res.blob();
}

/** Read one ticket thread; the caller must be a participant in the ticket. */
export function getTicket(ticketId: string): Promise<TicketThread> {
  return apiFetch<TicketThread>(`/api/tickets/${ticketId}`);
}

export function getStudentTicket(ticketId: string): Promise<TicketThread> {
  return getTicket(ticketId);
}

export function resolveTicket(ticketId: string): Promise<Ticket> {
  return apiFetch<Ticket>(`/api/tickets/${ticketId}/resolve`, { method: "POST" });
}

export function reopenTicket(ticketId: string): Promise<Ticket> {
  return apiFetch<Ticket>(`/api/tickets/${ticketId}/reopen`, { method: "POST" });
}

export function getTicketCounts(classId?: string): Promise<TicketCounts> {
  const query = classId ? `?class_id=${encodeURIComponent(classId)}` : "";
  return apiFetch<TicketCounts>(`/api/tickets/counts${query}`);
}
