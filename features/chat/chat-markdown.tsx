'use client';

import * as React from 'react';

import { MarkdownContent } from '@/components/shared/MarkdownContent';
import { CitationChip } from '@/features/citations/citation-chip';
import { formatInlineCitations } from '@/lib/citations';
import type { ChatCitation } from '@/lib/sse';

function cleanMathDelimiters(text: string): string {
  // Convert any unparsed LaTeX $...$ or $$...$$ to clean inline code so raw dollar signs never leak
  return text
    .split(/(```[\s\S]*?```|`[^`\n]*`)/g)
    .map((segment, index) => {
      if (index % 2 === 1) return segment;
      return segment
        .replace(/\$\$([\s\S]*?)\$\$/g, '`$1`')
        .replace(/\$([^\$\n]+)\$/g, '`$1`');
    })
    .join('');
}

/**
 * Chat answers are LLM output, so they get the full Markdown surface: GFM
 * tables, blockquotes, lists, inline code and fenced code blocks with a copy
 * button - instead of the old hand-rolled subset that leaked raw backticks.
 *
 * Citation markers become short curriculum labels built from real metadata
 * (`Dsa · Mục 1.1 · Trang 12`), with the full original title, section path and
 * page in the accessible label. Web markers keep their existing italic labels.
 */
export function ChatMarkdown({
  content,
  citations = [],
}: {
  content: string;
  citations?: ChatCitation[];
}) {
  const formatted = React.useMemo(() => {
    const cited = formatInlineCitations(content, citations);
    return cleanMathDelimiters(cited);
  }, [content, citations]);

  const byMarker = React.useMemo(() => {
    const map = new Map<number, ChatCitation>();
    for (const citation of citations) {
      const markers = citation.indexes.length > 0 ? citation.indexes : [citation.index];
      for (const marker of markers) {
        if (!map.has(marker)) map.set(marker, citation);
      }
    }
    return map;
  }, [citations]);

  return (
    <MarkdownContent
      content={formatted}
      className="chat-markdown"
      renderCitation={(marker, fallback) => {
        const citation = byMarker.get(marker);
        if (!citation || citation.kind !== 'curriculum') return fallback;
        return <CitationChip citation={citation} variant="inline" marker={marker} />;
      }}
    />
  );
}
