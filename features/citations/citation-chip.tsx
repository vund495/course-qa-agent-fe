'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { AUTH_TOKEN_KEY } from '@/components/ui/nav-config';
import {
  citationCurriculumLabel,
  citationFullDescription,
  citationShortInlineLabel,
  cleanCitationText,
  normalizeCitationUrl,
} from '@/lib/citations';
import { cn } from '@/lib/utils';
import type { ChatCitation } from '@/lib/sse';
import { usePathname, useParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

/** Fetch the original cited file; the caller jumps to the cited page. */
async function fetchSource(citation: ChatCitation, token: string): Promise<Response> {
  const base = `${API_URL}/api/chat/sources/${encodeURIComponent(citation.documentId ?? '')}`;
  return fetch(base, { headers: { Authorization: `Bearer ${token}` } });
}

async function openClassSource(citation: ChatCitation) {
  const title = cleanCitationText(citation.title);
  const isDocxOrPptx = Boolean(
    title &&
      (title.toLowerCase().endsWith('.docx') ||
        title.toLowerCase().endsWith('.doc') ||
        title.toLowerCase().endsWith('.pptx') ||
        title.toLowerCase().endsWith('.ppt'))
  );
  if (isDocxOrPptx) {
    toast.info('Opening source file.');
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

    const targetPage =
      citation.page ??
      (citation.pages ?? []).find((page) => typeof page === 'number') ??
      null;
    const objectUrl = URL.createObjectURL(await response.blob());
    // #page jumps the browser's PDF viewer straight to the cited page.
    const target = targetPage === null ? objectUrl : `${objectUrl}#page=${targetPage}`;
    if (viewer) viewer.location.href = target;
    else window.open(target, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (error) {
    viewer?.close();
    toast.error(error instanceof Error ? error.message : 'The source file could not be opened.');
  }
}

export function CitationChip({
  citation,
  variant = 'chip',
  marker,
}: {
  citation: ChatCitation;
  variant?: 'chip' | 'inline';
  /** Exact marker clicked inline; aliases remain available in the citation. */
  marker?: number;
}) {
  const pathname = usePathname();
  const params = useParams();
  const classId = params?.id as string | undefined;

  const isCurriculum = citation.kind === 'curriculum';
  const url = normalizeCitationUrl(citation.url);
  const markers = citation.indexes.length > 0 ? citation.indexes : [citation.index];
  const markerLabel = markers.map((value) => `[${value}]`).join('');
  const displayLabel = isCurriculum
    ? citationCurriculumLabel(citation)
    : cleanCitationText(citation.title) || 'Source';
  const label = [markerLabel, displayLabel].filter(Boolean).join(' ');
  const inlineText = citationShortInlineLabel(citation, marker);
  const sourceTitle = cleanCitationText(citation.title).toLowerCase();

  const isSpreadsheetOrSyllabus = Boolean(
    isCurriculum &&
      sourceTitle &&
      (sourceTitle.endsWith('.xlsx') ||
        sourceTitle.endsWith('.xls') ||
        sourceTitle.endsWith('.csv') ||
        sourceTitle.includes('syllabus'))
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
    if (variant === 'inline' && isCurriculum) {
      if (isSpreadsheetOrSyllabus && syllabusPath) {
        window.open(syllabusPath, '_blank', 'noopener,noreferrer');
      } else {
        void openClassSource(citation);
      }
      return;
    }
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

  const actionTooltip = url
    ? `Visit website: ${url}`
    : isSpreadsheetOrSyllabus && syllabusPath
    ? `View in Syllabus: ${displayLabel || markerLabel}`
    : `Open cited source: ${displayLabel || markerLabel}`;

  if (variant === 'inline') {
    const fullDescription = citationFullDescription(citation) || inlineText;
    return (
      <button
        type="button"
        title={fullDescription}
        aria-label={inlineText}
        onClick={handleClick}
        className="inline cursor-pointer border-0 bg-transparent p-0 align-baseline font-normal not-italic text-inherit hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111]/30 focus-visible:ring-offset-1"
      >
        {inlineText}
      </button>
    );
  }

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
