'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { AUTH_TOKEN_KEY } from '@/components/ui/nav-config';
import { normalizeCitationUrl } from '@/lib/citations';
import { cn } from '@/lib/utils';
import type { ChatCitation } from '@/lib/sse';
import { usePathname, useParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

/** Fetch the cited file; PDFs come back with the used passages already highlighted. */
async function fetchSource(citation: ChatCitation, token: string): Promise<Response> {
  const base = `${API_URL}/api/chat/sources/${encodeURIComponent(citation.documentId ?? '')}`;
  const headers = { Authorization: `Bearer ${token}` };

  const isPdf = !citation.title || citation.title.toLowerCase().endsWith('.pdf');
  if (isPdf && citation.page !== null && citation.highlights.length > 0) {
    const pages = citation.pages && citation.pages.length > 0 ? citation.pages : [citation.page];
    const highlighted = await fetch(`${base}/highlight`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: citation.page, pages, passages: citation.highlights }),
    });
    if (highlighted.ok) return highlighted;
    // 415 = not a PDF; any other failure also falls back to the plain file.
  }
  return fetch(base, { headers });
}

async function openClassSource(citation: ChatCitation) {
  const isDocxOrPptx = Boolean(
    citation.title &&
      (citation.title.toLowerCase().endsWith('.docx') ||
        citation.title.toLowerCase().endsWith('.doc') ||
        citation.title.toLowerCase().endsWith('.pptx') ||
        citation.title.toLowerCase().endsWith('.ppt'))
  );
  if (isDocxOrPptx) {
    toast.info('In-document highlighting is available for PDF files. Opening source file.');
  }

  const viewer = window.open('', '_blank');
  if (viewer) viewer.opener = null;

  try {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token || !citation.documentId) {
      throw new Error('This source file is not available.');
    }

    const response = await fetchSource(citation, token);
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { detail?: string } | null;
      throw new Error(body?.detail || 'The source file could not be opened.');
    }

    const targetPageHeader = response.headers.get('x-target-page');
    const parsedTargetPage = targetPageHeader ? parseInt(targetPageHeader, 10) : null;
    const finalPage = parsedTargetPage && !isNaN(parsedTargetPage) ? parsedTargetPage : citation.page;

    const objectUrl = URL.createObjectURL(await response.blob());
    // #page jumps the browser's PDF viewer straight to the cited page.
    const target = finalPage === null ? objectUrl : `${objectUrl}#page=${finalPage}`;
    if (viewer) viewer.location.href = target;
    else window.open(target, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (error) {
    viewer?.close();
    toast.error(error instanceof Error ? error.message : 'The source file could not be opened.');
  }
}

export function CitationChip({ citation }: { citation: ChatCitation }) {
  const pathname = usePathname();
  const params = useParams();
  const classId = params?.id as string | undefined;

  const isCurriculum = citation.kind === 'curriculum';
  const url = normalizeCitationUrl(citation.url);
  const markers = citation.indexes.length > 0 ? citation.indexes : [citation.index];
  const markerLabel = markers.map((marker) => `[${marker}]`).join('');
  const pages = citation.pages && citation.pages.length > 0
    ? citation.pages
    : citation.page !== null
    ? [citation.page]
    : [];

  const pageLabel = citation.pageLabel
    ? (citation.pages && citation.pages.length > 1 ? `Pages ${citation.pageLabel}` : `Page ${citation.pageLabel}`)
    : pages.length > 1
    ? `Pages ${pages.join(', ')}`
    : pages.length === 1
    ? `Page ${pages[0]}`
    : '';

  const label = isCurriculum
    ? `${markerLabel} ${citation.title}${pageLabel ? ` · ${pageLabel}` : ''}`
    : `${markerLabel} ${citation.title}`;

  const isSpreadsheetOrSyllabus = Boolean(
    isCurriculum &&
      citation.title &&
      (citation.title.toLowerCase().endsWith('.xlsx') ||
        citation.title.toLowerCase().endsWith('.xls') ||
        citation.title.toLowerCase().endsWith('.csv') ||
        citation.title.toLowerCase().includes('syllabus'))
  );

  const isDocxOrPptx = Boolean(
    isCurriculum &&
      citation.title &&
      (citation.title.toLowerCase().endsWith('.docx') ||
        citation.title.toLowerCase().endsWith('.doc') ||
        citation.title.toLowerCase().endsWith('.pptx') ||
        citation.title.toLowerCase().endsWith('.ppt'))
  );

  const syllabusPath = React.useMemo(() => {
    if (pathname && pathname.includes('/class/')) {
      return pathname.replace(/\/agent(?:\/.*)?$/, '/syllabus');
    }
    if (classId) {
      const prefix = pathname?.includes('/teacher/') ? '/teacher' : '/student';
      return `${prefix}/class/${classId}/syllabus`;
    }
    return null;
  }, [pathname, classId]);

  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isCurriculum && url) {
      const cleanUrl = url.split('#:~:text=')[0];
      window.open(cleanUrl, '_blank', 'noopener,noreferrer');
    } else if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else if (isSpreadsheetOrSyllabus && syllabusPath) {
      window.open(syllabusPath, '_blank', 'noopener,noreferrer');
    } else {
      void openClassSource(citation);
    }
  };

  const hasHighlights = citation.highlights && citation.highlights.length > 0;
  const actionTooltip = url
    ? `Visit website: ${url}`
    : isSpreadsheetOrSyllabus && syllabusPath
    ? `View in Syllabus: ${citation.title}`
    : isDocxOrPptx
    ? `Download document: ${citation.title} (In-document highlight available for PDF only)`
    : `Open source file: ${citation.title}${
        citation.page ? ` (Page ${citation.page}${hasHighlights ? '' : ' - Reference'})` : ''
      }`;

  return (
    <span className="relative inline-block align-baseline">
      <button
        type="button"
        title={actionTooltip}
        aria-label={actionTooltip}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md bg-[#F7F7F7] px-2 py-0.5 text-xs font-medium text-[#5A5A5A] ring-1 ring-inset ring-[#DADADA] transition-colors hover:bg-slate-100 hover:text-[#111111] hover:ring-[#B8B8B8] cursor-pointer',
        )}
        onClick={handleClick}
      >
        {url ? (
          <svg
            className="w-3 h-3 text-slate-400 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
            />
          </svg>
        ) : (
          <svg
            className="w-3 h-3 text-[var(--brand)] shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          </svg>
        )}
        <span className="truncate max-w-[240px]">{label}</span>
      </button>
    </span>
  );
}
