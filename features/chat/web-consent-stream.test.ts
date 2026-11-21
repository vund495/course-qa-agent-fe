import { afterEach, describe, expect, it, vi } from 'vitest';

import { streamWebConsent } from './api';
import type { ChatCitation, ChatDoneEvent } from '@/lib/sse';

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

const done: ChatDoneEvent = {
  type: 'done',
  source: 'internet',
  usedWebSearch: true,
  threshold: 0,
  topScore: null,
  sessionId: 'session-1',
  userMessageId: null,
  assistantMessageId: 'assistant-web-1',
};

function sseBody(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

function streamResponse(chunks: string[]): Response {
  return new Response(sseBody(chunks), {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('streamWebConsent', () => {
  it('consumes progress, tokens, citations, and done from SSE', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        streamResponse([
          'event: progress\ndata: {"stage":"searching","message":"Searching the web"}\n\n',
          'event: progress\ndata: {"stage":"drafting","message":"Writing the web answer"}\n\n',
          'event: token\ndata: {"text":"A queue "}\n\n',
          'event: token\ndata: {"text":"is FIFO [1]."}\n\n',
          `event: citation\ndata: ${JSON.stringify({
            index: citation.index,
            kind: citation.kind,
            title: citation.title,
            url: citation.url,
            snippet: citation.snippet,
            document_id: citation.documentId,
            page: citation.page,
          })}\n\n`,
          `event: done\ndata: ${JSON.stringify({
            source: done.source,
            used_web_search: done.usedWebSearch,
            threshold: done.threshold,
            top_score: done.topScore,
            session_id: done.sessionId,
            user_message_id: done.userMessageId,
            assistant_message_id: done.assistantMessageId,
          })}\n\n`,
        ]),
      ),
    );

    const progress: string[] = [];
    const tokens: string[] = [];
    const citations: ChatCitation[] = [];
    const received: { done: ChatDoneEvent | null } = { done: null };

    const outcome = await streamWebConsent('offer-1', 'class-1', 'session-1', {
      onProgress: (stage, message) => progress.push(`${stage}:${message}`),
      onToken: (text) => tokens.push(text),
      onCitation: (item) => citations.push(item),
      onDone: (event) => {
        received.done = event;
      },
    });

    expect(outcome).toEqual({ kind: 'stream' });
    expect(progress).toEqual([
      'searching:Searching the web',
      'drafting:Writing the web answer',
    ]);
    expect(tokens.join('')).toBe('A queue is FIFO [1].');
    expect(citations).toHaveLength(1);
    expect(citations[0]).toMatchObject(citation);
    expect(received.done?.assistantMessageId).toBe('assistant-web-1');
  });

  it('returns the duplicate answer when the server sends JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          offer_id: 'offer-1',
          status: 'already_consumed',
          answer: 'Existing web answer',
          citations: [],
          assistant_message_id: 'assistant-web-1',
        }),
      ),
    );

    const outcome = await streamWebConsent('offer-1', 'class-1', 'session-1', {
      onToken: () => undefined,
      onCitation: () => undefined,
      onDone: () => undefined,
    });

    expect(outcome.kind).toBe('json');
    if (outcome.kind === 'json') {
      expect(outcome.result.answer).toBe('Existing web answer');
    }
  });

  it('throws the sanitized error event message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        streamResponse([
          'event: progress\ndata: {"stage":"searching","message":"Searching the web"}\n\n',
          'event: error\ndata: {"message":"The web answer could not be completed."}\n\n',
        ]),
      ),
    );

    await expect(
      streamWebConsent('offer-1', 'class-1', 'session-1', {
        onToken: () => undefined,
        onCitation: () => undefined,
        onDone: () => undefined,
      }),
    ).rejects.toThrow('The web answer could not be completed.');
  });
});
