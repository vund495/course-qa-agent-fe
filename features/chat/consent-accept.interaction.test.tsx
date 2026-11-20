// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getSessionDetail } from '@/features/history/api';
import { streamWebConsent } from './api';
import { ChatWindow } from './chat-window';

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

vi.mock('@/features/history/api', () => ({
  getSessionDetail: vi.fn(),
}));

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>();
  return {
    ...actual,
    getChatQuota: vi.fn().mockResolvedValue(null),
    decideWebConsent: vi.fn(),
    streamWebConsent: vi.fn(),
  };
});

vi.mock('@/hooks/use-chat-stream', () => ({
  useChatStream: () => ({ sendMessage: vi.fn(), isStreaming: false }),
}));

vi.mock('./web-consent-prompt', () => ({
  WebConsentPrompt: ({ onAccept }: { onAccept: () => void }) => (
    <div data-testid="consent-prompt">
      <button type="button" onClick={() => void onAccept()}>
        Search the web
      </button>
    </div>
  ),
}));

const offer = {
  id: 'offer-1',
  session_id: 'session-1',
  scope_kind: 'missing',
  question: 'Original question',
  query_scope: ['Original question'],
  conflict_note: null,
  conflict_citations: [],
  expires_at: '2026-12-01T00:00:00Z',
};

type StreamHandlers = Parameters<typeof streamWebConsent>[3];

describe('consent accept prompt visibility', () => {
  let host: HTMLDivElement;
  let root: Root;
  let handlers: StreamHandlers;
  let resolveStream: (value: Awaited<ReturnType<typeof streamWebConsent>>) => void;
  let rejectStream: (error: Error) => void;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as never;
    Element.prototype.scrollIntoView = vi.fn();
    vi.mocked(getSessionDetail).mockResolvedValue({
      messages: [],
      pending_consent: offer,
    } as never);
    vi.mocked(streamWebConsent).mockImplementation((_id, _classId, _sessionId, next) => {
      handlers = next;
      return new Promise((resolve, reject) => {
        resolveStream = resolve;
        rejectStream = reject;
      });
    });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.clearAllMocks();
  });

  async function renderWindow() {
    await act(async () => {
      root.render(<ChatWindow classId="class-1" activeSessionId="session-1" />);
      await Promise.resolve();
    });
  }

  function promptVisible() {
    return Boolean(host.querySelector('[data-testid="consent-prompt"]'));
  }

  function accept() {
    const button = Array.from(host.querySelectorAll('button')).find(
      (item) => item.textContent === 'Search the web',
    );
    if (!button) throw new Error('Accept button is not rendered');
    return button;
  }

  it('hides the prompt immediately, shows Searching, and keeps it hidden on success', async () => {
    await renderWindow();
    expect(promptVisible()).toBe(true);

    await act(async () => {
      accept().click();
      await Promise.resolve();
    });

    expect(promptVisible()).toBe(false);
    expect(host.textContent).toContain('Searching');
    expect(vi.mocked(streamWebConsent)).toHaveBeenCalledTimes(1);

    await act(async () => {
      handlers.onDone({
        type: 'done',
        source: 'internet',
        usedWebSearch: true,
        threshold: 0,
        topScore: null,
        sessionId: 'session-1',
        userMessageId: null,
        assistantMessageId: 'web-1',
      });
      resolveStream({ kind: 'stream' });
      await Promise.resolve();
    });

    expect(promptVisible()).toBe(false);
  });

  it('restores the same prompt when the request fails, without retrying on its own', async () => {
    await renderWindow();
    expect(promptVisible()).toBe(true);

    await act(async () => {
      accept().click();
      await Promise.resolve();
    });
    expect(promptVisible()).toBe(false);

    await act(async () => {
      rejectStream(new Error('Web search failed.'));
      await Promise.resolve();
    });

    expect(promptVisible()).toBe(true);
    expect(vi.mocked(streamWebConsent)).toHaveBeenCalledTimes(1);
  });
});
