'use client';

import * as React from 'react';
import { MessageBubble } from './message-bubble';
import { AnswerFeedback } from './answer-feedback';
import type { AnswerFeedback as Feedback } from './api';
import { ChatInput } from './chat-input';
import { ChatScrollArea } from './chat-scroll-area';
import { SuggestedQuestions } from './suggested-questions';
import { WebConsentPrompt } from './web-consent-prompt';
import {
  applyWebConsentEvent,
  createWebConsentBubble,
  upsertMessageById,
  upsertMessageForSession,
  type WebConsentBubble,
} from './consent-stream';
import {
  adoptConsentSessionKey,
  buildStreamTranscript,
} from './consent-race';
import { AskTeacherButton } from '@/features/tickets/ask-teacher-button';
import { associatedQuestion } from '@/features/tickets/associated-question';
import { useChatStream } from '@/hooks/use-chat-stream';
import { getSessionDetail } from '@/features/history/api';
import { decideWebConsent, getChatQuota, streamWebConsent, type ChatQuota } from './api';
import { mapHistoryCitation, mergeCitation, uniqueCitations } from '@/lib/citations';
import type { ChatMessageItem } from '@/features/history/types';
import { History, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ChatCitation, ChatConsentOffer, ChatProgressStage } from '@/lib/sse';

// Define message type
type Message = {
  backendMessageId?: string;
  feedback?: Feedback | null;
  ticketId?: string | null;
  canCreateFeedbackTicket?: boolean;
  originalQuestion?: string | null;
  id: string;
  role: 'user' | 'ai';
  content: string;
  /** Reasoning steps shown while the answer is produced (and kept collapsed after). */
  trace?: string[];
  traceStep?: number;
  traceCompleted?: boolean;
  thinkingMs?: number;
  citations?: ChatCitation[];
  suggestedQuestions?: string[];
  isError?: boolean;
  /** The question to re-send when the user retries a failed answer (AC-02). */
  retryText?: string;
};

/**
 * One in-flight answer. It is intentionally independent from the currently
 * selected conversation so switching sessions does not abort or lose it.
 */
type StreamContext = {
  /** Session key used while the answer is produced; NEW_CHAT_KEY until created. */
  key: string;
  /** Real backend session id, null while the first turn is still being created. */
  sessionId: string | null;
  /** Transcript before the user message was appended. */
  baseMessages: Message[];
  userMessage: Message;
  answer: Message;
  /** Web answers accepted while this turn is still the live stream. */
  webMessages: Message[];
  completed: boolean;
};

const NEW_CHAT_KEY = '__new_chat__';

/**
 * Render-safe snapshot of the in-flight stream. The ref below stays the source
 * of truth for stream callbacks; this state only mirrors what the current
 * render needs so we never read a ref during render.
 */
type StreamSnapshot = {
  key: string;
  sessionId: string | null;
  answerId: string;
};

type SelectionAction = {
  messageId: string;
  text: string;
  left: number;
  top: number;
};

function transcriptForContext(context: StreamContext): Message[] {
  return buildStreamTranscript(context);
}

// Initialize chat state
// History is fetched via getSessionDetail(activeSessionId) (Task AI-95, AI-97)
// History must be filtered by classId - each class has its own chat scope.
const INITIAL_MESSAGES: Message[] = [
  {
    id: 'welcome-msg',
    role: 'ai',
    content: "Hello! I am your course AI assistant. What can I help you with regarding today's lectures or assignments?",
  },
];

// Progress stages emitted by the class chat SSE stream.
const THINKING_STEPS = [
  'Searching class materials',
  'Reviewing matching sections',
  'Synthesizing answer',
];
const THINKING_STEP_INDEX: Record<ChatProgressStage, number> = {
  searching: 0,
  reading: 1,
  drafting: 2,
};

export function ChatWindow({
  classId,
  activeSessionId,
  onTurnComplete,
  onBackgroundTurnComplete,
  onOpenSession,
  onNewChat,
  onOpenHistory,
  canOpenTicket = false,
}: {
  classId: string;
  activeSessionId?: string | null;
  /** Called when the selected conversation's turn is persisted. */
  onTurnComplete?: (sessionId: string) => void;
  /** Called when a background turn finishes so the sidebar can refresh only. */
  onBackgroundTurnComplete?: (sessionId: string) => void;
  /** Lets the background-answer banner return to the conversation. */
  onOpenSession?: (sessionId: string) => void;
  /** Lets the banner return to a first-turn conversation that has no id yet. */
  onNewChat?: () => void;
  /** Mobile only: opens the chat-history drawer (the panel is hidden < md). */
  onOpenHistory?: () => void;
  /** Student chat can open a teacher ticket for a completed answer. */
  canOpenTicket?: boolean;
}) {
  const [messages, setMessages] = React.useState<Message[]>(INITIAL_MESSAGES);
  const [selectionAction, setSelectionAction] = React.useState<SelectionAction | null>(null);
  const [quota, setQuota] = React.useState<ChatQuota | null>(null);
  const [isTyping, setIsTyping] = React.useState(false); // Waiting state for the first chunk (to show typing indicator)
  const [isLoadingHistory, setIsLoadingHistory] = React.useState(false);
  const [pendingConsent, setPendingConsent] = React.useState<ChatConsentOffer | null>(null);
  const [acceptingConsentId, setAcceptingConsentId] = React.useState<string | null>(null);
  const [consentBusy, setConsentBusy] = React.useState(false);
  const [webStreamingId, setWebStreamingId] = React.useState<string | null>(null);
  const consentControllerRef = React.useRef<AbortController | null>(null);

  const refreshQuota = React.useCallback(() => {
    getChatQuota()
      .then(setQuota)
      .catch(() => {
        // The quota strip is optional; a failed read must never block chat.
      });
  }, []);

  React.useEffect(() => {
    refreshQuota();
  }, [refreshQuota]);

  // Message ID counter (stable IDs, avoid calling impure fn during render).
  const msgIdRef = React.useRef(0);
  const nextMsgId = React.useCallback(() => {
    msgIdRef.current += 1;
    return `msg-${msgIdRef.current}`;
  }, []);

  // The answer currently being produced, even if the user opens another chat.
  const streamContextRef = React.useRef<StreamContext | null>(null);
  // Render mirror of the ref above; keeps ref access out of the render phase.
  const [streamSnapshot, setStreamSnapshot] = React.useState<StreamSnapshot | null>(null);
  // True until the SSE response is fully closed (suggestions arrive after
  // `done`, so the live transcript must survive that window).
  const streamActiveRef = React.useRef(false);

  const currentKey = activeSessionId ?? NEW_CHAT_KEY;
  // Stream callbacks are created at send time; this ref always tells them which
  // conversation is actually on screen right now.
  const currentKeyRef = React.useRef(currentKey);
  React.useEffect(() => {
    currentKeyRef.current = currentKey;
  }, [currentKey]);

  // A class change invalidates the consent stream; unmounting aborts it too so
  // the backend releases the offer instead of leaving it processing.
  React.useEffect(() => {
    consentControllerRef.current?.abort();
  }, [classId]);

  React.useEffect(() => {
    return () => {
      consentControllerRef.current?.abort();
    };
  }, []);

  // Anchor to reference the bottom of the message list
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const updateSelectionAction = React.useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      setSelectionAction(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const getElement = (node: Node) => node instanceof Element ? node : node.parentElement;
    const startContent = getElement(range.startContainer)?.closest('[data-chat-answer-content]');
    const endContent = getElement(range.endContainer)?.closest('[data-chat-answer-content]');
    const messageElement = startContent?.closest<HTMLElement>('[data-chat-message-id]');
    const text = selection.toString().trim();
    if (!startContent || startContent !== endContent || !messageElement || !text) {
      setSelectionAction(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    if (!rect.width && !rect.height) {
      setSelectionAction(null);
      return;
    }
    const left = Math.max(12, Math.min(window.innerWidth - 140, rect.left + rect.width / 2 - 60));
    const top = rect.top > 48 ? rect.top - 40 : Math.min(window.innerHeight - 44, rect.bottom + 8);
    setSelectionAction({ messageId: messageElement.dataset.chatMessageId ?? '', text, left, top });
  }, []);

  React.useEffect(() => {
    if (!canOpenTicket) return;
    document.addEventListener('selectionchange', updateSelectionAction);
    return () => document.removeEventListener('selectionchange', updateSelectionAction);
  }, [canOpenTicket, updateSelectionAction]);

  // Keep the typing indicator tied to the conversation that owns the stream.
  React.useEffect(() => {
    const timer = setTimeout(() => {
      const context = streamContextRef.current;
      const key = activeSessionId ?? NEW_CHAT_KEY;
      setIsTyping(
        Boolean(
          context &&
            context.key === key &&
            !context.completed &&
            !context.answer.content,
        ),
      );
    }, 0);
    return () => clearTimeout(timer);
  }, [activeSessionId]);

  // Load chat session history when activeSessionId changes (AC-07).
  // If the selected conversation owns the live answer, render that local
  // transcript instead: refetching would temporarily hide the streamed text.
  React.useEffect(() => {
    const key = activeSessionId ?? NEW_CHAT_KEY;
    const context = streamContextRef.current;

    if (context && context.key === key) {
      const timer = setTimeout(() => {
        setMessages(transcriptForContext(context));
        setIsLoadingHistory(false);
      }, 0);
      return () => clearTimeout(timer);
    }

    // A finished background answer is already persisted. Drop the local copy;
    // the next visit can load the canonical transcript from the server.
    if (context?.completed && !streamActiveRef.current) {
      streamContextRef.current = null;
      setStreamSnapshot(null);
    }

    if (!activeSessionId) {
      if (context && context.key !== NEW_CHAT_KEY) {
        streamContextRef.current = null;
        setStreamSnapshot(null);
      }
      const timer = setTimeout(() => {
        setMessages(INITIAL_MESSAGES);
        setPendingConsent(null);
        setIsLoadingHistory(false);
      }, 0);
      return () => clearTimeout(timer);
    }

    let isMounted = true;
    Promise.resolve().then(() => {
      if (isMounted) {
        setIsLoadingHistory(true);
      }
    });

    getSessionDetail(activeSessionId)
      .then((detail) => {
        if (!isMounted) return;
        const loaded: Message[] = (detail.messages || []).map((m: ChatMessageItem) => ({
          id: m.id,
          backendMessageId: m.role === 'ASSISTANT' ? m.id : undefined,
          feedback: m.feedback,
          ticketId: m.ticket_id,
          canCreateFeedbackTicket: m.can_create_feedback_ticket,
          originalQuestion: m.original_question,
          role: m.role.toLowerCase() === 'user' ? 'user' : 'ai',
          content: m.content,
          citations: uniqueCitations((m.citations ?? []).map(mapHistoryCitation)),
          suggestedQuestions: Array.isArray(m.suggested_questions) ? m.suggested_questions : undefined,
          thinkingMs: typeof m.thinking_ms === 'number' ? m.thinking_ms : undefined,
          trace: Array.isArray(m.trace) && m.trace.length > 0 ? m.trace : undefined,
          traceCompleted: true,
        }));

        setMessages(loaded.length > 0 ? loaded : INITIAL_MESSAGES);
        setPendingConsent(
          detail.pending_consent
            ? {
                id: detail.pending_consent.id,
                sessionId: detail.pending_consent.session_id,
                scopeKind: detail.pending_consent.scope_kind,
                question: detail.pending_consent.question,
                queryScope: detail.pending_consent.query_scope,
                conflictNote: detail.pending_consent.conflict_note ?? null,
                conflictCitations: (detail.pending_consent.conflict_citations ?? []).map(
                  mapHistoryCitation,
                ),
                expiresAt: detail.pending_consent.expires_at,
                assistantMessageId: detail.pending_consent.assistant_message_id,
              }
            : null,
        );
      })
      .catch((err) => {
        console.error('Failed to load session history:', err);
        toast.error('Could not load the conversation history.');
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingHistory(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeSessionId]);


  // Step 3.2: Auto-scroll to bottom on new message
  React.useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  const updateStreamAnswer = React.useCallback(
    (updater: (message: Message) => Message) => {
      const context = streamContextRef.current;
      if (!context) return;

      const nextAnswer = updater(context.answer);
      context.answer = nextAnswer;

      // Background answers only update their context; the visible transcript
      // belongs to another conversation and must not be touched.
      if (currentKeyRef.current !== context.key) return;

      setMessages((prev) =>
        prev.map((message) =>
          message.id === nextAnswer.id ? nextAnswer : message,
        ),
      );
    },
    [],
  );

  // Step 4.2: Initialize Stream Hook
  const { sendMessage, isStreaming } = useChatStream({
    classId,
    sessionId: activeSessionId,
    onProgress: (stage, stageMessage) => {
      const stepIdx = THINKING_STEP_INDEX[stage];
      updateStreamAnswer((message) => {
        const nextTrace = message.trace ? [...message.trace] : [...THINKING_STEPS];
        if (stageMessage) {
          nextTrace[stepIdx] = stageMessage;
        }
        return {
          ...message,
          trace: nextTrace,
          traceStep: stepIdx,
        };
      });
    },
    onChunk: (chunkText, elapsedMs) => {
      // Turn off typing indicator when first chunk arrives
      setIsTyping(false);

      // Append new text to the pending AI message, and freeze how long the
      // retrieval/thinking phase actually took (measured by the stream hook).
      updateStreamAnswer((message) => ({
        ...message,
        content: message.content + chunkText,
        thinkingMs: message.thinkingMs ?? elapsedMs,
      }));
    },
    onRestart: () => {
      setIsTyping(true);
      updateStreamAnswer((message) => ({
        ...message,
        content: '',
        citations: [],
      }));
    },
    onCitation: (citation) => {
      updateStreamAnswer((message) => ({
        ...message,
        citations: mergeCitation(message.citations, citation),
      }));
    },
    onSuggestions: (questions) => {
      updateStreamAnswer((message) => ({
        ...message,
        suggestedQuestions: questions,
      }));
    },
    onConsent: (offer) => {
      const context = streamContextRef.current;
      if (!context || currentKeyRef.current !== context.key) return;
      // The offer is persisted before `done`; adopt the real session now so an
      // early accept can append to this live transcript instead of being lost.
      const sessionKey = adoptConsentSessionKey(context.key, offer.sessionId, NEW_CHAT_KEY);
      if (sessionKey !== context.key) {
        context.key = sessionKey;
        context.sessionId = offer.sessionId;
        currentKeyRef.current = sessionKey;
        setStreamSnapshot((snapshot) =>
          snapshot ? { ...snapshot, key: sessionKey, sessionId: offer.sessionId } : snapshot,
        );
      }
      setPendingConsent(offer);
    },
    onDone: (event) => {
      void refreshQuota();
      const context = streamContextRef.current;
      if (!context) return;

      const wasActive = currentKeyRef.current === context.key;

      if (event.sessionId) {
        context.sessionId = event.sessionId;
        // A first turn starts on the temporary new-chat key; adopt the real id
        // so returning to that conversation can find the local transcript.
        if (context.key === NEW_CHAT_KEY) {
          context.key = event.sessionId;
        }
      }

      context.completed = true;
      const nextAnswer = {
        ...context.answer,
        backendMessageId: event.assistantMessageId ?? undefined,
        canCreateFeedbackTicket: Boolean(event.assistantMessageId && event.userMessageId),
        originalQuestion: context.userMessage.content,
        traceCompleted: true,
        ...(event.suggestedQuestions && event.suggestedQuestions.length > 0
          ? { suggestedQuestions: event.suggestedQuestions }
          : {}),
      };
      context.answer = nextAnswer;
      setIsTyping(false);
      setStreamSnapshot({
        key: context.key,
        sessionId: context.sessionId,
        answerId: context.answer.id,
      });

      if (wasActive) {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === context.answer.id ? context.answer : message,
          ),
        );

        if (event.sessionId) {
          // First turn: the parent selects the new session and the effect above
          // renders the local transcript. Existing sessions only need a sidebar
          // refresh, not a transcript reload.
          onTurnComplete?.(event.sessionId);
        }
      } else if (event.sessionId) {
        // Do not steal the user's current selection. The sidebar still needs to
        // know that the background conversation has a new turn.
        onBackgroundTurnComplete?.(event.sessionId);
        toast.success('The answer finished in another conversation.');
      }
    },
    onError: (error) => {
      void refreshQuota();
      const context = streamContextRef.current;
      if (!context) return;

      const wasActive = currentKeyRef.current === context.key;
      context.completed = true;
      context.answer = {
        ...context.answer,
        content: error.message,
        isError: true,
      };
      setIsTyping(false);
      setStreamSnapshot({
        key: context.key,
        sessionId: context.sessionId,
        answerId: context.answer.id,
      });

      if (wasActive) {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === context.answer.id ? context.answer : message,
          ),
        );
        toast.error(error.message);
      } else {
        toast.error(`The answer failed in another conversation: ${error.message}`);
      }
    },
  });

  // The stream is fully closed only when the hook drops `isStreaming`.
  React.useEffect(() => {
    if (!isStreaming) {
      streamActiveRef.current = false;
    }
  }, [isStreaming]);

  // Handler for user sending a message
  const handleSend = (text: string) => {
    if (quota?.limit != null && (quota.remaining ?? 0) <= 0) {
      toast.error('Daily question limit reached. Come back tomorrow.');
      return;
    }

    // A new question supersedes any pending consent offer for this conversation.
    setPendingConsent(null);

    // 1. Append the user message and a pending AI message carrying the trace,
    //    so the reasoning steps are visible while the answer is produced.
    const key = activeSessionId ?? NEW_CHAT_KEY;
    const baseMessages = messages;
    const newUserMsg: Message = { id: nextMsgId(), role: 'user', content: text };
    const pendingAiMsg: Message = {
      id: nextMsgId(),
      role: 'ai',
      content: '',
      trace: [...THINKING_STEPS],
      traceStep: 0,
      retryText: text,
    };

    streamContextRef.current = {
      key,
      sessionId: activeSessionId ?? null,
      baseMessages,
      userMessage: newUserMsg,
      answer: pendingAiMsg,
      webMessages: [],
      completed: false,
    };
    setStreamSnapshot({
      key,
      sessionId: activeSessionId ?? null,
      answerId: pendingAiMsg.id,
    });
    currentKeyRef.current = key;

    setMessages([...baseMessages, newUserMsg, pendingAiMsg]);

    // 2. Enable AI typing indicator
    setIsTyping(true);

    // 3. Trigger the streaming API hook
    streamActiveRef.current = true;
    sendMessage(text);
  };

  // AC-02: re-send the question behind a failed answer, replacing the error
  // bubble with a fresh pending answer. Older turns are kept untouched.
  const handleRetry = (failed: Message) => {
    if (!failed.retryText || isTyping || isStreaming) return;

    const failedIndex = messages.findIndex((message) => message.id === failed.id);
    const userMessage = failedIndex > 0 ? messages[failedIndex - 1] : undefined;
    if (!userMessage || userMessage.role !== 'user') return;

    const key = activeSessionId ?? NEW_CHAT_KEY;
    const baseMessages = messages.slice(0, failedIndex - 1);
    const retryAnswer: Message = {
      id: nextMsgId(),
      role: 'ai',
      content: '',
      trace: [...THINKING_STEPS],
      traceStep: 0,
      retryText: failed.retryText,
    };

    streamContextRef.current = {
      key,
      sessionId: activeSessionId ?? null,
      baseMessages,
      userMessage,
      answer: retryAnswer,
      webMessages: [],
      completed: false,
    };
    setStreamSnapshot({
      key,
      sessionId: activeSessionId ?? null,
      answerId: retryAnswer.id,
    });
    currentKeyRef.current = key;

    setMessages([...baseMessages, userMessage, retryAnswer]);
    setIsTyping(true);
    streamActiveRef.current = true;
    sendMessage(failed.retryText);
  };

  const handleConsentDecline = async () => {
    const target = pendingConsent;
    if (!target || consentBusy) return;
    setConsentBusy(true);
    try {
      await decideWebConsent(target.id, 'decline', classId, target.sessionId);
      setPendingConsent((current) => (current?.id === target.id ? null : current));
      toast.info('No web search was performed.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update web consent.');
    } finally {
      setConsentBusy(false);
    }
  };

  const handleConsentAccept = async () => {
    const target = pendingConsent;
    if (!target || consentBusy) return;
    setConsentBusy(true);
    // Hide only this offer while its request runs; the pending offer is kept so
    // a failure can show the prompt again and require another click.
    setAcceptingConsentId(target.id);

    const bubbleId = nextMsgId();
    const toMessage = (bubble: WebConsentBubble): Message => ({
      id: bubble.id,
      role: 'ai',
      content: bubble.content,
      citations: bubble.citations,
      trace: bubble.trace,
      traceStep: bubble.traceStep,
      traceCompleted: bubble.traceCompleted,
      isError: bubble.isError,
      backendMessageId: bubble.backendMessageId,
      suggestedQuestions: bubble.suggestedQuestions,
      canCreateFeedbackTicket: Boolean(bubble.backendMessageId),
      originalQuestion: target.question,
    });
    let bubble = createWebConsentBubble(bubbleId);
    const updateBubble = (next: WebConsentBubble) => {
      bubble = next;
      const message = toMessage(next);
      const context = streamContextRef.current;
      if (context && context.key === target.sessionId) {
        context.webMessages = upsertMessageById(context.webMessages, message);
      }
      setMessages((previous) =>
        upsertMessageForSession(previous, message, {
          targetSessionId: target.sessionId,
          currentSessionKey: currentKeyRef.current,
        }),
      );
    };

    // Show the separate web bubble and its Searching step immediately.
    setWebStreamingId(bubbleId);
    updateBubble(bubble);

    const controller = new AbortController();
    consentControllerRef.current = controller;
    let completed = false;
    try {
      const outcome = await streamWebConsent(
        target.id,
        classId,
        target.sessionId,
        {
          onProgress: (stage, message) =>
            updateBubble(
              applyWebConsentEvent(bubble, { type: 'progress', stage, message }),
            ),
          onToken: (text) =>
            updateBubble(applyWebConsentEvent(bubble, { type: 'token', text })),
          onRestart: () =>
            updateBubble(applyWebConsentEvent(bubble, { type: 'restart' })),
          onCitation: (citation) =>
            updateBubble(
              applyWebConsentEvent(bubble, { type: 'citation', citation }),
            ),
          onSuggestions: (questions) =>
            updateBubble(
              applyWebConsentEvent(bubble, { type: 'suggestions', questions }),
            ),
          onDone: (event) => {
            completed = true;
            updateBubble(applyWebConsentEvent(bubble, event));
          },
        },
        controller.signal,
      );

      if (outcome.kind === 'json') {
        if (!outcome.result.answer) {
          throw new Error('The web answer was not available.');
        }
        completed = true;
        updateBubble({
          ...bubble,
          content: outcome.result.answer,
          citations: uniqueCitations(
            (outcome.result.citations ?? []).map(mapHistoryCitation),
          ),
          suggestedQuestions:
            outcome.result.suggested_questions?.length
              ? outcome.result.suggested_questions
              : bubble.suggestedQuestions,
          traceCompleted: true,
          backendMessageId: outcome.result.assistant_message_id ?? undefined,
        });
      }

      if (!completed) {
        throw new Error('The web answer stream ended unexpectedly.');
      }

      setPendingConsent((current) => (current?.id === target.id ? null : current));
      if (currentKeyRef.current === target.sessionId) {
        toast.success('Web search answer added separately below.');
      } else {
        toast.info('The web answer will appear when you return to that conversation.');
      }
    } catch (error) {
      if (controller.signal.aborted || completed) return;
      const message =
        error instanceof Error ? error.message : 'Web search could not be completed.';
      updateBubble(applyWebConsentEvent(bubble, { type: 'error', message }));
      toast.error(message);
    } finally {
      if (consentControllerRef.current === controller) {
        consentControllerRef.current = null;
      }
      setWebStreamingId((current) => (current === bubbleId ? null : current));
      setAcceptingConsentId((current) => (current === target.id ? null : current));
      setConsentBusy(false);
    }
  };

  const backgroundStream =
    streamSnapshot && isStreaming && streamSnapshot.key !== currentKey
      ? streamSnapshot
      : null;

  // The banner is actionable only when the parent can actually navigate back.
  const canReturnToBackground = backgroundStream
    ? backgroundStream.sessionId
      ? Boolean(onOpenSession)
      : Boolean(onNewChat)
    : false;

  const activeStreamAnswerId =
    streamSnapshot?.key === currentKey ? streamSnapshot.answerId : null;
  const isNewChat =
    !activeSessionId &&
    !isLoadingHistory &&
    messages.length === 1 &&
    messages[0]?.id === 'welcome-msg';

  return (
    <div className="flex flex-col h-full relative bg-white">
      {/* The transcript and history rail share the same soft header tint as the class tabs. */}
      <header className="relative isolate flex h-[92px] shrink-0 flex-col justify-center overflow-hidden border-b border-[#45698B] bg-[linear-gradient(112deg,#294D72_0%,#365F85_68%,#47759A_100%)] px-4 py-3 sm:px-5 md:px-6">
        <div className="relative z-10 flex flex-col gap-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="font-heading text-balance text-[21px] font-bold leading-tight tracking-tight text-white sm:text-[24px]">
                Course AI Assistant
              </h1>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {onOpenHistory && (
                <button
                  type="button"
                  onClick={onOpenHistory}
                  title="Chat history"
                  aria-label="Open chat history"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-white/90 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 md:hidden"
                >
                  <History className="h-4 w-4" />
                </button>
              )}
              {quota?.limit != null && (
                <span
                  className={`whitespace-nowrap text-[11px] font-bold ${
                    quota.remaining === 0 ? 'text-[#FCD9B6]' : 'text-[#DEE8F2]'
                  }`}
                  title={`${quota.remaining ?? 0} of ${quota.limit} questions left today`}
                >
                  <span className="sm:hidden">
                    {quota.remaining ?? 0}/{quota.limit} left
                  </span>
                  <span className="hidden sm:inline">
                    {quota.remaining === 0
                      ? 'Daily question limit reached'
                      : `${quota.remaining ?? 0} of ${quota.limit} questions left today`}
                  </span>
                </span>
              )}
            </div>
          </div>
          <p className="max-w-4xl text-[13px] leading-relaxed text-[#DEE8F2] sm:text-[13.5px]">
            Ask about this class&apos;s materials — every answer cites its source.
          </p>
        </div>
      </header>

      {backgroundStream && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-muted/60 px-3 py-2 text-xs text-foreground md:px-4">
          <span className="truncate">
            AI is still answering in another conversation. You can go back to it.
          </span>
          {canReturnToBackground && (
            <button
              type="button"
              onClick={() => {
                if (backgroundStream.sessionId) {
                  onOpenSession?.(backgroundStream.sessionId);
                } else {
                  onNewChat?.();
                }
              }}
              className="shrink-0 rounded-md border border-border bg-white px-2 py-1 font-medium text-foreground transition-colors hover:bg-muted"
            >
              Back to chat
            </button>
          )}
        </div>
      )}

      {isNewChat ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 pb-10">
          <div className="w-full max-w-2xl text-center">
            <h2 className="text-[20px] font-semibold tracking-tight text-[#111111]">
              Ask anything about this course
            </h2>
            <p className="mt-2 text-[13px] leading-6 text-[#5A5A5A]">
              Get answers grounded in your course materials, with citations you can verify.
            </p>
            <div className="mt-6">
              <ChatInput
                onSend={handleSend}
                disabled={isTyping || isStreaming}
                chatLayout
                quota={quota}
              />
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Top area: Message list container (auto-scrolls if long) */}
          <ChatScrollArea className="bg-white px-4 md:px-6 pt-3 pb-6">
            <div
              className="w-full"
              onMouseDown={(event) => {
                if (!(event.target instanceof Element) || !event.target.closest('[data-ask-teacher-action]')) {
                  setSelectionAction(null);
                }
              }}
              onMouseUp={updateSelectionAction}
              onKeyUp={updateSelectionAction}
            >
              {isLoadingHistory ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-[#6F6F6F]">
                  <Loader2 className="h-6 w-6 animate-spin text-[#6F6F6F]" />
                  <span className="text-xs">Loading conversation...</span>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isMessageStreaming =
                    (isStreaming && msg.id === activeStreamAnswerId) ||
                    msg.id === webStreamingId;
                  const isMessagePending = isTyping && msg.id === activeStreamAnswerId;
                  const ticketQuestion = canOpenTicket && msg.role === 'ai' && !msg.isError &&
                    !isMessageStreaming && !isMessagePending
                    ? associatedQuestion(messages, index)
                    : null;

                  return (
                    <React.Fragment key={msg.id}>
                      <MessageBubble
                        messageId={msg.id}
                        role={msg.role}
                        content={msg.content}
                        isStreaming={isMessageStreaming}
                        isLoading={isMessagePending}
                        trace={msg.trace}
                        traceStep={msg.traceStep}
                        traceCompleted={msg.traceCompleted}
                        thinkingMs={msg.thinkingMs}
                        citations={msg.citations}
                        isError={msg.isError}
                        onRetry={msg.isError && msg.retryText ? () => handleRetry(msg) : undefined}
                        renderMarkdown={msg.role === 'ai'}
                        chatSurface
                      />
                      {canOpenTicket && msg.role === 'ai' && !msg.isError && !isMessageStreaming && !isMessagePending && msg.backendMessageId && (
                        <AnswerFeedback messageId={msg.backendMessageId} feedback={msg.feedback} ticketId={msg.ticketId}
                          canCreateTicket={Boolean(msg.canCreateFeedbackTicket)} classId={classId}
                          question={msg.originalQuestion ?? ''} answer={msg.content} citations={msg.citations ?? []}
                          onChange={(patch) => {
                            const update = (item: Message) => item.backendMessageId === msg.backendMessageId ? { ...item, ...patch } : item;
                            setMessages((current) => current.map(update));
                            const context = streamContextRef.current;
                            if (context) {
                              context.answer = update(context.answer);
                              context.baseMessages = context.baseMessages.map(update);
                            }
                          }} />
                      )}
                      {ticketQuestion && (
                        <AskTeacherButton
                          classId={classId}
                          question={ticketQuestion}
                          selection={selectionAction?.messageId === msg.id ? selectionAction : undefined}
                        />
                      )}
                    </React.Fragment>
                  );
                })
              )}

              {/* Follow-up question suggestions (AI-125) - visible after completed grounded answer */}
              {messages.length > 1 &&
                !isTyping &&
                messages[messages.length - 1]?.role === 'ai' &&
                !messages[messages.length - 1]?.isError &&
                Boolean(messages[messages.length - 1]?.suggestedQuestions?.length) && (
                  <SuggestedQuestions
                    questions={messages[messages.length - 1].suggestedQuestions!}
                    disabled={isTyping || isStreaming}
                    onSelect={handleSend}
                    label="Suggested follow-ups:"
                  />
              )}

              {pendingConsent && pendingConsent.id !== acceptingConsentId && (
                <div className="mb-3">
                  <WebConsentPrompt
                    offer={pendingConsent}
                    busy={consentBusy}
                    onAccept={handleConsentAccept}
                    onDecline={handleConsentDecline}
                  />
                </div>
              )}

              {/* Empty div serving as an anchor for scrollIntoView */}
              <div className="h-20" aria-hidden="true" />
              <div ref={messagesEndRef} />
            </div>
          </ChatScrollArea>

          {/* Full-width fade from the composer down, no side-edge fade. */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-14 bg-gradient-to-t from-white to-transparent"
            aria-hidden="true"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20">
            <ChatInput onSend={handleSend} disabled={isTyping || isStreaming} chatLayout quota={quota} />
          </div>
        </>
      )}
    </div>
  );
}
