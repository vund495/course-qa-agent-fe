"use client";

import * as React from "react";
import {
  Bold,
  Code,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Strikethrough,
  Underline,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Ticket replies were plain text. The reply panel now offers the formatting
 * shortcuts users expect from a helpdesk composer, so the same tiny markdown-ish
 * subset is rendered back: **bold**, *italic*, __underline__, ~~strike~~,
 * `code`, "> " quotes, "- " bullets, "1. " steps, a "---" separator and safe
 * http(s)/mailto links ("[label](url)"). No HTML is produced, so message
 * content can never inject markup.
 */

const INLINE =
  /(\[[^[\]\n]+\]\((?:https?:\/\/|mailto:)[^\s)]+\)|\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|`[^`\n]+`|\*[^*\n]+\*)/g;

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  INLINE.lastIndex = 0;

  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${match.index}`;
    if (token.startsWith("[")) {
      const split = token.indexOf("](");
      nodes.push(
        <a
          key={key}
          href={token.slice(split + 2, -1)}
          target="_blank"
          rel="noopener noreferrer"
          className="break-words text-[#2A5D8F] underline underline-offset-2"
        >
          {token.slice(1, split)}
        </a>,
      );
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("__")) {
      nodes.push(<u key={key}>{token.slice(2, -2)}</u>);
    } else if (token.startsWith("~~")) {
      nodes.push(<s key={key}>{token.slice(2, -2)}</s>);
    } else if (token.startsWith("`")) {
      nodes.push(
        <code key={key} className="rounded bg-[#F2F2F2] px-1 py-0.5 font-mono text-[0.92em]">
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    }
    cursor = match.index + token.length;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

export function TicketMessageText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const blocks = React.useMemo(() => {
    const lines = text.split(/\r?\n/);
    const out: React.ReactNode[] = [];
    let list: { ordered: boolean; items: string[] } | null = null;

    const flushList = () => {
      if (!list) return;
      const Tag = list.ordered ? "ol" : "ul";
      out.push(
        <Tag
          key={`list-${out.length}`}
          className={cn(
            "my-1.5 space-y-1 pl-5",
            list.ordered ? "list-decimal" : "list-disc",
          )}
        >
          {list.items.map((item, index) => (
            <li key={index}>{renderInline(item, `li-${out.length}-${index}`)}</li>
          ))}
        </Tag>,
      );
      list = null;
    };

    lines.forEach((line, index) => {
      const ordered = /^\d+\.\s+/.test(line);
      const bullet = /^[-*]\s+/.test(line);
      if (ordered || bullet) {
        const body = line.replace(/^\d+\.\s+/, "").replace(/^[-*]\s+/, "");
        if (!list || list.ordered !== ordered) {
          flushList();
          list = { ordered, items: [body] };
        } else {
          list.items.push(body);
        }
        return;
      }
      flushList();
      if (line.trim() === "---") {
        out.push(<hr key={`hr-${index}`} className="my-3 border-[#E5E5E5]" />);
        return;
      }
      if (line.startsWith("> ")) {
        out.push(
          <blockquote
            key={`quote-${index}`}
            className="my-1.5 border-l-2 border-[#C9C9C9] pl-3 text-[#5A5A5A]"
          >
            {renderInline(line.slice(2), `quote-${index}`)}
          </blockquote>,
        );
        return;
      }
      if (line.trim() === "") {
        out.push(<div key={`gap-${index}`} className="h-2" />);
        return;
      }
      out.push(
        <p key={`p-${index}`} className="whitespace-pre-wrap break-words">
          {renderInline(line, `p-${index}`)}
        </p>,
      );
    });
    flushList();
    return out;
  }, [text]);

  return <div className={cn("space-y-0.5 text-sm leading-relaxed", className)}>{blocks}</div>;
}

type TicketToolbarAction = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  before: string;
  after?: string;
};

const TICKET_TOOLBAR: TicketToolbarAction[] = [
  { id: "code", label: "Code", icon: Code, before: "`", after: "`" },
  { id: "quote", label: "Quote", icon: Quote, before: "> " },
  { id: "bold", label: "Bold", icon: Bold, before: "**", after: "**" },
  { id: "italic", label: "Italic", icon: Italic, before: "*", after: "*" },
  { id: "underline", label: "Underline", icon: Underline, before: "__", after: "__" },
  { id: "strike", label: "Strikethrough", icon: Strikethrough, before: "~~", after: "~~" },
  { id: "ordered", label: "Numbered list", icon: ListOrdered, before: "1. " },
  { id: "bullets", label: "Bullet list", icon: List, before: "- " },
  { id: "link", label: "Link", icon: Link2, before: "[", after: "](https://)" },
  { id: "divider", label: "Divider", icon: Minus, before: "\n---\n" },
];

export function TicketReplyToolbar({
  textareaRef,
  onInsert,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onInsert: (textarea: HTMLTextAreaElement, before: string, after: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-[#E5E5E5] bg-[#FAFAFA] px-1.5 py-1">
      {TICKET_TOOLBAR.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.id}
            type="button"
            title={action.label}
            aria-label={action.label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              const textarea = textareaRef.current;
              if (!textarea) return;
              onInsert(textarea, action.before, action.after ?? "");
            }}
            className="flex size-7 items-center justify-center rounded text-[#5A5A5A] transition-colors hover:bg-[#EDEDED] hover:text-[#111111] focus-visible:outline-2 focus-visible:outline-offset-1"
          >
            <Icon className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
}
