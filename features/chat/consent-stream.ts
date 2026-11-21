import { mergeCitation } from '@/lib/citations';
import type { ChatCitation, ChatProgressStage, ChatStreamEvent } from '@/lib/sse';

export type WebConsentBubble = {
  id: string;
  content: string;
  citations: ChatCitation[];
  suggestedQuestions?: string[];
  trace: string[];
  traceStep: number;
  traceCompleted: boolean;
  isError?: boolean;
  backendMessageId?: string;
};

const WEB_PROGRESS_STEPS = ['Searching the web', 'Writing the web answer'];
const WEB_STAGE_INDEX: Record<ChatProgressStage, number> = {
  searching: 0,
  reading: 0,
  drafting: 1,
};

/** A separate bubble that appears immediately when the user accepts. */
export function createWebConsentBubble(id: string): WebConsentBubble {
  return {
    id,
    content: '',
    citations: [],
    trace: [...WEB_PROGRESS_STEPS],
    traceStep: 0,
    traceCompleted: false,
  };
}

/** Apply one consent SSE event to the in-flight web answer bubble. */
export function applyWebConsentEvent(
  bubble: WebConsentBubble,
  event: ChatStreamEvent,
): WebConsentBubble {
  if (event.type === 'progress') {
    const stepIndex = WEB_STAGE_INDEX[event.stage];
    const trace = [...bubble.trace];
    trace[stepIndex] = event.message ?? WEB_PROGRESS_STEPS[stepIndex];
    return { ...bubble, trace, traceStep: stepIndex };
  }
  if (event.type === 'token') {
    return { ...bubble, content: bubble.content + event.text };
  }
  if (event.type === 'restart') {
    return { ...bubble, content: '' };
  }
  if (event.type === 'citation') {
    return {
      ...bubble,
      citations: mergeCitation(bubble.citations, event.citation),
    };
  }
  if (event.type === 'suggestions') {
    return { ...bubble, suggestedQuestions: event.questions };
  }
  if (event.type === 'done') {
    return {
      ...bubble,
      traceCompleted: true,
      backendMessageId: event.assistantMessageId ?? undefined,
      ...(event.suggestedQuestions?.length
        ? { suggestedQuestions: event.suggestedQuestions }
        : {}),
    };
  }
  if (event.type === 'error') {
    return {
      ...bubble,
      content: event.message,
      isError: true,
      traceCompleted: true,
    };
  }
  return bubble;
}

/** Upsert by local id so repeated stream events never duplicate a bubble. */
export function upsertMessageById<T extends { id: string }>(
  messages: T[],
  message: T,
): T[] {
  const index = messages.findIndex((item) => item.id === message.id);
  if (index === -1) return [...messages, message];
  const next = messages.slice();
  next[index] = message;
  return next;
}

/**
 * Update the visible transcript only while the conversation that owns the
 * offer is still selected. A background stream may keep updating its saved
 * context without leaking the answer into another conversation.
 */
export function upsertMessageForSession<T extends { id: string }>(
  messages: T[],
  message: T,
  {
    targetSessionId,
    currentSessionKey,
  }: { targetSessionId: string; currentSessionKey: string },
): T[] {
  if (targetSessionId !== currentSessionKey) return messages;
  return upsertMessageById(messages, message);
}
