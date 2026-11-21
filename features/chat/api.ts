import { apiFetch } from '@/lib/admin-api';
import { AUTH_TOKEN_KEY } from '@/components/ui/nav-config';
import {
  createSseParser,
  type ChatCitation,
  type ChatDoneEvent,
  type ChatProgressStage,
} from '@/lib/sse';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

/** Daily question allowance; `limit` is null for teachers/admins. */
export type ChatQuota = {
  limit: number | null;
  used: number;
  remaining: number | null;
  resets_at: string | null;
};

export function getChatQuota(): Promise<ChatQuota> {
  return apiFetch<ChatQuota>('/api/chat/quota');
}

export type AnswerFeedback = 'helpful' | 'not_helpful';

export function saveAnswerFeedback(messageId: string, feedback: AnswerFeedback): Promise<{ feedback: AnswerFeedback }> {
  return apiFetch(`/api/chat/messages/${messageId}/feedback`, {
    method: 'PUT', body: JSON.stringify({ feedback }),
  });
}

export type WebConsentOffer = {
  id: string;
  session_id: string;
  scope_kind: 'missing' | 'full';
  question: string;
  query_scope: string[];
  expires_at: string;
  assistant_message_id: string | null;
};

export type WebConsentCitation = {
  index: number;
  kind: string;
  title: string;
  url: string | null;
  snippet: string;
  document_id: string | null;
  page: number | null;
  pages?: number[] | null;
  page_label?: string | null;
  indexes?: number[] | null;
  highlights?: string[] | null;
};

export type WebConsentResult = {
  offer_id: string;
  status: 'accepted' | 'declined' | 'already_consumed';
  answer: string | null;
  citations: WebConsentCitation[];
  suggested_questions?: string[];
  assistant_message_id: string | null;
};

export function getPendingConsent(
  classId: string,
  sessionId: string,
): Promise<{ offer: WebConsentOffer | null }> {
  const params = new URLSearchParams({ class_id: classId, session_id: sessionId });
  return apiFetch(`/api/chat/consent/pending?${params.toString()}`);
}

export function decideWebConsent(
  offerId: string,
  decision: 'accept' | 'decline',
  classId: string,
  sessionId: string,
): Promise<WebConsentResult> {
  return apiFetch(`/api/chat/consent/${encodeURIComponent(offerId)}`, {
    method: 'POST',
    body: JSON.stringify({
      decision,
      class_id: classId,
      session_id: sessionId,
    }),
  });
}

export type WebConsentStreamHandlers = {
  onProgress?: (stage: ChatProgressStage, message?: string) => void;
  onToken: (text: string) => void;
  onRestart?: (message?: string) => void;
  onCitation: (citation: ChatCitation) => void;
  onSuggestions?: (questions: string[]) => void;
  onDone: (event: ChatDoneEvent) => void;
};

export type WebConsentStreamOutcome =
  | { kind: 'stream' }
  | { kind: 'json'; result: WebConsentResult };

/**
 * Accept a consent offer and consume its SSE stream. A duplicate accept can
 * still return the existing answer as JSON, so both contracts are handled.
 */
export async function streamWebConsent(
  offerId: string,
  classId: string,
  sessionId: string,
  handlers: WebConsentStreamHandlers,
  signal?: AbortSignal,
): Promise<WebConsentStreamOutcome> {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : null;
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/api/chat/consent/${encodeURIComponent(offerId)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          decision: 'accept',
          class_id: classId,
          session_id: sessionId,
        }),
        signal,
      },
    );
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(
      'Cannot reach the server. Check your internet connection and try again.',
    );
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      detail?: unknown;
    } | null;
    const detail = typeof body?.detail === 'string' ? body.detail : null;
    throw new Error(detail || `Web search failed (${response.status}).`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return {
      kind: 'json',
      result: (await response.json()) as WebConsentResult,
    };
  }

  if (!response.body) {
    throw new Error('The web consent API did not return a response stream.');
  }

  let completed = false;
  const parser = createSseParser((event) => {
    if (event.type === 'progress') {
      handlers.onProgress?.(event.stage, event.message);
    } else if (event.type === 'token') {
      handlers.onToken(event.text);
    } else if (event.type === 'restart') {
      handlers.onRestart?.(event.message);
    } else if (event.type === 'citation') {
      handlers.onCitation(event.citation);
    } else if (event.type === 'suggestions') {
      handlers.onSuggestions?.(event.questions);
    } else if (event.type === 'done') {
      completed = true;
      handlers.onDone(event);
    } else if (event.type === 'error') {
      throw new Error(event.message);
    } else {
      throw new Error('Unexpected event in the web answer stream.');
    }
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.push(decoder.decode(value, { stream: true }));
  }
  parser.push(decoder.decode());
  parser.finish();

  if (!completed) {
    throw new Error('The web answer stream ended unexpectedly.');
  }
  return { kind: 'stream' };
}
