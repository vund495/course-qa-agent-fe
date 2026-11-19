import { describe, expect, it } from 'vitest';

import { applyWebConsentEvent, createWebConsentBubble, upsertMessageForSession } from './consent-stream';
import type { ChatCitation } from '@/lib/sse';

const citation: ChatCitation = {
  index: 1,
  kind: 'internet',
  title: 'Public reference',
  url: 'https://example.com/reference',
  snippet: 'A web snippet',
  documentId: null,
  page: null,
  indexes: [],
  highlights: [],
};

describe('web consent stream bubble', () => {
  it('starts immediately in the Searching state', () => {
    const bubble = createWebConsentBubble('web-1');

    expect(bubble.content).toBe('');
    expect(bubble.trace).toEqual(['Searching the web', 'Writing the web answer']);
    expect(bubble.traceStep).toBe(0);
    expect(bubble.traceCompleted).toBe(false);
  });

  it('applies progress, tokens, citations, and done incrementally', () => {
    let bubble = createWebConsentBubble('web-1');
    bubble = applyWebConsentEvent(bubble, {
      type: 'progress',
      stage: 'searching',
      message: 'Searching the web',
    });
    bubble = applyWebConsentEvent(bubble, { type: 'token', text: 'A queue ' });
    bubble = applyWebConsentEvent(bubble, { type: 'token', text: 'is FIFO [1].' });
    bubble = applyWebConsentEvent(bubble, { type: 'citation', citation });
    bubble = applyWebConsentEvent(bubble, {
      type: 'done',
      source: 'internet',
      usedWebSearch: true,
      threshold: 0,
      topScore: null,
      sessionId: 'session-1',
      userMessageId: null,
      assistantMessageId: 'assistant-web-1',
    });

    expect(bubble.content).toBe('A queue is FIFO [1].');
    expect(bubble.citations).toEqual([citation]);
    expect(bubble.backendMessageId).toBe('assistant-web-1');
    expect(bubble.traceCompleted).toBe(true);
  });

  it('clears partial text on restart before retrying', () => {
    let bubble = createWebConsentBubble('web-1');
    bubble = applyWebConsentEvent(bubble, { type: 'token', text: 'partial' });
    bubble = applyWebConsentEvent(bubble, { type: 'restart' });

    expect(bubble.content).toBe('');
  });

  it('renders an error bubble without a persisted answer', () => {
    const bubble = applyWebConsentEvent(createWebConsentBubble('web-1'), {
      type: 'error',
      message: 'Web search failed.',
    });

    expect(bubble.content).toBe('Web search failed.');
    expect(bubble.isError).toBe(true);
    expect(bubble.traceCompleted).toBe(true);
  });

  it('never appends a bubble into another conversation', () => {
    const existing = [{ id: 'doc-answer' }];
    const next = upsertMessageForSession(
      existing,
      { id: 'web-1' },
      { targetSessionId: 'session-a', currentSessionKey: 'session-b' },
    );

    expect(next).toBe(existing);
    expect(next).toEqual([{ id: 'doc-answer' }]);
  });

  it('upserts the same bubble while the owning conversation is selected', () => {
    const first = upsertMessageForSession(
      [{ id: 'doc-answer' }],
      { id: 'web-1', content: 'A' },
      { targetSessionId: 'session-a', currentSessionKey: 'session-a' },
    );
    const second = upsertMessageForSession(
      first,
      { id: 'web-1', content: 'A queue' },
      { targetSessionId: 'session-a', currentSessionKey: 'session-a' },
    );

    expect(second).toEqual([
      { id: 'doc-answer' },
      { id: 'web-1', content: 'A queue' },
    ]);
  });
});
