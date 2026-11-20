// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import { createAnswerTicket, createTicket, getStudentTicket } from './api';
import { studentApi } from '@/lib/student-api';
import { AskTeacherButton } from './ask-teacher-button';

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

vi.mock('@/components/ui/dialog', () => {
  const Container = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return {
    Dialog: ({ children, open }: { children: ReactNode; open: boolean }) =>
      open ? <div role="dialog">{children}</div> : null,
    DialogContent: Container,
    DialogDescription: Container,
    DialogFooter: Container,
    DialogHeader: Container,
    DialogTitle: Container,
  };
});

vi.mock('@/components/ui/app-select', () => ({
  AppSelect: ({ value, options }: { value: string; options: { value: string; label: string }[] }) => (
    <select value={value} onChange={() => {}}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock('@/lib/student-api', () => ({
  studentApi: {
    classes: vi.fn().mockResolvedValue([
      { id: 'class-1', code: 'CS101', name: 'C++ Basics', status: 'ACTIVE' },
    ]),
  },
}));

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>();
  return {
    ...actual,
    createAnswerTicket: vi.fn(),
    createTicket: vi.fn(),
    getStudentTicket: vi.fn(),
    addTicketReply: vi.fn(),
    resolveTicket: vi.fn(),
    reopenTicket: vi.fn(),
  };
});

const CPP_ANSWER = [
  'Here is the standard C++ program:',
  '',
  '```cpp',
  '#include <iostream>',
  '',
  'int main() {',
  '    std::cout << "Hello, World!" << std::endl;',
  '    return 0;',
  '}',
  '```',
].join('\n');

const createdTicket = {
  id: 'ticket-1',
  class_id: 'class-1',
  student_id: 'student-1',
  question: 'Please explain this C++ example.',
  original_question: 'Show me a C++ Hello World example',
  agent_answer: CPP_ANSWER,
  citations: [],
  source_message_id: 'message-1',
  status: 'OPEN',
  created_at: '2026-01-01T00:00:00Z',
  replies: [],
};

describe('Ask Teacher Markdown preview', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    Element.prototype.scrollIntoView = vi.fn();
    vi.mocked(studentApi.classes).mockResolvedValue([
      { id: 'class-1', code: 'CS101', name: 'C++ Basics', status: 'ACTIVE' },
    ] as never);
    vi.mocked(createAnswerTicket).mockResolvedValue(createdTicket as never);
    vi.mocked(getStudentTicket).mockResolvedValue(createdTicket as never);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.clearAllMocks();
  });

  function button(label: string) {
    const found = Array.from(host.querySelectorAll('button')).find(
      (item) => item.textContent === label,
    );
    if (!found) throw new Error(`Button not found: ${label}`);
    return found;
  }

  it('renders the full answer preview and the created ticket answer as code', async () => {
    await act(async () => {
      root.render(
        <AskTeacherButton
          classId="class-1"
          question="Show me a C++ Hello World example"
          feedbackContext={{ messageId: 'message-1', answer: CPP_ANSWER, citations: [] }}
        />,
      );
      await Promise.resolve();
    });

    await act(async () => {
      button('Ask my teacher').click();
      await Promise.resolve();
    });

    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    expect(host.textContent).toContain('#include');
    expect(host.textContent).toContain('std::cout');
    expect(host.textContent).not.toContain('```');
    expect(host.querySelector('pre code')).not.toBeNull();

    await act(async () => {
      button('Confirm and send').click();
      await Promise.resolve();
    });

    expect(vi.mocked(createAnswerTicket)).toHaveBeenCalledWith('message-1', '');
    expect(host.textContent).toContain('Ticket created');
    expect(host.textContent).toContain('#include');
    expect(host.textContent).not.toContain('```');
    expect(host.querySelector('pre code')).not.toBeNull();
  });

  it('keeps a plain-text selection in a whitespace-preserving preview', async () => {
    await act(async () => {
      root.render(
        <AskTeacherButton
          classId="class-1"
          question="Explain this selection"
          selection={{ text: '  line one\n    line two  ', left: 10, top: 10 }}
        />,
      );
      await Promise.resolve();
    });

    await act(async () => {
      button('Ask my teacher').click();
      await Promise.resolve();
    });

    const preview = host.querySelector('textarea[aria-label="Agent answer"]') as HTMLTextAreaElement;
    expect(preview).not.toBeNull();
    expect(preview.value).toBe('  line one\n    line two  ');
  });

  it('creates a selection ticket with literal text and no Markdown code block', async () => {
    const selection = [
      'int main() {',
      '    // literal #include <iostream> stays visible',
      '    return 0;',
      '}',
    ].join('\n');
    const selectionTicket = {
      ...createdTicket,
      agent_answer: selection,
      source_message_id: null,
    };
    vi.mocked(createTicket).mockResolvedValue(selectionTicket as never);
    vi.mocked(getStudentTicket).mockResolvedValue(selectionTicket as never);

    await act(async () => {
      root.render(
        <AskTeacherButton
          classId="class-1"
          question="Explain this selection"
          selection={{ text: selection, left: 10, top: 10 }}
        />,
      );
      await Promise.resolve();
    });

    await act(async () => {
      button('Ask my teacher').click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const question = host.querySelector('#ticket-question') as HTMLTextAreaElement;
    const setValue = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value',
    )?.set;
    await act(async () => {
      setValue?.call(question, 'Please explain');
      question.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      button('Create ticket').click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(vi.mocked(createTicket)).toHaveBeenCalledWith(
      expect.objectContaining({ agent_answer: selection }),
    );
    expect(host.textContent).toContain('Ticket created');
    expect(host.textContent).toContain('literal #include <iostream>');
    expect(host.textContent).toContain('    // literal');
    expect(host.querySelector('pre')).toBeNull();
  });
});
