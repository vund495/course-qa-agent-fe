/** Adopt the server-created session as soon as its consent offer arrives. */
export function adoptConsentSessionKey(
  currentKey: string,
  offerSessionId: string,
  newChatKey = "__new_chat__",
): string {
  return currentKey === newChatKey ? offerSessionId : currentKey;
}

/** Rebuild the live transcript, including accepted web answers stored on it. */
export function buildStreamTranscript<T>({
  baseMessages,
  userMessage,
  answer,
  webMessages,
}: {
  baseMessages: T[];
  userMessage: T;
  answer: T;
  webMessages: T[];
}): T[] {
  return [...baseMessages, userMessage, answer, ...webMessages];
}

/** Append a persisted web answer once, even if history reload races the client. */
export function appendMessageOnce<T extends { backendMessageId?: string }>(
  messages: T[],
  message: T,
): T[] {
  if (
    message.backendMessageId &&
    messages.some((item) => item.backendMessageId === message.backendMessageId)
  ) {
    return messages;
  }
  return [...messages, message];
}

export type ConsentRequestOutcome<T> = {
  result: T;
  applied: boolean;
};

/**
 * Resolve a delayed consent request and apply its result only if the user is
 * still looking at the conversation that owned the offer. If they switched
 * sessions while the request was in flight, the persisted history is the source
 * of truth and the current transcript must not receive the answer.
 */
export async function runConsentRequestForCurrentSession<T>({
  targetSessionId,
  getCurrentSessionKey,
  request,
  apply,
}: {
  targetSessionId: string;
  getCurrentSessionKey: () => string;
  request: () => Promise<T>;
  apply: (result: T) => void;
}): Promise<ConsentRequestOutcome<T>> {
  const result = await request();
  const applied = getCurrentSessionKey() === targetSessionId;
  if (applied) apply(result);
  return { result, applied };
}
